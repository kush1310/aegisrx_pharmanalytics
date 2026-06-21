import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { notifications, doctors, pharmacies, dismissedNotifications } from '../db/schema';
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

// PATCH /api/notifications/:id/unread
notificationsRouter.patch('/:id/unread', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.update(notifications).set({ isRead: false }).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to mark as unread' }, 500);
  }
});

// PATCH /api/notifications/:id/restore
notificationsRouter.patch('/:id/restore', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.update(notifications).set({ isCleared: false }).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to restore notification' }, 500);
  }
});

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', async (c) => {
  try {
    const db = getDb();
    db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.isRead, false), eq(notifications.isCleared, false)))
      .run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to mark all as read' }, 500);
  }
});

/**
 * DELETE /api/notifications/:id — flags a single notification as cleared.
 *
 * Instead of deleting from the database, we update isCleared = true to allow
 * the notification to be accessed in the "Recently Cleared" section.
 */
notificationsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));
    db.update(notifications).set({ isCleared: true }).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to clear notification' }, 500);
  }
});

/**
 * DELETE /api/notifications — flags all non-cleared notifications as cleared.
 */
notificationsRouter.delete('/', async (c) => {
  try {
    const db = getDb();
    db.update(notifications)
      .set({ isCleared: true })
      .where(eq(notifications.isCleared, false))
      .run();
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
  // Desktop push notifications disabled as per user request. Keep only in-app notifications.
}

/**
 * checkEventsLogic
 *
 * Scans all doctor and pharmacy records to detect upcoming birth dates or anniversaries
 * within a 3-day window (today, tomorrow, and day after tomorrow) and generates corresponding
 * notification items. Before performing checks, it deletes all existing unread and uncleared
 * notification rows for these dates to allow complete dynamic regeneration with fresh DB state.
 *
 * @param  None
 * @returns {Promise<void>} - Resolves once notifications are computed and persisted.
 * @validates - Dismissed tombstones are verified against the DismissedNotification table.
 *            - Events are only created for valid date formats.
 * @redirects - None.
 * @edge-cases - Preserves notifications that are already marked as read or cleared to avoid duplicate delivery.
 *             - Dismissed notifications are skipped using a tombstone lookup.
 */
function formatLocalYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const sessionFiredCache = new Set<string>();

/**
 * getDocDisplayName
 *
 * Formats doctor name cleanly without duplicate prefixes. If name already starts
 * with Dr. or Dr. (case insensitive), returns it unchanged. Otherwise prepends Dr.
 *
 * @param  {string} name  - Doctor's raw name from database.
 * @returns {string}      - Formatted display name.
 */
function getDocDisplayName(name: string): string {
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
}

export async function checkEventsLogic() {
  try {
    const db = getDb();
    const today = new Date();
    const todayStr = formatLocalYYYYMMDD(today);
    const todayMD  = todayStr.substring(5, 10);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatLocalYYYYMMDD(tomorrow);
    const tomorrowMD  = tomorrowStr.substring(5, 10);

    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    const dayAfterStr = formatLocalYYYYMMDD(dayAfter);
    const dayAfterMD  = dayAfterStr.substring(5, 10);

    // Delete existing unread and uncleared notifications for today, tomorrow, and day after tomorrow
    // to allow complete dynamic regeneration from updated doctor/pharmacy records.
    db.delete(notifications)
      .where(
        and(
          eq(notifications.isRead, false),
          eq(notifications.isCleared, false),
          inArray(notifications.eventDate, [todayStr, tomorrowStr, dayAfterStr])
        )
      )
      .run();

    // Reset the session cache for these dates to allow dynamic updates
    sessionFiredCache.clear();

    const allDoctors    = db.select().from(doctors).all();
    const allPharmacies = db.select().from(pharmacies).all();

    // Pre-load all existing notification rows for today, tomorrow, and day after tomorrow into a Set for O(1) lookup
    const existingRows = db.select().from(notifications).all()
      .filter(n => n.eventDate === todayStr || n.eventDate === tomorrowStr || n.eventDate === dayAfterStr);
    const existingSet = new Set(existingRows.map(n => `${n.entityId}-${n.entityType}-${n.eventType}-${n.eventDate}`));

    // Pre-load all dismissed tombstones for today, tomorrow, and day after tomorrow into a Set for O(1) lookup
    const dismissedRows = db.select().from(dismissedNotifications).all()
      .filter(d => d.eventDate === todayStr || d.eventDate === tomorrowStr || d.eventDate === dayAfterStr);
    const dismissedSet = new Set(dismissedRows.map(d => `${d.entityId}-${d.entityType}-${d.eventType}-${d.eventDate}`));

    const stripEmojis = (str: string): string =>
      str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();

    const pushToday: { title: string; message: string }[] = [];
    const pushTomorrow: { title: string; message: string }[] = [];

    const checkAndCreate = (
      type:      'DOCTOR' | 'PHARMACY_OWNER',
      entityId:  number,
      eventType: string,
      dateStr:   string | null | undefined,
      titleTemplate: (timeLabel: string) => string,
      messageTemplate: (timeLabel: string) => string
    ) => {
      if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) return;
      const dateMD = dateStr.substring(5, 10);

      let targetStr = '';
      let timeLabel = '';
      let isPushTarget = false;

      if (dateMD === todayMD) {
        targetStr = todayStr;
        timeLabel = 'Today';
        isPushTarget = true;
      } else if (dateMD === tomorrowMD) {
        targetStr = tomorrowStr;
        timeLabel = 'Tomorrow';
        isPushTarget = true;
      } else if (dateMD === dayAfterMD) {
        targetStr = dayAfterStr;
        timeLabel = 'Day After Tomorrow';
        isPushTarget = false;
      } else {
        return;
      }

      const eventKey = `${entityId}-${type}-${eventType}-${targetStr}`;

      // Layer 1: Tombstone check
      if (dismissedSet.has(eventKey)) return;

      // Layer 2: DB row existence check
      const rowExists = existingSet.has(eventKey);

      // Layer 3: In-session OS push guard
      const alreadyFiredThisSession = sessionFiredCache.has(eventKey);
      sessionFiredCache.add(eventKey);

      const cleanTitle   = stripEmojis(titleTemplate(timeLabel));
      const cleanMessage = stripEmojis(messageTemplate(timeLabel));

      if (!rowExists) {
        db.insert(notifications).values({
          entityType: type,
          entityId,
          eventType,
          eventDate:  targetStr,
          title:      cleanTitle,
          message:    cleanMessage,
          isRead:     false,
          isCleared:  false,
        }).run();
      }

      // Collect push notifications
      if (isPushTarget && !alreadyFiredThisSession) {
        const item = { title: cleanTitle, message: cleanMessage };
        if (targetStr === todayStr) {
          pushToday.push(item);
        } else {
          pushTomorrow.push(item);
        }
      }
    };

    // Check Doctors
    for (const doc of allDoctors) {
      // 1. Doctor's Birthday
      checkAndCreate('DOCTOR', doc.id, 'BIRTHDAY', doc.birthDate,
        (time) => `${getDocDisplayName(doc.name)}'s Birthday ${time}!`,
        () => `Specialist: ${doc.specialization}. Contact: ${doc.contact}`);

      // 2. Doctor's Anniversary
      checkAndCreate('DOCTOR', doc.id, 'ANNIVERSARY', doc.anniversary,
        (time) => `${getDocDisplayName(doc.name)}'s Anniversary ${time}!`,
        () => `Send best wishes to ${getDocDisplayName(doc.name)}`);

      // 3. Spouse's Birthday
      if (doc.isMarried && doc.spouseName) {
        checkAndCreate('DOCTOR', doc.id, 'SPOUSE_BIRTHDAY', (doc as any).spouseBirthDate,
          (time) => `${getDocDisplayName(doc.name)}'s Spouse (${doc.spouseName})'s Birthday ${time}!`,
          () => `Send best wishes to ${doc.spouseName}`);
      }

      // 4. Children's Birthdays
      if (doc.childrenNames) {
        try {
          const parsed = JSON.parse(doc.childrenNames);
          if (Array.isArray(parsed)) {
            parsed.forEach((child, index) => {
              if (child && typeof child === 'object' && child.name && child.birthDate) {
                checkAndCreate('DOCTOR', doc.id, `CHILD_BIRTHDAY_${index}`, child.birthDate,
                  (time) => `${getDocDisplayName(doc.name)}'s Child (${child.name})'s Birthday ${time}!`,
                  () => `Send best wishes to ${child.name}`);
              }
            });
          }
        } catch {
          // Backward compatibility: old string-only arrays have no DOB info, so do nothing.
        }
      }
    }

    // Check Pharmacies
    for (const ph of allPharmacies) {
      checkAndCreate('PHARMACY_OWNER', ph.id, 'BIRTHDAY', ph.ownerBirthDate,
        (time) => `${ph.ownerName}'s Birthday ${time}!`,
        () => `Owner of ${ph.name}. Contact: ${ph.contact}`);
    }

    // Enqueue pushes: Today's first, then Tomorrow's
    for (const p of pushToday) {
      queueDesktopNotification(p.title, p.message);
    }
    for (const p of pushTomorrow) {
      queueDesktopNotification(p.title, p.message);
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
