const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

try {
  db.exec(`
    ALTER TABLE Pharmacy ADD COLUMN isDraft integer NOT NULL DEFAULT 0;
  `);
  console.log('Added isDraft column.');
} catch(e) {
  console.log('isDraft column error (might exist):', e.message);
}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS doctor_name_idx ON Doctor(name);
    CREATE INDEX IF NOT EXISTS doctor_contact_idx ON Doctor(contact);
    CREATE INDEX IF NOT EXISTS doctor_created_idx ON Doctor(createdAt);
    CREATE INDEX IF NOT EXISTS pharmacy_name_idx ON Pharmacy(name);
    CREATE INDEX IF NOT EXISTS pharmacy_license_idx ON Pharmacy(licenseId);
    CREATE INDEX IF NOT EXISTS pharmacy_created_idx ON Pharmacy(createdAt);
    CREATE INDEX IF NOT EXISTS product_name_idx ON Product(name);
    CREATE INDEX IF NOT EXISTS product_created_idx ON Product(createdAt);
  `);
  console.log('Indexes created successfully.');
} catch (e) {
  console.error('Error creating indexes:', e.message);
}

process.exit(0);
