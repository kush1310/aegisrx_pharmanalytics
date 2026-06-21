import { Hono } from 'hono';
import { eq, like, or, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, getSqlite } from '../db/index';
import { doctors, pharmacies, products, doctorProducts, salesTransactions } from '../db/schema';

const doctorsRouter = new Hono();

// ── Zod validation schemas ────────────────────────────────────────────
/**
 * Validates an Indian mobile number: 10 digits, starting with 6-9.
 * Format: optional +91 or 91 prefix, then 10-digit mobile.
 */
const indianMobileRegex = /^(?:\+91|91)?[6-9]\d{9}$/;

const doctorCreateSchema = z.object({
  name:           z.string().min(2, 'Name must be at least 2 characters').trim(),
  contact:        z.string().regex(indianMobileRegex, 'Enter a valid 10-digit Indian mobile number').trim(),
  address:        z.string().min(3, 'Address must be at least 3 characters').trim(),
  qualification:  z.string().min(1, 'Qualification is required').trim(),
  specialization: z.string().min(1, 'Specialization is required').trim(),
  birthDate:      z.string().nullable().optional(),
  isMarried:      z.boolean().optional().default(false),
  spouseName:     z.string().nullable().optional(),
  spouseBirthDate:z.string().nullable().optional(),
  anniversary:    z.string().nullable().optional(),
  childrenCount:  z.number().int().min(0).max(20).optional().default(0),
  childrenNames:  z.string().nullable().optional(),
  childrenBirthDates: z.string().nullable().optional(),
  email:          z.string().email('Invalid email format').nullable().optional().or(z.literal('')),
  registrationNo: z.string().nullable().optional(),
  experienceYrs:  z.number().int().min(0).max(60).nullable().optional(),
  hospitalName:   z.string().nullable().optional(),
  hospitalOpeningDate: z.string().nullable().optional(),
  hospitalsCount: z.number().int().min(0).max(20).optional().default(0),
  hospitalNames:  z.string().nullable().optional(),
  hospitalOpeningDates: z.string().nullable().optional(),
});

const doctorUpdateSchema = doctorCreateSchema.partial().extend({
  name:           z.string().min(2, 'Name must be at least 2 characters').trim(),
  contact:        z.string().regex(indianMobileRegex, 'Enter a valid 10-digit Indian mobile number').trim(),
  qualification:  z.string().min(1, 'Qualification is required').trim(),
  specialization: z.string().min(1, 'Specialization is required').trim(),
});

// ── GET /api/doctors  — paginated list, optional ?page=&limit=&search= ──────
/**
 * listDoctors
 *
 * Returns a paginated, searchable list of doctors. Used by the Doctors page to
 * avoid loading all 2000+ records into the renderer at once.
 *
 * @query page   {number} - 1-based page index. Default: 1.
 * @query limit  {number} - Rows per page. Default: 50. Clamped to [1, 200].
 * @query search {string} - Optional search string matched against name, contact, specialization.
 * @returns { success, data: Doctor[], total, page, totalPages }
 */
doctorsRouter.get('/', async (c) => {
  try {
    const db = getDb();

    const rawPage   = parseInt(c.req.query('page')  || '1',  10);
    const rawLimit  = parseInt(c.req.query('limit') || '25', 10);
    const search    = (c.req.query('search') || '').trim();
    const page      = isNaN(rawPage)  || rawPage  < 1 ? 1 : rawPage;
    const limitSafe = isNaN(rawLimit) || rawLimit < 1 ? 25 : Math.min(rawLimit, 200);
    const offset    = (page - 1) * limitSafe;

    // Build base query with optional search filter
    let allRows;
    if (search) {
      allRows = await db.select().from(doctors)
        .where(or(
          like(doctors.name,           `%${search}%`),
          like(doctors.contact,        `%${search}%`),
          like(doctors.specialization, `%${search}%`)
        ))
        .orderBy(desc(doctors.createdAt));
    } else {
      allRows = await db.select().from(doctors).orderBy(desc(doctors.createdAt));
    }

    const total      = allRows.length;
    const totalPages = Math.ceil(total / limitSafe);
    const pageRows   = allRows.slice(offset, offset + limitSafe);

    // Attach linked pharmacy lists only for the current page rows
    const allPharmacies = db.select().from(pharmacies).all();
    const pharmaciesByDoctorId = new Map<number, any[]>();
    for (const pharmacy of allPharmacies) {
      if (pharmacy.doctorId) {
        if (!pharmaciesByDoctorId.has(pharmacy.doctorId)) pharmaciesByDoctorId.set(pharmacy.doctorId, []);
        pharmaciesByDoctorId.get(pharmacy.doctorId)!.push(pharmacy);
      }
    }

    const data = pageRows.map(doctor => ({
      ...doctor,
      pharmacies: pharmaciesByDoctorId.get(doctor.id) || []
    }));

    return c.json({ success: true, data, total, page, totalPages });
  } catch (err) {
    console.error('[doctors/get]', err);
    return c.json({ success: false, error: 'Failed to fetch doctors' }, 500);
  }
});


// ── GET /api/doctors/linkage — all doctor-pharmacy linkages with business ──
doctorsRouter.get('/linkage', async (c) => {
  try {
    const db = getDb();
    const sqlite = getSqlite();
    const allPharmacies = db.select().from(pharmacies).all();
    const allDoctors = db.select().from(doctors).all();
    const doctorMap = new Map(allDoctors.map(d => [d.id, d]));

    const linkages = allPharmacies.map(pharmacy => {
      const salesResult = sqlite.prepare(
        'SELECT COALESCE(SUM(amount), 0) as totalBusiness, COALESCE(SUM(saleQty), 0) as totalSaleQty, COUNT(DISTINCT productId) as productCount FROM SalesTransaction WHERE pharmacyId = ?'
      ).get(pharmacy.id) as any;

      const doctor = pharmacy.doctorId ? doctorMap.get(pharmacy.doctorId) : null;

      return {
        pharmacyId:          pharmacy.id,
        pharmacyName:        pharmacy.name,
        pharmacyAddress:     pharmacy.address,
        isDraft:             pharmacy.isDraft,
        doctorId:            pharmacy.doctorId || null,
        doctorName:          doctor?.name || null,
        doctorSpecialization:doctor?.specialization || null,
        totalBusiness:       salesResult?.totalBusiness || 0,
        totalSaleQty:        salesResult?.totalSaleQty || 0,
        productCount:        salesResult?.productCount || 0,
      };
    });

    return c.json({ success: true, data: { linkages, doctors: allDoctors.map(d => ({ id: d.id, name: d.name, specialization: d.specialization })) } });
  } catch (err) {
    console.error('[doctors/linkage]', err);
    return c.json({ success: false, error: 'Failed to fetch linkages' }, 500);
  }
});

// ── PUT /api/doctors/linkage — update a pharmacy's linked doctor ──────
doctorsRouter.put('/linkage', async (c) => {
  try {
    const db = getDb();
    const body = await c.req.json();
    const { pharmacyId, doctorId } = body;

    if (!pharmacyId) return c.json({ success: false, error: 'pharmacyId is required' }, 400);

    db.update(pharmacies).set({
      doctorId: doctorId || null,
      isDraft: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(pharmacies.id, Number(pharmacyId))).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/linkage/update]', err);
    return c.json({ success: false, error: 'Failed to update linkage' }, 500);
  }
});

// ── POST /api/doctors/linkage/verify-all — verify all draft linkages ──────
doctorsRouter.post('/linkage/verify-all', async (c) => {
  try {
    const db = getDb();
    db.update(pharmacies).set({
      isDraft: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(pharmacies.isDraft, true)).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/linkage/verify-all]', err);
    return c.json({ success: false, error: 'Failed to verify all linkages' }, 500);
  }
});

// ── GET /api/doctors/:id — single doctor with pharmacies + prescribed medicines ──
doctorsRouter.get('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
    if (!doctor) return c.json({ success: false, error: 'Doctor not found' }, 404);

    const linkedPharmacies = await db.select().from(pharmacies).where(eq(pharmacies.doctorId, id));
    const linkedPharmIds = linkedPharmacies.map(p => p.id);

    // 1. Fetch manually prescribed medicines
    const prescribedLinks = await db
      .select({ id: products.id, name: products.name })
      .from(doctorProducts)
      .leftJoin(products, eq(doctorProducts.productId, products.id))
      .where(eq(doctorProducts.doctorId, id));

    const manualMeds = prescribedLinks
      .filter(r => r.name)
      .map(r => ({ id: r.id!, name: r.name!, isAutomatic: false }));

    // 2. Fetch automatically prescribed medicines (sold by pharmacies linked to this doctor)
    let automaticMeds: { id: number; name: string; isAutomatic: boolean }[] = [];
    if (linkedPharmIds.length > 0) {
      const autoLinks = await db
        .selectDistinct({ id: products.id, name: products.name })
        .from(salesTransactions)
        .innerJoin(products, eq(salesTransactions.productId, products.id))
        .where(inArray(salesTransactions.pharmacyId, linkedPharmIds));
      
      automaticMeds = autoLinks
        .filter(r => r.name)
        .map(r => ({ id: r.id!, name: r.name!, isAutomatic: true }));
    }

    // Merge manual and automatic, deduplicating by product id
    const medMap = new Map<number, { id: number; name: string; isAutomatic: boolean }>();
    
    // Add automatic first, then manual (so manual overwrites isAutomatic to false if it's in both)
    for (const med of automaticMeds) {
      medMap.set(med.id, med);
    }
    for (const med of manualMeds) {
      medMap.set(med.id, med);
    }

    const prescribedMedicines = Array.from(medMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return c.json({ success: true, data: { ...doctor, pharmacies: linkedPharmacies, prescribedMedicines } });
  } catch (err) {
    console.error('[doctors/getById]', err);
    return c.json({ success: false, error: 'Failed to fetch doctor' }, 500);
  }
});

// ── GET /api/doctors/:id/medicines — list doctor's prescribed medicines ──
doctorsRouter.get('/:id/medicines', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const rows = await db
      .select({ id: products.id, name: products.name, linkId: doctorProducts.id, createdAt: doctorProducts.createdAt })
      .from(doctorProducts)
      .leftJoin(products, eq(doctorProducts.productId, products.id))
      .where(eq(doctorProducts.doctorId, id));

    return c.json({ success: true, data: rows.filter(r => r.name).sort((a, b) => a.name!.localeCompare(b.name!)) });
  } catch (err) {
    console.error('[doctors/medicines/get]', err);
    return c.json({ success: false, error: 'Failed to fetch medicines' }, 500);
  }
});

// ── POST /api/doctors/:id/medicines — link a medicine to a doctor ─────
doctorsRouter.post('/:id/medicines', async (c) => {
  try {
    const db = getDb();
    const doctorId = Number(c.req.param('id'));
    if (isNaN(doctorId) || doctorId <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const body = await c.req.json();
    const productId = Number(body.productId);
    if (isNaN(productId) || productId <= 0) return c.json({ success: false, error: 'productId is required and must be a valid number' }, 400);

    // Verify doctor exists
    const doctor = db.select().from(doctors).where(eq(doctors.id, doctorId)).get();
    if (!doctor) return c.json({ success: false, error: 'Doctor not found' }, 404);

    // Verify product exists
    const product = db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    // Check if link already exists (avoid duplicate before DB constraint fires)
    const existing = db.select().from(doctorProducts)
      .where(eq(doctorProducts.doctorId, doctorId))
      .all()
      .find(r => r.productId === productId);

    if (existing) return c.json({ success: false, error: 'This medicine is already assigned to this doctor' }, 409);

    const result = db.insert(doctorProducts).values({ doctorId, productId }).returning().get();
    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    console.error('[doctors/medicines/post]', err);
    if (err.message?.includes('UNIQUE')) return c.json({ success: false, error: 'Medicine already assigned' }, 409);
    return c.json({ success: false, error: 'Failed to assign medicine' }, 500);
  }
});

// ── DELETE /api/doctors/:id/medicines/:productId — unlink medicine ────
doctorsRouter.delete('/:id/medicines/:productId', async (c) => {
  try {
    const db = getDb();
    const doctorId  = Number(c.req.param('id'));
    const productId = Number(c.req.param('productId'));
    if (isNaN(doctorId) || isNaN(productId)) return c.json({ success: false, error: 'Invalid IDs' }, 400);

    const existing = db.select().from(doctorProducts)
      .where(eq(doctorProducts.doctorId, doctorId))
      .all()
      .find(r => r.productId === productId);

    if (!existing) return c.json({ success: false, error: 'Link not found' }, 404);

    db.delete(doctorProducts)
      .where(eq(doctorProducts.id, existing.id))
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/medicines/delete]', err);
    return c.json({ success: false, error: 'Failed to remove medicine' }, 500);
  }
});

// ── POST /api/doctors — create ────────────────────────────────────────
doctorsRouter.post('/', async (c) => {
  try {
    const db = getDb();
    const raw = await c.req.json();

    const parsed = doctorCreateSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json({ success: false, error: firstError.message, field: firstError.path[0] }, 400);
    }

    const body = parsed.data;
    const result = db.insert(doctors).values({
      name:           body.name,
      contact:        body.contact,
      address:        body.address,
      birthDate:      body.birthDate || null,
      isMarried:      !!body.isMarried,
      spouseName:     body.spouseName || null,
      spouseBirthDate:body.spouseBirthDate || null,
      anniversary:    body.anniversary || null,
      childrenCount:  body.childrenCount || 0,
      childrenNames:  body.childrenNames || null,
      childrenBirthDates: body.childrenBirthDates || null,
      qualification:  body.qualification,
      specialization: body.specialization,
      hospitalName:   body.hospitalName || null,
      hospitalOpeningDate: body.hospitalOpeningDate || null,
      hospitalsCount: body.hospitalsCount || 0,
      hospitalNames:  body.hospitalNames || null,
      hospitalOpeningDates: body.hospitalOpeningDates || null,
      email:          body.email || null,
      registrationNo: body.registrationNo || null,
      experienceYrs:  body.experienceYrs || null,
    }).returning().get();

    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    console.error('[doctors/create]', err);
    return c.json({ success: false, error: err.message || 'Failed to create doctor' }, 500);
  }
});

// ── PUT /api/doctors/:id — update ─────────────────────────────────────
doctorsRouter.put('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const raw = await c.req.json();
    const parsed = doctorUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json({ success: false, error: firstError.message, field: firstError.path[0] }, 400);
    }

    const body = parsed.data;
    const result = db.update(doctors).set({
      name:           body.name,
      contact:        body.contact,
      address:        body.address,
      birthDate:      body.birthDate || null,
      isMarried:      !!body.isMarried,
      spouseName:     body.spouseName || null,
      spouseBirthDate:body.spouseBirthDate || null,
      anniversary:    body.anniversary || null,
      childrenCount:  body.childrenCount || 0,
      childrenNames:  body.childrenNames || null,
      childrenBirthDates: body.childrenBirthDates || null,
      qualification:  body.qualification,
      specialization: body.specialization,
      hospitalName:   body.hospitalName || null,
      hospitalOpeningDate: body.hospitalOpeningDate || null,
      hospitalsCount: body.hospitalsCount || 0,
      hospitalNames:  body.hospitalNames || null,
      hospitalOpeningDates: body.hospitalOpeningDates || null,
      email:          body.email || null,
      registrationNo: body.registrationNo || null,
      experienceYrs:  body.experienceYrs || null,
      updatedAt:      new Date().toISOString(),
    }).where(eq(doctors.id, id)).returning().get();

    if (!result) return c.json({ success: false, error: 'Doctor not found' }, 404);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[doctors/update]', err);
    return c.json({ success: false, error: err.message || 'Failed to update doctor' }, 500);
  }
});

// ── DELETE /api/doctors/:id — delete ─────────────────────────────────
doctorsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid doctor ID' }, 400);

    const existing = db.select().from(doctors).where(eq(doctors.id, id)).get();
    if (!existing) return c.json({ success: false, error: 'Doctor not found' }, 404);

    db.delete(doctors).where(eq(doctors.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/delete]', err);
    return c.json({ success: false, error: 'Failed to delete doctor' }, 500);
  }
});

export { doctorsRouter };
