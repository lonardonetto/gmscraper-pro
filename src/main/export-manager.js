const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const log = require('electron-log');

const CSV_HEADERS = [
  { id: 'name', title: 'Name' },
  { id: 'address', title: 'Address' },
  { id: 'phone', title: 'Phone' },
  { id: 'website', title: 'Website' },
  { id: 'rating', title: 'Rating' },
  { id: 'review_count', title: 'Reviews' },
  { id: 'category', title: 'Category' },
  { id: 'hours', title: 'Hours' },
  { id: 'scraped_at', title: 'Scraped At' }
];

async function exportCSV(results, filePath) {
  try {
    const writer = createObjectCsvWriter({ path: filePath, header: CSV_HEADERS });
    await writer.writeRecords(results);
    log.info(`CSV exported: ${filePath}`);
    return { success: true, filePath };
  } catch (err) {
    log.error('CSV export error:', err);
    return { success: false, message: err.message };
  }
}

async function exportExcel(results, filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GMScraper Pro';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Scraped Data', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    sheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Website', key: 'website', width: 35 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Reviews', key: 'review_count', width: 12 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Hours', key: 'hours', width: 25 },
      { header: 'Scraped At', key: 'scraped_at', width: 22 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1d2e' } };
      cell.font = { bold: true, color: { argb: 'FF7c3aed' }, size: 11 };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF7c3aed' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 22;

    results.forEach((row, index) => {
      const dataRow = sheet.addRow({
        name: row.name || '',
        address: row.address || '',
        phone: row.phone || '',
        website: row.website || '',
        rating: row.rating || '',
        review_count: row.review_count || '',
        category: row.category || '',
        hours: row.hours || '',
        scraped_at: row.scraped_at || ''
      });

      dataRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'FF1e2235' : 'FF171a28' }
        };
        cell.font = { color: { argb: 'FFe2e8f0' }, size: 10 };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      dataRow.height = 18;
    });

    sheet.autoFilter = { from: 'A1', to: `I1` };

    await workbook.xlsx.writeFile(filePath);
    log.info(`Excel exported: ${filePath}`);
    return { success: true, filePath };
  } catch (err) {
    log.error('Excel export error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = { exportCSV, exportExcel };
