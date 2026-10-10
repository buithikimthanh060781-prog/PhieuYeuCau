// files.ts - R2 thay cho thư mục filedinhkem/ (repo_phieu.py _luu_tep_len_dia).
// Cùng sơ đồ khoá: "<maPYC>/<12 hex ngẫu nhiên>_<tên gốc đã làm sạch>".
import { randomHex, secureFilename } from "./crypto";
import type { Env } from "../types";

export const GIOI_HAN_KICH_THUOC = 2 * 1024 * 1024; // 2MB / tệp

export class FileTooLargeError extends Error {
  constructor(public tenTep: string) {
    super(tenTep);
  }
}

export interface SavedFileMeta {
  tenTep: string;
  kichThuoc: number;
  loaiMime: string;
  duongDan: string; // khoá object trong R2
}

/** Lưu 1 tệp (từ FormData) vào R2. Ném FileTooLargeError nếu > 2MB - kiểm
 * tra TRƯỚC khi ghi (khác bản Flask: ghi xong mới biết rồi xoá lại), vì
 * Workers không có đĩa cục bộ để "ghi tạm" như vậy. */
export async function saveFileToR2(env: Env, maPYC: string, file: File): Promise<SavedFileMeta> {
  const tenGoc = file.name || "tep-dinh-kem";
  if (file.size > GIOI_HAN_KICH_THUOC) {
    throw new FileTooLargeError(tenGoc);
  }

  const thuMucCon = secureFilename(maPYC) || "khac";
  const tenAnToan = secureFilename(tenGoc) || "tep";
  const tenLuu = `${randomHex(6)}_${tenAnToan}`;
  const duongDan = `${thuMucCon}/${tenLuu}`;

  const buffer = await file.arrayBuffer();
  await env.FILES.put(duongDan, buffer, {
    httpMetadata: { contentType: file.type || undefined },
  });

  return {
    tenTep: tenGoc,
    kichThuoc: buffer.byteLength,
    loaiMime: file.type || "",
    duongDan,
  };
}

export async function deleteFileFromR2(env: Env, duongDan: string): Promise<void> {
  await env.FILES.delete(duongDan);
}

export async function getFileFromR2(env: Env, duongDan: string): Promise<R2ObjectBody | null> {
  return env.FILES.get(duongDan);
}
