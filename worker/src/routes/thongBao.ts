// routes/thongBao.ts - Port 1:1 của blueprints/thong_bao.py.
import { Hono } from "hono";
import { all, run } from "../lib/db";
import { thongBaoToDict } from "../lib/serializers";
import { loginRequired } from "../middleware/auth";
import type { AppEnv } from "../types";

export const thongBaoRoutes = new Hono<AppEnv>();

const SELECT_SQL = `
  SELECT t.*, p.ma_pyc
  FROM thong_bao t
  JOIN phieu_yeu_cau p ON p.id = t.phieu_id
  WHERE t.nguoi_nhan_user = ?
`;

thongBaoRoutes.get("/", loginRequired(), async (c) => {
  const user = c.get("user");
  const chiChuaXem = c.req.query("chuaXem") !== "0";

  const sql = SELECT_SQL + (chiChuaXem ? " AND t.da_xem = 0" : "") + " ORDER BY t.id DESC";
  const rows = await all(c.env.DB, sql, [user.username]);
  return c.json(rows.map(thongBaoToDict));
});

thongBaoRoutes.post("/:thongBaoId/da-xem", loginRequired(), async (c) => {
  const user = c.get("user");
  const thongBaoId = c.req.param("thongBaoId");
  await run(c.env.DB, "UPDATE thong_bao SET da_xem = 1 WHERE id = ? AND nguoi_nhan_user = ?", [
    thongBaoId,
    user.username,
  ]);
  return c.json({ ok: true });
});

thongBaoRoutes.post("/danh-dau-tat-ca", loginRequired(), async (c) => {
  const user = c.get("user");
  await run(c.env.DB, "UPDATE thong_bao SET da_xem = 1 WHERE nguoi_nhan_user = ? AND da_xem = 0", [
    user.username,
  ]);
  return c.json({ ok: true });
});
