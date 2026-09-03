# MINI-PROJECT SHORT TECHNICAL REPORT
Course: Cross-Platform Mobile App Development 
Mini-Project Title: Mini-Project 1 - Ứng dụng PWA Kiểm tra Cơ sở vật chất
Student Name: Võ Thành Long
Submission Date: 03/09/2026

---

## 1. GENERAL INFORMATION & DELIVERABLE LINKS
* Team Members:
  1. Võ Thành Long — Student ID: 23IT147 — Role: Code toàn bộ ứng dụng — Contribution: 100%
* Live Demo URL: https://vku-facility-inspection.pages.dev
* GitHub Repository: https://github.com/vothanhlong16072005-creator/vku-facility-inspection
* Link video demo: https://www.youtube.com/shorts/wvXHWzjUi0E?si=3lTqVhRNcNHOMLA5

---

## 2. FEATURE IMPLEMENTATION CHECKLIST
1. Giao diện Mobile-first
    Giao diện một trang cuộn dọc để dễ bấm trên điện thoại. Ứng dụng tự nhận biết và hiển thị đang có mạng hay mất mạng.
2. Lưu trữ dữ liệu Offline
    Dùng IndexedDB lưu lại các phiếu kiểm tra xuống máy tính hoặc điện thoại khi không có mạng.
3. Tự động đồng bộ nền
    Code tự phát hiện khi nào có mạng lại thì sẽ lôi các phiếu chưa gửi ra và tự động đẩy lên Google Sheets.
4. Cài đặt PWA
    Đã cấu hình file manifest và Service Worker để người dùng có thể tải trang ngay lập tức và cài ra màn hình chính giống hệt app thật.

---

## 3. TECHNICAL ARCHITECTURE & PROJECT STRUCTURE

Vì đây là dự án web thuần không dùng framework nên em chia ra các file nhỏ cho dễ sửa lỗi:
- File css/styles.css chứa code làm đẹp giao diện.
- File js/app.js để xử lý các nút bấm và lấy dữ liệu người dùng nhập.
- File js/db.js chuyên làm việc với database nội bộ IndexedDB.
- File js/sync.js là đoạn code chạy ngầm để gom dữ liệu đẩy lên mạng.
- File js/api.js chứa hàm fetch để gửi dữ liệu đi.
- File Code.gs nằm bên Google Apps Script để nhận dữ liệu và ghi vào file Excel.

Luồng dữ liệu: Bất kỳ thay đổi nào trên giao diện nhập liệu đều được bắt sự kiện và lưu trữ tạm thời thông qua cơ chế Debounce. Khi thực hiện thao tác nộp phiếu, hệ thống sẽ đánh giá trạng thái mạng hiện tại qua biến navigator.onLine. Nếu thiết bị đang trực tuyến, dữ liệu lập tức được gọi qua REST API đến Google Apps Script. Trong trường hợp ngoại tuyến, payload sẽ được đẩy vào hàng đợi của IndexedDB với trạng thái chờ. Ngay khi sự kiện ononline được kích hoạt, Background Sync Queue sẽ tự động xử lý hàng đợi và hoàn tất việc đồng bộ.

---

## 4. EMPIRICAL EVIDENCE & SCREENSHOTS
![Màn hình trang chủ](./images/giaodien1.jpg)

![Màn hình khi mất mạng](./images/giaodien2.jpg)

![Màn hình sync thành công](./images/giaodien3.jpg)

![Màn hình dữ liệu trên sheet](./images/data.jpg)


## 5. TECHNICAL CHALLENGES & RESOLUTIONS
Khó khăn 1: Vi phạm chính sách bảo mật CORS của trình duyệt khi giao tiếp API
Khi thực hiện POST request chứa JSON payload từ domain của ứng dụng sang endpoint của Google Script, trình duyệt đã chặn lại do vi phạm chính sách Cross-Origin Resource Sharing. 
Giải pháp: Thiết kế lại kiến trúc gửi dữ liệu bằng cách sử dụng HTTP GET request kết hợp truyền tải qua chuỗi Query Parameters. Cùng với tham số cấu hình no-cors trong Fetch API, ứng dụng đã có thể vượt qua rào cản này để đẩy dữ liệu thành công.

Khó khăn 2: Mất trạng thái cục bộ khi vòng đời trang web bị gián đoạn đột ngột
Khi người dùng tải lại trang hoặc trình duyệt bị đóng băng, dữ liệu đang thao tác trong bộ nhớ RAM bị mất hoàn toàn. 
Giải pháp: Xây dựng cơ chế Real-time Draft Persistence. Bằng cách kết hợp Event Listener với hàm Debounce nửa giây, toàn bộ State của form được ánh xạ liên tục xuống Storage nội bộ IndexedDB. Khi khởi tạo lại ứng dụng, hàm restore sẽ lấy lại chính xác trạng thái cuối cùng.

Khó khăn 3: Xung đột hiển thị Layout trên các Viewport di động kích thước hẹp
Cấu trúc ban đầu sử dụng các đơn vị kích thước tuyệt đối gây ra hiện tượng tràn phần tử DOM trên thiết bị có độ phân giải thấp. 
Giải pháp: Việc refactor lại toàn bộ Stylesheet đã được thực hiện bằng cách áp dụng Flexible Box Layout Model và Relative Units như phần trăm hoặc viewport width. CSS cũng được tối ưu lại để đảm bảo tính Responsive.

Khó khăn 4: Cơ chế Cache Invalidation của Service Worker giữ lại tài nguyên cũ
Mô hình Cache-First giúp tải trang cực nhanh nhưng lại dẫn đến việc trình duyệt luôn phục vụ tài nguyên cũ từ bộ nhớ đệm ngay cả khi Source Code trên máy chủ đã thay đổi.
 Trong quá trình phát triển, cờ Update on reload trong DevTools được sử dụng. Khi triển khai Production, em áp dụng chiến lược Cache Versioning, thay đổi định danh bộ đệm mỗi lần phát hành để buộc Service Worker phải tải xuống bộ App Shell mới nhất.
