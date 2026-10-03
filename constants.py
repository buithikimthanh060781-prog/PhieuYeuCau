# -*- coding: utf-8 -*-
"""
constants.py - Danh mục cố định (hằng số nghiệp vụ)

Đây là bản dịch 1:1 sang Python của các mảng hằng số trong js/data.js
(HUONG, TINH_TRANG, UU_TIEN, CHUC_DANH, TT_KET_THUC, TT_THANHVIEN_THUCHIEN,
TT_QUANLY_THUCHIEN, TT_QUANLY_DUYET, TT_NGUOI_TAO).

Các danh mục này KHÔNG có bảng riêng trong cơ sở dữ liệu vì bản demo
tĩnh cũng không lưu chúng vào localStorage - chúng là hằng số nghiệp vụ
cố định, không phải dữ liệu người dùng thêm/sửa/xoá được (khác với
"loại yêu cầu", vốn có bảng loai_yeu_cau vì người dùng cấu hình được).
"""

# Hướng phiếu
HUONG = [
    {"id": "di", "ten": "Phiếu yêu cầu đi", "ngan": "PYC đi", "ico": "📤"},
    {"id": "den", "ten": "Phiếu yêu cầu đến", "ngan": "PYC đến", "ico": "📥"},
]

# Tình trạng xử lý phiếu (kèm màu hiển thị, khớp css/style.css)
TINH_TRANG = [
    {"id": "moi", "ten": "Mới tạo", "mau": "#0A74C4"},
    {"id": "dangxuly", "ten": "Đang xử lý", "mau": "#E08A00"},
    {"id": "choqlyduyet", "ten": "Chờ quản lý duyệt", "mau": "#0E7C86"},
    {"id": "quanly_dong_y", "ten": "Quản lý đồng ý", "mau": "#2E8B57"},
    {"id": "quanly_tuchoi", "ten": "Quản lý từ chối", "mau": "#C1440E"},
    {"id": "choduyet", "ten": "Chờ duyệt", "mau": "#7C4DBE"},
    {"id": "hoanthanh", "ten": "Hoàn thành", "mau": "#18A058"},
    {"id": "tuchoi", "ten": "Từ chối", "mau": "#D63A3A"},
    {"id": "tuchoi_tiepnhan", "ten": "Từ chối tiếp nhận", "mau": "#8A1F1F"},
]

# Độ ưu tiên
UU_TIEN = [
    {"id": "thap", "ten": "Thấp"},
    {"id": "binhthuong", "ten": "Bình thường"},
    {"id": "cao", "ten": "Cao"},
    {"id": "khancap", "ten": "Khẩn cấp"},
]

# Ba chức danh: thành viên < cấp quản lý < quản trị hệ thống
CHUC_DANH = [
    {"id": "nhanvien", "ten": "Thành viên"},
    {"id": "quanly", "ten": "Cấp quản lý"},
    {"id": "admin", "ten": "Quản trị hệ thống"},
]

# Trạng thái KẾT THÚC - không ai còn thao tác được nữa trên phiếu
TT_KET_THUC = ["hoanthanh", "tuchoi_tiepnhan"]

# Tình trạng mà NGƯỜI THỰC HIỆN có chức danh "nhanvien" được phép chuyển
# sang: xử lý xong phải gửi qua quản lý phòng duyệt trước, không được gửi
# thẳng cho người tạo phiếu.
TT_THANHVIEN_THUCHIEN = ["dangxuly", "choqlyduyet"]

# Tình trạng mà NGƯỜI THỰC HIỆN có chức danh "quanly"/"admin" (tự thực hiện)
# được phép chuyển sang: bỏ qua bước quản lý duyệt vì họ chính là quản lý.
TT_QUANLY_THUCHIEN = ["dangxuly", "choduyet"]

# Tình trạng mà QUẢN LÝ PHÒNG THỰC HIỆN (hoặc admin) được phép chuyển sang
# khi xét bằng chứng ở bước "choqlyduyet": đồng ý -> "quanly_dong_y" (còn
# phải tự bấm "Gửi kết quả cho đơn vị yêu cầu" mới thật sự sang "choduyet" -
# xem can_send_to_requester), từ chối -> "quanly_tuchoi" (KHÔNG kết thúc,
# trả về cho người thực hiện làm lại, giống "tuchoi").
TT_QUANLY_DUYET = ["quanly_dong_y", "quanly_tuchoi"]

# Tình trạng mà NGƯỜI TẠO phiếu được phép chuyển sang. "tuchoi" KHÔNG phải
# trạng thái kết thúc - phiếu quay lại "dangxuly" để người thực hiện làm lại.
TT_NGUOI_TAO = ["hoanthanh", "tuchoi"]


def nhan(danh_muc, ma):
    """Tra cứu nhãn hiển thị (ten) theo mã, dùng cho toàn bộ danh mục ở trên."""
    for item in danh_muc:
        if item["id"] == ma:
            return item["ten"]
    return ma or "--"
