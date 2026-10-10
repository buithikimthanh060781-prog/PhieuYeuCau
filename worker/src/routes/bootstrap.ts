// routes/bootstrap.ts - Port 1:1 của blueprints/bootstrap.py.
import { Hono } from "hono";
import { all } from "../lib/db";
import * as perm from "../lib/permissions";
import * as repo from "../lib/repoPhieu";
import { loaiYeuCauToDict, nhanVienToDict, phongBanToDict } from "../lib/serializers";
import { loginRequired } from "../middleware/auth";
import type { AppEnv } from "../types";

export const bootstrapRoutes = new Hono<AppEnv>();

bootstrapRoutes.get("/bootstrap", loginRequired(), async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const phongBan = (await all(db, "SELECT * FROM phong_ban ORDER BY ma_phong")).map(phongBanToDict);
  const loai = (await all(db, "SELECT * FROM loai_yeu_cau ORDER BY ma_loai")).map(loaiYeuCauToDict);
  const nhanVien = (await all(db, "SELECT * FROM nhan_vien ORDER BY ho_ten")).map(nhanVienToDict);

  const { sql, params } = perm.scopeWhereClause(user);
  const tickets = await repo.listTickets(db, sql, params);

  return c.json({
    user,
    phongBan,
    loaiYeuCau: loai,
    nhanVien,
    phieuYeuCau: tickets,
  });
});
