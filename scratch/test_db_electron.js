const path = require('path');
const Database = require(path.resolve('node_modules/better-sqlite3'));
const db = new Database('data/suratpharma.db');

try {
  console.log('--- PRODUCTS MATCHING KUSH ---');
  const prods = db.prepare("SELECT * FROM products WHERE name LIKE '%KUSH%'").all();
  console.log(prods);

  if (prods.length > 0) {
    const prodId = prods[0].id;
    console.log(`\n--- LINKS FOR PRODUCT ID ${prodId} ---`);
    const links = db.prepare('SELECT * FROM pharmacy_products WHERE productId = ?').all(prodId);
    console.log(links);

    console.log(`\n--- TRANSACTIONS FOR PRODUCT ID ${prodId} ---`);
    const txs = db.prepare('SELECT * FROM sales_transactions WHERE productId = ?').all(prodId);
    console.log(txs);
  }
  
  console.log('\n--- TOTAL ROW COUNTS ---');
  console.log('Products count:', db.prepare('SELECT COUNT(*) as c FROM products').get().c);
  console.log('Pharmacies count:', db.prepare('SELECT COUNT(*) as c FROM pharmacies').get().c);
  console.log('Pharmacy products links count:', db.prepare('SELECT COUNT(*) as c FROM pharmacy_products').get().c);
  console.log('Sales transactions count:', db.prepare('SELECT COUNT(*) as c FROM sales_transactions').get().c);
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
process.exit(0);
