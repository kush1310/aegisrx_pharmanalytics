import fs from 'fs';
import pdfParse from 'pdf-parse';

async function run() {
  try {
    const buf = fs.readFileSync('ProductPartyReport (1).pdf');
    const data = await pdfParse(buf);
    console.log('--- METADATA ---');
    console.log(data.info);
    console.log('--- CONTENT (First 1500 chars) ---');
    console.log(data.text.substring(0, 1500));
    console.log('--- LINES ---');
    const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total Lines:', lines.length);
    console.log('First 50 lines:');
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      console.log(`${i}: ${lines[i]}`);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
