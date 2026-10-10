// constants.ts - Port 1:1 của constants.py. Hằng số nghiệp vụ cố định,
// không có bảng riêng trong D1 (giống bên Flask không có bảng riêng trong
// SQLite) vì không phải dữ liệu người dùng thêm/sửa/xoá được.

export const HUONG = [
  { id: "di", ten: "Phiếu yêu cầu đi", ngan: "PYC đi", ico: "📤" },
  { id: "den", ten: "Phiếu yêu cầu đến", ngan: "PYC đến", ico: "📥" },
];

export const TINH_TRANG = [
  { id: "moi", ten: "Mới tạo", mau: "#0A74C4" },
  { id: "dangxuly", ten: "Đang xử lý", mau: "#E08A00" },
  { id: "choqlyduyet", ten: "Chờ quản lý duyệt", mau: "#0E7C86" },
  { id: "quanly_dong_y", ten: "Quản lý đồng ý", mau: "#2E8B57" },
  { id: "quanly_tuchoi", ten: "Quản lý từ chối", mau: "#C1440E" },
  { id: "choduyet", ten: "Chờ duyệt", mau: "#7C4DBE" },
  { id: "hoanthanh", ten: "Hoàn thành", mau: "#18A058" },
  { id: "tuchoi", ten: "Từ chối", mau: "#D63A3A" },
  { id: "tuchoi_tiepnhan", ten: "Từ chối tiếp nhận", mau: "#8A1F1F" },
];

export const UU_TIEN = [
  { id: "thap", ten: "Thấp" },
  { id: "binhthuong", ten: "Bình thường" },
  { id: "cao", ten: "Cao" },
  { id: "khancap", ten: "Khẩn cấp" },
];

export const CHUC_DANH = [
  { id: "nhanvien", ten: "Thành viên" },
  { id: "quanly", ten: "Cấp quản lý" },
  { id: "admin", ten: "Quản trị hệ thống" },
];

export const TT_KET_THUC = ["hoanthanh", "tuchoi_tiepnhan"];
export const TT_THANHVIEN_THUCHIEN = ["dangxuly", "choqlyduyet"];
export const TT_QUANLY_THUCHIEN = ["dangxuly", "choduyet"];
export const TT_QUANLY_DUYET = ["quanly_dong_y", "quanly_tuchoi"];
export const TT_NGUOI_TAO = ["hoanthanh", "tuchoi"];

export function nhan(danhMuc: { id: string; ten: string }[], ma: string | null | undefined): string {
  for (const item of danhMuc) {
    if (item.id === ma) return item.ten;
  }
  return ma || "--";
}
