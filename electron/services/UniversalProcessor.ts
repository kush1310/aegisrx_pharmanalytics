import * as XLSX from 'xlsx';
import crypto from 'crypto';
import fuzzysort from 'fuzzysort';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads, products, pharmacies, pharmacyProducts, salesTransactions, doctors } from '../db/schema';
import { getUniqueHeaders, analyzeHeaders } from '../routes/excel';
import { AiService } from './AiService';

/**
 * isPdfBuffer — checks first 4 bytes for the %PDF magic number.
 * @param  {Buffer} buf - Raw file bytes stored in the DB.
 * @returns {boolean}
 */
function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
}

export async function processUploadInBackground(uploadId: number) {
  // Use setImmediate to yield to event loop
  setImmediate(() => {
    executeProcessing(uploadId).catch(err => {
      console.error('[UniversalProcessor] Error processing upload:', err);
      const db = getDb();
      db.update(excelUploads).set({ status: 'ERROR' }).where(eq(excelUploads.id, uploadId)).run();
    });
  });
}

/**
 * executeProcessing
 *
 * Background orchestration function that reads the binary excel file from the database,
 * scans the first 50 rows to construct a comprehensive unique headers set, detects
 * the file format, and parses the content into products or sales transactions.
 *
 * @param  {number} uploadId  - Primary key of the upload record in ExcelUpload table.
 * @returns {Promise<void>}   - Processes raw excel data and updates database status.
 */
async function executeProcessing(uploadId: number) {
  const db = getDb();
  const upload = db.select().from(excelUploads).where(eq(excelUploads.id, uploadId)).get();
  if (!upload) return;

  // Resolve raw row array — PDF path or Excel/CSV path
  let rawData: any[] = [];

  const fileBuffer = upload.fileData as Buffer;

  if (isPdfBuffer(fileBuffer)) {
    console.log(`[UniversalProcessor] Ingesting PDF in background for uploadId: ${uploadId}`);
    // Check if we have cached parsed data from the upload validation step
    const cachedData = (AiService as any).parsedDataCache?.get(uploadId);
    if (cachedData && cachedData.length > 0) {
      console.log(`[UniversalProcessor] Using cached parsed data for uploadId: ${uploadId}`);
      rawData = cachedData;
      (AiService as any).parsedDataCache?.delete(uploadId); // clean memory cache
    } else {
      console.log(`[UniversalProcessor] Cache miss, parsing PDF for uploadId: ${uploadId}`);
      rawData = await AiService.parsePdfContent(fileBuffer, upload.format || 'party_report');
    }
  } else {
    try {
      const workbook  = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rawData = XLSX.utils.sheet_to_json(
        sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[0]
      ) as any[];
    } catch (xlsxErr) {
      console.error('[UniversalProcessor] XLSX.read failed:', xlsxErr);
    }
  }

  if (!rawData.length) {
    db.update(excelUploads).set({ status: 'ERROR_EMPTY' }).where(eq(excelUploads.id, uploadId)).run();
    return;
  }

  const hdrs = getUniqueHeaders(rawData);
  const { format } = analyzeHeaders(hdrs);

  // If format is unknown but we parsed valid data (e.g. from Gemini or cache), default to the stored upload format
  const finalFormat = format !== 'unknown' ? format : (upload.format || 'party_report');
  console.log(`[UniversalProcessor] finalFormat: ${finalFormat} for uploadId: ${uploadId}`);

  if (finalFormat === 'party_report') {
    await processSalesAnalytics(rawData, uploadId);
  } else if (finalFormat === 'product') {
    await processProductMaster(rawData, uploadId);
  } else if (finalFormat === 'doctor') {
    await processDoctorMaster(rawData, uploadId);
  } else if (finalFormat === 'pharmacy') {
    await processPharmacyMaster(rawData, uploadId);
  } else {
    db.update(excelUploads).set({ status: 'ERROR_UNKNOWN_FORMAT' }).where(eq(excelUploads.id, uploadId)).run();
  }
}

async function processProductMaster(rawData: any[], uploadId: number) {
  const db = getDb();
  
  const headersSet = new Set<string>();
  const scanLimit = Math.min(rawData.length, 50);
  for (let i = 0; i < scanLimit; i++) {
    if (rawData[i]) {
      Object.keys(rawData[i]).forEach(k => headersSet.add(k));
    }
  }
  const headers = Array.from(headersSet);
  const productField = findHeader(headers, ['product', 'item', 'name']);
  const packField = findHeader(headers, ['pack', 'packaging', 'size']);

  db.transaction((tx) => {
    const allProducts = tx.select().from(products).all();
    const prodCache = new Set<string>();
    for (const p of allProducts) {
      prodCache.add(`${p.name}|${p.pack || ''}`);
    }

    for (const row of rawData) {
      const pName = row[productField || '']?.toString().trim();
      if (!pName) continue;
      
      const uName = pName.toUpperCase();
      const packVal = row[packField || '']?.toString().trim() || null;
      const key = `${uName}|${packVal || ''}`;

      if (!prodCache.has(key)) {
        tx.insert(products).values({ name: uName, pack: packVal }).run();
        prodCache.add(key);
      }
    }
    tx.update(excelUploads).set({ status: 'COMPLETED' }).where(eq(excelUploads.id, uploadId)).run();
  });
}

async function processSalesAnalytics(rawData: any[], uploadId: number) {
  const db = getDb();
  
  const headersSet = new Set<string>();
  const scanLimit = Math.min(rawData.length, 50);
  for (let i = 0; i < scanLimit; i++) {
    if (rawData[i]) {
      Object.keys(rawData[i]).forEach(k => headersSet.add(k));
    }
  }
  const headers = Array.from(headersSet);
  const prField = findHeader(headers, ['product', 'item', 'name']);
  const sqField = findHeader(headers, ['salequantity', 'saleqty', 'qty', 'quantity']);
  const amField = findHeader(headers, ['amount', 'value', 'total']);
  const fqField = findHeader(headers, ['free3amount', 'free', 'freeqty']);
  
  // Cache pharmacies and products
  const allPharmacies = db.select().from(pharmacies).all();
  const allProducts = db.select().from(products).all();

  // Maps to track what we've resolved/created during this batch to avoid redundant inserts
  const pharmacyMap = new Map<string, number>();
  const productMap = new Map<string, number>();
  
  // Cache for existing links to avoid duplicate insertions
  const existingLinks = new Set<string>();
  const allLinks = db.select().from(pharmacyProducts).all();
  for (const l of allLinks) {
    existingLinks.add(`${l.pharmacyId}|${l.productId}`);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  db.transaction((tx) => {
    let currentPharmacyName = '';
    const salesBatch: any[] = [];
    const linkBatch: any[] = [];

    const flushBatches = () => {
      if (linkBatch.length > 0) {
        for (const item of linkBatch) {
          const key = `${item.pharmacyId}|${item.productId}`;
          if (!existingLinks.has(key)) {
            try {
              tx.insert(pharmacyProducts).values(item).run();
              existingLinks.add(key);
            } catch (e) {}
          }
        }
        linkBatch.length = 0;
      }
      if (salesBatch.length > 0) {
        try {
          tx.insert(salesTransactions).values(salesBatch).run();
        } catch (e) {
          console.error('[DB] salesBatch insert error:', e);
        }
        salesBatch.length = 0;
      }
    };

    for (const row of rawData) {
      const pv = row[prField || '']?.toString().trim();
      const amountVal = row[amField || ''];
      const saleQtyVal = row[sqField || ''];
      const freeQtyVal = row[fqField || ''];

      if (!pv) continue;

      const pvLower = pv.toLowerCase();

      // Skip repeating header rows
      if (pvLower === 'product' || pvLower === 'item' || pvLower === 'medicine' || pvLower === prField?.toLowerCase()) {
        continue;
      }

      const isTotalRow = pvLower.includes('party total') || pvLower.includes('grand total') || pvLower === 'total' || pvLower === 'grandtotal';
      
      const amountNum = Number(amountVal);
      const isPharmacyHeader = (amountVal === undefined || amountVal === null || amountVal === '' || isNaN(amountNum)) && !isTotalRow;

      if (isPharmacyHeader) {
        currentPharmacyName = pv;
        continue;
      }

      if (isTotalRow) {
        continue;
      }

      if (!currentPharmacyName) {
        continue;
      }

      // At this point, pv is the medicine name
      const uProd = pv.toUpperCase();
      let prodId = productMap.get(uProd);
      if (!prodId) {
        const exProd = allProducts.find(p => p.name === uProd);
        if (exProd) {
          prodId = exProd.id;
        } else {
          const newProd = tx.insert(products).values({ name: uProd, pack: null }).returning().get();
          prodId = newProd.id;
          allProducts.push(newProd);
        }
        productMap.set(uProd, prodId);
      }

      // Resolve pharmacy
      let pharmId = pharmacyMap.get(currentPharmacyName);
      if (!pharmId) {
        const results = fuzzysort.go(currentPharmacyName, allPharmacies, { key: 'name', threshold: -1000 });
        if (results.length > 0 && results[0].score > -5000) {
          pharmId = results[0].obj.id;
        } else {
          // Create Draft Pharmacy
          const newPharm = tx.insert(pharmacies).values({
            name: currentPharmacyName,
            ownerName: 'Draft',
            licenseId: `AUTO-${crypto.randomUUID()}`,
            address: 'Draft Address',
            contact: 'Draft Contact',
            isDraft: true
          }).returning().get();
          pharmId = newPharm.id;
          allPharmacies.push(newPharm);
        }
        pharmacyMap.set(currentPharmacyName, pharmId);
      }

      // Link Pharmacy -> Product Many-to-Many
      linkBatch.push({ pharmacyId: pharmId, productId: prodId });

      // Insert Sales Transaction
      salesBatch.push({
        pharmacyId: pharmId,
        productId: prodId,
        amount: amountNum || 0,
        saleQty: Number(saleQtyVal) || 0,
        freeQty: Number(freeQtyVal) || 0,
        freeAmt: 0,
        date: todayStr,
        uploadId: uploadId
      });

      if (salesBatch.length >= 1000 || linkBatch.length >= 1000) {
        flushBatches();
      }
    }

    flushBatches();
    tx.update(excelUploads).set({ status: 'COMPLETED' }).where(eq(excelUploads.id, uploadId)).run();
  });
}

function findHeader(headers: string[], targets: string[]): string | undefined {
  for (const t of targets) {
    const match = headers.find(h => h.toLowerCase().replace(/\s+/g, '').includes(t));
    if (match) return match;
  }
  return undefined;
}

async function processDoctorMaster(rawData: any[], uploadId: number) {
  const db = getDb();
  const hdrs = getUniqueHeaders(rawData);
  const { fieldMap } = analyzeHeaders(hdrs);

  db.transaction((tx) => {
    for (const row of rawData) {
      const name = row[fieldMap['Doctor']]?.toString().trim();
      if (!name) continue;

      const contact = row[fieldMap['Contact']]?.toString().trim() || '';
      const address = row[fieldMap['Address']]?.toString().trim() || '';
      const qualification = row[fieldMap['Qualification']]?.toString().trim() || 'Unknown';
      const specialization = row[fieldMap['Specialization']]?.toString().trim() || 'General';

      const ex = tx.select().from(doctors).where(eq(doctors.name, name)).get();
      if (ex) {
        tx.update(doctors).set({ 
          contact: contact || ex.contact, 
          address: address || ex.address, 
          qualification: qualification || ex.qualification, 
          specialization: specialization || ex.specialization,
          updatedAt: new Date().toISOString()
        }).where(eq(doctors.id, ex.id)).run();
      } else {
        tx.insert(doctors).values({ 
          name, 
          contact, 
          address, 
          qualification, 
          specialization 
        }).run();
      }
    }
    tx.update(excelUploads).set({ status: 'COMPLETED' }).where(eq(excelUploads.id, uploadId)).run();
  });
}

async function processPharmacyMaster(rawData: any[], uploadId: number) {
  const db = getDb();
  const hdrs = getUniqueHeaders(rawData);
  const { fieldMap } = analyzeHeaders(hdrs);

  db.transaction((tx) => {
    for (const row of rawData) {
      const name = row[fieldMap['Pharmacy']]?.toString().trim();
      if (!name) continue;

      const licenseId = row[fieldMap['License']]?.toString().trim() || `AUTO-${crypto.randomUUID()}`;
      const contact = row[fieldMap['Contact']]?.toString().trim() || '';
      const address = row[fieldMap['Address']]?.toString().trim() || '';

      const ex = tx.select().from(pharmacies).where(eq(pharmacies.name, name)).get();
      if (ex) {
        tx.update(pharmacies).set({ 
          licenseId, 
          address: address || ex.address, 
          contact: contact || ex.contact,
          updatedAt: new Date().toISOString()
        }).where(eq(pharmacies.id, ex.id)).run();
      } else {
        tx.insert(pharmacies).values({ 
          name, 
          ownerName: 'Draft', 
          licenseId, 
          address, 
          contact 
        }).run();
      }
    }
    tx.update(excelUploads).set({ status: 'COMPLETED' }).where(eq(excelUploads.id, uploadId)).run();
  });
}
