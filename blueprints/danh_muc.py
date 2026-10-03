# -*- coding: utf-8 -*-
"""
blueprints/danh_muc.py - Phòng ban + Loại yêu cầu.

Đọc: bất kỳ ai đã đăng nhập (cần cho các ô chọn phòng/loại trên nhiều trang).
Ghi (thêm/sửa/xoá): chỉ tài khoản Quản trị hệ thống - kiểm tra lại bằng
@admin_required, không tin việc ẩn menu phía trình duyệt.
"""
import re

from flask import Blueprint, jsonify, request

from auth_helpers import admin_required, login_required
from database import get_db
from serializers import loai_yeu_cau_to_dict, phong_ban_to_dict

bp = Blueprint("danh_muc", __name__, url_prefix="/api")


# =====================================================
# Phòng ban
# =====================================================

@bp.get("/phong-ban")
@login_required
def list_phong_ban(user):
    db = get_db()
    rows = db.execute("SELECT * FROM phong_ban ORDER BY ma_phong").fetchall()
    return jsonify([phong_ban_to_dict(r) for r in rows])


@bp.post("/phong-ban")
@admin_required
def create_phong_ban(user):
    data = request.get_json(silent=True) or {}
    ma = (data.get("maPhong") or "").strip().upper()
    ten = (data.get("tenPhong") or "").strip()

    if not ma:
        return jsonify({"error": "Vui lòng nhập mã phòng."}), 400
    if not ten:
        return jsonify({"error": "Vui lòng nhập tên phòng."}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (ma,)).fetchone():
        return jsonify({"error": "Mã phòng đã tồn tại."}), 409

    db.execute(
        "INSERT INTO phong_ban (ma_phong, ten_phong, truong_phong, ghi_chu) VALUES (?, ?, ?, ?)",
        (ma, ten, (data.get("truongPhong") or "").strip(), (data.get("ghiChu") or "").strip()),
    )
    db.commit()
    row = db.execute("SELECT * FROM phong_ban WHERE ma_phong = ?", (ma,)).fetchone()
    return jsonify(phong_ban_to_dict(row)), 201


@bp.put("/phong-ban/<ma_phong_cu>")
@admin_required
def update_phong_ban(user, ma_phong_cu):
    data = request.get_json(silent=True) or {}
    ma_moi = (data.get("maPhong") or "").strip().upper()
    ten = (data.get("tenPhong") or "").strip()

    if not ma_moi:
        return jsonify({"error": "Vui lòng nhập mã phòng."}), 400
    if not ten:
        return jsonify({"error": "Vui lòng nhập tên phòng."}), 400

    db = get_db()
    if not db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (ma_phong_cu,)).fetchone():
        return jsonify({"error": "Không tìm thấy phòng ban."}), 404

    if ma_moi != ma_phong_cu:
        if db.execute("SELECT 1 FROM phong_ban WHERE ma_phong = ?", (ma_moi,)).fetchone():
            return jsonify({"error": "Mã phòng đã tồn tại."}), 409

    # Đổi mã phòng sẽ tự CASCADE sang nhan_vien.ma_phong và
    # phieu_yeu_cau.phong_thuc_hien nhờ ON UPDATE CASCADE (schema.sql).
    db.execute(
        "UPDATE phong_ban SET ma_phong = ?, ten_phong = ?, truong_phong = ?, ghi_chu = ? WHERE ma_phong = ?",
        (ma_moi, ten, (data.get("truongPhong") or "").strip(), (data.get("ghiChu") or "").strip(), ma_phong_cu),
    )
    db.commit()
    row = db.execute("SELECT * FROM phong_ban WHERE ma_phong = ?", (ma_moi,)).fetchone()
    return jsonify(phong_ban_to_dict(row))


@bp.delete("/phong-ban/<ma_phong>")
@admin_required
def delete_phong_ban(user, ma_phong):
    db = get_db()
    dang_dung = db.execute(
        "SELECT 1 FROM nhan_vien WHERE ma_phong = ? "
        "UNION SELECT 1 FROM phieu_yeu_cau WHERE phong_thuc_hien = ? OR don_vi_yeu_cau = ?",
        (ma_phong, ma_phong, ma_phong),
    ).fetchone()
    if dang_dung:
        return jsonify({"error": "Không thể xoá: phòng đang được dùng ở nhân viên hoặc phiếu yêu cầu."}), 409

    db.execute("DELETE FROM phong_ban WHERE ma_phong = ?", (ma_phong,))
    db.commit()
    return jsonify({"ok": True})


# =====================================================
# Loại yêu cầu
# =====================================================

_MA_LOAI_HOP_LE = re.compile(r"^[a-z0-9_]{2,20}$")


def _chuan_hoa_ma_loai(raw):
    ma = (raw or "").strip().lower()
    ma = re.sub(r"\s+", "_", ma)
    return re.sub(r"[^a-z0-9_]", "", ma)


@bp.get("/loai-yeu-cau")
@login_required
def list_loai_yeu_cau(user):
    db = get_db()
    rows = db.execute("SELECT * FROM loai_yeu_cau ORDER BY ma_loai").fetchall()
    return jsonify([loai_yeu_cau_to_dict(r) for r in rows])


@bp.post("/loai-yeu-cau")
@admin_required
def create_loai_yeu_cau(user):
    data = request.get_json(silent=True) or {}
    ma = _chuan_hoa_ma_loai(data.get("ma"))
    ten = (data.get("ten") or "").strip()

    if not _MA_LOAI_HOP_LE.match(ma):
        return jsonify({"error": "Mã loại gồm 2-20 ký tự chữ thường, số hoặc gạch dưới."}), 400
    if not ten:
        return jsonify({"error": "Vui lòng nhập tên loại yêu cầu."}), 400

    db = get_db()
    if db.execute("SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", (ma,)).fetchone():
        return jsonify({"error": "Mã loại đã tồn tại."}), 409

    db.execute(
        "INSERT INTO loai_yeu_cau (ma_loai, ten, mo_ta) VALUES (?, ?, ?)",
        (ma, ten, (data.get("moTa") or "").strip()),
    )
    db.commit()
    row = db.execute("SELECT * FROM loai_yeu_cau WHERE ma_loai = ?", (ma,)).fetchone()
    return jsonify(loai_yeu_cau_to_dict(row)), 201


@bp.put("/loai-yeu-cau/<ma_loai_cu>")
@admin_required
def update_loai_yeu_cau(user, ma_loai_cu):
    data = request.get_json(silent=True) or {}
    ma_moi = _chuan_hoa_ma_loai(data.get("ma"))
    ten = (data.get("ten") or "").strip()

    if not _MA_LOAI_HOP_LE.match(ma_moi):
        return jsonify({"error": "Mã loại gồm 2-20 ký tự chữ thường, số hoặc gạch dưới."}), 400
    if not ten:
        return jsonify({"error": "Vui lòng nhập tên loại yêu cầu."}), 400

    db = get_db()
    if not db.execute("SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", (ma_loai_cu,)).fetchone():
        return jsonify({"error": "Không tìm thấy loại yêu cầu."}), 404

    if ma_moi != ma_loai_cu:
        if db.execute("SELECT 1 FROM loai_yeu_cau WHERE ma_loai = ?", (ma_moi,)).fetchone():
            return jsonify({"error": "Mã loại đã tồn tại."}), 409

    db.execute(
        "UPDATE loai_yeu_cau SET ma_loai = ?, ten = ?, mo_ta = ? WHERE ma_loai = ?",
        (ma_moi, ten, (data.get("moTa") or "").strip(), ma_loai_cu),
    )
    db.commit()
    row = db.execute("SELECT * FROM loai_yeu_cau WHERE ma_loai = ?", (ma_moi,)).fetchone()
    return jsonify(loai_yeu_cau_to_dict(row))


@bp.delete("/loai-yeu-cau/<ma_loai>")
@admin_required
def delete_loai_yeu_cau(user, ma_loai):
    db = get_db()
    if db.execute("SELECT 1 FROM phieu_yeu_cau WHERE loai_pyc = ?", (ma_loai,)).fetchone():
        return jsonify({"error": "Không thể xoá: loại yêu cầu đang được dùng ở phiếu yêu cầu."}), 409

    db.execute("DELETE FROM loai_yeu_cau WHERE ma_loai = ?", (ma_loai,))
    db.commit()
    return jsonify({"ok": True})
