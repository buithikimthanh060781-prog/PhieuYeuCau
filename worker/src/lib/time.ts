// time.ts - Quy ước thời gian DUY NHẤT dùng trong toàn bộ Worker: UTC.
// (Bản Flask dùng date.today()/datetime.now() theo giờ địa phương máy chủ -
// trên Workers "giờ địa phương máy chủ" không có nghĩa vì chạy phân tán ở
// biên, nên UTC là quy ước duy nhất, áp dụng xuyên suốt ngay_tao/ngay_cap_nhat/
// mốc lịch sử/thông báo/năm trong mã phiếu/độ lệch ngày khi seed dữ liệu mẫu.)

/** yyyy-mm-dd theo UTC - tương đương date.today().isoformat(). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** yyyy-mm-ddThh:mm:ss theo UTC, không hậu tố "Z" - tương đương
 * datetime.now().isoformat(timespec="seconds"). */
export function nowISO(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "");
}

export function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** hôm nay (UTC) + soNgay ngày, dạng yyyy-mm-dd - tương đương _ngay_lech(). */
export function dayOffsetISO(soNgay: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}
