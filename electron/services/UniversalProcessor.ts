import * as XLSX from 'xlsx';
import crypto from 'crypto';
import fuzzysort from 'fuzzysort';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads, products, pharmacies, pharmacyProducts, salesTransactions, doctors } from '../db/schema';
import { getUniqueHeaders, analyzeHeaders } from '../routes/excel';

/**
 * isPdfBuffer — checks first 4 bytes for the %PDF magic number.
 * @param  {Buffer} buf - Raw file bytes stored in the DB.
 * @returns {boolean}
 */
function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
}

/**
 * parsePdfToRowsBackground
 *
 * Content-aware PDF parser for pharma party/sales report PDFs.
 * Identical parsing strategy to parsePdfToRows in intelligentRouter.ts.
 *
 * Strategy (handles space-separated table PDFs like the Pharma Distributors format):
 *   1. pdf-parse extracts the full document text as a flat string.
 *   2. Lines are split, trimmed, and filtered.
 *   3. The first line that contains BOTH 'product' and 'amount' keywords (case-insensitive)
 *      is treated as the column-header line. All preceding lines (company info, date range,
 *      report title) are skipped entirely.
 *   4. Each subsequent line is classified:
 *      - 4 numeric tokens at the end  → product row {Product, Free, FreeAmt, SaleQty, Amount}
 *      - No trailing numeric tokens   → pharmacy/party name row {Product} (no Amount key)
 *      - Starts with 'Party Total' or 'Grand Total' → skipped
 *   5. Pharmacy name rows have no Amount key, so processSalesAnalytics treats them as
 *      currentPharmacyName headers via the existing isPharmacyHeader detection.
 *
 * Fallback: if no header line is found, uses tab or comma delimiter on line 0.
 *
 * @param  {Buffer} buf      - PDF file buffer.
 * @returns {Promise<any[]>} - Array of row objects keyed Product/Free/FreeAmt/SaleQty/Amount.
 * @edge-cases               - Returns empty array if pdf-parse throws or text is blank.
 */
async function parsePdfToRowsBackground(buf: Buffer): Promise<any[]> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData  = await pdfParse(buf);
    const text     = pdfData.text || '';

    const rawLines: string[] = text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (rawLines.length < 2) return [];

    // ── Strategy 1: Table-based party report PDFs ────────────────────────────
    // Find the column-header line: must contain BOTH 'product' AND 'amount'
    let headerLineIdx = -1;
    for (let i = 0; i < Math.min(rawLines.length, 30); i++) {
      const lower = rawLines[i].toLowerCase();
      if (lower.includes('product') && lower.includes('amount')) {
        headerLineIdx = i;
        break;
      }
    }

    if (headerLineIdx !== -1) {
      // Product row pattern: any text (product name) followed by exactly 4 numeric groups.
      // Handles Indian number formats (digits, commas, dots).
      const productRowRegex = /^(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
      const rows: any[] = [];

      for (let i = headerLineIdx + 1; i < rawLines.length; i++) {
        const line  = rawLines[i];
        const lower = line.toLowerCase();

        // Skip Party Total and Grand Total summary rows — they duplicate product data
        if (lower.startsWith('party total') || lower.startsWith('grand total') || lower === 'total') continue;

        const match = productRowRegex.exec(line);
        if (match) {
          // Product row: name + Free + FreeAmt + SaleQty + Amount
          rows.push({
            Product: match[1].trim(),
            Free:    match[2].replace(/,/g, ''),
            FreeAmt: match[3].replace(/,/g, ''),
            SaleQty: match[4].replace(/,/g, ''),
            Amount:  match[5].replace(/,/g, ''),
          });
        } else {
          // Pharmacy / party name row — emit with only Product key (no Amount).
          // processSalesAnalytics checks: isPharmacyHeader = (amountVal === undefined || isNaN(amountNum))
          // This correctly sets currentPharmacyName = line.
          rows.push({ Product: line });
        }
      }

      return rows;
    }

    // ── Strategy 2: Fallback for CSV/TSV-inside-PDF ──────────────────────────
    const tabCount  = rawLines.filter((l: string) => l.includes('\t')).length;
    const delimiter = tabCount > rawLines.length / 2 ? '\t' : ',';
    const headers   = rawLines[0].split(delimiter).map((h: string) => h.trim()).filter(Boolean);
    if (headers.length === 0) return [];

    const rows: any[] = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cells = rawLines[i].split(delimiter).map((c: string) => c.trim());
      if (cells.every((c: string) => c === '')) continue;
      const row: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => { row[h] = cells[idx] ?? ''; });
      rows.push(row);
    }
    return rows;

  } catch (err) {
    console.error('[UniversalProcessor] parsePdfToRowsBackground failed:', err);
    return [];
  }
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
    rawData = await parsePdfToRowsBackground(fileBuffer);
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

  if (format === 'party_report') {
    await processSalesAnalytics(rawData, uploadId);
  } else if (format === 'product') {
    await processProductMaster(rawData, uploadId);
  } else if (format === 'doctor') {
    await processDoctorMaster(rawData, uploadId);
  } else if (format === 'pharmacy') {
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
