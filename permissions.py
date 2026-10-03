# -*- coding: utf-8 -*-
"""
permissions.py - Phân quyền phía máy chủ (bản dịch của object `Perm` trong js/main.js)

QUAN TRỌNG: Đây mới là nơi phân quyền THỰC SỰ có hiệu lực. Object `Perm`
phía trình duyệt (main.js) chỉ dùng để ẩn/hiện nút bấm cho gọn giao diện -
một người dùng có thể mở DevTools và gọi thẳng API, nên mọi route ghi dữ
liệu (POST/PUT/DELETE) đều phải tự kiểm tra lại qua các hàm dưới đây,
không được tin tưởng bất kỳ điều gì phía client gửi lên.

Quy tắc xem dữ liệu (giữ đúng như bản demo):
- Thành viên   : chỉ thấy phiếu do mình tạo hoặc mình thực hiện.
- Cấp quản lý  : thấy phiếu do nhân sự trong phòng mình tạo, hoặc phiếu do
                 phòng mình thực hiện.
- Admin        : thấy toàn bộ phiếu.

Quy tắc luồng xử lý (cập nhật):
- Sửa nội dung phiếu: chỉ người TẠO phiếu, VÀ chỉ khi phiếu còn "Mới tạo"
  và CHƯA phân công người thực hiện - một khi đã có người thực hiện (hoặc
  đã đổi tình trạng), nội dung phiếu bị khoá để giữ đúng những gì các bên
  đã thấy khi bắt đầu xử lý. Đính kèm/xoá tệp hồ sơ của phiếu không bị
  ràng buộc này - người tạo bổ sung hồ sơ được bất kỳ lúc nào.
- Xoá phiếu: chỉ người TẠO phiếu.
- Người thực hiện chức danh "nhanvien": Mới tạo -> Đang xử lý -> Chờ quản lý
  duyệt (không được gửi thẳng cho người tạo phiếu).
- Người thực hiện chức danh "quanly"/"admin" (tự thực hiện): Đang xử lý ->
  Chờ duyệt thẳng (bỏ qua bước quản lý duyệt vì họ chính là quản lý).
- Quản lý phòng thực hiện (hoặc admin): xét bằng chứng ở "Chờ quản lý duyệt",
  đồng ý -> "Quản lý đồng ý" (còn phải tự bấm "Gửi kết quả cho đơn vị yêu
  cầu" - xem can_send_to_requester - mới thật sự sang "Chờ duyệt"), từ chối
  -> "Quản lý từ chối" (KHÔNG kết thúc, trả về người thực hiện làm lại,
  giống "Từ chối"). Quản lý phòng cũng là người được phân công (gán) người
  thực hiện cho phiếu từ phòng khác gửi đến.
- Người tạo phiếu: ở "Chờ duyệt", đồng ý -> Hoàn thành (KẾT THÚC, không ai
  thao tác được nữa), từ chối -> Đang xử lý (trả về xử lý lại, không kết
  thúc).
- Tự chọn người thực hiện khi tạo/sửa phiếu (xem can_pick_assignee): Thành
  viên không bao giờ được; Cấp quản lý chỉ được khi phòng thực hiện là
  phòng của chính họ (khác phòng thì để trống, quản lý phòng đó phân công
  sau); Admin luôn được với mọi phòng.
- Từ chối tiếp nhận (can_reject_intake): quản lý phòng thực hiện (hoặc
  admin) từ chối thẳng khi phiếu còn "Mới tạo" -> "tuchoi_tiepnhan" (KẾT
  THÚC, bắt buộc có lý do).
- Từ chối thực hiện (can_decline_assignment): người thực hiện tự bỏ chọn
  mình (bận việc khác...) trước khi gửi quản lý duyệt, hoặc sau khi bị quản
  lý từ chối kết quả -> tình trạng phiếu GIỮ NGUYÊN, chỉ xoá người thực hiện
  để quản lý phòng phân công lại (bắt buộc có lý do).
- Gửi kết quả cho đơn vị yêu cầu (can_send_to_requester): quản lý phòng
  thực hiện (hoặc admin) tự bấm để chuyển "Quản lý đồng ý" -> "Chờ duyệt" -
  hành động RIÊNG, không nằm trong allowed_status(). Sau khi gửi, quản lý
  không còn thao tác được gì thêm trên phiếu này nữa.
"""
from constants import (
    TINH_TRANG,
    TT_KET_THUC,
    TT_NGUOI_TAO,
    TT_QUANLY_DUYET,
    TT_QUANLY_THUCHIEN,
    TT_THANHVIEN_THUCHIEN,
)


def is_admin(user):
    return bool(user) and user["chucDanh"] == "admin"


def is_quanly(user):
    return bool(user) and user["chucDanh"] == "quanly"


def is_thanh_vien(user):
    return bool(user) and user["chucDanh"] == "nhanvien"


def is_creator(user, ticket):
    return bool(user) and bool(ticket) and ticket["nguoiTaoUser"] == user["username"]


def is_assignee(user, ticket):
    return bool(user) and bool(ticket) and ticket["nguoiThucHienUser"] == user["username"]


def is_dept_reviewer(user, ticket):
    """Quản lý của phòng thực hiện phiếu (hoặc admin, xem mọi phòng như
    quyền hiện có) - người duyệt bằng chứng ở bước "Chờ quản lý duyệt" và
    người được phép phân công/đổi người thực hiện."""
    if not user or not ticket:
        return False
    if is_admin(user):
        return True
    return is_quanly(user) and user["maPhong"] == ticket["phongThucHien"]


def scope_where_clause(user):
    """Trả về (mệnh_đề_sql, tham_số) để nhúng vào WHERE khi truy vấn phieu_yeu_cau,
    giới hạn đúng phạm vi dữ liệu người dùng được phép xem.

    Dùng trực tiếp trong SQL (thay vì lọc sau khi đã SELECT hết) để hiệu quả
    và không bao giờ để lọt dữ liệu ngoài phạm vi ra khỏi máy chủ.
    """
    if is_admin(user):
        return "1=1", ()

    if is_quanly(user):
        return (
            "("
            "  nguoi_tao_user IN (SELECT username FROM nhan_vien WHERE ma_phong = ?)"
            "  OR phong_thuc_hien = ?"
            ")",
            (user["maPhong"], user["maPhong"]),
        )

    return (
        "(nguoi_tao_user = ? OR nguoi_thuc_hien_user = ?)",
        (user["username"], user["username"]),
    )


def can_pick_assignee(user, phong_thuc_hien):
    """Ai được TỰ chọn người thực hiện ngay khi tạo/sửa phiếu (khác với
    can_assign - đó là quản lý phòng PHÂN CÔNG sau, trên phiếu đã tồn tại):
    - Admin: luôn được, với mọi phòng thực hiện.
    - Cấp quản lý: chỉ khi phòng thực hiện là phòng CỦA CHÍNH HỌ - chọn phòng
      khác thì phải để trống, quản lý phòng đó sẽ tự phân công sau.
    - Thành viên: không bao giờ được tự chọn."""
    if is_admin(user):
        return True
    if is_quanly(user):
        return phong_thuc_hien == user["maPhong"]
    return False


def can_view(user, ticket):
    """Dùng khi đã có sẵn 1 ticket (vd sau khi SELECT theo id) để kiểm tra lại
    xem người dùng có được phép xem nó không."""
    if is_admin(user):
        return True
    if is_quanly(user):
        return ticket.get("_nguoiTaoMaPhong") == user["maPhong"] or ticket["phongThucHien"] == user["maPhong"]
    return ticket["nguoiTaoUser"] == user["username"] or ticket["nguoiThucHienUser"] == user["username"]


def can_edit(user, ticket):
    """Chỉ người tạo phiếu mới được sửa nội dung phiếu, và chỉ khi phiếu
    còn "Mới tạo" và CHƯA có người thực hiện - đã phân công hoặc đã đổi
    tình trạng thì khoá nội dung, không cho sửa nữa."""
    return (
        is_creator(user, ticket)
        and ticket["tinhTrang"] == "moi"
        and not ticket["nguoiThucHienUser"]
    )


def can_delete(user, ticket):
    return is_creator(user, ticket)


def can_manage_files(user, ticket):
    """Đính kèm/xoá tệp hồ sơ của phiếu (khác với can_edit) - chỉ người tạo
    phiếu, KHÔNG bị ràng buộc theo tình trạng/người thực hiện như can_edit."""
    return is_creator(user, ticket)


def can_assign(user, ticket):
    """Quản lý phòng thực hiện (hoặc admin) được phân công/đổi người thực
    hiện, miễn phiếu chưa ở trạng thái kết thúc."""
    return is_dept_reviewer(user, ticket) and ticket["tinhTrang"] not in TT_KET_THUC


def can_reject_intake(user, ticket):
    """Quản lý phòng thực hiện (hoặc admin) được TỪ CHỐI TIẾP NHẬN phiếu -
    chỉ khi phiếu còn "Mới tạo" (chưa thật sự bắt đầu xử lý). Đây là hành
    động riêng, KHÔNG nằm trong allowed_status() - dẫn tới trạng thái kết
    thúc "tuchoi_tiepnhan"."""
    return is_dept_reviewer(user, ticket) and ticket["tinhTrang"] == "moi"


def can_decline_assignment(user, ticket):
    """Người thực hiện được TỪ CHỐI THỰC HIỆN (bận việc khác...) - chỉ khi
    chưa gửi kết quả đi đâu (còn Mới tạo/Đang xử lý/Từ chối/Quản lý từ chối -
    tức trước bước Chờ quản lý duyệt, hoặc bị quản lý trả về). Hành động
    riêng, KHÔNG đổi tình trạng phiếu, chỉ bỏ chọn người thực hiện để quản
    lý phòng phân công lại."""
    return is_assignee(user, ticket) and ticket["tinhTrang"] in ("moi", "dangxuly", "tuchoi", "quanly_tuchoi")


def can_send_to_requester(user, ticket):
    """Quản lý phòng thực hiện (hoặc admin) tự bấm "Gửi kết quả cho đơn vị
    yêu cầu" - chỉ khi phiếu đang ở "Quản lý đồng ý" (đã duyệt nhưng chưa
    gửi). Hành động riêng, KHÔNG nằm trong allowed_status()."""
    return is_dept_reviewer(user, ticket) and ticket["tinhTrang"] == "quanly_dong_y"


def allowed_status(user, ticket):
    """Danh sách mã tình trạng người dùng hiện tại được phép chuyển sang,
    giữ đúng thứ tự quy trình. Phiếu đã ở trạng thái KẾT THÚC thì không ai
    còn thao tác được nữa."""
    if ticket["tinhTrang"] in TT_KET_THUC:
        return []

    # Mỗi vai trò chỉ thấy hành động của mình đúng lúc tới lượt - tránh vừa là
    # lỗ hổng (vd người thực hiện vẫn đổi được tình trạng dù phiếu đã ở "Chờ
    # duyệt", ngoài tầm của họ) vừa gây rối giao diện (nút hiện ra không đúng
    # bước). "tuchoi"/"moi"/"dangxuly" đều tính là "chưa tới lượt người tạo".
    # "quanly_dong_y" cũng ngoài tầm người thực hiện - đã qua tay quản lý,
    # chờ chính quản lý tự gửi (can_send_to_requester), không phải họ.
    kq = set()
    if is_assignee(user, ticket) and ticket["tinhTrang"] not in ("choduyet", "quanly_dong_y"):
        if is_thanh_vien(user):
            kq |= set(TT_THANHVIEN_THUCHIEN)
        else:
            kq |= set(TT_QUANLY_THUCHIEN)
    if is_dept_reviewer(user, ticket) and ticket["tinhTrang"] == "choqlyduyet":
        kq |= set(TT_QUANLY_DUYET)
    if is_creator(user, ticket) and ticket["tinhTrang"] == "choduyet":
        kq |= set(TT_NGUOI_TAO)

    thu_tu = [s["id"] for s in TINH_TRANG]
    return [ma for ma in thu_tu if ma in kq]


def can_update_status(user, ticket):
    return len(allowed_status(user, ticket)) > 0


def vai_tro(user, ticket):
    """Vai trò của người dùng đối với phiếu, dùng để ghi vào lịch sử xử lý."""
    if is_creator(user, ticket):
        return "Người tạo phiếu"
    if is_assignee(user, ticket):
        return "Người thực hiện"
    if is_dept_reviewer(user, ticket):
        return "Quản lý phòng thực hiện"
    return None
