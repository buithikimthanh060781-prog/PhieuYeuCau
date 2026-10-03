# -*- coding: utf-8 -*-
"""
blueprints/phieu_yeu_cau.py - Danh sách phiếu (đã lọc theo quyền), tạo, sửa,
xoá, cập nhật tình trạng kèm bằng chứng, tệp đính kèm.

Đây là nơi các quy tắc trong permissions.py THỰC SỰ có hiệu lực: object
`Perm` phía main.js chỉ ẩn/hiện nút cho gọn giao diện, mọi request ghi dữ
liệu đều được kiểm tra lại ở đây bất kể trình duyệt gửi gì lên.
"""
import os

from flask import Blueprint, abort, current_app, jsonify, request, send_file

import permissions as perm
import repo_phieu as repo
from auth_helpers import login_required
from constants import UU_TIEN
from database import get_db

bp = Blueprint("phieu_yeu_cau", __name__, url_prefix="/api")

_MA_UU_TIEN_HOP_LE = {s["id"] for s in UU_TIEN}


def _validate_phieu(db, data):
    """Kiểm tra các trường của biểu mẫu phiếu yêu cầu, khớp đúng validate()
    phía main.js (donViYeuCau, ngayYeuCau, thoiHan, noiDung, phongThucHien...)."""
    don_vi = (data.get("donViYeuCau") or "").strip()
    ngay_yc = (data.get("ngayYeuCau") or "").strip()
    thoi_han = (data.get("thoiHan") or "").strip()
    noi_dung = (data.get("noiDung") or "").strip()
    phong_th = (data.get("phongThucHien") or "").strip()
    loai = (data.get("loaiPYC") or "").strip()
    nguoi_th = (data.get("nguoiThucHienUser") or "").strip()
    uu_tien = (data.get("uuTien") or "binhthuong").strip()

    if not don_vi:
        return "Vui lòng nhập đơn vị yêu cầu.", None
    if not ngay_yc:
        return "Vui lòng chọn ngày yêu cầu.", None
    if not thoi_han:
        return "Vui lòng chọn thời hạn.", None
    if thoi_han < ngay_yc:
        return "Thời hạn phải sau ngày yêu cầu.", None
    if len(noi_dung) < 10:
        return "Nội dung tối thiểu 10 ký tự.", None
    if not phong_th:
        return "Vui lòng chọn phòng thực hiện.", None
    if not db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (phong_th,)).fetchone():
        return "Phòng thực hiện không tồn tại.", None
    if not db.execute("SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", (loai,)).fetchone():
        return "Loại yêu cầu không tồn tại.", None
    if nguoi_th and not db.execute("SELECT 1 FROM nhan_vien WHERE username = ?", (nguoi_th,)).fetchone():
        return "Người thực hiện không tồn tại.", None
    if uu_tien not in _MA_UU_TIEN_HOP_LE:
        uu_tien = "binhthuong"

    return None, {
        "donViYeuCau": don_vi, "ngayYeuCau": ngay_yc, "thoiHan": thoi_han,
        "noiDung": noi_dung, "phongThucHien": phong_th, "loaiPYC": loai,
        "nguoiThucHienUser": nguoi_th, "uuTien": uu_tien,
    }


def _lay_phieu(db, ticket_id):
    """Trả về (row, perm_dict) hoặc (None, None) nếu không tìm thấy."""
    row = repo.get_ticket_row(db, ticket_id)
    if row is None:
        return None, None
    return row, repo.row_to_perm_dict(row)


@bp.get("/phieu-yeu-cau")
@login_required
def list_phieu_yeu_cau(user):
    db = get_db()
    where_sql, where_params = perm.scope_where_clause(user)
    return jsonify(repo.list_tickets(db, where_sql, where_params))


@bp.post("/phieu-yeu-cau")
@login_required
def create_phieu_yeu_cau(user):
    data = request.get_json(silent=True) or {}
    huong = (data.get("huong") or "").strip()
    if huong not in ("di", "den"):
        return jsonify({"error": "Loại phiếu yêu cầu không hợp lệ."}), 400

    db = get_db()
    loi, gt = _validate_phieu(db, data)
    if loi:
        return jsonify({"error": loi}), 400

    gt["huong"] = huong
    if not perm.can_pick_assignee(user, gt["phongThucHien"]):
        # Thành viên: không bao giờ được chọn. Cấp quản lý: chỉ được chọn khi
        # phòng thực hiện là phòng của chính họ - phòng khác thì máy chủ ép
        # về rỗng bất kể trình duyệt gửi gì lên, quản lý phòng đó phân công sau.
        gt["nguoiThucHienUser"] = None
    return jsonify(repo.create_ticket(db, user, gt)), 201


@bp.put("/phieu-yeu-cau/<int:ticket_id>")
@login_required
def update_phieu_yeu_cau(user, ticket_id):
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_edit(user, pd):
        return jsonify({
            "error": "Chỉ người tạo phiếu mới được chỉnh sửa, và chỉ khi phiếu còn "
                     "\"Mới tạo\" và chưa phân công người thực hiện."
        }), 403

    data = request.get_json(silent=True) or {}
    loi, gt = _validate_phieu(db, data)
    if loi:
        return jsonify({"error": loi}), 400

    if not perm.can_pick_assignee(user, gt["phongThucHien"]):
        # Giữ đúng người thực hiện hiện có (thực tế luôn rỗng ở đây, vì
        # can_edit chỉ cho sửa khi phiếu CHƯA có người thực hiện) - áp dụng
        # cùng quy tắc như lúc tạo phiếu.
        gt["nguoiThucHienUser"] = row["nguoi_thuc_hien_user"] or ""

    return jsonify(repo.update_ticket(db, ticket_id, gt))


@bp.delete("/phieu-yeu-cau/<int:ticket_id>")
@login_required
def delete_phieu_yeu_cau(user, ticket_id):
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_delete(user, pd):
        return jsonify({"error": "Chỉ người tạo phiếu mới được xoá phiếu này."}), 403

    repo.delete_ticket(db, ticket_id)
    return jsonify({"ok": True})


@bp.post("/phieu-yeu-cau/<int:ticket_id>/tinh-trang")
@login_required
def update_tinh_trang(user, ticket_id):
    """multipart/form-data: tinhTrang, ghiChu, files[] (bằng chứng, có thể trống)."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404

    cho_phep = perm.allowed_status(user, pd)
    if not cho_phep:
        return jsonify({"error": "Bạn không có quyền cập nhật tình trạng phiếu này."}), 403

    tinh_trang_moi = (request.form.get("tinhTrang") or "").strip()
    if tinh_trang_moi not in cho_phep:
        return jsonify({
            "error": "Tình trạng không hợp lệ hoặc bạn không được phép chuyển sang tình trạng này."
        }), 400

    ghi_chu = (request.form.get("ghiChu") or "").strip()
    vt = perm.vai_tro(user, pd)
    files = request.files.getlist("files")

    ticket, tep_qua_lon = repo.update_status(
        db, user, ticket_id, row["ma_pyc"], tinh_trang_moi, ghi_chu, vt, files
    )
    return jsonify({"ticket": ticket, "tepQuaLon": tep_qua_lon})


@bp.put("/phieu-yeu-cau/<int:ticket_id>/nguoi-thuc-hien")
@login_required
def phan_cong_nguoi_thuc_hien(user, ticket_id):
    """Quản lý phòng thực hiện (hoặc admin) chọn/đổi nhân sự thực hiện phiếu
    - KHÔNG đổi tình trạng, tách biệt hoàn toàn khỏi cập nhật tình trạng."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_assign(user, pd):
        return jsonify({"error": "Bạn không có quyền phân công người thực hiện cho phiếu này."}), 403

    data = request.get_json(silent=True) or {}
    nguoi_moi = (data.get("nguoiThucHienUser") or "").strip()
    if not nguoi_moi:
        return jsonify({"error": "Vui lòng chọn người thực hiện."}), 400

    nhan_su = db.execute(
        "SELECT 1 FROM nhan_vien WHERE username = ? AND ma_phong = ?",
        (nguoi_moi, row["phong_thuc_hien"]),
    ).fetchone()
    if not nhan_su:
        return jsonify({"error": "Người thực hiện phải thuộc phòng thực hiện của phiếu."}), 400

    ticket = repo.assign_executor(db, user, ticket_id, row["ma_pyc"], nguoi_moi)
    return jsonify(ticket)


def _lay_ly_do(data):
    ly_do = (data.get("lyDo") or "").strip()
    if not ly_do:
        return None, "Vui lòng nhập lý do từ chối."
    return ly_do, None


@bp.post("/phieu-yeu-cau/<int:ticket_id>/tu-choi-tiep-nhan")
@login_required
def tu_choi_tiep_nhan(user, ticket_id):
    """Quản lý phòng thực hiện (hoặc admin) từ chối tiếp nhận phiếu ngay từ
    đầu - chỉ khi phiếu còn "Mới tạo". Bắt buộc có lý do."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_reject_intake(user, pd):
        return jsonify({"error": "Bạn không có quyền từ chối tiếp nhận phiếu này."}), 403

    ly_do, loi = _lay_ly_do(request.get_json(silent=True) or {})
    if loi:
        return jsonify({"error": loi}), 400

    ticket = repo.reject_intake(db, user, ticket_id, row["ma_pyc"], ly_do)
    return jsonify(ticket)


@bp.post("/phieu-yeu-cau/<int:ticket_id>/tu-choi-thuc-hien")
@login_required
def tu_choi_thuc_hien(user, ticket_id):
    """Người thực hiện tự từ chối thực hiện (bận việc khác...) - tình trạng
    phiếu giữ nguyên, chỉ bỏ chọn người thực hiện. Bắt buộc có lý do."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_decline_assignment(user, pd):
        return jsonify({"error": "Bạn không có quyền từ chối thực hiện phiếu này."}), 403

    ly_do, loi = _lay_ly_do(request.get_json(silent=True) or {})
    if loi:
        return jsonify({"error": loi}), 400

    ticket = repo.decline_assignment(db, user, ticket_id, row["ma_pyc"], ly_do)
    return jsonify(ticket)


@bp.post("/phieu-yeu-cau/<int:ticket_id>/gui-ket-qua")
@login_required
def gui_ket_qua(user, ticket_id):
    """Quản lý phòng thực hiện (hoặc admin) gửi kết quả cho đơn vị yêu cầu -
    chuyển "Quản lý đồng ý" -> "Chờ duyệt"."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_send_to_requester(user, pd):
        return jsonify({"error": "Bạn không có quyền gửi kết quả cho đơn vị yêu cầu ở phiếu này."}), 403

    ticket = repo.send_to_requester(db, user, ticket_id, row["ma_pyc"])
    return jsonify(ticket)


@bp.post("/phieu-yeu-cau/<int:ticket_id>/tep-dinh-kem")
@login_required
def them_tep_dinh_kem(user, ticket_id):
    """multipart/form-data: files[] - chỉ người tạo phiếu được thêm."""
    db = get_db()
    row, pd = _lay_phieu(db, ticket_id)
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404
    if not perm.can_manage_files(user, pd):
        return jsonify({"error": "Chỉ người tạo phiếu mới được đính kèm tệp."}), 403

    files = request.files.getlist("files")
    tep_moi, tep_qua_lon = repo.add_ticket_files(db, user, ticket_id, row["ma_pyc"], files)
    return jsonify({"files": tep_moi, "tepQuaLon": tep_qua_lon}), 201


@bp.delete("/tep-dinh-kem/<int:file_id>")
@login_required
def xoa_tep_dinh_kem(user, file_id):
    db = get_db()
    tep = repo.get_file_row(db, file_id)
    if tep is None:
        return jsonify({"error": "Không tìm thấy tệp."}), 404

    if tep["phieu_id"] is not None:
        # Tệp hồ sơ gắn thẳng vào phiếu - chỉ người tạo phiếu được xoá.
        row, pd = _lay_phieu(db, tep["phieu_id"])
        if row is None or not perm.can_manage_files(user, pd):
            return jsonify({"error": "Chỉ người tạo phiếu mới được xoá tệp đính kèm."}), 403
        repo.delete_file(db, file_id)
        return jsonify({"ok": True})

    # Tệp bằng chứng xử lý (gắn theo lich_su_id) - chỉ được xoá nếu nó thuộc
    # MỐC LỊCH SỬ MỚI NHẤT của phiếu (bước đang xử lý dở, chưa qua bước kế
    # tiếp), và người xoá là người đã tải lên hoặc có quyền cập nhật/phân
    # công phiếu đó. Các mốc lịch sử cũ hơn giữ nguyên để phục vụ audit.
    ls = db.execute("SELECT phieu_id FROM lich_su_xu_ly WHERE id = ?", (tep["lich_su_id"],)).fetchone()
    if ls is None:
        return jsonify({"error": "Không tìm thấy tệp."}), 404

    row, pd = _lay_phieu(db, ls["phieu_id"])
    if row is None:
        return jsonify({"error": "Không tìm thấy phiếu yêu cầu."}), 404

    la_nguoi_tai = tep["nguoi_tai_user"] == user["username"]
    co_quyen = la_nguoi_tai or perm.can_update_status(user, pd) or perm.can_assign(user, pd)
    dung_buoc_hien_tai = repo.is_lich_su_hien_tai(db, ls["phieu_id"], row["tinh_trang"], tep["lich_su_id"])
    if not co_quyen or not dung_buoc_hien_tai:
        return jsonify({"error": "Chỉ có thể xoá bằng chứng của bước xử lý hiện tại."}), 403

    repo.delete_file(db, file_id)
    return jsonify({"ok": True})


@bp.get("/tep-dinh-kem/<int:file_id>/tai-xuong")
@login_required
def tai_xuong_tep(user, file_id):
    db = get_db()
    tep = repo.get_file_row(db, file_id)
    if tep is None:
        abort(404)

    phieu_id = tep["phieu_id"]
    if phieu_id is None:
        ls = db.execute("SELECT phieu_id FROM lich_su_xu_ly WHERE id = ?", (tep["lich_su_id"],)).fetchone()
        if ls is None:
            abort(404)
        phieu_id = ls["phieu_id"]

    row, pd = _lay_phieu(db, phieu_id)
    if row is None or not perm.can_view(user, pd):
        abort(403)

    duong_dan = os.path.join(current_app.root_path, repo.UPLOAD_ROOT, tep["duong_dan"])
    if not os.path.isfile(duong_dan):
        abort(404)

    return send_file(duong_dan, as_attachment=True, download_name=tep["ten_tep"])
