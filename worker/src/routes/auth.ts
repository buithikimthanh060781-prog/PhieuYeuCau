// routes/auth.ts - Port 1:1 của blueprints/auth.py.
import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../lib/crypto";
import { first, run } from "../lib/db";
import { nhanVienToDict } from "../lib/serializers";
import { clearSessionCookie, currentUser, loginRequired, setSessionCookie } from "../middleware/auth";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(data.username ?? "").trim();
  const password = String(data.password ?? "");

  if (!username || !password) {
    return c.json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." }, 400);
  }

  const row = await first(
    c.env.DB,
    "SELECT username, password_hash, ho_ten, email, ma_phong, so_dien_thoai, chuc_danh, nguoi_quan_ly, ngay_tao " +
      "FROM nhan_vien WHERE username = ? COLLATE NOCASE",
    [username],
  );

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return c.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, 401);
  }

  await setSessionCookie(c, row.username);
  return c.json({ ok: true, user: nhanVienToDict(row) });
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = await currentUser(c);
  return c.json({ user });
});

authRoutes.post("/change-password", loginRequired(), async (c) => {
  const user = c.get("user");
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const mkCu = String(data.oldPassword ?? "");
  const mkMoi = String(data.newPassword ?? "");

  if (mkMoi.length < 6) {
    return c.json({ error: "Mật khẩu mới tối thiểu 6 ký tự." }, 400);
  }

  const row = await first<{ password_hash: string }>(
    c.env.DB,
    "SELECT password_hash FROM nhan_vien WHERE username = ?",
    [user.username],
  );
  if (!row || !(await verifyPassword(mkCu, row.password_hash))) {
    return c.json({ error: "Mật khẩu hiện tại không đúng." }, 400);
  }

  await run(c.env.DB, "UPDATE nhan_vien SET password_hash = ? WHERE username = ?", [
    await hashPassword(mkMoi),
    user.username,
  ]);
  return c.json({ ok: true });
});

authRoutes.post("/forgot-password/verify", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(data.username ?? "").trim();
  const email = String(data.email ?? "").trim();

  if (!username || !email) {
    return c.json({ error: "Vui lòng nhập đầy đủ thông tin." }, 400);
  }

  const row = await first<{ email: string }>(
    c.env.DB,
    "SELECT email FROM nhan_vien WHERE username = ? COLLATE NOCASE",
    [username],
  );
  if (!row || row.email.toLowerCase() !== email.toLowerCase()) {
    return c.json({ error: "Thông tin không khớp với tài khoản nào trong hệ thống." }, 404);
  }

  return c.json({ ok: true, email: row.email });
});

authRoutes.post("/forgot-password/reset", async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(data.username ?? "").trim();
  const email = String(data.email ?? "").trim();
  const mkMoi = String(data.newPassword ?? "");

  if (mkMoi.length < 6) {
    return c.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, 400);
  }

  const row = await first<{ username: string; email: string }>(
    c.env.DB,
    "SELECT username, email FROM nhan_vien WHERE username = ? COLLATE NOCASE",
    [username],
  );
  if (!row || row.email.toLowerCase() !== email.toLowerCase()) {
    return c.json({ error: "Thông tin không khớp với tài khoản nào trong hệ thống." }, 404);
  }

  await run(c.env.DB, "UPDATE nhan_vien SET password_hash = ? WHERE username = ?", [
    await hashPassword(mkMoi),
    row.username,
  ]);
  return c.json({ ok: true });
});
