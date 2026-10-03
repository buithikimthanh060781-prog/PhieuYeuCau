# Quản lý phiếu yêu cầu

Ứng dụng web quản lý **phiếu yêu cầu đi** và **phiếu yêu cầu đến** trong nội bộ đơn vị.
Giao diện HTML5 + CSS3 + JavaScript thuần (không cần build), backend **Flask + SQLite**
(`phieuyeucau.db`). Mật khẩu được băm, mọi quy tắc phân quyền được kiểm tra lại ở máy chủ
(không chỉ ẩn/hiện nút phía trình duyệt).

## Cách chạy

```powershell
py -m pip install -r requirements.txt
py -m flask --app app init-db      # chỉ chạy lần đầu: tạo bảng + nạp dữ liệu mẫu
py -m flask --app app run --debug  # rồi mở http://127.0.0.1:5000
```

Ứng dụng cần chạy qua Flask (không mở trực tiếp file `index.html` bằng trình duyệt được nữa) -
giao diện gọi API `/api/...` để lấy/lưu dữ liệu, và các file `.html`/`.css`/`.js` cũng do
chính Flask phục vụ ở đúng đường dẫn cũ (`/css/style.css`, `/js/main.js`...).

### Tài khoản dùng thử (mật khẩu đều là `123456`)

| Tên đăng nhập | Họ tên              | Phòng   | Chức danh           |
|---------------|---------------------|---------|---------------------|
| `admin`       | Quản trị hệ thống   | P.CNTT  | Quản trị hệ thống   |
| `baotq`       | Trần Quốc Bảo       | P.CNTT  | Cấp quản lý         |
| `thuntm`      | Nguyễn Thị Minh Thư | P.HCNS  | Cấp quản lý         |
| `dungnt`      | Ngô Tiến Dũng       | P.CNTT  | Thành viên          |
| `trangnt`     | Nguyễn Thị Trang    | P.CNTT  | Thành viên          |
| `lanvt`       | Vũ Thị Lan          | P.HCNS  | Thành viên          |

Các tài khoản khác: `namlh`, `hapt`, `khoava` (cấp quản lý), `hieult`, `phucnv` (thành viên).

## Cấu trúc thư mục

```
PhieuYeuCau/
├── index.html          # Trang đăng nhập (có chức năng quên mật khẩu)
├── dashboard.html      # Trang chính: dashboard thống kê + 2 tab danh sách phiếu
├── chi-tiet.html       # Trang phiếu yêu cầu chi tiết (xem / thêm / sửa / đính kèm)
├── phong.html          # Cấu hình phòng ban       (chỉ admin)
├── loai-yeu-cau.html   # Cấu hình loại yêu cầu    (chỉ admin)
├── nhan-vien.html      # Cấu hình nhân viên       (chỉ admin)
├── css/
│   └── style.css       # Toàn bộ giao diện, hiệu ứng, responsive
├── js/
│   ├── data.js         # Lớp gọi API /api/... + cache trong bộ nhớ (thay cho localStorage)
│   └── main.js         # Phân quyền (UI) + hiệu ứng + xử lý nghiệp vụ theo từng trang
├── data/
│   └── du-lieu-mau.json    # Mô tả cấu trúc dữ liệu (tài liệu tham chiếu)
├── filedinhkem/
│   └── README.txt          # Ghi chú về cách lưu tệp đính kèm
│
├── app.py              # Ứng dụng Flask: đăng ký blueprint + phục vụ HTML/CSS/JS tĩnh
├── blueprints/
│   ├── auth.py             # Đăng nhập / đăng xuất / đổi mật khẩu / quên mật khẩu
│   ├── bootstrap.py        # GET /api/bootstrap - toàn bộ dữ liệu cần khi tải 1 trang
│   ├── danh_muc.py         # CRUD phòng ban + loại yêu cầu (ghi: chỉ admin)
│   ├── nhan_vien.py        # CRUD nhân viên (chỉ admin)
│   └── phieu_yeu_cau.py    # CRUD phiếu, cập nhật tình trạng, tệp đính kèm
├── database.py          # Kết nối SQLite + lệnh CLI `flask init-db`
├── repo_phieu.py         # Câu lệnh SQL cho phiếu/lịch sử/tệp đính kèm + lưu tệp lên đĩa
├── serializers.py        # Đổi dòng SQLite -> JSON đúng hình dạng js/data.js cần
├── permissions.py        # Phân quyền THỰC SỰ có hiệu lực (bản dịch của Perm trong main.js)
├── auth_helpers.py       # Đọc session + decorator @login_required / @admin_required
├── schema.sql            # Cấu trúc 6 bảng của phieuyeucau.db
├── seed_data.py          # Dữ liệu mẫu (bản dịch Python của js/data.js) để nạp vào CSDL
├── constants.py          # Danh mục cố định (hướng, tình trạng, ưu tiên, chức danh)
├── requirements.txt       # Thư viện Python cần cài (Flask)
└── phieuyeucau.db         # CSDL (sinh ra sau khi chạy init-db, không đưa vào mã nguồn)
```

## Backend Flask + SQLite (`phieuyeucau.db`)

Toàn bộ nghiệp vụ (đăng nhập, danh sách phiếu đã lọc theo quyền, tạo/sửa/xoá, cập nhật
tình trạng, tệp đính kèm, cấu hình phòng/loại/nhân viên) chạy qua các route Flask dưới
tiền tố `/api/...`, có kiểm tra quyền và xác thực ở **máy chủ** - không chỉ dựa vào việc
ẩn nút trên giao diện. `js/data.js` gọi các API này qua `fetch()`, giữ một bản sao trong
bộ nhớ (cache) để những hàm đọc như `DB.tickets()`, `DB.users()` vẫn trả về ngay lập tức
(đồng bộ) như trước - nhờ vậy phần hiển thị/tương tác trong `js/main.js` hầu như giữ
nguyên, chỉ những chỗ thực sự cần đợi máy chủ (đăng nhập, lưu, tải tệp...) mới dùng
`Promise`/`.then()`.

### Cài đặt và khởi tạo

```powershell
py -m pip install -r requirements.txt
py -m flask --app app init-db      # tạo 6 bảng theo schema.sql + nạp dữ liệu mẫu
py -m flask --app app run --debug  # chạy tại http://127.0.0.1:5000
```

Lệnh `init-db` an toàn khi chạy lại nhiều lần (dùng để **khôi phục dữ liệu mẫu ban đầu**
bất cứ lúc nào): nó xoá và tạo lại toàn bộ bảng (theo đúng thứ tự con trước - cha sau để
không vi phạm khoá ngoại), sau đó nạp lại dữ liệu mẫu như lần đầu.

### Sáu bảng dữ liệu (`schema.sql`)

Mỗi bảng tương ứng 1:1 với một thực thể đang lưu trong `localStorage` của bản demo:

| Bảng               | Tương ứng trong `js/data.js`      | Khoá chính        |
|--------------------|-----------------------------------|-------------------|
| `phong_ban`        | `pyc_departments` (SEED_DEPTS)    | `ma_phong`        |
| `loai_yeu_cau`     | `pyc_loaiyeucau` (SEED_LOAI)      | `ma_loai`         |
| `nhan_vien`        | `pyc_users` (SEED_USERS)          | `username`        |
| `phieu_yeu_cau`    | `pyc_tickets` (SEED_TICKETS)      | `id` (tự tăng)    |
| `lich_su_xu_ly`    | mảng `lichSu[]` gắn trong mỗi phiếu | `id` (tự tăng)  |
| `tep_dinh_kem`     | mảng `files[]` (của phiếu và của từng mốc lịch sử) | `id` (tự tăng) |

Vài quyết định thiết kế khác so với bản demo JS thuần:

- **Không lưu tên hiển thị trùng lặp.** Bản demo lưu cả `nguoiTao`/`nguoiThucHien`
  (họ tên) lẫn `nguoiTaoUser`/`nguoiThucHienUser` (username) trong mỗi phiếu. CSDL chỉ
  giữ username (khoá ngoại tới `nhan_vien`) - họ tên lấy qua `JOIN`, tránh lệch dữ liệu
  khi nhân viên đổi tên.
- **Mật khẩu được băm** (`werkzeug.security.generate_password_hash`), không lưu thô
  "123456" như bản demo trình duyệt.
- **Tệp đính kèm chỉ lưu đường dẫn** (`duong_dan`), không lưu nội dung tệp dạng Data URL
  như bản demo - khớp với khuyến nghị đã ghi sẵn trong `filedinhkem/README.txt`.
- **Danh mục cố định** (hướng, tình trạng, ưu tiên, chức danh) không có bảng riêng - đây
  là hằng số nghiệp vụ, không phải dữ liệu người dùng thêm/sửa/xoá (khác với "loại yêu
  cầu", vốn có bảng vì cấu hình được). Chúng nằm trong `constants.py`.
- **Không có bảng phiên đăng nhập** - Flask dùng `flask.session` (cookie ký tên) để quản
  lý phiên làm việc, đây là trạng thái tạm thời chứ không phải dữ liệu cần lưu trữ.
- Khoá ngoại được bật (`PRAGMA foreign_keys = ON`) và có `ON DELETE CASCADE` từ
  `phieu_yeu_cau` xuống `lich_su_xu_ly`/`tep_dinh_kem`: xoá một phiếu sẽ tự xoá lịch sử
  và tệp đính kèm của phiếu đó, giống hành vi của bản demo JS (dữ liệu lồng nhau biến
  mất cùng phiếu cha).

## Phân quyền

Hệ thống có ba chức danh: **Thành viên** (`nhanvien`), **Cấp quản lý** (`quanly`),
**Quản trị hệ thống** (`admin`).

### Phạm vi dữ liệu nhìn thấy

| Chức danh         | Nhìn thấy những phiếu nào                                                       |
|-------------------|---------------------------------------------------------------------------------|
| Thành viên        | Phiếu do mình tạo **hoặc** do mình thực hiện                                     |
| Cấp quản lý       | Phiếu do nhân sự trong phòng mình tạo **hoặc** phiếu do phòng mình thực hiện     |
| Quản trị hệ thống | Toàn bộ phiếu trong hệ thống                                                     |

Phạm vi này áp dụng đồng thời cho lưới danh sách, số đếm trên sidebar, dashboard và
trang chi tiết (mở phiếu ngoài phạm vi sẽ báo không có quyền xem).

### Luồng tình trạng theo vai trò

```
Mới tạo -> Đang xử lý -> Chờ quản lý duyệt -> Chờ duyệt -> Hoàn thành (KẾT THÚC)
   |                          ^                    |
   |                          └──── Đang xử lý <───┴─ Từ chối (KHÔNG kết thúc)
   └─> Từ chối tiếp nhận (KẾT THÚC, quản lý phòng từ chối ngay từ đầu)
```

| Vai trò với phiếu                              | Sửa/Xoá | Cập nhật tình trạng được phép chuyển sang                     | Đính kèm            |
|-------------------------------------------------|---------|----------------------------------------------------------------|---------------------|
| Người tạo phiếu                                  | Có      | Hoàn thành (kết thúc), Từ chối (trả về Đang xử lý, không kết thúc) | Tệp hồ sơ của phiếu |
| Người thực hiện - chức danh Thành viên           | Không   | Đang xử lý, Chờ quản lý duyệt (không được gửi thẳng người tạo)     | Bằng chứng xử lý    |
| Người thực hiện - chức danh Cấp quản lý/Admin (tự làm) | Không | Đang xử lý, Chờ duyệt (bỏ qua bước quản lý duyệt)                | Bằng chứng xử lý    |
| Quản lý phòng thực hiện (hoặc admin)             | Không   | Chờ duyệt (đồng ý, gửi người tạo), Đang xử lý (từ chối, trả người thực hiện làm lại) | Bằng chứng xử lý |
| Không giữ vai trò nào                            | Không   | Không                                                            | Không               |

Phiếu **Hoàn thành** và **Từ chối tiếp nhận** là trạng thái kết thúc - không ai (kể cả admin) còn
cập nhật tình trạng được nữa. **Từ chối** (ở bước Chờ duyệt) ngược lại KHÔNG kết thúc: phiếu quay
về Đang xử lý, giữ nguyên người thực hiện, để làm lại và gửi duyệt lại từ đầu.

**Phân công người thực hiện** là thao tác riêng, độc lập với đổi tình trạng: quản lý của phòng
thực hiện (hoặc admin) chọn/đổi nhân sự thực hiện ngay trên trang chi tiết phiếu (khối "Người
thực hiện"), không cần mở hộp thoại xử lý. Thành viên tạo phiếu **không** được tự chọn người
thực hiện (kể cả khi tạo lẫn khi sửa phiếu); Cấp quản lý tạo phiếu chỉ được tự chọn khi phòng
thực hiện là phòng của chính họ (phòng khác thì để trống, quản lý phòng đó phân công sau); Admin
luôn được chọn với mọi phòng.

**Hai hành động từ chối riêng** (đều bắt buộc nhập lý do, tách khỏi hộp thoại xử lý chính):
- **❌ Từ chối tiếp nhận** - quản lý phòng thực hiện (hoặc admin) từ chối thẳng khi phiếu còn
  "Mới tạo" (nút cạnh "Phân công" trong khối "Người thực hiện") -> "Từ chối tiếp nhận" (KẾT THÚC).
- **🙅 Từ chối thực hiện** - người đang được phân công tự từ chối (bận việc khác...) trước khi gửi
  quản lý duyệt -> tình trạng phiếu **giữ nguyên**, chỉ bỏ chọn người thực hiện để quản lý phòng
  phân công lại.

Tình trạng không sửa trực tiếp trong biểu mẫu mà chỉ đổi qua nút xử lý chính (nhãn đổi theo đúng
bước hiện tại: **▶ Bắt đầu xử lý** / **📤 Gửi duyệt** cho người thực hiện, **🔍 Duyệt kết quả**
cho quản lý phòng, **✅ Xác nhận kết quả** cho người tạo phiếu), để mỗi lần đổi đều được ghi vào
lịch sử xử lý kèm người thực hiện, ghi chú và bằng chứng. Mở lại hộp thoại này khi bước hiện tại
đã có bằng chứng sẽ hiện lại đầy đủ các tệp đã đính kèm, cho phép xoá bớt hoặc bổ sung thêm
trước khi lưu.

### Menu cấu hình

Chỉ hiển thị với chức danh **Quản trị hệ thống**, gồm ba trang: Phòng ban, Loại yêu cầu,
Nhân viên. Tài khoản khác gõ thẳng URL cũng bị chặn.

## Chức năng chính

**Đăng nhập** — kiểm tra tên đăng nhập/mật khẩu, ghi nhớ đăng nhập, hiện/ẩn mật khẩu,
quên mật khẩu (đối chiếu username + email rồi cho đặt lại mật khẩu).

**Trang chính**
- Hiển thị họ tên người đăng nhập, xem thông tin cá nhân, đổi mật khẩu, đăng xuất.
- Dashboard đổi theo chức danh:
  - *Quản trị hệ thống*: số liệu toàn hệ thống, biểu đồ theo loại yêu cầu và theo phòng thực hiện.
  - *Cấp quản lý*: số liệu trong phạm vi phòng, thêm biểu đồ **theo từng nhân viên trong phòng**
    (hiển thị số phiếu liên quan, tách rõ bao nhiêu phiếu thực hiện / bao nhiêu phiếu tạo).
  - *Thành viên*: số liệu phiếu do mình tạo và do mình thực hiện, kèm biểu đồ phân bổ của riêng mình.
- Hai tab **Phiếu yêu cầu đi** / **Phiếu yêu cầu đến**, lưới có các cột: mã PYC, loại yêu cầu,
  nội dung, **phòng yêu cầu**, **người yêu cầu**, phòng/người thực hiện, ngày yêu cầu,
  thời hạn, tình trạng. Có tìm kiếm (bỏ dấu tiếng Việt), lọc, sắp xếp theo cột và phân trang.
- Nút thao tác trên từng dòng chỉ hiện đúng những gì người dùng được phép làm.

**Phiếu yêu cầu chi tiết** — loại PYC, mã PYC (tự sinh `YCD-2026-0001` / `YCN-...`),
đơn vị/phòng yêu cầu, ngày yêu cầu, thời hạn, độ ưu tiên, nội dung, phòng thực hiện,
người thực hiện (lọc theo phòng đã chọn), tình trạng, lịch sử xử lý dạng timeline,
khu vực tệp đính kèm và khu vực bằng chứng xử lý.
Ô **Tóm tắt** liệt kê luôn danh sách tệp đính kèm và bằng chứng (bấm vào để tải xuống).

**Cấu hình** (chỉ admin)
- *Phòng ban*: mã phòng, tên phòng, trưởng phòng, ghi chú. Đổi mã phòng tự đồng bộ sang
  nhân viên và phiếu yêu cầu; không cho xoá phòng đang được sử dụng.
- *Loại yêu cầu*: thêm / sửa / xoá loại yêu cầu (mã loại, tên, mô tả). Đổi mã loại tự đồng bộ
  sang các phiếu đang dùng; không cho xoá loại đang được sử dụng.
- *Nhân viên*: username, password, họ tên, email, mã phòng, số điện thoại,
  chức danh (thành viên / cấp quản lý / quản trị hệ thống), **người quản lý nhân viên**
  (chọn trong nhóm cấp quản lý hoặc admin) và ngày tạo.

## Tuỳ biến hiển thị

**Ẩn / hiện menu** — nút &#9776; ở góc trái thanh trên cùng, hiển thị ở mọi kích thước màn hình:

- Màn hình lớn: bấm để thu gọn hẳn menu, vùng nội dung mở rộng toàn màn hình; bấm lần nữa để hiện lại.
- Màn hình nhỏ (dưới 860px): menu trượt ra đè lên nội dung kèm lớp nền mờ, bấm ra ngoài để đóng.

Header là một thanh **cố định suốt chiều ngang màn hình** (`position: fixed`, nằm trên cả menu),
nền sáng (trắng chuyển nhẹ sang `#F6FAFE`, viền dưới mảnh và đổ bóng nhẹ). Vì header không nằm
trong vùng nội dung nên **bấm ☰ chỉ trượt menu bên dưới, header đứng yên không co giãn**.

Bố cục theo kiểu cổng quản trị: trái là định danh, giữa là tra cứu, phải là thông báo và tài khoản.

| Vùng  | Thành phần                                                                         |
|-------|------------------------------------------------------------------------------------|
| Trái  | Nút ☰ · logo "PYC" · tên ứng dụng (bấm về trang chính) · vạch ngăn · **tên trang đang xem** |
| Giữa  | **Ô tìm nhanh** — gõ từ khoá rồi Enter                                              |
| Phải  | **Chuông thông báo** kèm số phiếu cần chú ý · chip người dùng                        |

- *Tên trang đang xem* giúp biết vị trí kể cả khi menu đang ẩn; đồng thời được ghi vào
  `document.title` ("Trang chính | Quản lý phiếu yêu cầu").
- *Ô tìm nhanh*: ở trang chính lọc thẳng tại chỗ (qua `Layout.onQuickSearch`), ở trang khác thì
  chuyển về `dashboard.html?q=...`. Ẩn khi màn hình dưới 1180px.
- *Chuông thông báo* (`Layout.taiChuong`, bảng `thong_bao`) hiển thị các thông báo **CHƯA XEM**
  của riêng người dùng hiện tại - sinh ra mỗi khi tình trạng phiếu đổi hoặc khi phân công người
  thực hiện, gửi tới người tạo phiếu + người thực hiện + quản lý phòng thực hiện (trừ người vừa
  thao tác). Bấm vào một thông báo hoặc "Đánh dấu tất cả đã đọc" sẽ đánh dấu đã xem, thông báo đó
  biến mất khỏi chuông (không xoá lịch sử, chỉ ẩn khỏi danh sách chưa xem).
- Màu chữ, nút, avatar khai báo qua bộ biến CSS `--tb-*` trên `.topbar` nên đổi màu chỉ sửa một chỗ.

Tên ứng dụng đã nằm trên header nên menu bỏ khối logo ở đầu, chỉ còn danh sách điều hướng.

Trạng thái được ghi nhớ (`localStorage: pyc_menu`) và áp dụng cho mọi trang. Mỗi trang có sẵn
một đoạn script nhỏ ngay đầu `<body>` để khôi phục trạng thái trước khi vẽ, tránh giật layout.

**Ẩn / hiện dashboard** — thanh "Bảng thống kê tổng quan" trên trang chính có nút với biểu tượng
mũi tên (xoay 90° khi thu gọn) để ẩn/hiện toàn bộ thẻ thống kê và biểu đồ, nhường chỗ cho lưới
danh sách phiếu. Trạng thái cũng được ghi nhớ (`localStorage: pyc_dashboard`).

## Giao diện

Tông màu xanh navy – xanh dương lấy cảm hứng từ acb.com.vn (`--acb-navy #00285F`,
`--acb-blue #0057A4`), khai báo tập trung bằng biến CSS ở đầu `style.css`.
Bố cục responsive theo 4 điểm ngắt (1200px / 992px / 860px / 640px): dưới 860px
sidebar chuyển thành menu trượt, dưới 640px các biểu mẫu và thẻ thống kê xếp thành một cột.
Có sẵn định dạng khi in (`@media print`).

## Ghi chú kỹ thuật

- **Khôi phục dữ liệu mẫu ban đầu**: chạy lại `py -m flask --app app init-db` (xoá sạch
  và nạp lại 5 phòng ban / 7 loại yêu cầu / 11 nhân viên / 15 phiếu mẫu). `App.reset()`
  trong Console trình duyệt giờ chỉ tải lại trang, không còn xoá được dữ liệu (dữ liệu
  nằm ở máy chủ, không phải localStorage).
- **Cập nhật CSDL đã có sẵn** (không muốn xoá dữ liệu thật đang có) khi thêm trạng thái
  `choqlyduyet` hoặc bảng `thong_bao`: chạy `py -m flask --app app migrate-status` - an
  toàn để chạy nhiều lần, tự bỏ qua phần đã áp dụng, không đụng tới dữ liệu hiện có.
- Các khoá `localStorage` còn lại chỉ phục vụ **tuỳ biến giao diện phía trình duyệt**
  (không phải dữ liệu nghiệp vụ): `pyc_menu` (ẩn/hiện menu), `pyc_dashboard` (ẩn/hiện
  thống kê), `pyc_remember` (ghi nhớ tên đăng nhập).
- Bằng chứng đính kèm được gắn vào từng dòng `lich_su_xu_ly`, nên luôn biết được bằng
  chứng thuộc lần chuyển tình trạng nào (bảng `tep_dinh_kem`, cột `lich_su_id`).
- Tệp tải lên được lưu vật lý dưới `filedinhkem/<mã phiếu>/<mã ngẫu nhiên>_<tên gốc>`;
  tải xuống chỉ qua route có kiểm tra quyền xem phiếu (`GET /api/tep-dinh-kem/<id>/tai-xuong`),
  không có đường dẫn tĩnh công khai nào tới thư mục này.
- Mật khẩu được băm bằng `werkzeug.security.generate_password_hash`; đăng nhập, đổi mật
  khẩu và quên mật khẩu đều xác thực ở máy chủ.
- `SECRET_KEY` trong `app.py` hiện đặt tạm là `"dev"` - **phải đổi thành giá trị bí mật
  thật** (đọc từ biến môi trường) trước khi triển khai thật.
