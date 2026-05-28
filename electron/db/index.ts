import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function initDb(dbPath: string) {
  _sqlite = new Database(dbPath);

  // Performance PRAGMAs
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('synchronous = NORMAL');
  _sqlite.pragma('busy_timeout = 5000');
  // 64 MB page cache — accommodates 29K products + 2K pharmacies without cache misses
  _sqlite.pragma('cache_size = -65536');
  _sqlite.pragma('foreign_keys = ON');
  // 256 MB memory-mapped I/O — eliminates syscall overhead on large sequential scans
  _sqlite.pragma('mmap_size = 268435456');
  // Prevent WAL file from growing unbounded during heavy background writes
  _sqlite.pragma('wal_autocheckpoint = 1000');

  // ── Ensure all performance indexes exist on startup ──
  // PharmacyProduct join indexes
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_pharmacy_idx ON PharmacyProduct(pharmacyId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_product_idx ON PharmacyProduct(productId)');
  // SalesTransaction indexes — critical for analytics queries
  _sqlite.exec('CREATE INDEX IF NOT EXISTS st_pharmacy_idx ON SalesTransaction(pharmacyId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS st_product_idx  ON SalesTransaction(productId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS st_upload_idx   ON SalesTransaction(uploadId)');
  // Pharmacy indexes — critical for paginated listing and name-based fuzzy search
  _sqlite.exec('CREATE INDEX IF NOT EXISTS ph_name_idx    ON Pharmacy(name)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS ph_created_idx ON Pharmacy(createdAt)');

  // ── Product table migration (support name + pack unique constraint) ──
  try {
    const productInfo = _sqlite.prepare("PRAGMA table_info(Product)").all() as any[];
    const hasPack = productInfo.some(col => col.name === 'pack');
    if (!hasPack) {
      _sqlite.exec('ALTER TABLE Product RENAME TO Product_old');
      _sqlite.exec(`
        CREATE TABLE Product (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          name      TEXT NOT NULL,
          pack      TEXT,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(name, pack)
        )
      `);
      _sqlite.exec('CREATE INDEX IF NOT EXISTS product_name_idx ON Product(name)');
      _sqlite.exec('CREATE INDEX IF NOT EXISTS product_created_idx ON Product(createdAt)');
      
      // Copy data from Product_old to Product. If duplicate name/pack combinations exist, ignore or select one.
      _sqlite.exec('INSERT OR IGNORE INTO Product (id, name, createdAt, updatedAt) SELECT id, name, createdAt, updatedAt FROM Product_old');
      _sqlite.exec('DROP TABLE Product_old');
      console.log('[DB] Migrated Product table to support pack sizes.');
    }
  } catch (err: any) {
    console.error('[DB] Product migration error:', err.message);
  }

  // ── User table migration (profile fields) ──
  try {
    const userInfo = _sqlite.prepare("PRAGMA table_info(User)").all() as any[];
    const userCols = userInfo.map(col => col.name);
    if (!userCols.includes('prefix')) {
      _sqlite.exec("ALTER TABLE User ADD COLUMN prefix TEXT NOT NULL DEFAULT 'Mr.'");
    }
    if (!userCols.includes('firstName')) {
      _sqlite.exec("ALTER TABLE User ADD COLUMN firstName TEXT NOT NULL DEFAULT ''");
    }
    if (!userCols.includes('lastName')) {
      _sqlite.exec("ALTER TABLE User ADD COLUMN lastName TEXT NOT NULL DEFAULT ''");
    }
    if (!userCols.includes('birthDate')) {
      _sqlite.exec("ALTER TABLE User ADD COLUMN birthDate TEXT");
    }
    if (!userCols.includes('email')) {
      _sqlite.exec("ALTER TABLE User ADD COLUMN email TEXT");
      _sqlite.exec("UPDATE User SET email = LOWER(REPLACE(username, ' ', '')) || '@aegisrx.com' WHERE email IS NULL");
      // Add a unique index on email
      _sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique_idx ON User(email)");
    }

  } catch (err: any) {
    console.error('[DB] User migration error:', err.message);
  }

  // ── DoctorProduct migration (auto-creates on first run, safe on existing DBs) ──
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS DoctorProduct (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      doctorId  INTEGER NOT NULL REFERENCES Doctor(id) ON DELETE CASCADE,
      productId INTEGER NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(doctorId, productId)
    )
  `);
  _sqlite.exec('CREATE INDEX IF NOT EXISTS dp_doctor_idx ON DoctorProduct(doctorId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS dp_product_idx ON DoctorProduct(productId)');
  // ── DismissedNotification migration (persistent push-notification tombstone) ──
  // CREATE TABLE IF NOT EXISTS is safe on existing DBs — idempotent on all restarts.
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS DismissedNotification (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType  TEXT NOT NULL,
      entityId    INTEGER NOT NULL,
      eventType   TEXT NOT NULL,
      eventDate   TEXT NOT NULL,
      dismissedAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(entityId, entityType, eventType, eventDate)
    )
  `);
  // Composite index: checkEventsLogic queries by (entityId, eventType, eventDate)
  _sqlite.exec('CREATE INDEX IF NOT EXISTS dn_lookup_idx ON DismissedNotification(entityId, entityType, eventType, eventDate)');

  // ── ExcelUpload migration (support format column) ──

  try {
    const uploadInfo = _sqlite.prepare("PRAGMA table_info(ExcelUpload)").all() as any[];
    const uploadCols = uploadInfo.map(col => col.name);
    if (!uploadCols.includes('format')) {
      _sqlite.exec("ALTER TABLE ExcelUpload ADD COLUMN format TEXT");
      console.log('[DB] Added format column to ExcelUpload table.');
    }
  } catch (err: any) {
    console.error('[DB] ExcelUpload migration error:', err.message);
  }

  _db = drizzle(_sqlite, { schema });
  return _db;
}


export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function getSqlite(): any {
  if (!_sqlite) throw new Error('Database not initialized.');
  return _sqlite;
}
