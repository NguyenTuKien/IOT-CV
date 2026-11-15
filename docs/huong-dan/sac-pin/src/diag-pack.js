/* Lane 3D/2D — SAC.diag.battery(view), SAC.diag.balancePinout(), SAC.diag.lcd(l1, l2).
   Kích thước pin lấy từ SAC.dims.BATT (ước lượng 155 x 43 x 35 mm: Ovonic 4S 5300 chưa có số chính thức). */
(function () {
  'use strict';
  const SAC = window.SAC, diag = SAC.diag, C = diag.C, el = diag.el, g = diag.g, shape = diag.shape, text = diag.text;
  const B = SAC.dims.BATT;
  const rect = (x, y, w, h, a) => shape('rect', Object.assign({ x, y, width: w, height: h }, a));
  const circle = (cx, cy, r, a) => shape('circle', Object.assign({ cx, cy, r }, a));
  const note = (s, x, y, a) => text(s, x, y, Object.assign({ 'font-size': 3.4, fill: C.ink3 }, a));
  const pack = (a) => Object.assign({ fill: C.surface2, stroke: C.ink, 'stroke-width': 1.3, rx: 5 }, a);
  const wire = (d, col, w) => shape('path', { d, stroke: diag.blk(col), style: diag.blkStyle(col), 'stroke-width': w || 3.2, 'stroke-linecap': 'round', fill: 'none' });
  const EST = 'ước lượng, pin Ovonic 4S chưa có số đo chính thức';

  // XT60 đực nhìn trên/bên: 15,9 x 8,1 mm, đuôi hướng về phía pin
  function xt60Plan(x, y) {
    const gr = g('batt-xt60');
    gr.append(rect(x, y - 4.05, 15.9, 8.1, { fill: C.warn, 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 0.9, rx: 1 }),
      circle(x + 4.35, y, 2.1, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.6 }), circle(x + 11.55, y, 2.1, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.6 }));
    return gr;
  }

  function top() {
    const svg = diag.svg([-14, -14, B.L + 100, B.W + 40], 'Pin 4S nhìn từ trên');
    svg.append(g('batt').appendChild(rect(0, 0, B.L, B.W, pack())).parentNode);
    const lb = g('batt-label');
    lb.append(rect(3, 3, B.L - 6, B.W - 6, { fill: C.accent, 'fill-opacity': 0.14, stroke: C.accent, 'stroke-width': 0.8, rx: 3 }),
      text('OVONIC', 10, 19, { 'text-anchor': 'start', 'font-size': 13, 'font-weight': 800, 'font-style': 'italic', fill: C.ink }),
      text('4S · 5300 mAh · 14.8 V', 10, 31, { 'text-anchor': 'start', 'font-size': 6.5, 'font-weight': 600, fill: C.ink2 }),
      text('4S', B.L - 10, 19, { 'text-anchor': 'end', 'font-size': 11, 'font-weight': 800, fill: C.accent }));
    svg.append(lb);
    svg.append(wire(`M${B.L},${B.W / 2 - 3.6} C${B.L + 20},${B.W / 2 - 3.6} ${B.L + 24},${B.W / 2 - 3.6} ${B.L + 48},${B.W / 2 - 3.6}`, C.danger),
      wire(`M${B.L},${B.W / 2 + 3.6} C${B.L + 20},${B.W / 2 + 3.6} ${B.L + 24},${B.W / 2 + 3.6} ${B.L + 48},${B.W / 2 + 3.6}`, C.ink));
    svg.append(xt60Plan(B.L + 48, B.W / 2));
    // dây cân bằng: 1 đen + 4 đỏ ra cùng đầu, tách ra ở giắc
    const by = B.W - 7, px = B.L + 58, py = B.W + 8, gw = g('batt-balance');
    [C.ink, C.danger, C.danger, C.danger, C.danger].forEach((col, i) => gw.append(shape('path', { d: `M${B.L},${by + i * 0.6 - 1} C${B.L + 22},${by} ${px - 18},${py - 6 + i * 2.5} ${px},${py - 5 + i * 2.5}`, stroke: diag.blk(col), style: diag.blkStyle(col), 'stroke-width': 0.9, fill: 'none' })));
    gw.append(rect(px, py - 7.5, 9.8, 14.9, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.9, rx: 1 }));
    svg.append(gw, note('dây cân bằng JST-XH 5 chân', px + 12, py + 1, { 'text-anchor': 'start', 'font-size': 3 }), note('dây xả 12 AWG → XT60', B.L + 66, B.W / 2 - 5, { 'text-anchor': 'start', 'font-size': 3 }));
    diag.dim(svg, 0, -6, B.L, -6, '~155 mm (' + EST + ')');
    diag.dim(svg, -8, 0, -8, B.W, '~43 mm');
    return svg;
  }

  function side() {
    const svg = diag.svg([-14, -14, B.L + 100, B.H + 40], 'Pin 4S nhìn bên');
    svg.append(g('batt').appendChild(rect(0, 0, B.L, B.H, pack({ rx: 4 }))).parentNode);
    svg.append(g('batt-label').appendChild(rect(4, 4, B.L - 8, B.H - 8, { fill: C.accent, 'fill-opacity': 0.12, stroke: C.accent, 'stroke-width': 0.7, rx: 2 })).parentNode,
      text('nhãn bọc ngoài', B.L / 2, B.H / 2 + 1.5, { 'font-size': 4, fill: C.ink3 }));
    const y = 20;
    svg.append(wire(`M${B.L},${y} C${B.L + 18},${y} ${B.L + 26},${y + 4} ${B.L + 48},${y}`, C.danger, 3.6));
    svg.append(g('batt-xt60').appendChild(rect(B.L + 48, y - 4.05, 15.9, 8.1, { fill: C.warn, 'fill-opacity': 0.85, stroke: C.ink, 'stroke-width': 0.9, rx: 1 })).parentNode);
    const gw = g('batt-balance');
    [C.ink, C.danger, C.danger, C.danger, C.danger].forEach((col, i) => gw.append(shape('path', { d: `M${B.L},${B.H - 7 + i * 0.4} C${B.L + 20},${B.H - 7} ${B.L + 40},${B.H + 3} ${B.L + 56},${B.H + 3 + i * 0.4}`, stroke: diag.blk(col), style: diag.blkStyle(col), 'stroke-width': 0.9, fill: 'none' })));
    gw.append(rect(B.L + 56, B.H - 2, 9.8, 5.75, { fill: C.surface, stroke: C.ink, 'stroke-width': 0.9, rx: 0.8 }));
    svg.append(gw);
    diag.dim(svg, 0, B.H + 12, B.L, B.H + 12, '~155 mm');
    diag.dim(svg, -8, 0, -8, B.H, '~35 mm');
    svg.append(note('Kích thước: ' + EST, B.L / 2, B.H + 22, { 'font-size': 3 }));
    return svg;
  }

  function end() {
    const svg = diag.svg([-14, -14, B.W + 60, B.H + 40], 'Pin 4S nhìn từ đầu có dây');
    svg.append(g('batt').appendChild(rect(0, 0, B.W, B.H, pack({ rx: 4 }))).parentNode);
    svg.append(g('batt-label').appendChild(rect(3, 3, B.W - 6, 3, { fill: C.accent, 'fill-opacity': 0.5, stroke: 'none' })).parentNode);
    const cx = B.W / 2, y = 20, gr = g('batt-xt60');
    gr.append(circle(cx - 3.6, y, 2.4, { fill: C.danger, stroke: C.ink, 'stroke-width': 0.8 }), circle(cx + 3.6, y, 2.4, { fill: diag.BLACK, stroke: C.ink, 'stroke-width': 0.8 }));
    svg.append(gr);
    const gw = g('batt-balance');
    [0, 1, 2, 3, 4].forEach((i) => gw.append(circle(cx + 12 + (i - 2) * 1.3, B.H - 7, 0.6, { fill: i === 0 ? diag.BLACK : C.danger, stroke: 'none' })));
    svg.append(gw, note('đỏ (+)', cx - 3.6, y - 6, { 'font-size': 3 }), note('đen (−)', cx + 3.6, y - 6, { 'font-size': 3, 'text-anchor': 'middle' }));
    diag.dim(svg, 0, B.H + 8, B.W, B.H + 8, '~43 mm');
    diag.dim(svg, B.W + 8, 0, B.W + 8, B.H, '~35 mm');
    svg.append(note('Vị trí dây ra: ước lượng', B.W / 2 + 14, B.H + 20, { 'font-size': 3 }));
    return svg;
  }

  diag.battery = function battery(view) {
    const map = { top, side, end };
    if (!map[view]) throw new Error('[SAC] diag.battery view la: ' + view);
    return map[view]();
  };

  // ---- giắc cân bằng JST-XH 5 chân của pin 4S: chân, màu dây, cell ----
  diag.balancePinout = function balancePinout() {
    const S = 28, pitch = 2.5 * S, x0 = 14, W = 4 * pitch + 4.9 * S + 2 * x0, svg = diag.svg([0, 0, W, 370], 'Giắc JST-XH 5 chân của pin 4S');
    const hw = 14.9 * S, hh = 5.75 * S, hy = 54, cx = (i) => x0 + 2.45 * S + i * pitch;
    const gr = g('batt-balance');
    gr.append(rect(x0, hy, hw, hh, { fill: C.surface, stroke: C.ink, 'stroke-width': 1.6, rx: 8 }));
    const cols = [C.ink, C.danger, C.danger, C.danger, C.danger], info = [
      ['1', 'đen', 'Âm pin (GND)', '0 V'], ['2', 'đỏ', '+ cell 1', '3,7–4,2 V'], ['3', 'đỏ', '+ cell 2', '7,4–8,4 V'], ['4', 'đỏ', '+ cell 3', '11,1–12,6 V'], ['5', 'đỏ', '+ pin', '14,8–16,8 V']];
    for (let i = 0; i < 5; i++) {
      gr.append(rect(cx(i) - 0.7 * S, hy + 22, 1.4 * S, hh - 44, { fill: C.surface2, stroke: C.ink3, 'stroke-width': 1, rx: 4 }),
        shape('line', { x1: cx(i), x2: cx(i), y1: hy + hh - 20, y2: hy + hh + 26, stroke: diag.blk(cols[i]), style: diag.blkStyle(cols[i]), 'stroke-width': 5, 'stroke-linecap': 'round' }));
    }
    svg.append(gr);
    for (let i = 0; i < 5; i++) {
      const x = cx(i);
      svg.append(circle(x, hy + hh / 2 - 4, 15, { fill: i === 0 ? C.ink3 : C.danger, 'fill-opacity': 0.12, stroke: 'none' }),
        text(info[i][0], x, hy + hh / 2 + 1.5, { 'font-size': 22, 'font-weight': 700, fill: C.ink }),
        text('Chân ' + info[i][0], x, 256, { 'font-size': 13, 'font-weight': 700, fill: i === 0 ? C.ink : C.danger }), text('dây ' + info[i][1], x, 272, { 'font-size': 11.5, fill: i === 0 ? C.ink : C.danger }),
        text(info[i][2], x, 292, { 'font-size': 11.5 }), text(info[i][3], x, 310, { 'font-size': 12.5, 'font-weight': 600, fill: C.ink }));
    }
    // dấu ngoặc cell
    for (let i = 0; i < 4; i++) {
      const a = cx(i) + 6, b = cx(i + 1) - 6, y = 30;
      svg.append(shape('path', { d: `M${a},${y + 8} v-8 h${b - a} v8`, stroke: C.accent, 'stroke-width': 1.4, fill: 'none' }), text('Cell ' + (i + 1), (a + b) / 2, y - 5, { 'font-size': 12.5, fill: C.accent, 'font-weight': 700 }));
    }
    svg.append(text('Dây đen (chân 1) quay về dấu − trên máy, cạnh ổ "4 cells".', W / 2, 342, { 'font-size': 12.5, 'font-weight': 600, fill: C.ink }),
      text('Màu các dây giữa có thể khác theo hãng. Xác nhận chân 1 bằng cách đo với dây âm của XT60.', W / 2, 360, { 'font-size': 10, fill: C.ink3 }));
    return svg;
  };

  // ---- khung LCD 2 x 16 tĩnh ----
  diag.lcd = function lcd(line1, line2) {
    const cw = 20, chh = 36, gap = 2, pad = 14, W = 16 * cw + 2 * pad, H = 2 * chh + gap + 2 * pad;
    const svg = diag.svg([0, 0, W, H], 'Màn hình LCD: ' + line1 + ' / ' + (line2 || ''));
    svg.append(rect(0, 0, W, H, { fill: C.ink, 'fill-opacity': 0.94, stroke: C.ink, 'stroke-width': 1, rx: 8 }),
      rect(pad - 4, pad - 4, W - 2 * pad + 8, H - 2 * pad + 8, { fill: '#1f5fd0', stroke: 'none', rx: 4 }));
    const cells = el('g', { 'data-lcd': '1', 'font-family': 'var(--mono)' });
    [line1 || '', line2 || ''].forEach((ln, r) => {
      const s = String(ln).padEnd(16).slice(0, 16);
      for (let c = 0; c < 16; c++) {
        const x = pad + c * cw, y = pad + r * (chh + gap);
        cells.append(rect(x + 1, y + 1, cw - 2, chh - 2, { fill: '#10408f', 'fill-opacity': 0.55, stroke: 'none', rx: 1.5 }));
        if (s[c] !== ' ') cells.append(el('text', { x: x + cw / 2, y: y + chh / 2 + 9, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: '#eaf4ff' }, s[c]));
      }
    });
    svg.append(cells);
    return svg;
  };
})();
