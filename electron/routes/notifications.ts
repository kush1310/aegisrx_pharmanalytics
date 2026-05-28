import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { notifications, doctors, pharmacies } from '../db/schema';
import { Notification as ElectronNotification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const notificationsRouter = new Hono();

// GET /api/notifications
notificationsRouter.get('/', async (c) => {
  try {
    const db = getDb();
    const rows = await db.select().from(notifications).orderBy(desc(notifications.eventDate));
    return c.json({ success: true, data: rows });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to mark as read' }, 500);
  }
});

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', async (c) => {
  try {
    const db = getDb();
    db.update(notifications).set({ isRead: true }).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to mark all as read' }, 500);
  }
});

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.delete(notifications).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete notification' }, 500);
  }
});

export async function checkEventsLogic() {
  try {
    const db = getDb();
    const today = new Date();
    const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayStr = today.toISOString().split('T')[0];

    const allDoctors = db.select().from(doctors).all();
    const allPharmacies = db.select().from(pharmacies).all();

    const checkAndCreate = (
      type: 'DOCTOR' | 'PHARMACY_OWNER',
      entityId: number,
      eventType: 'BIRTHDAY' | 'ANNIVERSARY',
      dateStr: string | null | undefined,
      title: string,
      message: string
    ) => {
      if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) return;
      const dateMD = dateStr.substring(5, 10);
      if (dateMD !== todayMD) return;

      const existing = db.select().from(notifications)
        .where(eq(notifications.entityId, entityId))
        .all()
        .find(n => n.entityType === type && n.eventType === eventType && n.eventDate?.startsWith(todayStr));

      if (!existing) {
        db.insert(notifications).values({
          entityType: type,
          entityId,
          eventType,
          eventDate:  todayStr,
          title,
          message,
          isRead:     false,
        }).run();

        try {
          if (ElectronNotification.isSupported()) {
            new ElectronNotification({ title, body: message }).show();
          }
        } catch (e) {
          console.error('Failed to show desktop notification:', e);
        }
      }
    };

    for (const doc of allDoctors) {
      checkAndCreate('DOCTOR', doc.id, 'BIRTHDAY', doc.birthDate,
        `🎂 Dr. ${doc.name}'s Birthday!`, `Specialist: ${doc.specialization}. Contact: ${doc.contact}`);
      checkAndCreate('DOCTOR', doc.id, 'ANNIVERSARY', doc.anniversary,
        `💍 Dr. ${doc.name}'s Anniversary!`, `Send best wishes to Dr. ${doc.name}`);
    }

    for (const ph of allPharmacies) {
      checkAndCreate('PHARMACY_OWNER', ph.id, 'BIRTHDAY', ph.ownerBirthDate,
        `🎂 ${ph.ownerName}'s Birthday!`, `Owner of ${ph.name}. Contact: ${ph.contact}`);
    }
  } catch (err) {
    console.error('[notifications/check-events background worker]', err);
  }
}

// POST /api/notifications/check-events (Still available for manual trigger)
notificationsRouter.post('/check-events', async (c) => {
  await checkEventsLogic();
  return c.json({ success: true });
});

export { notificationsRouter };
