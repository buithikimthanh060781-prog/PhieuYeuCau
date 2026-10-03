-- =========================================================
-- schema.sql - Cấu trúc cơ sở dữ liệu "phieuyeucau.db"
--
-- Sáu bảng dưới đây tương ứng 1:1 với các thực thể đang được lưu
-- trong localStorage của bản demo tĩnh (js/data.js):
--
--   pyc_departments -> phong_ban
--   pyc_loaiyeucau  -> loai_yeu_cau
--   pyc_users       -> nhan_vien
--   pyc_tickets     -> phieu_yeu_cau (+ lich_su_xu_ly + tep_dinh_kem)
--
-- Danh mục cố định (hướng, tình trạng, ưu tiên, chức danh) KHÔNG có
-- bảng riêng vì bản demo cũng không lưu chúng vào localStorage - đó
-- là hằng số nghiệp vụ, không phải dữ liệu người dùng chỉnh sửa.
-- Chúng được giữ trong constants.py để dùng chung cho toàn bộ ứng dụng
-- Flask (route, validate, hiển thị).
--
-- Phiên đăng nhập (pyc_session) cũng không có bảng: Flask quản lý
-- phiên làm việc qua session cookie có ký tên (flask.session), đây là
-- trạng thái tạm thời của trình duyệt, không phải dữ liệu cần lưu trữ
-- lâu dài.
-- =========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- Xoá bảng cũ (nếu có) trước khi tạo lại - PHẢI xoá theo thứ tự
-- con trước, cha sau. Khi foreign_keys=ON, DROP TABLE thực hiện
-- một lượt DELETE ngầm và kiểm tra ràng buộc; nếu xoá bảng cha
-- (vd. phong_ban) trong khi bảng con (nhan_vien, phieu_yeu_cau)
-- vẫn còn tồn tại và tham chiếu tới nó, thao tác sẽ báo lỗi
-- FOREIGN KEY constraint failed.
-- ---------------------------------------------------------
DROP TABLE IF EXISTS tep_dinh_kem;
DROP TABLE IF EXISTS lich_su_xu_ly;
DROP TABLE IF EXISTS phieu_yeu_cau;
DROP TABLE IF EXISTS nhan_vien;
DROP TABLE IF EXISTS loai_yeu_cau;
DROP TABLE IF EXISTS phong_ban;

-- ---------------------------------------------------------
-- 1. Phòng ban
-- ---------------------------------------------------------
CREATE TABLE phong_ban (
    ma_phong        TEXT PRIMARY KEY,          -- vd: P.CNTT
    ten_phong       TEXT NOT NULL,
    truong_phong    TEXT,
    ghi_chu         TEXT,
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

-- ---------------------------------------------------------
-- 2. Loại yêu cầu
-- ---------------------------------------------------------
CREATE TABLE loai_yeu_cau (
    ma_loai         TEXT PRIMARY KEY,          -- vd: muasam
    ten             TEXT NOT NULL,
    mo_ta           TEXT,
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

-- ---------------------------------------------------------
-- 3. Nhân viên
--    Dùng "username" làm khoá chính vì đây chính là khoá mà toàn bộ
--    ứng dụng (nguoiTaoUser, nguoiThucHienUser, nguoiQuanLy) dùng để
--    tham chiếu, thay vì id nội bộ "u0", "u1"... của bản demo.
-- ---------------------------------------------------------
CREATE TABLE nhan_vien (
    username        TEXT PRIMARY KEY,
    password_hash   TEXT NOT NULL,              -- băm bằng werkzeug, không lưu thô như bản demo
    ho_ten          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    ma_phong        TEXT NOT NULL REFERENCES phong_ban (ma_phong) ON UPDATE CASCADE,
    so_dien_thoai   TEXT,
    chuc_danh       TEXT NOT NULL CHECK (chuc_danh IN ('nhanvien', 'quanly', 'admin')),
    nguoi_quan_ly   TEXT REFERENCES nhan_vien (username),   -- tự tham chiếu, NULL nếu không có
    ngay_tao        TEXT NOT NULL DEFAULT (date('now'))
);

-- ---------------------------------------------------------
-- 4. Phiếu yêu cầu
--    Không lưu lại tên hiển thị (nguoiTao/nguoiThucHien) như bản demo
--    tĩnh - ứng dụng Flask sẽ JOIN sang nhan_vien.ho_ten khi cần hiển
--    thị, tránh dữ liệu trùng lặp (denormalize) có thể lệch nhau khi
--    nhân viên đổi họ tên.
-- ---------------------------------------------------------
CREATE TABLE phieu_yeu_cau (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_pyc                  TEXT NOT NULL UNIQUE,       -- vd: YCD-2026-0001
    huong                   TEXT NOT NULL CHECK (huong IN ('di', 'den')),
    loai_pyc                TEXT NOT NULL REFERENCES loai_yeu_cau (ma_loai) ON UPDATE CASCADE,
    don_vi_yeu_cau          TEXT NOT NULL,              -- mã phòng nội bộ hoặc tên đơn vị/chi nhánh bên ngoài
    ngay_yeu_cau            TEXT NOT NULL,              -- yyyy-mm-dd
    thoi_han                TEXT NOT NULL,              -- yyyy-mm-dd
    noi_dung                TEXT NOT NULL,
    phong_thuc_hien         TEXT NOT NULL REFERENCES phong_ban (ma_phong) ON UPDATE CASCADE,
    nguoi_thuc_hien_user    TEXT REFERENCES nhan_vien (username),
    tinh_trang              TEXT NOT NULL DEFAULT 'moi'
                                CHECK (tinh_trang IN ('moi', 'dangxuly', 'choqlyduyet', 'quanly_dong_y', 'quanly_tuchoi', 'choduyet', 'hoanthanh', 'tuchoi', 'tuchoi_tiepnhan')),
    uu_tien                 TEXT NOT NULL DEFAULT 'binhthuong'
                                CHECK (uu_tien IN ('thap', 'binhthuong', 'cao', 'khancap')),
    nguoi_tao_user          TEXT NOT NULL REFERENCES nhan_vien (username),
    ngay_tao                TEXT NOT NULL,              -- yyyy-mm-dd (ngày tạo phiếu)
    ngay_cap_nhat           TEXT NOT NULL               -- yyyy-mm-dd (lần cập nhật gần nhất)
);

CREATE INDEX idx_pyc_huong            ON phieu_yeu_cau (huong);
CREATE INDEX idx_pyc_tinh_trang       ON phieu_yeu_cau (tinh_trang);
CREATE INDEX idx_pyc_nguoi_tao        ON phieu_yeu_cau (nguoi_tao_user);
CREATE INDEX idx_pyc_nguoi_thuc_hien  ON phieu_yeu_cau (nguoi_thuc_hien_user);
CREATE INDEX idx_pyc_phong_thuc_hien  ON phieu_yeu_cau (phong_thuc_hien);
CREATE INDEX idx_nv_ma_phong          ON nhan_vien (ma_phong);

-- ---------------------------------------------------------
-- 5. Lịch sử xử lý (tương ứng mảng lichSu[] gắn trong mỗi phiếu)
--    Mỗi lần đổi tình trạng tạo một dòng, ghi lại ai đổi, đổi khi nào,
--    vai trò (người tạo / người thực hiện) và ghi chú xử lý.
-- ---------------------------------------------------------
CREATE TABLE lich_su_xu_ly (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER NOT NULL REFERENCES phieu_yeu_cau (id) ON DELETE CASCADE,
    tinh_trang      TEXT NOT NULL,
    thoi_gian       TEXT NOT NULL,              -- ISO datetime
    nguoi_user      TEXT REFERENCES nhan_vien (username),
    vai_tro         TEXT,                       -- 'Người tạo phiếu' | 'Người thực hiện'
    ghi_chu         TEXT,
    nhan_su_kien    TEXT                        -- nhãn hiển thị ghi đè (vd 'Phân công', 'Từ chối
                                                 -- thực hiện') cho các dòng KHÔNG phải đổi tình
                                                 -- trạng thật sự - NULL thì hiển thị theo tinh_trang
);

CREATE INDEX idx_lsxl_phieu ON lich_su_xu_ly (phieu_id);

-- ---------------------------------------------------------
-- 6. Tệp đính kèm
--    Dùng chung một bảng cho cả hai loại tệp của bản demo:
--      - Tệp hồ sơ gắn thẳng vào phiếu   (model.files[])      -> phieu_id
--      - Bằng chứng gắn vào một lần cập nhật tình trạng
--        (lichSu[].files[])                                   -> lich_su_id
--    Đúng một trong hai cột phieu_id / lich_su_id có giá trị.
--
--    Khác với bản demo (lưu nội dung tệp dạng Data URL trong
--    localStorage), ở đây chỉ lưu đường dẫn tệp vật lý trên đĩa
--    (thư mục filedinhkem/) - đúng như khuyến nghị đã ghi trong
--    filedinhkem/README.txt.
-- ---------------------------------------------------------
CREATE TABLE tep_dinh_kem (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER REFERENCES phieu_yeu_cau (id) ON DELETE CASCADE,
    lich_su_id      INTEGER REFERENCES lich_su_xu_ly (id) ON DELETE CASCADE,
    ten_tep         TEXT NOT NULL,              -- tên gốc của tệp
    kich_thuoc      INTEGER,                    -- số byte
    loai_mime       TEXT,
    duong_dan       TEXT NOT NULL,              -- đường dẫn tương đối trong filedinhkem/
    nguoi_tai_user  TEXT REFERENCES nhan_vien (username),
    ngay_tai        TEXT NOT NULL,              -- ISO datetime

    CHECK (
        (phieu_id IS NOT NULL AND lich_su_id IS NULL) OR
        (phieu_id IS NULL AND lich_su_id IS NOT NULL)
    )
);

CREATE INDEX idx_tdk_phieu    ON tep_dinh_kem (phieu_id);
CREATE INDEX idx_tdk_lich_su  ON tep_dinh_kem (lich_su_id);

-- ---------------------------------------------------------
-- 7. Thông báo
--    Sinh ra mỗi khi tình trạng phiếu đổi (hoặc phân công người thực hiện),
--    gửi tới người tạo phiếu + người thực hiện + quản lý phòng thực hiện
--    (trừ người vừa thao tác). Chuông chỉ hiển thị các dòng da_xem = 0.
-- ---------------------------------------------------------
CREATE TABLE thong_bao (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phieu_id        INTEGER NOT NULL REFERENCES phieu_yeu_cau (id) ON DELETE CASCADE,
    nguoi_nhan_user TEXT NOT NULL REFERENCES nhan_vien (username),
    noi_dung        TEXT NOT NULL,
    tinh_trang      TEXT NOT NULL,
    thoi_gian       TEXT NOT NULL,              -- ISO datetime
    da_xem          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tb_nguoi_nhan ON thong_bao (nguoi_nhan_user, da_xem);
