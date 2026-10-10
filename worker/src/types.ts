export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  SEED_SECRET: string;
}

/** Kiểu chung cho Hono app/route - "Variables.user" được middleware auth.ts gán. */
export type AppEnv = { Bindings: Env; Variables: { user: NhanVien } };

/** Nhân viên đã map sang JSON camelCase (giống serializers.nhan_vien_to_dict),
 * KHÔNG bao giờ chứa password_hash. */
export interface NhanVien {
  id: string;
  username: string;
  hoTen: string;
  email: string;
  maPhong: string;
  soDienThoai: string;
  chucDanh: "nhanvien" | "quanly" | "admin";
  nguoiQuanLy: string;
  ngayTao: string;
}

export interface TepDinhKem {
  id: string;
  ten: string;
  kichThuoc: number | null;
  loai: string;
  url: string;
  nguoiTai: string;
  ngayTai: string;
}

export interface LichSu {
  tinhTrang: string;
  thoiGian: string;
  nguoi: string;
  nguoiUser: string;
  vaiTro: string;
  ghiChu: string;
  nhanSuKien: string;
  files: TepDinhKem[];
}

export interface PhieuYeuCau {
  id: string;
  huong: "di" | "den";
  maPYC: string;
  loaiPYC: string;
  donViYeuCau: string;
  ngayYeuCau: string;
  thoiHan: string;
  noiDung: string;
  phongThucHien: string;
  nguoiThucHienUser: string;
  nguoiThucHien: string;
  tinhTrang: string;
  uuTien: string;
  nguoiTaoUser: string;
  nguoiTao: string;
  ngayTao: string;
  ngayCapNhat: string;
  files: TepDinhKem[];
  lichSu: LichSu[];
}

/** Dict tối thiểu cho permissions.ts - tương đương row_to_perm_dict() phía Python. */
export interface TicketPermDict {
  nguoiTaoUser: string;
  nguoiThucHienUser: string;
  phongThucHien: string;
  tinhTrang: string;
  _nguoiTaoMaPhong: string;
}
