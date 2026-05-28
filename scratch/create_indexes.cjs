const Database = require('better-sqlite3');
const db = new Database('d:/SuratPharma/data/suratpharma.db');

try {
  db.exec('CREATE INDEX IF NOT EXISTS pp_pharmacy_idx ON PharmacyProduct(pharmacyId)');
  db.exec('CREATE INDEX IF NOT EXISTS pp_product_idx ON PharmacyProduct(productId)');
  console.log('Indexes created successfully');
} catch(e) {
  console.log('Index note:', e.message);
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
console.log('Indexes:', indexes.map(i => i.name).join(', '));

const productCount = db.prepare('SELECT COUNT(*) as c FROM Product').get();
console.log('Product count:', productCount.c);

db.close();
