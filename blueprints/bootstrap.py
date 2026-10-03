# -*- coding: utf-8 -*-
"""
blueprints/bootstrap.py - Một endpoint duy nhất trả về mọi thứ cần thiết để
vẽ trang: người dùng hiện tại, danh mục phòng ban/loại yêu cầu/nhân viên,
và danh sách phiếu yêu cầu đã lọc theo quyền.

Gộp thành 1 lượt gọi thay vì nhiều request nhỏ, giữ đúng tinh thần của bản
demo cũ (mọi trang đều đọc toàn bộ dữ liệu cần thiết ngay khi tải trang).
"""
from flask import Blueprint, jsonify

import permissions as perm
import repo_phieu as repo
from auth_helpers import login_required
from database import get_db
from serializers import loai_yeu_cau_to_dict, nhan_vien_to_dict, phong_ban_to_dict

bp = Blueprint("bootstrap", __name__, url_prefix="/api")


@bp.get("/bootstrap")
@login_required
def bootstrap(user):
    db = get_db()

    phong_ban = [phong_ban_to_dict(r) for r in db.execute("SELECT * FROM phong_ban ORDER BY ma_phong").fetchall()]
    loai = [loai_yeu_cau_to_dict(r) for r in db.execute("SELECT * FROM loai_yeu_cau ORDER BY ma_loai").fetchall()]
    nhan_vien = [nhan_vien_to_dict(r) for r in db.execute("SELECT * FROM nhan_vien ORDER BY ho_ten").fetchall()]

    where_sql, where_params = perm.scope_where_clause(user)
    tickets = repo.list_tickets(db, where_sql, where_params)

    return jsonify({
        "user": user,
        "phongBan": phong_ban,
        "loaiYeuCau": loai,
        "nhanVien": nhan_vien,
        "phieuYeuCau": tickets,
    })
