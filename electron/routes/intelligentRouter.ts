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
 * Extracts text from a PDF buffer via pdf-parse and converts it into a
 * row-object array compatible with analyzeHeaders and processUploadInBackground.
 *
 * Strategy:
 *   1. pdf-parse extracts the full document text.
 *   2. Text is split into non-empty lines.
 *   3. Delimiter is detected: tab if most lines contain tabs, otherwise comma.
 *   4. First non-empty line is treated as the header row.
 *   5. Subsequent lines become data rows keyed by the header columns.
 *
 * @param  {Buffer} buf       - PDF file buffer.
 * @returns {Promise<any[]>}  - Array of row objects; empty array on failure.
 * @edge-cases                - Returns empty array if pdf-parse throws or text is blank.
 */
async function parsePdfToRows(buf: Buffer): Promise<any[]> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buf);
    const text = pdfData.text || '';

    const rawLines: string[] = text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (rawLines.length < 2) return [];

    // Prefer tab delimiter when more than half the lines contain a tab character
    const tabCount = rawLines.filter((l: string) => l.includes('\t')).length;
    const delimiter: string = tabCount > rawLines.length / 2 ? '\t' : ',';

    const headers: string[] = rawLines[0]
      .split(delimiter)
      .map((h: string) => h.trim())
      .filter(Boolean);

    if (headers.length === 0) return [];

    const rows: any[] = [];
    for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
      const cells = rawLines[lineIdx].split(delimiter).map((c: string) => c.trim());
      if (cells.every((c: string) => c === '')) continue;
      const row: Record<string, string> = {};
      headers.forEach((header: string, colIdx: number) => {
        row[header] = cells[colIdx] ?? '';
      });
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

export { intelligentRouter };
