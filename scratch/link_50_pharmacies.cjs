const Database = require('better-sqlite3');
const path = require('path');

console.log('Starting pharmacy-doctor linking script...');

try {
  const dbPath = path.join(__dirname, '../data/suratpharma.db');
  console.log(`Connecting to database at: ${dbPath}`);
  const db = new Database(dbPath);

  // 1. Get or seed doctors
  let doctors = db.prepare('SELECT id, name FROM Doctor').all();
  console.log(`Found ${doctors.length} doctors in database.`);

  if (doctors.length === 0) {
    console.log('No doctors found. Seeding 8 realistic doctors first...');
    const seedDoctors = [
      { name: 'Dr. Ramesh Patel', contact: '9876543210', address: 'Adajan, Surat', qualification: 'MD', specialization: 'Cardiologist' },
      { name: 'Dr. Anita Shah', contact: '9825123456', address: 'Vesu, Surat', qualification: 'MBBS, DGO', specialization: 'Gynecologist' },
      { name: 'Dr. Sanjay Mehta', contact: '9898112233', address: 'Varachha, Surat', qualification: 'MD, DM', specialization: 'Neurologist' },
      { name: 'Dr. Krina Parikh', contact: '9426556677', address: 'Piplod, Surat', qualification: 'MD', specialization: 'Pediatrician' },
      { name: 'Dr. Rajesh Chawla', contact: '9033123123', address: 'Katargam, Surat', qualification: 'MBBS, MS', specialization: 'Orthopedic' },
      { name: 'Dr. Meera Joshi', contact: '9712456456', address: 'Rander, Surat', qualification: 'MD', specialization: 'Dermatologist' },
      { name: 'Dr. Hiren Desai', contact: '9924554433', address: 'Chowk Bazar, Surat', qualification: 'MD', specialization: 'General Physician' },
      { name: 'Dr. Divya Naik', contact: '9377123456', address: 'City Light, Surat', qualification: 'MBBS', specialization: 'General Practitioner' }
    ];

    const insertDoc = db.prepare(`
      INSERT INTO Doctor (name, contact, address, qualification, specialization, isMarried, childrenCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
    `);

    db.transaction(() => {
      for (const doc of seedDoctors) {
        insertDoc.run(doc.name, doc.contact, doc.address, doc.qualification, doc.specialization);
      }
    })();

    doctors = db.prepare('SELECT id, name FROM Doctor').all();
    console.log(`Successfully seeded and fetched ${doctors.length} doctors.`);
  }

  // 2. Fetch pharmacies that have active sales in SalesTransaction
  const activePharmacies = db.prepare(`
    SELECT DISTINCT st.pharmacyId, p.name 
    FROM SalesTransaction st
    JOIN Pharmacy p ON st.pharmacyId = p.id
  `).all();

  console.log(`Found ${activePharmacies.length} pharmacies with active sales transactions.`);

  if (activePharmacies.length === 0) {
    console.warn('No active sales transactions found. Fetching general pharmacies instead.');
    const generalPharmacies = db.prepare('SELECT id, name FROM Pharmacy LIMIT 100').all();
    activePharmacies.push(...generalPharmacies);
  }

  // 3. Link up to 50 active pharmacies to random doctors
  const countToLink = Math.min(50, activePharmacies.length);
  console.log(`Linking ${countToLink} pharmacies to realistic doctors...`);

  const updatePharmacy = db.prepare('UPDATE Pharmacy SET doctorId = ?, updatedAt = datetime(\'now\') WHERE id = ?');

  let linkedCount = 0;
  db.transaction(() => {
    for (let i = 0; i < countToLink; i++) {
      const pharm = activePharmacies[i];
      // Randomly assign a doctor from our list
      const randomDoc = doctors[i % doctors.length];
      updatePharmacy.run(randomDoc.id, pharm.pharmacyId);
      linkedCount++;
    }
  })();

  console.log(`\n--- PHARMACY LINKING SUCCESSFUL ---`);
  console.log(`Successfully linked ${linkedCount} pharmacies to ${doctors.length} doctors!`);
  
  // Show a small sample of the links
  const sample = db.prepare(`
    SELECT p.name as pharmacyName, d.name as doctorName
    FROM Pharmacy p
    JOIN Doctor d ON p.doctorId = d.id
    LIMIT 10
  `).all();

  console.log('\nSample Links Established (First 10):');
  sample.forEach((row, idx) => {
    console.log(`${idx + 1}. [Pharmacy] ${row.pharmacyName} ---> [Doctor] ${row.doctorName}`);
  });
  console.log('------------------------------------\n');

  db.close();
  process.exit(0);

} catch (err) {
  console.error('Error linking pharmacies:', err);
  process.exit(1);
}
