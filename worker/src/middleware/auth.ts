// auth.ts - Phiên đăng nhập bằng cookie ký tên (thay cho flask.session) +
// loginRequired/adminRequired (thay cho auth_helpers.py). Mọi request vẫn
// tải lại dòng nhân viên mới nhất từ D1 mỗi lần, giống current_user() gốc,
// nên sửa/xoá nhân viên có hiệu lực ngay, không phải chờ cookie hết hạn.
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { first } from "../lib/db";
import { nhanVienToDict } from "../lib/serializers";
import { signSession, verifySession } from "../lib/crypto";
import type { AppEnv, NhanVien } from "../types";

export const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 ngày - khớp "Ghi nhớ đăng nhập" phía giao diện

export async function setSessionCookie(c: Context<AppEnv>, username: string): Promise<void> {
  const value = await signSession({ username }, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, value, {
    httpOnly: true,
    // Chỉ "Secure" khi thực sự chạy qua HTTPS (luôn đúng trên Cloudflare
    // thật) - để lại false khi test bằng `wrangler dev` qua http://127.0.0.1,
    // nếu không trình duyệt (khác với curl) sẽ không gửi lại cookie.
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

const NHAN_VIEN_SELECT =
  "SELECT username, ho_ten, email, ma_phong, so_dien_thoai, chuc_danh, nguoi_quan_ly, ngay_tao FROM nhan_vien WHERE username = ?";

export async function currentUser(c: Context<AppEnv>): Promise<NhanVien | null> {
  const cookieValue = getCookie(c, COOKIE_NAME);
  if (!cookieValue) return null;

  const payload = await verifySession<{ username?: string }>(cookieValue, c.env.SESSION_SECRET);
  if (!payload?.username) return null;

  const row = await first(c.env.DB, NHAN_VIEN_SELECT, [payload.username]);
  if (!row) {
    clearSessionCookie(c); // tài khoản đã bị admin xoá nhưng cookie cũ vẫn còn
    return null;
  }
  return nhanVienToDict(row);
}

const PHIEN_HET_HAN = { error: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." };

export function loginRequired(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await currentUser(c);
    if (!user) return c.json(PHIEN_HET_HAN, 401);
    c.set("user", user);
    await next();
  };
}

export function adminRequired(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await currentUser(c);
    if (!user) return c.json(PHIEN_HET_HAN, 401);
    if (user.chucDanh !== "admin") {
      return c.json({ error: "Chức năng này chỉ dành cho tài khoản Quản trị hệ thống." }, 403);
    }
    c.set("user", user);
    await next();
  };
}
