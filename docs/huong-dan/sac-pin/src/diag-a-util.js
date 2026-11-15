/* Lane 3D/2D — tiện ích SVG dùng chung + SAC.dims (SSOT kích thước máy/pin, mm).
   scene3d.js (bản 3D) và mọi diag-*.js (bản 2D) đọc CÙNG bảng này để hai bản khớp nhau.
   Nguồn: manual V3.10 (135 x 144 x 36 mm), ảnh Pololu 0J6154/0J6155 (nhìn thẳng cạnh trái/phải, đo theo
   chân XH 2,5 mm), bản vẽ nét manual-images/img-001,002. Mục ghi EST là ước lượng từ ảnh, chưa đo máy thật.
   Hệ toạ độ: x từ mép trái 0..144 (nhìn từ phía nút bấm); d = khoảng cách từ mép TRƯỚC (phía nút) 0..135;
   y = độ cao so với mặt bàn (chân đế chạm y=0). */
(function () {
  'use strict';
  const SAC = (window.SAC = window.SAC || {});
  const diag = (SAC.diag = SAC.diag || {});

  SAC.dims = {
    W: 144, D: 135, H: 36,              // manual: 135 x 144 x 36 mm (H gồm chân đế; ảnh cạnh cho 33 + 4)
    FOOT: 4, BODY_BOT: 4, FRONT_TOP: 29, REAR_TOP: 36,   // EST (đo từ ảnh 0J6155, thang 8,3 px/mm)
    STEP0: 77, STEP1: 84,               // EST: bậc dốc nối tầng trước (thấp) và tầng sau (cao), d
    BODY_D: 129, FIN: 6,                // thân 129 + cánh tản nhiệt nhô 6 = 135
    FINS_Y: [7, 12, 17, 22, 27, 32], FIN_T: 1.5,         // EST
    BTN: { x: [30, 48.5, 67, 85.5], d: 13, r: 4.5, ids: ['btn-batt', 'btn-dec', 'btn-inc', 'btn-enter'] }, // EST
    LCD: { x0: 24, x1: 90, d0: 41, d1: 61, frame: 3 },   // cửa sổ ~66 x 20 mm (báo cáo 3D), EST
    STRIP: { x0: 20, x1: 118, d0: 28, d1: 37 },          // dải nhãn chế độ (3 cột x 2 hàng)
    BAN: { neg: { d: 13, y: 15.7 }, pos: { d: 26.7, y: 15.7 }, r: 5.3 },   // đo từ 0J6155
    HOLE: { d: 20, y: 23.5, r: 2.5 },                    // lỗ tròn nhỏ, công dụng chưa xác minh
    BAL_PITCH: 2.5, BAL_MARGIN: 4.9, BAL_H: 5.5,         // JST-XH: rộng = 2,5 x (n-1) + 4,9
    BAL: [                                               // hàng trên 5/4/3 chân, hàng dưới 7/6 chân (đo từ 0J6155)
      { id: 'bal-4s', n: 5, d0: 34.9, y0: 19.3, label: '4 cells' },
      { id: 'bal-3s', n: 4, d0: 50.0, y0: 19.3, label: '3 cells' },
      { id: 'bal-2s', n: 3, d0: 62.2, y0: 19.3, label: '2 cells' },
      { id: 'bal-6s', n: 7, d0: 34.9, y0: 13.6, label: '6 cells' },
      { id: 'bal-5s', n: 6, d0: 55.0, y0: 13.6, label: '5 cells' },
    ],
    LEFT: {                                              // cạnh trái, đo từ 0J6154
      ac: { d0: 74.4, d1: 98.2, y0: 11.9, y1: 30.8 },
      dc: { d0: 63.4, d1: 72.2, y0: 14.4, y1: 22.3 },
      usb: { d0: 37.8, d1: 45.7, y0: 11.9, y1: 14.6 },
      temp: { d0: 25, d1: 34, y0: 15, y1: 18 },
      caution: { d0: 101, d1: 127, y0: 16.8, y1: 27.8 },
      ventTall: [8, 13.5, 19, 51, 56.5],                 // khe cao
      ventShort: [25, 30, 35, 40, 45],                   // khe thấp (nằm trên cổng USB / nhiệt)
      ventW: 3.6, ventY0: 16.8, ventY1: 26.5, ventShortY0: 20,
    },
    FEET: { x: [18, 126], d: [17.5, 120], w: 18, l: 10.6 },
    SCREWS: [[3, 24.5], [3, 7.6], [69, 31], [127.5, 29.3], [127.5, 8.2]],   // (d, y) mỗi tấm đầu; thấy 5 vít trên ảnh
    // Nhãn "Balance Socket" in trên mặt máy (manual tr.02, ảnh bìa): bảng 2 hàng, dấu ⊕ ở đầu TRƯỚC, dấu ⊖ ở đầu SAU.
    // Sách tr.10: dây đen của giắc cân bằng phải thẳng hàng với dấu ⊖ => chân 1 (đen) của mọi ổ nằm về phía SAU máy.
    BAL_NEG_BACK: true,
    BATT: { L: 155, W: 43, H: 35 },                      // EST: pin 4S 5300 hộp cứng; Ovonic chưa xác minh (Tattu 140x41x42, ZOP 139x46x50)
  };

  // Bảng nhãn ổ cân bằng: mỗi hàng là các ô liền nhau theo d, khớp 1:1 với ổ vật lý (hàng trên 4/3/2 cells, hàng dưới 6/5 cells).
  SAC.balTable = function () {
    const k = SAC.dims, w = (s) => k.BAL_PITCH * (s.n - 1) + k.BAL_MARGIN;
    const row = (ids) => {
      const ss = ids.map((id) => k.BAL.find((s) => s.id === id)), out = [];
      ss.forEach((s, i) => {
        const a = i === 0 ? s.d0 : (ss[i - 1].d0 + w(ss[i - 1]) + s.d0) / 2, b = i === ss.length - 1 ? s.d0 + w(s) : (s.d0 + w(s) + ss[i + 1].d0) / 2;
        out.push({ id: s.id, text: (s.n - 1) + ' cells', d0: a, d1: b });
      });
      return out;
    };
    return { title: 'Balance Socket', rows: [row(['bal-4s', 'bal-3s', 'bal-2s']), row(['bal-6s', 'bal-5s'])], d0: k.BAL[0].d0, d1: Math.max(...k.BAL.map((s) => s.d0 + w(s))) };
  };

  // ---------- SVG helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  diag.NS = NS;
  diag.el = function el(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v);
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  };
  diag.svg = function svg(vb, title) {
    const s = diag.el('svg', {
      viewBox: vb.join(' '), role: 'img', 'aria-label': title, class: 'sac-diag',
      style: 'width:100%;height:auto;display:block;font-family:var(--font);color:var(--ink)',
    });
    s.appendChild(diag.el('title', null, title));
    return s;
  };
  // Bảng kiểu dùng chung (biến CSS của trang → tự đổi theo nền sáng/tối)
  diag.C = {
    ink: 'var(--ink)', ink2: 'var(--ink-2)', ink3: 'var(--ink-3)', line: 'var(--line)', accent: 'var(--accent)',
    soft: 'var(--accent-soft)', surface: 'var(--surface)', surface2: 'var(--surface-2)',
    danger: 'var(--danger)', ok: 'var(--ok)', warn: 'var(--warn)',
  };
  // Dây/giắc "đen": màu cố định (không đảo thành trắng ở nền tối) + quầng sáng nhẹ để vẫn thấy trên nền tối.
  diag.BLACK = '#1b1e24';
  diag.blk = (col) => (col === diag.C.ink ? diag.BLACK : col);
  diag.blkStyle = (col) => (col === diag.C.ink ? 'filter:drop-shadow(0 0 0.9px rgba(170,180,195,.95))' : null);
  // g có data-part; shape(attrs...) tiện cho rect/circle/path/line/text
  diag.g = (part, attrs, ...kids) => diag.el('g', Object.assign(part ? { 'data-part': part } : {}, attrs), ...kids);
  diag.shape = (tag, a) => diag.el(tag, Object.assign({ fill: 'none', stroke: diag.C.ink, 'stroke-width': 0.6, 'vector-effect': 'non-scaling-stroke' }, a));
  diag.text = (s, x, y, a) => diag.el('text', Object.assign({ x, y, fill: diag.C.ink2, 'font-size': 3.2, 'text-anchor': 'middle' }, a), s);
  // đường kích thước có mũi tên: dim(svg, x1,y1,x2,y2, 'nhãn', {off})
  diag.dim = function dim(parent, x1, y1, x2, y2, label, a) {
    a = a || {};
    const C = diag.C, g = diag.el('g', { 'data-dim': '1', stroke: C.ink3, fill: C.ink3, 'stroke-width': 0.5 });
    const ang = Math.atan2(y2 - y1, x2 - x1), t = 1.6;
    const arrow = (x, y, s) => `M${x},${y} l${s * t * Math.cos(ang - 0.4)},${s * t * Math.sin(ang - 0.4)} M${x},${y} l${s * t * Math.cos(ang + 0.4)},${s * t * Math.sin(ang + 0.4)}`;
    g.append(diag.el('line', { x1, y1, x2, y2, 'vector-effect': 'non-scaling-stroke' }),
      diag.el('path', { d: arrow(x1, y1, 1) + arrow(x2, y2, -1), fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const vert = Math.abs(x2 - x1) < Math.abs(y2 - y1);
    g.append(diag.el('text', Object.assign({ x: mx, y: my, 'font-size': 3, 'text-anchor': 'middle', stroke: 'none',
      transform: vert ? `rotate(-90 ${mx} ${my}) translate(0 -1.2)` : 'translate(0 -1.2)' }, a.text), label));
    parent.append(g);
    return g;
  };

  // Tô sáng: bộ phận khớp được viền accent + sáng, các bộ phận khác mờ đi. partId = null → bỏ tô.
  diag.highlight = function highlight(svg, partId) {
    if (!svg) return;
    const parts = svg.querySelectorAll('[data-part]');
    for (const g of parts) {
      const on = partId != null && g.dataset.part === partId;
      g.style.transition = 'opacity .15s';
      g.style.opacity = partId == null || on ? '1' : '0.28';
      g.style.filter = on ? 'drop-shadow(0 0 1.2px var(--accent))' : '';
      g.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline').forEach((s) => {
        if (on) {
          if (s.dataset.sw0 == null) { s.dataset.sw0 = s.getAttribute('stroke-width') || ''; s.dataset.st0 = s.getAttribute('stroke') || ''; }
          s.setAttribute('stroke', 'var(--accent)');
          s.setAttribute('stroke-width', String(Math.max(1.1, (parseFloat(s.dataset.sw0) || 0.6) * 1.8)));
        } else if (s.dataset.sw0 != null) {
          s.setAttribute('stroke-width', s.dataset.sw0);
          if (s.dataset.st0) s.setAttribute('stroke', s.dataset.st0); else s.removeAttribute('stroke');
        }
      });
    }
  };
})();
