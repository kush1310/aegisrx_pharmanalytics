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

// DELETE /api/notifications — clear all notifications
notificationsRouter.delete('/', async (c) => {
  try {
    const db = getDb();
    db.delete(notifications).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to clear notifications' }, 500);
  }
});

// Rate-limited desktop notification queue to ensure users do not miss multiple events
interface QueuedNotification {
  title: string;
  message: string;
}

const notificationQueue: QueuedNotification[] = [];
let isProcessingQueue = false;

function processNotificationQueue() {
  if (isProcessingQueue || notificationQueue.length === 0) return;
  isProcessingQueue = true;

  const next = notificationQueue.shift();
  if (next) {
    try {
      if (ElectronNotification.isSupported()) {
        new ElectronNotification({ title: next.title, body: next.message }).show();
      }
    } catch (e) {
      console.error('Failed to show desktop notification:', e);
    }
  }

  // Wait 10 seconds between notifications to allow reading time
  setTimeout(() => {
    isProcessingQueue = false;
    processNotificationQueue();
  }, 10000);
}

function queueDesktopNotification(title: string, message: string) {
  const stripEmojis = (str: string): string => {
    return str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  };

  notificationQueue.push({
    title: stripEmojis(title),
    message: stripEmojis(message)
  });
  processNotificationQueue();
}

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
        // Strip emojis for database storage
        const stripEmojis = (str: string): string => {
          return str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
        };

        const cleanTitle = stripEmojis(title);
        const cleanMessage = stripEmojis(message);

        db.insert(notifications).values({
          entityType: type,
          entityId,
          eventType,
          eventDate:  todayStr,
          title:      cleanTitle,
          message:    cleanMessage,
          isRead:     false,
        }).run();

        queueDesktopNotification(cleanTitle, cleanMessage);
      }
    };

    for (const doc of allDoctors) {
      checkAndCreate('DOCTOR', doc.id, 'BIRTHDAY', doc.birthDate,
        `Dr. ${doc.name}'s Birthday Today!`, `Specialist: ${doc.specialization}. Contact: ${doc.contact}`);
      checkAndCreate('DOCTOR', doc.id, 'ANNIVERSARY', doc.anniversary,
        `Dr. ${doc.name}'s Anniversary Today!`, `Send best wishes to Dr. ${doc.name}`);
    }

    for (const ph of allPharmacies) {
      checkAndCreate('PHARMACY_OWNER', ph.id, 'BIRTHDAY', ph.ownerBirthDate,
        `${ph.ownerName}'s Birthday Today!`, `Owner of ${ph.name}. Contact: ${ph.contact}`);
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
