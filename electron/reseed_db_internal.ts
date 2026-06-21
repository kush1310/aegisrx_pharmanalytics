import { getSqlite } from './db/index';
import crypto from 'crypto';
import xlsx from 'xlsx';
import path from 'path';

function hashPassword(password: string): string {
  const salt = 'suratpharma_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function randomDate(startYear: number, endYear: number): string {
  const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomSafeDate(startYear: number, endYear: number): string {
  let d = randomDate(startYear, endYear);
  while (d.substring(5) === '06-20' || d.substring(5) === '06-21' || d.substring(5) === '06-22') {
    d = randomDate(startYear, endYear);
  }
  return d;
}

export async function reseedDatabaseInternal() {
  console.log('[Reseed] Starting internal database reseed...');
  const db = getSqlite();

  // 1. Truncate all tables
  console.log('[Reseed] Clearing database tables...');
  db.exec('DELETE FROM SalesTransaction;');
  db.exec('DELETE FROM PharmacyProduct;');
  db.exec('DELETE FROM DoctorProduct;');
  db.exec('DELETE FROM Pharmacy;');
  db.exec('DELETE FROM Doctor;');
  db.exec('DELETE FROM Product;');
  db.exec('DELETE FROM ExcelUpload;');
  db.exec('DELETE FROM Notification;');
  db.exec('DELETE FROM DismissedNotification;');
  db.exec('DELETE FROM User;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('SalesTransaction', 'PharmacyProduct', 'DoctorProduct', 'Pharmacy', 'Doctor', 'Product', 'ExcelUpload', 'Notification', 'DismissedNotification', 'User');");

  // 2. Insert admin user
  console.log('[Reseed] Seeding login credentials (bhavesh@gmail.com / kush1111)...');
  const insertUser = db.prepare(`
    INSERT INTO User (username, prefix, firstName, lastName, birthDate, email, passwordHash, role, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  insertUser.run(
    'bhavesh@gmail.com',
    'Mr.',
    'Bhavesh',
    'Patel',
    '1995-10-15',
    'bhavesh@gmail.com',
    hashPassword('kush1111'),
    'ADMIN'
  );

  // 3. Extract pharmacies and products from ProductPartyReport.xlsx
  console.log('[Reseed] Extracting pharmacies and products from ProductPartyReport.xlsx...');
  const workbook = xlsx.readFile(path.join(process.cwd(), 'ProductPartyReport.xlsx'));
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  const excelPharmNames: string[] = [];
  const excelProdNames = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    if (row.length === 1 && typeof row[0] === 'string') {
      const val = row[0].trim();
      if (val && val !== 'Product' && !val.includes('Total:')) {
        excelPharmNames.push(val);
      }
    } else if (row.length === 5 && typeof row[0] === 'string') {
      const val = row[0].trim();
      if (val && val !== 'Product' && !val.includes('Total:')) {
        excelProdNames.add(val.toUpperCase());
      }
    }
  }
  console.log(`[Reseed] Extracted ${excelPharmNames.length} pharmacies and ${excelProdNames.size} products from Excel.`);

  // 4. Seed Products
  console.log('[Reseed] Seeding products...');
  const insertProduct = db.prepare(`
    INSERT INTO Product (name, pack, createdAt, updatedAt)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `);
  for (const prodName of excelProdNames) {
    insertProduct.run(prodName, '1x10');
  }

  // 5. Generate 700 Doctors
  console.log('[Reseed] Generating 700 unique doctors...');
  const firstNames = ['Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Ishaan', 'Kabir', 'Neha', 'Rahul', 'Pooja', 'Siddharth', 'Aditya', 'Rohan', 'Amit', 'Sanjay', 'Vikram', 'Anil', 'Sunil', 'Vijay', 'Rajesh', 'Suresh', 'Mahesh', 'Dinesh', 'Ramesh', 'Harish', 'Karan', 'Arjun', 'Dev', 'Kavya', 'Riya', 'Aisha', 'Meera', 'Gita', 'Radha', 'Krina', 'Ishan', 'Kush', 'Bhavesh', 'Ketan', 'Nilesh', 'Paresh', 'Hitesh', 'Dharmesh'];
  const lastNames = ['Patel', 'Shah', 'Mehta', 'Sharma', 'Joshi', 'Verma', 'Gupta', 'Singh', 'Trivedi', 'Vyas', 'Shastri', 'Dave', 'Desai', 'Naik', 'Pandya', 'Rao', 'Reddy', 'Choudhury', 'Sen', 'Das', 'Roy', 'Mishra', 'Prasad', 'Yadav', 'Giri', 'Puri', 'Malhotra', 'Kapoor', 'Khanna', 'Bose', 'Chatterjee', 'Banerjee', 'Mukherjee'];
  
  const docNames: string[] = [];
  for (const f of firstNames) {
    for (const l of lastNames) {
      docNames.push(`${f} ${l}`);
    }
  }

  const specializations = ['General Physician', 'Cardiologist', 'Orthopedic Surgeon', 'Pediatrician', 'Dermatologist', 'Neurologist', 'Psychiatrist', 'Gynecologist', 'ENT Specialist', 'Ophthalmologist'];
  const qualifications = ['MBBS', 'MD', 'MS', 'MBBS, MD', 'MBBS, MS', 'BDS', 'BAMS', 'BHMS'];

  const insertDoctor = db.prepare(`
    INSERT INTO Doctor (
      name, contact, address, birthDate, isMarried, spouseName, spouseBirthDate, anniversary,
      childrenCount, childrenNames, qualification, specialization, email, registrationNo, experienceYrs,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (let i = 0; i < 700; i++) {
    const name = `Dr. ${docNames[i]}`;
    const contact = `9898${String(i).padStart(6, '0')}`;
    const address = `Plot ${i + 1}, VIP Road, Vesu, Surat - 395007`;
    const qual = qualifications[i % qualifications.length];
    const spec = specializations[i % specializations.length];
    const email = `dr.${docNames[i].toLowerCase().replace(/\s+/g, '.')}@aegisrx.com`;
    const regNo = `G-${10000 + i}`;
    const exp = (i % 35) + 1;

    let birthDate = randomSafeDate(1960, 2000);
    let isMarried = true;
    let spouseName: string | null = null;
    let spouseBirthDate: string | null = null;
    let anniversary: string | null = null;
    let childrenCount = 0;
    let childrenNames: string | null = null;

    // Distribute doctors into categories:
    // Total 700:
    // - 150 single (no spouse, no children): indices 200 to 349
    // - 100 married, no children: indices 100 to 199
    // - 450 married with spouse and children: indices 0 to 99, 350 to 699
    if (i >= 200 && i < 350) {
      isMarried = false;
    } else if (i >= 100 && i < 200) {
      isMarried = true;
      spouseName = `Meera ${docNames[i].split(' ')[1]}`;
      spouseBirthDate = randomSafeDate(1965, 2002);
      anniversary = randomSafeDate(1995, 2024);
    } else {
      isMarried = true;
      spouseName = `Meera ${docNames[i].split(' ')[1]}`;
      spouseBirthDate = randomSafeDate(1965, 2002);
      anniversary = randomSafeDate(1995, 2024);
      childrenCount = (i % 2) + 1;
      const children = [];
      for (let c = 0; c < childrenCount; c++) {
        children.push({
          name: c === 0 ? 'DEV' : 'KAVYA',
          birthDate: randomSafeDate(2005, 2020)
        });
      }
      childrenNames = JSON.stringify(children);
    }

    // Force specific birthdays/anniversaries for notification tests:
    if (i === 0) {
      birthDate = '1980-06-20'; // Today
    } else if (i === 1) {
      birthDate = '1985-06-21'; // Tomorrow
    } else if (i === 2) {
      birthDate = '1975-06-22'; // Day After Tomorrow
    } else if (i === 3) {
      isMarried = true;
      spouseName = 'Meera Patel';
      spouseBirthDate = '1988-06-20'; // Spouse Birthday Today
    } else if (i === 4) {
      isMarried = true;
      spouseName = 'Meera Patel';
      spouseBirthDate = '1989-10-10';
      childrenCount = 2;
      childrenNames = JSON.stringify([
        { name: 'DEV', birthDate: '2015-06-21' }, // Child Birthday Tomorrow!
        { name: 'KAVYA', birthDate: '2010-06-01' }
      ]);
    } else if (i === 5) {
      isMarried = true;
      spouseName = 'Meera Patel';
      anniversary = '2012-06-22'; // Anniversary Day After Tomorrow
    } else if (i === 6) {
      birthDate = '1990-06-20'; // Doctor Birthday Today
      isMarried = true;
      spouseName = 'Meera Patel';
      anniversary = '2018-06-20'; // Anniversary Today
    }

    insertDoctor.run(
      name,
      contact,
      address,
      birthDate,
      isMarried ? 1 : 0,
      spouseName,
      spouseBirthDate,
      anniversary,
      childrenCount,
      childrenNames,
      qual,
      spec,
      email,
      regNo,
      exp
    );
  }
  console.log('[Reseed] Seeded 700 Doctors successfully.');

  // 6. Generate 15,000 Pharmacies
  console.log('[Reseed] Generating 15,000 pharmacies...');
  const insertPharmacy = db.prepare(`
    INSERT INTO Pharmacy (
      name, ownerName, licenseId, gstNumber, drugLicense, address, contact, ownerBirthDate, doctorId, isDraft,
      primaryContact, secondaryContact, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const ownerFirstNames = ['Rajesh', 'Sanjay', 'Mukesh', 'Ketan', 'Nilesh', 'Dilip', 'Vijay', 'Bharat', 'Harish', 'Manish', 'Paresh', 'Ketan', 'Paresh', 'Jatin', 'Kamlesh', 'Vipul'];
  const ownerLastNames = ['Patel', 'Shah', 'Mehta', 'Joshi', 'Choksi', 'Gajjar', 'Gandhi', 'Desai', 'Mistry', 'Soni', 'Vashi', 'Solanki'];

  // Seed the 259 Excel pharmacies first to map them randomly
  console.log('[Reseed] Seeding 259 Excel pharmacies...');
  for (let i = 0; i < excelPharmNames.length; i++) {
    const name = excelPharmNames[i];
    const ownerName = `${ownerFirstNames[i % ownerFirstNames.length]} ${ownerLastNames[i % ownerLastNames.length]}`;
    const licenseId = `DL-EXCEL-${String(i + 1).padStart(5, '0')}`;
    const gstNumber = `24${crypto.randomBytes(5).toString('hex').toUpperCase()}1Z${i % 10}`;
    const drugLicense = `DL/SURAT/${10000 + i}`;
    const address = `Shop ${i + 1}, Ground Floor, Shreeji Complex, Adajan, Surat - 395009`;
    const contact = `98765${String(i).padStart(5, '0')}`;
    const doctorId = Math.floor(Math.random() * 700) + 1;
    
    let ownerBirthDate = randomSafeDate(1965, 2000);
    if (i === 10) ownerBirthDate = '1978-06-20'; // Today
    if (i === 20) ownerBirthDate = '1982-06-21'; // Tomorrow
    if (i === 30) ownerBirthDate = '1976-06-22'; // Day After Tomorrow

    const primaryContact = contact;
    const secondaryContact = `91234${String(i).padStart(5, '0')}`;

    insertPharmacy.run(
      name,
      ownerName,
      licenseId,
      gstNumber,
      drugLicense,
      address,
      contact,
      ownerBirthDate,
      doctorId,
      0, // isDraft = false
      primaryContact,
      secondaryContact
    );
  }

  // Seed the remaining 14,741 dummy pharmacies
  console.log('[Reseed] Seeding remaining 14,741 dummy pharmacies...');
  const batchSize = 1000;
  db.exec('BEGIN TRANSACTION;');
  for (let i = 0; i < 14741; i++) {
    const idx = excelPharmNames.length + i;
    const name = `SAI PHARMACY ${i + 1}`;
    const ownerName = `${ownerFirstNames[idx % ownerFirstNames.length]} ${ownerLastNames[idx % ownerLastNames.length]}`;
    const licenseId = `DL-DUMMY-${String(i + 1).padStart(5, '0')}`;
    const gstNumber = `24${crypto.randomBytes(5).toString('hex').toUpperCase()}1Z${i % 10}`;
    const drugLicense = `DL/SURAT/${20000 + i}`;
    const address = `Plot ${i + 100}, GIDC Industrial Estate, Sachin, Surat - 394230`;
    const contact = `98250${String(i % 100000).padStart(5, '0')}`;
    const ownerBirthDate = randomSafeDate(1965, 2000);
    const doctorId = Math.floor(Math.random() * 700) + 1;

    const primaryContact = i % 3 === 0 ? contact : `97240${String(i % 100000).padStart(5, '0')}`;
    const secondaryContact = i % 4 === 0 ? `90990${String(i % 100000).padStart(5, '0')}` : null;

    insertPharmacy.run(
      name,
      ownerName,
      licenseId,
      gstNumber,
      drugLicense,
      address,
      contact,
      ownerBirthDate,
      doctorId,
      0,
      primaryContact,
      secondaryContact
    );

    if (i > 0 && i % batchSize === 0) {
      db.exec('COMMIT; BEGIN TRANSACTION;');
    }
  }
  db.exec('COMMIT;');
  console.log('[Reseed] Seeded all 15,000 pharmacies successfully!');
  console.log('[Reseed] Database re-seeding completed successfully!');
}
