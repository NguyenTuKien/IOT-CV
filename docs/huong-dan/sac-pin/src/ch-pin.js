/* Chương 2 — Pin Ovonic 4S 5300 mAh: 3D, thông số, đọc nhãn, máy tính điện áp từng cell, đo bằng đồng hồ,
   nội trở, dấu hiệu bỏ pin. Nguồn: plans/reports/261026-research-ovonic-4s-lipo.md (mục 1–4),
   manual V3.10/V3.20 tr.18–19 (BATT METER, BATT RESISTANCE). Biến thể thật của pin (C, khối lượng) CHƯA xác minh. */
(function () {
  'use strict';
  const { h } = SAC;

  // Điện áp nghỉ → % dung lượng (nghỉ ≥ 30 phút, không tải). Bảng kinh nghiệm RC, sai ±5–10%, chưa xác minh với Ovonic.
  const REST_PCT = [
    [3.27, 0], [3.69, 10], [3.73, 20], [3.77, 30], [3.80, 40], [3.82, 45],
    [3.84, 50], [3.87, 60], [3.95, 70], [4.02, 80], [4.11, 90], [4.20, 100],
  ];

  const V_MIN = 2.8;
  const V_MAX = 4.3;
  const PRESETS = [
    { label: 'Đầy', v: [4.20, 4.20, 4.20, 4.20] },
    { label: 'Cất giữ', v: [3.83, 3.83, 3.84, 3.83] },
    { label: 'Vừa hạ cánh', v: [3.74, 3.73, 3.75, 3.73] },
    { label: 'Lệch 1 cell', v: [4.18, 4.19, 4.02, 4.18] },
    { label: 'Một cell hỏng', v: [3.85, 3.84, 2.95, 3.85] },
  ];

  const BATT_ITEMS = [
    { part: 'batt-label', name: 'Nhãn', d: 'Đọc số S, mAh và C trước khi sạc.' },
    { part: 'batt', name: 'Thân pin', d: '4 cell nối tiếp (4S1P), 14,8 V danh định.' },
    { part: 'batt-xt60', name: 'Đầu XT60', d: 'Dây xả, dòng lớn. Nối vào dây 8 (T-plug ↔ XT60).' },
    { part: 'batt-balance', name: 'Dây cân bằng JST-XH', d: '5 chân. Để sạc cân bằng và đo từng cell.' },
  ];

  const BATT_VIEWS = [['top', 'Từ trên'], ['side', 'Cạnh'], ['end', 'Đầu pin']];

  const fmt = (n, d = 2) => Number(n).toFixed(d).replace('.', ',');

  function pctOf(v) {
    if (v <= REST_PCT[0][0]) return 0;
    if (v >= REST_PCT[REST_PCT.length - 1][0]) return 100;
    for (let i = 1; i < REST_PCT.length; i++) {
      const [v1, p1] = REST_PCT[i];
      if (v <= v1) {
        const [v0, p0] = REST_PCT[i - 1];
        return p0 + ((v - v0) / (v1 - v0)) * (p1 - p0);
      }
    }
    return 100;
  }

  // Kết luận trạng thái theo cell yếu nhất và trung bình. Điện áp ĐO NGHỈ, không tải.
  function levelOf(v) {
    const min = Math.min(...v);
    const max = Math.max(...v);
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    if (max > 4.25) return { cls: 'danger', label: 'Quá cao', text: 'Có cell trên 4,25 V. Ngừng sạc, đừng dùng pin này.' };
    if (min < 3.0) return { cls: 'danger', label: 'Hỏng', text: 'Có cell dưới 3,0 V. Không sạc, không bay. Nghi pin hỏng.' };
    if (min < 3.3) return { cls: 'danger', label: 'Tới hạn', text: 'Có cell dưới 3,3 V: xả quá sâu. Sạc lại ngay và theo dõi cell này.' };
    if (min < 3.5) return { cls: 'warn', label: 'Thấp', text: 'Có cell dưới 3,5 V. Sạc lại trước khi bay.' };
    if (avg >= 4.18) return { cls: 'tip', label: 'Đầy', text: 'Trung bình từ 4,18 V/cell. Sẵn sàng bay.' };
    if (avg >= 3.80 && avg <= 3.85) return { cls: 'tip', label: 'Storage', text: 'Đúng mức cất giữ, 3,80–3,85 V/cell.' };
    return { cls: 'note', label: 'Giữa mức', text: 'Chưa đầy, chưa tới mức cất giữ. Sắp bay thì sạc đầy, nghỉ từ 2–3 ngày thì đưa về storage.' };
  }

  function imbalanceOf(v) {
    const d = Math.max(...v) - Math.min(...v);
    if (d < 0.05) return { cls: 'tip', text: 'Lệch ' + fmt(d) + ' V. Bình thường (dưới 0,05 V).' };
    if (d <= 0.1) return { cls: 'note', text: 'Lệch ' + fmt(d) + ' V. Sạc cân bằng rồi đo lại.' };
    if (d <= 0.2) return { cls: 'warn', text: 'Lệch ' + fmt(d) + ' V, quá 0,1 V. Theo dõi, ghi vào sổ pin mỗi lần sạc.' };
    return { cls: 'danger', text: 'Lệch ' + fmt(d) + ' V, quá 0,2 V. Sạc cân bằng không kéo về, hoặc một cell luôn thấp nhất thì cho pin nghỉ hưu.' };
  }

  function cellColor(x) {
    if (x > 4.25 || x < 3.3) return 'var(--danger)';
    if (x < 3.5) return 'var(--warn)';
    if (x >= 4.18) return 'var(--ok)';
    return 'var(--accent)';
  }

  function stat(val, unit, label) {
    return h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, h('span', { class: 'stat-unit' }, unit)),
      h('span', { class: 'stat-label' }, label));
  }

  function callout(svg, items, onHover) {
    const lis = [];
    const state = { pinned: null };
    function paint(part) {
      lis.forEach((li) => li.classList.toggle('on', !!part && li.dataset.part === part));
      SAC.diag.highlight(svg, part || null);
      if (onHover) onHover(part || null);
    }
    items.forEach((it, i) => {
      const li = h('li', { 'data-part': it.part, style: 'cursor:pointer' },
        h('div', { class: 'pin-label' }, i + 1),
        h('div', null, h('b', null, it.name), h('span', null, SAC.rich(it.d))));
      li.addEventListener('mouseenter', () => paint(it.part));
      li.addEventListener('mouseleave', () => paint(state.pinned));
      li.addEventListener('click', () => { state.pinned = state.pinned === it.part ? null : it.part; paint(state.pinned); });
      lis.push(li);
    });
    return {
      el: h('div', { class: 'callout-fig' }, h('div', { class: 'fig' }, svg), h('ol', null, lis)),
      pin(part) { state.pinned = part; paint(part); },
    };
  }

  // ---- Máy tính điện áp từng cell ----
  function cellTool() {
    const saved = SAC.store.get('pin-cells', null);
    const vals = Array.isArray(saved) && saved.length === 4 && saved.every((x) => typeof x === 'number' && x >= V_MIN && x <= V_MAX)
      ? saved.slice() : PRESETS[1].v.slice();

    const ranges = [];
    const nums = [];
    const bars = [];
    const out = h('div', { class: 'stack' });
    const barBox = h('div', { style: 'display:flex;gap:12px;align-items:flex-end;height:120px;margin-top:6px' });

    const rows = vals.map((v, i) => {
      const range = h('input', { type: 'range', min: V_MIN, max: V_MAX, step: 0.01, value: v, style: 'flex:1;min-width:0', 'aria-label': 'Cell ' + (i + 1) });
      const num = h('input', { type: 'number', min: V_MIN, max: V_MAX, step: 0.01, value: v.toFixed(2), class: 'input', style: 'width:84px', 'aria-label': 'Điện áp cell ' + (i + 1) });
      range.addEventListener('input', () => set(i, parseFloat(range.value), 'range'));
      num.addEventListener('input', () => {
        const x = parseFloat(num.value);
        if (Number.isFinite(x) && x >= V_MIN && x <= V_MAX) set(i, x, 'num');
      });
      ranges.push(range);
      nums.push(num);
      const bar = h('div', { style: 'flex:1;border-radius:8px 8px 0 0;transition:height .15s, background .15s;min-width:0' });
      const barWrap = h('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;height:100%;text-align:center;font-size:12.5px;color:var(--ink-2)' },
        bar, h('span', null, 'C' + (i + 1)));
      bars.push(bar);
      barBox.appendChild(barWrap);
      return h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:10px' },
        h('b', { style: 'width:52px;flex:none' }, 'Cell ' + (i + 1)), range, num, h('span', { style: 'color:var(--ink-3)' }, 'V'));
    });

    function set(i, x, from) {
      vals[i] = Math.round(x * 100) / 100;
      if (from !== 'range') ranges[i].value = vals[i];
      if (from !== 'num') nums[i].value = vals[i].toFixed(2);
      SAC.store.set('pin-cells', vals);
      update();
    }
    function setAll(arr) {
      arr.forEach((x, i) => { vals[i] = x; ranges[i].value = x; nums[i].value = x.toFixed(2); });
      SAC.store.set('pin-cells', vals);
      update();
    }

    function update() {
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      const lvl = levelOf(vals);
      const imb = imbalanceOf(vals);
      const low = vals.indexOf(Math.min(...vals)) + 1;
      bars.forEach((b, i) => {
        const frac = Math.max(0.04, Math.min(1, (vals[i] - 3.0) / (4.3 - 3.0)));
        b.style.height = (frac * 100).toFixed(0) + '%';
        b.style.background = cellColor(vals[i]);
      });
      out.replaceChildren(
        h('div', { class: 'stats' },
          stat(fmt(sum), 'V', 'tổng điện áp pin'),
          h('div', { class: 'stat' },
            h('span', { class: 'stat-val' }, '~' + pctOf(avg).toFixed(0), h('span', { class: 'stat-unit' }, '%')),
            h('span', { class: 'stat-label' }, 'còn lại, theo trung bình ', fmt(avg), ' V/cell ', SAC.rich('{est}')))),
        h('p', { class: lvl.cls }, h('b', null, lvl.label), lvl.text),
        h('p', { class: imb.cls }, h('b', null, 'Lệch cell'), imb.text + (Math.max(...vals) - Math.min(...vals) >= 0.05 ? ' Cell thấp nhất: cell ' + low + '.' : '')));
    }

    const presetBar = h('div', { class: 'chips', style: 'margin-bottom:16px' },
      PRESETS.map((p) => h('button', { class: 'chip', type: 'button', onclick: () => setAll(p.v.slice()) }, p.label)));

    const card = h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Nhập điện áp từng cell'),
      presetBar,
      h('div', { class: 'grid-2' },
        h('div', null, rows, barBox),
        out),
      h('p', { style: 'margin-top:16px;font-size:14px;color:var(--ink-2)' }, SAC.rich(
        'Đo lúc **nghỉ ít nhất 30 phút, không tải**. Phần trăm chỉ là ước tính, sai ±5–10%. ' +
        'Ngưỡng 3,5 V và 3,3 V là lúc bay có tải (FC báo 14,0 V và 13,2 V); đo nghỉ thì 3,69 V đã ≈ 10%.')));
    update();
    return card;
  }

  const DEF = {
    num: 2,
    title: 'Pin 4S: đọc, đo, biết khi nào bỏ',
    short: 'Pin 4S',
    kicker: 'Ovonic 4S 5300 mAh',
    lead: 'Bốn cell nối tiếp, 16,80 V khi đầy. Đo từng cell trước mỗi lần sạc, ghi sổ, và bỏ pin đúng lúc.',
  };

  SAC.chapter('pin', Object.assign({}, DEF, {
    render(root) {
      root.appendChild(SAC.head(DEF));

      // ---- 3D + hình 2D có chú thích ----
      let viewer = null;
      const view = h('div', { class: 'v3d' });
      root.appendChild(view);
      requestAnimationFrame(() => {
        viewer = SAC.view3d(view, {
          scene: 'battery', view: 'iso', hotspots: true,
          onPick(part) { if (part) showFig(figView, part); },
        });
      });

      let figView = 'top';
      const figHost = h('div');
      const chipEls = {};
      const chips = h('div', { class: 'chips', style: 'margin:14px 0 22px' });
      function showFig(vw, part) {
        figView = vw;
        Object.keys(chipEls).forEach((k) => chipEls[k].classList.toggle('on', k === vw));
        const c = callout(SAC.diag.battery(vw), BATT_ITEMS, (p) => { if (viewer) viewer.highlight(p); });
        figHost.replaceChildren(c.el);
        if (part) c.pin(part);
      }
      BATT_VIEWS.forEach(([vw, label]) => {
        chipEls[vw] = h('button', { class: 'chip', type: 'button', onclick: () => showFig(vw) }, label);
        chips.appendChild(chipEls[vw]);
      });
      root.append(chips, figHost);
      showFig('top');

      root.appendChild(h('div', { class: 'stats space' },
        stat('14,8', 'V', 'danh định, 3,70 V mỗi cell'),
        stat('16,80', 'V', 'đầy, 4,20 V mỗi cell'),
        stat('15,2–15,4', 'V', 'cất giữ, 3,80–3,85 V mỗi cell'),
        stat('78,4', 'Wh', '14,8 V × 5,3 Ah, dưới 100 Wh')));

      // ---- Thông số + đọc nhãn ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Thông số viên của dự án'),
        h('div', { class: 'grid-2' },
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Theo hồ sơ dự án'), SAC.table(null, [
            ['Cấu hình', '4S1P, 5300 mAh = 78,4 Wh'],
            ['Đầu xả', 'XT60'],
            ['Cân bằng', 'JST-XH 5 chân'],
            ['Dòng xả C', '110C theo hồ sơ. **Chưa xác minh**, đọc nhãn.'],
            ['Khối lượng', '423 g theo hồ sơ. Cần cân lại.'],
            ['Kích thước', '135 × 40 × 30 mm {est}, đáng ngờ. Cần đo.'],
            ['Cỡ dây, độ dài dây', 'Chưa xác minh.'],
            ['Dòng sạc tối đa', 'Chưa xác minh. Mặc định an toàn 1C = 5,3 A. Bạn sạc 3,0 A.'],
          ], 'kv')),
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Đọc nhãn trên pin'), SAC.table(null, [
            ['`14.8V` · `4S1P`', '4 cell nối tiếp. Máy phải đặt đúng 4S.'],
            ['`5300mAh`', 'Dung lượng. Nhân 14,8 V ra Wh.'],
            ['`xxC`', 'Dòng xả liên tục = C × 5,3 A. Một bảng ghi 110C, bảng khác ghi 50C.'],
            ['Dòng sạc ghi trên nhãn', 'Nếu có thì theo nhãn, đừng vượt.'],
          ], 'kv'))),
        h('p', { class: 'tip', style: 'margin-top:20px' }, SAC.rich('**C nào cũng đủ:** drone rút tối đa ~58 A, tức ~11C. Mọi viên từ 35C trở lên đều thừa. Giới hạn thật là đầu XT60, ~60 A liên tục.')),
        h('div', { class: 'card flat', style: 'margin-top:20px' },
          h('div', { class: 'card-title' }, 'Việc 5 phút khi có pin trong tay'),
          SAC.steps('pin-viec-5-phut', [
            { t: 'Chụp 6 mặt viên pin.', d: 'Đọc dòng C và mã trên nhãn.' },
            { t: 'Thước kẹp: dài × rộng × cao.', d: 'Đo cả độ dài dây xả và dây cân bằng.' },
            { t: 'Cân khối lượng trên cân bếp.' },
            { t: 'Đo mốc: BATT METER và nội trở từng cell lúc pin đầy.', d: 'Ghi vào sổ pin ở chương 5.' },
          ]))));

      // ---- Máy tính điện áp ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Đọc điện áp từng cell'),
        cellTool()));

      // ---- Giắc cân bằng + đo bằng đồng hồ ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Giắc cân bằng và đồng hồ vạn năng'),
        h('div', { class: 'grid-2' },
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Giắc JST-XH 5 chân'), SAC.diag.balancePinout()),
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Điện áp theo từng chân'), SAC.table(['Chân', 'Nối với', 'So với chân 1'], [
            ['1 (dây đen)', 'Âm pin, GND', '0 V'],
            ['2', 'Dương cell 1', '~3,7–4,2 V'],
            ['3', 'Dương cell 2', '~7,4–8,4 V'],
            ['4', 'Dương cell 3', '~11,1–12,6 V'],
            ['5 (dây đỏ)', 'Dương pin', '~14,8–16,8 V'],
          ]), h('p', { style: 'margin-top:12px;font-size:14px;color:var(--ink-2)' }, SAC.rich('Điện áp cell N = chân N+1 trừ chân N. Màu dây giữa có thể khác tuỳ hãng.')))),
        h('div', { class: 'card', style: 'margin-top:20px' },
          h('div', { class: 'card-title' }, 'Đo bằng đồng hồ'),
          SAC.steps('pin-do-dong-ho', [
            { t: 'Đặt đồng hồ ở thang DC V, từ 20 V trở lên.' },
            { t: 'Xác nhận chân 1 là âm.', d: 'Que đen vào dây âm XT60, que đỏ vào chân 1: phải gần 0 V.' },
            { t: 'Que đen giữ ở chân 1, que đỏ lần lượt chân 2, 3, 4, 5.', d: 'Ví dụ đọc được 4,08 · 8,16 · 12,26 · 16,36 V.' },
            { t: 'Trừ hai số liền nhau ra từng cell.', d: 'Ví dụ trên: 4,08 · 4,08 · 4,10 · 4,10 V, lệch 0,02 V.' },
          ]),
          h('p', { class: 'warn', style: 'margin-top:16px' }, SAC.rich('**Que nhọn dễ chập hai chân kề nhau.** Giữ chắc tay, hoặc dùng que có đầu bọc.'))),
        h('p', { class: 'note', style: 'margin-top:20px' }, SAC.rich('Nhanh hơn: bút đo cell, hoặc BATT METER của máy sạc. Xem '), h('a', { href: '#ch-quy-trinh' }, 'chương 5'), '.')));

      // ---- Nội trở ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Nội trở (IR)'),
        h('div', { class: 'grid-2' },
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Cách đo'), SAC.table(null, [
            ['Chương trình', '`BATT RESISTANCE`'],
            ['Cắm', 'Cả dây chính lẫn dây cân bằng.'],
            ['Điều kiện', 'Pin đầy 4,20 V/cell, cùng nhiệt độ, cùng máy.'],
            ['Mốc', 'Ghi 4 số lúc pin mới.'],
          ], 'kv')),
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Đọc kết quả'), SAC.table(null, [
            ['Khoẻ', '~2–5 mΩ/cell {est}'],
            ['Cũ', 'trên ~6–8 mΩ/cell {est}'],
            ['Bỏ pin', 'Một cell **gấp đôi** các cell còn lại.'],
            ['Lưu ý', 'Máy sạc rẻ: chỉ so với chính nó, không so với số máy khác.'],
          ], 'kv'))),
        h('p', { class: 'note', style: 'margin-top:20px' }, SAC.rich('Dải mΩ là ngoại suy từ viên 1500 mAh (dưới 10 mΩ tốt, trên 20 mΩ nghỉ hưu), **chưa xác minh** cho viên 5300 mAh. Tin so sánh với mốc của chính pin hơn tin con số tuyệt đối.'))));

      // ---- Khi nào bỏ pin ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Dấu hiệu nên bỏ pin'),
        h('p', { class: 'danger' }, SAC.rich('**Pin phồng: không sạc, không bay.** Phồng không sửa được.')),
        h('div', { class: 'card', style: 'margin-top:20px' }, SAC.table(['Dấu hiệu', 'Việc cần làm'], [
          ['Vỏ phồng, căng, không còn phẳng', 'Bỏ pin.'],
          ['Móp, rách vỏ, dây hở', 'Bỏ pin.'],
          ['Một cell lần nào cũng thấp hơn, hoặc lệch quá 0,2 V', 'Cho nghỉ hưu.'],
          ['Một cell có nội trở gấp đôi các cell khác', 'Cho nghỉ hưu.'],
          ['Nóng khi sạc ở 1C trở xuống, hoặc sau bay nóng không cầm quá 10 giây', 'Ngừng, để nguội. Lặp lại thì bỏ.'],
        ])),
        h('p', { class: 'warn', style: 'margin-top:20px' }, SAC.rich('**Sạc trong 0–45 °C.** Pin còn ấm sau bay thì chờ nguội. Sau bay nên dưới 60 °C.'))));
    },
  }));
})();
