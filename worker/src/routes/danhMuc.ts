// routes/danhMuc.ts - Port 1:1 của blueprints/danh_muc.py.
import { Hono } from "hono";
import { first, renameLoaiYeuCau, renamePhongBan, run } from "../lib/db";
import { loaiYeuCauToDict, phongBanToDict } from "../lib/serializers";
import { adminRequired, loginRequired } from "../middleware/auth";
import type { AppEnv } from "../types";

export const danhMucRoutes = new Hono<AppEnv>();

// =====================================================
// Phòng ban
// =====================================================

danhMucRoutes.get("/phong-ban", loginRequired(), async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM phong_ban ORDER BY ma_phong").all();
  return c.json((rows.results as Record<string, any>[]).map(phongBanToDict));
});

danhMucRoutes.post("/phong-ban", adminRequired(), async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const ma = String(data.maPhong ?? "").trim().toUpperCase();
  const ten = String(data.tenPhong ?? "").trim();

  if (!ma) return c.json({ error: "Vui lòng nhập mã phòng." }, 400);
  if (!ten) return c.json({ error: "Vui lòng nhập tên phòng." }, 400);

  const db = c.env.DB;
  if (await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [ma])) {
    return c.json({ error: "Mã phòng đã tồn tại." }, 409);
  }

  await run(db, "INSERT INTO phong_ban (ma_phong, ten_phong, truong_phong, ghi_chu) VALUES (?, ?, ?, ?)", [
    ma,
    ten,
    String(data.truongPhong ?? "").trim(),
    String(data.ghiChu ?? "").trim(),
  ]);
  const row = await first(db, "SELECT * FROM phong_ban WHERE ma_phong = ?", [ma]);
  return c.json(phongBanToDict(row!), 201);
});

danhMucRoutes.put("/phong-ban/:maPhongCu", adminRequired(), async (c) => {
  const maPhongCu = c.req.param("maPhongCu");
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const maMoi = String(data.maPhong ?? "").trim().toUpperCase();
  const ten = String(data.tenPhong ?? "").trim();

  if (!maMoi) return c.json({ error: "Vui lòng nhập mã phòng." }, 400);
  if (!ten) return c.json({ error: "Vui lòng nhập tên phòng." }, 400);

  const db = c.env.DB;
  if (!(await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [maPhongCu]))) {
    return c.json({ error: "Không tìm thấy phòng ban." }, 404);
  }
  if (maMoi !== maPhongCu && (await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [maMoi]))) {
    return c.json({ error: "Mã phòng đã tồn tại." }, 409);
  }

  await renamePhongBan(db, maPhongCu, maMoi, ten, String(data.truongPhong ?? "").trim(), String(data.ghiChu ?? "").trim());
  const row = await first(db, "SELECT * FROM phong_ban WHERE ma_phong = ?", [maMoi]);
  return c.json(phongBanToDict(row!));
});

danhMucRoutes.delete("/phong-ban/:maPhong", adminRequired(), async (c) => {
  const maPhong = c.req.param("maPhong");
  const db = c.env.DB;
  const dangDung = await first(
    db,
    "SELECT 1 FROM nhan_vien WHERE ma_phong = ? UNION SELECT 1 FROM phieu_yeu_cau WHERE phong_thuc_hien = ? OR don_vi_yeu_cau = ?",
    [maPhong, maPhong, maPhong],
  );
  if (dangDung) {
    return c.json({ error: "Không thể xoá: phòng đang được dùng ở nhân viên hoặc phiếu yêu cầu." }, 409);
  }

  await run(db, "DELETE FROM phong_ban WHERE ma_phong = ?", [maPhong]);
  return c.json({ ok: true });
});

// =====================================================
// Loại yêu cầu
// =====================================================

const MA_LOAI_HOP_LE = /^[a-z0-9_]{2,20}$/;

function chuanHoaMaLoai(raw: unknown): string {
  let ma = String(raw ?? "").trim().toLowerCase();
  ma = ma.replace(/\s+/g, "_");
  return ma.replace(/[^a-z0-9_]/g, "");
}

danhMucRoutes.get("/loai-yeu-cau", loginRequired(), async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM loai_yeu_cau ORDER BY ma_loai").all();
  return c.json((rows.results as Record<string, any>[]).map(loaiYeuCauToDict));
});

danhMucRoutes.post("/loai-yeu-cau", adminRequired(), async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const ma = chuanHoaMaLoai(data.ma);
  const ten = String(data.ten ?? "").trim();

  if (!MA_LOAI_HOP_LE.test(ma)) {
    return c.json({ error: "Mã loại gồm 2-20 ký tự chữ thường, số hoặc gạch dưới." }, 400);
  }
  if (!ten) return c.json({ error: "Vui lòng nhập tên loại yêu cầu." }, 400);

  const db = c.env.DB;
  if (await first(db, "SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", [ma])) {
    return c.json({ error: "Mã loại đã tồn tại." }, 409);
  }

  await run(db, "INSERT INTO loai_yeu_cau (ma_loai, ten, mo_ta) VALUES (?, ?, ?)", [
    ma,
    ten,
    String(data.moTa ?? "").trim(),
  ]);
  const row = await first(db, "SELECT * FROM loai_yeu_cau WHERE ma_loai = ?", [ma]);
  return c.json(loaiYeuCauToDict(row!), 201);
});

danhMucRoutes.put("/loai-yeu-cau/:maLoaiCu", adminRequired(), async (c) => {
  const maLoaiCu = c.req.param("maLoaiCu");
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const maMoi = chuanHoaMaLoai(data.ma);
  const ten = String(data.ten ?? "").trim();

  if (!MA_LOAI_HOP_LE.test(maMoi)) {
    return c.json({ error: "Mã loại gồm 2-20 ký tự chữ thường, số hoặc gạch dưới." }, 400);
  }
  if (!ten) return c.json({ error: "Vui lòng nhập tên loại yêu cầu." }, 400);

  const db = c.env.DB;
  if (!(await first(db, "SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", [maLoaiCu]))) {
    return c.json({ error: "Không tìm thấy loại yêu cầu." }, 404);
  }
  if (maMoi !== maLoaiCu && (await first(db, "SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", [maMoi]))) {
    return c.json({ error: "Mã loại đã tồn tại." }, 409);
  }

  await renameLoaiYeuCau(db, maLoaiCu, maMoi, ten, String(data.moTa ?? "").trim());
  const row = await first(db, "SELECT * FROM loai_yeu_cau WHERE ma_loai = ?", [maMoi]);
  return c.json(loaiYeuCauToDict(row!));
});

danhMucRoutes.delete("/loai-yeu-cau/:maLoai", adminRequired(), async (c) => {
  const maLoai = c.req.param("maLoai");
  const db = c.env.DB;
  if (await first(db, "SELECT 1 FROM phieu_yeu_cau WHERE loai_pyc = ?", [maLoai])) {
    return c.json({ error: "Không thể xoá: loại yêu cầu đang được dùng ở phiếu yêu cầu." }, 409);
  }

  await run(db, "DELETE FROM loai_yeu_cau WHERE ma_loai = ?", [maLoai]);
  return c.json({ ok: true });
});
