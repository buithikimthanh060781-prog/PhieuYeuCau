# -*- coding: utf-8 -*-
"""
repo_phieu.py - Lớp truy cập dữ liệu cho phiếu yêu cầu, lịch sử xử lý và
tệp đính kèm. Toàn bộ câu SQL của ba bảng này nằm ở đây; các route trong
blueprints/phieu_yeu_cau.py chỉ gọi hàm, không tự viết SQL.
"""
import datetime as _dt
import os
import secrets

from flask import current_app
from werkzeug.utils import secure_filename

import serializers as ser
from constants import nhan, TINH_TRANG

UPLOAD_ROOT = "filedinhkem"
GIOI_HAN_KICH_THUOC = 2 * 1024 * 1024  # 2MB / tệp - khớp giới hạn của bản demo trình duyệt


class FileTooLargeError(Exception):
    """Một tệp cụ thể vượt quá GIOI_HAN_KICH_THUOC - các tệp khác trong cùng
    lượt tải lên vẫn được xử lý bình thường, không dừng cả loạt."""

    def __init__(self, ten_tep):
        super().__init__(ten_tep)
        self.ten_tep = ten_tep


def sinh_ma_pyc(db, huong):
    """Tương đương genMaPYC() trong data.js, nhưng truy vấn trực tiếp bảng
    thay vì danh sách trong bộ nhớ - luôn đúng dù nhiều người dùng cùng tạo phiếu."""
    nam = _dt.date.today().year
    tien_to = f"YC{'D' if huong == 'di' else 'N'}-{nam}-"
    rows = db.execute(
        "SELECT ma_pyc FROM phieu_yeu_cau WHERE ma_pyc LIKE ?", (tien_to + "%",)
    ).fetchall()
    max_so = 0
    for r in rows:
        try:
            max_so = max(max_so, int(r["ma_pyc"][len(tien_to):]))
        except ValueError:
            pass
    return f"{tien_to}{max_so + 1:04d}"


def _luu_tep_len_dia(ma_pyc, file_storage):
    """Lưu một tệp tải lên vào filedinhkem/<mã phiếu>/<mã ngẫu nhiên>_<tên gốc>.
    Ném FileTooLargeError nếu tệp vượt 2MB (đã lưu xong mới biết chắc kích
    thước thật, nên nếu quá lớn sẽ xoá lại ngay)."""
    ten_goc = file_storage.filename or "tep-dinh-kem"
    thu_muc_con = secure_filename(ma_pyc) or "khac"
    # Dùng đường dẫn TUYỆT ĐỐI (root_path của app), không phải đường dẫn
    # tương đối - nếu không, khi tiến trình Flask được khởi chạy từ một thư
    # mục làm việc (CWD) khác với thư mục dự án, tệp sẽ bị lưu sai chỗ so
    # với nơi tai_xuong_tep() tìm (luôn cộng với current_app.root_path),
    # khiến tải lên "thành công" nhưng tải xuống/xem lại báo lỗi không tìm thấy.
    thu_muc = os.path.join(current_app.root_path, UPLOAD_ROOT, thu_muc_con)
    os.makedirs(thu_muc, exist_ok=True)

    ten_an_toan = secure_filename(ten_goc) or "tep"
    ten_luu = f"{secrets.token_hex(6)}_{ten_an_toan}"
    duong_dan_tuyet_doi = os.path.join(thu_muc, ten_luu)
    file_storage.save(duong_dan_tuyet_doi)

    kich_thuoc = os.path.getsize(duong_dan_tuyet_doi)
    if kich_thuoc > GIOI_HAN_KICH_THUOC:
        os.remove(duong_dan_tuyet_doi)
        raise FileTooLargeError(ten_goc)

    duong_dan_tuong_doi = os.path.join(thu_muc_con, ten_luu).replace(os.sep, "/")
    return {
        "ten_tep": ten_goc,
        "kich_thuoc": kich_thuoc,
        "loai_mime": file_storage.mimetype or "",
        "duong_dan": duong_dan_tuong_doi,
    }


# =====================================================
# Đọc dữ liệu
# =====================================================

def _lich_su_cho_cac_phieu(db, phieu_ids):
    if not phieu_ids:
        return {}
    cho_giu = ",".join("?" * len(phieu_ids))
    rows = db.execute(
        f"""
        SELECT l.*, u.ho_ten AS ten_nguoi
        FROM lich_su_xu_ly l
        LEFT JOIN nhan_vien u ON l.nguoi_user = u.username
        WHERE l.phieu_id IN ({cho_giu})
        ORDER BY l.id
        """,
        phieu_ids,
    ).fetchall()

    files_theo_lich_su = _files_cho_cac_lich_su(db, [r["id"] for r in rows])

    ket_qua = {}
    for r in rows:
        ket_qua.setdefault(r["phieu_id"], []).append(
            ser.lich_su_to_dict(r, files_theo_lich_su.get(r["id"], []))
        )
    return ket_qua


def _files_cho_cac_phieu(db, phieu_ids):
    if not phieu_ids:
        return {}
    cho_giu = ",".join("?" * len(phieu_ids))
    rows = db.execute(
        f"""
        SELECT t.*, u.ho_ten AS ten_nguoi_tai
        FROM tep_dinh_kem t
        LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username
        WHERE t.phieu_id IN ({cho_giu})
        ORDER BY t.id
        """,
        phieu_ids,
    ).fetchall()
    ket_qua = {}
    for r in rows:
        ket_qua.setdefault(r["phieu_id"], []).append(ser.tep_dinh_kem_to_dict(r))
    return ket_qua


def _files_cho_cac_lich_su(db, lich_su_ids):
    if not lich_su_ids:
        return {}
    cho_giu = ",".join("?" * len(lich_su_ids))
    rows = db.execute(
        f"""
        SELECT t.*, u.ho_ten AS ten_nguoi_tai
        FROM tep_dinh_kem t
        LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username
        WHERE t.lich_su_id IN ({cho_giu})
        ORDER BY t.id
        """,
        lich_su_ids,
    ).fetchall()
    ket_qua = {}
    for r in rows:
        ket_qua.setdefault(r["lich_su_id"], []).append(ser.tep_dinh_kem_to_dict(r))
    return ket_qua


_TICKET_JOIN_SQL = """
    SELECT p.*, u1.ho_ten AS ten_nguoi_tao, u1.ma_phong AS ma_phong_nguoi_tao,
           u2.ho_ten AS ten_nguoi_thuc_hien
    FROM phieu_yeu_cau p
    JOIN nhan_vien u1 ON p.nguoi_tao_user = u1.username
    LEFT JOIN nhan_vien u2 ON p.nguoi_thuc_hien_user = u2.username
"""


def list_tickets(db, where_sql, where_params):
    """Danh sách phiếu (đã JOIN đủ tên hiển thị + lịch sử + tệp), lọc theo
    `where_sql`/`where_params` do permissions.scope_where_clause() sinh ra."""
    rows = db.execute(f"{_TICKET_JOIN_SQL} WHERE {where_sql} ORDER BY p.id", where_params).fetchall()
    ids = [r["id"] for r in rows]
    lich_su = _lich_su_cho_cac_phieu(db, ids)
    files = _files_cho_cac_phieu(db, ids)
    return [ser.phieu_yeu_cau_to_dict(r, lich_su.get(r["id"], []), files.get(r["id"], [])) for r in rows]


def get_ticket_row(db, ticket_id):
    """Dòng thô đã JOIN - dùng làm đầu vào cho row_to_perm_dict() khi cần
    kiểm tra quyền mà chưa cần tải cả lịch sử/tệp đính kèm."""
    return db.execute(f"{_TICKET_JOIN_SQL} WHERE p.id = ?", (ticket_id,)).fetchone()


def get_ticket_dict(db, ticket_id):
    row = get_ticket_row(db, ticket_id)
    if row is None:
        return None
    lich_su = _lich_su_cho_cac_phieu(db, [ticket_id]).get(ticket_id, [])
    files = _files_cho_cac_phieu(db, [ticket_id]).get(ticket_id, [])
    return ser.phieu_yeu_cau_to_dict(row, lich_su, files)


def row_to_perm_dict(row):
    """Rút gọn 1 dòng phieu_yeu_cau (đã JOIN) thành dict tối thiểu mà
    permissions.py cần (đúng tên trường camelCase như phía main.js).
    `_nguoiTaoMaPhong` là trường phụ (không có ở bản demo JS) để
    permissions.can_view() xét đúng trường hợp cấp quản lý mà không phải
    tự JOIN lại."""
    return {
        "nguoiTaoUser": row["nguoi_tao_user"],
        "nguoiThucHienUser": row["nguoi_thuc_hien_user"] or "",
        "phongThucHien": row["phong_thuc_hien"],
        "tinhTrang": row["tinh_trang"],
        "_nguoiTaoMaPhong": row["ma_phong_nguoi_tao"],
    }


# =====================================================
# Ghi dữ liệu
# =====================================================

def create_ticket(db, user, data):
    ma_pyc = sinh_ma_pyc(db, data["huong"])
    hom_nay = _dt.date.today().isoformat()

    cur = db.execute(
        """
        INSERT INTO phieu_yeu_cau
            (ma_pyc, huong, loai_pyc, don_vi_yeu_cau, ngay_yeu_cau, thoi_han,
             noi_dung, phong_thuc_hien, nguoi_thuc_hien_user, tinh_trang,
             uu_tien, nguoi_tao_user, ngay_tao, ngay_cap_nhat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'moi', ?, ?, ?, ?)
        """,
        (
            ma_pyc, data["huong"], data["loaiPYC"], data["donViYeuCau"],
            data["ngayYeuCau"], data["thoiHan"], data["noiDung"],
            data["phongThucHien"], data.get("nguoiThucHienUser") or None,
            data.get("uuTien") or "binhthuong", user["username"], hom_nay, hom_nay,
        ),
    )
    phieu_id = cur.lastrowid

    db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) "
        "VALUES (?, 'moi', ?, ?, 'Người tạo phiếu', ?)",
        (phieu_id, _dt.datetime.now().isoformat(timespec="seconds"), user["username"], "Khởi tạo phiếu yêu cầu"),
    )

    ticket_dict = get_ticket_dict(db, phieu_id)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} mới được tạo, chờ tiếp nhận")
    db.commit()
    return ticket_dict


def update_ticket(db, ticket_id, data):
    hom_nay = _dt.date.today().isoformat()
    db.execute(
        """
        UPDATE phieu_yeu_cau SET
            loai_pyc = ?, don_vi_yeu_cau = ?, ngay_yeu_cau = ?, thoi_han = ?,
            noi_dung = ?, phong_thuc_hien = ?, nguoi_thuc_hien_user = ?,
            uu_tien = ?, ngay_cap_nhat = ?
        WHERE id = ?
        """,
        (
            data["loaiPYC"], data["donViYeuCau"], data["ngayYeuCau"], data["thoiHan"],
            data["noiDung"], data["phongThucHien"], data.get("nguoiThucHienUser") or None,
            data.get("uuTien") or "binhthuong", hom_nay, ticket_id,
        ),
    )
    db.commit()
    return get_ticket_dict(db, ticket_id)


def delete_ticket(db, ticket_id):
    db.execute("DELETE FROM phieu_yeu_cau WHERE id = ?", (ticket_id,))
    db.commit()


def _quan_ly_cua_phong(db, ma_phong):
    """Username của (các) quản lý phòng ban - dùng để xác định người nhận
    thông báo / người được coi là "quản lý phòng thực hiện"."""
    rows = db.execute(
        "SELECT username FROM nhan_vien WHERE ma_phong = ? AND chuc_danh = 'quanly'", (ma_phong,)
    ).fetchall()
    return [r["username"] for r in rows]


def _tao_thong_bao(db, ticket_dict, actor_username, noi_dung):
    """Ghi 1 dòng thong_bao cho mỗi người liên quan tới phiếu (người tạo,
    người thực hiện, quản lý phòng thực hiện), trừ người vừa thao tác."""
    nguoi_nhan = set()
    if ticket_dict.get("nguoiTaoUser"):
        nguoi_nhan.add(ticket_dict["nguoiTaoUser"])
    if ticket_dict.get("nguoiThucHienUser"):
        nguoi_nhan.add(ticket_dict["nguoiThucHienUser"])
    nguoi_nhan.update(_quan_ly_cua_phong(db, ticket_dict["phongThucHien"]))
    nguoi_nhan.discard(actor_username)

    thoi_gian = _dt.datetime.now().isoformat(timespec="seconds")
    for username in nguoi_nhan:
        db.execute(
            "INSERT INTO thong_bao (phieu_id, nguoi_nhan_user, noi_dung, tinh_trang, thoi_gian, da_xem) "
            "VALUES (?, ?, ?, ?, ?, 0)",
            (int(ticket_dict["id"]), username, noi_dung, ticket_dict["tinhTrang"], thoi_gian),
        )


def update_status(db, user, ticket_id, ma_pyc, tinh_trang_moi, ghi_chu, vai_tro, files_storage_list):
    """Đổi tình trạng + ghi 1 dòng lịch sử + lưu bằng chứng đính kèm (nếu có).
    Trả về (ticket_dict_moi, danh_sach_ten_tep_qua_lon)."""
    hom_nay = _dt.date.today().isoformat()
    db.execute(
        "UPDATE phieu_yeu_cau SET tinh_trang = ?, ngay_cap_nhat = ? WHERE id = ?",
        (tinh_trang_moi, hom_nay, ticket_id),
    )
    cur = db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (ticket_id, tinh_trang_moi, _dt.datetime.now().isoformat(timespec="seconds"),
         user["username"], vai_tro, ghi_chu or "Cập nhật tình trạng"),
    )
    lich_su_id = cur.lastrowid

    tep_qua_lon = []
    for fs in files_storage_list:
        if not fs or not fs.filename:
            continue
        try:
            tt = _luu_tep_len_dia(ma_pyc, fs)
        except FileTooLargeError as e:
            tep_qua_lon.append(e.ten_tep)
            continue
        db.execute(
            "INSERT INTO tep_dinh_kem (lich_su_id, ten_tep, kich_thuoc, loai_mime, duong_dan, nguoi_tai_user, ngay_tai) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (lich_su_id, tt["ten_tep"], tt["kich_thuoc"], tt["loai_mime"], tt["duong_dan"],
             user["username"], _dt.datetime.now().isoformat(timespec="seconds")),
        )

    ticket_dict = get_ticket_dict(db, ticket_id)
    nhan_tt = nhan(TINH_TRANG, tinh_trang_moi)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} chuyển sang \"{nhan_tt}\"")
    db.commit()
    return ticket_dict, tep_qua_lon


def assign_executor(db, user, ticket_id, ma_pyc, nguoi_thuc_hien_user):
    """Phân công / đổi người thực hiện phiếu - KHÔNG đổi tình trạng, chỉ ghi
    một dòng lịch sử để có vệt theo dõi. Trả về ticket_dict mới."""
    hom_nay = _dt.date.today().isoformat()
    db.execute(
        "UPDATE phieu_yeu_cau SET nguoi_thuc_hien_user = ?, ngay_cap_nhat = ? WHERE id = ?",
        (nguoi_thuc_hien_user, hom_nay, ticket_id),
    )

    ho_ten = db.execute(
        "SELECT ho_ten FROM nhan_vien WHERE username = ?", (nguoi_thuc_hien_user,)
    ).fetchone()["ho_ten"]
    ticket_row = get_ticket_row(db, ticket_id)
    db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu, nhan_su_kien) "
        "VALUES (?, ?, ?, ?, ?, ?, 'Phân công')",
        (ticket_id, ticket_row["tinh_trang"], _dt.datetime.now().isoformat(timespec="seconds"),
         user["username"], "Quản lý phòng thực hiện", f"Phân công người thực hiện: {ho_ten}"),
    )

    ticket_dict = get_ticket_dict(db, ticket_id)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} được phân công cho {ho_ten}")
    db.commit()
    return ticket_dict


def reject_intake(db, user, ticket_id, ma_pyc, ly_do):
    """Quản lý phòng thực hiện (hoặc admin) TỪ CHỐI TIẾP NHẬN phiếu ngay từ
    đầu -> "tuchoi_tiepnhan" (KẾT THÚC). Trả về ticket_dict mới."""
    hom_nay = _dt.date.today().isoformat()
    db.execute(
        "UPDATE phieu_yeu_cau SET tinh_trang = 'tuchoi_tiepnhan', ngay_cap_nhat = ? WHERE id = ?",
        (hom_nay, ticket_id),
    )
    db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) "
        "VALUES (?, 'tuchoi_tiepnhan', ?, ?, ?, ?)",
        (ticket_id, _dt.datetime.now().isoformat(timespec="seconds"),
         user["username"], "Quản lý phòng thực hiện", ly_do),
    )

    ticket_dict = get_ticket_dict(db, ticket_id)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} bị từ chối tiếp nhận: {ly_do}")
    db.commit()
    return ticket_dict


def decline_assignment(db, user, ticket_id, ma_pyc, ly_do):
    """Người thực hiện TỪ CHỐI THỰC HIỆN (bận việc khác...) - tình trạng
    phiếu GIỮ NGUYÊN, chỉ bỏ chọn người thực hiện để quản lý phòng phân công
    lại. Trả về ticket_dict mới."""
    hom_nay = _dt.date.today().isoformat()
    ticket_row = get_ticket_row(db, ticket_id)
    db.execute(
        "UPDATE phieu_yeu_cau SET nguoi_thuc_hien_user = NULL, ngay_cap_nhat = ? WHERE id = ?",
        (hom_nay, ticket_id),
    )
    db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu, nhan_su_kien) "
        "VALUES (?, ?, ?, ?, ?, ?, 'Từ chối thực hiện')",
        (ticket_id, ticket_row["tinh_trang"], _dt.datetime.now().isoformat(timespec="seconds"),
         user["username"], "Người thực hiện", f"Từ chối thực hiện: {ly_do}"),
    )

    ticket_dict = get_ticket_dict(db, ticket_id)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} bị từ chối thực hiện, cần phân công lại")
    db.commit()
    return ticket_dict


def send_to_requester(db, user, ticket_id, ma_pyc):
    """Quản lý phòng thực hiện (hoặc admin) GỬI KẾT QUẢ CHO ĐƠN VỊ YÊU CẦU -
    chuyển "Quản lý đồng ý" -> "Chờ duyệt". Trả về ticket_dict mới."""
    hom_nay = _dt.date.today().isoformat()
    db.execute(
        "UPDATE phieu_yeu_cau SET tinh_trang = 'choduyet', ngay_cap_nhat = ? WHERE id = ?",
        (hom_nay, ticket_id),
    )
    db.execute(
        "INSERT INTO lich_su_xu_ly (phieu_id, tinh_trang, thoi_gian, nguoi_user, vai_tro, ghi_chu) "
        "VALUES (?, 'choduyet', ?, ?, ?, ?)",
        (ticket_id, _dt.datetime.now().isoformat(timespec="seconds"),
         user["username"], "Quản lý phòng thực hiện", "Gửi kết quả cho đơn vị yêu cầu"),
    )

    ticket_dict = get_ticket_dict(db, ticket_id)
    _tao_thong_bao(db, ticket_dict, user["username"], f"Phiếu {ma_pyc} đã gửi kết quả cho đơn vị yêu cầu")
    db.commit()
    return ticket_dict


def add_ticket_files(db, user, ticket_id, ma_pyc, files_storage_list):
    """Thêm tệp hồ sơ gắn thẳng vào phiếu (khác với bằng chứng của update_status).
    Trả về (danh_sach_tep_moi_dang_json, danh_sach_ten_tep_qua_lon)."""
    tep_qua_lon = []
    id_da_them = []
    for fs in files_storage_list:
        if not fs or not fs.filename:
            continue
        try:
            tt = _luu_tep_len_dia(ma_pyc, fs)
        except FileTooLargeError as e:
            tep_qua_lon.append(e.ten_tep)
            continue
        cur = db.execute(
            "INSERT INTO tep_dinh_kem (phieu_id, ten_tep, kich_thuoc, loai_mime, duong_dan, nguoi_tai_user, ngay_tai) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ticket_id, tt["ten_tep"], tt["kich_thuoc"], tt["loai_mime"], tt["duong_dan"],
             user["username"], _dt.datetime.now().isoformat(timespec="seconds")),
        )
        id_da_them.append(cur.lastrowid)
    db.commit()

    if not id_da_them:
        return [], tep_qua_lon

    cho_giu = ",".join("?" * len(id_da_them))
    rows = db.execute(
        f"SELECT t.*, u.ho_ten AS ten_nguoi_tai FROM tep_dinh_kem t "
        f"LEFT JOIN nhan_vien u ON t.nguoi_tai_user = u.username WHERE t.id IN ({cho_giu})",
        id_da_them,
    ).fetchall()
    return [ser.tep_dinh_kem_to_dict(r) for r in rows], tep_qua_lon


def get_file_row(db, file_id):
    return db.execute("SELECT * FROM tep_dinh_kem WHERE id = ?", (file_id,)).fetchone()


def is_lich_su_hien_tai(db, phieu_id, tinh_trang_hien_tai, lich_su_id):
    """True nếu lich_su_id thuộc "bước hiện tại" của phiếu - tức nằm trong
    chuỗi các dòng lịch sử liên tiếp gần nhất cùng mang tinh_trang hiện tại
    (một bước có thể được lưu nhiều lần: cập nhật ghi chú/bằng chứng thêm
    mà chưa thật sự chuyển sang tình trạng khác, hoặc xen giữa là một dòng
    "phân công người thực hiện" cùng tình trạng). Dùng để chỉ cho phép
    xoá/bổ sung bằng chứng của bước đang dở, không đụng các mốc lịch sử cũ
    hơn (giữ nguyên tính bất biến phục vụ audit)."""
    rows = db.execute(
        "SELECT id, tinh_trang FROM lich_su_xu_ly WHERE phieu_id = ? ORDER BY id DESC", (phieu_id,)
    ).fetchall()
    for r in rows:
        if r["tinh_trang"] != tinh_trang_hien_tai:
            break
        if r["id"] == lich_su_id:
            return True
    return False


def delete_file(db, file_id):
    db.execute("DELETE FROM tep_dinh_kem WHERE id = ?", (file_id,))
    db.commit()
