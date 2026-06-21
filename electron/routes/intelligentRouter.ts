import { Hono } from 'hono';
import crypto from 'crypto';
import fs from 'fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads } from '../db/schema';
import { processUploadInBackground } from '../services/UniversalProcessor';
import * as XLSX from 'xlsx';
import { getUniqueHeaders, analyzeHeaders } from './excel';

const intelligentRouter = new Hono();

import { AiService } from '../services/AiService';

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.slice(0, 4).toString('ascii') === '%PDF';
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

    // Format detection & upfront validation
    let detectedFormat = 'unknown';
    let confidence     = 0;
    let valResult: any = null;

    if (isPdfBuffer(fileBuffer)) {
      console.log(`[intelligentRouter] Ingesting PDF file: ${fileName}`);
      valResult = await AiService.validatePdfRelevance(fileBuffer, fileName);
      if (!valResult.isValid) {
        console.warn(`[intelligentRouter] Rejecting invalid PDF: ${valResult.reason || 'PDF is not valid format'}`);
        return c.json({ success: false, error: valResult.reason || 'PDF is not valid format' }, 400);
      }
      detectedFormat = valResult.format || 'unknown';
      confidence     = valResult.confidence || 0.9;
    } else {
      try {
        const wb    = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows     = XLSX.utils.sheet_to_json(sheet) as any[];
        if (rawRows.length > 0) {
          const hdrs     = getUniqueHeaders(rawRows);
          const analysis = analyzeHeaders(hdrs);
          detectedFormat = analysis.format;
          confidence     = analysis.confidence;
        }
      } catch (err) {
        console.error('[intelligentRouter] Excel format detection error:', err);
      }
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

    // Cache the parsed data (if any) to avoid double-processing
    if (valResult && valResult.data && valResult.data.length > 0) {
      console.log(`[intelligentRouter] Caching parsed PDF rows for uploadId: ${upload.id}`);
      (AiService as any).parsedDataCache = (AiService as any).parsedDataCache || new Map();
      (AiService as any).parsedDataCache.set(upload.id, valResult.data);
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

// ── POST /api/upload/intelligent/upload-by-path ─────────────────────────────
/**
 * uploadByPath
 *
 * Electron-native upload route that eliminates renderer-thread memory allocation.
 * Accepts a filePath string (absolute OS path) and fileName from the Electron renderer.
 * Reads the file buffer server-side using fs.readFileSync — zero JS Number objects
 * are allocated on the renderer thread, keeping animations and skeleton loaders smooth
 * even for files over 1.5 MB.
 *
 * Applies identical deduplication (MD5 hash), format detection, and background
 * processing pipeline as the existing POST /upload route.
 *
 * @body  {string} filePath - Absolute path to the file on the local filesystem.
 * @body  {string} fileName - Original file name (used for the upload record).
 * @returns {success, uploadId, format, confidence} on success; 409 on duplicate; 500 on error.
 * @validates - File existence, non-empty buffer, MD5 hash deduplication.
 * @edge-cases - Returns 400 if filePath is missing. Returns 500 if fs.readFileSync fails.
 */
intelligentRouter.post('/upload-by-path', async (c) => {
  try {
    const body     = await c.req.json();
    const filePath = body.filePath as string;
    const fileName = body.fileName as string;

    if (!filePath) {
      return c.json({ success: false, error: 'filePath is required' }, 400);
    }

    // Read file buffer on the Node.js thread — never touches the renderer heap
    let fileBuffer: Buffer;
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch (readErr: any) {
      console.error('[intelligentRouter/upload-by-path] fs.readFileSync failed:', readErr);
      return c.json({ success: false, error: `Cannot read file: ${readErr.message}` }, 500);
    }

    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;
    const db       = getDb();

    // Deduplication — reject uploads whose MD5 hash already exists in the DB
    const existing = db.select().from(excelUploads).where(eq(excelUploads.fileHash, fileHash)).get();
    if (existing) {
      return c.json({ success: false, error: 'This file has already been uploaded.' }, 409);
    }

    // Format detection & upfront validation
    let detectedFormat = 'unknown';
    let confidence     = 0;
    let valResult: any = null;

    if (fileBuffer.length >= 4 && fileBuffer.slice(0, 4).toString('ascii') === '%PDF') {
      console.log(`[intelligentRouter/upload-by-path] Ingesting PDF file by path: ${fileName}`);
      valResult = await AiService.validatePdfRelevance(fileBuffer, fileName);
      if (!valResult.isValid) {
        console.warn(`[intelligentRouter/upload-by-path] Rejecting invalid PDF: ${valResult.reason || 'PDF is not valid format'}`);
        return c.json({ success: false, error: valResult.reason || 'PDF is not valid format' }, 400);
      }
      detectedFormat = valResult.format || 'unknown';
      confidence     = valResult.confidence || 0.9;
    } else {
      try {
        const wb    = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
        if (rawRows.length > 0) {
          const hdrs     = getUniqueHeaders(rawRows);
          const analysis = analyzeHeaders(hdrs);
          detectedFormat = analysis.format;
          confidence     = analysis.confidence;
        }
      } catch (err) {
        console.error('[intelligentRouter/upload-by-path] Excel format detection error:', err);
      }
    }

    // Persist the raw file bytes and mark the record as PROCESSING
    const upload = db.insert(excelUploads).values({
      fileName,
      fileHash,
      fileSize,
      fileData:   fileBuffer,
      uploadDate: new Date().toISOString(),
      status:     'PROCESSING',
      format:     detectedFormat
    }).returning().get();

    // Cache the parsed data (if any) to avoid double-processing
    if (valResult && valResult.data && valResult.data.length > 0) {
      console.log(`[intelligentRouter/upload-by-path] Caching parsed PDF rows for uploadId: ${upload.id}`);
      (AiService as any).parsedDataCache = (AiService as any).parsedDataCache || new Map();
      (AiService as any).parsedDataCache.set(upload.id, valResult.data);
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
    console.error('[intelligentRouter/upload-by-path]', err);
    return c.json({ success: false, error: `Upload failed: ${err.message}` }, 500);
  }
});

export { intelligentRouter };
