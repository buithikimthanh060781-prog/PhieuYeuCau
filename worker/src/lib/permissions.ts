// permissions.ts - Port 1:1 của permissions.py. Đây là nơi phân quyền THỰC
// SỰ có hiệu lực (phía js/main.js chỉ ẩn/hiện nút) - mọi route ghi dữ liệu
// phải gọi lại các hàm này, không tin bất kỳ điều gì phía client gửi lên.
import {
  TINH_TRANG,
  TT_KET_THUC,
  TT_NGUOI_TAO,
  TT_QUANLY_DUYET,
  TT_QUANLY_THUCHIEN,
  TT_THANHVIEN_THUCHIEN,
} from "./constants";
import type { NhanVien, TicketPermDict } from "../types";

export function isAdmin(user: NhanVien | null | undefined): boolean {
  return !!user && user.chucDanh === "admin";
}

export function isQuanLy(user: NhanVien | null | undefined): boolean {
  return !!user && user.chucDanh === "quanly";
}

export function isThanhVien(user: NhanVien | null | undefined): boolean {
  return !!user && user.chucDanh === "nhanvien";
}

export function isCreator(user: NhanVien | null | undefined, ticket: TicketPermDict | null | undefined): boolean {
  return !!user && !!ticket && ticket.nguoiTaoUser === user.username;
}

export function isAssignee(user: NhanVien | null | undefined, ticket: TicketPermDict | null | undefined): boolean {
  return !!user && !!ticket && ticket.nguoiThucHienUser === user.username;
}

export function isDeptReviewer(user: NhanVien | null | undefined, ticket: TicketPermDict | null | undefined): boolean {
  if (!user || !ticket) return false;
  if (isAdmin(user)) return true;
  return isQuanLy(user) && user.maPhong === ticket.phongThucHien;
}

/** Trả về (mệnh đề SQL, tham số) để nhúng vào WHERE khi truy vấn phieu_yeu_cau. */
export function scopeWhereClause(user: NhanVien): { sql: string; params: unknown[] } {
  if (isAdmin(user)) return { sql: "1=1", params: [] };

  if (isQuanLy(user)) {
    return {
      sql:
        "(" +
        "  nguoi_tao_user IN (SELECT username FROM nhan_vien WHERE ma_phong = ?)" +
        "  OR phong_thuc_hien = ?" +
        ")",
      params: [user.maPhong, user.maPhong],
    };
  }

  return {
    sql: "(nguoi_tao_user = ? OR nguoi_thuc_hien_user = ?)",
    params: [user.username, user.username],
  };
}

export function canPickAssignee(user: NhanVien, phongThucHien: string): boolean {
  if (isAdmin(user)) return true;
  if (isQuanLy(user)) return phongThucHien === user.maPhong;
  return false;
}

export function canView(user: NhanVien, ticket: TicketPermDict): boolean {
  if (isAdmin(user)) return true;
  if (isQuanLy(user)) {
    return ticket._nguoiTaoMaPhong === user.maPhong || ticket.phongThucHien === user.maPhong;
  }
  return ticket.nguoiTaoUser === user.username || ticket.nguoiThucHienUser === user.username;
}

export function canEdit(user: NhanVien, ticket: TicketPermDict): boolean {
  return isCreator(user, ticket) && ticket.tinhTrang === "moi" && !ticket.nguoiThucHienUser;
}

export function canDelete(user: NhanVien, ticket: TicketPermDict): boolean {
  return isCreator(user, ticket);
}

export function canManageFiles(user: NhanVien, ticket: TicketPermDict): boolean {
  return isCreator(user, ticket);
}

export function canAssign(user: NhanVien, ticket: TicketPermDict): boolean {
  return isDeptReviewer(user, ticket) && !TT_KET_THUC.includes(ticket.tinhTrang);
}

export function canRejectIntake(user: NhanVien, ticket: TicketPermDict): boolean {
  return isDeptReviewer(user, ticket) && ticket.tinhTrang === "moi";
}

export function canDeclineAssignment(user: NhanVien, ticket: TicketPermDict): boolean {
  return (
    isAssignee(user, ticket) &&
    ["moi", "dangxuly", "tuchoi", "quanly_tuchoi"].includes(ticket.tinhTrang)
  );
}

export function canSendToRequester(user: NhanVien, ticket: TicketPermDict): boolean {
  return isDeptReviewer(user, ticket) && ticket.tinhTrang === "quanly_dong_y";
}

export function allowedStatus(user: NhanVien, ticket: TicketPermDict): string[] {
  if (TT_KET_THUC.includes(ticket.tinhTrang)) return [];

  const kq = new Set<string>();
  if (isAssignee(user, ticket) && !["choduyet", "quanly_dong_y"].includes(ticket.tinhTrang)) {
    if (isThanhVien(user)) {
      TT_THANHVIEN_THUCHIEN.forEach((s) => kq.add(s));
    } else {
      TT_QUANLY_THUCHIEN.forEach((s) => kq.add(s));
    }
  }
  if (isDeptReviewer(user, ticket) && ticket.tinhTrang === "choqlyduyet") {
    TT_QUANLY_DUYET.forEach((s) => kq.add(s));
  }
  if (isCreator(user, ticket) && ticket.tinhTrang === "choduyet") {
    TT_NGUOI_TAO.forEach((s) => kq.add(s));
  }

  const thuTu = TINH_TRANG.map((s) => s.id);
  return thuTu.filter((ma) => kq.has(ma));
}

export function canUpdateStatus(user: NhanVien, ticket: TicketPermDict): boolean {
  return allowedStatus(user, ticket).length > 0;
}

export function vaiTro(user: NhanVien, ticket: TicketPermDict): string | null {
  if (isCreator(user, ticket)) return "Người tạo phiếu";
  if (isAssignee(user, ticket)) return "Người thực hiện";
  if (isDeptReviewer(user, ticket)) return "Quản lý phòng thực hiện";
  return null;
}
