# BÁO CÁO BÀI TẬP: PWA & MOBILE CROSS-PLATFORM
**Học phần:** Nền tảng phát triển ứng dụng di động (Mobile Cross-Platform)
**Dự án:** Ứng dụng Kiểm tra Cơ sở Vật chất (VKU Facility Inspection)

---

## 1. THÔNG TIN CHUNG
- **Tên ứng dụng:** VKU Campus Inspection (FacilityCheck)
- **Mục tiêu:** Xây dựng ứng dụng Progressive Web App (PWA) hỗ trợ cán bộ/nhân viên kiểm tra, bảo trì cơ sở vật chất tại trường đại học.
- **Nền tảng:** Web / Mobile Web (PWA)
- **Kiến trúc dữ liệu:** Offline-First (IndexedDB) kết hợp Google Apps Script & Google Sheets.

## 2. TÍNH NĂNG NỔI BẬT (MOBILE-FIRST & OFFLINE-FIRST)
Ứng dụng được thiết kế đặc biệt cho thao tác trên thiết bị di động với các tiêu chí khắt khe về kỹ thuật:

### 2.1. Kiến trúc PWA & Offline-First
- **Service Worker & Caching:** Áp dụng chiến lược **Cache-First** cho App Shell (HTML, CSS, JS, Fonts, Icons) giúp ứng dụng có thể khởi động ngay lập tức (sub-second boot) kể cả khi không có kết nối mạng (Airplane mode).
- **Web App Manifest:** Cấu hình đầy đủ file `manifest.json` giúp người dùng có thể "Add to Home Screen" (Cài đặt ứng dụng) trực tiếp từ trình duyệt (Safari/Chrome). Ứng dụng sẽ chạy ở chế độ `standalone`, ẩn thanh địa chỉ như một ứng dụng Native thực thụ.
- **Local Persistence (IndexedDB):** Sử dụng API lưu trữ cục bộ thay vì `localStorage` để có thể lưu trữ khối lượng lớn dữ liệu có cấu trúc (bao gồm cả chuỗi base64 của ảnh chụp hiện trạng).

### 2.2. Cơ chế Đồng bộ Tự động (Auto-Sync)
Hệ thống giải quyết triệt để bài toán rớt mạng khi đi khảo sát thực tế (ở tầng hầm, phòng kín):
- **Drafting (Lưu nháp Real-time):** Ghi nhận mọi thay đổi trên form (Tầng, Phòng, Đánh giá sao...) vào IndexedDB (bảng `draft`) mỗi 500ms (Debounce). Chống mất dữ liệu khi lỡ đóng ứng dụng.
- **Background Sync Queue:** Các phiếu kiểm tra khi nộp sẽ đi vào hàng đợi `PENDING_SYNC`.
- Ứng dụng tự động lắng nghe sự kiện mạng (`window.ononline`) và sử dụng Polling ngầm để đẩy (push) dữ liệu lên Google Sheets ngay khi thiết bị có 3G/4G/Wifi trở lại.
- Các bản ghi đã đồng bộ thành công được lưu trữ trong máy với trạng thái `SYNCED` để xem lại lịch sử.

### 2.3. Trải nghiệm người dùng (Industrial UX/UI)
- Áp dụng triết lý thiết kế **Single-page Industrial Form**: Bố cục cuộn dọc, phân chia các khối (Section) chức năng rõ ràng (Geo-Anchor, Asset Taxonomy, Hardware Degradation Rating).
- Giao diện thân thiện với thiết bị cảm ứng: Sử dụng các nút bấm kích thước lớn (Pill buttons, Star rating lớn).
- Phản hồi trạng thái rõ ràng (Toast Notifications, Status Bar đổi màu xanh/vàng tùy thuộc trạng thái mạng).

## 3. CẤU TRÚC KỸ THUẬT & SOURCE CODE
Dự án được xây dựng hoàn toàn bằng **Vanilla JavaScript, HTML5, CSS3** (không dùng framework nặng) để tối ưu hóa hiệu suất và dung lượng.

| File / Folder | Chức năng |
|---------------|-----------|
| `index.html` | App shell, bộ khung giao diện chính của ứng dụng |
| `css/styles.css` | Stylesheet thiết kế theo phong cách Industrial Mobile-first |
| `sw.js` | Service Worker quản lý bộ nhớ đệm (Cache) |
| `js/app.js` | Controller chính xử lý sự kiện form và giao diện |
| `js/db.js` | Database Layer tương tác với IndexedDB API |
| `js/sync.js` | Engine đồng bộ hóa dữ liệu ngầm (Auto-Sync Queue) |
| `js/api.js` | Tầng giao tiếp mạng (Fetch API `mode: 'no-cors'`) |
| `apps-script/Code.gs` | Backend (Google Apps Script) để ghi dữ liệu xuống Sheet |

## 4. HƯỚNG DẪN TRIỂN KHAI & CÀI ĐẶT
1. **Truy cập ứng dụng:** Mở link Cloudflare từ trình duyệt Safari (iOS) hoặc Chrome (Android).
2. **Cài đặt lên màn hình chính (Add to Home Screen):**
   - *Trên iOS:* Bấm biểu tượng "Share" -> Chọn "Add to Home Screen".
   - *Trên Android:* Chrome sẽ tự động hiện banner gợi ý "Install App", hoặc bấm menu (3 chấm) -> Chọn "Install app".
3. **Cấu hình Backend:**
   - Mở ứng dụng, vào tab **Settings (Cài đặt)**.
   - Nhập **Google Apps Script Web App URL** để kích hoạt tính năng đồng bộ.
4. **Sử dụng:** Thử bật/tắt Wifi/4G (chế độ máy bay) để test khả năng hoạt động offline và auto-sync của ứng dụng.

## 5. KẾT LUẬN
Dự án đã đáp ứng hoàn chỉnh các tiêu chí của một ứng dụng PWA Mobile-first:
- Chạy độc lập, mượt mà trên mobile.
- Giao diện chuyên nghiệp, tương tác tốt.
- Hoạt động 100% khi Offline.
- Xử lý đồng bộ dữ liệu ngầm thông minh với Cloud backend (Google Sheets).
