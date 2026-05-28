import { Hono } from 'hono';
import { eq, like, or, desc, inArray } from 'drizzle-orm';
import { getDb, getSqlite } from '../db/index';
import { doctors, pharmacies, salesTransactions, products } from '../db/schema';

const doctorsRouter = new Hono();

// GET /api/doctors  — list all, with optional ?search=
doctorsRouter.get('/', async (c) => {
  try {
    const db = getDb();
    const search = c.req.query('search');

    let rows;
    if (search) {
      rows = await db.select().from(doctors)
        .where(or(
          like(doctors.name, `%${search}%`),
          like(doctors.contact, `%${search}%`),
          like(doctors.specialization, `%${search}%`)
        ))
        .orderBy(desc(doctors.createdAt));
    } else {
      rows = await db.select().from(doctors).orderBy(desc(doctors.createdAt));
    }

    return c.json({ success: true, data: rows });
  } catch (err) {
    console.error('[doctors/get]', err);
    return c.json({ success: false, error: 'Failed to fetch doctors' }, 500);
  }
});

// GET /api/doctors/linkage — all doctor-pharmacy linkages with business data
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
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        pharmacyAddress: pharmacy.address,
        isDraft: pharmacy.isDraft,
        doctorId: pharmacy.doctorId || null,
        doctorName: doctor?.name || null,
        doctorSpecialization: doctor?.specialization || null,
        totalBusiness: salesResult?.totalBusiness || 0,
        totalSaleQty: salesResult?.totalSaleQty || 0,
        productCount: salesResult?.productCount || 0,
      };
    });

    return c.json({ success: true, data: { linkages, doctors: allDoctors.map(d => ({ id: d.id, name: d.name, specialization: d.specialization })) } });
  } catch (err) {
    console.error('[doctors/linkage]', err);
    return c.json({ success: false, error: 'Failed to fetch linkages' }, 500);
  }
});

// PUT /api/doctors/linkage — update a pharmacy's linked doctor
doctorsRouter.put('/linkage', async (c) => {
  try {
    const db = getDb();
    const body = await c.req.json();
    const { pharmacyId, doctorId } = body;

    if (!pharmacyId) return c.json({ success: false, error: 'pharmacyId is required' }, 400);

    db.update(pharmacies).set({
      doctorId: doctorId || null,
      updatedAt: new Date().toISOString(),
    }).where(eq(pharmacies.id, Number(pharmacyId))).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/linkage/update]', err);
    return c.json({ success: false, error: 'Failed to update linkage' }, 500);
  }
});

// GET /api/doctors/:id — single doctor with pharmacies and prescribed medicines
doctorsRouter.get('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
    if (!doctor) return c.json({ success: false, error: 'Doctor not found' }, 404);

    const linkedPharmacies = await db.select().from(pharmacies).where(eq(pharmacies.doctorId, id));

    // Derive prescribed medicines: unique product names from transactions of linked pharmacies
    let prescribedMedicines: string[] = [];
    if (linkedPharmacies.length > 0) {
      const pharmIds = linkedPharmacies.map(p => p.id);
      const txns = db.select({ productId: salesTransactions.productId })
        .from(salesTransactions)
        .where(inArray(salesTransactions.pharmacyId, pharmIds))
        .all();
      const uniqueProdIds = [...new Set(txns.map(t => t.productId))];
      if (uniqueProdIds.length > 0) {
        const prods = db.select({ name: products.name })
          .from(products)
          .where(inArray(products.id, uniqueProdIds))
          .all();
        prescribedMedicines = prods.map(p => p.name).sort();
      }
    }

    return c.json({ success: true, data: { ...doctor, pharmacies: linkedPharmacies, prescribedMedicines } });
  } catch (err) {
    console.error('[doctors/getById]', err);
    return c.json({ success: false, error: 'Failed to fetch doctor' }, 500);
  }
});

// POST /api/doctors — create
doctorsRouter.post('/', async (c) => {
  try {
    const db = getDb();
    const body = await c.req.json();

    const result = db.insert(doctors).values({
      name:           body.name,
      contact:        body.contact,
      address:        body.address,
      birthDate:      body.birthDate || null,
      isMarried:      !!body.isMarried,
      spouseName:     body.spouseName || null,
      anniversary:    body.anniversary || null,
      childrenCount:  body.childrenCount || 0,
      childrenNames:  body.childrenNames || null,
      qualification:  body.qualification,
      specialization: body.specialization,
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

// PUT /api/doctors/:id — update
doctorsRouter.put('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const result = db.update(doctors).set({
      name:           body.name,
      contact:        body.contact,
      address:        body.address,
      birthDate:      body.birthDate || null,
      isMarried:      !!body.isMarried,
      spouseName:     body.spouseName || null,
      anniversary:    body.anniversary || null,
      childrenCount:  body.childrenCount || 0,
      childrenNames:  body.childrenNames || null,
      qualification:  body.qualification,
      specialization: body.specialization,
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

// DELETE /api/doctors/:id — delete
doctorsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.delete(doctors).where(eq(doctors.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('[doctors/delete]', err);
    return c.json({ success: false, error: 'Failed to delete doctor' }, 500);
  }
});

export { doctorsRouter };
