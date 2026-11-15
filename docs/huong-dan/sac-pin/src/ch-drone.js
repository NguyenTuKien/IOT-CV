/* Chương 10: nối số liệu pin với FC ArduPilot: ngưỡng BATT_*, hiệu chỉnh BATT_AMP_PERVLT bằng mAh sạc trả,
   thói quen sau bay. Giá trị lấy từ firmware/ardupilot/params/01-base.param. */
SAC.chapter('drone', {
  num: 10,
  short: 'Với drone',
  title: 'Số liệu pin trong bộ điều khiển bay',
  kicker: 'Pin và FC',
  lead: 'FC chỉ đo tổng điện áp và dòng. Máy sạc biết pin thật sự nhận bao nhiêu mAh. So hai số để chỉnh dòng.',
  render(root, def) {
    const { h } = SAC;
    const code = (t) => h('code', null, t);
    const section = (title, ...kids) => h('div', { class: 'stack space' }, h('h3', null, title), ...kids);
    const stat = (val, unit, label) => h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, unit ? h('span', { class: 'stat-unit' }, unit) : null),
      h('span', { class: 'stat-label' }, label));

    root.append(SAC.head(def));

    // 1. Ngưỡng
    root.append(h('div', { class: 'stats' },
      stat('14,0', 'V', 'BATT_LOW_VOLT: 3,5 V mỗi cell, cảnh báo, chuyển RTL'),
      stat('13,2', 'V', 'BATT_CRT_VOLT: 3,3 V mỗi cell, nguy hiểm, hạ cánh'),
      stat('370,4', '', 'BATT_AMP_PERVLT hiện tại (A trên V)')));

    root.append(section('Mốc điện áp của pin 4S',
      SAC.table(['Mức', 'Mỗi cell', 'Pin 4S', 'Trên FC'], [
        ['Đầy', '4,20 V', '16,80 V', '—'],
        ['Cất giữ', '3,80–3,85 V', '15,2–15,4 V', '—'],
        ['Vừa hạ cánh (nghỉ)', '~3,7 V', '14,8 V', '—'],
        ['Thấp, khi có tải', '3,5 V', '14,0 V', h('span', null, code('BATT_LOW_VOLT'), ' → RTL (', code('BATT_FS_LOW_ACT 2'), ')')],
        ['Tới hạn, khi có tải', '3,3 V', '13,2 V', h('span', null, code('BATT_CRT_VOLT'), ' → hạ cánh (', code('BATT_FS_CRT_ACT 1'), ')')],
        ['Không bao giờ dưới (nghỉ)', '3,0 V', '12,0 V', '—'],
      ]),
      h('p', { class: 'note' }, h('b', null, 'Cùng lúc có ngưỡng theo mAh.'),
        h('span', null, code('BATT_LOW_MAH 1060'), ' là 20% của ', code('BATT_CAPACITY 5300'), '. Đạt một trong hai ngưỡng là FC báo.')),
      h('p', { class: 'warn' }, h('b', null, 'Chỉ pin 4S.'),
        'Bay 6S thì ngưỡng là 21,0 V và 19,8 V; với 14,0 và 13,2 V hiện tại, failsafe pin không bao giờ chạy.')));

    // 2. Máy tính hiệu chỉnh dòng
    root.append(section('Chỉnh cảm biến dòng',
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, 'BATT_AMP_PERVLT mới = cũ × (mAh máy sạc trả ÷ mAh FC báo)'),
        h('div', { id: 'amp-calc' })),
      SAC.steps('drone-amp', [
        { t: 'Sạc pin đầy bằng B6AC V2.', d: 'Capacity Cut-Off mặc định là 5000 mAh, thấp hơn dung lượng pin. Đặt cao hơn 5300 mAh.' },
        { t: 'Bay một chuyến, càng dài càng tốt.', d: 'Cảm biến dòng kém chính xác dưới khoảng 3 A.' },
        { t: 'Hạ cánh, ghi mAh consumed trong tab DATA của Mission Planner.' },
        { t: 'Sạc đầy lại bằng B6AC V2, ghi mAh máy báo đã nạp.' },
        { t: 'Nhập ba số vào máy tính ở trên. Lặp 2–3 chuyến, lấy trung bình.', d: 'Sạc hao tổn vài phần trăm, nên kết quả hơi lệch cao. Chấp nhận được.' },
      ]),
      h('p', { class: 'note' }, h('b', null, 'Về nguồn công thức.'),
        'Đây là cách làm phổ biến trong cộng đồng. Trang hướng dẫn gốc của ArduPilot và của Oscar Liang đã đổi đường dẫn và trả 404, nên chưa dẫn được nguồn chính thức.'),
      h('p', { class: 'note' }, h('b', null, 'Giá trị 370,4 từ đâu.'),
        'Quy đổi từ trang thông số SpeedyBee (Scale 27, Offset −2644). Dự án đã ghi là vẫn phải hiệu chỉnh theo mAh sạc trả.')));

    mountCalculator(root.querySelector('#amp-calc'));

    // 3. Sau bay
    root.append(section('Sau mỗi chuyến bay',
      SAC.steps('drone-sau-bay', [
        { t: 'Hạ cánh, ghi mAh consumed.' },
        { t: 'Rút pin khỏi drone khi **không** còn cắm USB.', d: 'Rút pin khi USB còn cắm làm FC chốt failsafe pin. Phải khởi động lại FC khi có pin.' },
        { t: 'Cho pin nguội trước khi sạc.', d: 'Sạc ở 0–45 °C. Pin còn ấm sau bay thì chờ.' },
        { t: 'Đọc điện áp nghỉ bằng BATT METER.', d: 'Lệch cell dưới 0,05 V là bình thường. Trên 0,1 V thì theo dõi.' },
        { t: 'Bay tiếp trong hai ngày: BAL CHG ở 3,0 A. Lâu hơn: STORAGE.', d: 'STORAGE đưa về 3,80–3,85 V mỗi cell.' },
      ]),
      h('div', { class: 'stats' },
        stat('3,0', 'A', 'dòng sạc 4S (giới hạn 50 W)'),
        stat('~1 h 40', '', 'sạc từ lúc vừa hạ cánh'),
        stat('~1 h 15', '', 'sạc từ mức cất giữ')),
      h('p', { class: 'note' }, h('b', null, 'Thời gian là ước tính.'), 'Đã cộng pha CV ở cuối. Chi tiết từng bước nằm ở chương ', h('a', { href: '#ch-quy-trinh' }, 'Quy trình'), '.')));

    // ---------- máy tính ----------
    function mountCalculator(host) {
      const INPUT = 'width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;font-variant-numeric:tabular-nums';
      const parse = (s) => { const v = parseFloat(String(s).trim().replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
      const fmt = (v, d) => v.toFixed(d).replace('.', ',');
      const field = (label, input) => h('label', { style: 'display:grid;gap:6px;font-size:14px;color:var(--ink-2)' }, label, input);
      const num = (value, placeholder) => h('input', { type: 'text', inputmode: 'decimal', value, placeholder, autocomplete: 'off', style: INPUT });

      const oldIn = num('370,4', '370,4');
      const fcIn = num('', 'ví dụ 4000');
      const chgIn = num('', 'ví dụ 4300');
      const out = h('div', { 'aria-live': 'polite' });
      const runsBox = h('div', { class: 'stack' });
      let runs = SAC.store.get('amp-runs', []);

      const addBtn = h('button', { type: 'button', class: 'chip on', onclick: add }, 'Ghi chuyến này');
      const clrBtn = h('button', { type: 'button', class: 'chip', onclick: clear }, 'Xoá các chuyến đã ghi');

      host.append(
        h('div', { class: 'grid-3' },
          field('BATT_AMP_PERVLT hiện tại', oldIn),
          field('mAh FC báo đã dùng', fcIn),
          field('mAh máy sạc đã nạp lại', chgIn)),
        h('div', { class: 'space' }, out),
        h('div', { class: 'chips space' }, addBtn, clrBtn),
        h('div', { class: 'space' }, runsBox));

      [oldIn, fcIn, chgIn].forEach((el) => el.addEventListener('input', update));

      function calc() {
        const o = parse(oldIn.value), f = parse(fcIn.value), c = parse(chgIn.value);
        if (!(o > 0) || !(f > 0) || !(c > 0)) return null;
        return { o, f, c, ratio: c / f, res: o * c / f };
      }

      function update() {
        const r = calc();
        out.replaceChildren();
        addBtn.disabled = !r;
        if (!r) {
          out.append(h('p', { class: 'note' }, 'Nhập ba số lớn hơn 0 để tính.'));
          return;
        }
        const pct = (r.ratio - 1) * 100;
        out.append(
          h('div', { class: 'stats' },
            stat(fmt(r.res, 1), '', 'giá trị mới của BATT_AMP_PERVLT'),
            stat((pct >= 0 ? '+' : '−') + fmt(Math.abs(pct), 1), '%', 'so với giá trị hiện tại')),
          h('p', { class: 'space' }, code('BATT_AMP_PERVLT,' + r.res.toFixed(1))));
        if (r.ratio > 2 || r.ratio < 0.5) {
          out.append(h('p', { class: 'warn space' }, h('b', null, 'Lệch quá nhiều.'),
            'Kiểm lại hai số mAh trước khi tin. Ngưỡng 0,5 đến 2 lần là của người viết, không phải của ArduPilot.'));
        }
      }

      function add() {
        const r = calc();
        if (!r) return;
        runs = [...runs, { o: r.o, f: r.f, c: r.c, res: r.res }].slice(-8);
        SAC.store.set('amp-runs', runs);
        paintRuns();
      }
      function clear() {
        runs = [];
        SAC.store.set('amp-runs', runs);
        paintRuns();
      }
      function paintRuns() {
        runsBox.replaceChildren();
        clrBtn.disabled = !runs.length;
        if (!runs.length) return;
        const avg = runs.reduce((s, x) => s + x.res, 0) / runs.length;
        runsBox.append(
          SAC.table(['Chuyến', 'FC báo (mAh)', 'Máy sạc (mAh)', 'Giá trị mới'],
            runs.map((x, i) => [String(i + 1), fmt(x.f, 0), fmt(x.c, 0), fmt(x.res, 1)])),
          h('p', null, h('b', null, 'Trung bình ' + runs.length + ' chuyến: '), code('BATT_AMP_PERVLT,' + avg.toFixed(1))));
      }

      update();
      paintRuns();
    }
  },
});
