import { Hono } from 'hono';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads } from '../db/schema';
import { processUploadInBackground } from '../services/UniversalProcessor';
import * as XLSX from 'xlsx';
import { getUniqueHeaders, analyzeHeaders } from './excel';

const intelligentRouter = new Hono();

/**
 * isPdfBuffer
 *
 * Checks the first four bytes of a buffer for the PDF magic number (%PDF).
 * More reliable than trusting the client-supplied file extension.
 *
 * @param  {Buffer} buf - Raw file bytes from the upload request.
 * @returns {boolean}   - True when the buffer starts with the %PDF header.
 */
function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
}

/**
 * parsePdfToRows
 *
 * Content-aware PDF parser for pharma party/sales report PDFs.
 * Splits raw PDF text by lines, identifies the start of the table from the header index
 * containing 'product' and 'amount', and processes subsequent lines. Each line is checked
 * against a strict numeric format regex. Valid product rows are split into product details
 * and their 4 corresponding numeric values. Noise lines (address, page numbers, metadata, totals)
 * are ignored. Real pharmacy headers are identified and pushed as dictionary rows with no numeric details.
 *
 * @param  {Buffer} buf                      - Raw PDF file buffer; must be non-empty.
 * @returns {Promise<Array<Record<string, any>>>} - Array of parsed product row objects and pharmacy headers.
 * @validates                                - PDF magic number check (caller side), header row occurrence, noise patterns.
 * @required-inputs                          - Non-empty PDF Buffer.
 * @redirects                                - None.
 * @edge-cases                               - Returns empty array if pdf-parse fails, or if no header is found.
 */
async function parsePdfToRows(buf: Buffer): Promise<any[]> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData  = await pdfParse(buf);
    const text     = pdfData.text || '';

    const rawLines: string[] = text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (rawLines.length < 2) return [];

    // ── Strategy 1: Table-based party report PDFs ────────────────────────
    // Find the column-header line: must contain both 'product' and 'amount'
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
          // Product row: emit all four numeric columns
          rows.push({
            Product: match[1].trim(),
            Free:    match[2].replace(/,/g, ''),
            FreeAmt: match[3].replace(/,/g, ''),
            SaleQty: match[4].replace(/,/g, ''),
            Amount:  match[5].replace(/,/g, ''),
          });
        } else {
          // Pharmacy / party name row — no Amount key so processSalesAnalytics
          // detects it as a pharmacy header via the isPharmacyHeader check
          rows.push({ Product: line });
        }
      }

      return rows;
    }

    // ── Strategy 2: Fallback for CSV/TSV-inside-PDF ──────────────────────
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
    console.error('[intelligentRouter] pdf-parse failed:', err);
    return [];
  }
}

intelligentRouter.post('/upload', async (c) => {
  try {
    const body = await c.req.json();
    const fileBuffer = Buffer.from(body.buffer);
    const fileName   = body.fileName;
    const fileHash   = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileSize   = fileBuffer.length;

    const db = getDb();

    // Deduplication — reject uploads whose MD5 hash already exists in the DB
    const existing = db.select().from(excelUploads).where(eq(excelUploads.fileHash, fileHash)).get();
    if (existing) {
      return c.json({ success: false, error: 'This file has already been uploaded.' }, 409);
    }

    // Format detection — PDF branch and Excel/CSV branch (run before insert)
    let detectedFormat = 'unknown';
    let confidence     = 0;

    try {
      let rawRows: any[] = [];

      if (isPdfBuffer(fileBuffer)) {
        rawRows = await parsePdfToRows(fileBuffer);
      } else {
        const wb    = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rawRows     = XLSX.utils.sheet_to_json(sheet) as any[];
      }

      if (rawRows.length > 0) {
        const hdrs     = getUniqueHeaders(rawRows);
        const analysis = analyzeHeaders(hdrs);
        detectedFormat = analysis.format;
        confidence     = analysis.confidence;
      }
    } catch (err) {
      console.error('[intelligentRouter] Format detection error:', err);
    }

    // Persist the raw file bytes and mark the record as PROCESSING with detectedFormat
    const upload = db.insert(excelUploads).values({
      fileName,
      fileHash,
      fileSize,
      fileData:   fileBuffer,
      uploadDate: new Date().toISOString(),
      status:     'PROCESSING',
      format:     detectedFormat
    }).returning().get();

    // Offload full DB inserts to background task — non-blocking
    processUploadInBackground(upload.id);

    return c.json({
      success:  true,
      message:  'Upload received, processing in background.',
      uploadId: upload.id,
      format:   detectedFormat,
      confidence
    });

  } catch (err: any) {
    console.error('[intelligentRouter/upload]', err);
    return c.json({ success: false, error: `Upload failed: ${err.message}` }, 500);
  }
});

// GET /api/upload/status/:id — poll the processing status of a specific upload
intelligentRouter.get('/status/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const upload = db.select({
      status:   excelUploads.status,
      format:   excelUploads.format
    }).from(excelUploads).where(eq(excelUploads.id, id)).get();

    if (!upload) return c.json({ success: false, error: 'Upload not found' }, 404);

    return c.json({ success: true, status: upload.status, format: upload.format || 'unknown' });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch status' }, 500);
  }
});

// POST /api/upload/intelligent/reprocess/:id — re-trigger background processing for a failed upload
/**
 * reprocess
 *
 * Re-triggers the full background processing pipeline for an upload that
 * previously failed (ERROR_EMPTY, ERROR_UNKNOWN_FORMAT, ERROR status).
 * Used after a parser fix so the user does not need to re-upload the file.
 *
 * Steps:
 *   1. Reset upload status to PROCESSING.
 *   2. Delete any stale salesTransactions linked to this uploadId to avoid duplicates.
 *   3. Re-dispatch processUploadInBackground with the stored file bytes.
 *
 * @param id - Upload record primary key from route param.
 * @returns  - {success, message} on success; 404 if upload not found.
 */
intelligentRouter.post('/reprocess/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));

    const upload = db.select().from(excelUploads).where(eq(excelUploads.id, id)).get();
    if (!upload) return c.json({ success: false, error: 'Upload not found' }, 404);

    // Clear any stale (partial) sales transactions from a failed previous run
    const { salesTransactions: salesTxns } = await import('../db/schema');
    db.delete(salesTxns).where(eq(salesTxns.uploadId, id)).run();

    // Reset status so the UI shows PROCESSING and history refreshes
    db.update(excelUploads).set({ status: 'PROCESSING' }).where(eq(excelUploads.id, id)).run();

    // Re-dispatch background processor with the stored file bytes
    processUploadInBackground(id);

    return c.json({ success: true, message: 'Reprocessing started.' });
  } catch (err: any) {
    console.error('[intelligentRouter/reprocess]', err);
    return c.json({ success: false, error: `Reprocess failed: ${err.message}` }, 500);
  }
});

export { intelligentRouter };
