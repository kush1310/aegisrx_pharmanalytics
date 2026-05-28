import { Hono } from 'hono';
import { getDb } from '../db/index';
import { doctors, pharmacies, products } from '../db/schema';
import { like, or } from 'drizzle-orm';

const searchRouter = new Hono();

// GET /api/search?q=query
searchRouter.get('/', async (c) => {
  const query = c.req.query('q')?.trim() || '';
  if (query.length < 1) {
    return c.json({
      success: true,
      data: { doctors: [], pharmacies: [], products: [] }
    });
  }

  try {
    const db = getDb();
    const qPattern = `%${query}%`;

    const matchedDoctors = db.select()
      .from(doctors)
      .where(
        or(
          like(doctors.name, qPattern),
          like(doctors.specialization, qPattern),
          like(doctors.qualification, qPattern)
        )
      )
      .limit(5)
      .all();

    const matchedPharmacies = db.select()
      .from(pharmacies)
      .where(
        or(
          like(pharmacies.name, qPattern),
          like(pharmacies.address, qPattern),
          like(pharmacies.ownerName, qPattern)
        )
      )
      .limit(5)
      .all();

    const matchedProducts = db.select()
      .from(products)
      .where(
        like(products.name, qPattern)
      )
      .limit(5)
      .all();

    return c.json({
      success: true,
      data: {
        doctors: matchedDoctors,
        pharmacies: matchedPharmacies,
        products: matchedProducts
      }
    });
  } catch (err: any) {
    console.error('[search]', err);
    return c.json({ success: false, error: err.message || 'Search query failed' }, 500);
  }
});

export { searchRouter };
