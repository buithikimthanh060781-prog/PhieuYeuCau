// routes/phieuYeuCau.ts - Port 1:1 của blueprints/phieu_yeu_cau.py. Đây là
// nơi các quy tắc trong lib/permissions.ts THỰC SỰ có hiệu lực - mọi request
// ghi dữ liệu được kiểm tra lại ở đây bất kể trình duyệt gửi gì lên.
import { Hono } from "hono";
import { first } from "../lib/db";
import { getFileFromR2 } from "../lib/files";
import * as perm from "../lib/permissions";
import * as repo from "../lib/repoPhieu";
import { UU_TIEN } from "../lib/constants";
import { loginRequired } from "../middleware/auth";
import type { AppEnv, TicketPermDict } from "../types";

export const phieuYeuCauRoutes = new Hono<AppEnv>();

const MA_UU_TIEN_HOP_LE = new Set(UU_TIEN.map((s) => s.id));

interface ValidPhieu {
  donViYeuCau: string;
  ngayYeuCau: string;
  thoiHan: string;
  noiDung: string;
  phongThucHien: string;
  loaiPYC: string;
  nguoiThucHienUser: string;
  uuTien: string;
}

async function validatePhieu(
  db: D1Database,
  data: Record<string, unknown>,
): Promise<[string | null, ValidPhieu | null]> {
  const donVi = String(data.donViYeuCau ?? "").trim();
  const ngayYc = String(data.ngayYeuCau ?? "").trim();
  const thoiHan = String(data.thoiHan ?? "").trim();
  const noiDung = String(data.noiDung ?? "").trim();
  const phongTh = String(data.phongThucHien ?? "").trim();
  const loai = String(data.loaiPYC ?? "").trim();
  const nguoiTh = String(data.nguoiThucHienUser ?? "").trim();
  let uuTien = String(data.uuTien ?? "binhthuong").trim();

  if (!donVi) return ["Vui lòng nhập đơn vị yêu cầu.", null];
  if (!ngayYc) return ["Vui lòng chọn ngày yêu cầu.", null];
  if (!thoiHan) return ["Vui lòng chọn thời hạn.", null];
  if (thoiHan < ngayYc) return ["Thời hạn phải sau ngày yêu cầu.", null];
  if (noiDung.length < 10) return ["Nội dung tối thiểu 10 ký tự.", null];
  if (!phongTh) return ["Vui lòng chọn phòng thực hiện.", null];
  if (!(await first(db, "SELECT 1 FROM phong_ban WHERE ma_phong = ?", [phongTh]))) {
    return ["Phòng thực hiện không tồn tại.", null];
  }
  if (!(await first(db, "SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", [loai]))) {
    return ["Loại yêu cầu không tồn tại.", null];
  }
  if (nguoiTh && !(await first(db, "SELECT 1 FROM nhan_vien WHERE username = ?", [nguoiTh]))) {
    return ["Người thực hiện không tồn tại.", null];
  }
  if (!MA_UU_TIEN_HOP_LE.has(uuTien)) uuTien = "binhthuong";

  return [
    null,
    { donViYeuCau: donVi, ngayYeuCau: ngayYc, thoiHan, noiDung, phongThucHien: phongTh, loaiPYC: loai, nguoiThucHienUser: nguoiTh, uuTien },
  ];
}

async function layPhieu(
  db: D1Database,
  ticketId: number,
): Promise<[Record<string, any> | null, TicketPermDict | null]> {
  const row = await repo.getTicketRow(db, ticketId);
  if (!row) return [null, null];
  return [row, repo.rowToPermDict(row)];
}

function layLyDo(data: Record<string, unknown>): [string | null, string | null] {
  const lyDo = String(data.lyDo ?? "").trim();
  if (!lyDo) return [null, "Vui lòng nhập lý do từ chối."];
  return [lyDo, null];
}

phieuYeuCauRoutes.get("/phieu-yeu-cau", loginRequired(), async (c) => {
  const user = c.get("user");
  const { sql, params } = perm.scopeWhereClause(user);
  return c.json(await repo.listTickets(c.env.DB, sql, params));
});

phieuYeuCauRoutes.post("/phieu-yeu-cau", loginRequired(), async (c) => {
  const user = c.get("user");
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const huong = String(data.huong ?? "").trim();
  if (huong !== "di" && huong !== "den") {
    return c.json({ error: "Loại phiếu yêu cầu không hợp lệ." }, 400);
  }

  const db = c.env.DB;
  const [loi, gt] = await validatePhieu(db, data);
  if (loi) return c.json({ error: loi }, 400);

  if (!perm.canPickAssignee(user, gt!.phongThucHien)) {
    gt!.nguoiThucHienUser = "";
  }
  const ticket = await repo.createTicket(db, user, { ...gt!, huong: huong as "di" | "den", nguoiThucHienUser: gt!.nguoiThucHienUser || null });
  return c.json(ticket, 201);
});

phieuYeuCauRoutes.put("/phieu-yeu-cau/:id", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canEdit(user, pd!)) {
    return c.json(
      {
        error:
          'Chỉ người tạo phiếu mới được chỉnh sửa, và chỉ khi phiếu còn "Mới tạo" và chưa phân công người thực hiện.',
      },
      403,
    );
  }

  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const [loi, gt] = await validatePhieu(db, data);
  if (loi) return c.json({ error: loi }, 400);

  if (!perm.canPickAssignee(user, gt!.phongThucHien)) {
    gt!.nguoiThucHienUser = row.nguoi_thuc_hien_user || "";
  }

  const ticket = await repo.updateTicket(db, ticketId, {
    ...gt!,
    huong: row.huong,
    nguoiThucHienUser: gt!.nguoiThucHienUser || null,
  });
  return c.json(ticket);
});

phieuYeuCauRoutes.delete("/phieu-yeu-cau/:id", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canDelete(user, pd!)) {
    return c.json({ error: "Chỉ người tạo phiếu mới được xoá phiếu này." }, 403);
  }

  await repo.deleteTicket(db, c.env, ticketId);
  return c.json({ ok: true });
});

phieuYeuCauRoutes.post("/phieu-yeu-cau/:id/tinh-trang", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);

  const choPhep = perm.allowedStatus(user, pd!);
  if (choPhep.length === 0) {
    return c.json({ error: "Bạn không có quyền cập nhật tình trạng phiếu này." }, 403);
  }

  const form = await c.req.formData();
  const tinhTrangMoi = String(form.get("tinhTrang") ?? "").trim();
  if (!choPhep.includes(tinhTrangMoi)) {
    return c.json(
      { error: "Tình trạng không hợp lệ hoặc bạn không được phép chuyển sang tình trạng này." },
      400,
    );
  }

  const ghiChu = String(form.get("ghiChu") ?? "").trim();
  const vt = perm.vaiTro(user, pd!);
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  const { ticket, tepQuaLon } = await repo.updateStatus(
    db,
    c.env,
    user,
    ticketId,
    row.ma_pyc,
    tinhTrangMoi,
    ghiChu,
    vt,
    files,
  );
  return c.json({ ticket, tepQuaLon });
});

phieuYeuCauRoutes.put("/phieu-yeu-cau/:id/nguoi-thuc-hien", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canAssign(user, pd!)) {
    return c.json({ error: "Bạn không có quyền phân công người thực hiện cho phiếu này." }, 403);
  }

  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const nguoiMoi = String(data.nguoiThucHienUser ?? "").trim();
  if (!nguoiMoi) return c.json({ error: "Vui lòng chọn người thực hiện." }, 400);

  const nhanSu = await first(db, "SELECT 1 FROM nhan_vien WHERE username = ? AND ma_phong = ?", [
    nguoiMoi,
    row.phong_thuc_hien,
  ]);
  if (!nhanSu) {
    return c.json({ error: "Người thực hiện phải thuộc phòng thực hiện của phiếu." }, 400);
  }

  const ticket = await repo.assignExecutor(db, user, ticketId, row.ma_pyc, nguoiMoi);
  return c.json(ticket);
});

phieuYeuCauRoutes.post("/phieu-yeu-cau/:id/tu-choi-tiep-nhan", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canRejectIntake(user, pd!)) {
    return c.json({ error: "Bạn không có quyền từ chối tiếp nhận phiếu này." }, 403);
  }

  const [lyDo, loi] = layLyDo((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  if (loi) return c.json({ error: loi }, 400);

  const ticket = await repo.rejectIntake(db, user, ticketId, row.ma_pyc, lyDo!);
  return c.json(ticket);
});

phieuYeuCauRoutes.post("/phieu-yeu-cau/:id/tu-choi-thuc-hien", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canDeclineAssignment(user, pd!)) {
    return c.json({ error: "Bạn không có quyền từ chối thực hiện phiếu này." }, 403);
  }

  const [lyDo, loi] = layLyDo((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  if (loi) return c.json({ error: loi }, 400);

  const ticket = await repo.declineAssignment(db, user, ticketId, row.ma_pyc, lyDo!);
  return c.json(ticket);
});

phieuYeuCauRoutes.post("/phieu-yeu-cau/:id/gui-ket-qua", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canSendToRequester(user, pd!)) {
    return c.json({ error: "Bạn không có quyền gửi kết quả cho đơn vị yêu cầu ở phiếu này." }, 403);
  }

  const ticket = await repo.sendToRequester(db, user, ticketId, row.ma_pyc);
  return c.json(ticket);
});

phieuYeuCauRoutes.post("/phieu-yeu-cau/:id/tep-dinh-kem", loginRequired(), async (c) => {
  const user = c.get("user");
  const ticketId = Number(c.req.param("id"));
  const db = c.env.DB;
  const [row, pd] = await layPhieu(db, ticketId);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);
  if (!perm.canManageFiles(user, pd!)) {
    return c.json({ error: "Chỉ người tạo phiếu mới được đính kèm tệp." }, 403);
  }

  const form = await c.req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const { files: tepMoi, tepQuaLon } = await repo.addTicketFiles(db, c.env, user, ticketId, row.ma_pyc, files);
  return c.json({ files: tepMoi, tepQuaLon }, 201);
});

phieuYeuCauRoutes.delete("/tep-dinh-kem/:fileId", loginRequired(), async (c) => {
  const user = c.get("user");
  const fileId = Number(c.req.param("fileId"));
  const db = c.env.DB;
  const tep = await repo.getFileRow(db, fileId);
  if (!tep) return c.json({ error: "Không tìm thấy tệp." }, 404);

  if (tep.phieu_id !== null) {
    const [row, pd] = await layPhieu(db, tep.phieu_id);
    if (!row || !perm.canManageFiles(user, pd!)) {
      return c.json({ error: "Chỉ người tạo phiếu mới được xoá tệp đính kèm." }, 403);
    }
    await repo.deleteFile(db, c.env, fileId);
    return c.json({ ok: true });
  }

  const ls = await first<{ phieu_id: number }>(db, "SELECT phieu_id FROM lich_su_xu_ly WHERE id = ?", [
    tep.lich_su_id,
  ]);
  if (!ls) return c.json({ error: "Không tìm thấy tệp." }, 404);

  const [row, pd] = await layPhieu(db, ls.phieu_id);
  if (!row) return c.json({ error: "Không tìm thấy phiếu yêu cầu." }, 404);

  const laNguoiTai = tep.nguoi_tai_user === user.username;
  const coQuyen = laNguoiTai || perm.canUpdateStatus(user, pd!) || perm.canAssign(user, pd!);
  const dungBuocHienTai = await repo.isLichSuHienTai(db, ls.phieu_id, row.tinh_trang, tep.lich_su_id);
  if (!coQuyen || !dungBuocHienTai) {
    return c.json({ error: "Chỉ có thể xoá bằng chứng của bước xử lý hiện tại." }, 403);
  }

  await repo.deleteFile(db, c.env, fileId);
  return c.json({ ok: true });
});

phieuYeuCauRoutes.get("/tep-dinh-kem/:fileId/tai-xuong", loginRequired(), async (c) => {
  const user = c.get("user");
  const fileId = Number(c.req.param("fileId"));
  const db = c.env.DB;
  const tep = await repo.getFileRow(db, fileId);
  if (!tep) return c.notFound();

  let phieuId = tep.phieu_id;
  if (phieuId === null) {
    const ls = await first<{ phieu_id: number }>(db, "SELECT phieu_id FROM lich_su_xu_ly WHERE id = ?", [
      tep.lich_su_id,
    ]);
    if (!ls) return c.notFound();
    phieuId = ls.phieu_id;
  }

  const [row, pd] = await layPhieu(db, phieuId);
  if (!row || !perm.canView(user, pd!)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const obj = await getFileFromR2(c.env, tep.duong_dan);
  if (!obj) return c.notFound();

  const headers = new Headers();
  headers.set("Content-Type", tep.loai_mime || "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(tep.ten_tep)}"`);
  return new Response(obj.body as ReadableStream, { headers });
});
