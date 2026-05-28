/**
 * Export Utilities — Professional PDF & CSV Generation
 *
 * Generates branded PDF documents using jsPDF with autoTable for
 * Analytics reports, Doctor profiles, and Pharmacy profiles. Each PDF
 * features a gradient header, branding, styled tables, and auto-pagination.
 * CSV export uses file-saver for client-side download.
 *
 * @module export
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

// Brand colors
const BRAND_INDIGO = [99, 102, 241] as const;      // #6366f1
const BRAND_DARK_INDIGO = [79, 70, 229] as const;  // #4f46e5
const BRAND_VIOLET = [139, 92, 246] as const;       // #8b5cf6
const TEXT_PRIMARY = [15, 23, 42] as const;         // #0f172a
const TEXT_SECONDARY = [100, 116, 139] as const;    // #64748b
const SURFACE_LIGHT = [248, 250, 252] as const;     // #f8fafc
const BORDER_COLOR = [226, 232, 240] as const;      // #e2e8f0

/**
 * addBrandedHeader
 *
 * Draws the SuratPharma branded gradient header band across the top
 * of the PDF page. Includes the company name and a subtitle line.
 *
 * @param {jsPDF}  doc      - The jsPDF document instance.
 * @param {string} title    - Main header title text.
 * @param {string} subtitle - Secondary info line below the title.
 */
const addBrandedHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const pageWidth = doc.internal.pageSize.width;

  // Gradient simulation with two overlapping rects
  doc.setFillColor(...BRAND_DARK_INDIGO);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...BRAND_INDIGO);
  doc.rect(0, 0, pageWidth * 0.6, 42, 'F');

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PharmaLens Analytics', 14, 10);

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 24);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 34);

  // Date on right
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 14, 34, { align: 'right' });
};

/**
 * addFooter
 *
 * Adds page numbers and brand watermark to every page of the document.
 *
 * @param {jsPDF} doc - The jsPDF document instance.
 */
const addFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    doc.setPage(pageIndex);

    // Separator line
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

    // Brand and page number
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('PharmaLens Analytics  |  Confidential', 14, pageHeight - 10);
    doc.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
};

/**
 * addSectionTitle
 *
 * Draws a section heading with a colored left accent bar.
 *
 * @param {jsPDF}  doc   - The jsPDF document instance.
 * @param {string} label - Section heading text.
 * @param {number} yPos  - Vertical position on the page.
 * @returns {number} Updated yPos after the section title.
 */
const addSectionTitle = (doc: jsPDF, label: string, yPos: number): number => {
  doc.setFillColor(...BRAND_INDIGO);
  doc.rect(14, yPos - 4, 3, 12, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(label, 20, yPos + 4);
  return yPos + 16;
};

/**
 * addKPIRow
 *
 * Renders a row of KPI metric boxes below the header. Each box has
 * a labeled value with a light background fill.
 *
 * @param {jsPDF}  doc     - The jsPDF document instance.
 * @param {Array}  metrics - Array of { label, value } objects.
 * @param {number} yPos    - Starting vertical position.
 * @returns {number} Updated yPos after the KPI row.
 */
const addKPIRow = (doc: jsPDF, metrics: { label: string; value: string }[], yPos: number): number => {
  const pageWidth = doc.internal.pageSize.width;
  const cardWidth = (pageWidth - 28 - (metrics.length - 1) * 6) / metrics.length;

  metrics.forEach((metric, cardIndex) => {
    const xPosition = 14 + cardIndex * (cardWidth + 6);

    // Card background
    doc.setFillColor(...SURFACE_LIGHT);
    doc.setDrawColor(...BORDER_COLOR);
    doc.roundedRect(xPosition, yPos, cardWidth, 24, 3, 3, 'FD');

    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(metric.value, xPosition + cardWidth / 2, yPos + 10, { align: 'center' });

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(metric.label, xPosition + cardWidth / 2, yPos + 19, { align: 'center' });
  });

  return yPos + 32;
};

// ===== PUBLIC EXPORTS =====

/**
 * exportToCSV
 *
 * Converts an array of data objects into a downloadable CSV file.
 * Handles special characters by wrapping values in double quotes.
 *
 * @param {any[]}    data     - Array of row objects.
 * @param {string}   filename - Output file name (without extension).
 * @param {string[]} headers  - Column header names (must match object keys).
 */
export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  const resolvedHeaders = headers || (data.length > 0 ? Object.keys(data[0]) : []);
  const headerRow = resolvedHeaders.join(',') + '\n';
  const rows = data.map(row => {
    return resolvedHeaders.map(header => {
      const value = row[header] !== undefined ? row[header] : '';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  }).join('\n');

  const csvContent = headerRow + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}.csv`);
};

/**
 * exportBusinessSummaryPDF
 *
 * Generates a professional multi-page PDF for the Doctor Business Summary table.
 * Each doctor section lists linked pharmacies and their revenue totals.
 * Medicine-wise breakdown is included as sub-rows under each pharmacy.
 *
 * @param {DoctorGroup[]} groups   - Doctor business groups from /api/excel/doctor-business
 * @param {object}        summary  - Aggregate totals (grandTotal, totalPharmacies, totalDoctors)
 */
export const exportBusinessSummaryPDF = async (
  groups: {
    doctorName:  string;
    grandTotal:  number;
    pharmacies:  {
      pharmacyName: string;
      totalAmount:  number;
      medicines:    { name: string; amount: number }[];
    }[];
  }[],
  summary: { grandTotal: number; totalPharmacies: number; totalDoctors: number }
) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  addBrandedHeader(doc, 'Doctor Business Summary', `Generated: ${today}  |  ${summary.totalDoctors} Doctors  |  ${summary.totalPharmacies} Pharmacies`);

  let currentY = 52;

  // KPI strip
  currentY = addKPIRow(doc, [
    { label: 'Grand Total Revenue', value: `RS. ${summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Total Doctors',       value: summary.totalDoctors.toString() },
    { label: 'Total Pharmacies',    value: summary.totalPharmacies.toString() },
  ], currentY);

  // Build flat rows for autotable with doctor grouping
  const tableBody: (string | number)[][] = [];

  for (const doctor of groups) {
    // Doctor header row
    tableBody.push([
      { content: doctor.doctorName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [238, 242, 255] as [number,number,number], textColor: [79, 70, 229] as [number,number,number] } } as any,
      { content: `RS. ${doctor.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [238, 242, 255] as [number,number,number], textColor: [79, 70, 229] as [number,number,number], halign: 'right' } } as any,
    ]);

    for (const pharmacy of doctor.pharmacies) {
      // Pharmacy row
      tableBody.push([
        '',
        pharmacy.pharmacyName,
        pharmacy.medicines.length > 0 ? `${pharmacy.medicines.length} medicine(s)` : 'No medicines linked',
        { content: `RS. ${pharmacy.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold' } } as any,
      ]);

      // Medicine breakdown rows
      for (const med of pharmacy.medicines) {
        tableBody.push([
          '',
          '',
          { content: `  ${med.name}`, styles: { textColor: [100, 116, 139] as [number,number,number], fontSize: 7 } } as any,
          { content: `RS. ${med.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right', fontSize: 7, textColor: [148, 163, 184] as [number,number,number] } } as any,
        ]);
      }
    }
  }

  // Grand total footer row
  tableBody.push([
    { content: 'GRAND TOTAL', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [15, 23, 42] as [number,number,number], textColor: [255,255,255] as [number,number,number] } } as any,
    { content: `RS. ${summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [15, 23, 42] as [number,number,number], textColor: [255,255,255] as [number,number,number], halign: 'right' } } as any,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Doctor', 'Pharmacy', 'Products', 'Amount']],
    body: tableBody,
    theme: 'grid',
    styles:    { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
    headStyles:{ fillColor: [...BRAND_DARK_INDIGO], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 48 },
      3: { halign: 'right', cellWidth: 32 },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`PharmaLens_Business_Summary_${dateStr}.pdf`);
};


/**
 * exportAnalyticsPDF
 *
 * Generates a multi-page branded PDF analytics report containing:
 * - KPI summary cards (Revenue, Units Sold, Free Goods, Pharmacies, Products)
 * - Top pharmacies table sorted by revenue with contribution percentages
 * - Top products table with sale quantities and free goods data
 *
 * @param {object}  stats         - Aggregate statistics from the analytics page.
 * @param {Array}   pharmacyData  - Top pharmacies with revenue and metrics.
 * @param {Array}   productData   - Top products with revenue and metrics.
 */
export const exportAnalyticsPDF = (
  stats: {
    totalRevenue: number;
    totalSaleQty?: number;
    totalFreeQty?: number;
    uniquePharmacies?: number;
    uniqueProducts?: number;
    doctorCount: number;
    fileName: string;
    date: string;
  },
  pharmacyData: { name: string; specialization: string; revenue: number; contribution: string }[],
  productData?: { name: string; saleQty: number; freeQty: number; revenue: number; contribution: string }[]
) => {
  const doc = new jsPDF();

  // Header
  addBrandedHeader(doc, 'Deep Analytics Report', `Source: ${stats.fileName}  |  Records: ${stats.doctorCount}`);

  // KPI Row
  let currentY = 52;
  currentY = addKPIRow(doc, [
    { label: 'Total Revenue', value: `RS. ${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: 'Units Sold', value: (stats.totalSaleQty || 0).toLocaleString() },
    { label: 'Free Goods', value: (stats.totalFreeQty || 0).toLocaleString() },
    { label: 'Pharmacies', value: (stats.uniquePharmacies || stats.doctorCount).toLocaleString() },
    { label: 'Products', value: (stats.uniqueProducts || 0).toLocaleString() }
  ], currentY);

  // Pharmacy Revenue Table
  currentY = addSectionTitle(doc, 'Pharmacy Revenue Breakdown', currentY);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Pharmacy', 'Revenue', 'Contribution']],
    body: pharmacyData.map((pharmacyItem, rowIndex) => [
      rowIndex + 1,
      pharmacyItem.name,
      `RS. ${pharmacyItem.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pharmacyItem.contribution
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
    headStyles: { fillColor: [...BRAND_INDIGO], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  // Product Revenue Table (if data provided)
  if (productData && productData.length > 0) {
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : currentY;
    const afterFirstTable = finalY + 12;

    // Check if we need a new page
    if (afterFirstTable > doc.internal.pageSize.height - 60) {
      doc.addPage();
      addBrandedHeader(doc, 'Deep Analytics Report', 'Product Revenue Breakdown (continued)');
      currentY = 52;
    } else {
      currentY = afterFirstTable;
    }

    currentY = addSectionTitle(doc, 'Product Revenue Breakdown', currentY);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Product', 'Sale Qty', 'Free Qty', 'Revenue', 'Share']],
      body: productData.map((productItem, rowIndex) => [
        rowIndex + 1,
        productItem.name,
        productItem.saleQty.toLocaleString(),
        productItem.freeQty.toLocaleString(),
        `RS. ${productItem.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        productItem.contribution
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
      headStyles: { fillColor: [...BRAND_VIOLET], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  addFooter(doc);
  doc.save(`SuratPharma_Analytics_${stats.date.replace(/\//g, '-')}.pdf`);
};

/**
 * exportProfilePDF
 *
 * Generates a branded PDF profile document for a single doctor. Includes
 * personal information, contact details, and a table of linked pharmacies
 * with their products.
 *
 * @param {object} doctor - Doctor record including pharmacies array.
 */
export const exportProfilePDF = (
  doctor: {
    name: string;
    specialization: string;
    qualification: string;
    contact: string;
    address: string;
    birthDate?: string | null;
    spouseName?: string | null;
    childrenNames?: string | null;
    pharmacies?: any[];
  }
) => {
  const doc = new jsPDF();

  addBrandedHeader(doc, `Dr. ${doctor.name}`, `${doctor.specialization}  |  ${doctor.qualification}`);

  let currentY = 52;

  // Contact Section
  currentY = addSectionTitle(doc, 'Contact Information', currentY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_PRIMARY);

  const contactDetails = [
    { label: 'Phone', value: doctor.contact || 'Not provided' },
    { label: 'Address', value: doctor.address || 'Not provided' }
  ];
  contactDetails.forEach(detail => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(detail.label, 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_PRIMARY);
    
    const maxTextWidth = doc.internal.pageSize.width - 50 - 14;
    const lines = doc.splitTextToSize(detail.value, maxTextWidth);
    doc.text(lines, 50, currentY);
    currentY += Math.max(8, lines.length * 5);
  });

  currentY += 6;

  // Personal Details
  currentY = addSectionTitle(doc, 'Personal Details', currentY);
  const personalEntries: { label: string; value: string }[] = [];

  if (doctor.birthDate) {
    personalEntries.push({ label: 'Birthday', value: new Date(doctor.birthDate).toLocaleDateString('en-IN') });
  }
  if (doctor.spouseName) {
    personalEntries.push({ label: 'Spouse', value: doctor.spouseName });
  }
  if (doctor.childrenNames) {
    try {
      const children = JSON.parse(doctor.childrenNames).join(', ');
      personalEntries.push({ label: 'Children', value: children });
    } catch (_parseError) { /* Silently skip malformed child data */ }
  }

  if (personalEntries.length > 0) {
    personalEntries.forEach(entry => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text(entry.label, 20, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_PRIMARY);
      
      const maxTextWidth = doc.internal.pageSize.width - 50 - 14;
      const lines = doc.splitTextToSize(entry.value, maxTextWidth);
      doc.text(lines, 50, currentY);
      currentY += Math.max(8, lines.length * 5);
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('No personal details recorded.', 20, currentY);
    currentY += 8;
  }

  currentY += 6;

  // Linked Pharmacies
  if (doctor.pharmacies && doctor.pharmacies.length > 0) {
    currentY = addSectionTitle(doc, `Linked Pharmacies (${doctor.pharmacies.length})`, currentY);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Pharmacy Name', 'Address', 'Contact']],
      body: doctor.pharmacies.map((pharmacyItem: any, pharmacyIndex: number) => [
        pharmacyIndex + 1,
        pharmacyItem.pharmacy?.name || pharmacyItem.name || 'Unknown',
        pharmacyItem.pharmacy?.address || pharmacyItem.address || '-',
        pharmacyItem.pharmacy?.contact || pharmacyItem.contact || '-'
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
      headStyles: { fillColor: [...BRAND_INDIGO], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 80 },
        3: { cellWidth: 40 }
      },
      margin: { left: 14, right: 14 }
    });
  }

  addFooter(doc);
  doc.save(`PharmaLens_Dr_${doctor.name.replace(/\s+/g, '_')}.pdf`);
};

/**
 * exportPharmacyPDF
 *
 * Generates a branded PDF profile for a single pharmacy, including
 * owner details, license information, and linked products table.
 *
 * @param {object} pharmacy - Pharmacy record including products array.
 */
export const exportPharmacyPDF = (
  pharmacy: {
    name: string;
    ownerName: string;
    licenseId: string;
    gstNumber?: string | null;
    drugLicense?: string | null;
    address: string;
    contact: string;
    ownerBirthDate?: string | null;
    doctor?: { name: string } | null;
    products?: { product: { name: string } }[];
  }
) => {
  const doc = new jsPDF();

  addBrandedHeader(doc, pharmacy.name, `Owner: ${pharmacy.ownerName}  |  License: ${pharmacy.licenseId}`);

  let currentY = 52;

  // Business Details
  currentY = addSectionTitle(doc, 'Business Details', currentY);

  const businessFields = [
    { label: 'License ID', value: pharmacy.licenseId },
    { label: 'GST Number', value: pharmacy.gstNumber || 'Not provided' },
    { label: 'Drug License', value: pharmacy.drugLicense || 'Not provided' },
    { label: 'Contact', value: pharmacy.contact || 'Not provided' },
    { label: 'Address', value: pharmacy.address || 'Not provided' },
    { label: 'Linked Doctor', value: pharmacy.doctor?.name || 'Not assigned' }
  ];

  businessFields.forEach(field => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(field.label, 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_PRIMARY);
    
    const maxTextWidth = doc.internal.pageSize.width - 60 - 14;
    const lines = doc.splitTextToSize(field.value, maxTextWidth);
    doc.text(lines, 60, currentY);
    currentY += Math.max(8, lines.length * 5);
  });

  currentY += 6;

  // Owner Details
  currentY = addSectionTitle(doc, 'Owner Details', currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text('Owner Name', 20, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_PRIMARY);
  
  const ownerNameLines = doc.splitTextToSize(pharmacy.ownerName, doc.internal.pageSize.width - 60 - 14);
  doc.text(ownerNameLines, 60, currentY);
  currentY += Math.max(8, ownerNameLines.length * 5);

  if (pharmacy.ownerBirthDate) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('Birthday', 20, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(new Date(pharmacy.ownerBirthDate).toLocaleDateString('en-IN'), 60, currentY);
    currentY += 8;
  }

  currentY += 6;

  // Product Catalogue
  if (pharmacy.products && pharmacy.products.length > 0) {
    currentY = addSectionTitle(doc, `Product Catalogue (${pharmacy.products.length})`, currentY);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Product Name']],
      body: pharmacy.products.map((productEntry, productIndex) => [
        productIndex + 1,
        productEntry.product?.name || 'Unknown'
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
      headStyles: { fillColor: [...BRAND_VIOLET], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
      columnStyles: { 0: { cellWidth: 15, halign: 'center' } },
      margin: { left: 14, right: 14 }
    });
  }

  addFooter(doc);
  doc.save(`PharmaLens_${pharmacy.name.replace(/\s+/g, '_')}.pdf`);
};

/**
 * exportDoctorListPDF
 *
 * Generates a branded PDF listing all doctors with their specializations,
 * contacts, and pharmacy counts. Used for the Doctors list page export.
 *
 * @param {Array} doctors - Array of doctor records.
 */
export const exportDoctorListPDF = (
  doctors: { name: string; specialization: string; qualification: string; contact: string; pharmacyCount: number }[]
) => {
  const doc = new jsPDF();

  addBrandedHeader(doc, 'Doctor Directory', `Total: ${doctors.length} doctors`);

  let currentY = 52;
  currentY = addKPIRow(doc, [
    { label: 'Total Doctors', value: doctors.length.toString() },
    { label: 'With Pharmacies', value: doctors.filter(doctorItem => doctorItem.pharmacyCount > 0).length.toString() },
    { label: 'Avg Pharmacies', value: (doctors.reduce((sum, doctorItem) => sum + doctorItem.pharmacyCount, 0) / (doctors.length || 1)).toFixed(1) }
  ], currentY);

  currentY = addSectionTitle(doc, 'Complete Doctor List', currentY);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Doctor Name', 'Specialization', 'Qualification', 'Contact', 'Pharmacies']],
    body: doctors.map((doctorItem, doctorIndex) => [
      doctorIndex + 1,
      doctorItem.name,
      doctorItem.specialization,
      doctorItem.qualification,
      doctorItem.contact,
      doctorItem.pharmacyCount
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
    headStyles: { fillColor: [...BRAND_INDIGO], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 40 },
      5: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  addFooter(doc);
  doc.save(`PharmaLens_Doctors_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * exportPharmacyListPDF
 *
 * Generates a branded PDF listing all pharmacies with owners, license IDs,
 * contacts, and product counts. Used for the Pharmacies list page export.
 *
 * @param {Array} pharmacies - Array of pharmacy records.
 */
export const exportPharmacyListPDF = (
  pharmacies: { name: string; ownerName: string; licenseId: string; contact: string; productCount: number }[]
) => {
  const doc = new jsPDF();

  addBrandedHeader(doc, 'Pharmacy Directory', `Total: ${pharmacies.length} pharmacies`);

  let currentY = 52;
  currentY = addKPIRow(doc, [
    { label: 'Total Pharmacies', value: pharmacies.length.toString() },
    { label: 'With Products', value: pharmacies.filter(pharmacyItem => pharmacyItem.productCount > 0).length.toString() },
    { label: 'Total Products Linked', value: pharmacies.reduce((sum, pharmacyItem) => sum + pharmacyItem.productCount, 0).toString() }
  ], currentY);

  currentY = addSectionTitle(doc, 'Complete Pharmacy List', currentY);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Pharmacy Name', 'Owner', 'License ID', 'Contact', 'Products']],
    body: pharmacies.map((pharmacyItem, pharmacyIndex) => [
      pharmacyIndex + 1,
      pharmacyItem.name,
      pharmacyItem.ownerName,
      pharmacyItem.licenseId,
      pharmacyItem.contact,
      pharmacyItem.productCount
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
    headStyles: { fillColor: [...BRAND_VIOLET], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 35 },
      4: { cellWidth: 35 },
      5: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  addFooter(doc);
  doc.save(`PharmaLens_Pharmacies_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * exportProductListPDF
 *
 * Generates a branded PDF listing all products.
 *
 * @param {Array} products - Array of product records.
 */
export const exportProductListPDF = (
  products: { name: string; pharmacyCount: number }[]
) => {
  const doc = new jsPDF();

  addBrandedHeader(doc, 'Product Directory', `Total: ${products.length} products`);

  let currentY = 52;
  currentY = addKPIRow(doc, [
    { label: 'Total Products', value: products.length.toString() },
    { label: 'With Pharmacies', value: products.filter(p => p.pharmacyCount > 0).length.toString() },
    { label: 'Total Links', value: products.reduce((s, p) => s + p.pharmacyCount, 0).toString() }
  ], currentY);

  currentY = addSectionTitle(doc, 'Complete Product List', currentY);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Product Name', 'Pharmacies']],
    body: products.map((item, idx) => [
      idx + 1,
      item.name,
      item.pharmacyCount
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, lineColor: [...BORDER_COLOR], lineWidth: 0.3 },
    headStyles: { fillColor: [...BRAND_VIOLET], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [...SURFACE_LIGHT] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 130 },
      2: { cellWidth: 40, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  });

  addFooter(doc);
  doc.save(`PharmaLens_Products_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
};
