/**
 * Gộp dòng nhật ký lặp lại, và gợi ý tiếng Việt cho thông báo chặn ARM của FC.
 *
 * FC nhắc lại lý do chưa ARM được ("PreArm: …") 30 giây một lần, mức CRITICAL nên hiện
 * thành dòng đỏ "Lỗi"; link Wi-Fi chập chờn thì "Mất liên lạc" / "Đã nối lại" luân phiên.
 * Tối 01/11/2026 trang Nhật ký đầy những dòng đỏ giống hệt nhau, nhìn như lỗi liên tục.
 *
 * `groupRepeats` gộp các dòng GIỐNG HỆT (cùng mức, nguồn, code, nội dung) mà lần sau cách lần
 * trước không quá `REPEAT_WINDOW_S` thành một nhóm, đặt ở lần mới nhất. Các dòng xen giữa
 * vẫn giữ nguyên thứ tự. Chỉ là cách HIỆN: store và file xuất CSV/JSON vẫn đủ từng dòng.
 * `noteRepeat` là cùng quy tắc đó cho sự kiện tới từng cái một (toast lỗi).
 */
import type { LogEntry } from "@/store/telemetry";

/** Lần lặp cách lần trước quá chừng này giây thì thành dòng mới (FC nhắc PreArm mỗi 30 s). */
export const REPEAT_WINDOW_S = 90;

export interface EventGroup {
  /** Lần mới nhất — dòng được hiện. */
  entry: LogEntry;
  count: number;
  /** Giờ (giây) của lần cũ nhất trong nhóm. */
  firstTs: number;
}

/** Hai sự kiện là "lặp lại" của nhau khi trùng cả mức, nguồn, code và nội dung. */
export function repeatSignature(e: Pick<LogEntry, "level" | "source" | "code" | "message">): string {
  return [e.level, e.source, e.code, e.message].join("\u0000");
}

/** `events` mới nhất ở đầu (như store); kết quả cũng vậy. */
export function groupRepeats(events: readonly LogEntry[], windowS: number = REPEAT_WINDOW_S): EventGroup[] {
  const groups: EventGroup[] = [];
  const open = new Map<string, EventGroup>();
  for (const e of events) {
    const sig = repeatSignature(e);
    const g = open.get(sig);
    if (g && g.firstTs - e.ts <= windowS) {
      g.count += 1;
      g.firstTs = e.ts;
      continue;
    }
    const fresh = { entry: e, count: 1, firstTs: e.ts };
    groups.push(fresh);
    open.set(sig, fresh);
  }
  return groups;
}

/** Một chuỗi lặp của một chữ ký, đếm khi sự kiện tới (theo thứ tự thời gian). */
export interface RepeatRun {
  count: number;
  /** Giờ (giây) của lần đầu và lần gần nhất trong chuỗi. */
  firstTs: number;
  lastTs: number;
}

/** Sổ quá chừng này chữ ký thì dọn các chuỗi đã đóng (nội dung có số đo nên chữ ký không lặp hết). */
const MAX_OPEN_RUNS = 256;

/**
 * Ghi thêm một lần xuất hiện của `sig` lúc `ts` và trả chuỗi chứa nó: cách lần trước không quá
 * `windowS` thì nối tiếp chuỗi cũ, không thì mở chuỗi mới (`count` 1). Cùng quy tắc với
 * `groupRepeats`, nên ×N trên toast khớp dòng ở trang Nhật ký.
 */
export function noteRepeat(
  runs: Map<string, RepeatRun>,
  sig: string,
  ts: number,
  windowS: number = REPEAT_WINDOW_S,
): RepeatRun {
  const run = runs.get(sig);
  if (run && ts - run.lastTs <= windowS) {
    run.count += 1;
    run.lastTs = ts;
    return run;
  }
  if (runs.size >= MAX_OPEN_RUNS) {
    for (const [k, r] of runs) if (ts - r.lastTs > windowS) runs.delete(k);
  }
  const fresh = { count: 1, firstTs: ts, lastTs: ts };
  runs.set(sig, fresh);
  return fresh;
}

/**
 * Thông báo của FC (đúng chữ ArduPilot 4.7.1 gửi) → việc người bay cần làm. Thứ tự có nghĩa:
 * mẫu đầu tiên khớp thắng. Thêm dòng ở đây, đừng rải chuỗi so khớp vào component.
 */
const HINTS: ReadonlyArray<{ re: RegExp; hint: string }> = [
  {
    re: /RC not found|Radio failsafe on|Throttle below failsafe/i,
    hint: "Tay phát chưa bật hoặc mất sóng: bật tay phát trước khi cắm pin drone.",
  },
  { re: /Throttle too high/i, hint: "Kéo cần ga xuống đáy rồi mới gạt SwB." },
  {
    re: /mode not armable/i,
    hint: "Chế độ đang chọn không cho ARM (thường là SwD đang bật RTL): gạt SwD về, chọn Loiter hoặc AltHold.",
  },
  {
    re: /Proximity \d+ deg/i,
    hint: "TFmini thấy vật gần hơn 0,6 m ở phía trước (cỏ, tay, chân người): xoay mũi drone ra chỗ trống.",
  },
  {
    re: /GPS \d+: not healthy/i,
    hint: "GPS gửi dữ liệu trễ hoặc ngắt quãng. Thường tự hết sau 1–2 phút; kéo dài thì kiểm dây GPS.",
  },
  {
    re: /need position estimate|Need Position Estimate|waiting for home/i,
    hint: "EKF chưa có vị trí: để drone đứng yên chờ GPS khoá xong.",
  },
  {
    re: /Takeoff blocked: (ESC RPM out of range|waiting for ESC RPM)/i,
    hint: "Có motor chưa quay đủ vòng nên FC chưa cho cất cánh: tắt ARM, chờ vài giây, ARM lại. Lặp lại thì kiểm motor đó.",
  },
  {
    re: /calibrated requires reboot/i,
    hint: "Vừa hiệu chỉnh (hoặc huỷ giữa chừng): rút pin, cắm lại để FC khởi động lại.",
  },
  {
    re: /Check mag field|Compass \d+ not healthy|Compass offsets too high/i,
    hint: "La bàn: cắm pin TRƯỚC rồi mới cắm USB; tránh xa sắt thép. Vẫn còn thì khởi động lại FC khi đang có pin.",
  },
  { re: /below minimum arming voltage/i, hint: "Pin yếu: thay pin đầy." },
  { re: /Leaning/i, hint: "Drone đang nghiêng: đặt lên chỗ bằng phẳng." },
];

export function hintFor(message: string): string | null {
  return HINTS.find((h) => h.re.test(message))?.hint ?? null;
}
