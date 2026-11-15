/* Lane 3D/2D — SAC.diag.wiring(step) và SAC.diag.boxContents().
   Đường sạc của người dùng: OUTPUT (banana) → dây 3 (banana ↔ T-plug) → dây 8 (T-plug ↔ XT60) → XT60 của pin;
   dây cân bằng JST-XH 5 chân cắm thẳng vào ổ "4 cells". Theo manual V3.10/V3.20 tr.10 (thứ tự nối) và tr.21 (đồ trong hộp).
   Một bố cục dùng cho mọi bước: cạnh phải của máy (vẽ theo SAC.dims, đo từ ảnh nhìn thẳng) ở trên, chuỗi dây ở giữa,
   pin ở dưới phải; bước nào thì nhóm đó đủ đậm + viền sáng, nhóm khác còn ~35%.
   Đực/cái của T-plug và XT60: dây 3 mang T-plug đực (lưỡi dẹt, theo hình manual tr.21), dây 8 mang T-plug cái và XT60 cái;
   pin mang XT60 đực (model xt60-m của scene3d). Cỡ chữ >= 15 trong viewBox rộng 800 để đọc được ở ~680 px. */
(function () {
  'use strict';
  const SAC = window.SAC, diag = SAC.diag, C = diag.C, el = diag.el, g = diag.g, text = diag.text;
  const K = SAC.dims;

  // ---- hàm vẽ cơ bản (nét theo đơn vị viewBox, không dùng non-scaling-stroke để cỡ dây co giãn cùng hình) ----
  const S = (tag, a) => diag.shape(tag, Object.assign({ 'vector-effect': 'none' }, a));
  const rect = (x, y, w, h, a) => S('rect', Object.assign({ x, y, width: w, height: h }, a));
  const circle = (cx, cy, r, a) => S('circle', Object.assign({ cx, cy, r }, a));
  const path = (d, a) => S('path', Object.assign({ d }, a));
  const poly = (pts, a) => S('polygon', Object.assign({ points: pts.map((p) => p.join(',')).join(' ') }, a));
  const line = (x1, y1, x2, y2, a) => S('line', Object.assign({ x1, y1, x2, y2 }, a));
  const T = (s, x, y, a) => text(s, x, y, Object.assign({ 'font-size': 16, fill: C.ink }, a));
  const TL = (s, x, y, a) => T(s, x, y, Object.assign({ 'text-anchor': 'start' }, a));

  const RED = C.danger, BLK = diag.BLACK;
  const YEL_M = '#ebc54f', YEL_F = '#d6a22a', EDGE = 'rgba(20,22,26,.65)', METAL = '#c9ced6', BRASS = '#d9a441';
  const SOFT_EDGE = { stroke: EDGE, 'stroke-width': 1.3, 'stroke-linejoin': 'round' };

  const badge = (n, x, y) => {
    const gr = el('g');
    gr.append(circle(x, y, 12.5, { fill: C.accent, stroke: 'none' }), T(String(n), x, y + 5.3, { fill: 'var(--bg)', 'font-weight': 700 }));
    return gr;
  };
  const tag = (ch, x, y) => {               // nhãn chữ cái rỗng (A: ổ cân bằng phóng to)
    const gr = el('g');
    gr.append(circle(x, y, 12, { fill: C.surface, stroke: C.accent, 'stroke-width': 2 }), T(ch, x, y + 5.3, { fill: C.accent, 'font-weight': 700 }));
    return gr;
  };
  const lead = (x1, y1, x2, y2) => { const gr = el('g'); gr.append(line(x1, y1, x2, y2, { stroke: C.ink3, 'stroke-width': 1.4 }), circle(x2, y2, 3, { fill: C.ink2, stroke: 'none' })); return gr; };
  const place = (gr, x, y, ang) => { gr.setAttribute('transform', `translate(${x} ${y})` + (ang ? ` rotate(${ang})` : '')); return gr; };

  // dây bọc: viền + lõi màu (dây đen có quầng sáng để thấy trên nền tối)
  function cable(d, col, w) {
    const black = col === BLK || col === C.ink, gr = el('g');
    gr.append(path(d, { stroke: black ? 'rgba(165,175,190,.55)' : 'rgba(0,0,0,.32)', 'stroke-width': w + 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      path(d, { stroke: black ? BLK : col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return gr;
  }

  // ---- dải 5 dây cân bằng: lấy mẫu đường cong rồi dịch song song, dây đen ở bên trái chiều đi ----
  const bz = (s, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]); };
  const seg = (a, b) => [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b];
  function sample(segs, n) {
    const pts = [];
    segs.forEach((s) => { for (let i = 0; i <= n; i++) { if (i === 0 && pts.length) continue; pts.push(bz(s, i / n)); } });
    return pts;
  }
  function offset(pts, off) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      return [p[0] + ty * off, p[1] - tx * off];
    });
  }
  const pd = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
  function ribbon(segs) {
    const gr = g('batt-balance-wires'), pts = sample(segs, 40), pitch = 3.4, cols = [BLK, RED, RED, RED, RED];
    gr.append(path(pd(pts), { stroke: 'rgba(120,130,145,.35)', 'stroke-width': pitch * 5 + 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    gr.append(path(pd(offset(pts, -2 * pitch)), { stroke: 'rgba(165,175,190,.7)', 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }));
    cols.forEach((col, i) => gr.append(path(pd(offset(pts, (i - 2) * pitch)), { stroke: col, 'stroke-width': 3.1, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' })));
    return gr;
  }

  // ---- đầu nối vẽ ở toạ độ cục bộ: mặt cắm ở x = 0, hướng cắm về +x, thân kéo về -x ----
  function tMale() {                              // T-plug đực: thanh ngang (sau), thân, hai lưỡi dẹt
    const gr = el('g');
    gr.append(rect(0, -9, 22, 6, { fill: BRASS, stroke: EDGE, 'stroke-width': 1 }), rect(0, 3, 22, 6, { fill: BRASS, stroke: EDGE, 'stroke-width': 1 }),
      rect(-32, -13, 32, 26, Object.assign({ fill: YEL_M }, SOFT_EDGE)), rect(-46, -18, 14, 36, Object.assign({ fill: YEL_M, rx: 3 }, SOFT_EDGE)));
    return gr;
  }
  function tFemale() {                            // T-plug cái: ống chụp hai lỗ cắm lưỡi
    const gr = el('g');
    gr.append(rect(-44, -13, 44, 26, Object.assign({ fill: YEL_F }, SOFT_EDGE)), rect(-58, -18, 14, 36, Object.assign({ fill: YEL_F, rx: 3 }, SOFT_EDGE)),
      rect(-9, -9, 9, 6, { fill: '#3b2b06', stroke: 'none' }), rect(-9, 3, 9, 6, { fill: '#3b2b06', stroke: 'none' }));
    return gr;
  }
  function xtF() {                                // XT60 cái: vỏ vát hai góc ở mặt cắm
    const gr = el('g');
    gr.append(poly([[-48, -19], [-8, -19], [0, -11], [0, 11], [-8, 19], [-48, 19]], Object.assign({ fill: YEL_F }, SOFT_EDGE)),
      rect(-10, -13, 10, 8, { fill: '#3b2b06', stroke: 'none', rx: 3 }), rect(-10, 5, 10, 8, { fill: '#3b2b06', stroke: 'none', rx: 3 }));
    return gr;
  }
  function xtM() {                                // XT60 đực: hai chốt đồng nhô ra
    const gr = el('g');
    gr.append(rect(0, -13, 22, 8.4, { fill: BRASS, stroke: EDGE, 'stroke-width': 1, rx: 4.2 }), rect(0, 4.6, 22, 8.4, { fill: BRASS, stroke: EDGE, 'stroke-width': 1, rx: 4.2 }),
      poly([[-44, -19], [-8, -19], [0, -11], [0, 11], [-8, 19], [-44, 19]], Object.assign({ fill: YEL_M }, SOFT_EDGE)));
    return gr;
  }
  function clipEnd(col) {                         // kẹp cá sấu, hàm kẹp ở +x
    const gr = el('g');
    gr.append(rect(-58, -9, 30, 18, { fill: col === BLK ? BLK : col, stroke: col === BLK ? 'rgba(165,175,190,.55)' : EDGE, 'stroke-width': 1.3, rx: 5 }),
      poly([[-30, -6], [-4, -10], [2, -3], [-30, -1.5]], { fill: METAL, stroke: EDGE, 'stroke-width': 1 }), poly([[-30, 6], [-4, 10], [2, 3], [-30, 1.5]], { fill: METAL, stroke: EDGE, 'stroke-width': 1 }));
    for (let i = 0; i < 4; i++) gr.append(path(`M${-18 + i * 4.5},-1.5 l2,-2.6 l2,2.6 M${-18 + i * 4.5},1.5 l2,2.6 l2,-2.6`, { stroke: EDGE, 'stroke-width': 0.9 }));
    return gr;
  }
  function bananaEnd(col) {                       // phích banana 4 mm: chân đồng ở +x
    const gr = el('g');
    gr.append(rect(0, -2.6, 20, 5.2, { fill: BRASS, stroke: EDGE, 'stroke-width': 1 }),
      rect(-26, -7, 26, 14, { fill: col === BLK ? BLK : col, stroke: col === BLK ? 'rgba(165,175,190,.55)' : EDGE, 'stroke-width': 1.3, rx: 4 }));
    return gr;
  }

  // ---- cạnh phải của máy (theo SAC.dims) ----
  function chargerEnd(ox, oy, s) {
    const X = (d) => ox + d * s, Y = (y) => oy + (K.H - y) * s, gr = g('charger-end'), ports = {};
    gr.append(poly([[0, K.BODY_BOT], [K.BODY_D, K.BODY_BOT], [K.BODY_D, K.REAR_TOP], [K.STEP1, K.REAR_TOP], [K.STEP0, K.FRONT_TOP], [0, K.FRONT_TOP]].map(([d, y]) => [X(d), Y(y)]),
      { fill: C.soft, stroke: C.accent, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    K.FINS_Y.forEach((y) => gr.append(rect(X(K.BODY_D), Y(y + 0.75), K.FIN * s, 1.5 * s, { fill: C.soft, stroke: C.accent, 'stroke-width': 1.2 })));
    K.FEET.d.forEach((d) => gr.append(rect(X(d) - K.FEET.l * s / 2, Y(K.FOOT), K.FEET.l * s, K.FOOT * s, { fill: C.ink, 'fill-opacity': 0.75, stroke: 'none', rx: 3 })));
    K.SCREWS.forEach(([d, y]) => gr.append(circle(X(d), Y(y), 1.9 * s, { fill: C.surface2, stroke: C.accent, 'stroke-width': 1.1 }), line(X(d) - 1.2 * s, Y(y), X(d) + 1.2 * s, Y(y), { stroke: C.accent, 'stroke-width': 1.1 })));
    [['out-neg', K.BAN.neg, C.ink], ['out-pos', K.BAN.pos, RED]].forEach(([id, p, col]) => {
      const pg = g(id), x = X(p.d), y = Y(p.y);
      pg.append(circle(x, y, K.BAN.r * s, { fill: col === C.ink ? BLK : col, 'fill-opacity': 0.95, stroke: C.ink, 'stroke-width': 1.2 }),
        circle(x, y, 3.4 * s, { fill: BRASS, stroke: 'none' }), circle(x, y, 1.9 * s, { fill: '#1b1e24', stroke: 'none' }));
      gr.append(pg); ports[id] = [x, y];
    });
    K.BAL.forEach((b) => {
      const w = K.BAL_PITCH * (b.n - 1) + K.BAL_MARGIN, pg = g(b.id);
      pg.append(rect(X(b.d0), Y(b.y0 + K.BAL_H), w * s, K.BAL_H * s, { fill: C.surface, stroke: C.ink, 'stroke-width': 1.2, rx: 1.5 }));
      for (let i = 0; i < b.n; i++) pg.append(circle(X(b.d0 + K.BAL_MARGIN / 2 + i * K.BAL_PITCH), Y(b.y0 + K.BAL_H / 2), 1.6, { fill: BRASS, stroke: 'none' }));
      gr.append(pg); ports[b.id] = { x0: X(b.d0), x1: X(b.d0 + w), y0: Y(b.y0 + K.BAL_H), y1: Y(b.y0) };
    });
    return { gr, X, Y, ports };
  }

  // ---- phóng to ổ cân bằng (năm ổ, nhãn rõ) ----
  const SOCK_LABEL = { 'bal-4s': '4 cells', 'bal-3s': '3 cells', 'bal-2s': '2 cells', 'bal-6s': '6 cells', 'bal-5s': '5 cells' };
  const INSET_L = { gx: 540, gy: 96, gw: 250, gh: 190, Z: 5.6, ix0: 554, iy0: 180, note: '⊕ đầu trước, ⊖ đầu sau; dây đen về ⊖' };
  const INSET_P = { gx: 160, gy: 276, gw: 232, gh: 176, Z: 5.2, ix0: 176, iy0: 360, note: 'Dây đen về phía dấu ⊖ (đầu sau)' };
  function inset(empty, o) {
    const { gx, gy, gw, gh, Z, ix0, iy0 } = o || INSET_L, d0 = K.BAL[0].d0, yTop = K.BAL[0].y0 + K.BAL_H, gr = el('g');
    gr.append(rect(gx, gy, gw, gh, { fill: C.surface2, stroke: empty ? RED : C.accent, 'stroke-width': 2, rx: 14 }), tag('A', gx + 26, gy + 26), TL('Phóng to ổ cân bằng', gx + 46, gy + 32, { 'font-weight': 600 }));
    let cx4 = 0;
    K.BAL.forEach((b) => {
      const w = (K.BAL_PITCH * (b.n - 1) + K.BAL_MARGIN) * Z, x = ix0 + (b.d0 - d0) * Z, y = iy0 + (yTop - (b.y0 + K.BAL_H)) * Z, h = K.BAL_H * Z, is4 = b.id === 'bal-4s';
      gr.append(rect(x, y, w, h, { fill: is4 ? C.soft : C.surface, stroke: is4 ? (empty ? RED : C.accent) : C.ink3, 'stroke-width': is4 ? 2.6 : 1.3, rx: 3, 'stroke-dasharray': is4 && empty ? '6 4' : null }));
      const p1 = K.BAL_NEG_BACK ? b.n - 1 : 0;   // chân 1 (đen) về phía ⊖ = phía sau máy
      for (let i = 0; i < b.n; i++) {
        const px = x + (K.BAL_MARGIN / 2 + i * K.BAL_PITCH) * Z;
        gr.append(circle(px, y + 8, 2.4, { fill: is4 ? (i === p1 ? BLK : RED) : C.ink3, stroke: is4 && i === p1 ? 'rgba(165,175,190,.8)' : 'none', 'stroke-width': 1 }));
      }
      gr.append(T(SOCK_LABEL[b.id], x + w / 2, y + h - 6, { 'font-size': 15, 'font-weight': is4 ? 700 : 500, fill: is4 ? (empty ? RED : C.accent) : C.ink2 }));
      if (is4) cx4 = x + w / 2;
    });
    if (empty) {
      gr.append(TL('Ổ 4 cells còn trống', ix0, iy0 - 22, { 'font-weight': 700, fill: RED }), path(`M${cx4 - 7},${iy0 - 16} l14,14 m0,-14 l-14,14`, { stroke: RED, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    } else {
      gr.append(TL('Cắm vào ổ 4 cells', ix0, iy0 - 22, { 'font-weight': 700, fill: C.accent }), path(`M${cx4},${iy0 - 17} L${cx4},${iy0 - 9}`, { stroke: C.accent, 'stroke-width': 3, 'stroke-linecap': 'round' }),
        poly([[cx4, iy0 - 2], [cx4 - 7, iy0 - 12], [cx4 + 7, iy0 - 12]], { fill: C.accent, stroke: 'none' }));
    }
    { const tb = SAC.balTable(); gr.append(T('⊕', ix0 + (tb.d0 - d0) * Z - 14, iy0 + 26, { 'font-size': 20, 'font-weight': 700 }), T('⊖', ix0 + (tb.d1 - d0) * Z + 14, iy0 + 26, { 'font-size': 20, 'font-weight': 700 })); }
    gr.append(TL((o || INSET_L).note, ix0, gy + gh - 12, { 'font-size': 15, fill: C.ink2 }));
    return gr;
  }

  // ---- dải nguồn vào (cạnh TRÁI của máy) ----
  function powerStrip() {
    const gr = g(null, { 'data-step': 'power' }), ac = g('cable-ac'), inl = g('ac-inlet'), clips = g('cable-dc-clips');
    gr.append(rect(12, 10, 776, 62, { fill: C.surface2, stroke: C.line, 'stroke-width': 1.2, rx: 14 }), badge(1, 36, 41));
    inl.append(rect(62, 26, 42, 30, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 7 }),
      circle(73, 41, 3, { fill: '#9aa3b2', stroke: 'none' }), circle(89, 33, 3, { fill: '#9aa3b2', stroke: 'none' }), circle(89, 49, 3, { fill: '#9aa3b2', stroke: 'none' }));
    ac.append(cable('M104,41 C116,41 122,41 134,41', BLK, 4), rect(132, 29, 20, 24, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 4 }),
      rect(152, 33, 9, 3.4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.8 }), rect(152, 46, 9, 3.4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.8 }));
    [[RED, 30], [BLK, 52]].forEach(([col, y]) => clips.append(place(clipEnd(col), 500, y, 0)));
    clips.firstChild.setAttribute('transform', 'translate(500 29) scale(.62)'); clips.lastChild.setAttribute('transform', 'translate(500 53) scale(.62)');
    gr.append(inl, ac, TL('Dây 2 (C5): ổ điện 100–240 V', 174, 34, { 'font-weight': 600 }), TL('cắm vào AC IN, cạnh trái máy', 174, 58, { 'font-size': 15, fill: C.ink2 }),
      T('hoặc', 436, 47, { fill: C.ink3, 'font-size': 15 }), clips, TL('Dây 4 (kẹp cá sấu): ắc quy 12 V', 522, 34, { 'font-weight': 600 }), TL('điện áp vào 11–18 V', 522, 58, { 'font-size': 15, fill: C.ink2 }));
    return gr;
  }

  const FADE = 0.35, GLOW = 'drop-shadow(0 0 2.2px var(--accent))';
  const VALID = ['all', 'power', 'main', 'balance', 'wrong-no-balance', 'wrong-reverse'];

  // ---- độ nhấn theo bước: nhóm đang làm đủ đậm + viền sáng, nhóm khác ~35% ----
  function emphasize(step, G) {
    const set = (gr, on, glow, shapes) => { gr.style.opacity = on ? '1' : String(FADE); if (shapes) shapes.style.filter = on && glow ? GLOW : ''; };
    const on = {
      all: { pwr: 1, main: 1, bal: 1, ins: 1, pack: 1, glow: 0 },
      power: { pwr: 1, main: 0, bal: 0, ins: 0, pack: 0, glow: 1 },
      main: { pwr: 0, main: 1, bal: 0, ins: 0, pack: 1, glow: 1 },
      balance: { pwr: 0, main: 0, bal: 1, ins: 1, pack: 1, glow: 1 },
      'wrong-no-balance': { pwr: 0, main: 1, bal: 0, ins: 1, pack: 1, glow: 0 },
      'wrong-reverse': { pwr: 0, main: 1, bal: 0, ins: 0, pack: 1, glow: 0 },
    }[step];
    set(G.pwr, on.pwr, false); set(G.mainG, on.main, on.glow, G.mainS); set(G.balG, on.bal, on.glow, G.balS); set(G.insG, on.ins, false); set(G.packG, on.pack, false);
    if (on.pwr && on.glow) { G.pwr.firstChild.setAttribute('stroke', 'var(--accent)'); G.pwr.firstChild.setAttribute('stroke-width', '2.6'); }
    G.plateG.style.opacity = step === 'power' ? '0.5' : '1';
  }
  function banner(svg, y, h, lines) {
    const w = g(null, { 'data-warn': '1' });
    w.append(rect(12, y, svg.viewBox.baseVal.width - 24, h, { fill: C.danger, 'fill-opacity': 0.12, stroke: C.danger, 'stroke-width': 1.4, rx: 10 }));
    lines.forEach((l, i) => w.append(T(l, svg.viewBox.baseVal.width / 2, y + h / 2 + 5 + (i - (lines.length - 1) / 2) * 22, { fill: C.danger, 'font-weight': 700 })));
    svg.append(w);
  }

  // ======== bố cục NGANG (container >= 560 px) ========
  function landscape(svg, step) {
    const reverse = step === 'wrong-reverse', noBal = step === 'wrong-no-balance';

    // ---- máy sạc, nhìn vào cạnh phải ----
    const ch = chargerEnd(24, 126, 3.5), P = ch.ports, jn = P['out-neg'], jp = P['out-pos'], b4 = P['bal-4s'];
    const plateG = g(null);
    plateG.append(TL('Máy sạc, nhìn vào cạnh phải', 24, 96, { 'font-weight': 600 }), ch.gr);
    const glyph = (s, p, col) => plateG.append(T(s, p[0], p[1] - 26, { 'font-size': 22, 'font-weight': 800, fill: col }));
    glyph('−', jn, C.ink); glyph('+', jp, RED);
    plateG.append(badge(2, 36, 134), TL('OUTPUT', 54, 140, { 'font-weight': 700 }), line(93, 146, 93, 160, { stroke: C.ink3, 'stroke-width': 1.4 }));
    plateG.append(rect(b4.x0 - 5, b4.y0 - 5, P['bal-2s'].x1 - b4.x0 + 10, P['bal-6s'].y1 - b4.y0 + 10, { fill: 'none', stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', rx: 5 }),
      lead((b4.x0 + P['bal-2s'].x1) / 2, P['bal-6s'].y1 + 5, (b4.x0 + P['bal-2s'].x1) / 2, 262), tag('A', (b4.x0 + P['bal-2s'].x1) / 2 - 62, 276), TL('Ổ cân bằng', (b4.x0 + P['bal-2s'].x1) / 2 - 44, 281, { 'font-weight': 600 }));

    // ---- pin Ovonic 4S (nhìn từ trên), dây ra ở đầu trái ----
    const packG = g('batt'), PX = 604, PY = 337, PW = 188, PH = 70, YC = 372;
    packG.append(rect(PX, PY, PW, PH, { fill: '#243553', stroke: C.ink, 'stroke-width': 1.6, rx: 10 }), rect(PX, PY, 12, PH, { fill: '#18233a', stroke: 'none', rx: 8 }),
      rect(PX + 26, PY + 8, PW - 36, PH - 16, { fill: 'rgba(255,255,255,.10)', stroke: 'rgba(255,255,255,.28)', 'stroke-width': 1, rx: 6 }));
    const lab = g('batt-label');
    lab.append(T('OVONIC 4S', PX + 26 + (PW - 36) / 2, PY + 31, { fill: '#fff', 'font-size': 20, 'font-weight': 800, 'font-style': 'italic' }), T('5300 mAh · 14.8 V', PX + 26 + (PW - 36) / 2, PY + 52, { fill: 'rgba(255,255,255,.88)', 'font-size': 15 }));
    packG.append(lab);

    // ---- đường sạc chính: banana → dây 3 → T-plug → dây 8 → XT60 → pin ----
    const c3 = g('cable-banana-t'), c8 = g('adapter-t-xt60'), xt = g('batt-xt60'), mainG = g(null, { 'data-step': 'main' }), mainS = g(null), mainL = g(null);
    const redJ = reverse ? jn : jp, blkJ = reverse ? jp : jn;                     // sai cực: đỏ vào lỗ −, đen vào lỗ +
    const yR = YC - 9, yB = YC + 9, tx = 258;
    [[redJ, RED], [blkJ, C.ink]].forEach(([j, col]) => {
      const gg = el('g');
      gg.append(circle(j[0], j[1], 13.5, { fill: col === C.ink ? BLK : col, stroke: col === C.ink ? 'rgba(165,175,190,.7)' : EDGE, 'stroke-width': 1.6 }), circle(j[0], j[1], 5, { fill: 'rgba(0,0,0,.35)', stroke: 'none' }));
      c3.append(gg);
    });
    const wRedD = reverse ? `M${redJ[0]},${redJ[1] + 13} C${redJ[0]},${redJ[1] + 112} 170,${yR} ${tx},${yR}` : `M${redJ[0]},${redJ[1] + 13} C${redJ[0]},${redJ[1] + 103} 180,${yR} ${tx},${yR}`;
    const wBlkD = reverse ? `M${blkJ[0]},${blkJ[1] + 13} C${blkJ[0]},${blkJ[1] + 133} 190,${yB} ${tx},${yB}` : `M${blkJ[0]},${blkJ[1] + 13} C${blkJ[0]},${blkJ[1] + 133} 170,${yB} ${tx},${yB}`;
    c3.insertBefore(cable(wBlkD, C.ink, 6), c3.firstChild); c3.insertBefore(cable(wRedD, RED, 6), c3.firstChild);
    c3.append(place(tMale(), tx + 46, YC, 0));
    const x8 = tx + 96;                                                           // mép phải thanh ngang T-plug cái
    c8.append(cable(`M${x8},${yR} C${x8 + 36},${yR - 11} ${x8 + 66},${yR + 11} 456,${yR}`, RED, 6), cable(`M${x8},${yB} C${x8 + 36},${yB - 11} ${x8 + 66},${yB + 11} 456,${yB}`, C.ink, 6),
      place(tFemale(), tx + 38, YC, 180), place(xtF(), 504, YC, 0));
    c8.append(rect(304, YC - 9, 22, 6, { fill: 'none', stroke: EDGE, 'stroke-width': 1.1, 'stroke-dasharray': '3 2' }), rect(304, YC + 3, 22, 6, { fill: 'none', stroke: EDGE, 'stroke-width': 1.1, 'stroke-dasharray': '3 2' }),
      rect(478, yR - 4.2, 22, 8.4, { fill: 'none', stroke: EDGE, 'stroke-width': 1.1, 'stroke-dasharray': '3 2', rx: 4.2 }), rect(478, yB - 4.2, 22, 8.4, { fill: 'none', stroke: EDGE, 'stroke-width': 1.1, 'stroke-dasharray': '3 2', rx: 4.2 }));
    xt.append(cable(`M544,${yR} L630,${yR}`, RED, 7), cable(`M544,${yB} L630,${yB}`, C.ink, 7), place(xtM(), 500, YC, 180));
    mainS.append(c3, xt, c8);
    // nhãn của đường sạc chính
    mainL.append(TL('đực', 274, 346, { fill: C.ink2, 'font-size': 15 }), TL('cái', 322, 346, { fill: C.ink2, 'font-size': 15 }),
      badge(2, 308, 316), TL('Lắp dây 8 vào dây 3', 326, 322, { 'font-weight': 600 }),
      TL('cái', 468, 414, { fill: C.ink2, 'font-size': 15 }), TL('đực', 512, 414, { fill: C.ink2, 'font-size': 15 }),
      badge(4, 484, 440), TL('Cắm XT60 vào pin', 502, 446, { 'font-weight': 600 }),
      T('Dây 3', 28, 424, { 'text-anchor': 'start', 'font-weight': 700 }), TL('banana ↔ T-plug', 28, 444, { fill: C.ink2, 'font-size': 15 }), lead(96, 408, 205, yB + 4),
      T('Dây 8', 405, 424, { 'font-weight': 700 }), T('T-plug ↔ XT60', 405, 444, { fill: C.ink2, 'font-size': 15 }), lead(405, 408, 405, yB + 8));
    mainG.append(mainS, mainL);
    if (reverse) {
      const mx = (jn[0] + jp[0]) / 2;
      mainG.append(circle(mx, 252, 20, { fill: C.surface, stroke: RED, 'stroke-width': 3.5 }), path(`M${mx - 9},243 l18,18 m0,-18 l-18,18`, { stroke: RED, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    }

    // ---- dây cân bằng: giắc 5 chân cắm vào ổ "4 cells", đen về phía dấu − ----
    const bx = (b4.x0 + b4.x1) / 2, by = b4.y0;
    const balG = g(null, { 'data-step': 'balance' }), balS = g(null), balL = g(null), insG = g(null);
    balS.append(ribbon([[[bx, by - 5], [bx, by - 44], [bx + 36, by - 52], [bx + 90, by - 52]], seg([bx + 90, by - 52], [462, by - 52]), [[462, by - 52], [496, by - 52], [510, by - 36], [510, by - 4]], seg([510, by - 4], [510, 282]), [[510, 282], [510, 325], [560, 347], [632, 347]]]));
    const plugG = g('batt-balance');
    plugG.append(rect(bx - 31, by - 6, 62, 30, { fill: '#f1eee6', stroke: EDGE, 'stroke-width': 1.5, rx: 3 }), rect(bx - 12, by - 12, 24, 8, { fill: '#f1eee6', stroke: EDGE, 'stroke-width': 1.3, rx: 2 }));
    (K.BAL_NEG_BACK ? [RED, RED, RED, RED, BLK] : [BLK, RED, RED, RED, RED]).forEach((col, i) => plugG.append(circle(bx - 17.5 + i * 8.75, by + 9, 3.1, { fill: col, stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.8 })));
    if (noBal) { plugG.setAttribute('opacity', '0.45'); plugG.querySelectorAll('rect').forEach((r) => r.setAttribute('stroke-dasharray', '4 3')); }
    balS.append(plugG);
    balL.append(badge(5, 296, 146), TL('Dây cân bằng 5 chân', 314, 152, { 'font-weight': 600 }), TL('dây đen về phía dấu −', 314, 174, { fill: C.ink2, 'font-size': 15 }));
    balG.append(balS, balL);
    insG.append(inset(noBal));

    const pwr = powerStrip();
    svg.append(pwr, plateG, balG, insG, mainG, packG);

    emphasize(step, { pwr, plateG, mainG, mainS, balG, balS, insG, packG });

    // ---- hai kiểu nối sai: dấu ✕ đỏ + dòng giải thích ----
    if (noBal) {
      svg.append(path(`M${bx - 17},${by - 8} l34,34 m0,-34 l-34,34`, { stroke: RED, 'stroke-width': 6, 'stroke-linecap': 'round' }));
      banner(svg, 468, 44, ['Thiếu dây cân bằng: máy không biết điện áp từng cell. Luôn cắm cả hai.']);
    }
    if (reverse) banner(svg, 468, 44, ['Sai cực: dây đỏ cắm vào cực −, dây đen vào cực +. Máy báo lỗi hoặc hỏng.']);
  }

  // ======== bố cục DỌC (container < 560 px): viewBox rộng 420, chữ >= 15 → >= 12,8 px ở 358 px ========
  function powerStripP() {
    const gr = g(null, { 'data-step': 'power' }), ac = g('cable-ac'), inl = g('ac-inlet'), clips = g('cable-dc-clips');
    gr.append(rect(8, 8, 404, 104, { fill: C.surface2, stroke: C.line, 'stroke-width': 1.2, rx: 14 }), badge(1, 30, 60), line(46, 60, 404, 60, { stroke: C.line, 'stroke-width': 1.2 }));
    inl.append(rect(52, 22, 42, 28, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 7 }),
      circle(63, 36, 3, { fill: '#9aa3b2', stroke: 'none' }), circle(79, 29, 3, { fill: '#9aa3b2', stroke: 'none' }), circle(79, 43, 3, { fill: '#9aa3b2', stroke: 'none' }));
    ac.append(cable('M94,36 L122,36', BLK, 4), rect(120, 24, 20, 24, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 4 }),
      rect(140, 28, 9, 3.4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.8 }), rect(140, 41, 9, 3.4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.8 }));
    [[RED, 76], [BLK, 94]].forEach(([col, y]) => clips.append(place(clipEnd(col), 104, y, 0)));
    clips.firstChild.setAttribute('transform', 'translate(110 76) scale(.62)'); clips.lastChild.setAttribute('transform', 'translate(110 94) scale(.62)');
    gr.append(inl, ac, TL('Dây 2 (C5): ổ điện 100–240 V', 160, 33, { 'font-weight': 600 }), TL('cắm vào AC IN, cạnh trái máy', 160, 52, { 'font-size': 15, fill: C.ink2 }),
      clips, TL('hoặc dây 4 (kẹp cá sấu)', 160, 82, { 'font-weight': 600 }), TL('ắc quy 12 V, điện áp 11–18 V', 160, 101, { 'font-size': 15, fill: C.ink2 }));
    return gr;
  }

  function portrait(svg, step) {
    const reverse = step === 'wrong-reverse', noBal = step === 'wrong-no-balance';

    // ---- máy sạc, nhìn vào cạnh phải (nhỏ hơn: s = 2,8) ----
    const ch = chargerEnd(14, 150, 2.8), P = ch.ports, jn = P['out-neg'], jp = P['out-pos'], b4 = P['bal-4s'], g2 = P['bal-2s'], g6 = P['bal-6s'];
    const plateG = g(null);
    plateG.append(TL('Máy sạc, nhìn vào cạnh phải', 14, 134, { 'font-weight': 600 }), ch.gr);
    const glyph = (s, p, col) => plateG.append(T(s, p[0], p[1] - 22, { 'font-size': 22, 'font-weight': 800, fill: col }));
    glyph('−', jn, C.ink); glyph('+', jp, RED);
    plateG.append(badge(2, 28, 157), TL('OUTPUT', 46, 163, { 'font-weight': 700 }), line((jn[0] + jp[0]) / 2, 169, (jn[0] + jp[0]) / 2, 181, { stroke: C.ink3, 'stroke-width': 1.4 }),
      rect(b4.x0 - 5, b4.y0 - 5, g2.x1 - b4.x0 + 10, g6.y1 - b4.y0 + 10, { fill: 'none', stroke: C.accent, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', rx: 5 }), tag('A', g2.x1 + 20, (b4.y0 + g6.y1) / 2));

    // ---- đường sạc chính, dựng đứng: banana → dây 3 → T-plug → dây 8 → XT60 → pin ----
    const cx = 70, y0 = 300, y1 = 436, xr = cx + 9, xb = cx - 9;
    const c3 = g('cable-banana-t'), c8 = g('adapter-t-xt60'), xt = g('batt-xt60'), mainG = g(null, { 'data-step': 'main' }), mainS = g(null), mainL = g(null);
    const rj = reverse ? jn : jp, bj = reverse ? jp : jn;                         // sai cực: đỏ vào lỗ −, đen vào lỗ +
    const jackWire = (j, xe, col) => cable(`M${j[0]},${j[1] + 11} C${j[0]},${j[1] + 52} ${xe},${y0 - 38} ${xe},${y0}`, col, 6);
    c3.append(jackWire(rj, xr, RED), jackWire(bj, xb, C.ink));
    [[rj, RED], [bj, C.ink]].forEach(([j, col]) => c3.append(circle(j[0], j[1], 11.5, { fill: col === C.ink ? BLK : col, stroke: col === C.ink ? 'rgba(165,175,190,.7)' : EDGE, 'stroke-width': 1.5 }), circle(j[0], j[1], 4.2, { fill: 'rgba(0,0,0,.35)', stroke: 'none' })));
    c3.append(place(tMale(), cx, y0 + 46, 90));
    const dash = { fill: 'none', stroke: EDGE, 'stroke-width': 1.1, 'stroke-dasharray': '3 2' };
    c8.append(cable(`M${xr},${y0 + 96} C${xr + 8},${y0 + 108} ${xr - 8},${y0 + 124} ${xr},${y1}`, RED, 6), cable(`M${xb},${y0 + 96} C${xb + 8},${y0 + 108} ${xb - 8},${y0 + 124} ${xb},${y1}`, C.ink, 6),
      place(tFemale(), cx, y0 + 38, -90), place(xtF(), cx, y1 + 48, 90),
      rect(cx + 3, y0 + 46, 6, 22, dash), rect(cx - 9, y0 + 46, 6, 22, dash), rect(cx - 13.2, y1 + 22, 8.4, 22, Object.assign({ rx: 4.2 }, dash)), rect(cx + 4.8, y1 + 22, 8.4, 22, Object.assign({ rx: 4.2 }, dash)));
    const PX = 170, PY = 584, PW = 236, PH = 76;
    xt.append(cable(`M${xr},${y1 + 88} C${xr},628 110,628 ${PX + 20},628`, RED, 7), cable(`M${xb},${y1 + 88} C${xb},664 120,646 ${PX + 20},646`, C.ink, 7), place(xtM(), cx, y1 + 44, -90));
    mainS.append(c3, xt, c8);
    mainL.append(TL('Dây 3', 6, 288, { 'font-weight': 700 }), TL('Dây 8', 6, 424, { 'font-weight': 700 }),
      TL('đực', 94, 328, { fill: C.ink2, 'font-size': 15 }), badge(2, 108, 355), TL('cái', 94, 392, { fill: C.ink2, 'font-size': 15 }),
      TL('cái', 94, 464, { fill: C.ink2, 'font-size': 15 }), badge(4, 108, 488), TL('đực', 94, 516, { fill: C.ink2, 'font-size': 15 }),
      badge(2, 172, 484), TL('Lắp dây 8 vào dây 3', 192, 490, { 'font-weight': 600 }), badge(4, 172, 514), TL('Cắm XT60 vào pin', 192, 520, { 'font-weight': 600 }));
    mainG.append(mainS, mainL);
    if (reverse) {
      const mx = (jn[0] + jp[0]) / 2;
      mainG.append(circle(mx, 252, 18, { fill: C.surface, stroke: RED, 'stroke-width': 3.5 }), path(`M${mx - 8},244 l16,16 m0,-16 l-16,16`, { stroke: RED, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    }

    // ---- pin Ovonic 4S, dây ra ở đầu trái (hướng về chuỗi dây) ----
    const packG = g('batt'), lab = g('batt-label'), lx = PX + 26 + (PW - 36) / 2;
    packG.append(rect(PX, PY, PW, PH, { fill: '#243553', stroke: C.ink, 'stroke-width': 1.6, rx: 10 }), rect(PX, PY, 12, PH, { fill: '#18233a', stroke: 'none', rx: 8 }),
      rect(PX + 26, PY + 8, PW - 36, PH - 16, { fill: 'rgba(255,255,255,.10)', stroke: 'rgba(255,255,255,.28)', 'stroke-width': 1, rx: 6 }));
    lab.append(T('OVONIC 4S', lx, PY + 31, { fill: '#fff', 'font-size': 20, 'font-weight': 800, 'font-style': 'italic' }), T('5300 mAh · 14.8 V', lx, PY + 52, { fill: 'rgba(255,255,255,.88)', 'font-size': 15 }));
    packG.append(lab);

    // ---- dây cân bằng: giắc cắm vào ổ "4 cells", dải 5 dây đi thẳng xuống pin ----
    const bx = (b4.x0 + b4.x1) / 2, by = b4.y0, balG = g(null, { 'data-step': 'balance' }), balS = g(null), balL = g(null), insG = g(null);
    balS.append(ribbon([[[PX + 20, 600], [PX - 10, 600], [bx, 588], [bx, 566]], seg([bx, 566], [bx, by + 12])]));
    const plugG = g('batt-balance');
    plugG.append(rect(bx - 25, by - 6, 50, 26, { fill: '#f1eee6', stroke: EDGE, 'stroke-width': 1.5, rx: 3 }), rect(bx - 10, by - 12, 20, 7, { fill: '#f1eee6', stroke: EDGE, 'stroke-width': 1.3, rx: 2 }));
    (K.BAL_NEG_BACK ? [RED, RED, RED, RED, BLK] : [BLK, RED, RED, RED, RED]).forEach((col, i) => plugG.append(circle(bx - 14 + i * 7, by + 8, 2.6, { fill: col, stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.8 })));
    if (noBal) { plugG.setAttribute('opacity', '0.45'); plugG.querySelectorAll('rect').forEach((r) => r.setAttribute('stroke-dasharray', '4 3')); }
    balS.append(plugG);
    balL.append(badge(5, 160, 258), badge(5, 172, 544), TL('Cân bằng vào ổ 4 cells', 192, 550, { 'font-weight': 600 }));
    balG.append(balS, balL);
    insG.append(inset(noBal, INSET_P));

    const pwr = powerStripP();
    svg.append(pwr, plateG, balG, insG, mainG, packG);
    emphasize(step, { pwr, plateG, mainG, mainS, balG, balS, insG, packG });
    if (noBal) {
      svg.append(path(`M${bx - 15},${by - 8} l30,30 m0,-30 l-30,30`, { stroke: RED, 'stroke-width': 6, 'stroke-linecap': 'round' }));
      banner(svg, 676, 60, ['Thiếu dây cân bằng: máy không biết', 'điện áp từng cell. Luôn cắm cả hai.']);
    }
    if (reverse) banner(svg, 676, 60, ['Sai cực: dây đỏ cắm vào cực −, dây', 'đen vào cực +. Máy báo lỗi hoặc hỏng.']);
  }

  // ---- chọn bố cục theo bề rộng thật của hình; vẽ lại khi bề rộng vượt ngưỡng 560 px ----
  const NARROW_PX = 560;
  diag.wiring = function wiring(step) {
    if (!VALID.includes(step)) throw new Error('[SAC] diag.wiring step la: ' + step);
    const wrong = step.startsWith('wrong'), TITLE = 'Sơ đồ nối: máy sạc, dây 3, dây 8, pin 4S Ovonic';
    const svg = diag.svg([0, 0, 800, 474], TITLE);
    let mode = null;
    const render = (m) => {
      if (m === mode) return;
      mode = m;
      [...svg.children].forEach((c) => { if (c.tagName !== 'title') c.remove(); });
      svg.setAttribute('viewBox', m === 'portrait' ? `0 0 420 ${wrong ? 748 : 676}` : `0 0 800 ${wrong ? 526 : 474}`);
      svg.dataset.layout = m;
      (m === 'portrait' ? portrait : landscape)(svg, step);
    };
    render(window.innerWidth < NARROW_PX + 40 ? 'portrait' : 'landscape');
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver((entries) => { const w = entries[0].contentRect.width; if (w > 0) render(w < NARROW_PX ? 'portrait' : 'landscape'); }).observe(svg);
    }
    return svg;
  };

  // ---- đồ trong hộp (manual tr.21 "THE SET CONTAINS") ----
  diag.boxContents = function boxContents() {
    const svg = diag.svg([0, 0, 800, 596], 'Đồ trong hộp: máy sạc, dây nguồn, và các dây T-plug');
    const card = (x, y, w, h, used) => rect(x, y, w, h, { fill: C.surface2, stroke: used ? C.accent : C.line, 'stroke-width': used ? 2.2 : 1.2, rx: 14 });
    const wave = (x1, y1, x2, y2, amp) => `M${x1},${y1} C${x1 + (x2 - x1) * 0.35},${y1 - amp} ${x1 + (x2 - x1) * 0.65},${y2 + amp} ${x2},${y2}`;

    // 1: máy (mặt trên thu nhỏ)
    svg.append(card(12, 12, 376, 270, true));
    const inner = diag.face('top'); inner.removeAttribute('style');
    inner.querySelectorAll('[data-dim]').forEach((d) => d.remove());
    ['x', 'y', 'width', 'height'].forEach((k, i) => inner.setAttribute(k, [88, 56, 224, 214][i]));
    svg.append(inner, badge(1, 38, 40), TL('Máy sạc iMAX B6AC V2', 62, 46, { 'font-weight': 700 }));

    // 2: dây nguồn C5 → phích cắm
    let gr = g('cable-ac');
    svg.append(card(400, 12, 388, 130, true), badge(2, 426, 40), TL('Dây nguồn: đầu C5 ↔ phích cắm', 450, 46, { 'font-weight': 700 }));
    gr.append(cable(wave(466, 98, 640, 98, 22), BLK, 5), rect(430, 80, 38, 36, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.3, rx: 8 }),
      circle(443, 98, 3.4, { fill: '#9aa3b2', stroke: 'none' }), circle(456, 89, 3.4, { fill: '#9aa3b2', stroke: 'none' }), circle(456, 107, 3.4, { fill: '#9aa3b2', stroke: 'none' }),
      rect(640, 83, 34, 30, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.3, rx: 6 }), rect(674, 89, 20, 4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.9 }), rect(674, 103, 20, 4, { fill: METAL, stroke: EDGE, 'stroke-width': 0.9 }));
    svg.append(gr);

    // 3: banana → T-plug đực
    gr = g('cable-banana-t');
    svg.append(card(400, 152, 388, 130, true), badge(3, 426, 180), TL('Dây 3: banana 4 mm ↔ T-plug', 450, 186, { 'font-weight': 700 }));
    gr.append(cable('M476,226 C540,226 560,236 628,236', RED, 5), cable('M476,252 C540,252 560,244 628,244', C.ink, 5), place(bananaEnd(RED), 476, 226, 180), place(bananaEnd(BLK), 476, 252, 180),
      place(tMale(), 674, 240, 0));
    svg.append(gr);

    // 4..8: cáp dựng đứng, đầu T-plug cái (hoặc jack DC) ở trên, đầu kia ở dưới
    const cw = 147.2, cy = 294, ch = 266, ty = 366, by = 528;
    const rowB = [
      [4, 'cable-dc-clips', ['Dây 4', 'DC ↔ kẹp cá sấu'], 'Tuỳ chọn', false, 'dc', 'clips'],
      [5, 'adapter-t-clips', ['Dây 5', 'T-plug ↔ kẹp'], 'Để dành', false, 'tf', 'clips'],
      [6, 'adapter-t-futaba', ['Dây 6', 'T-plug ↔ Futaba'], 'Để dành', false, 'tf', 'futaba'],
      [7, 'adapter-t-jst', ['Dây 7', 'T-plug ↔ JST'], 'Để dành', false, 'tf', 'jst'],
      [8, 'adapter-t-xt60', ['Dây 8', 'T-plug ↔ XT60'], 'Bạn dùng', true, 'tf', 'xt60'],
    ];
    const dcJack = () => { const q = el('g'); q.append(rect(-8, -3, 8, 6, { fill: METAL, stroke: EDGE, 'stroke-width': 1 }), rect(-26, -10, 18, 20, { fill: '#3a3f49', stroke: EDGE, 'stroke-width': 1.2, rx: 2 }), rect(-70, -13, 44, 26, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 5 })); return q; };
    const futaba = () => { const q = el('g'); q.append(rect(-34, -13, 34, 26, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 3 }), rect(-22, -17, 12, 5, { fill: BLK, stroke: 'rgba(165,175,190,.55)', 'stroke-width': 1.2, rx: 1 }));
      [-10, -2.5, 5].forEach((y) => q.append(rect(-9, y, 9, 5, { fill: '#7c8493', stroke: 'none' }))); return q; };
    const jst = () => { const q = el('g'); q.append(rect(-26, -11, 26, 22, { fill: '#f1eee6', stroke: EDGE, 'stroke-width': 1.3, rx: 3 }), rect(-8, -7, 8, 5.5, { fill: '#6b6f78', stroke: 'none' }), rect(-8, 1.5, 8, 5.5, { fill: '#6b6f78', stroke: 'none' })); return q; };
    const LC = { dc: 70, tf: 58, clips: 58, futaba: 34, jst: 26, xt60: 48 };
    rowB.forEach(([n, id, name, tagTxt, used, top, bot], i) => {
      const x = 12 + i * (cw + 10), cx = x + cw / 2, q = g(id);
      svg.append(card(x, cy, cw, ch, used), badge(n, x + 26, cy + 30), TL(name[0], x + 48, cy + 29, { 'font-weight': 700 }), TL(name[1], x + 14, cy + 58, { fill: C.ink2, 'font-size': 15 }));
      const yTopBack = ty + LC[top];
      const pin = (xs, y1, y2, col) => cable(`M${xs},${y1} C${xs + 16},${y1 + (y2 - y1) * 0.35} ${xs - 16},${y1 + (y2 - y1) * 0.65} ${xs},${y2}`, col, 5);
      if (bot === 'clips') {
        const yb = by - LC.clips, xr = cx - 24, xb = cx + 24;
        q.append(cable(`M${cx - 9},${yTopBack} C${cx - 9},${yTopBack + 24} ${xr},${yb - 24} ${xr},${yb}`, RED, 5), cable(`M${cx + 9},${yTopBack} C${cx + 9},${yTopBack + 24} ${xb},${yb - 24} ${xb},${yb}`, C.ink, 5));
        q.append(place(clipEnd(RED), xr, by, 90), place(clipEnd(BLK), xb, by, 90));
      } else {
        const yb = by - LC[bot];
        q.append(pin(cx - 9, yTopBack, yb, RED), pin(cx + 9, yTopBack, yb, C.ink));
        q.append(place({ xt60: xtF, futaba, jst }[bot](), cx, by, 90));
      }
      q.append(place(top === 'dc' ? dcJack() : tFemale(), cx, ty, -90));
      svg.append(q, T(tagTxt, cx, cy + ch - 14, { 'font-size': 15, 'font-weight': 700, fill: used ? C.accent : C.ink3 }));
    });
    svg.append(T('Viền xanh: món bạn dùng cho pin 4S XT60. Dây 4 chỉ khi cấp nguồn từ ắc quy 12 V.', 400, 584, { fill: C.ink2, 'font-size': 15 }));
    return svg;
  };
})();
