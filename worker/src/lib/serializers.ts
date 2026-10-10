// serializers.ts - Port 1:1 của serializers.py: chuyển dòng D1 (snake_case)
// sang JSON camelCase mà js/data.js và js/main.js đang mong đợi.
import type { LichSu, NhanVien, PhieuYeuCau, TepDinhKem } from "../types";

export function phongBanToDict(row: Record<string, any>) {
  return {
    id: row.ma_phong,
    maPhong: row.ma_phong,
    tenPhong: row.ten_phong,
    truongPhong: row.truong_phong || "",
    ghiChu: row.ghi_chu || "",
    ngayTao: row.ngay_tao,
  };
}

export function loaiYeuCauToDict(row: Record<string, any>) {
  return {
    id: row.ma_loai,
    ten: row.ten,
    moTa: row.mo_ta || "",
    ngayTao: row.ngay_tao,
  };
}

export function nhanVienToDict(row: Record<string, any>): NhanVien {
  return {
    id: row.username,
    username: row.username,
    hoTen: row.ho_ten,
    email: row.email,
    maPhong: row.ma_phong,
    soDienThoai: row.so_dien_thoai || "",
    chucDanh: row.chuc_danh,
    nguoiQuanLy: row.nguoi_quan_ly || "",
    ngayTao: row.ngay_tao,
  };
}

/** `row` cần thêm cột `ten_nguoi_tai` (JOIN sang nhan_vien.ho_ten). */
export function tepDinhKemToDict(row: Record<string, any>): TepDinhKem {
  return {
    id: String(row.id),
    ten: row.ten_tep,
    kichThuoc: row.kich_thuoc,
    loai: row.loai_mime || "",
    url: `/api/tep-dinh-kem/${row.id}/tai-xuong`,
    nguoiTai: row.ten_nguoi_tai || "",
    ngayTai: row.ngay_tai,
  };
}

export function thongBaoToDict(row: Record<string, any>) {
  return {
    id: String(row.id),
    phieuId: String(row.phieu_id),
    maPYC: row.ma_pyc,
    noiDung: row.noi_dung,
    tinhTrang: row.tinh_trang,
    thoiGian: row.thoi_gian,
    daXem: !!row.da_xem,
  };
}

/** `row` cần thêm cột `ten_nguoi` (JOIN sang nhan_vien.ho_ten của nguoi_user). */
export function lichSuToDict(row: Record<string, any>, files: TepDinhKem[]): LichSu {
  return {
    tinhTrang: row.tinh_trang,
    thoiGian: row.thoi_gian,
    nguoi: row.ten_nguoi || "",
    nguoiUser: row.nguoi_user || "",
    vaiTro: row.vai_tro || "",
    ghiChu: row.ghi_chu || "",
    nhanSuKien: row.nhan_su_kien || "",
    files,
  };
}

/** `row` cần thêm 2 cột JOIN: `ten_nguoi_tao`, `ten_nguoi_thuc_hien`. */
export function phieuYeuCauToDict(
  row: Record<string, any>,
  lichSu: LichSu[],
  files: TepDinhKem[],
): PhieuYeuCau {
  return {
    id: String(row.id),
    huong: row.huong,
    maPYC: row.ma_pyc,
    loaiPYC: row.loai_pyc,
    donViYeuCau: row.don_vi_yeu_cau,
    ngayYeuCau: row.ngay_yeu_cau,
    thoiHan: row.thoi_han,
    noiDung: row.noi_dung,
    phongThucHien: row.phong_thuc_hien,
    nguoiThucHienUser: row.nguoi_thuc_hien_user || "",
    nguoiThucHien: row.ten_nguoi_thuc_hien || "",
    tinhTrang: row.tinh_trang,
    uuTien: row.uu_tien,
    nguoiTaoUser: row.nguoi_tao_user,
    nguoiTao: row.ten_nguoi_tao || "",
    ngayTao: row.ngay_tao,
    ngayCapNhat: row.ngay_cap_nhat,
    files,
    lichSu,
  };
}
