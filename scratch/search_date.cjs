const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ProductPartyReport.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Search for any string that looks like a date or month/year in the entire sheet
for (let cellRef in sheet) {
  if (cellRef[0] === '!') continue;
  const val = sheet[cellRef].v;
  if (val && typeof val === 'string') {
    if (val.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|202\d)/i)) {
      console.log(`Found string in cell ${cellRef}:`, val);
    }
  }
}
