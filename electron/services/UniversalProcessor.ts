import * as XLSX from 'xlsx';
import crypto from 'crypto';
import fuzzysort from 'fuzzysort';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads, products, pharmacies, pharmacyProducts, doctors, salesTransactions } from '../db/schema';

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

async function executeProcessing(uploadId: number) {
  const db = getDb();
  const upload = db.select().from(excelUploads).where(eq(excelUploads.id, uploadId)).get();
  if (!upload) return;

  const workbook = XLSX.read(upload.fileData, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rawData = XLSX.utils.sheet_to_json(sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[0]) as any[];
  
  if (!rawData.length) {
    db.update(excelUploads).set({ status: 'ERROR_EMPTY' }).where(eq(excelUploads.id, uploadId)).run();
    return;
  }

  const headers = Object.keys(rawData[0]).map(h => h.toLowerCase());
  const headerStr = headers.join(' ');

  const hasProduct = headerStr.includes('product') || headerStr.includes('mfg') || headerStr.includes('pack');
  const hasSales = headerStr.includes('party') || headerStr.includes('saleqty') || headerStr.includes('amount');

  if (hasSales) {
    await processSalesAnalytics(rawData, uploadId);
  } else if (hasProduct) {
    await processProductMaster(rawData, uploadId);
  } else {
    db.update(excelUploads).set({ status: 'ERROR_UNKNOWN_FORMAT' }).where(eq(excelUploads.id, uploadId)).run();
  }
}

async function processProductMaster(rawData: any[], uploadId: number) {
  const db = getDb();
  
  const fieldMap = {
    product: findHeader(Object.keys(rawData[0]), ['product', 'name', 'item']),
    mfg: findHeader(Object.keys(rawData[0]), ['mfg', 'manufacturer']),
    pack: findHeader(Object.keys(rawData[0]), ['pack'])
  };

  db.transaction((tx) => {
    for (const row of rawData) {
      const pName = row[fieldMap.product || '']?.toString().trim();
      if (!pName) continue;
      
      const uName = pName.toUpperCase();
      const existing = tx.select().from(products).where(eq(products.name, uName)).get();
      if (!existing) {
        tx.insert(products).values({ name: uName }).run();
      }
    }
    tx.update(excelUploads).set({ status: 'COMPLETED' }).where(eq(excelUploads.id, uploadId)).run();
  });
}

async function processSalesAnalytics(rawData: any[], uploadId: number) {
  const db = getDb();
  
  const headers = Object.keys(rawData[0]);
  const pField = findHeader(headers, ['party', 'pharmacy', 'customer']);
  const prField = findHeader(headers, ['product', 'item']);
  const sqField = findHeader(headers, ['saleqty', 'qty', 'quantity']);
  const amField = findHeader(headers, ['amount', 'value', 'total']);
  const fqField = findHeader(headers, ['free', 'freeqty']);
  
  // Cache for fuzzysort
  const allPharmacies = db.select().from(pharmacies).all();
  const allProducts = db.select().from(products).all();

  // Maps to track what we've resolved/created during this batch to avoid redundant inserts
  const pharmacyMap = new Map<string, number>();
  const productMap = new Map<string, number>();
  
  const todayStr = new Date().toISOString().split('T')[0];

  db.transaction((tx) => {
    let currentPartyName = '';
    const salesBatch: any[] = [];
    const linkBatch: any[] = [];

    const flushBatches = () => {
      if (linkBatch.length > 0) {
        try { tx.insert(pharmacyProducts).values(linkBatch).onConflictDoNothing().run(); } catch(e){}
        linkBatch.length = 0;
      }
      if (salesBatch.length > 0) {
        try { tx.insert(salesTransactions).values(salesBatch).onConflictDoNothing().run(); } catch(e){}
        salesBatch.length = 0;
      }
    };

    for (const row of rawData) {
      let party = row[pField || '']?.toString().trim();
      const product = row[prField || '']?.toString().trim();
      const amount = Number(row[amField || '']) || 0;
      const saleQty = Number(row[sqField || '']) || 0;
      const freeQty = Number(row[fqField || '']) || 0;

      // Grouped Rows Logic
      if (party && !party.includes('Total:') && !product) {
        currentPartyName = party;
        continue; // It's just a header row
      }

      if (!party && currentPartyName) {
        party = currentPartyName;
      }

      if (!party || party.includes('Total:') || !product) continue;

      // Resolve Product
      const uProd = product.toUpperCase();
      let prodId = productMap.get(uProd);
      if (!prodId) {
        // Try exact match first
        const exProd = allProducts.find(p => p.name === uProd);
        if (exProd) {
          prodId = exProd.id;
        } else {
          // If not exact, we could fuzzysort, but for products, exact/uppercase is safer
          const newProd = tx.insert(products).values({ name: uProd }).returning().get();
          prodId = newProd.id;
          allProducts.push(newProd); // Update cache
        }
        productMap.set(uProd, prodId);
      }

      // Resolve Pharmacy (Fuzzy Matching)
      let pharmId = pharmacyMap.get(party);
      if (!pharmId) {
        // Fuzzysort against allPharmacies
        const results = fuzzysort.go(party, allPharmacies, { key: 'name', threshold: -1000 });
        if (results.length > 0 && results[0].score > -5000) { // arbitrary good score threshold
          pharmId = results[0].obj.id;
        } else {
          // Create Draft Pharmacy
          const newPharm = tx.insert(pharmacies).values({
            name: party,
            ownerName: 'Draft',
            licenseId: `AUTO-${crypto.randomUUID()}`,
            address: '',
            contact: '',
            isDraft: true
          }).returning().get();
          pharmId = newPharm.id;
          allPharmacies.push(newPharm);
        }
        pharmacyMap.set(party, pharmId);
      }

      // Link Pharmacy -> Product Many-to-Many
      linkBatch.push({ pharmacyId: pharmId, productId: prodId });

      // Insert Sales Transaction
      salesBatch.push({
        pharmacyId: pharmId,
        productId: prodId,
        amount: amount,
        saleQty: saleQty,
        freeQty: freeQty,
        freeAmt: 0,
        date: todayStr,
        uploadId: uploadId
      });

      if (salesBatch.length >= 1000) {
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
