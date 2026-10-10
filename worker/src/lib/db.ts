// db.ts - Tiện ích D1 dùng chung + các cascade đổi mã (ma_phong/ma_loai)
// mà bản Flask dựa vào "ON UPDATE CASCADE" của SQLite. D1 không đảm bảo
// PRAGMA foreign_keys bật xuyên suốt mọi lệnh gọi nên cascade được viết rõ
// ràng ở đây, gói trong 1 batch() để vẫn atomic (tất cả thành công hoặc
// không gì được ghi).
import type { Env } from "../types";

export async function first<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const row = await db
    .prepare(sql)
    .bind(...params)
    .first();
  return (row as T) ?? null;
}

export async function all<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await db
    .prepare(sql)
    .bind(...params)
    .all();
  return (res.results as T[]) ?? [];
}

export async function run(db: D1Database, sql: string, params: unknown[] = []) {
  return db
    .prepare(sql)
    .bind(...params)
    .run();
}

/** Đổi mã phòng ban + cascade sang nhan_vien.ma_phong và
 * phieu_yeu_cau.phong_thuc_hien.
 *
 * KHÔNG thể UPDATE trực tiếp cột khoá chính ma_phong khi mã đổi: D1 kiểm
 * tra FOREIGN KEY ngay lập tức theo từng câu lệnh (không có "ON UPDATE
 * CASCADE" thật, và cũng không có cách bật "defer" qua API batch()) - UPDATE
 * phong_ban trước sẽ làm nhan_vien/phieu_yeu_cau đang trỏ tới ma_phong cũ vi
 * phạm FK ngay tức khắc. Thay vào đó: chèn phòng mới trước, chuyển toàn bộ
 * bản ghi con sang phòng mới, rồi mới xoá phòng cũ - mỗi câu lệnh riêng lẻ
 * đều giữ đúng ràng buộc FK tại mọi thời điểm. */
export async function renamePhongBan(
  db: D1Database,
  maCu: string,
  maMoi: string,
  tenPhong: string,
  truongPhong: string,
  ghiChu: string,
): Promise<void> {
  if (maMoi === maCu) {
    await run(db, "UPDATE phong_ban SET ten_phong = ?, truong_phong = ?, ghi_chu = ? WHERE ma_phong = ?", [
      tenPhong,
      truongPhong,
      ghiChu,
      maCu,
    ]);
    return;
  }

  const cu = await first<{ ngay_tao: string }>(db, "SELECT ngay_tao FROM phong_ban WHERE ma_phong = ?", [maCu]);
  await db.batch([
    db
      .prepare("INSERT INTO phong_ban (ma_phong, ten_phong, truong_phong, ghi_chu, ngay_tao) VALUES (?, ?, ?, ?, ?)")
      .bind(maMoi, tenPhong, truongPhong, ghiChu, cu?.ngay_tao),
    db.prepare("UPDATE nhan_vien SET ma_phong = ? WHERE ma_phong = ?").bind(maMoi, maCu),
    db.prepare("UPDATE phieu_yeu_cau SET phong_thuc_hien = ? WHERE phong_thuc_hien = ?").bind(maMoi, maCu),
    db.prepare("DELETE FROM phong_ban WHERE ma_phong = ?").bind(maCu),
  ]);
}

/** Đổi mã loại yêu cầu + cascade sang phieu_yeu_cau.loai_pyc - cùng lý do
 * và cách làm như renamePhongBan() ở trên. */
export async function renameLoaiYeuCau(
  db: D1Database,
  maCu: string,
  maMoi: string,
  ten: string,
  moTa: string,
): Promise<void> {
  if (maMoi === maCu) {
    await run(db, "UPDATE loai_yeu_cau SET ten = ?, mo_ta = ? WHERE ma_loai = ?", [ten, moTa, maCu]);
    return;
  }

  const cu = await first<{ ngay_tao: string }>(db, "SELECT ngay_tao FROM loai_yeu_cau WHERE ma_loai = ?", [maCu]);
  await db.batch([
    db
      .prepare("INSERT INTO loai_yeu_cau (ma_loai, ten, mo_ta, ngay_tao) VALUES (?, ?, ?, ?)")
      .bind(maMoi, ten, moTa, cu?.ngay_tao),
    db.prepare("UPDATE phieu_yeu_cau SET loai_pyc = ? WHERE loai_pyc = ?").bind(maMoi, maCu),
    db.prepare("DELETE FROM loai_yeu_cau WHERE ma_loai = ?").bind(maCu),
  ]);
}
