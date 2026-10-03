# -*- coding: utf-8 -*-
"""
database.py - Lớp kết nối cơ sở dữ liệu SQLite (phieuyeucau.db)

Theo đúng khuyến nghị chính thức của Flask (flask.palletsprojects.com/tutorial):
mỗi request dùng một kết nối sqlite3 lưu trong `flask.g`, tự đóng khi
request kết thúc; lệnh `flask --app app init-db` tạo lại toàn bộ bảng
theo schema.sql rồi nạp dữ liệu mẫu từ seed_data.py.
"""
import sqlite3

import click
from flask import current_app, g


def get_db():
    """Trả về kết nối sqlite3 của request hiện tại, tạo mới nếu chưa có."""
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        # SQLite mặc định TẮT ràng buộc khoá ngoại - phải bật thủ công
        # mỗi kết nối để các ON DELETE CASCADE / REFERENCES có tác dụng.
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(e=None):
    """Đóng kết nối khi kết thúc request (Flask tự gọi qua teardown_appcontext)."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Xoá và tạo lại toàn bộ bảng theo schema.sql (không nạp dữ liệu mẫu)."""
    db = get_db()
    with current_app.open_resource("schema.sql") as f:
        db.executescript(f.read().decode("utf8"))


@click.command("init-db")
@click.option(
    "--seed/--no-seed",
    default=True,
    help="Nạp thêm dữ liệu mẫu sau khi tạo bảng (mặc định: có).",
)
def init_db_command(seed):
    """Xoá dữ liệu cũ (nếu có) và tạo lại toàn bộ bảng của phieuyeucau.db."""
    init_db()
    click.echo("Đã tạo lại cấu trúc cơ sở dữ liệu theo schema.sql.")

    if seed:
        from seed_data import seed_database

        thong_ke = seed_database(get_db())
        get_db().commit()
        click.echo(
            "Đã nạp dữ liệu mẫu: "
            f"{thong_ke['phong_ban']} phòng ban, "
            f"{thong_ke['loai_yeu_cau']} loại yêu cầu, "
            f"{thong_ke['nhan_vien']} nhân viên, "
            f"{thong_ke['phieu_yeu_cau']} phiếu yêu cầu, "
            f"{thong_ke['lich_su_xu_ly']} dòng lịch sử xử lý."
        )


@click.command("migrate-status")
def migrate_status_command():
    """Cập nhật CSDL đã có sẵn (KHÔNG xoá dữ liệu) để dùng được luồng xử lý
    mới: thêm bảng thong_bao, thêm các trạng thái 'choqlyduyet'/'tuchoi_tiepnhan'
    vào CHECK constraint của phieu_yeu_cau.tinh_trang. An toàn để chạy nhiều
    lần (tự bỏ qua phần đã áp dụng)."""
    db = get_db()

    # 1. Bảng thông báo - chỉ tạo nếu chưa có, không đụng gì tới dữ liệu cũ.
    da_co_thong_bao = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'thong_bao'"
    ).fetchone()
    if da_co_thong_bao:
        click.echo("Bảng thong_bao đã có sẵn - bỏ qua.")
    else:
        db.execute(
            """
            CREATE TABLE thong_bao (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                phieu_id        INTEGER NOT NULL REFERENCES phieu_yeu_cau (id) ON DELETE CASCADE,
                nguoi_nhan_user TEXT NOT NULL REFERENCES nhan_vien (username),
                noi_dung        TEXT NOT NULL,
                tinh_trang      TEXT NOT NULL,
                thoi_gian       TEXT NOT NULL,
                da_xem          INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        db.execute("CREATE INDEX idx_tb_nguoi_nhan ON thong_bao (nguoi_nhan_user, da_xem)")
        click.echo("Đã tạo bảng thong_bao.")

    # 2. CHECK constraint của tinh_trang - SQLite không cho ALTER COLUMN nên
    #    phải dựng lại bảng: đếm dữ liệu trước, sau khi xong đối chiếu lại.
    dinh_nghia = db.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'phieu_yeu_cau'"
    ).fetchone()
    da_du_trang_thai = (
        dinh_nghia
        and "choqlyduyet" in dinh_nghia["sql"]
        and "tuchoi_tiepnhan" in dinh_nghia["sql"]
        and "quanly_dong_y" in dinh_nghia["sql"]
    )
    if da_du_trang_thai:
        click.echo("CHECK constraint của tinh_trang đã đủ trạng thái mới - bỏ qua.")
    else:
        so_dong_truoc = db.execute("SELECT COUNT(*) AS n FROM phieu_yeu_cau").fetchone()["n"]

        db.execute("PRAGMA foreign_keys = OFF")
        db.execute(
            """
            CREATE TABLE phieu_yeu_cau_new (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                ma_pyc                  TEXT NOT NULL UNIQUE,
                huong                   TEXT NOT NULL CHECK (huong IN ('di', 'den')),
                loai_pyc                TEXT NOT NULL REFERENCES loai_yeu_cau (ma_loai) ON UPDATE CASCADE,
                don_vi_yeu_cau          TEXT NOT NULL,
                ngay_yeu_cau            TEXT NOT NULL,
                thoi_han                TEXT NOT NULL,
                noi_dung                TEXT NOT NULL,
                phong_thuc_hien         TEXT NOT NULL REFERENCES phong_ban (ma_phong) ON UPDATE CASCADE,
                nguoi_thuc_hien_user    TEXT REFERENCES nhan_vien (username),
                tinh_trang              TEXT NOT NULL DEFAULT 'moi'
                                            CHECK (tinh_trang IN ('moi', 'dangxuly', 'choqlyduyet', 'quanly_dong_y', 'quanly_tuchoi', 'choduyet', 'hoanthanh', 'tuchoi', 'tuchoi_tiepnhan')),
                uu_tien                 TEXT NOT NULL DEFAULT 'binhthuong'
                                            CHECK (uu_tien IN ('thap', 'binhthuong', 'cao', 'khancap')),
                nguoi_tao_user          TEXT NOT NULL REFERENCES nhan_vien (username),
                ngay_tao                TEXT NOT NULL,
                ngay_cap_nhat           TEXT NOT NULL
            )
            """
        )
        db.execute("INSERT INTO phieu_yeu_cau_new SELECT * FROM phieu_yeu_cau")
        db.execute("DROP TABLE phieu_yeu_cau")
        db.execute("ALTER TABLE phieu_yeu_cau_new RENAME TO phieu_yeu_cau")

        db.execute("CREATE INDEX idx_pyc_huong            ON phieu_yeu_cau (huong)")
        db.execute("CREATE INDEX idx_pyc_tinh_trang       ON phieu_yeu_cau (tinh_trang)")
        db.execute("CREATE INDEX idx_pyc_nguoi_tao        ON phieu_yeu_cau (nguoi_tao_user)")
        db.execute("CREATE INDEX idx_pyc_nguoi_thuc_hien  ON phieu_yeu_cau (nguoi_thuc_hien_user)")
        db.execute("CREATE INDEX idx_pyc_phong_thuc_hien  ON phieu_yeu_cau (phong_thuc_hien)")
        db.execute("PRAGMA foreign_keys = ON")

        so_dong_sau = db.execute("SELECT COUNT(*) AS n FROM phieu_yeu_cau").fetchone()["n"]
        if so_dong_sau != so_dong_truoc:
            db.rollback()
            raise click.ClickException(
                f"Số dòng lệch sau khi migrate ({so_dong_truoc} -> {so_dong_sau}) - đã rollback."
            )
        click.echo(f"Đã cập nhật CHECK constraint tinh_trang, giữ nguyên {so_dong_sau} phiếu.")

        # Dữ liệu cũ: trước bản vá này, quản lý TỪ CHỐI ở bước "Chờ quản lý
        # duyệt" bị ghi chung vào "dangxuly" (không phân biệt được với việc
        # người thực hiện tự bắt đầu/làm lại) - suy luận lại chính xác bằng
        # vai_tro của dòng lịch sử (CHỈ quản lý phòng thực hiện mới tạo được
        # dòng "dangxuly" mà không đồng thời là người tạo/người thực hiện).
        so_ls = db.execute(
            "UPDATE lich_su_xu_ly SET tinh_trang = 'quanly_tuchoi' "
            "WHERE tinh_trang = 'dangxuly' AND vai_tro = 'Quản lý phòng thực hiện'"
        ).rowcount
        so_phieu = db.execute(
            """
            UPDATE phieu_yeu_cau SET tinh_trang = 'quanly_tuchoi'
            WHERE tinh_trang = 'dangxuly' AND id IN (
                SELECT phieu_id FROM lich_su_xu_ly l1
                WHERE l1.tinh_trang = 'quanly_tuchoi'
                AND l1.id = (SELECT MAX(l2.id) FROM lich_su_xu_ly l2 WHERE l2.phieu_id = l1.phieu_id)
            )
            """
        ).rowcount
        if so_ls or so_phieu:
            click.echo(
                f"Đã suy luận lại {so_ls} dòng lịch sử và {so_phieu} phiếu đang ở "
                "\"Đang xử lý\" thực chất là \"Quản lý từ chối\"."
            )

    # 3. Cột nhan_su_kien trên lich_su_xu_ly - nhãn hiển thị ghi đè cho các
    #    dòng lịch sử KHÔNG phải đổi tình trạng thật (phân công, từ chối
    #    thực hiện...). Thêm cột mới KHÔNG cần dựng lại bảng như trên.
    cot_lich_su = [r["name"] for r in db.execute("PRAGMA table_info(lich_su_xu_ly)").fetchall()]
    if "nhan_su_kien" in cot_lich_su:
        click.echo("Cột nhan_su_kien đã có sẵn - bỏ qua.")
    else:
        db.execute("ALTER TABLE lich_su_xu_ly ADD COLUMN nhan_su_kien TEXT")
        # Gán lại nhãn cho các dòng lịch sử cũ đã có kiểu ghi chú tương ứng,
        # để lịch sử cũ hiển thị đúng ngay cả khi được ghi trước bản vá này.
        so_phan_cong = db.execute(
            "UPDATE lich_su_xu_ly SET nhan_su_kien = 'Phân công' "
            "WHERE ghi_chu LIKE 'Phân công người thực hiện:%'"
        ).rowcount
        so_tu_choi_th = db.execute(
            "UPDATE lich_su_xu_ly SET nhan_su_kien = 'Từ chối thực hiện' "
            "WHERE ghi_chu LIKE 'Từ chối thực hiện:%'"
        ).rowcount
        click.echo(
            f"Đã thêm cột nhan_su_kien, gán lại nhãn cho {so_phan_cong} dòng phân công "
            f"và {so_tu_choi_th} dòng từ chối thực hiện cũ."
        )

    db.commit()
    click.echo("Hoàn tất migrate-status.")


def init_app(app):
    """Đăng ký các hàm trên vào ứng dụng Flask."""
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(migrate_status_command)
