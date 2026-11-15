/* Chương 5 — Quy trình: danh sách bước tick được (sạc cân bằng 4S, storage, đo cell, đo nội trở, sau mỗi lần bay),
   máy tính hiệu chỉnh BATT_AMP_PERVLT, sổ pin lưu trong localStorage + xuất CSV.
   Nguồn: manual V3.10/V3.20 tr.10–13 (quy trình), tr.17–19 (BATT METER, BATT RESISTANCE),
   plans/reports/261026-research-ovonic-4s-lipo.md mục 3.5–3.7, docs/phan-cung-thuc-te.md (BATT_AMP_PERVLT 370.4).
   Mã màn hình ngoài `LP` và `BAL` là mẫu của sách, không phải mọi mã đã được xác minh trên máy thật. */
(function () {
  'use strict';
  const { h } = SAC;


  const CHARGE = [
    { t: 'Kiểm pin trước khi sạc.', d: 'Nguội hẳn, không phồng, XT60 sạch. Pin còn ấm sau bay thì chờ.' },
    { t: 'Cắm nguồn, dựng đường sạc phía máy.', d: 'Dây 3 + dây 8, banana vào OUTPUT. **Chưa** cắm pin. Chi tiết ở chương 3.' },
    { t: 'Bấm [[BATT/PROG]], chọn `LiPo BATT` bằng [[INC]] / [[DEC]], bấm [[ENTER]].' },
    { t: 'Chọn `LiPo BALANCE CHG` bằng [[INC]] / [[DEC]], bấm [[ENTER]].' },
    { t: 'Đặt dòng: bấm [[ENTER]], số nhấp nháy, chỉnh `3.0A` bằng [[INC]] / [[DEC]], bấm [[ENTER]] để lưu.', d: 'Ở 16,8 V, 50 W cho ≈ 2,98 A nên máy tự giới hạn.' },
    { t: 'Đặt số cell: số nhấp nháy, chỉnh `4S`, bấm [[ENTER]].', d: 'Màn hiện dạng `3.0A 14.8V (4S)`.' },
    { t: 'Kiểm lần cuối rồi cắm pin: XT60, sau đó dây cân bằng vào ổ "4 cells".', d: 'Chỉ một pin mỗi lần. Xem chương 3.' },
    { t: 'Giữ [[ENTER]] 3 giây.', d: 'Màn hiện `BATTERY CHECK` rồi `WAIT...`.' },
    { t: 'Đọc `R:4SER S:4SER`. Hai số giống nhau thì bấm [[ENTER]] (`CONFIRM(ENTER)`).', d: 'R là số cell máy dò, S là số bạn đặt. Khác nhau thì bấm [[BATT/PROG]] (`CANCEL(STOP)`) và kiểm lại số cell.' },
    { t: 'Theo dõi màn sạc, dạng `LP4s 3.0A 16.79V` / `BAL 022:43 01234`.', d: '[[INC]]: áp từng cell, rồi `Fuel=` và `Cell=`. [[DEC]]: áp kết thúc, áp nguồn vào, nhiệt, hẹn giờ.' },
    { t: 'Máy bíp là xong. Pin đầy ≈ 16,80 V.', d: 'Ghi số mAh cuối vào sổ pin. Muốn dừng sớm: [[BATT/PROG]].' },
    { t: 'Tháo ngược: dây cân bằng, XT60, banana, nguồn.' },
  ];

  const STORAGE = [
    { t: 'Khi nào: không bay từ 2–3 ngày trở lên.' },
    { t: 'Nối dây như sạc cân bằng.', d: 'Phía máy trước, pin sau cùng.' },
    { t: 'Bấm [[BATT/PROG]], chọn `LiPo BATT`, [[ENTER]]. Chọn `LiPo STORAGE`, [[ENTER]].' },
    { t: 'Đặt dòng `3.0A` và `4S` như bước sạc.' },
    { t: 'Giữ [[ENTER]] 3 giây, xác nhận `R:4SER S:4SER` bằng [[ENTER]].' },
    { t: 'Máy đưa pin về 3,80–3,85 V/cell, tức 15,2–15,4 V.', d: 'Mã chế độ trên màn sạc chưa xác minh với máy thật.' },
    { t: 'Pin đang đầy thì xả rất chậm: 5 W ≈ 0,3 A ở 4S, khoảng 5–6 giờ.', d: 'Nhanh hơn: bay treo tới ~3,85 V/cell rồi để nghỉ.' },
    { t: 'Cất nơi mát, khô, trong túi chống cháy.' },
  ];

  const CELLS = [
    { t: 'Cắm dây cân bằng vào ổ "4 cells".', d: 'Muốn xem cả tổng `MAIN` thì cắm thêm đường sạc chính.' },
    { t: 'Bấm [[BATT/PROG]], chọn `BATT METER` bằng [[INC]] / [[DEC]], bấm [[ENTER]].' },
    { t: 'Màn hiện áp từng cell, dạng `4.20 4.19 4.19 V`.', d: 'Chỉ bốn ô có số, ô thừa hiện `0.00`.' },
    { t: 'Bấm [[INC]]: `MAIN` là tổng, `H` là cell cao nhất, `L` là cell thấp nhất.', d: 'Ví dụ của sách: `H4.200V L4.182V`.' },
    { t: 'So H và L. Lệch dưới 0,05 V là bình thường.', d: 'Quá 0,1 V thì theo dõi.' },
    { t: 'Ghi vào sổ pin.' },
  ];

  const RESISTANCE = [
    { t: 'Cắm cả đường sạc chính lẫn dây cân bằng.' },
    { t: 'Pin đầy (4,20 V/cell), cùng nhiệt độ mỗi lần đo.' },
    { t: 'Bấm [[BATT/PROG]], chọn `BATT RESISTANCE`, bấm [[ENTER]].' },
    { t: 'Màn hiện mΩ từng cell, dạng `012 005 005 m` / `006 m`.', d: 'Bấm [[INC]]: tổng, cao nhất, thấp nhất, dạng `H:12mΩ L:5mΩ`.' },
    { t: 'Ghi 4 số. Một cell gấp đôi các cell còn lại: cho pin nghỉ hưu.' },
    { t: 'Chỉ so với mốc của chính pin này.', d: 'Máy sạc rẻ đo để so với chính nó, không so với máy khác.' },
  ];

  const AFTER_FLIGHT = [
    { t: 'Hạ cánh, cắt điện, rút pin khỏi drone.' },
    { t: 'Chờ pin nguội, nhìn và sờ.', d: 'Phồng, móp, dây hở, nóng không cầm quá 10 giây: bỏ pin.' },
    { t: 'Ghi `mAh consumed` mà FC báo.', d: 'Mission Planner, tab DATA.' },
    { t: 'Đo cell bằng bút đo hoặc `BATT METER`.', d: 'Lệch quá 0,1 V thì ghi chú.' },
    { t: 'Sạc cân bằng 4S ở 3,0 A.', d: 'Ghi số mAh máy nạp vào, cuối màn sạc.' },
    { t: 'Không bay từ 2–3 ngày: đưa về storage.' },
    { t: 'Cập nhật sổ pin bên dưới.' },
  ];

  const LCD_GALLERY = [
    ['LiPo BALANCE CHG', '3.0A 14.8V (4S)', 'Chọn chế độ và thông số'],
    ['BATTERY CHECK', 'WAIT...', 'Máy dò số cell'],
    ['R:4SER S:4SER', 'CONFIRM(ENTER)', 'Hai số giống nhau mới bấm ENTER'],
    ['LP4s 3.0A 16.79V', 'BAL 022:43 01234', 'Đang sạc: loại, dòng, áp / chế độ, phút:giây, mAh'],
  ];

  const csvCell = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';

  function todayIso() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function stat(val, unit, label) {
    return h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, h('span', { class: 'stat-unit' }, unit)),
      h('span', { class: 'stat-label' }, label));
  }

  function card(title, key, items) {
    return h('div', { class: 'card' }, h('div', { class: 'card-title' }, title), SAC.steps(key, items));
  }

  function field(label, attrs) {
    const input = h('input', Object.assign({ class: 'input', style: 'width:100%' }, attrs));
    return { input, el: h('label', { style: 'display:grid;gap:4px;font-size:13.5px;color:var(--ink-2)' }, label, input) };
  }

  // ---- Hiệu chỉnh BATT_AMP_PERVLT ----
  function calibTool() {
    const old = field('BATT_AMP_PERVLT hiện tại', { type: 'number', step: 0.1, min: 0, value: SAC.store.get('amp-pervlt', 370.4) });
    const fc = field('mAh FC báo đã dùng', { type: 'number', step: 1, min: 0, placeholder: 'vd 3800' });
    const ch = field('mAh máy sạc nạp lại', { type: 'number', step: 1, min: 0, placeholder: 'vd 3950' });
    const out = h('div');
    function update() {
      const a = parseFloat(old.input.value);
      const b = parseFloat(fc.input.value);
      const c = parseFloat(ch.input.value);
      if (Number.isFinite(a) && a > 0) SAC.store.set('amp-pervlt', a);
      if (!(a > 0) || !(b > 0) || !(c > 0)) {
        out.replaceChildren(h('p', { class: 'note' }, 'Nhập ba số lớn hơn 0 để tính.'));
        return;
      }
      out.replaceChildren(h('div', { class: 'stats' },
        stat(String(Math.round(a * (c / b) * 10) / 10).replace('.', ','), '', 'BATT_AMP_PERVLT mới'),
        stat(((c / b - 1) * 100).toFixed(1).replace('.', ','), '%', 'máy sạc nạp nhiều hơn FC báo')));
    }
    [old, fc, ch].forEach((f) => f.input.addEventListener('input', update));
    update();
    return h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Hiệu chỉnh dòng của FC bằng mAh sạc lại'),
      h('p', { style: 'font-size:15px' }, SAC.rich('`BATT_AMP_PERVLT` mới = cũ × (mAh máy sạc trả ÷ mAh FC báo).')),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0' }, old.el, fc.el, ch.el),
      out,
      h('p', { class: 'note', style: 'margin-top:14px' }, SAC.rich('Bay chuyến dài: cảm biến dòng kém chính xác dưới ~3 A. Lặp 2–3 chuyến rồi lấy trung bình. Sạc hao vài phần trăm nên kết quả hơi cao.')));
  }

  // ---- Sổ pin ----
  function logTool() {
    const KEY = 'batlog';
    const stored = SAC.store.get(KEY, []);
    const rows = Array.isArray(stored) ? stored : [];
    const msg = h('div');
    const host = h('div');

    const fDate = field('Ngày', { type: 'date', value: todayIso() });
    const fV = field('Áp lúc bắt đầu (V)', { type: 'number', step: 0.01, min: 0, max: 25, placeholder: '15,20' });
    const fMah = field('mAh đã nạp', { type: 'number', step: 1, min: 0, max: 50000, placeholder: '4200' });
    const fIr = [1, 2, 3, 4].map((n) => field('IR cell ' + n + ' (mΩ)', { type: 'number', step: 1, min: 0, max: 999, placeholder: '5' }));
    const fNote = field('Ghi chú', { type: 'text', placeholder: 'mốc pin mới, sau bay…' });

    function save() { SAC.store.set(KEY, rows); }
    function say(cls, text) { msg.replaceChildren(text ? h('p', { class: cls, style: 'margin-top:12px' }, text) : ''); }
    const num = (el) => (el.value.trim() === '' ? null : Number(el.value));

    function add() {
      const date = fDate.input.value;
      const v = num(fV.input);
      const mah = num(fMah.input);
      const ir = fIr.map((f) => num(f.input));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return say('warn', 'Chọn ngày.');
      if (v != null && !(v > 0 && v <= 25)) return say('warn', 'Điện áp phải trong khoảng 0–25 V.');
      if (mah != null && !(mah >= 0 && mah <= 50000)) return say('warn', 'mAh phải trong khoảng 0–50 000.');
      if (ir.some((x) => x != null && !(x > 0 && x < 1000))) return say('warn', 'Nội trở mỗi cell phải trong khoảng 0–1000 mΩ.');
      if (v == null && mah == null && ir.every((x) => x == null)) return say('warn', 'Nhập ít nhất một số: áp, mAh hoặc nội trở.');
      rows.push({ date, v, mah, ir, note: fNote.input.value.trim().slice(0, 120) });
      save();
      say(null, '');
      [fV, fMah, fNote, ...fIr].forEach((f) => { f.input.value = ''; });
      draw();
    }

    function doubled(ir) {
      if (!ir || ir.some((x) => x == null)) return false;
      return Math.max(...ir) >= 2 * Math.min(...ir);
    }

    function draw() {
      if (!rows.length) {
        host.replaceChildren(h('p', { class: 'note', style: 'margin-top:16px' }, 'Chưa có dòng nào. Dòng đầu tiên nên là mốc lúc pin mới.'));
        return;
      }
      const sorted = rows.map((r, i) => ({ r, i })).sort((a, b) => (a.r.date < b.r.date ? -1 : a.r.date > b.r.date ? 1 : a.i - b.i));
      const body = sorted.map(({ r, i }) => {
        const irs = (r.ir || [null, null, null, null]).map((x) => (x == null ? '—' : String(x)));
        const noteCell = h('span', null, r.note || '', doubled(r.ir) ? h('span', { class: 'est', style: 'margin-left:6px' }, 'IR gấp đôi') : null);
        const del = h('button', {
          class: 'chip', type: 'button', 'aria-label': 'Xoá dòng ngày ' + r.date,
          onclick: () => { rows.splice(i, 1); save(); draw(); },
        }, '×');
        return [r.date, r.v == null ? '—' : String(r.v).replace('.', ','), r.mah == null ? '—' : String(r.mah), ...irs, noteCell, del];
      });
      host.replaceChildren(h('div', { style: 'margin-top:16px' },
        SAC.table(['Ngày', 'V đầu', 'mAh nạp', 'IR 1', 'IR 2', 'IR 3', 'IR 4', 'Ghi chú', ''], body)));
    }

    function exportCsv() {
      if (!rows.length) return say('warn', 'Sổ còn trống, chưa có gì để xuất.');
      const head = ['ngày', 'V bắt đầu', 'mAh nạp', 'IR1 (mΩ)', 'IR2 (mΩ)', 'IR3 (mΩ)', 'IR4 (mΩ)', 'ghi chú'];
      const lines = [head.map(csvCell).join(',')];
      rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach((r) => {
        const ir = r.ir || [null, null, null, null];
        lines.push([r.date, r.v, r.mah, ir[0], ir[1], ir[2], ir[3], r.note].map(csvCell).join(','));
      });
      // BOM để Excel đọc đúng tiếng Việt
      const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: 'so-pin-ovonic-4s.csv' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('tip', 'Đã xuất ' + rows.length + ' dòng.');
    }

    draw();
    return h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Sổ pin Ovonic 4S'),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px' },
        fDate.el, fV.el, fMah.el, ...fIr.map((f) => f.el), fNote.el),
      h('div', { class: 'chips', style: 'margin-top:14px' },
        h('button', { class: 'chip on', type: 'button', onclick: add }, 'Thêm dòng'),
        h('button', { class: 'chip', type: 'button', onclick: exportCsv }, 'Xuất CSV')),
      msg,
      host,
      h('p', { style: 'margin-top:14px;font-size:14px;color:var(--ink-2)' }, SAC.rich('Sổ lưu ngay trong trình duyệt này, trên máy này. Xuất CSV để giữ bản dự phòng.')));
  }

  const DEF = {
    num: 5,
    title: 'Quy trình từng bước',
    short: 'Quy trình',
    kicker: 'Sạc, cất, đo, ghi sổ',
    lead: 'Bấm vào một bước để tick. Trạng thái được nhớ lại trên máy này.',
  };

  SAC.chapter('quy-trinh', Object.assign({}, DEF, {
    render(root) {
      root.appendChild(SAC.head(DEF));

      root.appendChild(h('div', { class: 'stats' },
        stat('3,0', 'A', 'dòng sạc pin 4S'),
        stat('~1 h 40', 'm', 'sạc từ lúc hạ cánh (còn ~20%)'),
        stat('~1 h 15', 'm', 'sạc từ mức storage (~45%)')));

      // ---- Màn hình trên đường đi ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Màn hình bạn sẽ gặp khi sạc'),
        h('div', { class: 'grid-2' }, LCD_GALLERY.map(([l1, l2, cap]) => h('div', { class: 'card flat' },
          SAC.diag.lcd(l1, l2),
          h('p', { style: 'margin-top:10px;font-size:14px;color:var(--ink-2)' }, cap)))),
        h('p', { class: 'note', style: 'margin-top:16px' }, SAC.rich('Chữ trong ví dụ là mẫu của sách. Số thật trên máy sẽ khác.'))));

      // ---- Sạc cân bằng ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Sạc cân bằng 4S ở 3,0 A'),
        h('div', { class: 'card' }, SAC.steps('qt-sac', CHARGE)),
        h('p', { class: 'warn', style: 'margin-top:20px' }, SAC.rich(
          '**Xem hai cài đặt mặc định trước lần sạc đầu:** Safety Timer 120 phút, Capacity Cut-Off 5000 mAh. ' +
          'Pin 5300 mAh có thể bị cắt sớm bằng `OVER CHARGE CAPACITY LIMIT` hoặc `OVER TIME LIMIT`. Từ lúc hạ cánh mất ~1 h 40, sát mốc 120 phút. Xem '), h('a', { href: '#ch-cai-dat' }, 'chương Cài đặt'), '.')));

      // ---- Bốn việc còn lại ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Cất, đo, và sau mỗi lần bay'),
        h('div', { class: 'grid-2' },
          card('Đưa pin về storage', 'qt-storage', STORAGE),
          card('Sau mỗi lần bay', 'qt-sau-bay', AFTER_FLIGHT),
          card('Đo điện áp từng cell', 'qt-cell', CELLS),
          card('Đo nội trở', 'qt-ir', RESISTANCE))));

      // ---- Công cụ ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Hiệu chỉnh dòng FC'),
        calibTool()));
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Sổ pin'),
        logTool()));
    },
  }));
})();
