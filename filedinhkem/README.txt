THƯ MỤC TỆP ĐÍNH KÈM
====================

Trong bản demo front-end hiện tại, tệp đính kèm của phiếu yêu cầu được đọc bằng
FileReader và lưu trực tiếp vào localStorage của trình duyệt dưới dạng Data URL
(xem hàm addFiles / persistFiles trong js/main.js). Vì vậy thư mục này đang trống.

Giới hạn hiện tại:
- Mỗi tệp tối đa 2MB.
- Tổng dung lượng localStorage của trình duyệt khoảng 5MB, nếu vượt hệ thống sẽ
  báo lỗi "Dung lượng lưu trữ đã đầy, không lưu được tệp".

Khi ghép với back-end thật:
- Tải tệp lên máy chủ và lưu vật lý vào thư mục này (hoặc dịch vụ lưu trữ đám mây).
- Trong dữ liệu phiếu yêu cầu chỉ lưu metadata: ten, kichThuoc, loai, duongDan,
  nguoiTai, ngayTai — thay cho trường "duLieu" (Data URL) của bản demo.
- Nên đặt tên tệp theo dạng: <maPYC>_<timestamp>_<tenGoc> để tránh trùng lặp.
