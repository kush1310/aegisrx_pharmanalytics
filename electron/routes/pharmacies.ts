import { Hono } from 'hono';
import { eq, like, or, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { pharmacies, doctors, pharmacyProducts, products } from '../db/schema';

const pharmaciesRouter = new Hono();

// GET /api/pharmacies
pharmaciesRouter.get('/', async (c) => {
  try {
    const db = getDb();
    const search = c.req.query('search');

    let rows;
    if (search) {
      rows = await db.select().from(pharmacies)
        .where(or(
          like(pharmacies.name, `%${search}%`),
          like(pharmacies.ownerName, `%${search}%`),
          like(pharmacies.contact, `%${search}%`)
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

// GET /api/pharmacies/:id — with doctor + products
pharmaciesRouter.get('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const [pharmacy] = await db.select().from(pharmacies).where(eq(pharmacies.id, id)).limit(1);
    if (!pharmacy) return c.json({ success: false, error: 'Pharmacy not found' }, 404);

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

// POST /api/pharmacies
pharmaciesRouter.post('/', async (c) => {
  try {
    const db = getDb();
    const body = await c.req.json();

    const result = db.insert(pharmacies).values({
      name:           body.name,
      ownerName:      body.ownerName,
      licenseId:      body.licenseId,
      gstNumber:      body.gstNumber || null,
      drugLicense:    body.drugLicense || null,
      address:        body.address,
      contact:        body.contact,
      ownerBirthDate: body.ownerBirthDate || null,
      doctorId:       body.doctorId || null,
    }).returning().get();

    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    console.error('[pharmacies/create]', err);
    const msg = err.message?.includes('UNIQUE') ? 'License ID already exists' : 'Failed to create pharmacy';
    return c.json({ success: false, error: msg }, 500);
  }
});

// PUT /api/pharmacies/:id
pharmaciesRouter.put('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const result = db.update(pharmacies).set({
      name:           body.name,
      ownerName:      body.ownerName,
      licenseId:      body.licenseId,
      gstNumber:      body.gstNumber || null,
      drugLicense:    body.drugLicense || null,
      address:        body.address,
      contact:        body.contact,
      ownerBirthDate: body.ownerBirthDate || null,
      doctorId:       body.doctorId || null,
      updatedAt:      new Date().toISOString(),
    }).where(eq(pharmacies.id, id)).returning().get();

    if (!result) return c.json({ success: false, error: 'Pharmacy not found' }, 404);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[pharmacies/update]', err);
    return c.json({ success: false, error: err.message || 'Failed to update pharmacy' }, 500);
  }
});

// DELETE /api/pharmacies/:id
pharmaciesRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.delete(pharmacies).where(eq(pharmacies.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('[pharmacies/delete]', err);
    return c.json({ success: false, error: 'Failed to delete pharmacy' }, 500);
  }
});

// POST /api/pharmacies/:id/link-doctor
pharmaciesRouter.post('/:id/link-doctor', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const { doctorId } = await c.req.json();
    db.update(pharmacies).set({ doctorId: doctorId || null, updatedAt: new Date().toISOString() })
      .where(eq(pharmacies.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('[pharmacies/link-doctor]', err);
    return c.json({ success: false, error: 'Failed to link doctor' }, 500);
  }
});

export { pharmaciesRouter };
