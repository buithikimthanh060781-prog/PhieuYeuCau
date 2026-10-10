-- =========================================================
-- 0001_init.sql - Cấu trúc D1 cho "phieuyeucau" (Cloudflare Worker)
--
-- Chuyển thể từ schema.sql (bản Flask/SQLite). Khác biệt duy nhất có chủ
-- đích: KHÔNG dùng "ON UPDATE CASCADE"/"ON DELETE CASCADE" - D1 không đảm
-- bảo PRAGMA foreign_keys bật xuyên suốt mọi lệnh gọi, nên các cascade này
-- (đổi mã phòng -> cập nhật nhan_vien/phieu_yeu_cau; xoá phiếu -> xoá lịch
-- sử/tệp/thông báo liên quan) được viết rõ bằng các lệnh UPDATE/DELETE
-- riêng trong worker/src/lib/db.ts, gói trong một D1 batch() để vẫn atomic.
-- =========================================================

CREATE TABLE phong_ban (
    ma_phong        TEXT PRIMARY KEY,
    ten_phong       TEXT NOT NULL,
    truong_phong    TEXT,
    ghi_chu         TEXT,
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE loai_yeu_cau (
    ma_loai         TEXT PRIMARY KEY,
    ten             TEXT NOT NULL,
    mo_ta           TEXT,
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE nhan_vien (
    username        TEXT PRIMARY KEY,
    password_hash   TEXT NOT NULL,
    ho_ten          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    ma_phong        TEXT NOT NULL REFERENCES phong_ban (ma_phong),
    so_dien_thoai   TEXT,
    chuc_danh       TEXT NOT NULL CHECK (chuc_danh IN ('nhanvien', 'quanly', 'admin')),
    nguoi_quan_ly   TEXT REFERENCES nhan_vien (username),
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE phieu_yeu_cau (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_pyc                  TEXT NOT NULL UNIQUE,
    huong                   TEXT NOT NULL CHECK (huong IN ('di', 'den')),
    loai_pyc                TEXT NOT NULL REFERENCES loai_yeu_cau (ma_loai),
    don_vi_yeu_cau          TEXT NOT NULL,
    ngay_yeu_cau            TEXT NOT NULL,
    thoi_han                TEXT NOT NULL,
    noi_dung                TEXT NOT NULL,
    phong_thuc_hien         TEXT NOT NULL REFERENCES phong_ban (ma_phong),
    nguoi_thuc_hien_user    TEXT REFERENCES nhan_vien (username),
    tinh_trang              TEXT NOT NULL DEFAULT 'moi'
                                CHECK (tinh_trang IN ('moi', 'dangxuly', 'choqlyduyet', 'quanly_dong_y', 'quanly_tuchoi', 'choduyet', 'hoanthanh', 'tuchoi', 'tuchoi_tiepnhan')),
    uu_tien                 TEXT NOT NULL DEFAULT 'binhthuong'
                                CHECK (uu_tien IN ('thap', 'binhthuong', 'cao', 'khancap')),
    nguoi_tao_user          TEXT NOT NULL REFERENCES nhan_vien (username),
    ngay_tao                TEXT NOT NULL,
    ngay_cap_nhat           TEXT NOT NULL
);

CREATE INDEX idx_pyc_huong            ON phieu_yeu_cau (huong);
CREATE INDEX idx_pyc_tinh_trang       ON phieu_yeu_cau (tinh_trang);
CREATE INDEX idx_pyc_nguoi_tao        ON phieu_yeu_cau (nguoi_tao_user);
CREATE INDEX idx_pyc_nguoi_thuc_hien  ON phieu_yeu_cau (nguoi_thuc_hien_user);
CREATE INDEX idx_pyc_phong_thuc_hien  ON phieu_yeu_cau (phong_thuc_hien);
CREATE INDEX idx_nv_ma_phong          ON nhan_vien (ma_phong);

CREATE TABLE lich_su_xu_ly (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER NOT NULL REFERENCES phieu_yeu_cau (id),
    tinh_trang      TEXT NOT NULL,
    thoi_gian       TEXT NOT NULL,
    nguoi_user      TEXT REFERENCES nhan_vien (username),
    vai_tro         TEXT,
    ghi_chu         TEXT,
    nhan_su_kien    TEXT
);

CREATE INDEX idx_lsxl_phieu ON lich_su_xu_ly (phieu_id);

CREATE TABLE tep_dinh_kem (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER REFERENCES phieu_yeu_cau (id),
    lich_su_id      INTEGER REFERENCES lich_su_xu_ly (id),
    ten_tep         TEXT NOT NULL,
    kich_thuoc      INTEGER,
    loai_mime       TEXT,
    duong_dan       TEXT NOT NULL,
    nguoi_tai_user  TEXT REFERENCES nhan_vien (username),
    ngay_tai        TEXT NOT NULL,

    CHECK (
        (phieu_id IS NOT NULL AND lich_su_id IS NULL) OR
        (phieu_id IS NULL AND lich_su_id IS NOT NULL)
    )
);

CREATE INDEX idx_tdk_phieu    ON tep_dinh_kem (phieu_id);
CREATE INDEX idx_tdk_lich_su  ON tep_dinh_kem (lich_su_id);

CREATE TABLE thong_bao (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER NOT NULL REFERENCES phieu_yeu_cau (id),
    nguoi_nhan_user TEXT NOT NULL REFERENCES nhan_vien (username),
    noi_dung        TEXT NOT NULL,
    tinh_trang      TEXT NOT NULL,
    thoi_gian       TEXT NOT NULL,
    da_xem          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tb_nguoi_nhan ON thong_bao (nguoi_nhan_user, da_xem);
