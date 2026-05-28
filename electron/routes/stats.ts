import { Hono } from 'hono';
import { getDb } from '../db/index';
import { doctors, pharmacies, notifications, products } from '../db/schema';
import { eq, count } from 'drizzle-orm';

const statsRouter = new Hono();

// GET /api/stats/dashboard
statsRouter.get('/dashboard', async (c) => {
  try {
    const db = getDb();

    const dRes = db.select({ count: count() }).from(doctors).all() as any;
    const pRes = db.select({ count: count() }).from(pharmacies).all() as any;
    const nRes = db.select({ count: count() }).from(notifications)
      .where(eq(notifications.isRead, false)).all() as any;

    const prodRes = db.select({ count: count() }).from(products).all() as any;

    const doctorCount = dRes[0]?.count ?? 0;
    const pharmacyCount = pRes[0]?.count ?? 0;
    const unread = nRes[0]?.count ?? 0;
    const productCount = prodRes[0]?.count ?? 0;

    // Mock data for Recharts (Dashboard Bento Grid)
    const salesTrends = [
      { date: 'Mon', revenue: 12000 },
      { date: 'Tue', revenue: 15000 },
      { date: 'Wed', revenue: 18000 },
      { date: 'Thu', revenue: 14000 },
      { date: 'Fri', revenue: 22000 },
      { date: 'Sat', revenue: 30000 },
      { date: 'Sun', revenue: 28000 }
    ];

    const topDoctors = [
      { name: 'Dr. Ramesh Kumar', pharmacies: 4, revenue: 125000 },
      { name: 'Dr. Sunita Sharma', pharmacies: 3, revenue: 98000 },
      { name: 'Dr. Rajesh Patel', pharmacies: 2, revenue: 76000 },
      { name: 'Dr. Anil Mehta', pharmacies: 2, revenue: 65000 },
      { name: 'Dr. Vivek Singh', pharmacies: 1, revenue: 54000 }
    ];

    const totalRevenue = topDoctors.reduce((sum, item) => sum + item.revenue, 0) + 120000;
    const monthlyGrowth = 14.5;

    return c.json({
      success: true,
      data: {
        doctorCount:           Number(doctorCount ?? 0),
        pharmacyCount:         Number(pharmacyCount ?? 0),
        productCount:          Number(productCount ?? 0),
        unreadNotifications:   Number(unread ?? 0),
        totalRevenue,
        monthlyGrowth,
        salesTrends,
        topDoctors
      }
    });
  } catch (err) {
    console.error('[stats/dashboard]', err);
    // Fallback using data fetches with 100,000 limit for scale
    try {
      const db = getDb();
      const doctorCount   = (db.select().from(doctors).limit(100000).all()).length;
      const pharmacyCount = (db.select().from(pharmacies).limit(100000).all()).length;
      const productCount  = (db.select().from(products).limit(100000).all()).length;
      const unread        = (db.select().from(notifications).where(eq(notifications.isRead, false)).limit(100000).all()).length;
      return c.json({ success: true, data: { doctorCount, pharmacyCount, productCount, unreadNotifications: unread } });
    } catch (e) {
      return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
    }
  }
});

export { statsRouter };
