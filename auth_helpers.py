# -*- coding: utf-8 -*-
"""
auth_helpers.py - Đọc phiên đăng nhập (flask.session) và bọc route theo quyền.

Khác với bản demo tĩnh (lưu "phiên đăng nhập" giả trong localStorage), ở
đây dùng cơ chế session cookie có ký tên sẵn có của Flask - máy chủ biết
chắc chắn ai đang gọi API, trình duyệt không thể tự mạo danh người khác.
"""
from functools import wraps

from flask import jsonify, session

from database import get_db
from serializers import nhan_vien_to_dict


def current_user():
    """Trả về thông tin nhân viên đang đăng nhập (dict JSON, không có mật khẩu),
    hoặc None nếu chưa đăng nhập / tài khoản trong session đã bị xoá."""
    username = session.get("username")
    if not username:
        return None

    db = get_db()
    row = db.execute(
        "SELECT username, ho_ten, email, ma_phong, so_dien_thoai, "
        "chuc_danh, nguoi_quan_ly, ngay_tao FROM nhan_vien WHERE username = ?",
        (username,),
    ).fetchone()

    if row is None:
        session.clear()  # tài khoản đã bị admin xoá nhưng cookie phiên cũ vẫn còn
        return None

    return nhan_vien_to_dict(row)


def login_required(view):
    """Chặn request nếu chưa đăng nhập, trả về 401 kèm thông báo tiếng Việt."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."}), 401
        return view(user, *args, **kwargs)

    return wrapped


def admin_required(view):
    """Chặn request nếu không phải tài khoản Quản trị hệ thống, trả về 403."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."}), 401
        if user["chucDanh"] != "admin":
            return jsonify({"error": "Chức năng này chỉ dành cho tài khoản Quản trị hệ thống."}), 403
        return view(user, *args, **kwargs)

    return wrapped
