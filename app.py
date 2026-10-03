# -*- coding: utf-8 -*-
"""
app.py - Ứng dụng Flask "Quản lý phiếu yêu cầu"

Phục vụ đúng các trang HTML/CSS/JS tĩnh đã có (KHÔNG chỉnh sửa nội dung
các file đó) và toàn bộ API JSON dưới tiền tố /api/... mà js/data.js phiên
bản mới gọi tới thay cho localStorage.

Cách dùng:
    py -m flask --app app init-db      # tạo bảng + nạp dữ liệu mẫu (1 lần đầu)
    py -m flask --app app run --debug  # chạy thử tại http://127.0.0.1:5000
"""
import os

from flask import Flask, redirect, send_from_directory

import database
from blueprints.auth import bp as auth_bp
from blueprints.bootstrap import bp as bootstrap_bp
from blueprints.danh_muc import bp as danh_muc_bp
from blueprints.nhan_vien import bp as nhan_vien_bp
from blueprints.phieu_yeu_cau import bp as phieu_yeu_cau_bp
from blueprints.thong_bao import bp as thong_bao_bp

# Các trang HTML gốc - giữ nguyên tên tệp, phục vụ y hệt bản demo tĩnh
TRANG_HTML = [
    "index.html", "dashboard.html", "chi-tiet.html",
    "phong.html", "loai-yeu-cau.html", "nhan-vien.html",
]


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY="dev",  # TODO: đặt giá trị bí mật thật (biến môi trường) khi triển khai thật
        DATABASE=os.path.join(app.root_path, "phieuyeucau.db"),
        MAX_CONTENT_LENGTH=20 * 1024 * 1024,  # tối đa 20MB/request (vài tệp đính kèm cùng lúc)
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )

    if test_config is None:
        app.config.from_pyfile("config.py", silent=True)
    else:
        app.config.update(test_config)

    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
    os.makedirs(os.path.join(app.root_path, "filedinhkem"), exist_ok=True)

    database.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(bootstrap_bp)
    app.register_blueprint(danh_muc_bp)
    app.register_blueprint(nhan_vien_bp)
    app.register_blueprint(phieu_yeu_cau_bp)
    app.register_blueprint(thong_bao_bp)

    # ---------------------------------------------------------------
    # Phục vụ giao diện tĩnh - giữ nguyên 100% các tệp HTML/CSS/JS hiện có,
    # không dùng render_template/Jinja để không phải đổi bất kỳ nội dung nào.
    # ---------------------------------------------------------------
    @app.route("/")
    def trang_goc():
        return redirect("/index.html")

    for ten_tep in TRANG_HTML:
        def _lam_route(ten_tep=ten_tep):
            def _serve():
                return send_from_directory(app.root_path, ten_tep)
            return _serve

        app.add_url_rule(f"/{ten_tep}", endpoint=f"trang_{ten_tep}", view_func=_lam_route())

    @app.route("/css/<path:filename>")
    def css(filename):
        return send_from_directory(os.path.join(app.root_path, "css"), filename)

    @app.route("/js/<path:filename>")
    def js(filename):
        return send_from_directory(os.path.join(app.root_path, "js"), filename)

    @app.route("/data/<path:filename>")
    def data_tinh(filename):
        return send_from_directory(os.path.join(app.root_path, "data"), filename)

    # Lưu ý: KHÔNG có route tĩnh công khai cho filedinhkem/ - tệp đính kèm chỉ
    # tải xuống được qua GET /api/tep-dinh-kem/<id>/tai-xuong (có kiểm tra quyền
    # xem phiếu), tránh lộ tệp của người khác chỉ bằng cách đoán đường dẫn.

    return app


if __name__ == "__main__":
    create_app().run(debug=True)
