# -*- coding: utf-8 -*-
"""
blueprints/nhan_vien.py - Danh sách nhân viên (chỉ admin thêm/sửa/xoá).

Đọc: bất kỳ ai đã đăng nhập (cần cho ô chọn "người thực hiện", "người quản
lý"...). KHÔNG BAO GIỜ trả password/password_hash ra ngoài.
"""
import re
from datetime import date

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from auth_helpers import admin_required, login_required
from constants import CHUC_DANH
from database import get_db
from serializers import nhan_vien_to_dict

bp = Blueprint("nhan_vien", __name__, url_prefix="/api/nhan-vien")

_MA_CHUC_DANH_HOP_LE = {c["id"] for c in CHUC_DANH}
_SDT_HOP_LE = re.compile(r"^0\d{9,10}$")
_EMAIL_HOP_LE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def _validate_chung(data, la_tao_moi):
    """Kiểm tra các trường dùng chung cho cả tạo mới và chỉnh sửa.
    Trả về (loi_400_hoac_None, gia_tri_da_chuan_hoa)."""
    ho_ten = (data.get("hoTen") or "").strip()
    email = (data.get("email") or "").strip()
    ma_phong = (data.get("maPhong") or "").strip()
    sdt = (data.get("soDienThoai") or "").strip()
    chuc_danh = (data.get("chucDanh") or "").strip()
    nguoi_quan_ly = (data.get("nguoiQuanLy") or "").strip()

    if not ho_ten:
        return "Vui lòng nhập họ tên.", None
    if not _EMAIL_HOP_LE.match(email):
        return "Email không hợp lệ.", None
    if not ma_phong:
        return "Vui lòng chọn phòng ban.", None
    if not _SDT_HOP_LE.match(sdt):
        return "Số điện thoại gồm 10-11 số, bắt đầu bằng 0.", None
    if chuc_danh not in _MA_CHUC_DANH_HOP_LE:
        return "Chức danh không hợp lệ.", None

    return None, {
        "hoTen": ho_ten, "email": email, "maPhong": ma_phong,
        "soDienThoai": sdt, "chucDanh": chuc_danh, "nguoiQuanLy": nguoi_quan_ly,
    }


@bp.get("")
@login_required
def list_nhan_vien(user):
    db = get_db()
    rows = db.execute("SELECT * FROM nhan_vien ORDER BY ho_ten").fetchall()
    return jsonify([nhan_vien_to_dict(r) for r in rows])


@bp.post("")
@admin_required
def create_nhan_vien(user):
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    mat_khau = data.get("password") or ""

    if not username:
        return jsonify({"error": "Vui lòng nhập tên đăng nhập."}), 400
    if len(mat_khau) < 6:
        return jsonify({"error": "Mật khẩu tối thiểu 6 ký tự."}), 400

    loi, gt = _validate_chung(data, la_tao_moi=True)
    if loi:
        return jsonify({"error": loi}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM nhan_vien WHERE username = ? COLLATE NOCASE", (username,)).fetchone():
        return jsonify({"error": "Tên đăng nhập đã tồn tại."}), 409

    if not db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (gt["maPhong"],)).fetchone():
        return jsonify({"error": "Phòng ban không tồn tại."}), 400

    if gt["nguoiQuanLy"]:
        ql = db.execute(
            "SELECT chuc_danh FROM nhan_vien WHERE username = ?", (gt["nguoiQuanLy"],)
        ).fetchone()
        if ql is None or ql["chuc_danh"] not in ("quanly", "admin"):
            return jsonify({"error": "Người quản lý không hợp lệ."}), 400

    if db.execute("SELECT 1 FROM nhan_vien WHERE email = ? COLLATE NOCASE", (gt["email"],)).fetchone():
        return jsonify({"error": "Email đã được dùng bởi tài khoản khác."}), 409

    ngay_tao = (data.get("ngayTao") or "").strip() or date.today().isoformat()
    db.execute(
        "INSERT INTO nhan_vien (username, password_hash, ho_ten, email, ma_phong, "
        "so_dien_thoai, chuc_danh, nguoi_quan_ly, ngay_tao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (username, generate_password_hash(mat_khau), gt["hoTen"], gt["email"], gt["maPhong"],
         gt["soDienThoai"], gt["chucDanh"], gt["nguoiQuanLy"] or None, ngay_tao),
    )
    db.commit()
    row = db.execute("SELECT * FROM nhan_vien WHERE username = ?", (username,)).fetchone()
    return jsonify(nhan_vien_to_dict(row)), 201


@bp.put("/<username>")
@admin_required
def update_nhan_vien(user, username):
    data = request.get_json(silent=True) or {}

    db = get_db()
    hien_co = db.execute("SELECT * FROM nhan_vien WHERE username = ?", (username,)).fetchone()
    if hien_co is None:
        return jsonify({"error": "Không tìm thấy nhân viên."}), 404

    loi, gt = _validate_chung(data, la_tao_moi=False)
    if loi:
        return jsonify({"error": loi}), 400

    if not db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (gt["maPhong"],)).fetchone():
        return jsonify({"error": "Phòng ban không tồn tại."}), 400

    if gt["nguoiQuanLy"]:
        if gt["nguoiQuanLy"] == username:
            return jsonify({"error": "Nhân viên không thể là người quản lý của chính mình."}), 400
        ql = db.execute(
            "SELECT chuc_danh FROM nhan_vien WHERE username = ?", (gt["nguoiQuanLy"],)
        ).fetchone()
        if ql is None or ql["chuc_danh"] not in ("quanly", "admin"):
            return jsonify({"error": "Người quản lý không hợp lệ."}), 400

    email_trung = db.execute(
        "SELECT 1 FROM nhan_vien WHERE email = ? COLLATE NOCASE AND username != ?",
        (gt["email"], username),
    ).fetchone()
    if email_trung:
        return jsonify({"error": "Email đã được dùng bởi tài khoản khác."}), 409

    mat_khau_moi = data.get("password") or ""
    if mat_khau_moi:
        if len(mat_khau_moi) < 6:
            return jsonify({"error": "Mật khẩu tối thiểu 6 ký tự."}), 400
        db.execute(
            "UPDATE nhan_vien SET password_hash = ? WHERE username = ?",
            (generate_password_hash(mat_khau_moi), username),
        )

    ngay_tao = (data.get("ngayTao") or "").strip() or hien_co["ngay_tao"]
    db.execute(
        "UPDATE nhan_vien SET ho_ten = ?, email = ?, ma_phong = ?, so_dien_thoai = ?, "
        "chuc_danh = ?, nguoi_quan_ly = ?, ngay_tao = ? WHERE username = ?",
        (gt["hoTen"], gt["email"], gt["maPhong"], gt["soDienThoai"], gt["chucDanh"],
         gt["nguoiQuanLy"] or None, ngay_tao, username),
    )
    db.commit()
    row = db.execute("SELECT * FROM nhan_vien WHERE username = ?", (username,)).fetchone()
    return jsonify(nhan_vien_to_dict(row))


@bp.delete("/<username>")
@admin_required
def delete_nhan_vien(user, username):
    if username == user["username"]:
        return jsonify({"error": "Không thể xoá tài khoản đang đăng nhập."}), 400

    db = get_db()
    if not db.execute("SELECT 1 FROM nhan_vien WHERE username = ?", (username,)).fetchone():
        return jsonify({"error": "Không tìm thấy nhân viên."}), 404

    so_cap_duoi = db.execute(
        "SELECT COUNT(*) AS n FROM nhan_vien WHERE nguoi_quan_ly = ?", (username,)
    ).fetchone()["n"]
    if so_cap_duoi:
        return jsonify({
            "error": f"Không thể xoá: đang là người quản lý của {so_cap_duoi} nhân viên."
        }), 409

    dang_lien_quan_phieu = db.execute(
        "SELECT 1 FROM phieu_yeu_cau WHERE nguoi_tao_user = ? OR nguoi_thuc_hien_user = ?",
        (username, username),
    ).fetchone()
    if dang_lien_quan_phieu:
        return jsonify({
            "error": "Không thể xoá: nhân viên này đang gắn với ít nhất một phiếu yêu cầu."
        }), 409

    db.execute("DELETE FROM nhan_vien WHERE username = ?", (username,))
    db.commit()
    return jsonify({"ok": True})
