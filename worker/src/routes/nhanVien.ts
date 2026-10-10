// routes/nhanVien.ts - Port 1:1 của blueprints/nhan_vien.py. KHÔNG BAO GIỜ
// trả password/password_hash ra ngoài.
import { Hono } from "hono";
import { CHUC_DANH } from "../lib/constants";
import { hashPassword } from "../lib/crypto";
import { all, first, run } from "../lib/db";
import { nhanVienToDict } from "../lib/serializers";
import { todayISO } from "../lib/time";
import { adminRequired, loginRequired } from "../middleware/auth";
import type { AppEnv } from "../types";

export const nhanVienRoutes = new Hono<AppEnv>();

const MA_CHUC_DANH_HOP_LE = new Set(CHUC_DANH.map((c) => c.id));
const SDT_HOP_LE = /^0\d{9,10}$/;
const EMAIL_HOP_LE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ValidChung {
  hoTen: string;
  email: string;
  maPhong: string;
  soDienThoai: string;
  chucDanh: string;
  nguoiQuanLy: string;
}

function validateChung(data: Record<string, unknown>): [string | null, ValidChung | null] {
  const hoTen = String(data.hoTen ?? "").trim();
  const email = String(data.email ?? "").trim();
  const maPhong = String(data.maPhong ?? "").trim();
  const sdt = String(data.soDienThoai ?? "").trim();
  const chucDanh = String(data.chucDanh ?? "").trim();
  const nguoiQuanLy = String(data.nguoiQuanLy ?? "").trim();

  if (!hoTen) return ["Vui lòng nhập họ tên.", null];
  if (!EMAIL_HOP_LE.test(email)) return ["Email không hợp lệ.", null];
  if (!maPhong) return ["Vui lòng chọn phòng ban.", null];
  if (!SDT_HOP_LE.test(sdt)) return ["Số điện thoại gồm 10-11 số, bắt đầu bằng 0.", null];
  if (!MA_CHUC_DANH_HOP_LE.has(chucDanh)) return ["Chức danh không hợp lệ.", null];

  return [null, { hoTen, email, maPhong, soDienThoai: sdt, chucDanh, nguoiQuanLy }];
}

nhanVienRoutes.get("/", loginRequired(), async (c) => {
  const rows = await all(c.env.DB, "SELECT * FROM nhan_vien ORDER BY ho_ten");
  return c.json(rows.map(nhanVienToDict));
});

nhanVienRoutes.post("/", adminRequired(), async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(data.username ?? "").trim();
  const matKhau = String(data.password ?? "");

  if (!username) return c.json({ error: "Vui lòng nhập tên đăng nhập." }, 400);
  if (matKhau.length < 6) return c.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, 400);

  const [loi, gt] = validateChung(data);
  if (loi) return c.json({ error: loi }, 400);

  const db = c.env.DB;
  if (await first(db, "SELECT 1 FROM nhan_vien WHERE username = ? COLLATE NOCASE", [username])) {
    return c.json({ error: "Tên đăng nhập đã tồn tại." }, 409);
  }
  if (!(await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [gt!.maPhong]))) {
    return c.json({ error: "Phòng ban không tồn tại." }, 400);
  }
  if (gt!.nguoiQuanLy) {
    const ql = await first<{ chuc_danh: string }>(db, "SELECT chuc_danh FROM nhan_vien WHERE username = ?", [
      gt!.nguoiQuanLy,
    ]);
    if (!ql || !["quanly", "admin"].includes(ql.chuc_danh)) {
      return c.json({ error: "Người quản lý không hợp lệ." }, 400);
    }
  }
  if (await first(db, "SELECT 1 FROM nhan_vien WHERE email = ? COLLATE NOCASE", [gt!.email])) {
    return c.json({ error: "Email đã được dùng bởi tài khoản khác." }, 409);
  }

  const ngayTao = String(data.ngayTao ?? "").trim() || todayISO();
  await run(
    db,
    "INSERT INTO nhan_vien (username, password_hash, ho_ten, email, ma_phong, so_dien_thoai, chuc_danh, nguoi_quan_ly, ngay_tao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      username,
      await hashPassword(matKhau),
      gt!.hoTen,
      gt!.email,
      gt!.maPhong,
      gt!.soDienThoai,
      gt!.chucDanh,
      gt!.nguoiQuanLy || null,
      ngayTao,
    ],
  );
  const row = await first(db, "SELECT * FROM nhan_vien WHERE username = ?", [username]);
  return c.json(nhanVienToDict(row!), 201);
});

nhanVienRoutes.put("/:username", adminRequired(), async (c) => {
  const username = c.req.param("username");
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  const db = c.env.DB;
  const hienCo = await first<{ ngay_tao: string }>(db, "SELECT * FROM nhan_vien WHERE username = ?", [username]);
  if (!hienCo) return c.json({ error: "Không tìm thấy nhân viên." }, 404);

  const [loi, gt] = validateChung(data);
  if (loi) return c.json({ error: loi }, 400);

  if (!(await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [gt!.maPhong]))) {
    return c.json({ error: "Phòng ban không tồn tại." }, 400);
  }
  if (gt!.nguoiQuanLy) {
    if (gt!.nguoiQuanLy === username) {
      return c.json({ error: "Nhân viên không thể là người quản lý của chính mình." }, 400);
    }
    const ql = await first<{ chuc_danh: string }>(db, "SELECT chuc_danh FROM nhan_vien WHERE username = ?", [
      gt!.nguoiQuanLy,
    ]);
    if (!ql || !["quanly", "admin"].includes(ql.chuc_danh)) {
      return c.json({ error: "Người quản lý không hợp lệ." }, 400);
    }
  }

  const emailTrung = await first(db, "SELECT 1 FROM nhan_vien WHERE email = ? COLLATE NOCASE AND username != ?", [
    gt!.email,
    username,
  ]);
  if (emailTrung) return c.json({ error: "Email đã được dùng bởi tài khoản khác." }, 409);

  const matKhauMoi = String(data.password ?? "");
  if (matKhauMoi) {
    if (matKhauMoi.length < 6) return c.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, 400);
    await run(db, "UPDATE nhan_vien SET password_hash = ? WHERE username = ?", [
      await hashPassword(matKhauMoi),
      username,
    ]);
  }

  const ngayTao = String(data.ngayTao ?? "").trim() || hienCo.ngay_tao;
  await run(
    db,
    "UPDATE nhan_vien SET ho_ten = ?, email = ?, ma_phong = ?, so_dien_thoai = ?, chuc_danh = ?, nguoi_quan_ly = ?, ngay_tao = ? WHERE username = ?",
    [gt!.hoTen, gt!.email, gt!.maPhong, gt!.soDienThoai, gt!.chucDanh, gt!.nguoiQuanLy || null, ngayTao, username],
  );
  const row = await first(db, "SELECT * FROM nhan_vien WHERE username = ?", [username]);
  return c.json(nhanVienToDict(row!));
});

nhanVienRoutes.delete("/:username", adminRequired(), async (c) => {
  const username = c.req.param("username");
  const user = c.get("user");
  if (username === user.username) {
    return c.json({ error: "Không thể xoá tài khoản đang đăng nhập." }, 400);
  }

  const db = c.env.DB;
  if (!(await first(db, "SELECT 1 FROM nhan_vien WHERE username = ?", [username]))) {
    return c.json({ error: "Không tìm thấy nhân viên." }, 404);
  }

  const soCapDuoi = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM nhan_vien WHERE nguoi_quan_ly = ?", [
    username,
  ]);
  if (soCapDuoi && soCapDuoi.n > 0) {
    return c.json({ error: `Không thể xoá: đang là người quản lý của ${soCapDuoi.n} nhân viên.` }, 409);
  }

  const dangLienQuanPhieu = await first(
    db,
    "SELECT 1 FROM phieu_yeu_cau WHERE nguoi_tao_user = ? OR nguoi_thuc_hien_user = ?",
    [username, username],
  );
  if (dangLienQuanPhieu) {
    return c.json({ error: "Không thể xoá: nhân viên này đang gắn với ít nhất một phiếu yêu cầu." }, 409);
  }

  await run(db, "DELETE FROM nhan_vien WHERE username = ?", [username]);
  return c.json({ ok: true });
});
