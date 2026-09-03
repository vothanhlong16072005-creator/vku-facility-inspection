/**
 * Google Apps Script — Facility Inspection Web App Endpoint
 * ============================================================
 * Cách deploy:
 * 1. Mở https://script.google.com → New Project
 * 2. Đặt tên project: "Facility Inspection API"
 * 3. Paste toàn bộ nội dung file này vào Code.gs
 * 4. Tạo Google Sheet mới, copy Spreadsheet ID từ URL:
 *    https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
 * 5. Thay SPREADSHEET_ID bên dưới
 * 6. Deploy → New deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone (hoặc Anyone with Google account)
 * 7. Copy "Web App URL" → Dán vào app Settings (hoặc js/api.js DEFAULT_API_URL)
 *
 * Lưu ý: Mỗi lần thay đổi code phải "New deployment" không dùng "Manage deployments"
 */

// ── Configuration ──
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';   // ← Thay bằng ID Sheet thật
const SHEET_NAME     = 'Inspections';

/* ═══════════════════════════════════════════════════
   doGet — Entry point for all GET requests
═══════════════════════════════════════════════════ */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'ping';

    switch (action) {
      case 'ping':
        return jsonRes({ success: true, message: 'pong', timestamp: Date.now() });

      case 'addInspection':
        return jsonRes(addInspection(params));

      case 'list':
        return jsonRes({ success: true, data: listInspections() });

      default:
        return jsonRes({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonRes({ success: false, error: err.message });
  }
}

/* ═══════════════════════════════════════════════════
   Add Inspection
═══════════════════════════════════════════════════ */
function addInspection(params) {
  const sheet = getOrCreateSheet();

  const row = [
    params.uuid       || '',
    params.timestamp  || new Date().toISOString(),
    params.geo        || '',
    params.building   || '',
    params.floor      || '',
    params.room       || '',
    params.category   || '',
    params.deviceName || '',
    params.deviceCode || '',
    params.rating     || '0',
    params.issueShort || '',
    params.notes      || '',
    params.hasPhoto   || 'no',
    'SYNCED',          // sync status logged in sheet
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);

  // Auto-format rating column with star icons
  try {
    const ratingNum = parseInt(params.rating) || 0;
    const stars = '★'.repeat(ratingNum) + '☆'.repeat(5 - ratingNum);
    sheet.getRange(lastRow + 1, 10).setValue(stars); // Column J (10)
  } catch (_) {}

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return {
    success:  true,
    uuid:     params.uuid,
    sheetUrl: ss.getUrl(),
    rowAdded: lastRow + 1,
  };
}

/* ═══════════════════════════════════════════════════
   List Inspections (last 100 rows)
═══════════════════════════════════════════════════ */
function listInspections() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) return [];

  const startRow = Math.max(2, lastRow - 99);
  const numRows  = lastRow - startRow + 1;
  const values   = sheet.getRange(startRow, 1, numRows, lastCol).getValues();

  return values.map((row) => ({
    uuid:       row[0],
    timestamp:  row[1],
    geo:        row[2],
    building:   row[3],
    floor:      row[4],
    room:       row[5],
    category:   row[6],
    deviceName: row[7],
    deviceCode: row[8],
    rating:     row[9],
    issueShort: row[10],
    notes:      row[11],
    hasPhoto:   row[12],
  }));
}

/* ═══════════════════════════════════════════════════
   Sheet Setup
═══════════════════════════════════════════════════ */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Create headers if empty
  if (sheet.getLastRow() === 0) {
    const headers = [
      'UUID',
      'Thời gian tạo',
      'Geo-Anchor',
      'Tòa nhà',
      'Tầng',
      'Phòng',
      'Danh mục',
      'Tên thiết bị',
      'Mã thiết bị',
      'Đánh giá (sao)',
      'Issue Summary',
      'Ghi chú lỗi',
      'Có ảnh',
      'Trạng thái sync',
    ];

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange
      .setFontWeight('bold')
      .setBackground('#0284c7')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 220);  // UUID
    sheet.setColumnWidth(2, 160);  // Timestamp
    sheet.setColumnWidth(3, 160);  // Geo-Anchor
    sheet.setColumnWidth(10, 110); // Rating
    sheet.setColumnWidth(11, 150); // Issue Summary
    sheet.setColumnWidth(12, 250); // Notes
    sheet.setColumnWidth(14, 130); // Status
  }

  return sheet;
}

/* ═══════════════════════════════════════════════════
   Helper
═══════════════════════════════════════════════════ */
function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════
   Test Function (chạy thủ công từ Apps Script IDE)
═══════════════════════════════════════════════════ */
function testAddInspection() {
  const sample = {
    uuid:       'test-' + Date.now(),
    timestamp:  new Date().toISOString(),
    building:   'Nhà A1',
    floor:      '3',
    room:       '301',
    category:   'Projector',
    deviceName: 'Máy chiếu Epson EB-X41',
    deviceCode: 'PJ-301-01',
    rating:     '4',
    notes:      'Đèn chiếu bị mờ, cần thay bóng',
    hasPhoto:   'yes',
  };

  const result = addInspection(sample);
  Logger.log('Test result: ' + JSON.stringify(result));
  return result;
}
