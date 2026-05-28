import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
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

/**
 * DELETE /api/notifications/:id — delete a single notification and write a permanent tombstone.
 *
 * The tombstone written to DismissedNotification encodes the full event identity:
 * (entityId, entityType, eventType, eventDate). On future app startups, checkEventsLogic
 * checks this table FIRST and will NOT re-create this notification or re-fire the OS push.
 *
 * The INSERT OR IGNORE handles the edge case where a tombstone already exists (e.g.,
 * user deleted the same event twice via an old notification from a previous day).
 *
 * @param id - Notification row PK from route param.
 * @returns  - { success: true } on deletion; 404 if notification not found.
 */
notificationsRouter.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const id = Number(c.req.param('id'));

    // Fetch the notification row BEFORE deleting so we can extract its event identity
    const row = db.select().from(notifications).where(eq(notifications.id, id)).get();
    if (!row) return c.json({ success: false, error: 'Notification not found' }, 404);

    // Write persistent tombstone — prevents re-fire after app restart
    try {
      db.insert(dismissedNotifications).values({
        entityType: row.entityType,
        entityId:   row.entityId,
        eventType:  row.eventType,
        eventDate:  row.eventDate,
      }).run();
    } catch (tombstoneErr: any) {
      // INSERT OR IGNORE semantics: UNIQUE constraint violation means tombstone already exists.
      // Safe to swallow — the tombstone is already protecting this event.
      if (!tombstoneErr.message?.includes('UNIQUE')) {
        console.error('[notifications/delete] Tombstone insert error:', tombstoneErr);
      }
    }

    // Now delete the notification row from the UI list
    db.delete(notifications).where(eq(notifications.id, id)).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete notification' }, 500);
  }
});

/**
 * DELETE /api/notifications — clear all notifications and tombstone every one.
 *
 * Iterates all existing notification rows, writes a persistent tombstone for each,
 * then bulk-deletes the Notification table. After this operation, checkEventsLogic
 * will skip ALL of today's events even after app restart.
 *
 * @returns - { success: true, dismissed: number } with count of tombstones written.
 */
notificationsRouter.delete('/', async (c) => {
  try {
    const db = getDb();

    // Fetch all current notification rows before deleting
    const allRows = db.select().from(notifications).all();

    // Write tombstones for every notification being cleared
    let dismissedCount = 0;
    for (const row of allRows) {
      try {
        db.insert(dismissedNotifications).values({
          entityType: row.entityType,
          entityId:   row.entityId,
          eventType:  row.eventType,
          eventDate:  row.eventDate,
        }).run();
        dismissedCount++;
      } catch (tombstoneErr: any) {
        // Swallow UNIQUE violations — tombstone already exists for this event
        if (!tombstoneErr.message?.includes('UNIQUE')) {
          console.error('[notifications/delete-all] Tombstone insert error:', tombstoneErr);
        }
      }
    }

    // Bulk delete all notification rows
    db.delete(notifications).run();
    return c.json({ success: true, dismissed: dismissedCount });
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
    title:   stripEmojis(title),
    message: stripEmojis(message)
  });
  processNotificationQueue();
}

/**
 * checkEventsLogic — scheduled birthday/anniversary event checker.
 *
 * Runs 5 minutes after app startup and every 12 hours thereafter (via main.ts).
 * Also available as POST /api/notifications/check-events for manual trigger from UI.
 *
 * Deduplication strategy (three-layer, innermost wins):
 *
 * Layer 1 — DismissedNotification DB tombstone (PERSISTENT — survives app restart):
 *   If the user has ever deleted a notification for this specific event on this date,
 *   a tombstone row exists. Skip the event entirely — no DB insert, no OS push.
 *   This is the fix for the bug where dismissed notifications reappeared after restart.
 *
 * Layer 2 — Notification DB row existence check:
 *   If a Notification row already exists in the DB for this event+entity+date,
 *   skip the insert (prevents duplicate rows across multiple checkEventsLogic calls
 *   within the same app session without requiring a restart).
 *
 * Layer 3 — In-memory sessionQueue guard:
 *   Prevents the OS push from firing more than once within a single app session
 *   (e.g., if check-events is called manually after the scheduled check).
 *   Resets on app restart — intentionally, because Layer 1 now handles cross-session safety.
 */
const sessionFiredCache = new Set<string>();

export async function checkEventsLogic() {
  try {
    const db = getDb();
    const today = new Date();
    const todayMD  = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayStr = today.toISOString().split('T')[0];

    const allDoctors    = db.select().from(doctors).all();
    const allPharmacies = db.select().from(pharmacies).all();

    // Pre-load all existing notification rows for today into a Set for O(1) lookup
    const existingTodayRows = db.select().from(notifications).all()
      .filter(n => n.eventDate?.startsWith(todayStr));
    const existingSet = new Set(existingTodayRows.map(n => `${n.entityId}-${n.entityType}-${n.eventType}`));

    // Pre-load all dismissed tombstones for today into a Set for O(1) lookup
    const dismissedRows = db.select().from(dismissedNotifications).all()
      .filter(d => d.eventDate === todayStr);
    const dismissedSet = new Set(dismissedRows.map(d => `${d.entityId}-${d.entityType}-${d.eventType}`));

    const stripEmojis = (str: string): string =>
      str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();

    const checkAndCreate = (
      type:      'DOCTOR' | 'PHARMACY_OWNER',
      entityId:  number,
      eventType: 'BIRTHDAY' | 'ANNIVERSARY',
      dateStr:   string | null | undefined,
      title:     string,
      message:   string
    ) => {
      if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) return;
      const dateMD = dateStr.substring(5, 10);
      if (dateMD !== todayMD) return;

      const eventKey = `${entityId}-${type}-${eventType}`;

      // ── Layer 1: Persistent tombstone check ──────────────────────────────
      // If the user dismissed this exact event today (at any point, even before this app session),
      // skip it entirely. No notification insert, no OS push. Full stop.
      if (dismissedSet.has(eventKey)) return;

      // ── Layer 2: DB row existence check ──────────────────────────────────
      // If a Notification row is already in the DB for this event today, skip insert.
      // The OS push is still guarded by Layer 3 below.
      const rowExists = existingSet.has(eventKey);

      // ── Layer 3: In-session OS push guard ────────────────────────────────
      // Prevents duplicate OS pushes within the same app session (e.g., manual re-check).
      const alreadyFiredThisSession = sessionFiredCache.has(eventKey);
      sessionFiredCache.add(eventKey);

      const cleanTitle   = stripEmojis(title);
      const cleanMessage = stripEmojis(message);

      if (!rowExists) {
        db.insert(notifications).values({
          entityType: type,
          entityId,
          eventType,
          eventDate:  todayStr,
          title:      cleanTitle,
          message:    cleanMessage,
          isRead:     false,
        }).run();
      }

      // Only fire OS push if not already sent this session
      if (!alreadyFiredThisSession) {
        queueDesktopNotification(cleanTitle, cleanMessage);
      }
    };

    for (const doc of allDoctors) {
      checkAndCreate('DOCTOR', doc.id, 'BIRTHDAY',    doc.birthDate,
        `Dr. ${doc.name}'s Birthday Today!`,    `Specialist: ${doc.specialization}. Contact: ${doc.contact}`);
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
