const path = require('path');
const Database = require(path.resolve('node_modules/better-sqlite3'));
const db = new Database('data/suratpharma.db');

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('TABLES:', tables.map(t => t.name).join(', '));
  
  // Check the actual table names for products and pharmacy
  tables.forEach(t => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
      console.log(`\n${t.name} columns: ${cols.map(c => c.name).join(', ')}`);
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get();
      console.log(`${t.name} row count: ${row.c}`);
    } catch(e) {}
  });
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
process.exit(0);
