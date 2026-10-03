/* =========================================================
   data.js - Lớp dữ liệu: gọi API Flask (/api/...), giữ bản sao trong bộ
   nhớ (cache) để mọi hàm ĐỌC (DB.tickets(), DB.users(), DB.depts()...)
   vẫn trả về NGAY LẬP TỨC (đồng bộ) như bản demo localStorage cũ - nhờ
   vậy main.js không cần viết lại phần hiển thị/tương tác.

   Chỉ các hàm GHI (tạo/sửa/xoá) là bất đồng bộ (trả về Promise), vì chúng
   thực sự phải gọi máy chủ. Gọi DB.ready() một lần khi tải trang để nạp
   toàn bộ dữ liệu cần thiết trước khi vẽ giao diện.
   ========================================================= */
(function (window) {
    "use strict";

    /* ---------- Danh mục cố định (không qua API - xem constants.py) ---------- */
    var HUONG = [
        { id: "di", ten: "Phiếu yêu cầu đi", ngan: "PYC đi", ico: "📤" },
        { id: "den", ten: "Phiếu yêu cầu đến", ngan: "PYC đến", ico: "📥" }
    ];

    var TINH_TRANG = [
        { id: "moi", ten: "Mới tạo", mau: "#0A74C4" },
        { id: "dangxuly", ten: "Đang xử lý", mau: "#E08A00" },
        { id: "choqlyduyet", ten: "Chờ quản lý duyệt", mau: "#0E7C86" },
        { id: "quanly_dong_y", ten: "Quản lý đồng ý", mau: "#2E8B57" },
        { id: "quanly_tuchoi", ten: "Quản lý từ chối", mau: "#C1440E" },
        { id: "choduyet", ten: "Chờ duyệt", mau: "#7C4DBE" },
        { id: "hoanthanh", ten: "Hoàn thành", mau: "#18A058" },
        { id: "tuchoi", ten: "Từ chối", mau: "#D63A3A" },
        { id: "tuchoi_tiepnhan", ten: "Từ chối tiếp nhận", mau: "#8A1F1F" }
    ];

    var UU_TIEN = [
        { id: "thap", ten: "Thấp" },
        { id: "binhthuong", ten: "Bình thường" },
        { id: "cao", ten: "Cao" },
        { id: "khancap", ten: "Khẩn cấp" }
    ];

    var CHUC_DANH = [
        { id: "nhanvien", ten: "Thành viên" },
        { id: "quanly", ten: "Cấp quản lý" },
        { id: "admin", ten: "Quản trị hệ thống" }
    ];

    /* Trạng thái KẾT THÚC - không ai còn thao tác được nữa */
    var TT_KET_THUC = ["hoanthanh", "tuchoi_tiepnhan"];

    /* Người thực hiện chức danh "nhanvien": phải qua quản lý duyệt trước khi
       tới người tạo phiếu, không được gửi thẳng. */
    var TT_THANHVIEN_THUCHIEN = ["dangxuly", "choqlyduyet"];

    /* Người thực hiện chức danh "quanly"/"admin" (tự thực hiện): bỏ qua
       bước quản lý duyệt vì chính họ là quản lý. */
    var TT_QUANLY_THUCHIEN = ["dangxuly", "choduyet"];

    /* Quản lý phòng thực hiện (hoặc admin) xét bằng chứng ở "choqlyduyet":
       đồng ý -> "quanly_dong_y" (còn phải tự bấm "Gửi kết quả cho đơn vị yêu
       cầu" mới sang "choduyet"), từ chối -> "quanly_tuchoi" (không kết thúc). */
    var TT_QUANLY_DUYET = ["quanly_dong_y", "quanly_tuchoi"];

    /* Người tạo phiếu ở bước "choduyet" - "tuchoi" KHÔNG kết thúc, phiếu
       quay lại "dangxuly" để người thực hiện làm lại. */
    var TT_NGUOI_TAO = ["hoanthanh", "tuchoi"];

    /* ---------- Cache trong bộ nhớ, nạp một lần qua /api/bootstrap ---------- */
    var _cache = { user: null, depts: [], loai: [], users: [], tickets: [] };

    function _timTheo(list, khoa, gt) {
        for (var i = 0; i < list.length; i++) {
            if (list[i][khoa] === gt) return list[i];
        }
        return null;
    }

    function _thaySuaHoacThem(list, item) {
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].id === item.id) { list[i] = item; return list; }
        }
        list.push(item);
        return list;
    }

    function _xoaKhoi(list, id) {
        return list.filter(function (x) { return x.id !== id; });
    }

    /* ---------- Lớp gọi mạng dùng chung ---------- */
    function _xuLyPhanHoi(res) {
        if (res.status === 401) {
            /* Phiên đăng nhập hết hạn (hoặc chưa đăng nhập) -> quay lại trang đăng nhập */
            window.location.href = "index.html";
            return Promise.reject(new Error("Phiên đăng nhập đã hết hạn."));
        }
        return res.text().then(function (text) {
            var data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) { /* bỏ qua thân rỗng */ }
            if (!res.ok) {
                var loi = new Error(data.error || ("Lỗi máy chủ (" + res.status + ")"));
                loi.status = res.status;
                loi.payload = data;
                throw loi;
            }
            return data;
        });
    }

    function _goi(url, options) {
        options = options || {};
        options.credentials = "same-origin";
        return fetch(url, options).then(_xuLyPhanHoi);
    }

    function _goiJSON(url, method, body) {
        return _goi(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {})
        });
    }

    function _goiForm(url, formData) {
        /* KHÔNG tự đặt Content-Type - trình duyệt tự thêm boundary đúng cho multipart */
        return _goi(url, { method: "POST", body: formData });
    }

    /* ---------- Nạp dữ liệu ban đầu ---------- */
    function ready() {
        return _goi("/api/bootstrap").then(function (data) {
            _cache.user = data.user;
            _cache.depts = data.phongBan;
            _cache.loai = data.loaiYeuCau;
            _cache.users = data.nhanVien;
            _cache.tickets = data.phieuYeuCau;
            return data.user;
        });
    }

    /* ---------- Sinh mã phiếu ---------- */
    function genMaPYC(huong) {
        /* Chỉ để HIỂN THỊ tạm trên form trước khi lưu - máy chủ mới là nơi
           sinh mã CHÍNH THỨC lúc tạo phiếu (POST /api/phieu-yeu-cau), tránh
           trùng mã khi có nhiều người cùng thao tác. */
        var nam = new Date().getFullYear();
        var prefix = "YC" + (huong === "di" ? "D" : "N") + "-" + nam + "-";
        var max = 0;
        _cache.tickets.forEach(function (t) {
            if (t.maPYC && t.maPYC.indexOf(prefix) === 0) {
                var n = parseInt(t.maPYC.slice(prefix.length), 10);
                if (!isNaN(n) && n > max) max = n;
            }
        });
        return prefix + String(max + 1).padStart(4, "0");
    }

    /* ---------- API dữ liệu ---------- */
    var DB = {
        HUONG: HUONG,
        TINH_TRANG: TINH_TRANG,
        UU_TIEN: UU_TIEN,
        CHUC_DANH: CHUC_DANH,
        TT_KET_THUC: TT_KET_THUC,
        TT_THANHVIEN_THUCHIEN: TT_THANHVIEN_THUCHIEN,
        TT_QUANLY_THUCHIEN: TT_QUANLY_THUCHIEN,
        TT_QUANLY_DUYET: TT_QUANLY_DUYET,
        TT_NGUOI_TAO: TT_NGUOI_TAO,

        ready: ready,
        uid: function (prefix) {
            return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        },
        genMaPYC: genMaPYC,

        /* ===== Đọc (đồng bộ, từ cache đã nạp qua ready()) ===== */

        depts: function () { return _cache.depts; },
        deptName: function (ma) {
            var d = _timTheo(_cache.depts, "maPhong", ma);
            return d ? d.tenPhong : (ma || "--");
        },

        loaiList: function () { return _cache.loai; },

        users: function () { return _cache.users; },
        userByName: function (username) {
            var can = String(username || "").toLowerCase();
            for (var i = 0; i < _cache.users.length; i++) {
                if (_cache.users[i].username.toLowerCase() === can) return _cache.users[i];
            }
            return null;
        },
        usersOfDept: function (maPhong) {
            return _cache.users.filter(function (u) { return u.maPhong === maPhong; });
        },
        managers: function () {
            return _cache.users.filter(function (u) { return u.chucDanh === "quanly" || u.chucDanh === "admin"; });
        },
        hoTen: function (username) {
            var u = DB.userByName(username);
            return u ? u.hoTen : (username || "--");
        },

        tickets: function () { return _cache.tickets; },
        ticketById: function (id) { return _timTheo(_cache.tickets, "id", id); },

        label: function (group, id) {
            var src = group === "LOAI_PYC" ? _cache.loai : (DB[group] || []);
            var found = _timTheo(src, "id", id);
            return found ? found.ten : (id || "--");
        },

        /* Giữ lại để tương thích - không còn thao tác localStorage, phiên làm
           việc nay do cookie session của Flask quản lý. */
        session: function () { return _cache.user ? { username: _cache.user.username } : null; },
        currentUser: function () { return _cache.user; },
        clearSession: function () { _cache.user = null; },

        /* ===== Xác thực (bất đồng bộ) ===== */

        login: function (username, password) {
            return _goiJSON("/api/auth/login", "POST", { username: username, password: password })
                .then(function (data) { _cache.user = data.user; return data.user; });
        },
        logout: function () {
            return _goiJSON("/api/auth/logout", "POST", {}).then(function (data) {
                _cache.user = null;
                return data;
            });
        },
        changePassword: function (oldPassword, newPassword) {
            return _goiJSON("/api/auth/change-password", "POST", {
                oldPassword: oldPassword, newPassword: newPassword
            });
        },
        forgotVerify: function (username, email) {
            return _goiJSON("/api/auth/forgot-password/verify", "POST", { username: username, email: email });
        },
        forgotReset: function (username, email, newPassword) {
            return _goiJSON("/api/auth/forgot-password/reset", "POST", {
                username: username, email: email, newPassword: newPassword
            });
        },

        /* ===== Phòng ban (ghi - bất đồng bộ) ===== */

        createDept: function (data) {
            return _goiJSON("/api/phong-ban", "POST", data).then(function (d) {
                _cache.depts = _thaySuaHoacThem(_cache.depts, d);
                return d;
            });
        },
        updateDept: function (maCu, data) {
            return _goiJSON("/api/phong-ban/" + encodeURIComponent(maCu), "PUT", data).then(function (d) {
                _cache.depts = _xoaKhoi(_cache.depts, maCu);
                _cache.depts = _thaySuaHoacThem(_cache.depts, d);
                /* Đổi mã phòng: máy chủ đã tự đồng bộ (ON UPDATE CASCADE) sang
                   nhân viên và phiếu yêu cầu - tải lại 2 danh mục đó cho khớp. */
                return DB.ready().then(function () { return d; });
            });
        },
        deleteDept: function (ma) {
            return _goi("/api/phong-ban/" + encodeURIComponent(ma), { method: "DELETE" }).then(function (r) {
                _cache.depts = _xoaKhoi(_cache.depts, ma);
                return r;
            });
        },

        /* ===== Loại yêu cầu (ghi) ===== */

        createLoai: function (data) {
            return _goiJSON("/api/loai-yeu-cau", "POST", data).then(function (d) {
                _cache.loai = _thaySuaHoacThem(_cache.loai, d);
                return d;
            });
        },
        updateLoai: function (maCu, data) {
            return _goiJSON("/api/loai-yeu-cau/" + encodeURIComponent(maCu), "PUT", data).then(function (d) {
                _cache.loai = _xoaKhoi(_cache.loai, maCu);
                _cache.loai = _thaySuaHoacThem(_cache.loai, d);
                return DB.ready().then(function () { return d; });
            });
        },
        deleteLoai: function (ma) {
            return _goi("/api/loai-yeu-cau/" + encodeURIComponent(ma), { method: "DELETE" }).then(function (r) {
                _cache.loai = _xoaKhoi(_cache.loai, ma);
                return r;
            });
        },

        /* ===== Nhân viên (ghi) ===== */

        createUser: function (data) {
            return _goiJSON("/api/nhan-vien", "POST", data).then(function (d) {
                _cache.users = _thaySuaHoacThem(_cache.users, d);
                return d;
            });
        },
        updateUser: function (username, data) {
            return _goiJSON("/api/nhan-vien/" + encodeURIComponent(username), "PUT", data).then(function (d) {
                _cache.users = _thaySuaHoacThem(_cache.users, d);
                return d;
            });
        },
        deleteUser: function (username) {
            return _goi("/api/nhan-vien/" + encodeURIComponent(username), { method: "DELETE" }).then(function (r) {
                _cache.users = _xoaKhoi(_cache.users, username);
                return r;
            });
        },

        /* ===== Phiếu yêu cầu (ghi) ===== */

        createTicket: function (data) {
            return _goiJSON("/api/phieu-yeu-cau", "POST", data).then(function (t) {
                _cache.tickets.push(t);
                return t;
            });
        },
        updateTicket: function (id, data) {
            return _goiJSON("/api/phieu-yeu-cau/" + encodeURIComponent(id), "PUT", data).then(function (t) {
                _cache.tickets = _thaySuaHoacThem(_cache.tickets, t);
                return t;
            });
        },
        deleteTicket: function (id) {
            return _goi("/api/phieu-yeu-cau/" + encodeURIComponent(id), { method: "DELETE" }).then(function (r) {
                _cache.tickets = _xoaKhoi(_cache.tickets, id);
                return r;
            });
        },
        updateTicketStatus: function (id, tinhTrang, ghiChu, fileList) {
            var fd = new FormData();
            fd.append("tinhTrang", tinhTrang);
            fd.append("ghiChu", ghiChu || "");
            (fileList || []).forEach(function (f) { fd.append("files", f); });

            return _goiForm("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/tinh-trang", fd)
                .then(function (data) {
                    _cache.tickets = _thaySuaHoacThem(_cache.tickets, data.ticket);
                    return data;
                });
        },
        addTicketFiles: function (id, fileList) {
            var fd = new FormData();
            (fileList || []).forEach(function (f) { fd.append("files", f); });

            return _goiForm("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/tep-dinh-kem", fd)
                .then(function (data) {
                    var t = DB.ticketById(id);
                    if (t) t.files = (t.files || []).concat(data.files);
                    return data;
                });
        },
        removeTicketFile: function (ticketId, fileId) {
            return _goi("/api/tep-dinh-kem/" + encodeURIComponent(fileId), { method: "DELETE" }).then(function (r) {
                var t = DB.ticketById(ticketId);
                if (t) t.files = (t.files || []).filter(function (f) { return f.id !== fileId; });
                /* Tệp bị xoá có thể là bằng chứng (nằm trong lichSu[].files),
                   dọn luôn ở đó để giao diện đang mở không hiện tệp đã xoá. */
                if (t && t.lichSu) {
                    t.lichSu.forEach(function (h) {
                        h.files = (h.files || []).filter(function (f) { return f.id !== fileId; });
                    });
                }
                return r;
            });
        },

        /* ===== Phân công người thực hiện (quản lý phòng thực hiện) ===== */

        assignExecutor: function (id, nguoiThucHienUser) {
            return _goiJSON("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/nguoi-thuc-hien", "PUT", {
                nguoiThucHienUser: nguoiThucHienUser
            }).then(function (t) {
                _cache.tickets = _thaySuaHoacThem(_cache.tickets, t);
                return t;
            });
        },

        /* Quản lý phòng thực hiện từ chối tiếp nhận phiếu ngay từ đầu ->
           "tuchoi_tiepnhan" (kết thúc). Bắt buộc có lý do. */
        rejectIntake: function (id, lyDo) {
            return _goiJSON("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/tu-choi-tiep-nhan", "POST", {
                lyDo: lyDo
            }).then(function (t) {
                _cache.tickets = _thaySuaHoacThem(_cache.tickets, t);
                return t;
            });
        },

        /* Người thực hiện tự từ chối thực hiện (bận việc khác...) - tình
           trạng phiếu giữ nguyên, chỉ bỏ chọn người thực hiện. Bắt buộc có
           lý do. */
        declineAssignment: function (id, lyDo) {
            return _goiJSON("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/tu-choi-thuc-hien", "POST", {
                lyDo: lyDo
            }).then(function (t) {
                _cache.tickets = _thaySuaHoacThem(_cache.tickets, t);
                return t;
            });
        },

        /* Quản lý phòng thực hiện gửi kết quả cho đơn vị yêu cầu - chuyển
           "Quản lý đồng ý" -> "Chờ duyệt". */
        sendToRequester: function (id) {
            return _goiJSON("/api/phieu-yeu-cau/" + encodeURIComponent(id) + "/gui-ket-qua", "POST", {})
                .then(function (t) {
                    _cache.tickets = _thaySuaHoacThem(_cache.tickets, t);
                    return t;
                });
        },

        /* ===== Thông báo (chuông) ===== */

        thongBaoChuaXem: function () {
            return _goi("/api/thong-bao?chuaXem=1");
        },
        danhDauDaXem: function (id) {
            return _goi("/api/thong-bao/" + encodeURIComponent(id) + "/da-xem", { method: "POST" });
        },
        danhDauTatCaDaXem: function () {
            return _goi("/api/thong-bao/danh-dau-tat-ca", { method: "POST" });
        },

        resetAll: function () { window.location.reload(); }
    };

    window.DB = DB;
})(window);
