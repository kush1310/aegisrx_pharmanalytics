import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import crypto from 'crypto';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function initDb(dbPath: string) {
  _sqlite = new Database(dbPath);

  // Performance PRAGMAs
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('synchronous = NORMAL');
  _sqlite.pragma('busy_timeout = 5000');
  _sqlite.pragma('cache_size = -20000');
  _sqlite.pragma('foreign_keys = ON');
  // Ensure performance indexes exist
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_pharmacy_idx ON PharmacyProduct(pharmacyId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_product_idx ON PharmacyProduct(productId)');

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

    // Ensure default admin user email is bhavesh@gmail.com and password is hash of kush1111
    const hashPassword = (pw: string) =>
      crypto.pbkdf2Sync(pw, 'suratpharma_salt_2026', 1000, 64, 'sha512').toString('hex');
    const hashed = hashPassword('kush1111');

    // Update existing bhaveshrafaliya@aegisrx.com to bhavesh@gmail.com
    _sqlite.prepare(`
      UPDATE User 
      SET email = 'bhavesh@gmail.com', passwordHash = ?, firstName = 'Bhavesh', lastName = 'Rafaliya'
      WHERE email = 'bhaveshrafaliya@aegisrx.com'
    `).run(hashed);

    // Also ensure any existing bhavesh@gmail.com user gets password kush1111
    _sqlite.prepare(`
      UPDATE User 
      SET passwordHash = ?
      WHERE email = 'bhavesh@gmail.com'
    `).run(hashed);
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

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function getSqlite() {
  if (!_sqlite) throw new Error('Database not initialized.');
  return _sqlite;
}
