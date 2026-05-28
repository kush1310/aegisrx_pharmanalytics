const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ProductPartyReport.xlsx');
console.log('Reading file:', filePath);
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const range = XLSX.utils.decode_range(sheet['!ref']);
console.log('Range:', range);

// Print first 15 rows
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('First 15 rows:');
for (let i = 0; i < Math.min(15, rows.length); i++) {
  console.log(`Row ${i}:`, rows[i]);
}
