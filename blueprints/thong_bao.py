# -*- coding: utf-8 -*-
"""
blueprints/thong_bao.py - Thông báo (chuông): sinh ra khi tình trạng phiếu
đổi hoặc khi phân công người thực hiện (xem repo_phieu._tao_thong_bao).
Chuông chỉ hiển thị thông báo CHƯA XEM của người dùng hiện tại.
"""
from flask import Blueprint, jsonify, request

from auth_helpers import login_required
from database import get_db
from serializers import thong_bao_to_dict

bp = Blueprint("thong_bao", __name__, url_prefix="/api/thong-bao")

_SELECT_SQL = """
    SELECT t.*, p.ma_pyc
    FROM thong_bao t
    JOIN phieu_yeu_cau p ON p.id = t.phieu_id
    WHERE t.nguoi_nhan_user = ?
"""


@bp.get("")
@login_required
def danh_sach(user):
    """Mặc định chỉ trả về thông báo CHƯA XEM (đúng vai trò của chuông).
    Truyền ?chuaXem=0 để lấy toàn bộ (dùng cho trang xem lại lịch sử nếu
    cần sau này)."""
    db = get_db()
    chi_chua_xem = request.args.get("chuaXem", "1") != "0"

    sql = _SELECT_SQL + (" AND t.da_xem = 0" if chi_chua_xem else "") + " ORDER BY t.id DESC"
    rows = db.execute(sql, (user["username"],)).fetchall()
    return jsonify([thong_bao_to_dict(r) for r in rows])


@bp.post("/<int:thong_bao_id>/da-xem")
@login_required
def danh_dau_da_xem(user, thong_bao_id):
    db = get_db()
    db.execute(
        "UPDATE thong_bao SET da_xem = 1 WHERE id = ? AND nguoi_nhan_user = ?",
        (thong_bao_id, user["username"]),
    )
    db.commit()
    return jsonify({"ok": True})


@bp.post("/danh-dau-tat-ca")
@login_required
def danh_dau_tat_ca(user):
    db = get_db()
    db.execute(
        "UPDATE thong_bao SET da_xem = 1 WHERE nguoi_nhan_user = ? AND da_xem = 0",
        (user["username"],),
    )
    db.commit()
    return jsonify({"ok": True})
