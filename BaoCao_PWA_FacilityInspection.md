# MINI-PROJECT SHORT TECHNICAL REPORT
**Course:** Cross-Platform Mobile App Development (VKU)
**Mini-Project Title:** Mini-Project 1: Ứng dụng PWA Kiểm tra Cơ sở vật chất
**Student Name:** Võ Thành Long
**Submission Date:** 03/09/2026

---

## 1. GENERAL INFORMATION & DELIVERABLE LINKS
* **Team Members:**
  1. Võ Thành Long — Student ID: [Điền mã SV vào đây] — Role: Fullstack Developer — Contribution: 100%
* **🔗 Live Demo URL:** https://vku-facility-inspection.pages.dev
* **💻 GitHub Repository:** https://github.com/vothanhlong16072005-creator/vku-facility-inspection
* **🎥 Video Demo (Optional):** [Link video nếu có]

---

## 2. FEATURE IMPLEMENTATION CHECKLIST
| # | Required Feature | Status | Implementation Details & Acceptance Level |
|:---:|---|:---:|---|
| 1 | Industrial Mobile-first UI | ✅ Complete | Giao diện Single-page form cuộn dọc, tối ưu cho màn hình cảm ứng di động. Có trạng thái báo mạng (Online/Offline) rõ ràng. |
| 2 | Local Offline Persistence | ✅ Complete | Sử dụng IndexedDB (thông qua idb wrapper) để lưu trữ phiếu kiểm tra và lưu nháp khi rớt mạng. |
| 3 | Automatic Background Sync | ✅ Complete | Bắt sự kiện `window.ononline` để tự động đẩy dữ liệu đang chờ (Pending) lên Google Sheets ngay khi có mạng lại. |
| 4 | PWA Installable | ✅ Complete | Cấu hình file `manifest.json` và Service Worker (Cache-First) để tải app tức thì và cho phép cài ra màn hình chính. |

---

## 3. TECHNICAL ARCHITECTURE & PROJECT STRUCTURE
Do đây là một ứng dụng web thuần (Vanilla JS) không dùng framework phức tạp, em chia project thành các file module riêng biệt để dễ quản lý:
- `css/styles.css`: Chứa toàn bộ CSS, chia style theo thiết kế chuẩn công nghiệp.
- `js/app.js`: File điều khiển chính, lấy dữ liệu từ form, kiểm tra lỗi và cập nhật UI.
- `js/db.js`: File chuyên xử lý cơ sở dữ liệu nội bộ (IndexedDB), tạo 2 bảng là `inspections` (để lưu phiếu) và `draft` (để lưu nháp).
- `js/sync.js`: Hàm chạy ngầm để lấy các phiếu chưa gửi (`PENDING_SYNC`) trong máy ra và đẩy lên server.
- `js/api.js`: File chứa hàm Fetch API để gọi lên Google Apps Script.
- `apps-script/Code.gs`: Đoạn code chạy trên Google Server để hứng dữ liệu và ghi vào Google Sheets.

**Luồng dữ liệu (State Flow):**
Người dùng nhập liệu -> Tự động lưu nháp mỗi 500ms -> Nhấn "Gửi" -> Lưu phiếu vào DB nội bộ (trạng thái chờ) -> Kiểm tra mạng -> Có mạng thì bắn lên Google Sheets -> Thành công thì chuyển trạng thái thành "Đã đồng bộ". 

---

## 4. EMPIRICAL EVIDENCE & SCREENSHOTS
*(Lưu ý: Bạn hãy chụp màn hình điện thoại hoặc máy tính rồi dán đè thay thế các dòng chữ bên dưới nhé)*

![Giao diện màn hình chính khi đang điền form](chèn-link-ảnh-vào-đây.jpg)

![Màn hình Lịch sử hiển thị các phiếu Đã đồng bộ và Chờ đồng bộ](chèn-link-ảnh-vào-đây.jpg)

![Giao diện lúc cài đặt PWA ra màn hình chính](chèn-link-ảnh-vào-đây.jpg)

![Dữ liệu đã nhảy lên Google Sheets](chèn-link-ảnh-vào-đây.jpg)

---

## 5. TECHNICAL CHALLENGES & RESOLUTIONS
Trong quá trình làm bài, em có gặp 2 khó khăn chính và đã tìm cách giải quyết như sau:

* **Vấn đề 1: Gọi API lên Google Sheets bị chặn lỗi CORS (Cross-Origin Resource Sharing).**
  - Trình duyệt không cho phép gửi request dạng POST chứa JSON thẳng lên Google Script từ một domain khác. 
  - **Cách giải quyết:** Em đã chuyển sang dùng method `GET`, gửi dữ liệu qua Query Parameters trên thanh URL, đồng thời thêm `mode: 'no-cors'` vào hàm `fetch()`. Tuy làm cách này không đọc được nội dung (body) mà Google trả về, nhưng dữ liệu vẫn được đẩy lên Google Sheets thành công.

* **Vấn đề 2: Người dùng đang gõ dài dòng mà lỡ tay load lại trang hoặc bấm nhầm thoát app thì bị mất trắng dữ liệu.**
  - **Cách giải quyết:** Em làm thêm cơ chế Auto-save (Lưu nháp thời gian thực). Bắt sự kiện `input` trên các thẻ HTML, sử dụng kỹ thuật `Debounce` (đợi 500ms sau khi người dùng ngừng gõ) rồi mới ghi thẳng vào bảng `draft` của IndexedDB. Khi người dùng mở lại app, hệ thống sẽ tự động móc dữ liệu từ `draft` ra và điền lại vào form y như cũ.
