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
 *
 * Strategy (handles space-separated table PDFs like the Pharma Distributors format):
 *   1. pdf-parse extracts the full document text as a flat string.
 *   2. Lines are split, trimmed, and de-duplicated.
 *   3. The first line that contains BOTH 'product' and 'amount' keywords is treated
 *      as the column-header line. All preceding lines (company info, title) are skipped.
 *   4. Each subsequent line is classified:
 *      - 4 numeric tokens at the end  → product row {Product, Free, FreeAmt, SaleQty, Amount}
 *      - No numeric tokens at end      → pharmacy/party name row {Product} (no Amount key)
 *      - Starts with 'party total' or 'grand total' → skipped
 *   5. The pharmacy rows have no Amount key, which causes processSalesAnalytics to
 *      treat them as currentPharmacyName headers (isPharmacyHeader detection).
 *
 * Fallback: if no header line is detected, falls back to tab or comma delimiter.
 *
 * @param  {Buffer} buf       - PDF file buffer.
 * @returns {Promise<any[]>}  - Array of row objects; empty array on failure.
 * @edge-cases                - Returns empty array if pdf-parse throws or text is blank.
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
      // Regex: product name (greedy text) followed by exactly 4 numeric groups
      // Handles Indian number formats (digits + optional commas/dots)
      const productRowRegex = /^(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
      const rows: any[] = [];

      for (let i = headerLineIdx + 1; i < rawLines.length; i++) {
        const line  = rawLines[i];
        const lower = line.toLowerCase();

        // Skip Party Total and Grand Total summary rows
        if (lower.startsWith('party total') || lower.startsWith('grand total') || lower === 'total') continue;

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

    // Persist the raw file bytes and mark the record as PROCESSING
    const upload = db.insert(excelUploads).values({
      fileName,
      fileHash,
      fileSize,
      fileData:   fileBuffer,
      uploadDate: new Date().toISOString(),
      status:     'PROCESSING'
    }).returning().get();

    // Format detection — PDF branch and Excel/CSV branch
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
      fileData: excelUploads.fileData
    }).from(excelUploads).where(eq(excelUploads.id, id)).get();

    if (!upload) return c.json({ success: false, error: 'Upload not found' }, 404);

    let format = 'unknown';
    if (upload.status === 'COMPLETED' && upload.fileData) {
      try {
        const buf: Buffer = upload.fileData as Buffer;
        let rawRows: any[] = [];

        if (isPdfBuffer(buf)) {
          rawRows = await parsePdfToRows(buf);
        } else {
          const wb    = XLSX.read(buf, { type: 'buffer' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rawRows     = XLSX.utils.sheet_to_json(sheet) as any[];
        }

        if (rawRows.length > 0) {
          const hdrs     = getUniqueHeaders(rawRows);
          const analysis = analyzeHeaders(hdrs);
          format         = analysis.format;
        }
      } catch (err) {
        console.error('[intelligentRouter] Status format detection error:', err);
      }
    }

    return c.json({ success: true, status: upload.status, format });
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
