/* Lane 3D/2D — SAC.diag.face(view): hình chiếu trực giao của máy sạc, đơn vị 1 = 1 mm, dùng SAC.dims (cùng bảng với 3D).
   view: front (cạnh dài có sọc, gần nút) | back (cạnh dài sọc phía sau) | top | left (AC, DC, USB) | right (OUTPUT, cân bằng) | bottom.
   Mỗi bộ phận là <g data-part="..."> (xem danh sách ID trong brainstorm). Màu qua biến CSS → đổi theo nền sáng/tối. */
(function () {
  'use strict';
  const SAC = window.SAC, diag = SAC.diag, C = diag.C, el = diag.el, g = diag.g, shape = diag.shape, text = diag.text;
  const K = SAC.dims;
  const P = 14;                              // lề cho đường kích thước
  const body = (a) => Object.assign({ fill: C.soft, stroke: C.accent, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, a);
  const thin = (a) => Object.assign({ fill: 'none', stroke: C.ink3, 'stroke-width': 0.6 }, a);
  const rect = (x, y, w, h, a) => shape('rect', Object.assign({ x, y, width: w, height: h }, a));
  const circle = (cx, cy, r, a) => shape('circle', Object.assign({ cx, cy, r }, a));
  const poly = (pts, a) => shape('polygon', Object.assign({ points: pts.map((p) => p.join(',')).join(' ') }, a));
  const note = (s, x, y, a) => text(s, x, y, Object.assign({ 'font-size': 3.4, fill: C.ink3 }, a));

  // Cánh tản nhiệt: nhìn cạnh, 6 thanh nhô ra phía sau
  function finsSide(sx, ys, dir) {            // sx(d) → x vẽ; ys(y) → y vẽ; dir = +1 (phía sau ở bên phải) hay -1
    const gr = g('heatsink');
    K.FINS_Y.forEach((y) => {
      const x0 = sx(K.BODY_D), x1 = sx(K.D);
      gr.append(rect(Math.min(x0, x1), ys(y + K.FIN_T / 2), Math.abs(x1 - x0), K.FIN_T, body({ 'stroke-width': 0.9 })));
    });
    return gr;
  }
  function screws(sx, ys) {
    const gr = el('g', { 'data-deco': 'screws' });
    K.SCREWS.forEach(([d, y]) => {
      const cx = sx(d), cy = ys(y);
      gr.append(circle(cx, cy, 2.2, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.8 }),
        shape('path', { d: `M${cx - 1.4},${cy} h2.8 M${cx},${cy - 1.4} v2.8`, stroke: C.ink, 'stroke-width': 0.7 }));
    });
    return gr;
  }
  function feetSide(sx, ys) {
    const gr = g('feet');
    K.FEET.d.forEach((d) => gr.append(rect(sx(d) - K.FEET.l / 2, ys(K.FOOT), K.FEET.l, K.FOOT, { fill: C.ink, stroke: C.ink, 'stroke-width': 0.6, opacity: 0.85 })));
    return gr;
  }
  // Biên dạng cạnh (d, y): hai tầng + bậc vát
  const profile = (sx, ys) => poly([[0, K.BODY_BOT], [K.BODY_D, K.BODY_BOT], [K.BODY_D, K.REAR_TOP], [K.STEP1, K.REAR_TOP], [K.STEP0, K.FRONT_TOP], [0, K.FRONT_TOP]].map(([d, y]) => [sx(d), ys(y)]), body());

  function sideView(flip, title) {
    // flip=false: phải (trước ở trái); flip=true: trái (trước ở bên phải)
    const sx = flip ? (d) => K.D - d : (d) => d, ys = (y) => K.H - y;
    const svg = diag.svg([-P, -P + 2, K.D + 2 * P, K.H + 2 * P + 6], title);
    svg.append(profile(sx, ys), feetSide(sx, ys), finsSide(sx, ys), screws(sx, ys));
    diag.dim(svg, 0, K.H + 8, K.D, K.H + 8, '135 mm (độ sâu, gồm cánh tản nhiệt)');
    diag.dim(svg, K.D + 8, 0, K.D + 8, K.H, '36 mm', {});
    return { svg, sx, ys };
  }

  function right() {
    const { svg, sx, ys } = sideView(false, 'Cạnh phải: hai lỗ OUTPUT và năm ổ cân bằng');
    [['out-neg', K.BAN.neg, C.ink], ['out-pos', K.BAN.pos, C.danger]].forEach(([id, p, col]) => {
      const gr = g(id), cx = sx(p.d), cy = ys(p.y);
      gr.append(circle(cx, cy, K.BAN.r, { fill: col, 'fill-opacity': 0.9, stroke: C.ink, 'stroke-width': 0.8 }),
        circle(cx, cy, 3.6, { fill: C.warn, stroke: C.ink, 'stroke-width': 0.6 }), circle(cx, cy, 2, { fill: C.ink, stroke: 'none' }));
      svg.append(gr, text(id === 'out-neg' ? '−' : '+', cx, cy + K.BAN.r + 5, { 'font-size': 5, fill: id === 'out-neg' ? C.ink : C.danger, 'font-weight': 700 }));
    });
    svg.append(circle(sx(K.HOLE.d), ys(K.HOLE.y), K.HOLE.r, { fill: C.ink, 'fill-opacity': 0.8, stroke: 'none' }));
    
    K.BAL.forEach((s) => {
      const w = K.BAL_PITCH * (s.n - 1) + K.BAL_MARGIN, x = sx(s.d0), y = ys(s.y0 + K.BAL_H), gr = g(s.id);
      gr.append(rect(x, y, w, K.BAL_H, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.9, rx: 0.6 }));
      for (let i = 0; i < s.n; i++) { const p1 = K.BAL_NEG_BACK ? i === s.n - 1 : i === 0; gr.append(circle(x + K.BAL_MARGIN / 2 + i * K.BAL_PITCH, y + K.BAL_H / 2, p1 ? 0.8 : 0.55, { fill: p1 ? diag.BLACK : C.warn, stroke: p1 ? C.ink3 : 'none', 'stroke-width': 0.25 })); }
      gr.append(text(s.label, x + w / 2, y + K.BAL_H + 3.2, { 'font-size': 2.4 }));
      svg.append(gr);
    });
    { const T = SAC.balTable(), yy = ys(K.BAL[3].y0) + 11;
      svg.append(text('⊕', sx(T.d0 - 3), yy, { 'font-size': 5, 'font-weight': 700 }), text('⊖', sx(T.d1 + 3), yy, { 'font-size': 5, 'font-weight': 700 }),
        note('chấm đen = chân 1 (dây đen), về phía ⊖ (sau)', sx((T.d0 + T.d1) / 2), yy + 5, { 'font-size': 2.4 })); }
    svg.append(note('trước', 4, -3, { 'text-anchor': 'start' }), note('sau', K.D - 4, -3, { 'text-anchor': 'end' }),
      note('Nhìn thẳng vào cạnh phải. Vị trí chi tiết đo từ ảnh, ước lượng.', K.D / 2, K.H + 22, { 'font-size': 3 }));
    return svg;
  }

  function left() {
    const { svg, sx, ys } = sideView(true, 'Cạnh trái: ổ AC, jack DC, khe gió, micro USB PC LINK, cổng nhiệt độ');
    const L = K.LEFT, box = (b) => ({ x: sx(b.d1), y: ys(b.y1), w: b.d1 - b.d0, h: b.y1 - b.y0 });
    // khe gió
    const vents = el('g', { 'data-deco': 'vents' });
    L.ventTall.forEach((d) => vents.append(rect(sx(d) - L.ventW / 2, ys(L.ventY1), L.ventW, L.ventY1 - L.ventY0, { rx: 1.8, fill: C.ink, 'fill-opacity': 0.8, stroke: 'none' })));
    L.ventShort.forEach((d) => vents.append(rect(sx(d) - L.ventW / 2, ys(L.ventY1), L.ventW, L.ventY1 - L.ventShortY0, { rx: 1.8, fill: C.ink, 'fill-opacity': 0.8, stroke: 'none' })));
    svg.append(vents);
    // nhãn CAUTION
    const c = box(L.caution);
    svg.append(rect(c.x, c.y, c.w, c.h, thin({ stroke: C.ink2 })), poly([[c.x + 3.6, c.y + 2], [c.x + 6.4, c.y + 6.8], [c.x + 0.8, c.y + 6.8]], { fill: C.danger, stroke: 'none' }),
      text('CAUTION', c.x + 8, c.y + 4.2, { 'text-anchor': 'start', 'font-size': 2.8, 'font-weight': 700, fill: C.ink2 }),
      text('RISK OF ELECTRIC SHOCK', c.x + 8, c.y + 7.2, { 'text-anchor': 'start', 'font-size': 1.5 }));
    // AC (C6 ba chấu kiểu tai chuột)
    let b = box(L.ac), gr = g('ac-inlet');
    gr.append(rect(b.x, b.y, b.w, b.h, { fill: C.ink, 'fill-opacity': 0.92, stroke: C.ink, 'stroke-width': 0.9, rx: 1 }),
      rect(b.x + 1.6, b.y + 1.6, b.w - 3.2, b.h - 3.2, { fill: 'none', stroke: C.ink3, 'stroke-width': 0.5, rx: 1 }));
    [[b.w / 2, b.h * 0.28], [b.w * 0.3, b.h * 0.62], [b.w * 0.7, b.h * 0.62]].forEach(([px, py]) => gr.append(circle(b.x + px, b.y + py, 1.5, { fill: C.surface2, stroke: C.ink3, 'stroke-width': 0.5 })));
    svg.append(gr, text('AC IN~ 100-240V', b.x + b.w / 2, b.y + b.h + 4.6, { 'font-size': 2.7 }), text('50/60Hz', b.x + b.w / 2, b.y + b.h + 8, { 'font-size': 2.7 }));
    // DC
    b = box(L.dc); gr = g('dc-jack');
    gr.append(rect(b.x, b.y, b.w, b.h, { fill: C.ink, 'fill-opacity': 0.92, stroke: C.ink, 'stroke-width': 0.9, rx: 0.8 }), circle(b.x + b.w / 2, b.y + b.h / 2, 2.6, { fill: 'none', stroke: C.ink3, 'stroke-width': 0.6 }), circle(b.x + b.w / 2, b.y + b.h / 2, 0.8, { fill: C.surface2, stroke: 'none' }));
    svg.append(gr, text('DC IN', b.x + b.w / 2, b.y + b.h + 4.6, { 'font-size': 2.7 }), text('11-18V', b.x + b.w / 2, b.y + b.h + 8, { 'font-size': 2.7 }));
    // USB
    b = box(L.usb); gr = g('usb-pclink');
    gr.append(rect(b.x, b.y, b.w, b.h, { fill: C.surface2, stroke: C.ink, 'stroke-width': 0.9, rx: 0.5 }), rect(b.x + 1.2, b.y + 0.7, b.w - 2.4, b.h - 1.4, { fill: C.ink, stroke: 'none', rx: 0.3 }));
    svg.append(gr, text('PC LINK', b.x + b.w / 2, b.y + b.h + 5.5, { 'font-size': 2.8 }));
    // nhiệt độ
    b = box(L.temp); gr = g('temp-port');
    gr.append(rect(b.x, b.y, b.w, b.h, { fill: C.ink, 'fill-opacity': 0.92, stroke: C.ink, 'stroke-width': 0.9, rx: 0.4 }));
    [-2.54, 0, 2.54].forEach((o) => gr.append(rect(b.x + b.w / 2 + o - 0.4, b.y + 0.8, 0.8, b.h - 1.6, { fill: C.warn, stroke: 'none' })));
    svg.append(gr, text('°C', b.x + b.w / 2, b.y + b.h + 7, { 'font-size': 3 }));
    svg.append(note('trước', K.D - 4, -3, { 'text-anchor': 'end' }), note('sau', 4, -3, { 'text-anchor': 'start' }),
      note('Nhìn thẳng vào cạnh trái. Vị trí chi tiết đo từ ảnh, ước lượng.', K.D / 2, K.H + 22, { 'font-size': 3 }));
    return svg;
  }

  function top() {
    const vbH = K.D + 2 * P + 2, svg = diag.svg([-P, -P, K.W + 2 * P, vbH], 'Mặt trên: màn hình LCD và bốn nút');
    const py = (d) => K.D - d;                // sau ở trên, trước ở dưới
    // cánh tản nhiệt (nhìn từ trên chỉ thấy thanh trên cùng)
    const hs = g('heatsink'); hs.append(rect(2, py(K.D), K.W - 4, K.FIN, body({ 'stroke-width': 0.9 })));
    svg.append(hs);
    svg.append(rect(0, py(K.BODY_D), K.W, K.BODY_D, body({ rx: 2 })));
    svg.append(rect(0.8, py(K.STEP0), K.W - 1.6, K.STEP0 - 0.8, thin({ stroke: C.accent, 'stroke-width': 0.6, rx: 1.5 })),
      shape('line', { x1: 0, x2: K.W, y1: py(K.STEP1), y2: py(K.STEP1), stroke: C.accent, 'stroke-width': 0.6, 'stroke-dasharray': '2 2' }),
      shape('line', { x1: 0, x2: K.W, y1: py(K.STEP0), y2: py(K.STEP0), stroke: C.accent, 'stroke-width': 0.6, 'stroke-dasharray': '2 2' }),
      // Nhãn "tầng cao / bậc dốc / tầng thấp" bỏ: chúng đè lên chữ in trên máy và bảng ổ cân bằng.
      );
    // dải nhãn chế độ
    const S = K.STRIP, cw = (S.x1 - S.x0) / 3;
    for (let i = 0; i < 3; i++) svg.append(rect(S.x0 + i * cw + 0.5, py(S.d1), cw - 1, S.d1 - S.d0, thin({ rx: 1 })));
    [['LiPo/LiFe/LiIon/LiHV  1-6S', 'Circuit Power  50W'], ['NiMH/NiCd  1-15S', 'Charge  0.1-6.0A'], ['Pb(Lead Acid)  2-20V', 'Discharge  0.1-2.0A']].forEach((c, i) => {
      const cx = S.x0 + i * cw + cw / 2, mid = py((S.d0 + S.d1) / 2);
      svg.append(text(c[0], cx, mid - 0.6, { 'font-size': 2.1, fill: C.ink2 }), text(c[1], cx, mid + 3, { 'font-size': 2.1, fill: C.ink2 }));
    });
    // LCD
    const L = K.LCD, lg = g('lcd');
    lg.append(rect(L.x0 - L.frame, py(L.d1 + L.frame), L.x1 - L.x0 + 2 * L.frame, L.d1 - L.d0 + 2 * L.frame, { fill: C.ink, 'fill-opacity': 0.9, stroke: C.ink, 'stroke-width': 0.8, rx: 1.5 }),
      rect(L.x0, py(L.d1), L.x1 - L.x0, L.d1 - L.d0, { fill: C.accent, 'fill-opacity': 0.9, stroke: 'none' }),
      text('LiPo BALANCE CHG', (L.x0 + L.x1) / 2, py(L.d1) + 7.5, { fill: '#fff', 'font-size': 5, 'font-family': 'var(--mono)', 'font-weight': 600 }),
      text('3.0A 14.8V(4S)', (L.x0 + L.x1) / 2, py(L.d1) + 16.5, { fill: '#fff', 'font-size': 5, 'font-family': 'var(--mono)', 'font-weight': 600 }));
    svg.append(lg);
    // nút bấm
    K.BTN.x.forEach((x, i) => {
      const gr = g(K.BTN.ids[i]);
      gr.append(circle(x, py(K.BTN.d), K.BTN.r, { fill: C.surface, stroke: C.ink, 'stroke-width': 1 }), circle(x, py(K.BTN.d), K.BTN.r - 1.6, { fill: 'none', stroke: C.ink3, 'stroke-width': 0.5 }));
      svg.append(gr, text(['BATT/PROG', 'DEC.', 'INC.', 'ENTER'][i], x, py(K.BTN.d) - K.BTN.r - 7.2, { 'font-size': 2.8, 'font-weight': 700, fill: C.ink }));
    });
    { const y2 = py(K.BTN.d) - K.BTN.r - 3.4, bx = K.BTN.x, o = { 'font-size': 2.6 };
      svg.append(text('Stop', bx[0], y2, o), text('◄', bx[1], y2, o), text('Status', (bx[1] + bx[2]) / 2, y2, o), text('►', bx[2], y2, o), text('Start', bx[3], y2, o)); }
    // nhãn OUTPUT (⊟ − chuối trước, ⊞ + chuối sau) và bảng Balance Socket, đọc dọc theo mép phải
    { const vt = (s, x, d, a) => text(s, x, py(d), Object.assign({ transform: `rotate(-90 ${x} ${py(d)})`, 'font-size': 2.4 }, a)), T = SAC.balTable(), rowX = [[131.2, 134.7], [134.7, 138.2]];
      svg.append(vt('OUTPUT', 139, 8.5, { 'font-weight': 700 }), vt('−', 133.5, K.BAN.neg.d, { 'font-size': 4, 'font-weight': 800 }), vt('+', 133.5, K.BAN.pos.d, { 'font-size': 4, 'font-weight': 800 }),
        vt(T.title, 128.4, (T.d0 + T.d1) / 2, { 'font-weight': 700 }), vt('⊕', 134.7, T.d0 - 3.4, { 'font-size': 3.6 }), vt('⊖', 134.7, T.d1 + 3.4, { 'font-size': 3.6 }));
      T.rows.forEach((row, ri) => row.forEach((c) => { const [xa, xb] = rowX[ri]; svg.append(rect(xa, py(c.d1), xb - xa, c.d1 - c.d0, thin({ stroke: C.ink2 })), vt(c.text, (xa + xb) / 2 + 0.8, (c.d0 + c.d1) / 2, { 'font-size': 2 })); })); }
    const rt = el('g', { 'data-deco': 'print' });
    rt.append(text('iMAX B6AC V2', 14, py(112), { 'text-anchor': 'start', 'font-size': 9, 'font-weight': 800, 'font-style': 'italic', fill: C.accent, opacity: 0.8 }),
      text('AC/DC Dual Power · Professional Balance Charger/Discharger', 14, py(100), { 'text-anchor': 'start', 'font-size': 3.6, fill: C.ink3, 'font-style': 'italic' }),
      text('SKYRC', K.W - 10, py(112), { 'text-anchor': 'end', 'font-size': 7, 'font-weight': 800, fill: C.ink3 }));
    svg.append(rt);
    diag.dim(svg, 0, K.D + 8, K.W, K.D + 8, '144 mm');
    diag.dim(svg, K.W + 9, 0, K.W + 9, K.D, '135 mm');
    return svg;
  }

  function front() {
    const svg = diag.svg([-P, -P, K.W + 2 * P, K.H + 2 * P + 4], 'Cạnh dài phía trước (gần nút bấm), sọc ngang');
    const ys = (y) => K.H - y;
    svg.append(rect(0, ys(K.REAR_TOP), K.W, K.REAR_TOP - K.FRONT_TOP, thin({ stroke: C.accent })));   // tầng sau thấy phía trên
    svg.append(rect(0, ys(K.FRONT_TOP), K.W, K.FRONT_TOP - K.BODY_BOT, body({ rx: 1.5 })));
    for (let y = K.BODY_BOT + 2; y < K.FRONT_TOP - 1; y += 2.6) svg.append(shape('line', { x1: 1.5, x2: K.W - 1.5, y1: ys(y), y2: ys(y), stroke: C.accent, 'stroke-width': 0.5, opacity: 0.7 }));
    K.BTN.x.forEach((x, i) => { const gr = g(K.BTN.ids[i]); gr.append(rect(x - K.BTN.r, ys(K.FRONT_TOP + 2.4), K.BTN.r * 2, 2.4, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.9, rx: 1.2 })); svg.append(gr); });
    const feet = g('feet'); K.FEET.x.forEach((x) => feet.append(rect(x - K.FEET.w / 2, ys(K.FOOT), K.FEET.w, K.FOOT, { fill: C.ink, 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 0.6 }))); svg.append(feet);
    diag.dim(svg, 0, K.H + 8, K.W, K.H + 8, '144 mm');
    diag.dim(svg, K.W + 8, 0, K.W + 8, K.H, '36 mm');
    svg.append(note('Cạnh dài gần nút bấm: sọc ngang kín chiều cao', K.W / 2, K.H + 22, { 'font-size': 3 }));
    return svg;
  }

  function back() {
    const svg = diag.svg([-P, -P, K.W + 2 * P, K.H + 2 * P + 4], 'Cạnh dài phía sau: cánh tản nhiệt nhôm');
    const ys = (y) => K.H - y;
    svg.append(rect(0, ys(K.REAR_TOP), K.W, K.REAR_TOP - K.BODY_BOT, body({ rx: 1.5 })));
    const hs = g('heatsink');
    K.FINS_Y.forEach((y) => hs.append(rect(2, ys(y + K.FIN_T / 2), K.W - 4, K.FIN_T, { fill: C.surface, stroke: C.accent, 'stroke-width': 0.9, rx: 0.6 })));
    svg.append(hs);
    const feet = g('feet'); K.FEET.x.forEach((x) => feet.append(rect(x - K.FEET.w / 2, ys(K.FOOT), K.FEET.w, K.FOOT, { fill: C.ink, 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 0.6 }))); svg.append(feet);
    diag.dim(svg, 0, K.H + 8, K.W, K.H + 8, '144 mm');
    diag.dim(svg, K.W + 8, 0, K.W + 8, K.H, '36 mm');
    svg.append(note('Sáu cánh nhô ~6 mm, ước lượng', K.W / 2, K.H + 22, { 'font-size': 3 }));
    return svg;
  }

  function bottom() {
    const svg = diag.svg([-P, -P, K.W + 2 * P, K.D + 2 * P + 2], 'Mặt đáy: bốn chân đế và tem');
    const pd = (d) => d;                      // trước ở trên, sau ở dưới (nhìn từ dưới lên)
    svg.append(rect(0, 0, K.W, K.BODY_D, body({ rx: 2 })), rect(2, K.BODY_D, K.W - 4, K.FIN, body({ 'stroke-width': 0.9 })));
    const lb = g('label-bottom'), lw = 96, ld = 58, lx = (K.W - lw) / 2, ly = K.D / 2 + 4 - ld / 2;
    lb.append(rect(lx, ly, lw, ld, { fill: C.surface, stroke: C.ink2, 'stroke-width': 0.8, rx: 2 }),
      text('SKYRC  iMAX B6AC V2', lx + 5, ly + 9, { 'text-anchor': 'start', 'font-size': 4.6, 'font-weight': 700, fill: C.ink }),
      ...[0, 1, 2].map((i) => shape('line', { x1: lx + 5, x2: lx + lw - 38, y1: ly + 18 + i * 6, y2: ly + 18 + i * 6, stroke: C.ink3, 'stroke-width': 0.8 })),
      rect(lx + lw - 30, ly + ld - 26, 24, 20, { fill: C.accent, 'fill-opacity': 0.35, stroke: C.accent, 'stroke-width': 0.6, rx: 1.5 }),
      text('tem', lx + lw - 18, ly + ld - 15, { 'font-size': 3 }));
    svg.append(lb);
    const feet = g('feet');
    K.FEET.x.forEach((x) => K.FEET.d.forEach((d) => feet.append(rect(x - K.FEET.w / 2, pd(d) - K.FEET.l / 2, K.FEET.w, K.FEET.l, { fill: C.ink, 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 0.6, rx: 1.4 }))));
    svg.append(feet, note('trước', K.W / 2, -3), note('sau (cánh tản nhiệt)', K.W / 2, K.D + 6));
    svg.append(note('Nội dung tem minh hoạ; chân đế và tem đo từ ảnh, ước lượng', K.W / 2, K.D + 14, { 'font-size': 3 }));
    diag.dim(svg, 0, -8, K.W, -8, '144 mm');
    return svg;
  }

  diag.face = function face(view) {
    const map = { front, back, top, left, right, bottom };
    if (!map[view]) throw new Error('[SAC] diag.face view la: ' + view);
    return map[view]();
  };
})();
