/* =========================================================
   main.js - Hiệu ứng giao diện & xử lý nghiệp vụ
   Ứng dụng "Quản lý phiếu yêu cầu"
   ========================================================= */
(function (window, document) {
    "use strict";

    /* =====================================================
       1. TIỆN ÍCH CHUNG
       ===================================================== */
    var U = {
        $: function (sel, ctx) { return (ctx || document).querySelector(sel); },
        $$: function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); },

        esc: function (s) {
            return String(s === undefined || s === null ? "" : s)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        },

        /* yyyy-mm-dd -> dd/mm/yyyy */
        fmtDate: function (iso) {
            if (!iso) return "--";
            var d = new Date(iso);
            if (isNaN(d)) return iso;
            var p = function (n) { return String(n).padStart(2, "0"); };
            return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
        },

        fmtDateTime: function (iso) {
            if (!iso) return "--";
            var d = new Date(iso);
            if (isNaN(d)) return iso;
            var p = function (n) { return String(n).padStart(2, "0"); };
            return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
                " " + p(d.getHours()) + ":" + p(d.getMinutes());
        },

        today: function () { return new Date().toISOString().slice(0, 10); },
        nowISO: function () { return new Date().toISOString(); },

        /* Số ngày còn lại tới hạn (âm = đã quá hạn) */
        daysLeft: function (iso) {
            if (!iso) return null;
            var a = new Date(U.today()), b = new Date(iso);
            if (isNaN(b)) return null;
            return Math.round((b - a) / 86400000);
        },

        fileSize: function (bytes) {
            if (!bytes && bytes !== 0) return "--";
            if (bytes < 1024) return bytes + " B";
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
            return (bytes / 1048576).toFixed(2) + " MB";
        },

        initials: function (name) {
            var parts = String(name || "?").trim().split(/\s+/);
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
        },

        /* Bỏ dấu tiếng Việt để tìm kiếm linh hoạt (U+0300..U+036F là các dấu tổ hợp) */
        DAU_TO_HOP: new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"),
        noAccent: function (s) {
            return String(s || "").normalize("NFD").replace(U.DAU_TO_HOP, "")
                .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
        },

        param: function (name) {
            return new URLSearchParams(window.location.search).get(name);
        },

        debounce: function (fn, wait) {
            var t;
            return function () {
                var ctx = this, args = arguments;
                clearTimeout(t);
                t = setTimeout(function () { fn.apply(ctx, args); }, wait || 250);
            };
        },

        cut: function (s, n) {
            s = String(s || "");
            return s.length > n ? s.slice(0, n) + "..." : s;
        },

        emailOK: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim()); },
        phoneOK: function (v) { return /^0\d{9,10}$/.test(String(v || "").trim()); }
    };

    /* =====================================================
       2. THÔNG BÁO (TOAST) & HỘP THOẠI
       ===================================================== */
    var UI = {
        toast: function (msg, type, title) {
            var wrap = U.$(".toast-wrap");
            if (!wrap) {
                wrap = document.createElement("div");
                wrap.className = "toast-wrap";
                document.body.appendChild(wrap);
            }
            var icons = { success: "✔", error: "✖", warn: "⚠", info: "ℹ" };
            var titles = { success: "Thành công", error: "Lỗi", warn: "Chú ý", info: "Thông báo" };
            type = type || "info";

            var t = document.createElement("div");
            t.className = "toast " + type;
            t.innerHTML = '<span class="t-ico">' + icons[type] + '</span>' +
                '<div><div class="t-title">' + U.esc(title || titles[type]) + '</div>' +
                '<div class="t-msg">' + U.esc(msg) + '</div></div>';
            wrap.appendChild(t);

            setTimeout(function () {
                t.classList.add("hide");
                setTimeout(function () { t.remove(); }, 260);
            }, 3200);
        },

        /* Modal dùng chung. opts: {title, body, footer, size, onMount} */
        modal: function (opts) {
            var root = U.$("#modal-root");
            if (!root) {
                root = document.createElement("div");
                root.id = "modal-root";
                root.className = "backdrop";
                document.body.appendChild(root);
            }
            root.innerHTML = '<div class="modal ' + (opts.size === "lg" ? "modal-lg" : "") + '">' +
                '<div class="modal-head"><h3>' + U.esc(opts.title || "") + '</h3>' +
                '<button type="button" class="close" data-close aria-label="Đóng">&times;</button></div>' +
                '<div class="modal-body">' + (opts.body || "") + '</div>' +
                (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
                '</div>';
            root.classList.add("open");
            document.body.style.overflow = "hidden";

            U.$$("[data-close]", root).forEach(function (b) {
                b.addEventListener("click", UI.closeModal);
            });
            root.onclick = function (e) { if (e.target === root) UI.closeModal(); };
            document.addEventListener("keydown", escClose);

            if (typeof opts.onMount === "function") opts.onMount(root);
            var first = U.$(".modal-body input:not([type=hidden]):not([type=file]), .modal-body select, .modal-body textarea", root);
            if (first) setTimeout(function () { first.focus(); }, 60);
            return root;
        },

        closeModal: function () {
            var root = U.$("#modal-root");
            if (!root) return;
            root.classList.remove("open");
            root.innerHTML = "";
            document.body.style.overflow = "";
            document.removeEventListener("keydown", escClose);
        },

        confirm: function (opts, onYes) {
            UI.modal({
                title: opts.title || "Xác nhận",
                body: '<p style="font-size:14px;line-height:1.6">' + (opts.html || U.esc(opts.message || "")) + '</p>',
                footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                    '<button type="button" class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" id="cfmYes">' +
                    U.esc(opts.okText || "Đồng ý") + '</button>',
                onMount: function (root) {
                    U.$("#cfmYes", root).addEventListener("click", function () {
                        UI.closeModal();
                        onYes();
                    });
                }
            });
        },

        setError: function (input, msg) {
            var g = input.closest(".form-group");
            if (!g) return;
            g.classList.add("has-error");
            var e = U.$(".field-error", g);
            if (e) e.textContent = msg;
        },

        clearErrors: function (form) {
            U.$$(".form-group.has-error", form).forEach(function (g) { g.classList.remove("has-error"); });
        },

        loading: function (btn, on, text) {
            if (on) {
                btn.dataset.label = btn.innerHTML;
                btn.innerHTML = '<span class="spinner"></span> ' + (text || "Đang xử lý...");
                btn.disabled = true;
            } else {
                if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
                btn.disabled = false;
            }
        }
    };

    function escClose(e) { if (e.key === "Escape") UI.closeModal(); }

    /* =====================================================
       3. XÁC THỰC
       ===================================================== */
    var Auth = {
        /* Sau khi DB.ready() nạp xong, người dùng hiện tại đã nằm sẵn trong
           cache - hàm này vẫn đồng bộ như cũ nên không nơi nào gọi nó cần đổi. */
        current: function () {
            return DB.currentUser();
        },

        guard: function () {
            var u = Auth.current();
            if (!u) {
                window.location.replace("index.html");
                return null;
            }
            return u;
        },

        /* Đăng nhập nay thực sự xảy ra ở máy chủ (mật khẩu đã băm, JS không
           còn so sánh trực tiếp được) - trả về Promise thay vì giá trị ngay. */
        login: function (username, password) {
            return DB.login(username, password);
        },

        logout: function () {
            DB.logout().then(function () {
                window.location.href = "index.html";
            }).catch(function () {
                window.location.href = "index.html";
            });
        }
    };

    /* =====================================================
       4. PHÂN QUYỀN
       -----------------------------------------------------
       Phạm vi dữ liệu:
       - Thành viên : phiếu do mình tạo hoặc mình thực hiện
       - Cấp quản lý: phiếu do nhân sự trong phòng tạo
                      hoặc phiếu do phòng mình thực hiện
       - Admin      : toàn bộ phiếu trong hệ thống
       Quyền thao tác:
       - Người tạo phiếu   : sửa, xoá, chuyển Hoàn thành / Từ chối
       - Người thực hiện   : chuyển Mới tạo / Đang xử lý / Chờ duyệt
                             kèm bằng chứng, không được sửa phiếu
       - Còn lại (kể cả cấp quản lý, admin): chỉ xem
       ===================================================== */
    var Perm = {
        isAdmin: function (u) { return !!u && u.chucDanh === "admin"; },
        isQuanLy: function (u) { return !!u && u.chucDanh === "quanly"; },
        isThanhVien: function (u) { return !!u && u.chucDanh === "nhanvien"; },

        /* Lọc danh sách phiếu theo phạm vi được phép xem */
        scope: function (user, list) {
            list = list || DB.tickets();
            if (Perm.isAdmin(user)) return list;

            if (Perm.isQuanLy(user)) {
                var thanhVien = DB.usersOfDept(user.maPhong).map(function (u) { return u.username; });
                return list.filter(function (t) {
                    return thanhVien.indexOf(t.nguoiTaoUser) >= 0 || t.phongThucHien === user.maPhong;
                });
            }

            return list.filter(function (t) {
                return t.nguoiTaoUser === user.username || t.nguoiThucHienUser === user.username;
            });
        },

        canView: function (user, t) { return Perm.scope(user, [t]).length > 0; },

        isCreator: function (user, t) { return !!user && !!t && t.nguoiTaoUser === user.username; },
        isAssignee: function (user, t) { return !!user && !!t && t.nguoiThucHienUser === user.username; },

        /* Quản lý phòng thực hiện (hoặc admin, xem như mọi phòng) - người
           duyệt bằng chứng ở "Chờ quản lý duyệt" và người phân công. */
        isDeptReviewer: function (user, t) {
            if (!user || !t) return false;
            if (Perm.isAdmin(user)) return true;
            return Perm.isQuanLy(user) && user.maPhong === t.phongThucHien;
        },

        /* Chỉ người tạo phiếu mới được sửa nội dung, và chỉ khi phiếu còn
           "Mới tạo" và CHƯA phân công người thực hiện. */
        canEdit: function (user, t) {
            return Perm.isCreator(user, t) && t.tinhTrang === "moi" && !t.nguoiThucHienUser;
        },
        canDelete: function (user, t) { return Perm.isCreator(user, t); },

        /* Đính kèm/xoá tệp hồ sơ của phiếu - chỉ người tạo phiếu, KHÔNG bị
           ràng buộc theo tình trạng/người thực hiện như canEdit. */
        canManageFiles: function (user, t) { return Perm.isCreator(user, t); },

        /* Ai được TỰ chọn người thực hiện ngay khi tạo/sửa phiếu:
           - Admin: luôn được, mọi phòng.
           - Cấp quản lý: chỉ khi phòng thực hiện là phòng CỦA CHÍNH HỌ.
           - Thành viên: không bao giờ. */
        canPickAssignee: function (user, phongThucHien) {
            if (Perm.isAdmin(user)) return true;
            if (Perm.isQuanLy(user)) return phongThucHien === user.maPhong;
            return false;
        },

        /* Quản lý phòng thực hiện được phân công/đổi người thực hiện, trừ
           khi phiếu đã ở trạng thái kết thúc. */
        canAssign: function (user, t) {
            return Perm.isDeptReviewer(user, t) && DB.TT_KET_THUC.indexOf(t.tinhTrang) < 0;
        },

        /* Quản lý phòng thực hiện (hoặc admin) từ chối tiếp nhận phiếu ngay
           từ đầu - chỉ khi phiếu còn "Mới tạo". */
        canRejectIntake: function (user, t) {
            return Perm.isDeptReviewer(user, t) && t.tinhTrang === "moi";
        },

        /* Người thực hiện tự từ chối thực hiện (bận việc khác...) - chỉ khi
           chưa gửi kết quả đi đâu (Mới tạo/Đang xử lý/Từ chối/Quản lý từ chối). */
        canDeclineAssignment: function (user, t) {
            return Perm.isAssignee(user, t) &&
                ["moi", "dangxuly", "tuchoi", "quanly_tuchoi"].indexOf(t.tinhTrang) >= 0;
        },

        /* Quản lý phòng thực hiện (hoặc admin) tự bấm "Gửi kết quả cho đơn vị
           yêu cầu" - chỉ khi phiếu đang ở "Quản lý đồng ý". */
        canSendToRequester: function (user, t) {
            return Perm.isDeptReviewer(user, t) && t.tinhTrang === "quanly_dong_y";
        },

        /* Các tình trạng người dùng hiện tại được phép chuyển sang. Phiếu đã
           ở trạng thái KẾT THÚC thì không ai còn thao tác được nữa. */
        allowedStatus: function (user, t) {
            if (DB.TT_KET_THUC.indexOf(t.tinhTrang) >= 0) return [];

            /* Mỗi vai trò chỉ thấy hành động của mình đúng lúc tới lượt (khớp
               permissions.py) - tránh nút/tuỳ chọn hiện ra không đúng bước.
               "quanly_dong_y" ngoài tầm người thực hiện - đã qua tay quản lý,
               chờ chính quản lý tự gửi (canSendToRequester), không phải họ. */
            var kq = [];
            function them(list) {
                list.forEach(function (s) { if (kq.indexOf(s) < 0) kq.push(s); });
            }
            if (Perm.isAssignee(user, t) && ["choduyet", "quanly_dong_y"].indexOf(t.tinhTrang) < 0) {
                them(Perm.isThanhVien(user) ? DB.TT_THANHVIEN_THUCHIEN : DB.TT_QUANLY_THUCHIEN);
            }
            if (Perm.isDeptReviewer(user, t) && t.tinhTrang === "choqlyduyet") them(DB.TT_QUANLY_DUYET);
            if (Perm.isCreator(user, t) && t.tinhTrang === "choduyet") them(DB.TT_NGUOI_TAO);

            /* Giữ đúng thứ tự quy trình */
            return DB.TINH_TRANG.map(function (s) { return s.id; })
                .filter(function (id) { return kq.indexOf(id) >= 0; });
        },

        canUpdateStatus: function (user, t) { return Perm.allowedStatus(user, t).length > 0; },

        /* Vai trò của người dùng với phiếu, dùng để hiển thị nhãn */
        vaiTro: function (user, t) {
            if (Perm.isCreator(user, t) && Perm.isAssignee(user, t)) return "Người tạo &amp; người thực hiện";
            if (Perm.isCreator(user, t)) return "Người tạo phiếu";
            if (Perm.isAssignee(user, t)) return "Người thực hiện";
            if (Perm.isDeptReviewer(user, t)) return "Quản lý phòng thực hiện";
            return "Chỉ xem";
        }
    };

    /* =====================================================
       5. KHUNG GIAO DIỆN (sidebar + topbar)
       ===================================================== */
    var NAV = [
        { key: "dashboard", href: "dashboard.html", ico: "▦", ten: "Trang chính", nhom: "Nghiệp vụ" },
        { key: "pyc-di", href: "dashboard.html?tab=di", ico: "📤", ten: "Phiếu yêu cầu đi" },
        { key: "pyc-den", href: "dashboard.html?tab=den", ico: "📥", ten: "Phiếu yêu cầu đến" },
        { key: "phong", href: "phong.html", ico: "🏢", ten: "Phòng ban", nhom: "Cấu hình", adminOnly: true },
        { key: "loai-yeu-cau", href: "loai-yeu-cau.html", ico: "🏷", ten: "Loại yêu cầu", adminOnly: true },
        { key: "nhan-vien", href: "nhan-vien.html", ico: "👥", ten: "Nhân viên", adminOnly: true }
    ];

    var Layout = {
        mount: function (activeKey, title) {
            var user = Auth.guard();
            if (!user) return null;

            var tickets = Perm.scope(user, DB.tickets());
            var counts = {
                "pyc-di": tickets.filter(function (t) { return t.huong === "di"; }).length,
                "pyc-den": tickets.filter(function (t) { return t.huong === "den"; }).length,
                "phong": DB.depts().length,
                "loai-yeu-cau": DB.loaiList().length,
                "nhan-vien": DB.users().length
            };

            /* --- Sidebar --- */
            var side = U.$("#sidebar");
            if (side) {
                /* Tên ứng dụng đã nằm trên header nên menu chỉ còn danh sách điều hướng */
                var html = '<nav class="side-nav">';

                NAV.forEach(function (item) {
                    if (item.adminOnly && !Perm.isAdmin(user)) return;
                    if (item.nhom) html += '<div class="nav-label">' + item.nhom + '</div>';
                    html += '<a href="' + item.href + '" class="' + (item.key === activeKey ? "active" : "") + '">' +
                        '<span class="nav-ico">' + item.ico + '</span><span>' + item.ten + '</span>' +
                        (counts[item.key] !== undefined ? '<span class="count">' + counts[item.key] + '</span>' : '') +
                        '</a>';
                });

                html += '</nav><div class="sidebar-foot">Phiên bản 1.1 &middot; Demo Front-end</div>';
                side.innerHTML = html;
            }

            /* --- Topbar --- */
            var top = U.$("#topbar");
            if (top) {
                document.title = (title ? title + " | " : "") + "Quản lý phiếu yêu cầu";

                top.innerHTML = '<button type="button" class="menu-toggle" id="btnMenu" aria-label="Ẩn menu">&#9776;</button>' +
                    /* Định danh: logo + tên ứng dụng, bấm vào về trang chính */
                    '<a class="app-brand" href="dashboard.html" title="Về trang chính">' +
                    '<span class="brand-mark">PYC</span>' +
                    '<span class="app-name">Quản lý phiếu yêu cầu</span></a>' +
                    /* Tên trang đang xem, để biết vị trí kể cả khi menu đang ẩn */
                    (title ? '<span class="tb-sep"></span><span class="tb-page">' + U.esc(title) + '</span>' : '') +
                    '<div class="spacer"></div>' +
                    '<div class="tb-search"><span class="ico">&#128269;</span>' +
                    '<input type="search" id="tbSearch" autocomplete="off" ' +
                    'placeholder="Tìm nhanh phiếu yêu cầu..."></div>' +
                    '<div class="spacer"></div>' +
                    Layout.bellHTML() +
                    '<div class="user-box">' +
                    '<button type="button" class="user-trigger" id="userBtn">' +
                    '<span class="avatar">' + U.esc(U.initials(user.hoTen)) + '</span>' +
                    '<span class="user-meta"><span class="nm">' + U.esc(user.hoTen) + '</span>' +
                    '<span class="rl">' + U.esc(DB.label("CHUC_DANH", user.chucDanh)) + ' &middot; ' + U.esc(user.maPhong) + '</span></span>' +
                    '<span class="muted">&#9662;</span></button>' +
                    '<div class="dropdown" id="userMenu">' +
                    '<div class="dd-head"><div class="nm">' + U.esc(user.hoTen) + '</div>' +
                    '<div class="em">' + U.esc(user.email) + '</div></div>' +
                    '<button type="button" id="miProfile">👤 Thông tin cá nhân</button>' +
                    '<button type="button" id="miPass">🔑 Đổi mật khẩu</button>' +
                    '<div class="divider"></div>' +
                    '<button type="button" class="logout" id="miLogout">⏻ Đăng xuất</button>' +
                    '</div></div>';

                /* Menu người dùng */
                var btn = U.$("#userBtn"), menu = U.$("#userMenu");
                btn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    menu.classList.toggle("open");
                });
                /* Chuông thông báo */
                var bell = U.$("#btnBell"), bellMenu = U.$("#bellMenu");
                if (bell) {
                    bell.addEventListener("click", function (e) {
                        e.stopPropagation();
                        menu.classList.remove("open");
                        bellMenu.classList.toggle("open");
                    });
                }

                document.addEventListener("click", function () {
                    menu.classList.remove("open");
                    if (bellMenu) bellMenu.classList.remove("open");
                });

                /* Tìm nhanh: trang nào đăng ký xử lý riêng thì lọc tại chỗ,
                   còn lại chuyển về trang chính kèm từ khoá */
                var oTimNhanh = U.$("#tbSearch");
                if (oTimNhanh) {
                    oTimNhanh.addEventListener("keydown", function (e) {
                        if (e.key !== "Enter") return;
                        var kw = oTimNhanh.value.trim();
                        if (typeof Layout.onQuickSearch === "function") Layout.onQuickSearch(kw);
                        else window.location.href = "dashboard.html?q=" + encodeURIComponent(kw);
                    });
                }

                U.$("#miProfile").addEventListener("click", function () { Layout.profileModal(user); });
                U.$("#miPass").addEventListener("click", function () { Layout.changePassModal(user); });
                U.$("#miLogout").addEventListener("click", function () {
                    UI.confirm({
                        title: "Đăng xuất",
                        message: "Bạn có chắc muốn kết thúc phiên làm việc?",
                        okText: "Đăng xuất"
                    }, Auth.logout);
                });

                Layout.bindMenuToggle(side);
                Layout.taiChuong();
            }

            return user;
        },

        /* Ẩn / hiện menu:
           - Màn hình lớn : thu gọn hẳn menu, trang chính mở rộng toàn màn hình (nhớ trạng thái)
           - Màn hình nhỏ : menu trượt ra đè lên nội dung kèm lớp nền mờ            */
        bindMenuToggle: function (side) {
            var back = U.$("#navBackdrop");
            var btn = U.$("#btnMenu");
            if (!side || !btn) return;

            var manHinhNho = function () { return window.matchMedia("(max-width: 860px)").matches; };

            /* Khôi phục trạng thái đã lưu */
            if (localStorage.getItem("pyc_menu") === "an") {
                document.body.classList.add("sidebar-collapsed");
            }
            capNhatNhan();

            btn.addEventListener("click", function () {
                if (manHinhNho()) {
                    side.classList.toggle("open");
                    if (back) back.classList.toggle("open");
                } else {
                    var an = document.body.classList.toggle("sidebar-collapsed");
                    localStorage.setItem("pyc_menu", an ? "an" : "hien");
                }
                capNhatNhan();
            });

            if (back) back.addEventListener("click", function () {
                side.classList.remove("open");
                back.classList.remove("open");
            });

            /* Đổi màn hình: đóng menu trượt để không kẹt ở trạng thái cũ */
            window.addEventListener("resize", U.debounce(function () {
                if (!manHinhNho()) {
                    side.classList.remove("open");
                    if (back) back.classList.remove("open");
                }
                capNhatNhan();
            }, 200));

            /* Biểu tượng luôn là ba gạch ngang, chỉ đổi phần chú thích */
            function capNhatNhan() {
                var dangAn = !manHinhNho() && document.body.classList.contains("sidebar-collapsed");
                btn.title = dangAn ? "Hiện menu" : "Ẩn menu";
                btn.setAttribute("aria-label", btn.title);
                btn.innerHTML = "☰";
            }
        },

        /* Chuông thông báo: khung tĩnh vẽ ngay, nội dung thật (thông báo
           CHƯA XEM) nạp bất đồng bộ qua taiChuong() ngay sau khi gắn trang -
           không chặn phần còn lại của giao diện. */
        bellHTML: function () {
            return '<div class="tb-bell-box">' +
                '<button type="button" class="tb-bell" id="btnBell" title="Thông báo" aria-label="Thông báo">' +
                '🔔<span class="bell-badge" id="bellBadge" hidden></span>' +
                '</button>' +
                '<div class="dropdown bell-menu" id="bellMenu">' +
                '<div class="dd-head"><div class="nm">Thông báo</div>' +
                '<div class="em" id="bellSub">Đang tải...</div></div>' +
                '<div id="bellList"><div class="bell-empty">Đang tải...</div></div>' +
                '</div></div>';
        },

        taiChuong: function () {
            DB.thongBaoChuaXem().then(function (ds) {
                var badge = U.$("#bellBadge"), sub = U.$("#bellSub"), list = U.$("#bellList");
                if (!badge || !sub || !list) return; /* đã rời trang trước khi tải xong */

                badge.hidden = !ds.length;
                if (ds.length) badge.textContent = ds.length > 99 ? "99+" : String(ds.length);
                sub.textContent = ds.length ? ds.length + " thông báo chưa xem" : "Không có thông báo mới";

                list.innerHTML = !ds.length
                    ? '<div class="bell-empty">🎉 Không có thông báo mới.</div>'
                    : (ds.length > 1 ? '<button type="button" id="btnDocTatCa">Đánh dấu tất cả đã đọc</button>' : "") +
                        ds.slice(0, 20).map(function (n) {
                            return '<a class="bell-item" href="chi-tiet.html?id=' + n.phieuId + '" data-tb-id="' + n.id + '">' +
                                '<span class="bi-top"><span class="bi-code">' + U.esc(n.maPYC) + '</span>' +
                                '<span class="muted" style="font-size:11px">' + U.fmtDateTime(n.thoiGian) + '</span></span>' +
                                '<span class="bi-txt">' + U.esc(n.noiDung) + '</span></a>';
                        }).join("");

                U.$$(".bell-item", list).forEach(function (a) {
                    a.addEventListener("click", function () { DB.danhDauDaXem(a.dataset.tbId); });
                });
                var btnDoc = U.$("#btnDocTatCa");
                if (btnDoc) btnDoc.addEventListener("click", function (e) {
                    e.preventDefault();
                    DB.danhDauTatCaDaXem().then(Layout.taiChuong);
                });
            }).catch(function () { /* chuông không phải chức năng thiết yếu - im lặng nếu lỗi */ });
        },

        profileModal: function (user) {
            UI.modal({
                title: "Thông tin cá nhân",
                body: '<ul class="info-list">' +
                    row("Họ và tên", user.hoTen) +
                    row("Tên đăng nhập", user.username) +
                    row("Email", user.email) +
                    row("Số điện thoại", user.soDienThoai) +
                    row("Phòng ban", user.maPhong + " - " + DB.deptName(user.maPhong)) +
                    row("Chức danh", DB.label("CHUC_DANH", user.chucDanh)) +
                    row("Người quản lý", user.nguoiQuanLy ? DB.hoTen(user.nguoiQuanLy) : "--") +
                    row("Ngày tạo", U.fmtDate(user.ngayTao)) +
                    '</ul>',
                footer: '<button type="button" class="btn btn-outline" data-close>Đóng</button>'
            });
            function row(k, v) {
                return '<li><span class="k">' + U.esc(k) + '</span><span class="v">' + U.esc(v) + '</span></li>';
            }
        },

        changePassModal: function (user) {
            UI.modal({
                title: "Đổi mật khẩu",
                body: '<form id="frmPass" novalidate>' +
                    field("oldPass", "Mật khẩu hiện tại", "password") +
                    field("newPass", "Mật khẩu mới", "password", "Tối thiểu 6 ký tự") +
                    field("rePass", "Nhập lại mật khẩu mới", "password") +
                    '</form>',
                footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                    '<button type="button" class="btn btn-primary" id="btnSavePass">Cập nhật</button>',
                onMount: function (root) {
                    U.$("#btnSavePass", root).addEventListener("click", function () {
                        var form = U.$("#frmPass", root);
                        UI.clearErrors(form);
                        var o = form.oldPass, n = form.newPass, r = form.rePass, ok = true;

                        if (!o.value) { UI.setError(o, "Vui lòng nhập mật khẩu hiện tại."); ok = false; }
                        if (n.value.length < 6) { UI.setError(n, "Mật khẩu mới tối thiểu 6 ký tự."); ok = false; }
                        if (n.value !== r.value) { UI.setError(r, "Nhập lại mật khẩu chưa khớp."); ok = false; }
                        if (!ok) return;

                        var btn = this;
                        UI.loading(btn, true, "Đang lưu...");
                        DB.changePassword(o.value, n.value).then(function () {
                            UI.closeModal();
                            UI.toast("Đã đổi mật khẩu thành công.", "success");
                        }).catch(function (err) {
                            UI.loading(btn, false);
                            UI.setError(o, err.message || "Mật khẩu hiện tại không đúng.");
                        });
                    });
                }
            });

            function field(name, label, type, hint) {
                return '<div class="form-group"><label>' + label + ' <span class="req">*</span></label>' +
                    '<input type="' + type + '" name="' + name + '" class="form-control" autocomplete="off">' +
                    (hint ? '<div class="muted" style="font-size:12px;margin-top:4px">' + hint + '</div>' : '') +
                    '<div class="field-error"></div></div>';
            }
        }
    };

    /* =====================================================
       6. THÀNH PHẦN HIỂN THỊ DÙNG CHUNG
       ===================================================== */
    function badgeTinhTrang(id) {
        return '<span class="badge badge-' + id + '"><span class="bdot"></span>' +
            U.esc(DB.label("TINH_TRANG", id)) + '</span>';
    }

    function badgeHuong(id) {
        var h = DB.HUONG.filter(function (x) { return x.id === id; })[0];
        return '<span class="badge badge-' + id + '">' + (h ? h.ico + " " + h.ngan : id) + '</span>';
    }

    function badgeHan(t) {
        if (DB.TT_KET_THUC.indexOf(t.tinhTrang) >= 0) {
            return '<span class="muted">' + U.fmtDate(t.thoiHan) + '</span>';
        }
        var d = U.daysLeft(t.thoiHan);
        if (d === null) return "--";
        if (d < 0) return U.fmtDate(t.thoiHan) + ' <span class="badge badge-late">Quá hạn ' + Math.abs(d) + ' ngày</span>';
        if (d <= 3) return U.fmtDate(t.thoiHan) + ' <span class="badge badge-gold">Còn ' + d + ' ngày</span>';
        return U.fmtDate(t.thoiHan);
    }

    function isLate(t) {
        if (DB.TT_KET_THUC.indexOf(t.tinhTrang) >= 0) return false;
        var d = U.daysLeft(t.thoiHan);
        return d !== null && d < 0;
    }

    function optionList(list, selected, valueKey, textKey) {
        return list.map(function (o) {
            var v = o[valueKey], t = o[textKey];
            return '<option value="' + U.esc(v) + '"' + (v === selected ? " selected" : "") + '>' + U.esc(t) + '</option>';
        }).join("");
    }

    function fileIconClass(name) {
        var ext = String(name || "").split(".").pop().toLowerCase();
        if (ext === "pdf") return "pdf";
        if (["doc", "docx"].indexOf(ext) >= 0) return "doc";
        if (["xls", "xlsx", "csv"].indexOf(ext) >= 0) return "xls";
        if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].indexOf(ext) >= 0) return "img";
        return "";
    }

    /* Một dòng tệp: tải xuống, và nút xoá nếu được phép */
    function fileItemHTML(f, coTheXoa, nhan) {
        return '<div class="file-item" data-fid="' + U.esc(f.id) + '">' +
            '<div class="f-ico ' + fileIconClass(f.ten) + '">📄</div>' +
            '<div class="f-body"><div class="f-name">' + U.esc(f.ten) +
            (nhan ? ' <span class="badge badge-soft">' + U.esc(nhan) + '</span>' : '') + '</div>' +
            '<div class="f-meta">' + U.fileSize(f.kichThuoc) + ' &middot; ' + U.esc(f.nguoiTai) +
            ' &middot; ' + U.fmtDateTime(f.ngayTai) + '</div></div>' +
            '<a class="icon-btn" href="' + (f.url || f.duLieu || "#") + '" download="' + U.esc(f.ten) + '" title="Tải xuống">↓</a>' +
            (coTheXoa ? '<button class="icon-btn danger" data-del-file title="Xoá tệp">🗑</button>' : '') +
            '</div>';
    }

    /* Gom toàn bộ bằng chứng đính kèm theo các mốc cập nhật tình trạng */
    function evidenceOf(ticket) {
        var kq = [];
        (ticket.lichSu || []).forEach(function (h) {
            (h.files || []).forEach(function (f) {
                kq.push({ file: f, tinhTrang: h.tinhTrang, thoiGian: h.thoiGian });
            });
        });
        return kq;
    }

    /* Lọc bỏ ngay tại chỗ các tệp rõ ràng quá lớn, để phản hồi tức thời
       (máy chủ vẫn kiểm tra lại kích thước thật khi lưu, đây chỉ giúp
       trải nghiệm nhanh hơn, không thay cho kiểm tra phía máy chủ). */
    function locTepHopLe(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        var hopLe = [];
        files.forEach(function (f) {
            if (f.size > 2 * 1024 * 1024) {
                UI.toast('Tệp "' + f.name + '" vượt quá 2MB.', "warn");
                return;
            }
            hopLe.push(f);
        });
        return hopLe;
    }

    /* Nhãn nút xử lý chính - đổi theo đúng bước hiện tại của người đang
       xem (thay cho tên cố định "Cập nhật tình trạng" trước đây). */
    function nhanNutXuLy(user, t) {
        if (Perm.isAssignee(user, t)) {
            return t.tinhTrang === "dangxuly" ? "📤 Gửi duyệt" : "▶ Bắt đầu xử lý";
        }
        if (Perm.isDeptReviewer(user, t) && t.tinhTrang === "choqlyduyet") return "🔍 Duyệt kết quả";
        if (Perm.isCreator(user, t) && t.tinhTrang === "choduyet") return "✅ Xác nhận kết quả";
        return "↻ Xử lý phiếu";
    }

    /* Hộp thoại nhỏ dùng chung cho các hành động TỪ CHỐI bắt buộc nhập lý
       do (Từ chối tiếp nhận, Từ chối thực hiện). `guiDi` nhận lý do đã trim,
       trả về Promise - modal tự đóng và báo lỗi nếu guiDi bị reject. */
    function hopThoaiTuChoi(tieuDe, nhanNutXacNhan, guiDi) {
        UI.modal({
            title: tieuDe,
            body: '<form id="frmTuChoi"><div class="form-group mb-0">' +
                '<label>Lý do từ chối <span class="req">*</span></label>' +
                '<textarea name="lyDo" class="form-control" rows="3" placeholder="Bắt buộc nhập lý do..."></textarea>' +
                '<div class="field-error"></div></div></form>',
            footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                '<button type="button" class="btn btn-danger" id="btnXacNhanTuChoi">' + nhanNutXacNhan + '</button>',
            onMount: function (root) {
                var btn = U.$("#btnXacNhanTuChoi", root);
                btn.addEventListener("click", function () {
                    var f = U.$("#frmTuChoi", root);
                    var lyDo = f.lyDo.value.trim();
                    UI.clearErrors(f);
                    if (!lyDo) { UI.setError(f.lyDo, "Vui lòng nhập lý do từ chối."); return; }

                    UI.loading(btn, true, "Đang gửi...");
                    guiDi(lyDo).then(function () {
                        UI.closeModal();
                    }).catch(function (err) {
                        UI.loading(btn, false);
                        UI.toast(err.message || "Không thực hiện được thao tác.", "error");
                    });
                });
            }
        });
    }

    /* =====================================================
       7. HỘP THOẠI CẬP NHẬT TÌNH TRẠNG (kèm bằng chứng)
       ===================================================== */
    function statusModal(ticket, user, done) {
        var chophep = Perm.allowedStatus(user, ticket);
        if (!chophep.length) {
            UI.toast("Bạn không có quyền cập nhật tình trạng phiếu này.", "error");
            return;
        }

        /* Màn hình duyệt kết quả của quản lý phòng thực hiện (bước "Chờ quản
           lý duyệt") chỉ cần đúng 2 lựa chọn rõ nghĩa: đồng ý hoặc từ chối -
           đổi nhãn thay vì hiện tên tình trạng thô ("Chờ duyệt"/"Đang xử lý"). */
        var nhanTuyChinh = (Perm.isDeptReviewer(user, ticket) && ticket.tinhTrang === "choqlyduyet")
            ? { quanly_dong_y: "✅ Đồng ý kết quả", quanly_tuchoi: "❌ Từ chối" }
            : {};
        var dsTinhTrang = DB.TINH_TRANG.filter(function (s) { return chophep.indexOf(s.id) >= 0; })
            .map(function (s) { return nhanTuyChinh[s.id] ? { id: s.id, ten: nhanTuyChinh[s.id] } : s; });
        var macDinh = chophep.indexOf(ticket.tinhTrang) >= 0 ? ticket.tinhTrang : dsTinhTrang[0].id;
        var pending = [];   /* các tệp File() bằng chứng đã chọn, chờ tải lên khi lưu */

        /* Bằng chứng ĐÃ LƯU của bước hiện tại (các dòng lịch sử liên tiếp
           gần nhất cùng tình trạng hiện tại) - hiện lại để có thể xoá hoặc
           bổ sung thêm, thay vì luôn bắt đầu từ danh sách rỗng. */
        var daLuu = [];
        var ls = (ticket.lichSu || []).slice().reverse();
        for (var i = 0; i < ls.length; i++) {
            if (ls[i].tinhTrang !== ticket.tinhTrang) break;
            daLuu = daLuu.concat(ls[i].files || []);
        }

        UI.modal({
            title: nhanNutXuLy(user, ticket) + " - " + ticket.maPYC,
            body: '<div class="demo-hint" style="margin-bottom:16px">Vai trò của bạn với phiếu này: <b>' +
                Perm.vaiTro(user, ticket) + '</b>. Tình trạng hiện tại: <b>' +
                U.esc(DB.label("TINH_TRANG", ticket.tinhTrang)) + '</b>.</div>' +
                '<form id="frmSt">' +
                '<div class="form-group"><label>Chuyển sang tình trạng <span class="req">*</span></label>' +
                '<select name="tinhTrang" class="form-control">' +
                optionList(dsTinhTrang, macDinh, "id", "ten") + '</select></div>' +
                '<div class="form-group"><label>Ghi chú xử lý</label>' +
                '<textarea name="ghiChu" class="form-control" placeholder="Mô tả ngắn về bước xử lý..."></textarea></div>' +
                '<div class="form-group mb-0"><label>Bằng chứng đính kèm</label>' +
                '<div class="dropzone" id="dzEv"><div class="dz-ico">📎</div>' +
                '<div><b>Chọn tệp bằng chứng</b> hoặc kéo thả vào đây</div>' +
                '<div class="dz-hint">Ảnh chụp màn hình, biên bản, email xác nhận... &middot; tối đa 2MB mỗi tệp</div>' +
                '<input type="file" id="evInput" multiple hidden></div>' +
                '<div class="file-list" id="evList"></div></div>' +
                '</form>',
            footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                '<button type="button" class="btn btn-primary" id="btnSt">Lưu cập nhật</button>',
            onMount: function (root) {
                var dz = U.$("#dzEv", root), input = U.$("#evInput", root), btnSave = U.$("#btnSt", root);

                dz.addEventListener("click", function () { input.click(); });
                input.addEventListener("change", function () { nhanTep(this.files); this.value = ""; });
                ["dragenter", "dragover"].forEach(function (ev) {
                    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
                });
                ["dragleave", "drop"].forEach(function (ev) {
                    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragover"); });
                });
                dz.addEventListener("drop", function (e) { nhanTep(e.dataTransfer.files); });

                function nhanTep(fileList) {
                    pending = pending.concat(locTepHopLe(fileList));
                    veDanhSach();
                }

                function veDanhSach() {
                    var box = U.$("#evList", root);
                    var htmlDaLuu = daLuu.map(function (f) {
                        return '<div class="file-item" data-fid="' + U.esc(f.id) + '">' +
                            '<div class="f-ico ' + fileIconClass(f.ten) + '">📄</div>' +
                            '<div class="f-body"><div class="f-name">' + U.esc(f.ten) + '</div>' +
                            '<div class="f-meta">' + U.fileSize(f.kichThuoc) + ' &middot; ' + U.esc(f.nguoiTai) + '</div></div>' +
                            '<button class="icon-btn danger" data-del-saved title="Xoá bằng chứng">🗑</button>' +
                            '</div>';
                    }).join("");
                    var htmlPending = pending.map(function (f, i) {
                        return '<div class="file-item" data-idx="' + i + '">' +
                            '<div class="f-ico ' + fileIconClass(f.name) + '">📄</div>' +
                            '<div class="f-body"><div class="f-name">' + U.esc(f.name) + '</div>' +
                            '<div class="f-meta">' + U.fileSize(f.size) + ' &middot; chưa tải lên</div></div>' +
                            '<button class="icon-btn danger" data-del-pending title="Bỏ chọn">🗑</button>' +
                            '</div>';
                    }).join("");
                    box.innerHTML = htmlDaLuu + htmlPending;

                    U.$$("[data-del-saved]", box).forEach(function (b) {
                        b.addEventListener("click", function () {
                            var fid = b.closest(".file-item").dataset.fid;
                            UI.loading(b, true);
                            DB.removeTicketFile(ticket.id, fid).then(function () {
                                daLuu = daLuu.filter(function (f) { return f.id !== fid; });
                                veDanhSach();
                            }).catch(function (err) {
                                UI.toast(err.message || "Không xoá được tệp.", "error");
                                veDanhSach();
                            });
                        });
                    });
                    U.$$("[data-del-pending]", box).forEach(function (b) {
                        b.addEventListener("click", function () {
                            var idx = parseInt(b.closest(".file-item").dataset.idx, 10);
                            pending.splice(idx, 1);
                            veDanhSach();
                        });
                    });
                }
                veDanhSach();

                btnSave.addEventListener("click", function () {
                    var f = U.$("#frmSt", root);
                    var moi = f.tinhTrang.value;
                    var ghiChu = f.ghiChu.value.trim();

                    UI.loading(btnSave, true, "Đang lưu...");
                    DB.updateTicketStatus(ticket.id, moi, ghiChu, pending).then(function (data) {
                        UI.closeModal();
                        (data.tepQuaLon || []).forEach(function (ten) {
                            UI.toast('Tệp "' + ten + '" vượt quá 2MB, đã bỏ qua.', "warn");
                        });
                        UI.toast("Đã chuyển sang \"" + DB.label("TINH_TRANG", moi) + "\"" +
                            (pending.length ? " kèm " + pending.length + " bằng chứng." : "."), "success");
                        if (done) done();
                    }).catch(function (err) {
                        UI.loading(btnSave, false);
                        UI.toast(err.message || "Không cập nhật được tình trạng.", "error");
                    });
                });
            }
        });
    }

    /* =====================================================
       8. TRANG ĐĂNG NHẬP
       ===================================================== */
    function pageLogin() {
        /* Nếu cookie phiên vẫn còn hiệu lực thì vào thẳng trang chính - kiểm
           tra bằng một lượt gọi /api/auth/me nhẹ (KHÔNG dùng /api/bootstrap,
           trang này chưa cần toàn bộ dữ liệu nghiệp vụ). */
        fetch("/api/auth/me", { credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.user) { window.location.replace("dashboard.html"); return; }
                initLoginPage();
            })
            .catch(function () { initLoginPage(); });

        function initLoginPage() {
            var form = U.$("#frmLogin");

            /* Ghi nhớ tên đăng nhập */
            var saved = localStorage.getItem("pyc_remember");
            if (saved) { form.username.value = saved; form.remember.checked = true; }

            /* Hiện/ẩn mật khẩu */
            U.$$(".toggle-pass").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var input = U.$("input", btn.parentNode);
                    var show = input.type === "password";
                    input.type = show ? "text" : "password";
                    btn.innerHTML = show ? "🙈" : "👁";
                });
            });

            form.addEventListener("submit", function (e) {
                e.preventDefault();
                UI.clearErrors(form);

                var un = form.username.value.trim(), pw = form.password.value, ok = true;
                if (!un) { UI.setError(form.username, "Vui lòng nhập tên đăng nhập."); ok = false; }
                if (!pw) { UI.setError(form.password, "Vui lòng nhập mật khẩu."); ok = false; }
                if (!ok) return;

                var btn = U.$("#btnLogin");
                UI.loading(btn, true, "Đang đăng nhập...");

                Auth.login(un, pw).then(function (user) {
                    if (form.remember.checked) localStorage.setItem("pyc_remember", un);
                    else localStorage.removeItem("pyc_remember");

                    UI.toast("Xin chào " + user.hoTen + "!", "success");
                    setTimeout(function () { window.location.href = "dashboard.html"; }, 450);
                }).catch(function (err) {
                    UI.loading(btn, false);
                    UI.setError(form.password, err.message || "Tên đăng nhập hoặc mật khẩu không đúng.");
                    UI.toast("Đăng nhập không thành công.", "error");
                });
            });

            /* Quên mật khẩu */
            U.$("#linkForgot").addEventListener("click", function (e) {
                e.preventDefault();
                UI.modal({
                    title: "Quên mật khẩu",
                    body: '<p class="muted" style="margin-bottom:16px">Nhập tên đăng nhập và email đã đăng ký, ' +
                        'hệ thống sẽ gửi liên kết đặt lại mật khẩu.</p>' +
                        '<form id="frmForgot" novalidate>' +
                        '<div class="form-group"><label>Tên đăng nhập <span class="req">*</span></label>' +
                        '<input type="text" name="username" class="form-control" placeholder="vd: admin"><div class="field-error"></div></div>' +
                        '<div class="form-group"><label>Email đã đăng ký <span class="req">*</span></label>' +
                        '<input type="email" name="email" class="form-control" placeholder="vd: ten@acb.com.vn"><div class="field-error"></div></div>' +
                        '</form>',
                    footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                        '<button type="button" class="btn btn-primary" id="btnForgot">Gửi yêu cầu</button>',
                    onMount: function (root) {
                        U.$("#btnForgot", root).addEventListener("click", function () {
                            var f = U.$("#frmForgot", root);
                            UI.clearErrors(f);
                            var un = f.username.value.trim(), em = f.email.value.trim(), ok = true;

                            if (!un) { UI.setError(f.username, "Vui lòng nhập tên đăng nhập."); ok = false; }
                            if (!U.emailOK(em)) { UI.setError(f.email, "Email không hợp lệ."); ok = false; }
                            if (!ok) return;

                            var btn = this;
                            UI.loading(btn, true, "Đang gửi...");
                            DB.forgotVerify(un, em).then(function (data) {
                                UI.loading(btn, false);
                                UI.closeModal();
                                UI.modal({
                                    title: "Đã gửi yêu cầu",
                                    body: '<p style="line-height:1.7">Liên kết đặt lại mật khẩu đã được gửi tới ' +
                                        '<b>' + U.esc(data.email) + '</b>. Vui lòng kiểm tra hộp thư trong 15 phút.</p>' +
                                        '<div class="demo-hint" style="margin-top:14px">Bản demo không gửi email thật. ' +
                                        'Bạn có thể đặt lại mật khẩu ngay bên dưới.</div>' +
                                        '<form id="frmReset" style="margin-top:16px">' +
                                        '<div class="form-group"><label>Mật khẩu mới <span class="req">*</span></label>' +
                                        '<input type="password" name="newPass" class="form-control"><div class="field-error"></div></div>' +
                                        '</form>',
                                    footer: '<button type="button" class="btn btn-outline" data-close>Để sau</button>' +
                                        '<button type="button" class="btn btn-primary" id="btnReset">Đặt lại mật khẩu</button>',
                                    onMount: function (r2) {
                                        U.$("#btnReset", r2).addEventListener("click", function () {
                                            var f2 = U.$("#frmReset", r2);
                                            UI.clearErrors(f2);
                                            if (f2.newPass.value.length < 6) {
                                                UI.setError(f2.newPass, "Mật khẩu tối thiểu 6 ký tự.");
                                                return;
                                            }
                                            var btn2 = this;
                                            UI.loading(btn2, true, "Đang lưu...");
                                            DB.forgotReset(un, em, f2.newPass.value).then(function () {
                                                UI.closeModal();
                                                UI.toast("Đặt lại mật khẩu thành công, mời bạn đăng nhập.", "success");
                                            }).catch(function (err) {
                                                UI.loading(btn2, false);
                                                UI.setError(f2.newPass, err.message || "Không đặt lại được mật khẩu.");
                                            });
                                        });
                                    }
                                });
                            }).catch(function (err) {
                                UI.loading(btn, false);
                                UI.setError(f.email, err.message || "Thông tin không khớp với tài khoản nào trong hệ thống.");
                            });
                        });
                    }
                });
            });

            /* Điền nhanh tài khoản demo */
            U.$$("[data-demo]").forEach(function (b) {
                b.addEventListener("click", function (e) {
                    e.preventDefault();
                    form.username.value = b.dataset.demo;
                    form.password.value = "123456";
                    form.username.focus();
                });
            });
        }
    }

    /* =====================================================
       9. TRANG CHÍNH (dashboard + danh sách)
       ===================================================== */
    function pageDashboard() {
        var user = Layout.mount("dashboard", "Trang chính");
        if (!user) return;

        var state = {
            tab: U.param("tab") === "den" ? "den" : "di",
            q: U.param("q") || "",
            tinhTrang: "",
            loaiPYC: "",
            phong: "",
            sort: { key: "ngayYeuCau", dir: "desc" },
            page: 1,
            size: 8
        };

        /* --- Nạp danh mục vào bộ lọc --- */
        U.$("#fTinhTrang").innerHTML = '<option value="">Tất cả tình trạng</option>' +
            optionList(DB.TINH_TRANG, "", "id", "ten");
        U.$("#fLoai").innerHTML = '<option value="">Tất cả loại yêu cầu</option>' +
            optionList(DB.loaiList(), "", "id", "ten");
        U.$("#fPhong").innerHTML = '<option value="">Tất cả phòng thực hiện</option>' +
            optionList(DB.depts(), "", "maPhong", "tenPhong");

        /* --- Sự kiện bộ lọc --- */
        U.$("#fSearch").value = state.q;
        U.$("#fSearch").addEventListener("input", U.debounce(function () {
            state.q = this.value.trim(); state.page = 1; renderTable();
        }, 250));

        /* Ô tìm nhanh trên header lọc thẳng tại chỗ, không cần tải lại trang */
        if (U.$("#tbSearch")) U.$("#tbSearch").value = state.q;
        Layout.onQuickSearch = function (kw) {
            state.q = kw;
            state.page = 1;
            U.$("#fSearch").value = kw;
            renderTable();
            U.$("#tblCard").scrollIntoView({ behavior: "smooth", block: "start" });
        };
        ["fTinhTrang", "fLoai", "fPhong"].forEach(function (id) {
            U.$("#" + id).addEventListener("change", function () {
                state[id === "fTinhTrang" ? "tinhTrang" : id === "fLoai" ? "loaiPYC" : "phong"] = this.value;
                state.page = 1;
                renderTable();
            });
        });
        U.$("#btnResetFilter").addEventListener("click", function () {
            state.q = state.tinhTrang = state.loaiPYC = state.phong = "";
            state.page = 1;
            U.$("#fSearch").value = "";
            if (U.$("#tbSearch")) U.$("#tbSearch").value = "";
            ["fTinhTrang", "fLoai", "fPhong"].forEach(function (id) { U.$("#" + id).value = ""; });
            renderTable();
            UI.toast("Đã xoá bộ lọc.", "info");
        });

        /* --- Tab --- */
        U.$$(".tab-btn").forEach(function (b) {
            b.addEventListener("click", function () {
                state.tab = b.dataset.tab;
                state.page = 1;
                U.$$(".tab-btn").forEach(function (x) { x.classList.toggle("active", x === b); });
                datTieuDeBang();
                renderTable();
                history.replaceState(null, "", "dashboard.html?tab=" + state.tab);
            });
        });
        U.$$(".tab-btn").forEach(function (x) { x.classList.toggle("active", x.dataset.tab === state.tab); });
        datTieuDeBang();

        function datTieuDeBang() {
            U.$("#tblTitle").textContent = state.tab === "di"
                ? "Danh sách phiếu yêu cầu đi" : "Danh sách phiếu yêu cầu đến";
        }

        /* ---------- Ẩn / hiện khu vực thống kê ---------- */
        function bindToggleDashboard() {
            var zone = U.$("#dashboardZone"), bar = U.$("#dashBar"), btn = U.$("#btnToggleDash");
            if (!zone || !btn) return;

            apDung(localStorage.getItem("pyc_dashboard") === "an");

            btn.addEventListener("click", function () {
                var an = !zone.classList.contains("hidden");
                apDung(an);
                localStorage.setItem("pyc_dashboard", an ? "an" : "hien");
            });

            function apDung(an) {
                zone.classList.toggle("hidden", an);
                bar.classList.toggle("collapsed", an);
                U.$("#dashToggleText").textContent = an ? "Hiện thống kê" : "Ẩn thống kê";
                btn.title = an ? "Hiện bảng thống kê" : "Ẩn bảng thống kê";

                /* Khởi động lại hiệu ứng xuất hiện khi mở lại */
                if (!an) {
                    zone.classList.remove("fade-in");
                    void zone.offsetWidth;
                    zone.classList.add("fade-in");
                }
            }
        }

        /* --- Ẩn / hiện khu vực thống kê (nhớ trạng thái) --- */
        bindToggleDashboard();

        /* --- Thêm phiếu --- */
        U.$("#btnAdd").addEventListener("click", function () {
            window.location.href = "chi-tiet.html?huong=" + state.tab + "&new=1";
        });

        /* --- Sắp xếp theo cột --- */
        U.$$("th.sortable").forEach(function (th) {
            th.addEventListener("click", function () {
                var k = th.dataset.key;
                if (state.sort.key === k) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
                else state.sort = { key: k, dir: "asc" };
                renderTable();
            });
        });

        renderStats();
        renderTable();

        /* ---------- Thống kê theo chức danh ---------- */
        function renderStats() {
            var all = Perm.scope(user, DB.tickets());
            var late = all.filter(isLate);
            var doTaoTrongPhong = [], phongThucHien = [], toiTao = [], toiThucHien = [];

            if (Perm.isQuanLy(user)) {
                var thanhVien = DB.usersOfDept(user.maPhong).map(function (u) { return u.username; });
                doTaoTrongPhong = all.filter(function (t) { return thanhVien.indexOf(t.nguoiTaoUser) >= 0; });
                phongThucHien = all.filter(function (t) { return t.phongThucHien === user.maPhong; });
            } else if (!Perm.isAdmin(user)) {
                toiTao = all.filter(function (t) { return t.nguoiTaoUser === user.username; });
                toiThucHien = all.filter(function (t) { return t.nguoiThucHienUser === user.username; });
            }

            /* Bốn thẻ tổng hợp: nhãn và số liệu đổi theo chức danh */
            var the;
            if (Perm.isAdmin(user)) {
                the = [
                    { v: all.length, l: "Tổng số phiếu toàn hệ thống" },
                    { v: all.filter(function (t) { return t.huong === "di"; }).length, l: "Phiếu yêu cầu đi" },
                    { v: all.filter(function (t) { return t.huong === "den"; }).length, l: "Phiếu yêu cầu đến" },
                    { v: late.length, l: "Phiếu đang quá hạn" }
                ];
            } else if (Perm.isQuanLy(user)) {
                the = [
                    { v: all.length, l: "Tổng phiếu liên quan phòng " + user.maPhong },
                    { v: doTaoTrongPhong.length, l: "Do nhân sự trong phòng tạo" },
                    { v: phongThucHien.length, l: "Phòng mình thực hiện" },
                    { v: late.length, l: "Phiếu đang quá hạn" }
                ];
            } else {
                the = [
                    { v: all.length, l: "Tổng phiếu liên quan đến tôi" },
                    { v: toiTao.length, l: "Phiếu do tôi tạo" },
                    { v: toiThucHien.length, l: "Phiếu tôi thực hiện" },
                    { v: late.length, l: "Phiếu đang quá hạn" }
                ];
            }
            the.forEach(function (x, i) {
                U.$("#stV" + (i + 1)).textContent = x.v;
                U.$("#stL" + (i + 1)).textContent = x.l;
            });

            var done = all.filter(function (t) { return t.tinhTrang === "hoanthanh"; });
            U.$("#stDoneRate").textContent = all.length
                ? "Hoàn thành " + Math.round(done.length / all.length * 100) + "%"
                : "Chưa có dữ liệu";

            U.$("#tabCountDi").textContent = all.filter(function (t) { return t.huong === "di"; }).length;
            U.$("#tabCountDen").textContent = all.filter(function (t) { return t.huong === "den"; }).length;

            /* Biểu đồ vòng theo tình trạng */
            var segs = [], acc = 0, legend = "";
            DB.TINH_TRANG.forEach(function (s) {
                var n = all.filter(function (t) { return t.tinhTrang === s.id; }).length;
                var pct = all.length ? (n / all.length * 100) : 0;
                segs.push(s.mau + " " + acc.toFixed(2) + "% " + (acc + pct).toFixed(2) + "%");
                acc += pct;
                legend += '<li><span class="dot" style="background:' + s.mau + '"></span>' +
                    '<span class="lg-name">' + U.esc(s.ten) + '</span>' +
                    '<span class="lg-val">' + n + '</span>' +
                    '<span class="lg-pct">' + pct.toFixed(0) + '%</span></li>';
            });
            U.$("#donut").style.background = all.length
                ? "conic-gradient(" + segs.join(",") + ")"
                : "conic-gradient(#E6EBF1 0 100%)";
            U.$("#donutTotal").textContent = all.length;
            U.$("#donutLegend").innerHTML = legend;

            /* Biểu đồ cột theo loại yêu cầu */
            veCot("#barLoai", DB.loaiList().map(function (l) {
                return { ten: l.ten, n: all.filter(function (t) { return t.loaiPYC === l.id; }).length };
            }));

            /* Biểu đồ cột thứ hai: đổi theo chức danh */
            if (Perm.isAdmin(user)) {
                U.$("#chartPhongTitle").textContent = "Số lượng theo phòng thực hiện";
                veCot("#barPhong", DB.depts().map(function (d) {
                    return {
                        ten: d.maPhong + " - " + d.tenPhong,
                        n: all.filter(function (t) { return t.phongThucHien === d.maPhong; }).length
                    };
                }));
            } else if (Perm.isQuanLy(user)) {
                U.$("#chartPhongTitle").textContent = "Số lượng theo nhân viên phòng " + user.maPhong;
                veCot("#barPhong", DB.usersOfDept(user.maPhong).map(function (u) {
                    var th = all.filter(function (t) { return t.nguoiThucHienUser === u.username; }).length;
                    var ta = all.filter(function (t) { return t.nguoiTaoUser === u.username; }).length;
                    var lq = all.filter(function (t) {
                        return t.nguoiThucHienUser === u.username || t.nguoiTaoUser === u.username;
                    }).length;
                    return { ten: u.hoTen, n: lq, phu: th + " thực hiện &middot; " + ta + " tạo" };
                }));
            } else {
                U.$("#chartPhongTitle").textContent = "Phân bổ phiếu của tôi";
                veCot("#barPhong", [
                    { ten: "Phiếu do tôi tạo", n: toiTao.length },
                    { ten: "Phiếu tôi thực hiện", n: toiThucHien.length },
                    {
                        ten: "Vừa tạo vừa thực hiện",
                        n: all.filter(function (t) {
                            return t.nguoiTaoUser === user.username && t.nguoiThucHienUser === user.username;
                        }).length
                    }
                ]);
            }
        }

        /* Vẽ một biểu đồ cột ngang */
        function veCot(sel, data) {
            var box = U.$(sel);
            if (!data.length) {
                box.innerHTML = '<li class="muted">Chưa có dữ liệu.</li>';
                return;
            }
            var max = 1;
            data.forEach(function (x) { if (x.n > max) max = x.n; });
            data.sort(function (a, b) { return b.n - a.n; });

            box.innerHTML = data.map(function (x, i) {
                return '<li><div class="bar-top"><span class="b-name">' + U.esc(x.ten) +
                    (x.phu ? ' <span class="muted">(' + x.phu + ')</span>' : '') + '</span>' +
                    '<span class="b-val">' + x.n + '</span></div>' +
                    '<div class="bar-track"><div class="bar-fill b-' + (i % 4 + 1) + '" style="width:' +
                    (x.n / max * 100) + '%"></div></div></li>';
            }).join("");
        }

        /* ---------- Lọc + sắp xếp ---------- */
        function getRows() {
            var q = U.noAccent(state.q);
            var rows = Perm.scope(user, DB.tickets()).filter(function (t) {
                if (t.huong !== state.tab) return false;
                if (state.tinhTrang && t.tinhTrang !== state.tinhTrang) return false;
                if (state.loaiPYC && t.loaiPYC !== state.loaiPYC) return false;
                if (state.phong && t.phongThucHien !== state.phong) return false;
                if (q) {
                    var hay = U.noAccent([t.maPYC, t.noiDung, t.donViYeuCau, t.nguoiTao, t.nguoiThucHien,
                        DB.label("LOAI_PYC", t.loaiPYC), t.phongThucHien].join(" "));
                    if (hay.indexOf(q) < 0) return false;
                }
                return true;
            });

            var k = state.sort.key, dir = state.sort.dir === "asc" ? 1 : -1;
            rows.sort(function (a, b) {
                var va = a[k], vb = b[k];
                if (k === "tinhTrang") {
                    var order = DB.TINH_TRANG.map(function (s) { return s.id; });
                    va = order.indexOf(a.tinhTrang); vb = order.indexOf(b.tinhTrang);
                }
                if (va === vb) return 0;
                return (va > vb ? 1 : -1) * dir;
            });
            return rows;
        }

        /* ---------- Bảng dữ liệu ---------- */
        function renderTable() {
            var rows = getRows();
            var totalPage = Math.max(1, Math.ceil(rows.length / state.size));
            if (state.page > totalPage) state.page = totalPage;
            var start = (state.page - 1) * state.size;
            var pageRows = rows.slice(start, start + state.size);

            var tbody = U.$("#tblBody");

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">' +
                    '<div class="em-ico">📭</div><h4>Không có phiếu yêu cầu nào</h4>' +
                    '<p>Bạn chỉ nhìn thấy các phiếu thuộc phạm vi quyền hạn của mình. ' +
                    'Hãy thay đổi bộ lọc hoặc tạo phiếu yêu cầu mới.</p></div></td></tr>';
            } else {
                tbody.innerHTML = pageRows.map(function (t) {
                    var suaDuoc = Perm.canEdit(user, t);
                    var doiTTDuoc = Perm.canUpdateStatus(user, t);
                    var soBangChung = evidenceOf(t).length;

                    return '<tr class="row-anim" data-id="' + t.id + '">' +
                        '<td class="nowrap"><a class="code" href="chi-tiet.html?id=' + t.id + '">' + U.esc(t.maPYC) + '</a>' +
                        '<div class="sub">' + U.fmtDate(t.ngayTao) + '</div></td>' +
                        '<td><span class="badge badge-soft">' + U.esc(DB.label("LOAI_PYC", t.loaiPYC)) + '</span></td>' +
                        '<td style="min-width:220px"><div style="font-weight:600">' + U.esc(U.cut(t.noiDung, 68)) + '</div></td>' +
                        '<td class="nowrap">' + U.esc(t.donViYeuCau) + '</td>' +
                        '<td class="nowrap">' + U.esc(t.nguoiTao || "--") + '</td>' +
                        '<td class="nowrap">' + U.esc(t.phongThucHien) +
                        '<div class="sub">' + U.esc(t.nguoiThucHien || "--") + '</div></td>' +
                        '<td class="nowrap">' + U.fmtDate(t.ngayYeuCau) + '</td>' +
                        '<td class="nowrap">' + badgeHan(t) + '</td>' +
                        '<td>' + badgeTinhTrang(t.tinhTrang) +
                        (t.files && t.files.length ? ' <span class="badge badge-soft" title="Tệp đính kèm">📎 ' + t.files.length + '</span>' : '') +
                        (soBangChung ? ' <span class="badge badge-gold" title="Bằng chứng xử lý">🔎 ' + soBangChung + '</span>' : '') +
                        '</td>' +
                        '<td><div class="actions">' +
                        (doiTTDuoc ? '<button class="icon-btn" data-act="status" title="' + U.esc(nhanNutXuLy(user, t)) + '">↻</button>' : '') +
                        '<button class="icon-btn" data-act="open" title="' + (suaDuoc ? "Xem / Sửa" : "Xem chi tiết") + '">' +
                        (suaDuoc ? "✎" : "👁") + '</button>' +
                        (Perm.canDelete(user, t) ? '<button class="icon-btn danger" data-act="del" title="Xoá phiếu">🗑</button>' : '') +
                        '</div></td></tr>';
                }).join("");
            }

            /* Đánh dấu cột đang sắp xếp */
            U.$$("th.sortable").forEach(function (th) {
                var on = th.dataset.key === state.sort.key;
                th.classList.toggle("sorted", on);
                var ar = U.$(".arrow", th);
                if (ar) ar.textContent = on ? (state.sort.dir === "asc" ? "▲" : "▼") : "▴";
            });

            renderPager(rows.length, totalPage, start, pageRows.length);
            bindRowActions();
        }

        function renderPager(total, totalPage, start, shown) {
            var html = '<div class="p-info">Hiển thị <b>' + (total ? start + 1 : 0) + '-' + (start + shown) +
                '</b> trong tổng số <b>' + total + '</b> phiếu</div>';
            html += '<button data-p="prev"' + (state.page === 1 ? " disabled" : "") + '>&lsaquo;</button>';
            for (var i = 1; i <= totalPage; i++) {
                if (totalPage > 7 && i > 2 && i < totalPage - 1 && Math.abs(i - state.page) > 1) {
                    if (i === 3) html += '<span class="muted">...</span>';
                    continue;
                }
                html += '<button data-p="' + i + '" class="' + (i === state.page ? "active" : "") + '">' + i + '</button>';
            }
            html += '<button data-p="next"' + (state.page === totalPage ? " disabled" : "") + '>&rsaquo;</button>';

            var pager = U.$("#pager");
            pager.innerHTML = html;
            U.$$("button[data-p]", pager).forEach(function (b) {
                b.addEventListener("click", function () {
                    var p = b.dataset.p;
                    if (p === "prev") state.page--;
                    else if (p === "next") state.page++;
                    else state.page = parseInt(p, 10);
                    renderTable();
                    U.$("#tblCard").scrollIntoView({ behavior: "smooth", block: "start" });
                });
            });
        }

        function bindRowActions() {
            U.$$("#tblBody button[data-act]").forEach(function (btn) {
                btn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var id = btn.closest("tr").dataset.id;
                    var t = DB.ticketById(id);
                    if (!t) return;

                    if (btn.dataset.act === "open") {
                        window.location.href = "chi-tiet.html?id=" + id;
                    } else if (btn.dataset.act === "status") {
                        statusModal(t, user, function () { renderStats(); renderTable(); });
                    } else {
                        if (!Perm.canDelete(user, t)) {
                            UI.toast("Chỉ người tạo phiếu mới được xoá phiếu này.", "error");
                            return;
                        }
                        UI.confirm({
                            title: "Xoá phiếu yêu cầu",
                            html: "Bạn có chắc muốn xoá phiếu <b>" + U.esc(t.maPYC) + "</b>?<br>" +
                                '<span class="muted">Thao tác này không thể hoàn tác.</span>',
                            okText: "Xoá phiếu",
                            danger: true
                        }, function () {
                            DB.deleteTicket(id).then(function () {
                                renderStats();
                                renderTable();
                                UI.toast("Đã xoá phiếu " + t.maPYC + ".", "success");
                            }).catch(function (err) {
                                UI.toast(err.message || "Không xoá được phiếu.", "error");
                            });
                        });
                    }
                });
            });
        }
    }

    /* =====================================================
       10. TRANG CHI TIẾT PHIẾU YÊU CẦU
       ===================================================== */
    function pageDetail() {
        var user = Layout.mount("dashboard", "Phiếu yêu cầu");
        if (!user) return;

        var isNew = U.param("new") === "1";
        var id = U.param("id");
        var ticket = isNew ? null : DB.ticketById(id);

        if (!isNew && !ticket) {
            thongBaoTrang("⚠", "Không tìm thấy phiếu yêu cầu", "Phiếu có thể đã bị xoá.");
            return;
        }
        if (!isNew && !Perm.canView(user, ticket)) {
            thongBaoTrang("🔒", "Bạn không có quyền xem phiếu này",
                "Phiếu yêu cầu này nằm ngoài phạm vi dữ liệu của chức danh " +
                DB.label("CHUC_DANH", user.chucDanh) + ".");
            return;
        }

        var huong = isNew ? (U.param("huong") === "den" ? "den" : "di") : ticket.huong;
        var editing = isNew;

        var model = ticket ? JSON.parse(JSON.stringify(ticket)) : {
            id: DB.uid("t"),
            huong: huong,
            maPYC: DB.genMaPYC(huong),
            loaiPYC: (DB.loaiList()[0] || {}).id || "",
            donViYeuCau: user.maPhong,
            ngayYeuCau: U.today(),
            thoiHan: "",
            noiDung: "",
            phongThucHien: "",
            nguoiThucHien: "",
            nguoiThucHienUser: "",
            tinhTrang: "moi",
            uuTien: "binhthuong",
            nguoiTao: user.hoTen,
            nguoiTaoUser: user.username,
            ngayTao: U.today(),
            ngayCapNhat: U.today(),
            files: [],
            lichSu: []
        };

        render();

        function thongBaoTrang(ico, tieuDe, moTa) {
            U.$("#detailRoot").innerHTML = '<div class="card"><div class="empty-state">' +
                '<div class="em-ico">' + ico + '</div><h4>' + U.esc(tieuDe) + '</h4>' +
                '<p>' + U.esc(moTa) + '</p>' +
                '<a href="dashboard.html" class="btn btn-primary mt-16">Về trang chính</a></div></div>';
        }

        function render() {
            var h = DB.HUONG.filter(function (x) { return x.id === model.huong; })[0];
            var suaDuoc = isNew || Perm.canEdit(user, model);
            /* Tệp hồ sơ của phiếu không bị khoá theo tình trạng/người thực
               hiện như suaDuoc - người tạo bổ sung hồ sơ được bất kỳ lúc nào. */
            var suaDuocTep = isNew || Perm.canManageFiles(user, model);
            var doiTTDuoc = !isNew && Perm.canUpdateStatus(user, model);
            var bangChung = evidenceOf(model);

            U.$("#detailRoot").innerHTML =
                '<div class="page-head">' +
                '<button type="button" class="back" id="btnBack" title="Quay lại">←</button>' +
                '<div><h2>' + (isNew ? "Tạo phiếu yêu cầu mới" : U.esc(model.maPYC)) +
                '<small>' + U.esc(h ? h.ten : "") + (isNew ? "" : " &middot; Cập nhật: " + U.fmtDate(model.ngayCapNhat)) + '</small></h2></div>' +
                '<div class="spacer"></div>' +
                '<div class="chip-row">' + badgeHuong(model.huong) + badgeTinhTrang(model.tinhTrang) +
                (isNew ? '' : '<span class="badge ' + (suaDuoc ? "badge-gold" : "badge-soft") + '">' +
                    Perm.vaiTro(user, model) + '</span>') + '</div>' +
                '</div>' +

                '<div class="detail-grid">' +
                /* --- Cột trái: biểu mẫu --- */
                '<div>' +
                '<div class="card"><div class="card-head"><h3>Thông tin phiếu yêu cầu</h3><div class="spacer"></div>' +
                thanhCongCu(suaDuoc, doiTTDuoc) +
                '</div><div class="card-body">' + formHTML(suaDuoc) + '</div>' +
                (isNew ? '<div class="modal-foot" style="border-radius:0">' +
                    '<a href="dashboard.html?tab=' + model.huong + '" class="btn btn-outline">Huỷ bỏ</a>' +
                    '<button class="btn btn-primary" id="btnCreate">💾 Tạo phiếu yêu cầu</button></div>' : '') +
                '</div>' +

                /* --- Phân công người thực hiện: quản lý phòng thực hiện (hoặc
                   admin) chọn/đổi người thực hiện, độc lập với đổi tình trạng --- */
                (!isNew && Perm.canAssign(user, model) ? assignHTML() : '') +

                /* --- Đính kèm hồ sơ: chỉ người tạo phiếu được thêm/xoá --- */
                '<div class="card"><div class="card-head"><h3>Tệp đính kèm ' +
                '<small>(' + (model.files || []).length + ' tệp)</small></h3>' +
                (suaDuocTep ? '' : '<div class="spacer"></div><span class="badge badge-soft">Chỉ xem</span>') + '</div>' +
                '<div class="card-body">' +
                (suaDuocTep ? '<div class="dropzone" id="dz"><div class="dz-ico">☁</div>' +
                    '<div><b>Chọn tệp</b> hoặc kéo thả vào đây</div>' +
                    '<div class="dz-hint">PDF, Word, Excel, hình ảnh &middot; tối đa 2MB mỗi tệp</div>' +
                    '<input type="file" id="fileInput" multiple hidden></div>' : '') +
                '<div class="file-list" id="fileList"></div>' +
                '</div></div>' +

                /* --- Bằng chứng xử lý --- */
                '<div class="card"><div class="card-head"><h3>Bằng chứng xử lý ' +
                '<small>(' + bangChung.length + ' tệp)</small></h3></div>' +
                '<div class="card-body">' +
                (bangChung.length
                    ? bangChung.map(function (e) {
                        return fileItemHTML(e.file, false, DB.label("TINH_TRANG", e.tinhTrang));
                    }).join("")
                    : '<p class="muted" style="text-align:center;padding:10px">Chưa có bằng chứng đính kèm. ' +
                      'Người thực hiện có thể đính kèm khi cập nhật tình trạng.</p>') +
                '</div></div>' +
                '</div>' +

                /* --- Cột phải --- */
                '<div>' +
                '<div class="card"><div class="card-head"><h3>Tóm tắt</h3></div><div class="card-body">' +
                '<ul class="info-list">' +
                info("Mã PYC", model.maPYC) +
                info("Loại phiếu", h ? h.ten : "") +
                info("Loại yêu cầu", DB.label("LOAI_PYC", model.loaiPYC)) +
                info("Độ ưu tiên", DB.label("UU_TIEN", model.uuTien)) +
                info("Phòng yêu cầu", model.donViYeuCau) +
                info("Người yêu cầu", model.nguoiTao) +
                info("Ngày tạo", U.fmtDate(model.ngayTao)) +
                info("Thời hạn", badgeHan(model), true) +
                info("Tệp đính kèm", tomTatTep(model.files || []), true) +
                info("Bằng chứng", tomTatTep(bangChung.map(function (e) { return e.file; })), true) +
                '</ul></div></div>' +

                '<div class="card"><div class="card-head"><h3>Lịch sử xử lý</h3></div><div class="card-body">' +
                timelineHTML() + '</div></div>' +
                '</div></div>';

            bind(suaDuoc, suaDuocTep);
        }

        /* Nút thao tác ở đầu thẻ, phụ thuộc quyền */
        function thanhCongCu(suaDuoc, doiTTDuoc) {
            if (isNew) return "";
            if (editing) {
                return '<button class="btn btn-outline btn-sm" id="btnCancel">Huỷ</button>' +
                    '<button class="btn btn-primary btn-sm" id="btnSave">💾 Lưu thay đổi</button>';
            }
            var html = "";
            if (doiTTDuoc) html += '<button class="btn btn-outline btn-sm" id="btnStatus">' + nhanNutXuLy(user, model) + '</button>';
            if (Perm.canSendToRequester(user, model)) {
                html += '<button class="btn btn-primary btn-sm" id="btnGuiKetQua">📤 Gửi kết quả cho đơn vị yêu cầu</button>';
            }
            if (Perm.canDeclineAssignment(user, model)) {
                html += '<button class="btn btn-outline btn-sm" id="btnTuChoiThucHien">🙅 Từ chối thực hiện</button>';
            }
            if (suaDuoc) html += '<button class="btn btn-primary btn-sm" id="btnEdit">✎ Chỉnh sửa</button>';
            if (!html) html = '<span class="badge badge-soft">Bạn chỉ có quyền xem phiếu này</span>';
            return html;
        }

        function info(k, v, raw) {
            return '<li><span class="k">' + U.esc(k) + '</span><span class="v">' +
                (raw ? v : U.esc(v || "--")) + '</span></li>';
        }

        /* Danh sách tên tệp rút gọn cho ô tóm tắt */
        function tomTatTep(files) {
            if (!files.length) return '<span class="muted">Không có</span>';
            return files.map(function (f) {
                return '<div style="margin-bottom:4px"><a href="' + (f.url || f.duLieu || "#") + '" download="' +
                    U.esc(f.ten) + '">📄 ' + U.esc(f.ten) + '</a> ' +
                    '<span class="muted" style="font-size:12px">(' + U.fileSize(f.kichThuoc) + ')</span></div>';
            }).join("");
        }

        /* Khối "Phân công người thực hiện" - độc lập với form chính và với
           "Cập nhật tình trạng": quản lý phòng thực hiện (hoặc admin) chọn
           hoặc đổi nhân sự thực hiện phiếu bất kỳ lúc nào (trước khi phiếu
           Hoàn thành), không đổi tình trạng phiếu. */
        function assignHTML() {
            var staff = DB.usersOfDept(model.phongThucHien);
            return '<div class="card"><div class="card-head"><h3>Người thực hiện</h3></div>' +
                '<div class="card-body">' +
                '<div class="form-row" style="align-items:flex-end">' +
                '<div class="form-group mb-0" style="flex:1"><label>Chọn nhân sự phòng ' +
                U.esc(DB.deptName(model.phongThucHien)) + '</label>' +
                '<select class="form-control" id="selGan">' +
                '<option value="">-- Chọn nhân sự --</option>' +
                optionList(staff, model.nguoiThucHienUser, "username", "hoTen") + '</select></div>' +
                '<div class="form-group mb-0"><button type="button" class="btn btn-primary" id="btnGan">' +
                (model.nguoiThucHienUser ? "Đổi người thực hiện" : "Phân công") + '</button></div>' +
                (Perm.canRejectIntake(user, model) ?
                    '<div class="form-group mb-0"><button type="button" class="btn btn-outline" id="btnTuChoiTiepNhan">' +
                    '❌ Từ chối tiếp nhận</button></div>' : '') +
                '</div></div></div>';
        }

        /* Trường "Người thực hiện yêu cầu" trong biểu mẫu - tái dùng cả lúc
           vẽ ban đầu lẫn khi đổi "Phòng thực hiện" (xem bind()). Ai được tự
           chọn phụ thuộc VÀO PHÒNG THỰC HIỆN đang chọn (Perm.canPickAssignee):
           Thành viên không bao giờ; Cấp quản lý chỉ khi đó là phòng của
           chính họ; Admin luôn được. Không được chọn thì hiện ô chỉ đọc,
           chờ quản lý phòng thực hiện phân công (khối "Người thực hiện"
           riêng trên trang chi tiết). */
        function nguoiThucHienFieldHTML(ro, phongThucHienValue) {
            var noiDung = Perm.canPickAssignee(user, phongThucHienValue)
                ? '<select name="nguoiThucHien" class="form-control"' + ro + '>' +
                    '<option value="">-- Chọn nhân sự --</option>' +
                    optionList(phongThucHienValue ? DB.usersOfDept(phongThucHienValue) : DB.users(),
                        model.nguoiThucHienUser, "username", "hoTen") + '</select>'
                : '<input type="text" class="form-control" value="' +
                    (model.nguoiThucHienUser ? U.esc(model.nguoiThucHien) : "-- Do quản lý phòng thực hiện phân công --") +
                    '" readonly>';
            return '<div class="form-group" id="fgNguoiThucHien"><label>Người thực hiện yêu cầu</label>' + noiDung + '</div>';
        }

        function formHTML(suaDuoc) {
            var moKhoa = editing && suaDuoc;
            var ro = moKhoa ? "" : " disabled";
            var depts = DB.depts();

            return '<form id="frmPyc" novalidate>' +
                '<div class="form-row">' +
                '<div class="form-group"><label>Loại phiếu yêu cầu <span class="req">*</span></label>' +
                '<select name="huong" class="form-control"' + (isNew ? "" : " disabled") + '>' +
                optionList(DB.HUONG, model.huong, "id", "ten") + '</select></div>' +
                '<div class="form-group"><label>Mã PYC</label>' +
                '<input type="text" name="maPYC" class="form-control" value="' + U.esc(model.maPYC) + '" readonly></div>' +
                '</div>' +

                '<div class="form-row">' +
                '<div class="form-group"><label>Loại yêu cầu <span class="req">*</span></label>' +
                '<select name="loaiPYC" class="form-control"' + ro + '>' +
                optionList(DB.loaiList(), model.loaiPYC, "id", "ten") + '</select></div>' +
                '<div class="form-group"><label>Đơn vị / phòng yêu cầu <span class="req">*</span></label>' +
                '<input type="text" name="donViYeuCau" class="form-control" list="dsDonVi" value="' +
                U.esc(model.donViYeuCau) + '"' + ro + '>' +
                '<datalist id="dsDonVi">' + depts.map(function (d) {
                    return '<option value="' + U.esc(d.maPhong) + '">' + U.esc(d.tenPhong) + '</option>';
                }).join("") + '</datalist>' +
                '<div class="field-error"></div></div>' +
                '</div>' +

                '<div class="form-row-3">' +
                '<div class="form-group"><label>Ngày yêu cầu <span class="req">*</span></label>' +
                '<input type="date" name="ngayYeuCau" class="form-control" value="' + U.esc(model.ngayYeuCau) + '"' + ro + '>' +
                '<div class="field-error"></div></div>' +
                '<div class="form-group"><label>Thời hạn <span class="req">*</span></label>' +
                '<input type="date" name="thoiHan" class="form-control" value="' + U.esc(model.thoiHan) + '"' + ro + '>' +
                '<div class="field-error"></div></div>' +
                '<div class="form-group"><label>Độ ưu tiên</label>' +
                '<select name="uuTien" class="form-control"' + ro + '>' +
                optionList(DB.UU_TIEN, model.uuTien, "id", "ten") + '</select></div>' +
                '</div>' +

                '<div class="form-group"><label>Nội dung yêu cầu <span class="req">*</span></label>' +
                '<textarea name="noiDung" class="form-control" rows="4" placeholder="Mô tả chi tiết nội dung yêu cầu..."' + ro + '>' +
                U.esc(model.noiDung) + '</textarea><div class="field-error"></div></div>' +

                '<div class="form-row">' +
                '<div class="form-group"><label>Phòng thực hiện yêu cầu <span class="req">*</span></label>' +
                '<select name="phongThucHien" class="form-control"' + ro + '>' +
                '<option value="">-- Chọn phòng --</option>' +
                optionList(depts, model.phongThucHien, "maPhong", "tenPhong") + '</select>' +
                '<div class="field-error"></div></div>' +
                nguoiThucHienFieldHTML(ro, model.phongThucHien) +
                '</div>' +

                (isNew ? '' :
                    '<div class="form-group mb-0"><label>Tình trạng</label>' +
                    '<input type="text" class="form-control" value="' +
                    U.esc(DB.label("TINH_TRANG", model.tinhTrang)) + '" readonly>' +
                    '<div class="muted" style="font-size:12px;margin-top:4px">' +
                    'Tình trạng chỉ đổi qua chức năng "Cập nhật tình trạng" để ghi nhận lịch sử và bằng chứng.' +
                    '</div></div>') +
                '</form>';
        }

        function timelineHTML() {
            var ls = (model.lichSu || []).slice().reverse();
            if (!ls.length) return '<p class="muted">Chưa có lịch sử xử lý.</p>';
            return '<ul class="timeline">' + ls.map(function (h, i) {
                return '<li class="' + (i === 0 ? "current" : "done") + '">' +
                    '<div class="tl-title">' + U.esc(h.nhanSuKien || DB.label("TINH_TRANG", h.tinhTrang)) + '</div>' +
                    '<div class="tl-time">' + U.fmtDateTime(h.thoiGian) + ' &middot; ' + U.esc(h.nguoi) +
                    (h.vaiTro ? ' (' + U.esc(h.vaiTro) + ')' : '') + '</div>' +
                    (h.ghiChu ? '<div class="muted" style="font-size:12.5px">' + U.esc(h.ghiChu) + '</div>' : '') +
                    ((h.files || []).length
                        ? '<div class="chip-row" style="margin-top:6px">' + h.files.map(function (f) {
                            return '<a class="badge badge-gold" href="' + (f.url || f.duLieu || "#") + '" download="' +
                                U.esc(f.ten) + '">📎 ' + U.esc(f.ten) + '</a>';
                        }).join("") + '</div>'
                        : '') +
                    '</li>';
            }).join("") + '</ul>';
        }

        /* ---------- Gắn sự kiện ---------- */
        function bind(suaDuoc, suaDuocTep) {
            U.$("#btnBack").addEventListener("click", function () {
                window.location.href = "dashboard.html?tab=" + model.huong;
            });

            var form = U.$("#frmPyc");

            /* Đổi phòng thực hiện -> vẽ lại cả khối "Người thực hiện yêu cầu"
               (select hay ô chỉ đọc phụ thuộc đúng phòng vừa chọn - vd. cấp
               quản lý chỉ chọn được khi đó là phòng của chính họ), đồng thời
               bỏ chọn người thực hiện cũ vì danh sách nhân sự đã đổi. */
            form.phongThucHien.addEventListener("change", function () {
                model.nguoiThucHienUser = "";
                model.nguoiThucHien = "";
                var fg = document.getElementById("fgNguoiThucHien");
                if (fg) fg.outerHTML = nguoiThucHienFieldHTML("", this.value);
            });

            /* Đổi hướng phiếu khi tạo mới -> sinh lại mã */
            if (isNew && form.huong) {
                form.huong.addEventListener("change", function () {
                    model.huong = this.value;
                    form.maPYC.value = DB.genMaPYC(this.value);
                });
            }

            var bEdit = U.$("#btnEdit");
            if (bEdit) bEdit.addEventListener("click", function () { editing = true; render(); });

            var bCancel = U.$("#btnCancel");
            if (bCancel) bCancel.addEventListener("click", function () {
                model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                editing = false;
                render();
            });

            var bStatus = U.$("#btnStatus");
            if (bStatus) bStatus.addEventListener("click", function () {
                statusModal(model, user, function () {
                    model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                    render();
                });
            });

            var bGan = U.$("#btnGan");
            if (bGan) bGan.addEventListener("click", function () {
                var chon = U.$("#selGan", U.$("#detailRoot"));
                if (!chon.value) { UI.toast("Vui lòng chọn nhân sự thực hiện.", "warn"); return; }
                UI.loading(bGan, true, "Đang lưu...");
                DB.assignExecutor(model.id, chon.value).then(function () {
                    model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                    UI.toast("Đã phân công " + model.nguoiThucHien + " thực hiện phiếu.", "success");
                    render();
                }).catch(function (err) {
                    UI.loading(bGan, false);
                    UI.toast(err.message || "Không phân công được người thực hiện.", "error");
                });
            });

            var bTuChoiTiepNhan = U.$("#btnTuChoiTiepNhan");
            if (bTuChoiTiepNhan) bTuChoiTiepNhan.addEventListener("click", function () {
                hopThoaiTuChoi("Từ chối tiếp nhận - " + model.maPYC, "❌ Từ chối tiếp nhận", function (lyDo) {
                    return DB.rejectIntake(model.id, lyDo).then(function () {
                        model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                        UI.toast("Đã từ chối tiếp nhận phiếu " + model.maPYC + ".", "success");
                        render();
                    });
                });
            });

            var bTuChoiThucHien = U.$("#btnTuChoiThucHien");
            if (bTuChoiThucHien) bTuChoiThucHien.addEventListener("click", function () {
                hopThoaiTuChoi("Từ chối thực hiện - " + model.maPYC, "🙅 Từ chối thực hiện", function (lyDo) {
                    return DB.declineAssignment(model.id, lyDo).then(function () {
                        model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                        UI.toast("Đã từ chối thực hiện phiếu " + model.maPYC + ".", "success");
                        render();
                    });
                });
            });

            var bGuiKetQua = U.$("#btnGuiKetQua");
            if (bGuiKetQua) bGuiKetQua.addEventListener("click", function () {
                UI.confirm({
                    title: "Gửi kết quả cho đơn vị yêu cầu",
                    html: "Gửi kết quả phiếu <b>" + U.esc(model.maPYC) + "</b> cho đơn vị yêu cầu?<br>" +
                        '<span class="muted">Sau khi gửi, bạn sẽ không còn thao tác được trên phiếu này nữa.</span>',
                    okText: "Gửi kết quả"
                }, function () {
                    UI.loading(bGuiKetQua, true, "Đang gửi...");
                    DB.sendToRequester(model.id).then(function () {
                        model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                        UI.toast("Đã gửi kết quả phiếu " + model.maPYC + " cho đơn vị yêu cầu.", "success");
                        render();
                    }).catch(function (err) {
                        UI.loading(bGuiKetQua, false);
                        UI.toast(err.message || "Không gửi được kết quả.", "error");
                    });
                });
            });

            var bSave = U.$("#btnSave");
            if (bSave) bSave.addEventListener("click", function () { save(false); });

            var bCreate = U.$("#btnCreate");
            if (bCreate) bCreate.addEventListener("click", function () { save(true); });

            if (suaDuocTep) bindFiles();
            renderFiles(suaDuocTep);
        }

        /* Đọc dữ liệu từ biểu mẫu vào model */
        function collect() {
            var f = U.$("#frmPyc");
            if (!f) return;
            if (f.huong && !f.huong.disabled) model.huong = f.huong.value;
            model.maPYC = f.maPYC.value;
            model.loaiPYC = f.loaiPYC.value;
            model.donViYeuCau = f.donViYeuCau.value.trim();
            model.ngayYeuCau = f.ngayYeuCau.value;
            model.thoiHan = f.thoiHan.value;
            model.uuTien = f.uuTien.value;
            model.noiDung = f.noiDung.value.trim();
            model.phongThucHien = f.phongThucHien.value;
            /* Ô "Người thực hiện" chỉ là <select> khi người dùng có quyền
               chọn (không phải Thành viên) - ngược lại giữ nguyên giá trị
               hiện có của model (readonly, không cho sửa qua form này). */
            if (f.nguoiThucHien && f.nguoiThucHien.tagName === "SELECT") {
                model.nguoiThucHienUser = f.nguoiThucHien.value;
                model.nguoiThucHien = model.nguoiThucHienUser ? DB.hoTen(model.nguoiThucHienUser) : "";
            }
        }

        function validate() {
            var f = U.$("#frmPyc");
            UI.clearErrors(f);
            var ok = true;

            if (!f.donViYeuCau.value.trim()) { UI.setError(f.donViYeuCau, "Vui lòng nhập đơn vị yêu cầu."); ok = false; }
            if (!f.ngayYeuCau.value) { UI.setError(f.ngayYeuCau, "Vui lòng chọn ngày yêu cầu."); ok = false; }
            if (!f.thoiHan.value) { UI.setError(f.thoiHan, "Vui lòng chọn thời hạn."); ok = false; }
            else if (f.ngayYeuCau.value && f.thoiHan.value < f.ngayYeuCau.value) {
                UI.setError(f.thoiHan, "Thời hạn phải sau ngày yêu cầu."); ok = false;
            }
            if (f.noiDung.value.trim().length < 10) { UI.setError(f.noiDung, "Nội dung tối thiểu 10 ký tự."); ok = false; }
            if (!f.phongThucHien.value) { UI.setError(f.phongThucHien, "Vui lòng chọn phòng thực hiện."); ok = false; }

            if (!ok) UI.toast("Vui lòng kiểm tra lại các trường bắt buộc.", "warn");
            return ok;
        }

        function save(creating) {
            if (!creating && !Perm.canEdit(user, model)) {
                UI.toast("Chỉ người tạo phiếu mới được chỉnh sửa nội dung phiếu.", "error");
                return;
            }
            if (!validate()) return;
            collect();

            var payload = {
                huong: model.huong, loaiPYC: model.loaiPYC, donViYeuCau: model.donViYeuCau,
                ngayYeuCau: model.ngayYeuCau, thoiHan: model.thoiHan, noiDung: model.noiDung,
                phongThucHien: model.phongThucHien, nguoiThucHienUser: model.nguoiThucHienUser,
                uuTien: model.uuTien
            };
            var btn = creating ? U.$("#btnCreate") : U.$("#btnSave");
            if (btn) UI.loading(btn, true, creating ? "Đang tạo phiếu..." : "Đang lưu...");

            if (creating) {
                /* Tệp đã chọn trước khi phiếu tồn tại (xem addFiles) - tải lên
                   thật sự ngay sau khi tạo phiếu thành công và có id thật. */
                var tepChoTai = (model.files || [])
                    .filter(function (f) { return f._rawFile; })
                    .map(function (f) { return f._rawFile; });

                DB.createTicket(payload).then(function (ticketMoi) {
                    if (!tepChoTai.length) return ticketMoi;
                    return DB.addTicketFiles(ticketMoi.id, tepChoTai)
                        .then(function () { return DB.ticketById(ticketMoi.id) || ticketMoi; })
                        .catch(function () {
                            UI.toast("Đã tạo phiếu nhưng một số tệp đính kèm chưa lưu được.", "warn");
                            return ticketMoi;
                        });
                }).then(function (ticketMoi) {
                    UI.toast("Đã tạo phiếu " + ticketMoi.maPYC + ".", "success");
                    setTimeout(function () { window.location.href = "chi-tiet.html?id=" + ticketMoi.id; }, 600);
                }).catch(function (err) {
                    if (btn) UI.loading(btn, false);
                    UI.toast(err.message || "Không tạo được phiếu yêu cầu.", "error");
                });
            } else {
                DB.updateTicket(model.id, payload).then(function (ticketMoi) {
                    model = ticketMoi;
                    editing = false;
                    UI.toast("Đã lưu thay đổi.", "success");
                    render();
                }).catch(function (err) {
                    if (btn) UI.loading(btn, false);
                    UI.toast(err.message || "Không lưu được thay đổi.", "error");
                });
            }
        }

        /* ---------- Tệp đính kèm ---------- */
        function bindFiles() {
            var dz = U.$("#dz"), input = U.$("#fileInput");
            if (!dz) return;

            dz.addEventListener("click", function () { input.click(); });
            input.addEventListener("change", function () { addFiles(this.files); this.value = ""; });

            ["dragenter", "dragover"].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
            });
            ["dragleave", "drop"].forEach(function (ev) {
                dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragover"); });
            });
            dz.addEventListener("drop", function (e) { addFiles(e.dataTransfer.files); });
        }

        function addFiles(fileList) {
            var hopLe = locTepHopLe(fileList);
            if (!hopLe.length) return;

            if (isNew) {
                /* Phiếu chưa tồn tại trên máy chủ - chỉ xếp hàng cục bộ, tải
                   lên thật sự ngay sau khi tạo phiếu thành công (xem save()). */
                model.files = (model.files || []).concat(hopLe.map(function (f) {
                    return {
                        id: DB.uid("f"), ten: f.name, kichThuoc: f.size, loai: f.type,
                        url: "", nguoiTai: user.hoTen, ngayTai: U.nowISO(), _rawFile: f
                    };
                }));
                render();
                UI.toast("Đã thêm " + hopLe.length + " tệp, sẽ lưu khi tạo phiếu.", "success");
                return;
            }

            DB.addTicketFiles(model.id, hopLe).then(function (data) {
                model = JSON.parse(JSON.stringify(DB.ticketById(model.id)));
                (data.tepQuaLon || []).forEach(function (ten) {
                    UI.toast('Tệp "' + ten + '" vượt quá 2MB.', "warn");
                });
                if (data.files.length) UI.toast("Đã đính kèm " + data.files.length + " tệp.", "success");
                render();
            }).catch(function (err) {
                UI.toast(err.message || "Không đính kèm được tệp.", "error");
            });
        }

        function renderFiles(suaDuoc) {
            var box = U.$("#fileList");
            if (!box) return;
            var files = model.files || [];

            if (!files.length) {
                box.innerHTML = '<p class="muted" style="text-align:center;padding:10px">Chưa có tệp đính kèm.</p>';
                return;
            }

            box.innerHTML = files.map(function (f) { return fileItemHTML(f, suaDuoc); }).join("");

            U.$$("[data-del-file]", box).forEach(function (b) {
                b.addEventListener("click", function () {
                    var fid = b.closest(".file-item").dataset.fid;
                    var f = files.filter(function (x) { return x.id === fid; })[0];
                    UI.confirm({
                        title: "Xoá tệp đính kèm",
                        html: 'Xoá tệp <b>' + U.esc(f ? f.ten : "") + '</b> khỏi phiếu yêu cầu?',
                        okText: "Xoá tệp",
                        danger: true
                    }, function () {
                        if (isNew || (f && f._rawFile)) {
                            /* Chưa tải lên máy chủ - chỉ bỏ khỏi danh sách cục bộ */
                            model.files = model.files.filter(function (x) { return x.id !== fid; });
                            render();
                            UI.toast("Đã xoá tệp đính kèm.", "success");
                            return;
                        }
                        DB.removeTicketFile(model.id, fid).then(function () {
                            model.files = model.files.filter(function (x) { return x.id !== fid; });
                            render();
                            UI.toast("Đã xoá tệp đính kèm.", "success");
                        }).catch(function (err) {
                            UI.toast(err.message || "Không xoá được tệp.", "error");
                        });
                    });
                });
            });
        }
    }

    /* =====================================================
       11. TRANG PHÒNG BAN (chỉ admin)
       ===================================================== */
    function pageDept() {
        var user = Layout.mount("phong", "Phòng ban");
        if (!user) return;
        if (!Perm.isAdmin(user)) { denyAccess(); return; }

        var q = "";

        U.$("#btnAddDept").addEventListener("click", function () { deptModal(null); });
        U.$("#fSearchDept").addEventListener("input", U.debounce(function () {
            q = this.value.trim(); render();
        }, 250));

        render();

        function render() {
            var kw = U.noAccent(q);
            var list = DB.depts().filter(function (d) {
                return !kw || U.noAccent(d.maPhong + " " + d.tenPhong + " " + (d.truongPhong || "")).indexOf(kw) >= 0;
            });
            var tickets = DB.tickets(), users = DB.users();
            var body = U.$("#deptBody");

            if (!list.length) {
                body.innerHTML = '<tr><td colspan="6"><div class="empty-state">' +
                    '<div class="em-ico">🏢</div><h4>Chưa có phòng ban nào</h4>' +
                    '<p>Bấm "Thêm phòng" để tạo mới.</p></div></td></tr>';
            } else {
                body.innerHTML = list.map(function (d) {
                    var nhanSu = users.filter(function (u) { return u.maPhong === d.maPhong; }).length;
                    var phieu = tickets.filter(function (t) { return t.phongThucHien === d.maPhong; }).length;
                    return '<tr class="row-anim" data-id="' + d.id + '">' +
                        '<td><span class="code">' + U.esc(d.maPhong) + '</span></td>' +
                        '<td><div style="font-weight:600">' + U.esc(d.tenPhong) + '</div>' +
                        '<div class="sub">' + U.esc(d.ghiChu || "") + '</div></td>' +
                        '<td>' + U.esc(d.truongPhong || "--") + '</td>' +
                        '<td class="text-center"><span class="badge badge-soft">' + nhanSu + ' người</span></td>' +
                        '<td class="text-center"><span class="badge badge-di">' + phieu + ' phiếu</span></td>' +
                        '<td><div class="actions">' +
                        '<button class="icon-btn" data-act="edit" title="Sửa">✎</button>' +
                        '<button class="icon-btn danger" data-act="del" title="Xoá">🗑</button>' +
                        '</div></td></tr>';
                }).join("");
            }

            U.$("#deptCount").textContent = list.length;

            U.$$("#deptBody button[data-act]").forEach(function (b) {
                b.addEventListener("click", function () {
                    var id = b.closest("tr").dataset.id;
                    var d = DB.depts().filter(function (x) { return x.id === id; })[0];
                    if (!d) return;

                    if (b.dataset.act === "edit") { deptModal(d); return; }

                    var dung = DB.users().some(function (u) { return u.maPhong === d.maPhong; }) ||
                        DB.tickets().some(function (t) {
                            return t.phongThucHien === d.maPhong || t.donViYeuCau === d.maPhong;
                        });

                    if (dung) {
                        UI.toast("Không thể xoá: phòng đang được dùng ở nhân viên hoặc phiếu yêu cầu.", "error");
                        return;
                    }
                    UI.confirm({
                        title: "Xoá phòng ban",
                        html: 'Xoá phòng <b>' + U.esc(d.maPhong) + ' - ' + U.esc(d.tenPhong) + '</b>?',
                        okText: "Xoá phòng",
                        danger: true
                    }, function () {
                        DB.deleteDept(d.maPhong).then(function () {
                            render();
                            UI.toast("Đã xoá phòng ban.", "success");
                        }).catch(function (err) {
                            UI.toast(err.message || "Không xoá được phòng ban.", "error");
                        });
                    });
                });
            });
        }

        function deptModal(dept) {
            var edit = !!dept;
            var d = dept || { maPhong: "", tenPhong: "", truongPhong: "", ghiChu: "" };

            UI.modal({
                title: edit ? "Sửa thông tin phòng" : "Thêm phòng mới",
                body: '<form id="frmDept" novalidate>' +
                    '<div class="form-row">' +
                    '<div class="form-group"><label>Mã phòng <span class="req">*</span></label>' +
                    '<input type="text" name="maPhong" class="form-control" placeholder="vd: P.CNTT" value="' +
                    U.esc(d.maPhong) + '"><div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Trưởng phòng</label>' +
                    '<input type="text" name="truongPhong" class="form-control" value="' + U.esc(d.truongPhong) + '"></div>' +
                    '</div>' +
                    '<div class="form-group"><label>Tên phòng <span class="req">*</span></label>' +
                    '<input type="text" name="tenPhong" class="form-control" placeholder="vd: Phòng Công nghệ thông tin" value="' +
                    U.esc(d.tenPhong) + '"><div class="field-error"></div></div>' +
                    '<div class="form-group mb-0"><label>Ghi chú</label>' +
                    '<input type="text" name="ghiChu" class="form-control" value="' + U.esc(d.ghiChu || "") + '"></div>' +
                    '</form>',
                footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                    '<button type="button" class="btn btn-primary" id="btnSaveDept">' +
                    (edit ? "Lưu thay đổi" : "Thêm phòng") + '</button>',
                onMount: function (root) {
                    U.$("#btnSaveDept", root).addEventListener("click", function () {
                        var f = U.$("#frmDept", root);
                        UI.clearErrors(f);
                        var ma = f.maPhong.value.trim().toUpperCase();
                        var ten = f.tenPhong.value.trim();
                        var ok = true;

                        if (!ma) { UI.setError(f.maPhong, "Vui lòng nhập mã phòng."); ok = false; }
                        if (!ten) { UI.setError(f.tenPhong, "Vui lòng nhập tên phòng."); ok = false; }

                        var list = DB.depts();
                        var trung = list.some(function (x) {
                            return x.maPhong.toUpperCase() === ma && (!edit || x.id !== d.id);
                        });
                        if (ok && trung) { UI.setError(f.maPhong, "Mã phòng đã tồn tại."); ok = false; }
                        if (!ok) return;

                        /* Đổi mã phòng (nếu có) sẽ được máy chủ tự đồng bộ sang
                           nhân viên và phiếu yêu cầu (ON UPDATE CASCADE). */
                        var payload = {
                            maPhong: ma, tenPhong: ten,
                            truongPhong: f.truongPhong.value.trim(), ghiChu: f.ghiChu.value.trim()
                        };
                        var btnSave = this;
                        UI.loading(btnSave, true, "Đang lưu...");

                        var viec = edit ? DB.updateDept(d.maPhong, payload) : DB.createDept(payload);
                        viec.then(function () {
                            UI.closeModal();
                            render();
                            UI.toast(edit ? "Đã cập nhật phòng ban." : "Đã thêm phòng " + ma + ".", "success");
                        }).catch(function (err) {
                            UI.loading(btnSave, false);
                            UI.toast(err.message || "Không lưu được phòng ban.", "error");
                        });
                    });
                }
            });
        }
    }

    /* =====================================================
       12. TRANG LOẠI YÊU CẦU (chỉ admin)
       ===================================================== */
    function pageLoai() {
        var user = Layout.mount("loai-yeu-cau", "Loại yêu cầu");
        if (!user) return;
        if (!Perm.isAdmin(user)) { denyAccess(); return; }

        var q = "";

        U.$("#btnAddLoai").addEventListener("click", function () { loaiModal(null); });
        U.$("#fSearchLoai").addEventListener("input", U.debounce(function () {
            q = this.value.trim(); render();
        }, 250));

        render();

        function render() {
            var kw = U.noAccent(q);
            var list = DB.loaiList().filter(function (l) {
                return !kw || U.noAccent(l.id + " " + l.ten + " " + (l.moTa || "")).indexOf(kw) >= 0;
            });
            var tickets = DB.tickets();
            var body = U.$("#loaiBody");

            if (!list.length) {
                body.innerHTML = '<tr><td colspan="5"><div class="empty-state">' +
                    '<div class="em-ico">🏷</div><h4>Chưa có loại yêu cầu nào</h4>' +
                    '<p>Bấm "Thêm loại yêu cầu" để tạo mới.</p></div></td></tr>';
            } else {
                body.innerHTML = list.map(function (l) {
                    var dung = tickets.filter(function (t) { return t.loaiPYC === l.id; }).length;
                    return '<tr class="row-anim" data-id="' + U.esc(l.id) + '">' +
                        '<td><span class="code">' + U.esc(l.id) + '</span></td>' +
                        '<td><div style="font-weight:600">' + U.esc(l.ten) + '</div></td>' +
                        '<td>' + U.esc(l.moTa || "--") + '</td>' +
                        '<td class="text-center"><span class="badge badge-di">' + dung + ' phiếu</span></td>' +
                        '<td><div class="actions">' +
                        '<button class="icon-btn" data-act="edit" title="Sửa">✎</button>' +
                        '<button class="icon-btn danger" data-act="del" title="Xoá">🗑</button>' +
                        '</div></td></tr>';
                }).join("");
            }

            U.$("#loaiCount").textContent = list.length;

            U.$$("#loaiBody button[data-act]").forEach(function (b) {
                b.addEventListener("click", function () {
                    var id = b.closest("tr").dataset.id;
                    var l = DB.loaiList().filter(function (x) { return x.id === id; })[0];
                    if (!l) return;

                    if (b.dataset.act === "edit") { loaiModal(l); return; }

                    if (DB.tickets().some(function (t) { return t.loaiPYC === l.id; })) {
                        UI.toast("Không thể xoá: loại yêu cầu đang được dùng ở phiếu yêu cầu.", "error");
                        return;
                    }
                    UI.confirm({
                        title: "Xoá loại yêu cầu",
                        html: 'Xoá loại <b>' + U.esc(l.ten) + '</b>?',
                        okText: "Xoá loại yêu cầu",
                        danger: true
                    }, function () {
                        DB.deleteLoai(id).then(function () {
                            render();
                            UI.toast("Đã xoá loại yêu cầu.", "success");
                        }).catch(function (err) {
                            UI.toast(err.message || "Không xoá được loại yêu cầu.", "error");
                        });
                    });
                });
            });
        }

        function loaiModal(loai) {
            var edit = !!loai;
            var l = loai || { id: "", ten: "", moTa: "" };

            UI.modal({
                title: edit ? "Sửa loại yêu cầu" : "Thêm loại yêu cầu",
                body: '<form id="frmLoai" novalidate>' +
                    '<div class="form-group"><label>Mã loại <span class="req">*</span></label>' +
                    '<input type="text" name="ma" class="form-control" placeholder="vd: muasam" value="' +
                    U.esc(l.id) + '">' +
                    '<div class="muted" style="font-size:12px;margin-top:4px">Chữ thường không dấu, không khoảng trắng (2-20 ký tự).</div>' +
                    '<div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Tên loại yêu cầu <span class="req">*</span></label>' +
                    '<input type="text" name="ten" class="form-control" placeholder="vd: Mua sắm tài sản" value="' +
                    U.esc(l.ten) + '"><div class="field-error"></div></div>' +
                    '<div class="form-group mb-0"><label>Mô tả</label>' +
                    '<textarea name="moTa" class="form-control" rows="3">' + U.esc(l.moTa || "") + '</textarea></div>' +
                    '</form>',
                footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                    '<button type="button" class="btn btn-primary" id="btnSaveLoai">' +
                    (edit ? "Lưu thay đổi" : "Thêm loại yêu cầu") + '</button>',
                onMount: function (root) {
                    U.$("#btnSaveLoai", root).addEventListener("click", function () {
                        var f = U.$("#frmLoai", root);
                        UI.clearErrors(f);
                        var ma = U.noAccent(f.ma.value.trim()).replace(/[^a-z0-9_]/g, "");
                        var ten = f.ten.value.trim();
                        var ok = true;

                        if (ma.length < 2 || ma.length > 20) {
                            UI.setError(f.ma, "Mã loại gồm 2-20 ký tự chữ thường, số hoặc gạch dưới."); ok = false;
                        }
                        if (!ten) { UI.setError(f.ten, "Vui lòng nhập tên loại yêu cầu."); ok = false; }

                        var list = DB.loaiList();
                        var trung = list.some(function (x) { return x.id === ma && (!edit || x.id !== l.id); });
                        if (ok && trung) { UI.setError(f.ma, "Mã loại đã tồn tại."); ok = false; }
                        if (!ok) return;

                        /* Đổi mã loại (nếu có) sẽ được máy chủ tự đồng bộ sang
                           các phiếu đang dùng (ON UPDATE CASCADE). */
                        var payload = { ma: ma, ten: ten, moTa: f.moTa.value.trim() };
                        var btnSave = this;
                        UI.loading(btnSave, true, "Đang lưu...");

                        var viec = edit ? DB.updateLoai(l.id, payload) : DB.createLoai(payload);
                        viec.then(function () {
                            UI.closeModal();
                            render();
                            UI.toast(edit ? "Đã cập nhật loại yêu cầu." : "Đã thêm loại yêu cầu.", "success");
                        }).catch(function (err) {
                            UI.loading(btnSave, false);
                            UI.toast(err.message || "Không lưu được loại yêu cầu.", "error");
                        });
                    });
                }
            });
        }
    }

    /* =====================================================
       13. TRANG NHÂN VIÊN (chỉ admin)
       ===================================================== */
    function pageStaff() {
        var user = Layout.mount("nhan-vien", "Nhân viên");
        if (!user) return;
        if (!Perm.isAdmin(user)) { denyAccess(); return; }

        var q = "", fPhong = "", fChuc = "";

        U.$("#fPhongNV").innerHTML = '<option value="">Tất cả phòng ban</option>' +
            optionList(DB.depts(), "", "maPhong", "tenPhong");
        U.$("#fChucDanh").innerHTML = '<option value="">Tất cả chức danh</option>' +
            optionList(DB.CHUC_DANH, "", "id", "ten");

        U.$("#btnAddStaff").addEventListener("click", function () { staffModal(null); });
        U.$("#fSearchNV").addEventListener("input", U.debounce(function () { q = this.value.trim(); render(); }, 250));
        U.$("#fPhongNV").addEventListener("change", function () { fPhong = this.value; render(); });
        U.$("#fChucDanh").addEventListener("change", function () { fChuc = this.value; render(); });

        render();

        function render() {
            var kw = U.noAccent(q);
            var list = DB.users().filter(function (u) {
                if (fPhong && u.maPhong !== fPhong) return false;
                if (fChuc && u.chucDanh !== fChuc) return false;
                if (kw && U.noAccent([u.username, u.hoTen, u.email, u.soDienThoai, u.maPhong].join(" ")).indexOf(kw) < 0) return false;
                return true;
            });

            var body = U.$("#staffBody");
            if (!list.length) {
                body.innerHTML = '<tr><td colspan="8"><div class="empty-state">' +
                    '<div class="em-ico">👥</div><h4>Không tìm thấy nhân viên</h4>' +
                    '<p>Hãy đổi bộ lọc hoặc thêm nhân viên mới.</p></div></td></tr>';
            } else {
                body.innerHTML = list.map(function (u) {
                    var phieu = DB.tickets().filter(function (t) { return t.nguoiThucHienUser === u.username; }).length;
                    var lopCD = u.chucDanh === "admin" ? "badge-den"
                        : u.chucDanh === "quanly" ? "badge-gold" : "badge-soft";
                    return '<tr class="row-anim" data-id="' + u.id + '">' +
                        '<td><div style="display:flex;align-items:center;gap:10px">' +
                        '<span class="avatar">' + U.esc(U.initials(u.hoTen)) + '</span>' +
                        '<div><div style="font-weight:600">' + U.esc(u.hoTen) + '</div>' +
                        '<div class="sub">@' + U.esc(u.username) + '</div></div></div></td>' +
                        '<td>' + U.esc(u.email) + '<div class="sub">' + U.esc(u.soDienThoai) + '</div></td>' +
                        '<td class="nowrap">' + U.esc(u.maPhong) + '<div class="sub">' + U.esc(DB.deptName(u.maPhong)) + '</div></td>' +
                        '<td><span class="badge ' + lopCD + '">' + U.esc(DB.label("CHUC_DANH", u.chucDanh)) + '</span></td>' +
                        '<td class="nowrap">' + U.esc(u.nguoiQuanLy ? DB.hoTen(u.nguoiQuanLy) : "--") +
                        (u.nguoiQuanLy ? '<div class="sub">@' + U.esc(u.nguoiQuanLy) + '</div>' : '') + '</td>' +
                        '<td class="text-center"><span class="badge badge-di">' + phieu + '</span></td>' +
                        '<td class="nowrap">' + U.fmtDate(u.ngayTao) + '</td>' +
                        '<td><div class="actions">' +
                        '<button class="icon-btn" data-act="edit" title="Sửa">✎</button>' +
                        '<button class="icon-btn danger" data-act="del" title="Xoá">🗑</button>' +
                        '</div></td></tr>';
                }).join("");
            }

            U.$("#staffCount").textContent = list.length;

            U.$$("#staffBody button[data-act]").forEach(function (b) {
                b.addEventListener("click", function () {
                    var id = b.closest("tr").dataset.id;
                    var u = DB.users().filter(function (x) { return x.id === id; })[0];
                    if (!u) return;

                    if (b.dataset.act === "edit") { staffModal(u); return; }

                    if (u.id === user.id) {
                        UI.toast("Không thể xoá tài khoản đang đăng nhập.", "error");
                        return;
                    }
                    var capDuoi = DB.users().filter(function (x) { return x.nguoiQuanLy === u.username; });
                    if (capDuoi.length) {
                        UI.toast("Không thể xoá: đang là người quản lý của " + capDuoi.length + " nhân viên.", "error");
                        return;
                    }
                    UI.confirm({
                        title: "Xoá nhân viên",
                        html: 'Xoá nhân viên <b>' + U.esc(u.hoTen) + '</b> (@' + U.esc(u.username) + ')?',
                        okText: "Xoá nhân viên",
                        danger: true
                    }, function () {
                        DB.deleteUser(id).then(function () {
                            render();
                            UI.toast("Đã xoá nhân viên.", "success");
                        }).catch(function (err) {
                            UI.toast(err.message || "Không xoá được nhân viên.", "error");
                        });
                    });
                });
            });
        }

        function staffModal(nv) {
            var edit = !!nv;
            var u = nv || {
                username: "", password: "", hoTen: "", email: "",
                maPhong: "", soDienThoai: "", chucDanh: "nhanvien", nguoiQuanLy: "", ngayTao: U.today()
            };

            /* Người quản lý: chọn trong nhóm cấp quản lý / admin, trừ chính mình */
            var dsQuanLy = DB.managers().filter(function (m) { return !edit || m.username !== u.username; });

            UI.modal({
                size: "lg",
                title: edit ? "Sửa thông tin nhân viên" : "Thêm nhân viên mới",
                body: '<form id="frmStaff" novalidate>' +
                    '<div class="form-row">' +
                    '<div class="form-group"><label>Tên đăng nhập <span class="req">*</span></label>' +
                    '<input type="text" name="username" class="form-control" value="' + U.esc(u.username) + '"' +
                    (edit ? " readonly" : "") + '><div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Mật khẩu ' + (edit ? '' : '<span class="req">*</span>') + '</label>' +
                    '<input type="text" name="password" class="form-control" value="' + U.esc(u.password) + '" ' +
                    'placeholder="' + (edit ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự") + '"><div class="field-error"></div></div>' +
                    '</div>' +

                    '<div class="form-row">' +
                    '<div class="form-group"><label>Họ và tên <span class="req">*</span></label>' +
                    '<input type="text" name="hoTen" class="form-control" value="' + U.esc(u.hoTen) + '"><div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Email <span class="req">*</span></label>' +
                    '<input type="email" name="email" class="form-control" value="' + U.esc(u.email) + '"><div class="field-error"></div></div>' +
                    '</div>' +

                    '<div class="form-row-3">' +
                    '<div class="form-group"><label>Mã phòng <span class="req">*</span></label>' +
                    '<select name="maPhong" class="form-control"><option value="">-- Chọn phòng --</option>' +
                    optionList(DB.depts(), u.maPhong, "maPhong", "tenPhong") + '</select><div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Số điện thoại <span class="req">*</span></label>' +
                    '<input type="tel" name="soDienThoai" class="form-control" value="' + U.esc(u.soDienThoai) + '" ' +
                    'placeholder="vd: 0901234567"><div class="field-error"></div></div>' +
                    '<div class="form-group"><label>Chức danh <span class="req">*</span></label>' +
                    '<select name="chucDanh" class="form-control">' +
                    optionList(DB.CHUC_DANH, u.chucDanh, "id", "ten") + '</select></div>' +
                    '</div>' +

                    '<div class="form-row">' +
                    '<div class="form-group"><label>Người quản lý nhân viên</label>' +
                    '<select name="nguoiQuanLy" class="form-control"><option value="">-- Không có --</option>' +
                    dsQuanLy.map(function (m) {
                        return '<option value="' + U.esc(m.username) + '"' +
                            (m.username === u.nguoiQuanLy ? " selected" : "") + '>' +
                            U.esc(m.hoTen + " (" + m.maPhong + " - " + DB.label("CHUC_DANH", m.chucDanh) + ")") +
                            '</option>';
                    }).join("") + '</select>' +
                    '<div class="muted" style="font-size:12px;margin-top:4px">Chọn trong nhóm cấp quản lý hoặc quản trị hệ thống.</div></div>' +
                    '<div class="form-group"><label>Ngày tạo</label>' +
                    '<input type="date" name="ngayTao" class="form-control" value="' + U.esc(u.ngayTao || U.today()) + '"></div>' +
                    '</div>' +
                    '</form>',
                footer: '<button type="button" class="btn btn-outline" data-close>Huỷ bỏ</button>' +
                    '<button type="button" class="btn btn-primary" id="btnSaveStaff">' +
                    (edit ? "Lưu thay đổi" : "Thêm nhân viên") + '</button>',
                onMount: function (root) {
                    U.$("#btnSaveStaff", root).addEventListener("click", function () {
                        var f = U.$("#frmStaff", root);
                        UI.clearErrors(f);
                        var ok = true;
                        var un = f.username.value.trim();

                        if (!un) { UI.setError(f.username, "Vui lòng nhập tên đăng nhập."); ok = false; }
                        else if (!edit && DB.userByName(un)) { UI.setError(f.username, "Tên đăng nhập đã tồn tại."); ok = false; }

                        if (!edit && f.password.value.length < 6) {
                            UI.setError(f.password, "Mật khẩu tối thiểu 6 ký tự."); ok = false;
                        } else if (edit && f.password.value && f.password.value.length < 6) {
                            UI.setError(f.password, "Mật khẩu tối thiểu 6 ký tự."); ok = false;
                        }

                        if (!f.hoTen.value.trim()) { UI.setError(f.hoTen, "Vui lòng nhập họ tên."); ok = false; }
                        if (!U.emailOK(f.email.value)) { UI.setError(f.email, "Email không hợp lệ."); ok = false; }
                        if (!f.maPhong.value) { UI.setError(f.maPhong, "Vui lòng chọn phòng ban."); ok = false; }
                        if (!U.phoneOK(f.soDienThoai.value)) {
                            UI.setError(f.soDienThoai, "Số điện thoại gồm 10-11 số, bắt đầu bằng 0."); ok = false;
                        }
                        if (!ok) return;

                        /* Họ tên hiển thị trên phiếu yêu cầu nay lấy trực tiếp từ
                           nhan_vien qua JOIN phía máy chủ, không cần tự đồng bộ. */
                        var payload = {
                            hoTen: f.hoTen.value.trim(), email: f.email.value.trim(),
                            maPhong: f.maPhong.value, soDienThoai: f.soDienThoai.value.trim(),
                            chucDanh: f.chucDanh.value, nguoiQuanLy: f.nguoiQuanLy.value,
                            ngayTao: f.ngayTao.value
                        };
                        if (f.password.value) payload.password = f.password.value;
                        if (!edit) payload.username = un;

                        var btnSave = this;
                        UI.loading(btnSave, true, "Đang lưu...");

                        var viec = edit ? DB.updateUser(u.username, payload) : DB.createUser(payload);
                        viec.then(function () {
                            UI.closeModal();
                            render();
                            UI.toast(edit ? "Đã cập nhật nhân viên." : "Đã thêm nhân viên mới.", "success");
                        }).catch(function (err) {
                            UI.loading(btnSave, false);
                            UI.toast(err.message || "Không lưu được nhân viên.", "error");
                        });
                    });
                }
            });
        }
    }

    function denyAccess() {
        var page = U.$(".page");
        if (!page) return;
        page.innerHTML = '<div class="card"><div class="empty-state">' +
            '<div class="em-ico">🔒</div><h4>Bạn không có quyền truy cập</h4>' +
            '<p>Menu cấu hình chỉ dành cho tài khoản <b>Quản trị hệ thống</b>.</p>' +
            '<a href="dashboard.html" class="btn btn-primary mt-16">Về trang chính</a></div></div>';
    }

    /* =====================================================
       14. ĐIỀU PHỐI THEO TRANG
       ===================================================== */
    var ROUTES = {
        login: pageLogin,
        dashboard: pageDashboard,
        detail: pageDetail,
        phong: pageDept,
        "loai-yeu-cau": pageLoai,
        "nhan-vien": pageStaff
    };

    document.addEventListener("DOMContentLoaded", function () {
        var page = document.body.dataset.page;
        if (!ROUTES[page]) return;

        if (page === "login") {
            /* Trang đăng nhập chưa có phiên làm việc nên không gọi được
               /api/bootstrap (cần đăng nhập) - tự kiểm tra riêng bên trong. */
            pageLogin();
            return;
        }

        /* Mọi trang còn lại: nạp toàn bộ dữ liệu cần thiết một lần rồi mới vẽ,
           để các hàm đọc (DB.tickets(), DB.users()...) dùng được ngay lập tức. */
        DB.ready().then(function () {
            ROUTES[page]();
        }).catch(function () {
            window.location.replace("index.html");
        });
    });

    /* Cho phép gọi từ console khi cần khôi phục dữ liệu mẫu */
    window.App = {
        U: U, UI: UI, Auth: Auth, Perm: Perm, Layout: Layout,
        reset: function () { DB.resetAll(); location.reload(); }
    };

})(window, document);
