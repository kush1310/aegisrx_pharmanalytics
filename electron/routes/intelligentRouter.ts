import { Hono } from 'hono';
import crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { excelUploads } from '../db/schema';
import { processUploadInBackground } from '../services/UniversalProcessor';

const intelligentRouter = new Hono();

intelligentRouter.post('/upload', async (c) => {
  try {
    const body = await c.req.json();
    const fileBuffer = Buffer.from(body.buffer);
    const fileName = body.fileName;
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    const db = getDb();

    // Deduplication check
    const existing = db.select().from(excelUploads).where(eq(excelUploads.fileHash, fileHash)).get();
    if (existing) {
      return c.json({ success: false, error: 'This file has already been uploaded.' }, 409);
    }

    // Insert pending upload
    const upload = db.insert(excelUploads).values({
      fileName,
      fileHash,
      fileSize,
      fileData: fileBuffer,
      status: 'PROCESSING'
    }).returning().get();

    // Offload parsing and DB inserts to background task
    processUploadInBackground(upload.id);

    return c.json({ success: true, message: 'Upload received, processing in background.', uploadId: upload.id });

  } catch (err: any) {
    console.error('[intelligentRouter/upload]', err);
    return c.json({ success: false, error: `Upload failed: ${err.message}` }, 500);
  }
});

// Endpoint to check status of an upload
intelligentRouter.get('/status/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const upload = db.select({ status: excelUploads.status }).from(excelUploads).where(eq(excelUploads.id, id)).get();
    if (!upload) return c.json({ success: false, error: 'Upload not found' }, 404);
    
    return c.json({ success: true, status: upload.status });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch status' }, 500);
  }
});

export { intelligentRouter };
