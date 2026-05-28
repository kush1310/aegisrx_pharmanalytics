import { Hono } from 'hono';
import { eq, desc, inArray, and } from 'drizzle-orm';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { getDb } from '../db/index';
import { excelUploads, doctors, pharmacies, products, pharmacyProducts, salesTransactions } from '../db/schema';

const excelRouter = new Hono();

// ── Levenshtein Distance & Fuzzy Mapping ────────────────────────────────
function levenshtein(a: string, b: string): number {
  const an = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bn = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (an.length === 0) return bn.length;
  if (bn.length === 0) return an.length;
  const matrix = Array.from({ length: an.length + 1 }, () => Array(bn.length + 1).fill(0));
  for (let i = 0; i <= an.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= bn.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= an.length; i++) {
    for (let j = 1; j <= bn.length; j++) {
      const cost = an[i - 1] === bn[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an.length][bn.length];
}

type DetectedFormat = 'doctor' | 'pharmacy' | 'product' | 'party_report' | 'unknown';
interface ColumnMapping { excelCol: string; mappedTo: string; confidence: number }

const MODULES = {
  product: ['Product', 'Pack', 'Mfg', 'Generic'],
  party_report: ['Party', 'SaleQty', 'Amount', 'Free', 'Product'],
  doctor: ['Doctor', 'Specialization', 'Contact', 'Address', 'Qualification'],
  pharmacy: ['Pharmacy', 'License', 'Contact', 'Address']
};

function analyzeHeaders(headers: string[]) {
  const columnMappings: ColumnMapping[] = [];
  const fieldMap: Record<string, string> = {};
  
  let bestFormat: DetectedFormat = 'unknown';
  let bestScore = -1;

  for (const [format, targets] of Object.entries(MODULES)) {
    let score = 0;
    const tempMappings: ColumnMapping[] = [];
    const tempFieldMap: Record<string, string> = {};

    for (const t of targets) {
      let bestDist = Infinity;
      let bestHeader = '';
      for (const h of headers) {
        const hn = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const tn = t.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (hn.includes(tn) || tn.includes(hn)) {
          bestDist = 0; bestHeader = h; break;
        }
        const dist = levenshtein(hn, tn);
        if (dist < bestDist) { bestDist = dist; bestHeader = h; }
      }
      if (bestDist <= 3) {
        // Essential fields get higher weight
        score += (['Party', 'Product', 'Doctor', 'Pharmacy'].includes(t) ? 2 : 1);
        const conf = bestDist === 0 ? 1 : Math.max(0.4, 1 - (bestDist / 10));
        tempMappings.push({ excelCol: bestHeader, mappedTo: t, confidence: conf });
        tempFieldMap[t] = bestHeader;
      }
    }

    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestFormat = format as DetectedFormat;
      columnMappings.length = 0;
      columnMappings.push(...tempMappings);
      for (const key in fieldMap) delete fieldMap[key];
      Object.assign(fieldMap, tempFieldMap);
    }
  }

  return { format: bestFormat, confidence: Math.min(1, bestScore / 4), columnMappings, fieldMap };
}

const parseExcelDate = (v: any): string | null => {
  if (typeof v === 'number') return new Date((v - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; }
  return null;
};

// ── POST /api/excel/analyze ───────────────────────────────────────────
excelRouter.post('/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const fileBuffer = Buffer.from(body.buffer);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const db = getDb();

    const existingUpload = db.select().from(excelUploads).where(eq(excelUploads.fileHash, fileHash)).get();
    if (existingUpload) return c.json({ success: false, error: 'This file has already been uploaded.' }, 409);

    const workbook  = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet     = workbook.Sheets[workbook.SheetNames[0]];
    const rawData   = XLSX.utils.sheet_to_json(sheet) as any[];
    if (!rawData.length) return c.json({ success: false, error: 'Excel file is empty.' }, 400);

    const headers = Object.keys(rawData[0]);
    const { format, confidence, columnMappings, fieldMap } = analyzeHeaders(headers);

    const warnings: string[] = [];
    const parsedData: any[] = [];
    let validRows = 0, invalidRows = 0;

    if (format === 'party_report') {
      let currentPharmacy = '';
      for (const row of rawData) {
        const pv = row[fieldMap['Product']]?.toString().trim();
        const av = row[fieldMap['Amount']];
        if (pv?.includes('Total:')) continue;
        if (pv && (av === undefined || av === '' || isNaN(Number(av)))) { currentPharmacy = pv; continue; }
        if (currentPharmacy && pv && !isNaN(Number(av))) {
          validRows++;
          parsedData.push({
            doctorName: 'Unknown Doctor', // Will be resolved by Smart Link if exists
            pharmacyName: currentPharmacy,
            productName: pv,
            free: Number(row[fieldMap['Free']]) || 0,
            freeAmt: 0,
            saleQty: Number(row[fieldMap['SaleQty']]) || 0,
            amount: Number(av),
            date: new Date().toISOString().split('T')[0]
          });
        } else if (pv) { invalidRows++; }
      }
    } else if (format === 'doctor') {
      for (const row of rawData) {
        const name = row[fieldMap['Doctor']]?.toString().trim();
        if (name) {
          validRows++;
          parsedData.push({
            name,
            contact: row[fieldMap['Contact']]?.toString().trim() || '',
            address: row[fieldMap['Address']]?.toString().trim() || '',
            qualification: row[fieldMap['Qualification']]?.toString().trim() || 'Unknown',
            specialization: row[fieldMap['Specialization']]?.toString().trim() || 'General'
          });
        } else { invalidRows++; }
      }
    } else if (format === 'pharmacy') {
      for (const row of rawData) {
        const name = row[fieldMap['Pharmacy']]?.toString().trim();
        if (name) {
          validRows++;
          parsedData.push({
            name,
            licenseId: row[fieldMap['License']]?.toString().trim() || `AUTO-${crypto.randomUUID()}`,
            contact: row[fieldMap['Contact']]?.toString().trim() || '',
            address: row[fieldMap['Address']]?.toString().trim() || ''
          });
        } else { invalidRows++; }
      }
    } else if (format === 'product') {
      for (const row of rawData) {
        const name = row[fieldMap['Product']]?.toString().trim();
        if (name) { validRows++; parsedData.push({ name }); } else { invalidRows++; }
      }
    }

    if (validRows === 0) return c.json({ success: false, error: `No valid records. Detected format: ${format}` }, 400);
    if (invalidRows > validRows) warnings.push(`${invalidRows} rows could not be parsed`);

    return c.json({
      success: true,
      data: {
        analysis: { format, confidence, totalRows: rawData.length, validRows, invalidRows, warnings, columnMappings, preview: parsedData.slice(0, 5), newEntities: { doctors: [], pharmacies: [], products: [] }, existingEntities: { doctors: [], pharmacies: [], products: [] }, parsedData },
        fileHash, fileName: body.fileName, fileSize: fileBuffer.length
      }
    });
  } catch (err: any) {
    console.error('[excel/analyze]', err);
    return c.json({ success: false, error: `Analysis failed: ${err?.message}` }, 500);
  }
});

// ── POST /api/excel/confirm ───────────────────────────────────────────
excelRouter.post('/confirm', async (c) => {
  try {
    const body = await c.req.json();
    const { analysis, fileHash, fileName, fileSize } = body;
    const fileBuffer = Buffer.from(body.buffer);
    const { format, parsedData } = analysis;
    const db = getDb();

    let created = 0, updated = 0;
    let uploadId = 0;

    // ATOMIC TRANSACTION FOR BULK UPSERTS
    db.transaction((tx) => {
      const upload = tx.insert(excelUploads).values({ fileName, fileHash, fileSize, fileData: fileBuffer }).returning().get();
      uploadId = upload.id;

      if (format === 'doctor') {
        for (const r of parsedData) {
          const ex = tx.select().from(doctors).where(eq(doctors.name, r.name)).get();
          if (ex) {
            tx.update(doctors).set({ contact: r.contact || ex.contact, address: r.address || ex.address, qualification: r.qualification || ex.qualification, specialization: r.specialization || ex.specialization }).where(eq(doctors.id, ex.id)).run();
            updated++;
          } else {
            tx.insert(doctors).values({ name: r.name, contact: r.contact, address: r.address, qualification: r.qualification, specialization: r.specialization }).run();
            created++;
          }
        }
      } else if (format === 'pharmacy') {
        for (const r of parsedData) {
          const ex = tx.select().from(pharmacies).where(eq(pharmacies.name, r.name)).get();
          if (ex) {
            tx.update(pharmacies).set({ licenseId: r.licenseId, address: r.address || ex.address, contact: r.contact || ex.contact }).where(eq(pharmacies.id, ex.id)).run();
            updated++;
          } else {
            tx.insert(pharmacies).values({ name: r.name, ownerName: 'Unknown', licenseId: r.licenseId, address: r.address, contact: r.contact }).run();
            created++;
          }
        }
      } else if (format === 'product') {
        for (const r of parsedData) {
          const uName = r.name.toUpperCase();
          const ex = tx.select().from(products).where(eq(products.name, uName)).get();
          if (!ex) {
            tx.insert(products).values({ name: uName }).run();
            created++;
          } else updated++;
        }
      } else if (format === 'party_report') {
        // SMART LINK LOGIC
        const doctorCache = new Map<string, number>();
        const pharmCache  = new Map<string, number>();
        const prodCache   = new Map<string, number>();

        for (const r of parsedData) {
          // Resolve Product (Case-Insensitive)
          const uProd = r.productName.toUpperCase();
          if (!prodCache.has(uProd)) {
            let prod = tx.select().from(products).where(eq(products.name, uProd)).get();
            if (!prod) prod = tx.insert(products).values({ name: uProd }).returning().get();
            prodCache.set(uProd, prod!.id);
          }
          
          // Resolve Pharmacy / Smart Link
          if (!pharmCache.has(r.pharmacyName)) {
            let ph = tx.select().from(pharmacies).where(eq(pharmacies.name, r.pharmacyName)).get();
            if (!ph) {
              // Create DRAFT Pharmacy if not found
              ph = tx.insert(pharmacies).values({ 
                name: r.pharmacyName, ownerName: 'Draft', licenseId: `AUTO-${crypto.randomUUID()}`, 
                address: '', contact: '', isDraft: true 
              }).returning().get();
            } else if (ph.doctorId) {
              // Smart Link: Retrieve linked doctor name for accurate reporting
              const doc = tx.select().from(doctors).where(eq(doctors.id, ph.doctorId)).get();
              if (doc) r.doctorName = doc.name;
            }
            pharmCache.set(r.pharmacyName, ph!.id);
          }
          
          const phId = pharmCache.get(r.pharmacyName)!;
          const prodId = prodCache.get(uProd)!;
          
          // Link Pharmacy -> Product Many-to-Many
          const ppEx = tx.select().from(pharmacyProducts).where(and(eq(pharmacyProducts.pharmacyId, phId), eq(pharmacyProducts.productId, prodId))).get();
          if (!ppEx) tx.insert(pharmacyProducts).values({ pharmacyId: phId, productId: prodId }).run();
        }
        created = parsedData.length;
      }
    });

    return c.json({ success: true, data: { uploadId, created, updated } });
  } catch (err: any) {
    console.error('[excel/confirm]', err);
    return c.json({ success: false, error: `Upload failed: ${err?.message}` }, 500);
  }
});

// ── GET /api/excel/history ────────────────────────────────────────────
excelRouter.get('/history', async (c) => {
  try {
    const db = getDb();
    const uploads = await db.select({
      id: excelUploads.id,
      fileName: excelUploads.fileName,
      fileSize: excelUploads.fileSize,
      uploadDate: excelUploads.uploadDate,
      status: excelUploads.status,
    }).from(excelUploads).orderBy(desc(excelUploads.uploadDate));

    // Enrich each upload with record count and detected format
    const enriched = uploads.map(u => {
      let recordCount = 0;
      let detectedFormat: string = 'unknown';
      try {
        // Count linked sales transactions
        const countResult = db.select({ id: salesTransactions.id })
          .from(salesTransactions)
          .where(eq(salesTransactions.uploadId, u.id))
          .all();
        recordCount = countResult.length;

        // Detect format by reading the stored file headers
        const full = db.select({ fileData: excelUploads.fileData }).from(excelUploads).where(eq(excelUploads.id, u.id)).get();
        if (full?.fileData) {
          const wb = XLSX.read(full.fileData, { type: 'buffer' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json(sheet) as any[];
          if (raw.length > 0) {
            const hdrs = Object.keys(raw[0]);
            const analysis = analyzeHeaders(hdrs);
            detectedFormat = analysis.format;
            if (recordCount === 0) recordCount = raw.length;
          }
        }
      } catch { /* ignore enrichment errors */ }
      return { ...u, recordCount, detectedFormat };
    });

    return c.json({ success: true, data: enriched });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch history' }, 500);
  }
});

// ── GET /api/excel/:id/analytics ─────────────────────────────────────
excelRouter.get('/:id/analytics', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = getDb();
    const upload = db.select().from(excelUploads).where(eq(excelUploads.id, id)).get();
    if (!upload) return c.json({ success: false, error: 'Upload not found' }, 404);

    // ── Primary: Query processed SalesTransaction data from DB ──
    const txns = db.select({
      pharmacyId: salesTransactions.pharmacyId,
      productId: salesTransactions.productId,
      amount: salesTransactions.amount,
      saleQty: salesTransactions.saleQty,
      freeQty: salesTransactions.freeQty,
      freeAmt: salesTransactions.freeAmt,
      date: salesTransactions.date,
    }).from(salesTransactions).where(eq(salesTransactions.uploadId, id)).all();

    if (txns.length > 0) {
      // Resolve pharmacy, product, and doctor names via batch lookups
      const pharmIds = [...new Set(txns.map(t => t.pharmacyId))];
      const prodIds = [...new Set(txns.map(t => t.productId))];

      const pharmRows = pharmIds.length > 0
        ? db.select().from(pharmacies).where(inArray(pharmacies.id, pharmIds)).all()
        : [];
      const prodRows = prodIds.length > 0
        ? db.select().from(products).where(inArray(products.id, prodIds)).all()
        : [];

      const pharmMap = new Map(pharmRows.map(p => [p.id, p]));
      const prodMap = new Map(prodRows.map(p => [p.id, p]));

      // Resolve doctors linked to pharmacies
      const docIds = [...new Set(pharmRows.filter(p => p.doctorId).map(p => p.doctorId!))];
      const docRows = docIds.length > 0
        ? db.select().from(doctors).where(inArray(doctors.id, docIds)).all()
        : [];
      const docMap = new Map(docRows.map(d => [d.id, d]));

      const result = txns.map(t => {
        const pharm = pharmMap.get(t.pharmacyId);
        const prod = prodMap.get(t.productId);
        const doc = pharm?.doctorId ? docMap.get(pharm.doctorId) : null;

        return {
          doctorName: doc?.name || 'Unknown Doctor',
          pharmacyName: pharm?.name || 'Unknown Pharmacy',
          productName: prod?.name || 'Unknown Product',
          free: t.freeQty,
          freeAmt: t.freeAmt,
          saleQty: t.saleQty,
          amount: t.amount,
          date: t.date,
        };
      });

      return c.json({ success: true, data: result });
    }

    // ── Fallback: Re-parse Excel for legacy uploads with no transactions ──
    const workbook = XLSX.read(upload.fileData, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rawData  = XLSX.utils.sheet_to_json(sheet) as any[];

    const headers = Object.keys(rawData[0] ?? {});
    const { format, fieldMap } = analyzeHeaders(headers);

    const result: any[] = [];
    if (format === 'party_report') {
      let currentPharmacy = '';
      for (const row of rawData) {
        const pv = row[fieldMap['Product']]?.toString().trim();
        const av = row[fieldMap['Amount']];
        if (pv?.includes('Total:')) continue;
        if (pv && (av === undefined || av === null || av === '' || String(av).trim() === '' || isNaN(Number(av)))) { currentPharmacy = pv; continue; }
        if (currentPharmacy && pv && !isNaN(Number(av))) {
          let doctorName = 'Unknown Doctor';
          const ph = db.select().from(pharmacies).where(eq(pharmacies.name, currentPharmacy)).get();
          if (ph && ph.doctorId) {
            const doc = db.select().from(doctors).where(eq(doctors.id, ph.doctorId)).get();
            if (doc) doctorName = doc.name;
          }
          result.push({ doctorName, pharmacyName: currentPharmacy, productName: pv, free: Number(row[fieldMap['Free']]) || 0, freeAmt: 0, saleQty: Number(row[fieldMap['SaleQty']]) || 0, amount: Number(av), date: upload.uploadDate ? upload.uploadDate.split(' ')[0] : new Date().toISOString().split('T')[0] });
        }
      }
    }
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[excel/analytics]', err);
    return c.json({ success: false, error: 'Failed to fetch analytics' }, 500);
  }
});

// ── DELETE /api/excel/:id ─────────────────────────────────────────────
excelRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.delete(excelUploads).where(eq(excelUploads.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete upload' }, 500);
  }
});

// ── GET /api/excel/:id/download ───────────────────────────────────────
excelRouter.get('/:id/download', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const upload = db.select().from(excelUploads).where(eq(excelUploads.id, id)).get();
    if (!upload) return c.json({ success: false, error: 'File not found' }, 404);
    return c.json({ success: true, data: { buffer: Array.from(upload.fileData as Buffer), fileName: upload.fileName } });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to download file' }, 500);
  }
});

export { excelRouter };
