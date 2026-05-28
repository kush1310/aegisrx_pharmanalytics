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
  _sqlite.pragma('cache_size = -20000');
  _sqlite.pragma('foreign_keys = ON');
  // Ensure performance indexes exist
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_pharmacy_idx ON PharmacyProduct(pharmacyId)');
  _sqlite.exec('CREATE INDEX IF NOT EXISTS pp_product_idx ON PharmacyProduct(productId)');

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
