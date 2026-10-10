// index.ts - Lắp ráp Hono app. Giao diện tĩnh (index.html, css/, js/...) do
// Cloudflare Workers Static Assets phục vụ trực tiếp TRƯỚC KHI chạm tới
// Worker này (xem [assets] trong wrangler.toml); mã dưới đây chỉ xử lý các
// request không khớp tệp tĩnh nào - tức toàn bộ /api/*.
import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { bootstrapRoutes } from "./routes/bootstrap";
import { danhMucRoutes } from "./routes/danhMuc";
import { devSeedRoutes } from "./routes/devSeed";
import { nhanVienRoutes } from "./routes/nhanVien";
import { phieuYeuCauRoutes } from "./routes/phieuYeuCau";
import { thongBaoRoutes } from "./routes/thongBao";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// Phòng trường hợp lớp Static Assets không tự map "/" -> index.html (bản
// Flask cũng redirect "/" sang "/index.html" thay vì serve thẳng).
app.get("/", (c) => c.redirect("/index.html"));

app.route("/api/auth", authRoutes);
app.route("/api", bootstrapRoutes);
app.route("/api", danhMucRoutes);
app.route("/api/nhan-vien", nhanVienRoutes);
app.route("/api", phieuYeuCauRoutes);
app.route("/api/thong-bao", thongBaoRoutes);
app.route("/api/_dev", devSeedRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
