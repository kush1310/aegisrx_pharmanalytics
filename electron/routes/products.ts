import { Hono } from 'hono';
import { eq, desc, like, sql, count, and } from 'drizzle-orm';
import { getDb } from '../db/index';
import { products, pharmacyProducts, pharmacies, salesTransactions } from '../db/schema';

const productsRouter = new Hono();

// GET /api/products — paginated list with pharmacy count & server-side search
productsRouter.get('/', async (c) => {
  try {
    const db = getDb();
    const isExport = c.req.query('export') === 'true';
    const page   = Math.max(1, Number(c.req.query('page'))  || 1);
    const limit  = isExport ? 100000 : Math.min(500, Math.max(1, Number(c.req.query('limit')) || 100));
    const search = c.req.query('search')?.trim();
    const offset = (page - 1) * limit;

    const sortField = c.req.query('sort') || 'createdAt';
    const sortDir = c.req.query('dir') || 'desc';

    // Build the WHERE condition
    const whereCondition = search
      ? like(products.name, `%${search.toUpperCase()}%`)
      : undefined;

    // Total count for pagination
    const totalResult = db
      .select({ value: count() })
      .from(products)
      .where(whereCondition)
      .get();
    const total = totalResult?.value ?? 0;

    // Build OrderBy
    let orderClause;
    if (sortField === 'name') {
      orderClause = sortDir === 'asc' ? products.name : desc(products.name);
    } else if (sortField === 'pharmacyCount') {
      orderClause = sortDir === 'asc' ? count(pharmacyProducts.id) : desc(count(pharmacyProducts.id));
    } else {
      orderClause = sortDir === 'asc' ? products.createdAt : desc(products.createdAt);
    }

    // Main query with LEFT JOIN to get pharmacy count per product
    const rows = db
      .select({
        id:             products.id,
        name:           products.name,
        pack:           products.pack,
        createdAt:      products.createdAt,
        updatedAt:      products.updatedAt,
        pharmacyCount:  count(pharmacyProducts.id),
      })
      .from(products)
      .leftJoin(pharmacyProducts, eq(products.id, pharmacyProducts.productId))
      .where(whereCondition)
      .groupBy(products.id)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset)
      .all();

    return c.json({
      success: true,
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[products/get]', err);
    return c.json({ success: false, error: 'Failed to fetch products' }, 500);
  }
});

// POST /api/products
productsRouter.post('/', async (c) => {
  try {
    const db = getDb();
    const { name, pack } = await c.req.json();
    if (!name) return c.json({ success: false, error: 'Name is required' }, 400);
    const result = db.insert(products).values({
      name: name.trim().toUpperCase(),
      pack: pack?.trim() || null
    }).returning().get();
    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    const msg = err.message?.includes('UNIQUE') ? 'Product with this pack size already exists' : 'Failed to create product';
    return c.json({ success: false, error: msg }, 500);
  }
});

// PUT /api/products/:id
productsRouter.put('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    const { name, pack } = await c.req.json();
    if (!name) return c.json({ success: false, error: 'Name is required' }, 400);

    const result = db.update(products).set({
      name: name.trim().toUpperCase(),
      pack: pack?.trim() || null,
      updatedAt: new Date().toISOString(),
    }).where(eq(products.id, id)).returning().get();

    if (!result) return c.json({ success: false, error: 'Product not found' }, 404);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    const msg = err.message?.includes('UNIQUE') ? 'Product with this pack size already exists' : 'Failed to update product';
    return c.json({ success: false, error: msg }, 500);
  }
});

// DELETE /api/products/:id
productsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.delete(products).where(eq(products.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete product' }, 500);
  }
});

// POST /api/products/link — link product to pharmacy
productsRouter.post('/link', async (c) => {
  try {
    const db = getDb();
    const { pharmacyId, productId } = await c.req.json();

    // Find or create product by name if productName given
    let pid = productId;
    const body = await c.req.json().catch(() => ({})) as any;
    if (!pid && body.productName) {
      let p = db.select().from(products).where(eq(products.name, body.productName)).get();
      if (!p) p = db.insert(products).values({ name: body.productName }).returning().get();
      pid = p?.id;
    }

    const existing = db.select().from(pharmacyProducts)
      .where(eq(pharmacyProducts.pharmacyId, pharmacyId))
      .get();

    if (!existing) {
      db.insert(pharmacyProducts).values({ pharmacyId, productId: pid }).run();
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to link product' }, 500);
  }
});

// GET /api/products/by-pharmacy/:pharmacyId
productsRouter.get('/by-pharmacy/:pharmacyId', async (c) => {
  try {
    const db = getDb();
    const pharmacyId = Number(c.req.param('pharmacyId'));
    const rows = await db
      .select({ id: products.id, name: products.name, linkId: pharmacyProducts.id })
      .from(pharmacyProducts)
      .leftJoin(products, eq(pharmacyProducts.productId, products.id))
      .where(eq(pharmacyProducts.pharmacyId, pharmacyId));
    return c.json({ success: true, data: rows });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch products' }, 500);
  }
});

// GET /api/products/:id/details
productsRouter.get('/:id/details', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));

    if (isNaN(id) || id <= 0) return c.json({ success: false, error: 'Invalid product ID' }, 400);

    const product = db.select().from(products).where(eq(products.id, id)).get();
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    // Get linked pharmacies with their total sales for this product
    const linkedPharmacies = db
      .select({
        id: pharmacies.id,
        name: pharmacies.name,
        contact: pharmacies.contact,
        address: pharmacies.address,
        licenseId: pharmacies.licenseId,
        ownerName: pharmacies.ownerName,
        totalQty: sql<number>`COALESCE(SUM(${salesTransactions.saleQty}), 0)`,
        totalAmount: sql<number>`COALESCE(SUM(${salesTransactions.amount}), 0)`
      })
      .from(pharmacyProducts)
      .leftJoin(pharmacies, eq(pharmacyProducts.pharmacyId, pharmacies.id))
      .leftJoin(salesTransactions, and(
        eq(salesTransactions.productId, id),
        eq(salesTransactions.pharmacyId, pharmacies.id)
      ))
      .where(eq(pharmacyProducts.productId, id))
      .groupBy(pharmacies.id)
      .all();

    return c.json({ success: true, data: { ...product, pharmacies: linkedPharmacies } });
  } catch (err) {
    console.error('[products/details]', err);
    return c.json({ success: false, error: 'Failed to fetch product details' }, 500);
  }
});

export { productsRouter };
