import { Hono } from 'hono';
import { eq, desc, inArray, and } from 'drizzle-orm';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { getDb } from '../db/index';
import { excelUploads, doctors, pharmacies, products, pharmacyProducts, salesTransactions } from '../db/schema';

const excelRouter = new Hono();

// ── GET /api/excel/doctor-business ─────────────────────────────────────────
/**
 * Returns the primary "Doctor Business Summary" table the client requested.
 * Groups pharmacy totals by linked doctor. Each doctor row contains:
 *   - doctorId, doctorName
 *   - pharmacies[]: pharmacyId, pharmacyName, totalAmount, medicines[]{name, amount}
 *   - grandTotal: sum of all pharmacy amounts for this doctor
 *
 * Optional query param: ?uploadId=N (filter by specific upload)
 * Optional query param: ?limit=10|50|100 (cap number of doctors returned, default=all)
 * Optional query param: ?sort=amount|name (default=amount desc)
 *
 * @returns Grouped doctor business data sourced from SalesTransaction records
 */
excelRouter.get('/doctor-business', async (c) => {
  try {
    const db       = getDb();
    const uploadId = c.req.query('uploadId') ? Number(c.req.query('uploadId')) : null;
    if (!uploadId) {
      return c.json({ success: true, data: [] });
    }
    const limit    = c.req.query('limit') ? Math.min(500, Number(c.req.query('limit'))) : 0;
    const sort     = c.req.query('sort') || 'amount'; // 'amount' | 'name'

    // Fetch all pharmacies with their linked doctor IDs
    const allPharmacies = db.select().from(pharmacies).all();
    const allDoctors    = db.select().from(doctors).all();
    const allProducts   = db.select().from(products).all();

    const doctorMap  = new Map(allDoctors.map(d => [d.id, d]));
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    // Fetch all sales transactions (filtered by uploadId if specified)
    const txns = uploadId
      ? db.select().from(salesTransactions).where(eq(salesTransactions.uploadId, uploadId)).all()
      : db.select().from(salesTransactions).all();

    // Aggregate: pharmacyId → { amount, saleQty } per productId
    const pharmacyAmountMap = new Map<number, Map<number, { amount: number; saleQty: number }>>();
    for (const txn of txns) {
      if (!pharmacyAmountMap.has(txn.pharmacyId)) {
        pharmacyAmountMap.set(txn.pharmacyId, new Map());
      }
      const medMap = pharmacyAmountMap.get(txn.pharmacyId)!;
      const current = medMap.get(txn.productId) || { amount: 0, saleQty: 0 };
      medMap.set(txn.productId, {
        amount: current.amount + txn.amount,
        saleQty: current.saleQty + txn.saleQty
      });
    }

    // Group pharmacies by doctor
    const doctorGroups = new Map<number | null, {
      doctorId: number | null;
      doctorName: string;
      pharmacies: {
        pharmacyId: number;
        pharmacyName: string;
        totalAmount: number;
        medicines: { productId: number; name: string; amount: number; saleQty: number }[];
      }[];
    }>();

    // Pre-populate all doctors to ensure we have groups for them
    for (const doc of allDoctors) {
      doctorGroups.set(doc.id, {
        doctorId: doc.id,
        doctorName: doc.name,
        pharmacies: []
      });
    }

    for (const pharmacy of allPharmacies) {
      const docId   = pharmacy.doctorId || null;
      const medMap  = pharmacyAmountMap.get(pharmacy.id);

      const medicines: { productId: number; name: string; amount: number; saleQty: number }[] = [];
      let pharmacyTotal = 0;

      if (medMap) {
        for (const [productId, info] of medMap.entries()) {
          medicines.push({
            productId,
            name: productMap.get(productId)?.name || 'Unknown',
            amount: info.amount,
            saleQty: info.saleQty
          });
          pharmacyTotal += info.amount;
        }
        medicines.sort((a, b) => b.amount - a.amount);
      }

      if (docId !== null) {
        // Mapped pharmacy: only include it in the doctor's group if it has transactions
        if (pharmacyTotal > 0) {
          const group = doctorGroups.get(docId);
          if (group) {
            group.pharmacies.push({
              pharmacyId:   pharmacy.id,
              pharmacyName: pharmacy.name,
              totalAmount:  pharmacyTotal,
              medicines,
            });
          }
        }
      } else {
        // Unlinked pharmacy: only include it in the unlinked group if it has transactions
        if (pharmacyTotal > 0) {
          if (!doctorGroups.has(null)) {
            doctorGroups.set(null, {
              doctorId: null,
              doctorName: 'Unlinked Pharmacies',
              pharmacies: []
            });
          }
          doctorGroups.get(null)!.pharmacies.push({
            pharmacyId:   pharmacy.id,
            pharmacyName: pharmacy.name,
            totalAmount:  pharmacyTotal,
            medicines,
          });
        }
      }
    }

    // Convert to array, filter out doctors with no pharmacies, and compute grandTotals
    let result = Array.from(doctorGroups.values())
      .filter(group => group.pharmacies.length > 0)
      .map(group => ({
        ...group,
        grandTotal: group.pharmacies.reduce((sum, p) => sum + p.totalAmount, 0),
      }));

    // Sort
    if (sort === 'name') {
      result.sort((a, b) => a.doctorName.localeCompare(b.doctorName));
    } else {
      result.sort((a, b) => b.grandTotal - a.grandTotal);
    }

    // Apply limit
    if (limit > 0) result = result.slice(0, limit);

    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[excel/doctor-business]', err);
    return c.json({ success: false, error: `Failed to compute doctor business: ${err?.message}` }, 500);
  }
});


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

/**
 * getUniqueHeaders
 *
 * Scans up to the first 50 rows of raw JSON data parsed from an Excel sheet
 * to collect a unique list of all columns present in the file.
 *
 * @param  {any[]} rawData  - Array of row objects from the excel utility.
 * @returns {string[]}      - Unique array of header column names.
 */
export function getUniqueHeaders(rawData: any[]): string[] {
  const headersSet = new Set<string>();
  const scanLimit = Math.min(rawData.length, 50);
  for (let i = 0; i < scanLimit; i++) {
    if (rawData[i]) {
      Object.keys(rawData[i]).forEach(k => headersSet.add(k));
    }
  }
  return Array.from(headersSet);
}

export function analyzeHeaders(headers: string[]) {
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

    const headers = getUniqueHeaders(rawData);
    const { format, confidence, columnMappings, fieldMap } = analyzeHeaders(headers);

    const warnings: string[] = [];
    const parsedData: any[] = [];
    let validRows = 0, invalidRows = 0;

    if (format === 'party_report') {
      let currentPharmacy = '';
      for (const row of rawData) {
        const pv = row[fieldMap['Product']]?.toString().trim();
        const av = row[fieldMap['Amount']];
        const pvLower = pv?.toLowerCase();
        if (!pvLower) continue;
        if (pvLower === 'product' || pvLower === 'item' || pvLower === 'medicine' || pvLower === fieldMap['Product']?.toLowerCase()) {
          continue;
        }
        const isTotalRow = pvLower.includes('party total') || pvLower.includes('grand total') || pvLower === 'total' || pvLower === 'grandtotal';
        if (isTotalRow) continue;
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
      const packField = fieldMap['Pack'];
      for (const row of rawData) {
        const name = row[fieldMap['Product']]?.toString().trim();
        const packVal = packField ? row[packField]?.toString().trim() : null;
        if (name) {
          validRows++;
          parsedData.push({ name, pack: packVal });
        } else {
          invalidRows++;
        }
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
      const upload = tx.insert(excelUploads).values({
        fileName,
        fileHash,
        fileSize,
        fileData: fileBuffer,
        uploadDate: new Date().toISOString(),
        format: format,
        status: 'COMPLETED'
      }).returning().get();
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
          const packVal = r.pack || null;
          const ex = tx.select().from(products).where(eq(products.name, uName)).all()
            .find(p => (p.pack || null) === (packVal || null));
          if (!ex) {
            tx.insert(products).values({ name: uName, pack: packVal }).run();
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
            if (!prod) prod = tx.insert(products).values({ name: uProd, pack: null }).returning().get();
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

          // Insert Sales Transaction
          tx.insert(salesTransactions).values({
            pharmacyId: phId,
            productId: prodId,
            amount: r.amount,
            saleQty: r.saleQty,
            freeQty: r.free,
            freeAmt: r.freeAmt || 0,
            date: r.date,
            uploadId,
          }).run();
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
/**
 * isPdfBuf — checks first 4 bytes for %PDF magic number.
 * @param {Buffer} buf - Raw file bytes from the database.
 * @returns {boolean}
 */
function isPdfBuf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
}

/**
 * extractRowsFromBuffer
 *
 * Parses either a PDF or an Excel/CSV buffer into a row-object array.
 * Used by the history enrichment loop to detect format and count records.
 *
 * PDF path — smart content-aware parser (matches parsePdfToRowsBackground):
 *   1. Splits raw PDF text by lines, identifies start of table by header.
 *   2. Ignores noise lines (addresses, page counts, repeating headers, etc.).
 *   3. Product rows: matches exactly 4 numeric columns with two decimal places.
 *   4. Pharmacy headers: matched non-noise lines with no trailing numeric fields.
 *
 * Excel path: delegates to XLSX.read().
 *
 * @param  {Buffer} buf                      - Raw file buffer containing PDF or Excel data; must be non-empty.
 * @returns {Promise<Array<Record<string, any>>>} - Array of parsed row objects; empty array on failure.
 * @validates                                - PDF magic number check (isPdfBuf), header line index, noise lines.
 * @required-inputs                          - Non-empty buffer.
 * @redirects                                - None.
 * @edge-cases                               - Returns empty array if parse errors occur.
 */
async function extractRowsFromBuffer(buf: Buffer): Promise<any[]> {
  if (isPdfBuf(buf)) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData  = await pdfParse(buf);
      const text     = pdfData.text || '';

      const rawLines: string[] = text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      if (rawLines.length < 2) return [];

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
        // Regex: product name followed by exactly 4 numeric groups ending in exactly two decimal places.
        // Resolves characters run together without spaces (e.g. MOTOKAP 3D+ TAB0.000.003.00504.12).
        const productRowRegex = /^(.+?)\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*$/;
        const rows: any[] = [];

        for (let i = headerLineIdx + 1; i < rawLines.length; i++) {
          const line  = rawLines[i];
          const lower = line.toLowerCase();

          // Noise filter rules: skip party totals, page metadata, distributor address, phone numbers, page numbers, repeating headers
          const isNoise =
            lower.startsWith('party total') ||
            lower.startsWith('grand total') ||
            lower === 'total' ||
            lower === 'grandtotal' ||
            lower.includes('pharma distributors') ||
            lower.includes('surat dawa bazaar') ||
            lower.includes('vastadevdi road') ||
            lower.includes('katargam') ||
            lower.includes('6th floor') ||
            lower.includes('601 to 603') ||
            lower.includes('9898530808') ||
            lower.includes('0261') ||
            lower.includes('productfreefreeamt') ||
            (lower.includes('product') && lower.includes('amount') && lower.includes('free')) ||
            lower.includes('wise list report') ||
            lower.includes('product + party') ||
            lower.includes('page') ||
            /^\d+\/\d+$/.test(lower) ||
            (lower.startsWith('from:') && lower.includes('to:'));

          if (isNoise) continue;

          const match = productRowRegex.exec(line);
          if (match) {
            rows.push({
              Product: match[1].trim(),
              Free:    match[2].replace(/,/g, ''),
              FreeAmt: match[3].replace(/,/g, ''),
              SaleQty: match[4].replace(/,/g, ''),
              Amount:  match[5].replace(/,/g, ''),
            });
          } else {
            rows.push({ Product: line });
          }
        }
        return rows;
      }

      // Fallback: delimiter-based for CSV/TSV inside PDF
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
      console.error('[excel/history] pdf-parse failed:', err);
      return [];
    }
  } else {
    try {
      const wb    = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet) as any[];
    } catch (err) {
      console.error('[excel/history] XLSX.read failed:', err);
      return [];
    }
  }
}

excelRouter.get('/history', async (c) => {
  try {
    const db = getDb();
    const uploads = await db.select({
      id:         excelUploads.id,
      fileName:   excelUploads.fileName,
      fileSize:   excelUploads.fileSize,
      uploadDate: excelUploads.uploadDate,
      status:     excelUploads.status,
      format:     excelUploads.format,
    }).from(excelUploads).orderBy(desc(excelUploads.uploadDate));

    // Enrich each upload with record count and detected format (PDF-aware)
    const enriched = await Promise.all(
      uploads.map(async (u) => {
        let recordCount   = 0;
        let detectedFormat = u.format || 'unknown';
        try {
          // Count linked sales transactions for this upload
          const countResult = db.select({ id: salesTransactions.id })
            .from(salesTransactions)
            .where(eq(salesTransactions.uploadId, u.id))
            .all();
          recordCount = countResult.length;

          // If format is missing (legacy uploads), parse and persist it
          if (!u.format) {
            const full = db.select({ fileData: excelUploads.fileData })
              .from(excelUploads)
              .where(eq(excelUploads.id, u.id))
              .get();

            if (full?.fileData) {
              const raw = await extractRowsFromBuffer(full.fileData as Buffer);
              if (raw.length > 0) {
                const hdrs     = getUniqueHeaders(raw);
                const analysis = analyzeHeaders(hdrs);
                detectedFormat = analysis.format;
                if (recordCount === 0) recordCount = raw.length;
              }
              // Fallback: if header-based analysis is ambiguous but sales transactions
              // exist for this upload, it is definitively a party_report (sales data)
              if (detectedFormat === 'unknown' && recordCount > 0) {
                detectedFormat = 'party_report';
              }
              // Save format back to DB to avoid future parses
              db.update(excelUploads).set({ format: detectedFormat }).where(eq(excelUploads.id, u.id)).run();
            }
          }
        } catch { /* ignore per-upload enrichment errors */ }
        return {
          id: u.id,
          fileName: u.fileName,
          fileSize: u.fileSize,
          uploadDate: u.uploadDate,
          status: u.status,
          recordCount,
          detectedFormat
        };
      })
    );

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

    const headers = getUniqueHeaders(rawData);
    const { format, fieldMap } = analyzeHeaders(headers);

    const result: any[] = [];
    if (format === 'party_report') {
      let currentPharmacy = '';
      for (const row of rawData) {
        const pv = row[fieldMap['Product']]?.toString().trim();
        const av = row[fieldMap['Amount']];
        const pvLower = pv?.toLowerCase();
        if (!pvLower) continue;
        if (pvLower === 'product' || pvLower === 'item' || pvLower === 'medicine' || pvLower === fieldMap['Product']?.toLowerCase()) {
          continue;
        }
        if (pvLower.includes('total')) continue;
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

// ── DELETE /api/excel/clear-all ───────────────────────────────────────
excelRouter.delete('/clear-all', async (c) => {
  try {
    const db = getDb();
    db.transaction((tx) => {
      tx.delete(salesTransactions).run();
      tx.delete(excelUploads).run();
    });
    return c.json({ success: true });
  } catch (err: any) {
    console.error('[excel/clear-all]', err);
    return c.json({ success: false, error: `Failed to clear analytics: ${err?.message}` }, 500);
  }
});

// ── DELETE /api/excel/:id ─────────────────────────────────────────────
excelRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.transaction((tx) => {
      tx.delete(salesTransactions).where(eq(salesTransactions.uploadId, id)).run();
      tx.delete(excelUploads).where(eq(excelUploads.id, id)).run();
    });
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

// ── POST /api/excel/print-pdf ─────────────────────────────────────────
excelRouter.post('/print-pdf', async (c) => {
  try {
    const { html, filename } = await c.req.json();
    if (!html) {
      return c.json({ success: false, error: 'HTML is required' }, 400);
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      // Create a headless offscreen window
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true,
          sandbox: false
        }
      });

      // Load HTML string
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      win.webContents.once('did-finish-load', async () => {
        try {
          const data = await win.webContents.printToPDF({
            printBackground: true,
            margins: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
            },
            pageSize: 'A4'
          });
          win.close();
          resolve(Buffer.from(data));
        } catch (err) {
          win.close();
          reject(err);
        }
      });

      win.webContents.once('did-fail-load', () => {
        win.close();
        reject(new Error('Failed to load HTML content for PDF generation'));
      });
    });

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="${filename || 'report.pdf'}"`);
    return c.body(pdfBuffer as any);
  } catch (err: any) {
    console.error('[PDF Export Route Error]', err);
    return c.json({ success: false, error: err.message || 'Failed to print PDF' }, 500);
  }
});

export { excelRouter };
