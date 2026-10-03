# -*- coding: utf-8 -*-
"""
serializers.py - Chuyển dữ liệu từ dòng SQLite sang JSON đúng hình dạng mà
js/data.js và js/main.js đang mong đợi (tên trường camelCase, id = mã tự nhiên).

Tách riêng khỏi các route để mọi nơi cần trả cùng một loại dữ liệu
(bootstrap, danh_muc, nhan_vien, phieu_yeu_cau) đều dùng chung một hàm,
tránh mỗi nơi tự map một kiểu rồi lệch nhau.
"""


def phong_ban_to_dict(row):
    """`id` = mã phòng, vì đây là khoá mà toàn bộ giao diện (form chọn phòng,
    liên kết nhan_vien.maPhong...) đã dùng làm khoá nhận diện."""
    return {
        "id": row["ma_phong"],
        "maPhong": row["ma_phong"],
        "tenPhong": row["ten_phong"],
        "truongPhong": row["truong_phong"] or "",
        "ghiChu": row["ghi_chu"] or "",
        "ngayTao": row["ngay_tao"],
    }


def loai_yeu_cau_to_dict(row):
    return {
        "id": row["ma_loai"],
        "ten": row["ten"],
        "moTa": row["mo_ta"] or "",
        "ngayTao": row["ngay_tao"],
    }


def nhan_vien_to_dict(row):
    """KHÔNG bao giờ đưa password/password_hash vào JSON trả về trình duyệt."""
    return {
        "id": row["username"],
        "username": row["username"],
        "hoTen": row["ho_ten"],
        "email": row["email"],
        "maPhong": row["ma_phong"],
        "soDienThoai": row["so_dien_thoai"] or "",
        "chucDanh": row["chuc_danh"],
        "nguoiQuanLy": row["nguoi_quan_ly"] or "",
        "ngayTao": row["ngay_tao"],
    }


def tep_dinh_kem_to_dict(row):
    """`row` cần có thêm cột `ten_nguoi_tai` (JOIN sang nhan_vien.ho_ten)."""
    return {
        "id": str(row["id"]),
        "ten": row["ten_tep"],
        "kichThuoc": row["kich_thuoc"],
        "loai": row["loai_mime"] or "",
        "url": f"/api/tep-dinh-kem/{row['id']}/tai-xuong",
        "nguoiTai": row["ten_nguoi_tai"] or "",
        "ngayTai": row["ngay_tai"],
    }


def thong_bao_to_dict(row):
    """`row` cần có thêm cột `ma_pyc` (JOIN sang phieu_yeu_cau.ma_pyc)."""
    return {
        "id": str(row["id"]),
        "phieuId": str(row["phieu_id"]),
        "maPYC": row["ma_pyc"],
        "noiDung": row["noi_dung"],
        "tinhTrang": row["tinh_trang"],
        "thoiGian": row["thoi_gian"],
        "daXem": bool(row["da_xem"]),
    }


def lich_su_to_dict(row, files):
    """`row` cần có thêm cột `ten_nguoi` (JOIN sang nhan_vien.ho_ten của nguoi_user)."""
    return {
        "tinhTrang": row["tinh_trang"],
        "thoiGian": row["thoi_gian"],
        "nguoi": row["ten_nguoi"] or "",
        "nguoiUser": row["nguoi_user"] or "",
        "vaiTro": row["vai_tro"] or "",
        "ghiChu": row["ghi_chu"] or "",
        "nhanSuKien": row["nhan_su_kien"] or "",
        "files": files,
    }


def phieu_yeu_cau_to_dict(row, lich_su, files):
    """`row` cần có thêm 2 cột JOIN: `ten_nguoi_tao`, `ten_nguoi_thuc_hien`."""
    return {
        "id": str(row["id"]),
        "huong": row["huong"],
        "maPYC": row["ma_pyc"],
        "loaiPYC": row["loai_pyc"],
        "donViYeuCau": row["don_vi_yeu_cau"],
        "ngayYeuCau": row["ngay_yeu_cau"],
        "thoiHan": row["thoi_han"],
        "noiDung": row["noi_dung"],
        "phongThucHien": row["phong_thuc_hien"],
        "nguoiThucHienUser": row["nguoi_thuc_hien_user"] or "",
        "nguoiThucHien": row["ten_nguoi_thuc_hien"] or "",
        "tinhTrang": row["tinh_trang"],
        "uuTien": row["uu_tien"],
        "nguoiTaoUser": row["nguoi_tao_user"],
        "nguoiTao": row["ten_nguoi_tao"] or "",
        "ngayTao": row["ngay_tao"],
        "ngayCapNhat": row["ngay_cap_nhat"],
        "files": files,
        "lichSu": lich_su,
    }
