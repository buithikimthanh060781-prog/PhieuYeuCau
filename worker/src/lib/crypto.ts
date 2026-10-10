// crypto.ts - Băm mật khẩu (PBKDF2-SHA256 qua Web Crypto, thay cho
// werkzeug.security của Flask) và ký/thẩm tra cookie session (thay cho
// flask.session, vốn là cookie ký tên bằng SECRET_KEY).
//
// Dùng chung được giữa Worker (runtime chính) và script tạo seed chạy bằng
// Node (xem scripts/), vì cả hai đều có sẵn Web Crypto API (crypto.subtle).

const PBKDF2_ITERATIONS = 100_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(matKhau: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(matKhau), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(matKhau: string, luuTruHash: string): Promise<boolean> {
  const parts = luuTruHash.split("$");
  if (parts.length !== 3) return false;
  const [header, saltB64, hashB64] = parts;
  const match = /^pbkdf2:sha256:(\d+)$/.exec(header);
  if (!match) return false;
  const iterations = parseInt(match[1], 10);
  const salt = fromBase64Url(saltB64);
  const expected = fromBase64Url(hashB64);

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(matKhau), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256),
  );
  if (bits.length !== expected.length) return false;
  // So sánh hằng thời gian - tránh lộ thông tin qua thời gian phản hồi.
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

// ---------------------------------------------------------------
// Cookie session ký tên: base64url(JSON payload) + "." + base64url(HMAC)
// ---------------------------------------------------------------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(payload: Record<string, unknown>, secret: string): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySession<T = Record<string, unknown>>(
  cookieValue: string,
  secret: string,
): Promise<T | null> {
  const idx = cookieValue.lastIndexOf(".");
  if (idx < 0) return null;
  const body = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, fromBase64Url(sig), new TextEncoder().encode(body));
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// Tệp: sanitize tên (tương đương werkzeug.secure_filename) + hậu tố ngẫu nhiên
// ---------------------------------------------------------------

export function secureFilename(ten: string): string {
  // Giữ chữ/số ASCII, '_', '.', '-'; thay mọi ký tự khác bằng '_'; bỏ dấu
  // chấm/gạch dưới dẫn đầu (tránh tên ẩn/đường dẫn tương đối kiểu "..").
  const sanitized = ten
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/^[._]+/, "");
  return sanitized || "";
}

export function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
