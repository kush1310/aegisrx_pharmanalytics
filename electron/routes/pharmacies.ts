import { Hono } from 'hono';
import { eq, like, or, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index';
import { pharmacies, doctors, pharmacyProducts, products } from '../db/schema';

const pharmaciesRouter = new Hono();

// ── Validation Schemas ─────────────────────────────────────────────────────
const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;

const pharmacyCreateSchema = z.object({
  name:           z.string().trim().min(2, 'Pharmacy name must be at least 2 characters'),
  ownerName:      z.string().trim().min(2, 'Owner name is required'),
  licenseId:      z.string().trim().min(3, 'License ID is required'),
  address:        z.string().trim().min(3, 'Address is required'),
  contact:        z.string().trim().regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number'),
  gstNumber:      z.string().trim().nullable().optional(),
  drugLicense:    z.string().trim().nullable().optional(),
  ownerBirthDate: z.string().nullable().optional(),
  doctorId:       z.number().int().positive().nullable().optional(),
});

const pharmacyUpdateSchema = pharmacyCreateSchema.partial().extend({
  name:      z.string().trim().min(2, 'Pharmacy name is required'),
  ownerName: z.string().trim().min(2, 'Owner name is required'),
  address:   z.string().trim().min(3, 'Address is required'),
  contact:   z.string().trim().regex(indianPhoneRegex, 'Enter a valid 10-digit Indian mobile number'),
});

// ── GET /api/pharmacies ───────────────────────────────────────────────────
pharmaciesRouter.get('/', async (c) => {
  try {
    const db     = getDb();
    const search = c.req.query('search')?.trim();

    let rows;
    if (search) {
      rows = await db.select().from(pharmacies)
        .where(or(
          like(pharmacies.name,      `%${search}%`),
          like(pharmacies.ownerName, `%${search}%`),
          like(pharmacies.contact,   `%${search}%`),
        ))
        .orderBy(desc(pharmacies.createdAt));
    } else {
      rows = await db.select().from(pharmacies).orderBy(desc(pharmacies.createdAt));
    }

    return c.json({ success: true, data: rows });
  } catch (err) {
    console.error('[pharmacies/get]', err);
    return c.json({ success: false, error: 'Failed to fetch pharmacies' }, 500);
  }
});

// ── GET /api/pharmacies/by-doctor/:doctorId — pharmacies linked to a doctor ──
pharmaciesRouter.get('/by-doctor/:doctorId', async (c) => {
  try {
    const db       = getDb();
    const doctorId = Number(c.req.param('doctorId'));

    if (isNaN(doctorId) || doctorId <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const rows = await db.select().from(pharmacies).where(eq(pharmacies.doctorId, doctorId));
    return c.json({ success: true, data: rows });
  } catch (err) {
    console.error('[pharmacies/by-doctor]', err);
    return c.json({ success: false, error: 'Failed to fetch pharmacies by doctor' }, 500);
  }
});

// ── GET /api/pharmacies/:id — with doctor + products ─────────────────────
pharmaciesRouter.get('/:id', async (c) => {
  try {
    const db  = getDb();
    const id  = Number(c.req.param('id'));

    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid pharmacy ID' }, 400);

    const [pharmacy] = await db.select().from(pharmacies).where(eq(pharmacies.id, id)).limit(1);
    if (!pharmacy)   return c.json({ success: false, error: 'Pharmacy not found' }, 404);

    let doctor = null;
    if (pharmacy.doctorId) {
      const [d] = await db.select().from(doctors).where(eq(doctors.id, pharmacy.doctorId)).limit(1);
      doctor = d || null;
    }

    const productLinks = await db
      .select({ id: pharmacyProducts.id, productId: pharmacyProducts.productId, productName: products.name })
      .from(pharmacyProducts)
      .leftJoin(products, eq(pharmacyProducts.productId, products.id))
      .where(eq(pharmacyProducts.pharmacyId, id));

    return c.json({ success: true, data: { ...pharmacy, doctor, products: productLinks } });
  } catch (err) {
    console.error('[pharmacies/getById]', err);
    return c.json({ success: false, error: 'Failed to fetch pharmacy' }, 500);
  }
});

// ── POST /api/pharmacies — create ─────────────────────────────────────────
/**
 * Creates a new pharmacy with Zod validation.
 * License ID must be unique (enforced at DB level via UNIQUE constraint).
 * Returns 409 on duplicate License ID, 400 on validation errors.
 *
 * @body  PharmacyCreateSchema fields
 * @returns 201 with created pharmacy
 */
pharmaciesRouter.post('/', async (c) => {
  try {
    const db   = getDb();
    const body = await c.req.json();

    const parsed = pharmacyCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return c.json({ success: false, error: errors }, 400);
    }

    const p      = parsed.data;
    const result = db.insert(pharmacies).values({
      name:           p.name,
      ownerName:      p.ownerName,
      licenseId:      p.licenseId,
      gstNumber:      p.gstNumber || null,
      drugLicense:    p.drugLicense || null,
      address:        p.address,
      contact:        p.contact,
      ownerBirthDate: p.ownerBirthDate || null,
      doctorId:       p.doctorId || null,
    }).returning().get();

    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    console.error('[pharmacies/create]', err);
    if (err.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: 'License ID already exists. Please use a unique license number.' }, 409);
    }
    return c.json({ success: false, error: 'Failed to create pharmacy' }, 500);
  }
});

// ── PUT /api/pharmacies/:id — update ─────────────────────────────────────
pharmaciesRouter.put('/:id', async (c) => {
  try {
    const db   = getDb();
    const id   = Number(c.req.param('id'));
    const body = await c.req.json();

    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid pharmacy ID' }, 400);

    // Allow partial updates (e.g. just updating doctorId for linking)
    // If only doctorId is present, skip full schema validation
    const isLinkOperation = Object.keys(body).length <= 2 && 'doctorId' in body;

    if (!isLinkOperation) {
      const parsed = pharmacyUpdateSchema.safeParse(body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return c.json({ success: false, error: errors }, 400);
      }
    }

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (body.name)           updateData.name           = body.name;
    if (body.ownerName)      updateData.ownerName      = body.ownerName;
    if (body.licenseId)      updateData.licenseId      = body.licenseId;
    if (body.address)        updateData.address        = body.address;
    if (body.contact)        updateData.contact        = body.contact;
    if (body.gstNumber !== undefined)      updateData.gstNumber      = body.gstNumber || null;
    if (body.drugLicense !== undefined)    updateData.drugLicense    = body.drugLicense || null;
    if (body.ownerBirthDate !== undefined) updateData.ownerBirthDate = body.ownerBirthDate || null;
    if ('doctorId' in body)               updateData.doctorId       = body.doctorId || null;

    const result = db.update(pharmacies).set(updateData).where(eq(pharmacies.id, id)).returning().get();

    if (!result) return c.json({ success: false, error: 'Pharmacy not found' }, 404);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[pharmacies/update]', err);
    if (err.message?.includes('UNIQUE')) {
      return c.json({ success: false, error: 'License ID already in use by another pharmacy.' }, 409);
    }
    return c.json({ success: false, error: 'Failed to update pharmacy' }, 500);
  }
});

// ── DELETE /api/pharmacies/:id ────────────────────────────────────────────
pharmaciesRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid pharmacy ID' }, 400);
    db.delete(pharmacies).where(eq(pharmacies.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('[pharmacies/delete]', err);
    return c.json({ success: false, error: 'Failed to delete pharmacy' }, 500);
  }
});

// ── POST /api/pharmacies/:id/link-doctor ─────────────────────────────────
pharmaciesRouter.post('/:id/link-doctor', async (c) => {
  try {
    const db       = getDb();
    const id       = Number(c.req.param('id'));
    const { doctorId } = await c.req.json();

    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid pharmacy ID' }, 400);

    db.update(pharmacies)
      .set({ doctorId: doctorId || null, updatedAt: new Date().toISOString() })
      .where(eq(pharmacies.id, id))
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[pharmacies/link-doctor]', err);
    return c.json({ success: false, error: 'Failed to link doctor' }, 500);
  }
});

export { pharmaciesRouter };
