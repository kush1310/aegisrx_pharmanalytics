/**
 * Export Utilities — Professional HTML-to-PDF & CSV Generation
 *
 * Generates beautiful, print-optimized reports by compiling data into structured
 * HTML templates using the corporate design system and converting them to PDFs
 * via the local server's Electron-based print engine.
 *
 * @module export
 */
import { saveAs } from 'file-saver';

// Design specification tokens
const COLOR_PRIMARY = '#1A365D';    // Deep Corporate Blue
const COLOR_SECONDARY = '#2B6CB0';  // Lighter Blue
const COLOR_TEXT = '#2D3748';       // Dark Slate
const COLOR_BG_EVEN = '#E2E8F0';    // Soft Gray for alternating rows
const COLOR_BORDER = '#CBD5E0';     // Gray border lines

/**
 * downloadPDFFromHTML
 *
 * Sends the generated HTML payload to the backend Hono print endpoint,
 * retrieves the compiled PDF binary file, and saves it.
 *
 * @param {string} html     - Render-ready HTML/CSS template string.
 * @param {string} filename - Output name for the PDF file.
 */
const downloadPDFFromHTML = async (html: string, filename: string) => {
  const token = sessionStorage.getItem('sp_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch('http://localhost:3001/api/excel/print-pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify({ html, filename })
    });
    if (!res.ok) {
      throw new Error('Failed to generate PDF');
    }
    const blob = await res.blob();
    saveAs(blob, filename);
  } catch (err) {
    console.error('[PDF Export Client Error]', err);
    throw err;
  }
};

/**
 * wrapHtmlTemplate
 *
 * Wraps report content inside a standard A4 print-optimized shell with styling.
 *
 * @param {string} title    - Main title of the report.
 * @param {string} subtitle - Context description subtitle.
 * @param {string} bodyHtml - Main report table or details grid.
 * @returns {string} Fully styled HTML document.
 */
/**
 * wrapHtmlTemplate
 *
 * Compiles a standard print-optimized HTML shell for A4 reports. Integrates the
 * brand colors, headers, and footer elements. Configures both Tailwind CSS (via CDN)
 * and an inline stylesheet containing offline fallbacks of required utility classes.
 *
 * @param  {string} title    - Main header title of the report (e.g. "Doctor Directory").
 * @param  {string} subtitle - Secondary description subtitle text.
 * @param  {string} bodyHtml - Main tabular or detail grid report content.
 * @returns {string}         - The fully compiled, ready-to-render HTML document string.
 * @validates                - Title and subtitle strings must be sanitized.
 * @edge-cases               - Fallback system fonts resolve if the Inter font fails to load.
 */
const wrapHtmlTemplate = (title: string, subtitle: string, bodyHtml: string): string => {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brandPrimary: '#1A365D',
            brandSecondary: '#2B6CB0',
            brandAccent: '#E2E8F0',
            brandText: '#2D3748'
          }
        }
      }
    }
  </script>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', sans-serif;
      color: ${COLOR_TEXT};
      margin: 0;
      padding: 0;
      line-height: 1.5;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
    }
    
    /* Fallback utility classes for offline mode rendering */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .justify-between { justify-content: space-between; }
    .items-end { align-items: flex-end; }
    .items-center { align-items: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .w-full { width: 100%; }
    .h-full { height: 100%; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .border-b { border-bottom: 1px solid ${COLOR_BORDER}; }
    .border-l-3 { border-left: 3px solid ${COLOR_SECONDARY}; }
    .text-slate-500 { color: #64748B; }
    
    .bg-\[\#F8FAFC\] { background-color: #F8FAFC; }
    .bg-\[\#EEF2FF\] { background-color: #EEF2FF; }
    .bg-\[\#1A365D\] { background-color: ${COLOR_PRIMARY}; }
    .bg-\[\#2B6CB0\] { background-color: ${COLOR_SECONDARY}; }
    .bg-\[\#E2E8F0\] { background-color: ${COLOR_BG_EVEN}; }
    .bg-white { background-color: #FFFFFF; }
    
    .text-\[\#1A365D\] { color: ${COLOR_PRIMARY}; }
    .text-\[\#2B6CB0\] { color: ${COLOR_SECONDARY}; }
    .text-\[\#2D3748\] { color: ${COLOR_TEXT}; }
    .text-white { color: #FFFFFF; }
    
    .pl-6 { padding-left: 24px; }
    .pl-12 { padding-left: 48px; }
    .text-\[8\.5px\] { font-size: 8.5px; }
    .text-\[9px\] { font-size: 9px; }
    .uppercase { text-transform: uppercase; }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid ${COLOR_PRIMARY};
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header-left {
      display: flex;
      flex-direction: column;
    }
    .brand {
      font-size: 13px;
      font-weight: 800;
      color: ${COLOR_PRIMARY};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .subtitle {
      font-size: 9px;
      color: ${COLOR_SECONDARY};
      margin-top: 4px;
      font-weight: 500;
    }
    .header-right {
      display: flex;
      flex-direction: column;
      text-align: right;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: ${COLOR_PRIMARY};
    }
    .date {
      font-size: 8px;
      color: #64748B;
      margin-top: 4px;
    }
    .kpi-container {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid ${COLOR_BG_EVEN};
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 700;
      color: ${COLOR_PRIMARY};
    }
    .kpi-label {
      font-size: 8px;
      text-transform: uppercase;
      color: ${COLOR_SECONDARY};
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: ${COLOR_PRIMARY};
      border-left: 3px solid ${COLOR_SECONDARY};
      padding-left: 8px;
      margin-top: 24px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background-color: ${COLOR_SECONDARY};
      color: #FFFFFF;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      padding: 8px 12px;
      text-align: left;
    }
    td {
      padding: 8px 12px;
      font-size: 9px;
      border-bottom: 1px solid ${COLOR_BORDER};
      color: ${COLOR_TEXT};
    }
    tr:nth-child(even) {
      background-color: ${COLOR_BG_EVEN};
    }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: 700; }
    .doctor-row {
      background-color: #EEF2FF !important;
      font-weight: 700;
      color: ${COLOR_PRIMARY};
    }
    .pharmacy-row {
      font-weight: 600;
      color: ${COLOR_SECONDARY};
    }
    .indent-1 {
      padding-left: 24px;
    }
    .indent-2 {
      padding-left: 48px;
    }
    .medicine-text {
      color: #64748B;
      font-size: 8.5px;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 15mm;
      right: 15mm;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #64748B;
      border-top: 1px solid ${COLOR_BG_EVEN};
      padding-top: 8px;
      background: #FFFFFF;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .details-section {
      background: #F8FAFC;
      border: 1px solid ${COLOR_BG_EVEN};
      border-radius: 8px;
      padding: 16px;
    }
    .details-title {
      font-size: 10px;
      font-weight: 700;
      color: ${COLOR_PRIMARY};
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .details-row {
      display: flex;
      margin-bottom: 8px;
      font-size: 9px;
    }
    .details-label {
      width: 120px;
      font-weight: 600;
      color: #64748B;
    }
    .details-value {
      flex: 1;
      color: ${COLOR_TEXT};
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="brand">AegisRx Analytics</span>
      <span class="subtitle">${subtitle}</span>
    </div>
    <div class="header-right">
      <span class="title">${title}</span>
      <span class="date">Printed: ${today}</span>
    </div>
  </div>

  ${bodyHtml}

  <div class="footer">
    <span>AegisRx Analytics | Confidential Report</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>
  `;
};

// ===== PUBLIC EXPORTS =====

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
 * Compiles grouped doctor, pharmacy, and medicine sales data into a beautifully
 * structured hierarchical HTML report. Uses a 4-column layout to naturally indent
 * linked pharmacies and products sold, and formats values in Indian national Rupees.
 * Sends the compiled HTML to the local backend Hono API print engine to generate
 * and download the A4 print-ready PDF file.
 *
 * @param  {Array}  groups   - Grouped doctor data containing linked pharmacies and medicines.
 * @param  {Object} summary  - KPI summaries: grandTotal, totalPharmacies, totalDoctors.
 * @returns {Promise<void>}  - Resolves when the PDF binary is fetched and saved.
 * @validates                - Groups array must contain populated doctor objects.
 * @edge-cases               - Empty data yields a grand total of zero.
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
  const kpis = `
    <div class="kpi-container flex gap-3 mb-6">
      <div class="kpi-card flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center">
        <div class="kpi-value text-base font-bold text-[#1A365D]">RS. ${summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label text-[8px] uppercase text-[#2B6CB0] font-semibold tracking-wider mt-1">Grand Total Revenue</div>
      </div>
      <div class="kpi-card flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center">
        <div class="kpi-value text-base font-bold text-[#1A365D]">${summary.totalDoctors}</div>
        <div class="kpi-label text-[8px] uppercase text-[#2B6CB0] font-semibold tracking-wider mt-1">Total Doctors</div>
      </div>
      <div class="kpi-card flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-center">
        <div class="kpi-value text-base font-bold text-[#1A365D]">${summary.totalPharmacies}</div>
        <div class="kpi-label text-[8px] uppercase text-[#2B6CB0] font-semibold tracking-wider mt-1">Total Pharmacies</div>
      </div>
    </div>
  `;

  let tableRows = '';
  for (const doctor of groups) {
    // Doctor row: only Doctor Name (column 1) and Grand Total (column 4) are populated.
    tableRows += `
      <tr class="doctor-row bg-[#EEF2FF] font-bold text-[#1A365D]">
        <td class="font-bold border-b border-[#CBD5E0] py-2 px-3">${doctor.doctorName}</td>
        <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
        <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
        <td class="text-right font-bold border-b border-[#CBD5E0] py-2 px-3">RS. ${doctor.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;

    for (const pharmacy of doctor.pharmacies) {
      // Pharmacy row: only Pharmacy Name (column 2) and Total Amount (column 4) are populated.
      tableRows += `
        <tr class="pharmacy-row bg-white font-semibold text-[#2B6CB0]">
          <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
          <td class="font-semibold border-b border-[#CBD5E0] py-2 px-3">${pharmacy.pharmacyName}</td>
          <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
          <td class="text-right font-semibold border-b border-[#CBD5E0] py-2 px-3">RS. ${pharmacy.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;

      for (const med of pharmacy.medicines) {
        // Product row: only Product Name (column 3) and Amount (column 4) are populated.
        tableRows += `
          <tr class="product-row bg-white text-[#2D3748]">
            <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
            <td class="border-b border-[#CBD5E0] py-2 px-3"></td>
            <td class="text-slate-500 text-[8.5px] border-b border-[#CBD5E0] py-2 px-3">${med.name}</td>
            <td class="text-right text-slate-500 text-[8.5px] border-b border-[#CBD5E0] py-2 px-3">RS. ${med.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      }
    }
  }

  // Grand Total row: spans columns 1-3.
  tableRows += `
    <tr class="bg-[#1A365D] text-white font-bold">
      <td colspan="3" class="font-bold py-2 px-3">GRAND TOTAL</td>
      <td class="text-right font-bold py-2 px-3">RS. ${summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `;

  const bodyHtml = `
    ${kpis}
    <div class="section-title text-[11px] font-bold text-[#1A365D] border-l-3 border-[#2B6CB0] pl-2 mt-6 mb-3 uppercase tracking-wider">Complete Business Summary</div>
    <table class="w-full border-collapse mb-6">
      <thead>
        <tr class="bg-[#2B6CB0] text-white">
          <th style="width: 30%" class="text-left font-semibold text-[9px] uppercase py-2 px-3">Doctor</th>
          <th style="width: 25%" class="text-left font-semibold text-[9px] uppercase py-2 px-3">Pharmacy</th>
          <th style="width: 25%" class="text-left font-semibold text-[9px] uppercase py-2 px-3">Product</th>
          <th style="width: 20%; text-align: right;" class="text-right font-semibold text-[9px] uppercase py-2 px-3">Revenue (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  const html = wrapHtmlTemplate('Doctor Business Summary', 'Sales Intelligence & Grouped Revenue Details', bodyHtml);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadPDFFromHTML(html, `AegisRx_Business_Summary_${dateStr}.pdf`);
};

export const exportAnalyticsPDF = async (
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
  const kpis = `
    <div class="kpi-container">
      <div class="kpi-card">
        <div class="kpi-value">RS. ${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-label">Total Revenue</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(stats.totalSaleQty || 0).toLocaleString()}</div>
        <div class="kpi-label">Units Sold</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(stats.totalFreeQty || 0).toLocaleString()}</div>
        <div class="kpi-label">Free Goods</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(stats.uniquePharmacies || stats.doctorCount).toLocaleString()}</div>
        <div class="kpi-label">Pharmacies</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${(stats.uniqueProducts || 0).toLocaleString()}</div>
        <div class="kpi-label">Products</div>
      </div>
    </div>
  `;

  let pharmacyRows = '';
  pharmacyData.forEach((ph, idx) => {
    pharmacyRows += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td>${ph.name}</td>
        <td class="text-right">RS. ${ph.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-right">${ph.contribution}</td>
      </tr>
    `;
  });

  let productSection = '';
  if (productData && productData.length > 0) {
    let productRows = '';
    productData.forEach((prod, idx) => {
      productRows += `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${prod.name}</td>
          <td class="text-right">${prod.saleQty.toLocaleString()}</td>
          <td class="text-right">${prod.freeQty.toLocaleString()}</td>
          <td class="text-right">RS. ${prod.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-right">${prod.contribution}</td>
        </tr>
      `;
    });

    productSection = `
      <div class="section-title">Product Revenue Breakdown</div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">#</th>
            <th style="width: 42%">Product Name</th>
            <th style="width: 12%; text-align: right;">Sale Qty</th>
            <th style="width: 12%; text-align: right;">Free Qty</th>
            <th style="width: 16%; text-align: right;">Revenue</th>
            <th style="width: 10%; text-align: right;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    `;
  }

  const bodyHtml = `
    ${kpis}
    <div class="section-title">Pharmacy Revenue Breakdown</div>
    <table>
      <thead>
        <tr>
          <th style="width: 8%; text-align: center;">#</th>
          <th style="width: 52%">Pharmacy Name</th>
          <th style="width: 25%; text-align: right;">Revenue</th>
          <th style="width: 15%; text-align: right;">Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${pharmacyRows}
      </tbody>
    </table>

    ${productSection}
  `;

  const html = wrapHtmlTemplate('Deep Analytics Report', `Source: ${stats.fileName}  |  Records: ${stats.doctorCount}`, bodyHtml);
  await downloadPDFFromHTML(html, `AegisRx_Analytics_${stats.date.replace(/\//g, '-')}.pdf`);
};

export const exportProfilePDF = async (
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
  let personalDetailsHtml = 'No personal details recorded.';
  if (doctor.birthDate || doctor.spouseName || doctor.childrenNames) {
    let childrenText = '-';
    if (doctor.childrenNames) {
      try {
        childrenText = JSON.parse(doctor.childrenNames).join(', ');
      } catch {
        childrenText = doctor.childrenNames;
      }
    }

    personalDetailsHtml = `
      <div class="details-row">
        <div class="details-label">Birthday</div>
        <div class="details-value">${doctor.birthDate ? new Date(doctor.birthDate).toLocaleDateString('en-IN') : '-'}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Spouse Name</div>
        <div class="details-value">${doctor.spouseName || '-'}</div>
      </div>
      <div class="details-row">
        <div class="details-label">Children</div>
        <div class="details-value">${childrenText}</div>
      </div>
    `;
  }

  let pharmaciesRows = '';
  if (doctor.pharmacies && doctor.pharmacies.length > 0) {
    doctor.pharmacies.forEach((ph: any, idx: number) => {
      pharmaciesRows += `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${ph.pharmacy?.name || ph.name || 'Unknown'}</td>
          <td>${ph.pharmacy?.address || ph.address || '-'}</td>
          <td>${ph.pharmacy?.contact || ph.contact || '-'}</td>
        </tr>
      `;
    });
  }

  const bodyHtml = `
    <div class="details-grid">
      <div class="details-section">
        <div class="details-title">Contact Information</div>
        <div class="details-row">
          <div class="details-label">Phone</div>
          <div class="details-value">${doctor.contact || 'Not provided'}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Address</div>
          <div class="details-value">${doctor.address || 'Not provided'}</div>
        </div>
      </div>
      <div class="details-section">
        <div class="details-title">Personal Details</div>
        ${personalDetailsHtml}
      </div>
    </div>

    ${doctor.pharmacies && doctor.pharmacies.length > 0 ? `
      <div class="section-title">Linked Pharmacies (${doctor.pharmacies.length})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 8%; text-align: center;">#</th>
            <th style="width: 32%">Pharmacy Name</th>
            <th style="width: 40%">Address</th>
            <th style="width: 20%">Contact</th>
          </tr>
        </thead>
        <tbody>
          ${pharmaciesRows}
        </tbody>
      </table>
    ` : ''}
  `;

  const html = wrapHtmlTemplate(`Dr. ${doctor.name}`, `${doctor.specialization}  |  ${doctor.qualification}`, bodyHtml);
  await downloadPDFFromHTML(html, `AegisRx_Dr_${doctor.name.replace(/\s+/g, '_')}.pdf`);
};

export const exportPharmacyPDF = async (
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
  let productsRows = '';
  if (pharmacy.products && pharmacy.products.length > 0) {
    pharmacy.products.forEach((p, idx) => {
      productsRows += `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${p.product?.name || 'Unknown'}</td>
        </tr>
      `;
    });
  }

  const bodyHtml = `
    <div class="details-grid">
      <div class="details-section">
        <div class="details-title">Business Details</div>
        <div class="details-row">
          <div class="details-label">License ID</div>
          <div class="details-value">${pharmacy.licenseId}</div>
        </div>
        <div class="details-row">
          <div class="details-label">GST Number</div>
          <div class="details-value">${pharmacy.gstNumber || 'Not provided'}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Drug License</div>
          <div class="details-value">${pharmacy.drugLicense || 'Not provided'}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Contact</div>
          <div class="details-value">${pharmacy.contact || 'Not provided'}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Address</div>
          <div class="details-value">${pharmacy.address || 'Not provided'}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Linked Doctor</div>
          <div class="details-value">${pharmacy.doctor?.name || 'Not assigned'}</div>
        </div>
      </div>
      <div class="details-section">
        <div class="details-title">Owner Details</div>
        <div class="details-row">
          <div class="details-label">Owner Name</div>
          <div class="details-value">${pharmacy.ownerName}</div>
        </div>
        <div class="details-row">
          <div class="details-label">Birthday</div>
          <div class="details-value">${pharmacy.ownerBirthDate ? new Date(pharmacy.ownerBirthDate).toLocaleDateString('en-IN') : '-'}</div>
        </div>
      </div>
    </div>

    ${pharmacy.products && pharmacy.products.length > 0 ? `
      <div class="section-title">Product Catalogue (${pharmacy.products.length})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;">#</th>
            <th style="width: 90%">Product Name</th>
          </tr>
        </thead>
        <tbody>
          ${productsRows}
        </tbody>
      </table>
    ` : ''}
  `;

  const html = wrapHtmlTemplate(pharmacy.name, `Owner: ${pharmacy.ownerName}  |  License: ${pharmacy.licenseId}`, bodyHtml);
  await downloadPDFFromHTML(html, `AegisRx_${pharmacy.name.replace(/\s+/g, '_')}.pdf`);
};

export const exportDoctorListPDF = async (
  doctors: { name: string; specialization: string; qualification: string; contact: string; pharmacyCount: number }[]
) => {
  const avgPharmacies = (doctors.reduce((sum, d) => sum + d.pharmacyCount, 0) / (doctors.length || 1)).toFixed(1);

  const kpis = `
    <div class="kpi-container">
      <div class="kpi-card">
        <div class="kpi-value">${doctors.length}</div>
        <div class="kpi-label">Total Doctors</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${doctors.filter(d => d.pharmacyCount > 0).length}</div>
        <div class="kpi-label">With Pharmacies</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${avgPharmacies}</div>
        <div class="kpi-label">Avg Pharmacies</div>
      </div>
    </div>
  `;

  let doctorRows = '';
  doctors.forEach((d, idx) => {
    doctorRows += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="bold">${d.name}</td>
        <td>${d.specialization}</td>
        <td>${d.qualification}</td>
        <td>${d.contact}</td>
        <td class="text-center bold">${d.pharmacyCount}</td>
      </tr>
    `;
  });

  const bodyHtml = `
    ${kpis}
    <div class="section-title">Complete Doctor Directory</div>
    <table>
      <thead>
        <tr>
          <th style="width: 8%; text-align: center;">#</th>
          <th style="width: 25%">Doctor Name</th>
          <th style="width: 25%">Specialization</th>
          <th style="width: 20%">Qualification</th>
          <th style="width: 12%">Contact</th>
          <th style="width: 10%; text-align: center;">Pharmacies</th>
        </tr>
      </thead>
      <tbody>
        ${doctorRows}
      </tbody>
    </table>
  `;

  const html = wrapHtmlTemplate('Doctor Directory', `Total: ${doctors.length} doctors registered`, bodyHtml);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadPDFFromHTML(html, `AegisRx_Doctors_Directory_${dateStr}.pdf`);
};

export const exportPharmacyListPDF = async (
  pharmacies: { name: string; ownerName: string; licenseId: string; contact: string; productCount: number }[]
) => {
  const totalProductsLinked = pharmacies.reduce((sum, p) => sum + p.productCount, 0);

  const kpis = `
    <div class="kpi-container">
      <div class="kpi-card">
        <div class="kpi-value">${pharmacies.length}</div>
        <div class="kpi-label">Total Pharmacies</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${pharmacies.filter(p => p.productCount > 0).length}</div>
        <div class="kpi-label">With Products</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${totalProductsLinked}</div>
        <div class="kpi-label">Total Products Linked</div>
      </div>
    </div>
  `;

  let pharmacyRows = '';
  pharmacies.forEach((p, idx) => {
    pharmacyRows += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="bold">${p.name}</td>
        <td>${p.ownerName}</td>
        <td>${p.licenseId}</td>
        <td>${p.contact}</td>
        <td class="text-center bold">${p.productCount}</td>
      </tr>
    `;
  });

  const bodyHtml = `
    ${kpis}
    <div class="section-title">Complete Pharmacy Directory</div>
    <table>
      <thead>
        <tr>
          <th style="width: 8%; text-align: center;">#</th>
          <th style="width: 25%">Pharmacy Name</th>
          <th style="width: 20%">Owner Name</th>
          <th style="width: 20%">License ID</th>
          <th style="width: 17%">Contact</th>
          <th style="width: 10%; text-align: center;">Products</th>
        </tr>
      </thead>
      <tbody>
        ${pharmacyRows}
      </tbody>
    </table>
  `;

  const html = wrapHtmlTemplate('Pharmacy Directory', `Total: ${pharmacies.length} pharmacies registered`, bodyHtml);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadPDFFromHTML(html, `AegisRx_Pharmacies_Directory_${dateStr}.pdf`);
};

export const exportProductListPDF = async (
  products: { name: string; pharmacyCount: number }[]
) => {
  const totalLinks = products.reduce((s, p) => s + p.pharmacyCount, 0);

  const kpis = `
    <div class="kpi-container">
      <div class="kpi-card">
        <div class="kpi-value">${products.length}</div>
        <div class="kpi-label">Total Products</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${products.filter(p => p.pharmacyCount > 0).length}</div>
        <div class="kpi-label">With Pharmacies</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${totalLinks}</div>
        <div class="kpi-label">Total Product Links</div>
      </div>
    </div>
  `;

  let productRows = '';
  products.forEach((p, idx) => {
    productRows += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="bold">${p.name}</td>
        <td class="text-center bold">${p.pharmacyCount}</td>
      </tr>
    `;
  });

  const bodyHtml = `
    ${kpis}
    <div class="section-title">Complete Product Directory</div>
    <table>
      <thead>
        <tr>
          <th style="width: 8%; text-align: center;">#</th>
          <th style="width: 72%">Product Name</th>
          <th style="width: 20%; text-align: center;">Active Pharmacies</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
      </tbody>
    </table>
  `;

  const html = wrapHtmlTemplate('Product Directory', `Total: ${products.length} products in catalogue`, bodyHtml);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadPDFFromHTML(html, `AegisRx_Products_Directory_${dateStr}.pdf`);
};
