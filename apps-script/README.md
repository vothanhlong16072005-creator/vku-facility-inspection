# Hướng dẫn Deploy Google Apps Script

## Bước 1: Tạo Google Spreadsheet

1. Truy cập [Google Sheets](https://sheets.google.com) → Tạo spreadsheet mới
2. Đặt tên: `Facility Inspection Data`
3. Copy **Spreadsheet ID** từ URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

## Bước 2: Deploy Apps Script

1. Truy cập [Google Apps Script](https://script.google.com) → **New Project**
2. Đặt tên project: `Facility Inspection API`
3. Xóa code mặc định, paste toàn bộ nội dung file `Code.gs` vào
4. Thay dòng sau bằng Spreadsheet ID thực của bạn:
   ```javascript
   const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```
5. **Deploy** → **New Deployment**
   - **Type**: Web app
   - **Execute as**: Me (your Google account)
   - **Who has access**: **Anyone** *(bắt buộc để app PWA gọi được)*
6. Click **Deploy** → Cấp quyền truy cập nếu được hỏi
7. **Copy Web App URL** (dạng `https://script.google.com/macros/s/AKfycb.../exec`)

---

## Bước 3: Cấu hình trong App

### Cách 1 — Qua Settings UI (khuyến nghị):
1. Mở app → Tab **⚙️ Cài đặt**
2. Dán Web App URL vào ô `Google Apps Script URL`
3. Click **💾 Lưu URL**

### Cách 2 — Hardcode trong code:
Mở `js/api.js`, thay:
```javascript
const DEFAULT_API_URL = '';
```
thành:
```javascript
const DEFAULT_API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

---

## Bước 4: Test

### Test từ Apps Script IDE:
1. Chọn function `testAddInspection` → Run
2. Kiểm tra Google Sheet có dòng mới không

### Test từ trình duyệt:
```
https://script.google.com/macros/s/YOUR_ID/exec?action=ping
```
→ Phải trả về: `{"success":true,"message":"pong",...}`

---

## Cấu trúc Sheet sau khi deploy

| Cột | Tiêu đề | Ví dụ |
|-----|---------|-------|
| A | UUID | `a1b2c3d4-...` |
| B | Thời gian tạo | `2026-09-03T10:30:00Z` |
| C | Tòa nhà | `Nhà A1` |
| D | Tầng | `3` |
| E | Phòng | `301` |
| F | Danh mục | `Projector` |
| G | Tên thiết bị | `Máy chiếu Epson EB-X41` |
| H | Mã thiết bị | `PJ-301-01` |
| I | Đánh giá (sao) | `★★★★☆` |
| J | Ghi chú lỗi | `Đèn bị mờ...` |
| K | Có ảnh | `yes / no` |
| L | Trạng thái sync | `SYNCED` |

---

## Lưu ý quan trọng

> **Mỗi lần thay đổi code trong Apps Script** phải tạo **New Deployment** mới
> (không dùng "Manage deployments" để update), và **copy URL mới** vào app.

> **CORS**: App dùng `mode: 'no-cors'` nên không thể đọc response body.
> Chỉ cần request reach server là coi như thành công.
> Để verify, kiểm tra Sheet trực tiếp hoặc dùng `action=list` từ browser.
