// routes/devSeed.ts - Port 1:1 của seed_data.py, lộ ra như một endpoint có
// thể gọi lại nhiều lần (POST /api/_dev/reset-demo, cần header
// "X-Seed-Secret" khớp biến môi trường SEED_SECRET) thay vì lệnh CLI
// "flask init-db" - vì Worker không có CLI cục bộ chạy cạnh D1 thật.
// Xoá sạch rồi nạp lại đúng bộ dữ liệu mẫu (5 phòng ban / 7 loại yêu cầu /
// 11 nhân viên / 15 phiếu), để ngày tháng tương đối (quá hạn/sắp tới hạn)
// luôn "tươi" mỗi lần gọi, giống `_ngay_lech()` của seed_data.py.
import { Hono } from "hono";
import { hashPassword } from "../lib/crypto";
import { dayOffsetISO, currentYear } from "../lib/time";
import type { AppEnv, Env } from "../types";

export const devSeedRoutes = new Hono<AppEnv>();

const PHONG_BAN: [string, string, string, string, string][] = [
  ["P.HCNS", "Phòng Hành chính - Nhân sự", "Nguyễn Thị Minh Thư", "Tầng 3 - Toà nhà chính", "2024-01-05"],
  ["P.CNTT", "Phòng Công nghệ thông tin", "Trần Quốc Bảo", "Tầng 5 - Toà nhà chính", "2024-01-05"],
  ["P.KTTC", "Phòng Kế toán - Tài chính", "Lê Hoàng Nam", "Tầng 4 - Toà nhà chính", "2024-01-06"],
  ["P.KHDN", "Phòng Khách hàng doanh nghiệp", "Phạm Thu Hà", "Tầng 2 - Toà nhà chính", "2024-02-11"],
  ["P.PLTT", "Phòng Pháp lý - Tuân thủ", "Võ Anh Khoa", "Tầng 6 - Toà nhà chính", "2024-03-02"],
];

const LOAI_YEU_CAU: [string, string, string, string][] = [
  ["muasam", "Mua sắm tài sản", "Đề nghị mua sắm trang thiết bị, công cụ dụng cụ", "2024-01-05"],
  ["suachua", "Sửa chữa - Bảo trì", "Sửa chữa, bảo trì cơ sở vật chất và thiết bị", "2024-01-05"],
  ["cntt", "Hỗ trợ CNTT", "Hỗ trợ kỹ thuật, cấp quyền, xử lý sự cố hệ thống", "2024-01-05"],
  ["nhansu", "Nhân sự - Đào tạo", "Tuyển dụng, điều động, đào tạo nhân sự", "2024-01-05"],
  ["taichinh", "Tài chính - Kế toán", "Tạm ứng, thanh toán, đối chiếu số liệu", "2024-01-05"],
  ["phaply", "Pháp lý - Hợp đồng", "Rà soát hợp đồng, tư vấn pháp lý, tuân thủ", "2024-01-05"],
  ["khac", "Yêu cầu khác", "Các yêu cầu không thuộc nhóm trên", "2024-01-05"],
];

// (username, mật khẩu thô, họ tên, email, mã phòng, sđt, chức danh, người quản lý, ngày tạo)
const NHAN_VIEN: [string, string, string, string, string, string, string, string | null, string][] = [
  ["admin", "123456", "Quản trị hệ thống", "admin@acb.com.vn", "P.CNTT", "0900000000", "admin", null, "2024-01-01"],
  ["thuntm", "123456", "Nguyễn Thị Minh Thư", "thu.ntm@acb.com.vn", "P.HCNS", "0901234567", "quanly", "admin", "2024-01-05"],
  ["baotq", "123456", "Trần Quốc Bảo", "bao.tq@acb.com.vn", "P.CNTT", "0912345678", "quanly", "admin", "2024-01-08"],
  ["namlh", "123456", "Lê Hoàng Nam", "nam.lh@acb.com.vn", "P.KTTC", "0923456789", "quanly", "admin", "2024-01-12"],
  ["hapt", "123456", "Phạm Thu Hà", "ha.pt@acb.com.vn", "P.KHDN", "0934567890", "quanly", "admin", "2024-02-15"],
  ["khoava", "123456", "Võ Anh Khoa", "khoa.va@acb.com.vn", "P.PLTT", "0945678901", "quanly", "admin", "2024-03-04"],
  ["dungnt", "123456", "Ngô Tiến Dũng", "dung.nt@acb.com.vn", "P.CNTT", "0956789012", "nhanvien", "baotq", "2024-04-20"],
  ["lanvt", "123456", "Vũ Thị Lan", "lan.vt@acb.com.vn", "P.HCNS", "0967890123", "nhanvien", "thuntm", "2024-05-06"],
  ["trangnt", "123456", "Nguyễn Thị Trang", "trang.nt@acb.com.vn", "P.CNTT", "0978901234", "nhanvien", "baotq", "2024-06-10"],
  ["hieult", "123456", "Lý Trung Hiếu", "hieu.lt@acb.com.vn", "P.KTTC", "0989012345", "nhanvien", "namlh", "2024-06-18"],
  ["phucnv", "123456", "Nguyễn Văn Phúc", "phuc.nv@acb.com.vn", "P.KHDN", "0990123456", "nhanvien", "hapt", "2024-07-01"],
];

// (huong, loaiPYC, donViYeuCau, ngay, han, nguoiTao, phongThucHien, nguoiThucHien, tinhTrang, uuTien, noiDung)
const PHIEU_YEU_CAU: [string, string, string, number, number, string, string, string, string, string, string][] = [
  ["di", "muasam", "P.HCNS", -12, 4, "thuntm", "P.CNTT", "dungnt", "dangxuly", "cao", "Đề nghị mua sắm 15 bộ máy tính để bàn phục vụ nhân sự mới tuyển dụng quý này, cấu hình theo tiêu chuẩn khối văn phòng."],
  ["di", "cntt", "P.KHDN", -8, -1, "hapt", "P.CNTT", "trangnt", "dangxuly", "khancap", "Yêu cầu cấp quyền truy cập hệ thống báo cáo tín dụng cho 3 chuyên viên quan hệ khách hàng mới."],
  ["di", "suachua", "P.KTTC", -20, -6, "hieult", "P.HCNS", "lanvt", "hoanthanh", "binhthuong", "Sửa chữa hệ thống điều hoà khu vực làm việc tầng 4, máy số 2 và số 5 không làm lạnh."],
  ["di", "nhansu", "P.CNTT", -4, 11, "baotq", "P.HCNS", "thuntm", "choduyet", "binhthuong", "Đề xuất tổ chức khoá đào tạo an toàn thông tin cho toàn bộ nhân sự khối vận hành trong tháng tới."],
  ["di", "phaply", "P.KHDN", -2, 8, "phucnv", "P.PLTT", "khoava", "moi", "cao", "Đề nghị rà soát và góp ý dự thảo hợp đồng hợp tác với đối tác thanh toán trước khi trình ký."],
  ["den", "cntt", "Chi nhánh Tân Bình", -6, 2, "baotq", "P.CNTT", "dungnt", "dangxuly", "khancap", "Chi nhánh đề nghị hỗ trợ khắc phục lỗi máy in sổ tiết kiệm tại quầy giao dịch số 3."],
  ["den", "taichinh", "Chi nhánh Quận 1", -15, -3, "namlh", "P.KTTC", "hieult", "hoanthanh", "cao", "Đề nghị đối chiếu và xác nhận số dư tài khoản trung gian phục vụ quyết toán quý."],
  ["den", "nhansu", "Chi nhánh Bình Thạnh", -9, 6, "thuntm", "P.HCNS", "lanvt", "choduyet", "binhthuong", "Đề nghị bổ sung 02 giao dịch viên cho chi nhánh trong giai đoạn cao điểm cuối năm."],
  ["den", "muasam", "Phòng Giao dịch Phú Nhuận", -3, 12, "lanvt", "P.HCNS", "thuntm", "moi", "thap", "Đề nghị trang bị bổ sung 04 bộ bàn ghế quầy giao dịch và 02 máy đếm tiền thế hệ mới."],
  ["den", "phaply", "Chi nhánh Gò Vấp", -25, -10, "khoava", "P.PLTT", "khoava", "tuchoi", "cao", "Đề nghị hướng dẫn xử lý hồ sơ tài sản bảo đảm có tranh chấp quyền sử dụng đất."],
  ["den", "suachua", "Chi nhánh Thủ Đức", -1, 9, "lanvt", "P.HCNS", "lanvt", "moi", "binhthuong", "Đề nghị bảo trì định kỳ hệ thống camera giám sát và máy phát điện dự phòng của chi nhánh."],
  ["di", "taichinh", "P.HCNS", -30, -18, "thuntm", "P.KTTC", "namlh", "hoanthanh", "binhthuong", "Đề nghị tạm ứng kinh phí tổ chức hội nghị tổng kết hoạt động và khen thưởng cuối năm."],
  ["di", "cntt", "P.CNTT", -5, 7, "dungnt", "P.CNTT", "trangnt", "dangxuly", "binhthuong", "Đề nghị nâng cấp dung lượng lưu trữ máy chủ ứng dụng nội bộ phục vụ triển khai hệ thống mới."],
  ["den", "cntt", "Chi nhánh Tân Phú", -7, 3, "trangnt", "P.CNTT", "dungnt", "choduyet", "cao", "Chi nhánh đề nghị cài đặt và cấu hình lại đường truyền dự phòng sau sự cố mất kết nối."],
  ["di", "muasam", "P.CNTT", -2, 14, "dungnt", "P.HCNS", "lanvt", "moi", "thap", "Đề nghị cấp bổ sung văn phòng phẩm và mực in cho bộ phận kỹ thuật trong quý."],
];

function sinhMaPycSeed(huong: string, daDung: string[]): string {
  const tienTo = `YC${huong === "di" ? "D" : "N"}-${currentYear()}-`;
  let maxSo = 0;
  for (const ma of daDung) {
    if (ma.startsWith(tienTo)) {
      const so = parseInt(ma.slice(tienTo.length), 10);
      if (!Number.isNaN(so)) maxSo = Math.max(maxSo, so);
    }
  }
  return `${tienTo}${String(maxSo + 1).padStart(4, "0")}`;
}

async function xoaSachDuLieu(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM thong_bao"),
    db.prepare("DELETE FROM tep_dinh_kem"),
    db.prepare("DELETE FROM lich_su_xu_ly"),
    db.prepare("DELETE FROM phieu_yeu_cau"),
    db.prepare("DELETE FROM nhan_vien"),
    db.prepare("DELETE FROM loai_yeu_cau"),
    db.prepare("DELETE FROM phong_ban"),
  ]);
}

async function xoaSachR2(env: Env): Promise<void> {
  let cursor: string | undefined;
  do {
    const listing = await env.FILES.list({ cursor, limit: 1000 });
    if (listing.objects.length > 0) {
      await Promise.all(listing.objects.map((o) => env.FILES.delete(o.key)));
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
}

devSeedRoutes.post("/reset-demo", async (c) => {
  const header = c.req.header("X-Seed-Secret");
  if (!header || header !== c.env.SEED_SECRET) {
    return c.json({ error: "Thiếu hoặc sai X-Seed-Secret." }, 403);
  }

  const db = c.env.DB;
  await xoaSachR2(c.env);
  await xoaSachDuLieu(db);

  await db.batch(
    PHONG_BAN.map(([ma, ten, truong, ghiChu, ngay]) =>
      db
        .prepare("INSERT INTO phong_ban (ma_phong, ten_phong, truong_phong, ghi_chu, ngay_tao) VALUES (?, ?, ?, ?, ?)")
        .bind(ma, ten, truong, ghiChu, ngay),
    ),
  );

  await db.batch(
    LOAI_YEU_CAU.map(([ma, ten, moTa, ngay]) =>
      db.prepare("INSERT INTO loai_yeu_cau (ma_loai, ten, mo_ta, ngay_tao) VALUES (?, ?, ?, ?)").bind(ma, ten, moTa, ngay),
    ),
  );

  const nhanVienStmts = await Promise.all(
    NHAN_VIEN.map(async ([username, matKhauTho, hoTen, email, maPhong, sdt, chucDanh, nguoiQuanLy, ngayTao]) =>
      db
        .prepare(
          "INSERT INTO nhan_vien (username, password_hash, ho_ten, email, ma_phong, so_dien_thoai, chuc_danh, nguoi_quan_ly, ngay_tao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(username, await hashPassword(matKhauTho), hoTen, email, maPhong, sdt, chucDanh, nguoiQuanLy, ngayTao),
    ),
  );
  await db.batch(nhanVienStmts);

  const maDaDung: Record<string, string[]> = { di: [], den: [] };
  let soLichSu = 0;
  const phieuStmts: D1PreparedStatement[] = [];

  for (const [huong, loai, donVi, ngay, han, nguoiTao, phongTh, nguoiTh, tinhTrang, uuTien, noiDung] of PHIEU_YEU_CAU) {
    const maPyc = sinhMaPycSeed(huong, maDaDung[huong]);
    maDaDung[huong].push(maPyc);

    const ngayYc = dayOffsetISO(ngay);
    const thoiHanNgay = dayOffsetISO(han);

    phieuStmts.push(
      db
        .prepare(
          `INSERT INTO phieu_yeu_cau
             (ma_pyc, huong, loai_pyc, don_vi_yeu_cau, ngay_yeu_cau, thoi_han,
              noi_dung, phong_thuc_hien, nguoi_thuc_hien_user, tinh_trang,
              uu_tien, nguoi_tao_user, ngay_tao, ngay_cap_nhat)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(maPyc, huong, loai, donVi, ngayYc, thoiHanNgay, noiDung, phongTh, nguoiTh, tinhTrang, uuTien, nguoiTao, ngayYc, ngayYc),
    );
  }
  const phieuResults = await db.batch(phieuStmts);

  const lichSuStmts: D1PreparedStatement[] = [];
  for (let i = 0; i < PHIEU_YEU_CAU.length; i++) {
    const [, , , ngay, , nguoiTao, , nguoiTh, tinhTrang] = PHIEU_YEU_CAU[i];
    const phieuId = phieuResults[i].meta.last_row_id as number;
    const ngayYc = dayOffsetISO(ngay);

    lichSuStmts.push(
      db
        .prepare(
          "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, ghi_chu) VALUES (?, 'moi', ?, ?, ?)",
        )
        .bind(phieuId, `${ngayYc}T08:30:00`, nguoiTao, "Khởi tạo phiếu yêu cầu"),
    );
    soLichSu += 1;

    if (tinhTrang !== "moi") {
      lichSuStmts.push(
        db
          .prepare(
            "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, ghi_chu) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(phieuId, tinhTrang, `${ngayYc}T14:05:00`, nguoiTh, "Cập nhật tình trạng xử lý"),
      );
      soLichSu += 1;
    }
  }
  await db.batch(lichSuStmts);

  return c.json({
    ok: true,
    phongBan: PHONG_BAN.length,
    loaiYeuCau: LOAI_YEU_CAU.length,
    nhanVien: NHAN_VIEN.length,
    phieuYeuCau: PHIEU_YEU_CAU.length,
    lichSuXuLy: soLichSu,
  });
});
