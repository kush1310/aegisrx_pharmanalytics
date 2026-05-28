const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SalesTransaction (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pharmacyId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      saleQty INTEGER NOT NULL DEFAULT 0,
      freeQty INTEGER NOT NULL DEFAULT 0,
      freeAmt INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      uploadId INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pharmacyId) REFERENCES Pharmacy(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES Product(id) ON DELETE CASCADE,
      FOREIGN KEY (uploadId) REFERENCES ExcelUpload(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS sales_pharmacy_idx ON SalesTransaction(pharmacyId);
    CREATE INDEX IF NOT EXISTS sales_product_idx ON SalesTransaction(productId);
    CREATE INDEX IF NOT EXISTS sales_date_idx ON SalesTransaction(date);
  `);
  console.log('Created SalesTransaction table successfully.');
} catch(e) {
  console.error('Error creating SalesTransaction table:', e.message);
}

process.exit(0);
