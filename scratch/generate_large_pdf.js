import { jsPDF } from 'jspdf';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import pdfParse from 'pdf-parse';

const dbPath = path.resolve('data/suratpharma.db');
const db = new Database(dbPath);

const isNoiseLine = (line) => {
  const lower = line.toLowerCase();
  return lower.startsWith('party total') || 
         lower.startsWith('grand total') || 
         lower === 'total' || 
         lower === 'grandtotal' ||
         lower.includes('pharma distributors') ||
         lower.includes('surat dawa bazaar') ||
         lower.includes('vastadevdi road') ||
         lower.includes('katargam') ||
         lower.includes('6th floor') ||
         lower.includes('601 to 603') ||
         lower.includes('9898530808') ||
         lower.includes('0261') ||
         lower.includes('productfreefreeamt') ||
         (lower.includes('product') && lower.includes('amount') && lower.includes('free')) ||
         lower.includes('wise list report') ||
         lower.includes('product + party') ||
         lower.includes('page') ||
         /^\d+\/\d+$/.test(lower) ||
         (lower.startsWith('from:') && lower.includes('to:'));
};

// Helper to draw a bordered table row
function drawTableRow(doc, x, y, colWidths, texts, isHeader = false) {
  const rowHeight = 6;
  // Draw outer border for the row
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight);
  
  let currentX = x;
  doc.setFont('courier', isHeader ? 'bold' : 'normal');
  doc.setFontSize(9);
  
  for (let i = 0; i < colWidths.length; i++) {
    const width = colWidths[i];
    const text = texts[i] || '';
    
    // Draw vertical column separator (except for last cell)
    if (i < colWidths.length - 1) {
      doc.line(currentX + width, y, currentX + width, y + rowHeight);
    }
    
    // Position text inside cell
    doc.text(text, currentX + 1.5, y + 4.2);
    currentX += width;
  }
}

// Draw page headers
function drawPageHeader(doc, colWidths) {
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text('PHARMA DISTRIBUTORS', 10, 10);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text('601 TO 603 ,6TH FLOOR,,SURAT DAWA BAZAAR,VASTADEVDI ROAD,,KATARGAMSURAT', 10, 15);
  doc.text('0261 2452680,,9898530808', 10, 20);
  doc.text('From:20/02/2026 To:21/02/2026', 10, 25);
  doc.text('Product + Party Wise List Report', 10, 30);
  
  // Table Header Row
  drawTableRow(doc, 10, 35, colWidths, ['Product', 'Free', 'FreeAmt.', 'SaleQty.', 'Amount'], true);
}

async function run() {
  try {
    console.log('Fetching pharmacies and products from local DB...');
    const allPharmacies = db.prepare('SELECT name FROM Pharmacy').all()
      .map(r => r.name.replace(/[^\x20-\x7E]/g, '').trim())
      .filter(name => name.length > 0 && !isNoiseLine(name));
      
    const allProducts = db.prepare('SELECT name FROM Product').all()
      .map(r => r.name.replace(/[^\x20-\x7E]/g, '').trim())
      .filter(name => name.length > 0 && !isNoiseLine(name));
      
    console.log(`Loaded ${allPharmacies.length} pharmacies and ${allProducts.length} products.`);
    
    // Define column widths matching standard invoice layout
    const colWidths = [90, 20, 25, 20, 35]; // Sums to 190mm
    
    // We want a large PDF (~3-4 MB). Target 550 pharmacies.
    const targetPharmacyCount = 550;
    const selectedPharmacies = [];
    for (let i = 0; i < targetPharmacyCount; i++) {
      const phName = allPharmacies[i % allPharmacies.length];
      selectedPharmacies.push({
        name: `${phName} - TESTPH${i + 1}`,
        index: i
      });
    }
    
    console.log(`Generating sales report for ${selectedPharmacies.length} pharmacies...`);
    
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    
    // Draw first page header
    drawPageHeader(doc, colWidths);
    
    let y = 45;
    let expectedTotalAmount = 0;
    let expectedProductRowsCount = 0;
    
    for (const pharmacy of selectedPharmacies) {
      // Check page break for Pharmacy Header line (takes 6mm)
      if (y + 6 > 280) {
        doc.addPage();
        drawPageHeader(doc, colWidths);
        y = 45;
      }
      
      // Draw pharmacy name header line
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.text(pharmacy.name, 10, y + 4.2);
      y += 6;
      
      let freeSum = 0;
      let freeAmtSum = 0;
      let saleQtySum = 0;
      let amountSum = 0;
      
      const numProducts = 5 + (pharmacy.index % 3); // 5, 6, or 7 products
      
      for (let p = 0; p < numProducts; p++) {
        const prodName = allProducts[expectedProductRowsCount % allProducts.length];
        
        const free = (expectedProductRowsCount % 7 === 0) ? 1 : 0;
        const freeAmt = free * 42.50;
        const saleQty = 3 + (expectedProductRowsCount % 12);
        const amount = saleQty * 115.50;
        
        freeSum += free;
        freeAmtSum += freeAmt;
        saleQtySum += saleQty;
        amountSum += amount;
        
        expectedProductRowsCount++;
        expectedTotalAmount += amount;
        
        // Check page break for Product Row (takes 6mm)
        if (y + 6 > 280) {
          doc.addPage();
          drawPageHeader(doc, colWidths);
          y = 45;
        }
        
        drawTableRow(doc, 10, y, colWidths, [
          prodName,
          free.toFixed(2),
          freeAmt.toFixed(2),
          saleQty.toFixed(2),
          amount.toFixed(2)
        ]);
        y += 6;
      }
      
      // Check page break for Total Row (takes 6mm)
      if (y + 6 > 280) {
        doc.addPage();
        drawPageHeader(doc, colWidths);
        y = 45;
      }
      
      drawTableRow(doc, 10, y, colWidths, [
        'Party Total:',
        freeSum.toFixed(2),
        freeAmtSum.toFixed(2),
        saleQtySum.toFixed(2),
        amountSum.toFixed(2)
      ]);
      y += 6;
    }
    
    // Second Pass: Add page numbers at the bottom of each page
    const totalPages = doc.internal.getNumberOfPages();
    console.log(`Document has ${totalPages} pages. Adding page footers...`);
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.text(`${i}/${totalPages}`, 10, 290);
    }
    
    console.log('Writing PDF output as binary...');
    const pdfBinary = doc.output();
    fs.writeFileSync('test_sales_report.pdf', pdfBinary, 'binary');
    
    const stats = fs.statSync('test_sales_report.pdf');
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`PDF generated. File Size: ${fileSizeMB.toFixed(2)} MB (${stats.size} bytes).`);
    
    // Parse back to verify
    console.log('Verifying parsed content of the generated PDF...');
    const buf = fs.readFileSync('test_sales_report.pdf');
    const pdfData = await pdfParse(buf);
    const parsedText = pdfData.text || '';
    const parsedLines = parsedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let headerLineIdx = -1;
    for (let i = 0; i < Math.min(parsedLines.length, 30); i++) {
      const lower = parsedLines[i].toLowerCase();
      if (lower.includes('product') && lower.includes('amount')) {
        headerLineIdx = i;
        break;
      }
    }
    
    if (headerLineIdx !== -1) {
      const productRowRegex = /^(.+?)\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*(\d+[\d.,]*\.\d{2})\s*$/;
      let parsedProductCount = 0;
      let parsedTotalAmount = 0;
      
      for (let i = headerLineIdx + 1; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        const lower = line.toLowerCase();
        
        if (isNoiseLine(line)) continue;
        
        const match = productRowRegex.exec(line);
        if (match) {
          parsedProductCount++;
          parsedTotalAmount += parseFloat(match[5].replace(/,/g, ''));
        }
      }
      
      console.log('--- Verification Results ---');
      console.log(`Expected Product Rows: ${expectedProductRowsCount}, Parsed: ${parsedProductCount}`);
      console.log(`Expected Sales Amount: ₹${expectedTotalAmount.toFixed(2)}, Parsed: ₹${parsedTotalAmount.toFixed(2)}`);
      
      if (expectedProductRowsCount === parsedProductCount && Math.abs(expectedTotalAmount - parsedTotalAmount) < 0.01) {
        console.log('SUCCESS! Verification matched perfectly with 100% extraction accuracy!');
      } else {
        console.log('FAILURE! Verification mismatch.');
      }
    } else {
      console.log('Header line not found in verification phase.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
  db.close();
  process.exit(0);
}

run();
