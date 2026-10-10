// repoPhieu.ts - Port 1:1 của repo_phieu.py: toàn bộ SQL của phiếu yêu cầu,
// lịch sử xử lý, tệp đính kèm, thông báo. Các route trong routes/phieuYeuCau.ts
// chỉ gọi hàm ở đây, không tự viết SQL (giữ đúng kiến trúc gốc).
import { nhan, TINH_TRANG } from "./constants";
import { all, first, run } from "./db";
import { deleteFileFromR2, FileTooLargeError, saveFileToR2 } from "./files";
import { lichSuToDict, phieuYeuCauToDict, tepDinhKemToDict } from "./serializers";
import { currentYear, nowISO, todayISO } from "./time";
import type { Env, LichSu, NhanVien, PhieuYeuCau, TepDinhKem, TicketPermDict } from "../types";

export { FileTooLargeError };

export async function sinhMaPyc(db: D1Database, huong: "di" | "den"): Promise<string> {
  const nam = currentYear();
  const tienTo = `YC${huong === "di" ? "D" : "N"}-${nam}-`;
  const rows = await all<{ ma_pyc: string }>(db, "SELECT ma_pyc FROM phieu_yeu_cau WHERE ma_pyc LIKE ?", [
    `${tienTo}%`,
  ]);
  let maxSo = 0;
  for (const r of rows) {
    const so = parseInt(r.ma_pyc.slice(tienTo.length), 10);
    if (!Number.isNaN(so)) maxSo = Math.max(maxSo, so);
  }
  return `${tienTo}${String(maxSo + 1).padStart(4, "0")}`;
}

const TICKET_JOIN_SQL = `
  SELECT p.*, u1.ho_ten AS ten_nguoi_tao, u1.ma_phong AS ma_phong_nguoi_tao,
         u2.ho_ten AS ten_nguoi_thuc_hien
  FROM phieu_yeu_cau p
  JOIN nhan_vien u1 ON p.nguoi_tao_user = u1.username
  LEFT JOIN nhan_vien u2 ON p.nguoi_thuc_hien_user = u2.username
`;

async function lichSuChoCacPhieu(db: D1Database, phieuIds: number[]): Promise<Map<number, LichSu[]>> {
  const ketQua = new Map<number, LichSu[]>();
  if (phieuIds.length === 0) return ketQua;
  const choGiu = phieuIds.map(() => "?").join(",");
  const rows = await all(
    db,
    `SELECT l.*, u.ho_ten AS ten_nguoi
     FROM lich_su_xu_ly l
     LEFT JOIN nhan_vien u ON l.nguoi_user = u.username
     WHERE l.phieu_id IN (${choGiu})
     ORDER BY l.id`,
    phieuIds,
  );
  const filesTheoLichSu = await filesChoCacLichSu(db, rows.map((r) => r.id));
  for (const r of rows) {
    const list = ketQua.get(r.phieu_id) ?? [];
    list.push(lichSuToDict(r, filesTheoLichSu.get(r.id) ?? []));
    ketQua.set(r.phieu_id, list);
  }
  return ketQua;
}

async function filesChoCacPhieu(db: D1Database, phieuIds: number[]): Promise<Map<number, TepDinhKem[]>> {
  const ketQua = new Map<number, TepDinhKem[]>();
  if (phieuIds.length === 0) return ketQua;
  const choGiu = phieuIds.map(() => "?").join(",");
  const rows = await all(
    db,
    `SELECT t.*, u.ho_ten AS ten_nguoi_tai
     FROM tep_dinh_kem t
     LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username
     WHERE t.phieu_id IN (${choGiu})
     ORDER BY t.id`,
    phieuIds,
  );
  for (const r of rows) {
    const list = ketQua.get(r.phieu_id) ?? [];
    list.push(tepDinhKemToDict(r));
    ketQua.set(r.phieu_id, list);
  }
  return ketQua;
}

async function filesChoCacLichSu(db: D1Database, lichSuIds: number[]): Promise<Map<number, TepDinhKem[]>> {
  const ketQua = new Map<number, TepDinhKem[]>();
  if (lichSuIds.length === 0) return ketQua;
  const choGiu = lichSuIds.map(() => "?").join(",");
  const rows = await all(
    db,
    `SELECT t.*, u.ho_ten AS ten_nguoi_tai
     FROM tep_dinh_kem t
     LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username
     WHERE t.lich_su_id IN (${choGiu})
     ORDER BY t.id`,
    lichSuIds,
  );
  for (const r of rows) {
    const list = ketQua.get(r.lich_su_id) ?? [];
    list.push(tepDinhKemToDict(r));
    ketQua.set(r.lich_su_id, list);
  }
  return ketQua;
}

export async function listTickets(
  db: D1Database,
  whereSql: string,
  whereParams: unknown[],
): Promise<PhieuYeuCau[]> {
  const rows = await all(db, `${TICKET_JOIN_SQL} WHERE ${whereSql} ORDER BY p.id`, whereParams);
  const ids = rows.map((r) => r.id);
  const lichSu = await lichSuChoCacPhieu(db, ids);
  const files = await filesChoCacPhieu(db, ids);
  return rows.map((r) => phieuYeuCauToDict(r, lichSu.get(r.id) ?? [], files.get(r.id) ?? []));
}

export async function getTicketRow(db: D1Database, ticketId: number): Promise<Record<string, any> | null> {
  return first(db, `${TICKET_JOIN_SQL} WHERE p.id = ?`, [ticketId]);
}

export async function getTicketDict(db: D1Database, ticketId: number): Promise<PhieuYeuCau | null> {
  const row = await getTicketRow(db, ticketId);
  if (!row) return null;
  const lichSu = await lichSuChoCacPhieu(db, [ticketId]);
  const files = await filesChoCacPhieu(db, [ticketId]);
  return phieuYeuCauToDict(row, lichSu.get(ticketId) ?? [], files.get(ticketId) ?? []);
}

export function rowToPermDict(row: Record<string, any>): TicketPermDict {
  return {
    nguoiTaoUser: row.nguoi_tao_user,
    nguoiThucHienUser: row.nguoi_thuc_hien_user || "",
    phongThucHien: row.phong_thuc_hien,
    tinhTrang: row.tinh_trang,
    _nguoiTaoMaPhong: row.ma_phong_nguoi_tao,
  };
}

// =====================================================
// Ghi dữ liệu
// =====================================================

async function quanLyCuaPhong(db: D1Database, maPhong: string): Promise<string[]> {
  const rows = await all<{ username: string }>(
    db,
    "SELECT username FROM nhan_vien WHERE ma_phong = ? AND chuc_danh = 'quanly'",
    [maPhong],
  );
  return rows.map((r) => r.username);
}

async function taoThongBao(
  db: D1Database,
  ticketDict: PhieuYeuCau,
  actorUsername: string,
  noiDung: string,
): Promise<void> {
  const nguoiNhan = new Set<string>();
  if (ticketDict.nguoiTaoUser) nguoiNhan.add(ticketDict.nguoiTaoUser);
  if (ticketDict.nguoiThucHienUser) nguoiNhan.add(ticketDict.nguoiThucHienUser);
  for (const u of await quanLyCuaPhong(db, ticketDict.phongThucHien)) nguoiNhan.add(u);
  nguoiNhan.delete(actorUsername);

  if (nguoiNhan.size === 0) return;
  const thoiGian = nowISO();
  const stmts = Array.from(nguoiNhan).map((username) =>
    db
      .prepare(
        "INSERT INTO thong_bao (phieu_id, nguoi_nhan_user, noi_dung, tinh_trang, thoi_gian, da_xem) VALUES (?, ?, ?, ?, ?, 0)",
      )
      .bind(Number(ticketDict.id), username, noiDung, ticketDict.tinhTrang, thoiGian),
  );
  await db.batch(stmts);
}

export interface TicketInput {
  huong: "di" | "den";
  donViYeuCau: string;
  ngayYeuCau: string;
  thoiHan: string;
  noiDung: string;
  phongThucHien: string;
  loaiPYC: string;
  nguoiThucHienUser: string | null;
  uuTien: string;
}

export async function createTicket(db: D1Database, user: NhanVien, data: TicketInput): Promise<PhieuYeuCau> {
  const maPyc = await sinhMaPyc(db, data.huong);
  const homNay = todayISO();

  const insertTicket = await run(
    db,
    `INSERT INTO phieu_yeu_cau
        (ma_pyc, huong, loai_pyc, don_vi_yeu_cau, ngay_yeu_cau, thoi_han,
         noi_dung, phong_thuc_hien, nguoi_thuc_hien_user, tinh_trang,
         uu_tien, nguoi_tao_user, ngay_tao, ngay_cap_nhat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'moi', ?, ?, ?, ?)`,
    [
      maPyc,
      data.huong,
      data.loaiPYC,
      data.donViYeuCau,
      data.ngayYeuCau,
      data.thoiHan,
      data.noiDung,
      data.phongThucHien,
      data.nguoiThucHienUser || null,
      data.uuTien || "binhthuong",
      user.username,
      homNay,
      homNay,
    ],
  );
  const phieuId = insertTicket.meta.last_row_id as number;

  await run(
    db,
    "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) VALUES (?, 'moi', ?, ?, 'Người tạo phiếu', ?)",
    [phieuId, nowISO(), user.username, "Khởi tạo phiếu yêu cầu"],
  );

  const ticketDict = (await getTicketDict(db, phieuId))!;
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} mới được tạo, chờ tiếp nhận`);
  return ticketDict;
}

export async function updateTicket(
  db: D1Database,
  ticketId: number,
  data: TicketInput,
): Promise<PhieuYeuCau> {
  const homNay = todayISO();
  await run(
    db,
    `UPDATE phieu_yeu_cau SET
        loai_pyc = ?, don_vi_yeu_cau = ?, ngay_yeu_cau = ?, thoi_han = ?,
        noi_dung = ?, phong_thuc_hien = ?, nguoi_thuc_hien_user = ?,
        uu_tien = ?, ngay_cap_nhat = ?
     WHERE id = ?`,
    [
      data.loaiPYC,
      data.donViYeuCau,
      data.ngayYeuCau,
      data.thoiHan,
      data.noiDung,
      data.phongThucHien,
      data.nguoiThucHienUser || null,
      data.uuTien || "binhthuong",
      homNay,
      ticketId,
    ],
  );
  return (await getTicketDict(db, ticketId))!;
}

/** Xoá phiếu + cascade (lịch sử/tệp/thông báo) - KHÔNG có ON DELETE CASCADE
 * trong D1 nên xoá rõ ràng từng bảng con, và xoá cả object R2 của mọi tệp
 * liên quan (cải tiến so với bản Flask - bản đó để tệp mồ côi trên đĩa). */
export async function deleteTicket(db: D1Database, env: Env, ticketId: number): Promise<void> {
  const files = await all<{ duong_dan: string }>(
    db,
    `SELECT duong_dan FROM tep_dinh_kem
     WHERE phieu_id = ? OR lich_su_id IN (SELECT id FROM lich_su_xu_ly WHERE phieu_id = ?)`,
    [ticketId, ticketId],
  );
  await Promise.all(files.map((f) => deleteFileFromR2(env, f.duong_dan)));

  await db.batch([
    db.prepare(
      "DELETE FROM tep_dinh_kem WHERE phieu_id = ? OR lich_su_id IN (SELECT id FROM lich_su_xu_ly WHERE phieu_id = ?)",
    ).bind(ticketId, ticketId),
    db.prepare("DELETE FROM thong_bao WHERE phieu_id = ?").bind(ticketId),
    db.prepare("DELETE FROM lich_su_xu_ly WHERE phieu_id = ?").bind(ticketId),
    db.prepare("DELETE FROM phieu_yeu_cau WHERE id = ?").bind(ticketId),
  ]);
}

export async function updateStatus(
  db: D1Database,
  env: Env,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
  tinhTrangMoi: string,
  ghiChu: string,
  vaiTro: string | null,
  files: File[],
): Promise<{ ticket: PhieuYeuCau; tepQuaLon: string[] }> {
  const homNay = todayISO();
  const [, lichSuRes] = await db.batch([
    db.prepare("UPDATE phieu_yeu_cau SET tinh_trang = ?, ngay_cap_nhat = ? WHERE id = ?").bind(
      tinhTrangMoi,
      homNay,
      ticketId,
    ),
    db
      .prepare(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(ticketId, tinhTrangMoi, nowISO(), user.username, vaiTro, ghiChu || "Cập nhật tình trạng"),
  ]);
  const lichSuId = lichSuRes.meta.last_row_id as number;

  const tepQuaLon: string[] = [];
  const insertStmts: D1PreparedStatement[] = [];
  for (const f of files) {
    if (!f || !f.name) continue;
    try {
      const tt = await saveFileToR2(env, maPyc, f);
      insertStmts.push(
        db
          .prepare(
            "INSERT INTO tep_dinh_kem (lich_su_id, ten_tep, kich_thuoc, loai_mime, duong_dan, nguoi_tai_user, ngay_tai) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(lichSuId, tt.tenTep, tt.kichThuoc, tt.loaiMime, tt.duongDan, user.username, nowISO()),
      );
    } catch (e) {
      if (e instanceof FileTooLargeError) {
        tepQuaLon.push(e.tenTep);
        continue;
      }
      throw e;
    }
  }
  if (insertStmts.length > 0) await db.batch(insertStmts);

  const ticketDict = (await getTicketDict(db, ticketId))!;
  const nhanTt = nhan(TINH_TRANG, tinhTrangMoi);
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} chuyển sang "${nhanTt}"`);
  return { ticket: ticketDict, tepQuaLon };
}

export async function assignExecutor(
  db: D1Database,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
  nguoiThucHienUser: string,
): Promise<PhieuYeuCau> {
  const homNay = todayISO();
  const hoTenRow = await first<{ ho_ten: string }>(db, "SELECT ho_ten FROM nhan_vien WHERE username = ?", [
    nguoiThucHienUser,
  ]);
  const hoTen = hoTenRow!.ho_ten;
  const ticketRow = (await getTicketRow(db, ticketId))!;

  await db.batch([
    db
      .prepare("UPDATE phieu_yeu_cau SET nguoi_thuc_hien_user = ?, ngay_cap_nhat = ? WHERE id = ?")
      .bind(nguoiThucHienUser, homNay, ticketId),
    db
      .prepare(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu, nhan_su_kien) VALUES (?, ?, ?, ?, ?, ?, 'Phân công')",
      )
      .bind(
        ticketId,
        ticketRow.tinh_trang,
        nowISO(),
        user.username,
        "Quản lý phòng thực hiện",
        `Phân công người thực hiện: ${hoTen}`,
      ),
  ]);

  const ticketDict = (await getTicketDict(db, ticketId))!;
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} được phân công cho ${hoTen}`);
  return ticketDict;
}

export async function rejectIntake(
  db: D1Database,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
  lyDo: string,
): Promise<PhieuYeuCau> {
  const homNay = todayISO();
  await db.batch([
    db
      .prepare("UPDATE phieu_yeu_cau SET tinh_trang = 'tuchoi_tiepnhan', ngay_cap_nhat = ? WHERE id = ?")
      .bind(homNay, ticketId),
    db
      .prepare(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) VALUES (?, 'tuchoi_tiepnhan', ?, ?, ?, ?)",
      )
      .bind(ticketId, nowISO(), user.username, "Quản lý phòng thực hiện", lyDo),
  ]);

  const ticketDict = (await getTicketDict(db, ticketId))!;
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} bị từ chối tiếp nhận: ${lyDo}`);
  return ticketDict;
}

export async function declineAssignment(
  db: D1Database,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
  lyDo: string,
): Promise<PhieuYeuCau> {
  const homNay = todayISO();
  const ticketRow = (await getTicketRow(db, ticketId))!;

  await db.batch([
    db
      .prepare("UPDATE phieu_yeu_cau SET nguoi_thuc_hien_user = NULL, ngay_cap_nhat = ? WHERE id = ?")
      .bind(homNay, ticketId),
    db
      .prepare(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu, nhan_su_kien) VALUES (?, ?, ?, ?, ?, ?, 'Từ chối thực hiện')",
      )
      .bind(ticketId, ticketRow.tinh_trang, nowISO(), user.username, "Người thực hiện", `Từ chối thực hiện: ${lyDo}`),
  ]);

  const ticketDict = (await getTicketDict(db, ticketId))!;
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} bị từ chối thực hiện, cần phân công lại`);
  return ticketDict;
}

export async function sendToRequester(
  db: D1Database,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
): Promise<PhieuYeuCau> {
  const homNay = todayISO();
  await db.batch([
    db.prepare("UPDATE phieu_yeu_cau SET tinh_trang = 'choduyet', ngay_cap_nhat = ? WHERE id = ?").bind(
      homNay,
      ticketId,
    ),
    db
      .prepare(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) VALUES (?, 'choduyet', ?, ?, ?, ?)",
      )
      .bind(ticketId, nowISO(), user.username, "Quản lý phòng thực hiện", "Gửi kết quả cho đơn vị yêu cầu"),
  ]);

  const ticketDict = (await getTicketDict(db, ticketId))!;
  await taoThongBao(db, ticketDict, user.username, `Phiếu ${maPyc} đã gửi kết quả cho đơn vị yêu cầu`);
  return ticketDict;
}

export async function addTicketFiles(
  db: D1Database,
  env: Env,
  user: NhanVien,
  ticketId: number,
  maPyc: string,
  files: File[],
): Promise<{ files: TepDinhKem[]; tepQuaLon: string[] }> {
  const tepQuaLon: string[] = [];
  const insertStmts: D1PreparedStatement[] = [];
  for (const f of files) {
    if (!f || !f.name) continue;
    try {
      const tt = await saveFileToR2(env, maPyc, f);
      insertStmts.push(
        db
          .prepare(
            "INSERT INTO tep_dinh_kem (phieu_id, ten_tep, kich_thuoc, loai_mime, duong_dan, nguoi_tai_user, ngay_tai) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(ticketId, tt.tenTep, tt.kichThuoc, tt.loaiMime, tt.duongDan, user.username, nowISO()),
      );
    } catch (e) {
      if (e instanceof FileTooLargeError) {
        tepQuaLon.push(e.tenTep);
        continue;
      }
      throw e;
    }
  }
  if (insertStmts.length === 0) return { files: [], tepQuaLon };

  const results = await db.batch(insertStmts);
  const idsDaThem = results.map((r) => r.meta.last_row_id as number);

  const choGiu = idsDaThem.map(() => "?").join(",");
  const rows = await all(
    db,
    `SELECT t.*, u.ho_ten AS ten_nguoi_tai FROM tep_dinh_kem t
     LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username WHERE t.id IN (${choGiu})`,
    idsDaThem,
  );
  return { files: rows.map((r) => tepDinhKemToDict(r)), tepQuaLon };
}

export async function getFileRow(db: D1Database, fileId: number): Promise<Record<string, any> | null> {
  return first(db, "SELECT * FROM tep_dinh_kem WHERE id = ?", [fileId]);
}

export async function isLichSuHienTai(
  db: D1Database,
  phieuId: number,
  tinhTrangHienTai: string,
  lichSuId: number,
): Promise<boolean> {
  const rows = await all<{ id: number; tinh_trang: string }>(
    db,
    "SELECT id, tinh_trang FROM lich_su_xu_ly WHERE phieu_id = ? ORDER BY id DESC",
    [phieuId],
  );
  for (const r of rows) {
    if (r.tinh_trang !== tinhTrangHienTai) break;
    if (r.id === lichSuId) return true;
  }
  return false;
}

export async function deleteFile(db: D1Database, env: Env, fileId: number): Promise<void> {
  const row = await getFileRow(db, fileId);
  if (row) await deleteFileFromR2(env, row.duong_dan);
  await run(db, "DELETE FROM tep_dinh_kem WHERE id = ?", [fileId]);
}
