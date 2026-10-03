# -*- coding: utf-8 -*-
"""
blueprints/auth.py - Đăng nhập, đăng xuất, đổi mật khẩu, quên mật khẩu.

Đây là phần bắt buộc phải chuyển hẳn sang máy chủ (không thể giữ ở trình
duyệt như bản demo cũ): mật khẩu giờ được băm trong CSDL, nên việc so sánh
"mật khẩu nhập vào có đúng không" chỉ máy chủ làm được.
"""
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from auth_helpers import current_user, login_required
from database import get_db
from serializers import nhan_vien_to_dict

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Vui lòng nhập tên đăng nhập và mật khẩu."}), 400

    db = get_db()
    row = db.execute(
        "SELECT username, password_hash, ho_ten, email, ma_phong, so_dien_thoai, "
        "chuc_danh, nguoi_quan_ly, ngay_tao FROM nhan_vien WHERE username = ? COLLATE NOCASE",
        (username,),
    ).fetchone()

    if row is None or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Tên đăng nhập hoặc mật khẩu không đúng."}), 401

    session.clear()
    session["username"] = row["username"]
    session.permanent = True
    return jsonify({"ok": True, "user": nhan_vien_to_dict(row)})


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/me")
def me():
    return jsonify({"user": current_user()})


@bp.post("/change-password")
@login_required
def change_password(user):
    data = request.get_json(silent=True) or {}
    mk_cu = data.get("oldPassword") or ""
    mk_moi = data.get("newPassword") or ""

    if len(mk_moi) < 6:
        return jsonify({"error": "Mật khẩu mới tối thiểu 6 ký tự."}), 400

    db = get_db()
    row = db.execute(
        "SELECT password_hash FROM nhan_vien WHERE username = ?", (user["username"],)
    ).fetchone()
    if row is None or not check_password_hash(row["password_hash"], mk_cu):
        return jsonify({"error": "Mật khẩu hiện tại không đúng."}), 400

    db.execute(
        "UPDATE nhan_vien SET password_hash = ? WHERE username = ?",
        (generate_password_hash(mk_moi), user["username"]),
    )
    db.commit()
    return jsonify({"ok": True})


@bp.post("/forgot-password/verify")
def forgot_verify():
    """Đối chiếu username + email. Bản demo không gửi email thật (đã ghi rõ
    trong giao diện) nên bước xác minh này chỉ để chắc chắn 2 thông tin khớp
    nhau trước khi cho phép đặt lại mật khẩu ở bước kế tiếp."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()

    if not username or not email:
        return jsonify({"error": "Vui lòng nhập đầy đủ thông tin."}), 400

    db = get_db()
    row = db.execute(
        "SELECT email FROM nhan_vien WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()

    if row is None or row["email"].lower() != email.lower():
        return jsonify({"error": "Thông tin không khớp với tài khoản nào trong hệ thống."}), 404

    return jsonify({"ok": True, "email": row["email"]})


@bp.post("/forgot-password/reset")
def forgot_reset():
    """Xác minh lại username + email một lần nữa (không chỉ tin bước verify
    trước đó) rồi mới cho đặt mật khẩu mới - tránh việc gọi thẳng API này
    với username bất kỳ để đổi mật khẩu người khác."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    mk_moi = data.get("newPassword") or ""

    if len(mk_moi) < 6:
        return jsonify({"error": "Mật khẩu tối thiểu 6 ký tự."}), 400

    db = get_db()
    row = db.execute(
        "SELECT username, email FROM nhan_vien WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()

    if row is None or row["email"].lower() != email.lower():
        return jsonify({"error": "Thông tin không khớp với tài khoản nào trong hệ thống."}), 404

    db.execute(
        "UPDATE nhan_vien SET password_hash = ? WHERE username = ?",
        (generate_password_hash(mk_moi), row["username"]),
    )
    db.commit()
    return jsonify({"ok": True})
