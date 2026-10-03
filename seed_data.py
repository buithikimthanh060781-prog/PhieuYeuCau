# -*- coding: utf-8 -*-
"""
seed_data.py - Dữ liệu mẫu ban đầu cho phieuyeucau.db

Đây là bản dịch 1:1 sang Python của SEED_DEPTS / SEED_LOAI / SEED_USERS /
SEED_TICKETS cùng logic seed() trong js/data.js, để trang trình duyệt
tĩnh và bản Flask có cùng một bộ dữ liệu khi khởi tạo lần đầu.

Khác biệt duy nhất so với bản demo tĩnh: mật khẩu được băm bằng
werkzeug.security (bản demo JS lưu thô "123456" cho tiện thử nghiệm,
đây không phải cách làm nên dùng khi đã có cơ sở dữ liệu thật).
"""
import datetime as _dt

from werkzeug.security import generate_password_hash

# ---------------------------------------------------------------
# 1. Phòng ban  (khớp SEED_DEPTS trong js/data.js)
# ---------------------------------------------------------------
PHONG_BAN = [
    ("P.HCNS", "Phòng Hành chính - Nhân sự", "Nguyễn Thị Minh Thư", "Tầng 3 - Toà nhà chính", "2024-01-05"),
    ("P.CNTT", "Phòng Công nghệ thông tin", "Trần Quốc Bảo", "Tầng 5 - Toà nhà chính", "2024-01-05"),
    ("P.KTTC", "Phòng Kế toán - Tài chính", "Lê Hoàng Nam", "Tầng 4 - Toà nhà chính", "2024-01-06"),
    ("P.KHDN", "Phòng Khách hàng doanh nghiệp", "Phạm Thu Hà", "Tầng 2 - Toà nhà chính", "2024-02-11"),
    ("P.PLTT", "Phòng Pháp lý - Tuân thủ", "Võ Anh Khoa", "Tầng 6 - Toà nhà chính", "2024-03-02"),
]

# ---------------------------------------------------------------
# 2. Loại yêu cầu  (khớp SEED_LOAI)
# ---------------------------------------------------------------
LOAI_YEU_CAU = [
    ("muasam", "Mua sắm tài sản", "Đề nghị mua sắm trang thiết bị, công cụ dụng cụ", "2024-01-05"),
    ("suachua", "Sửa chữa - Bảo trì", "Sửa chữa, bảo trì cơ sở vật chất và thiết bị", "2024-01-05"),
    ("cntt", "Hỗ trợ CNTT", "Hỗ trợ kỹ thuật, cấp quyền, xử lý sự cố hệ thống", "2024-01-05"),
    ("nhansu", "Nhân sự - Đào tạo", "Tuyển dụng, điều động, đào tạo nhân sự", "2024-01-05"),
    ("taichinh", "Tài chính - Kế toán", "Tạm ứng, thanh toán, đối chiếu số liệu", "2024-01-05"),
    ("phaply", "Pháp lý - Hợp đồng", "Rà soát hợp đồng, tư vấn pháp lý, tuân thủ", "2024-01-05"),
    ("khac", "Yêu cầu khác", "Các yêu cầu không thuộc nhóm trên", "2024-01-05"),
]

# ---------------------------------------------------------------
# 3. Nhân viên  (khớp SEED_USERS)
#    Thứ tự cố ý: admin trước, cấp quản lý kế tiếp, thành viên sau cùng
#    - vì nguoi_quan_ly tham chiếu tới người đã được thêm trước đó.
#    (username, mật khẩu thô, họ tên, email, mã phòng, sđt, chức danh, người quản lý, ngày tạo)
# ---------------------------------------------------------------
NHAN_VIEN = [
    ("admin", "123456", "Quản trị hệ thống", "admin@acb.com.vn", "P.CNTT", "0900000000", "admin", None, "2024-01-01"),
    ("thuntm", "123456", "Nguyễn Thị Minh Thư", "thu.ntm@acb.com.vn", "P.HCNS", "0901234567", "quanly", "admin", "2024-01-05"),
    ("baotq", "123456", "Trần Quốc Bảo", "bao.tq@acb.com.vn", "P.CNTT", "0912345678", "quanly", "admin", "2024-01-08"),
    ("namlh", "123456", "Lê Hoàng Nam", "nam.lh@acb.com.vn", "P.KTTC", "0923456789", "quanly", "admin", "2024-01-12"),
    ("hapt", "123456", "Phạm Thu Hà", "ha.pt@acb.com.vn", "P.KHDN", "0934567890", "quanly", "admin", "2024-02-15"),
    ("khoava", "123456", "Võ Anh Khoa", "khoa.va@acb.com.vn", "P.PLTT", "0945678901", "quanly", "admin", "2024-03-04"),
    ("dungnt", "123456", "Ngô Tiến Dũng", "dung.nt@acb.com.vn", "P.CNTT", "0956789012", "nhanvien", "baotq", "2024-04-20"),
    ("lanvt", "123456", "Vũ Thị Lan", "lan.vt@acb.com.vn", "P.HCNS", "0967890123", "nhanvien", "thuntm", "2024-05-06"),
    ("trangnt", "123456", "Nguyễn Thị Trang", "trang.nt@acb.com.vn", "P.CNTT", "0978901234", "nhanvien", "baotq", "2024-06-10"),
    ("hieult", "123456", "Lý Trung Hiếu", "hieu.lt@acb.com.vn", "P.KTTC", "0989012345", "nhanvien", "namlh", "2024-06-18"),
    ("phucnv", "123456", "Nguyễn Văn Phúc", "phuc.nv@acb.com.vn", "P.KHDN", "0990123456", "nhanvien", "hapt", "2024-07-01"),
]

# ---------------------------------------------------------------
# 4. Phiếu yêu cầu  (khớp SEED_TICKETS)
#    ngay/han là số ngày lệch so với hôm nay (âm = quá khứ), giống
#    hàm dayOffset() trong data.js, để dashboard luôn có phiếu quá hạn
#    / sắp tới hạn "sống" mỗi khi khởi tạo lại.
#    (huong, loaiPYC, donViYeuCau, ngay, han, nguoiTao, phongThucHien,
#     nguoiThucHien, tinhTrang, uuTien, noiDung)
# ---------------------------------------------------------------
PHIEU_YEU_CAU = [
    ("di", "muasam", "P.HCNS", -12, 4, "thuntm", "P.CNTT", "dungnt", "dangxuly", "cao",
     "Đề nghị mua sắm 15 bộ máy tính để bàn phục vụ nhân sự mới tuyển dụng quý này, "
     "cấu hình theo tiêu chuẩn khối văn phòng."),
    ("di", "cntt", "P.KHDN", -8, -1, "hapt", "P.CNTT", "trangnt", "dangxuly", "khancap",
     "Yêu cầu cấp quyền truy cập hệ thống báo cáo tín dụng cho 3 chuyên viên quan hệ khách hàng mới."),
    ("di", "suachua", "P.KTTC", -20, -6, "hieult", "P.HCNS", "lanvt", "hoanthanh", "binhthuong",
     "Sửa chữa hệ thống điều hoà khu vực làm việc tầng 4, máy số 2 và số 5 không làm lạnh."),
    ("di", "nhansu", "P.CNTT", -4, 11, "baotq", "P.HCNS", "thuntm", "choduyet", "binhthuong",
     "Đề xuất tổ chức khoá đào tạo an toàn thông tin cho toàn bộ nhân sự khối vận hành trong tháng tới."),
    ("di", "phaply", "P.KHDN", -2, 8, "phucnv", "P.PLTT", "khoava", "moi", "cao",
     "Đề nghị rà soát và góp ý dự thảo hợp đồng hợp tác với đối tác thanh toán trước khi trình ký."),
    ("den", "cntt", "Chi nhánh Tân Bình", -6, 2, "baotq", "P.CNTT", "dungnt", "dangxuly", "khancap",
     "Chi nhánh đề nghị hỗ trợ khắc phục lỗi máy in sổ tiết kiệm tại quầy giao dịch số 3."),
    ("den", "taichinh", "Chi nhánh Quận 1", -15, -3, "namlh", "P.KTTC", "hieult", "hoanthanh", "cao",
     "Đề nghị đối chiếu và xác nhận số dư tài khoản trung gian phục vụ quyết toán quý."),
    ("den", "nhansu", "Chi nhánh Bình Thạnh", -9, 6, "thuntm", "P.HCNS", "lanvt", "choduyet", "binhthuong",
     "Đề nghị bổ sung 02 giao dịch viên cho chi nhánh trong giai đoạn cao điểm cuối năm."),
    ("den", "muasam", "Phòng Giao dịch Phú Nhuận", -3, 12, "lanvt", "P.HCNS", "thuntm", "moi", "thap",
     "Đề nghị trang bị bổ sung 04 bộ bàn ghế quầy giao dịch và 02 máy đếm tiền thế hệ mới."),
    ("den", "phaply", "Chi nhánh Gò Vấp", -25, -10, "khoava", "P.PLTT", "khoava", "tuchoi", "cao",
     "Đề nghị hướng dẫn xử lý hồ sơ tài sản bảo đảm có tranh chấp quyền sử dụng đất."),
    ("den", "suachua", "Chi nhánh Thủ Đức", -1, 9, "lanvt", "P.HCNS", "lanvt", "moi", "binhthuong",
     "Đề nghị bảo trì định kỳ hệ thống camera giám sát và máy phát điện dự phòng của chi nhánh."),
    ("di", "taichinh", "P.HCNS", -30, -18, "thuntm", "P.KTTC", "namlh", "hoanthanh", "binhthuong",
     "Đề nghị tạm ứng kinh phí tổ chức hội nghị tổng kết hoạt động và khen thưởng cuối năm."),
    ("di", "cntt", "P.CNTT", -5, 7, "dungnt", "P.CNTT", "trangnt", "dangxuly", "binhthuong",
     "Đề nghị nâng cấp dung lượng lưu trữ máy chủ ứng dụng nội bộ phục vụ triển khai hệ thống mới."),
    ("den", "cntt", "Chi nhánh Tân Phú", -7, 3, "trangnt", "P.CNTT", "dungnt", "choduyet", "cao",
     "Chi nhánh đề nghị cài đặt và cấu hình lại đường truyền dự phòng sau sự cố mất kết nối."),
    ("di", "muasam", "P.CNTT", -2, 14, "dungnt", "P.HCNS", "lanvt", "moi", "thap",
     "Đề nghị cấp bổ sung văn phòng phẩm và mực in cho bộ phận kỹ thuật trong quý."),
]


def _ngay_lech(so_ngay):
    """Tương đương dayOffset() trong data.js: hôm nay + so_ngay, dạng yyyy-mm-dd."""
    d = _dt.date.today() + _dt.timedelta(days=so_ngay)
    return d.isoformat()


def _sinh_ma_pyc(huong, da_dung):
    """Tương đương genMaPYC() trong data.js: YCD-<năm>-0001, YCN-<năm>-0001..."""
    nam = _dt.date.today().year
    tien_to = f"YC{'D' if huong == 'di' else 'N'}-{nam}-"
    max_so = 0
    for ma in da_dung:
        if ma.startswith(tien_to):
            try:
                so = int(ma[len(tien_to):])
                max_so = max(max_so, so)
            except ValueError:
                pass
    return f"{tien_to}{max_so + 1:04d}"


def seed_database(db):
    """Nạp toàn bộ dữ liệu mẫu vào kết nối sqlite3 `db` đã có bảng theo schema.sql.

    Trả về dict đếm số dòng đã thêm ở từng bảng, để hàm gọi (CLI init-db)
    in ra xác nhận.
    """
    # 1. Phòng ban
    db.executemany(
        "INSERT INTO phong_ban (ma_phong, ten_phong, truong_phong, ghi_chu, ngay_tao) "
        "VALUES (?, ?, ?, ?, ?)",
        PHONG_BAN,
    )

    # 2. Loại yêu cầu
    db.executemany(
        "INSERT INTO loai_yeu_cau (ma_loai, ten, mo_ta, ngay_tao) VALUES (?, ?, ?, ?)",
        LOAI_YEU_CAU,
    )

    # 3. Nhân viên (băm mật khẩu trước khi lưu)
    hang_nhan_vien = [
        (username, generate_password_hash(mat_khau_tho), ho_ten, email, ma_phong,
         sdt, chuc_danh, nguoi_quan_ly, ngay_tao)
        for (username, mat_khau_tho, ho_ten, email, ma_phong, sdt,
             chuc_danh, nguoi_quan_ly, ngay_tao) in NHAN_VIEN
    ]
    db.executemany(
        "INSERT INTO nhan_vien "
        "(username, password_hash, ho_ten, email, ma_phong, so_dien_thoai, "
        " chuc_danh, nguoi_quan_ly, ngay_tao) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        hang_nhan_vien,
    )

    # 4. Phiếu yêu cầu + lịch sử xử lý ban đầu
    ma_da_dung = {"di": [], "den": []}
    so_lich_su = 0

    for (huong, loai, don_vi, ngay, han, nguoi_tao, phong_th,
         nguoi_th, tinh_trang, uu_tien, noi_dung) in PHIEU_YEU_CAU:

        ma_pyc = _sinh_ma_pyc(huong, ma_da_dung[huong])
        ma_da_dung[huong].append(ma_pyc)

        ngay_yc = _ngay_lech(ngay)
        thoi_han = _ngay_lech(han)

        cur = db.execute(
            "INSERT INTO phieu_yeu_cau "
            "(ma_pyc, huong, loai_pyc, don_vi_yeu_cau, ngay_yeu_cau, thoi_han, "
            " noi_dung, phong_thuc_hien, nguoi_thuc_hien_user, tinh_trang, "
            " uu_tien, nguoi_tao_user, ngay_tao, ngay_cap_nhat) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ma_pyc, huong, loai, don_vi, ngay_yc, thoi_han, noi_dung,
             phong_th, nguoi_th, tinh_trang, uu_tien, nguoi_tao, ngay_yc, ngay_yc),
        )
        phieu_id = cur.lastrowid

        # Mốc "Mới tạo" - luôn có, giống seed() trong data.js
        db.execute(
            "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, ghi_chu) "
            "VALUES (?, 'moi', ?, ?, ?)",
            (phieu_id, f"{ngay_yc}T08:30:00", nguoi_tao, "Khởi tạo phiếu yêu cầu"),
        )
        so_lich_su += 1

        # Nếu tình trạng hiện tại khác "moi" thì có thêm một mốc cập nhật,
        # đúng như logic seed() của data.js
        if tinh_trang != "moi":
            db.execute(
                "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, ghi_chu) "
                "VALUES (?, ?, ?, ?, ?)",
                (phieu_id, tinh_trang, f"{ngay_yc}T14:05:00", nguoi_th, "Cập nhật tình trạng xử lý"),
            )
            so_lich_su += 1

    return {
        "phong_ban": len(PHONG_BAN),
        "loai_yeu_cau": len(LOAI_YEU_CAU),
        "nhan_vien": len(NHAN_VIEN),
        "phieu_yeu_cau": len(PHIEU_YEU_CAU),
        "lich_su_xu_ly": so_lich_su,
    }
