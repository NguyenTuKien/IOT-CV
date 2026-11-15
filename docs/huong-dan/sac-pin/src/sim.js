/* Cục sạc ảo SkyRC iMAX B6AC V2: mặt máy bấm được, máy trạng thái thật theo manual, mô phỏng sạc CC/CV
   pin 4S 5300 mAh nén thời gian. Không dùng thư viện ngoài. Style tiêm vào lúc dùng (class tiền tố .sim-).
   SAC.sim.mount(el)  — cục sạc ảo đầy đủ.   SAC.sim.lcdMock(l1, l2, opts) — khung LCD tĩnh.
   SAC.sim.engine     — phần mô phỏng thuần (không DOM), để kiểm thử. */
(function () {
  'use strict';
  const SAC = window.SAC;
  const sim = (SAC.sim = SAC.sim || {});
  const M = SAC.MENU, CH = SAC.CHEM, LF = SAC.LCD_FIELDS;

  const HOLD_MS = 3000;
  for (const [k, title, summary, inf] of [
    ['off', 'Máy chưa có điện', 'Chưa cắm nguồn nên màn hình tắt, các nút không phản hồi. Cắm dây nguồn AC (hoặc cáp DC 11 đến 18 V) vào máy.', false],
    ['boot', 'Màn khởi động', 'Hiện vài giây sau khi cắm điện, rồi máy vào thẳng LiPo BALANCE CHG (sách tr.9). Sách không in nội dung màn khởi động, nên chữ trên màn này là suy luận.', true]]) {
    if (!SAC.LCD_FIELDS[k]) SAC.LCD_FIELDS[k] = { key: k, group: 'Khởi động', title, lines: ['', ''], summary, hint: '', inferred: inf, page: null, fields: [] };
  }
  const WIRE_HINT = 'Nối dây theo hộp máy: dây #3 (banana → T-plug) cắm vào hai lỗ OUTPUT, dây #8 (T-plug cái → XT60) nối T-plug với pin, giắc cân bằng JST-XH của pin cắm vào ổ cân bằng. Cắm vào máy trước, rồi mới cắm vào pin.';

  // =====================================================================================
  // 1. Mô phỏng thuần (không DOM)
  // =====================================================================================
  const OCV_T = [[0, 3.27], [0.05, 3.50], [0.10, 3.61], [0.20, 3.69], [0.30, 3.73], [0.40, 3.77], [0.50, 3.80],
    [0.60, 3.85], [0.70, 3.91], [0.80, 3.97], [0.90, 4.05], [1.0, 4.18]];
  const P_CHG = 50, P_DIS = 5, BAL_A = 0.2, TAU = 240, R1C = 0.006, R_LEAD = 0.012;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // Điện áp nghỉ một cell LiPo theo mức nạp (đường cong điển hình; ví dụ 3,85 V ≈ 60%, 3,80 V ≈ 50%).
  function ocv(s) {
    if (s <= 0) return Math.max(2.6, 3.27 + s * 5.0);
    if (s >= 1) return 4.18 + (s - 1) * 2.0;
    for (let i = 1; i < OCV_T.length; i++) {
      if (s <= OCV_T[i][0]) {
        const [s0, v0] = OCV_T[i - 1], [s1, v1] = OCV_T[i];
        return v0 + ((s - s0) / (s1 - s0)) * (v1 - v0);
      }
    }
    return 4.18;
  }
  function socOf(v) {
    let lo = -0.15, hi = 1.3;
    for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (ocv(m) < v) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function makePack(restV, irMohm, qmah) {
    return { n: restV.length, Q: qmah, soc: restV.map(socOf), ir: irMohm.map((x) => x / 1000), rLead: R_LEAD, vp: 0, temp: 25 };
  }
  // Pin nguội dần về nhiệt độ phòng khi không có dòng (hằng số thời gian 30 phút, ước lượng).
  function rest(pack, dt) { pack.temp += (25 - pack.temp) * Math.min(1, dt / 1800); }
  // o: {mode, chem, Iset, tvc, cut, cableOK}
  function newRun(o, pack) {
    const n = pack.n, so = sum(pack.soc.map(ocv));
    const r = { mode: o.mode, chem: o.chem, n, Iset: o.Iset, cableOK: !!o.cableOK, balancing: o.mode === 'bal' && !!o.cableOK,
      t: 0, mah: 0, I: 0, V: so, P: 0, phase: 'CC', sawCV: false, done: false, result: null, Tint: 28, hist: [[0, so, 0]], histT: 0,
      cells: pack.soc.map(ocv), dir: 'chg', Vt: 0, vcell: 0, Vend: 0, Vfinal: 0, Iterm: 0 };
    if (o.mode === 'dis') { r.dir = 'dis'; r.Vend = n * o.cut; r.Vfinal = r.Vend; r.cutCell = o.cut; }
    else if (o.mode === 'sto') {
      const vs = n * o.chem.storage;
      r.Vfinal = vs; r.dir = so > vs ? 'dis' : 'chg'; r.Vend = vs; r.Vt = vs; r.vcell = o.chem.storage; r.Iterm = 0.1 * o.Iset;
    } else { r.Vt = n * o.tvc; r.vcell = o.tvc; r.Vfinal = r.Vt; r.Iterm = (o.mode === 'fast' ? 0.25 : 0.1) * o.Iset; }
    return r;
  }
  function finish(r, pack, result) {
    r.done = true; r.result = result; r.I = 0; pack.vp = 0; r.hist.push([r.t, r.V, 0]);
    return null;
  }
  function step(r, pack, dt, lim) {
    const n = pack.n, qas = pack.Q * 3.6;
    const o = pack.soc.map(ocv), rsum = sum(pack.ir) + pack.rLead, so = sum(o);
    const mn = Math.min(...o), spread = Math.max(...o) - mn;
    const b = o.map(() => 0);
    if (r.balancing) for (let i = 0; i < n; i++) if (o[i] - mn > 0.006) b[i] = BAL_A;
    let I;
    if (r.dir === 'chg') {
      const imax = Math.min(r.Iset, P_CHG / Math.max(r.V, 1));
      let icv = (r.Vt - so - n * pack.vp) / rsum;
      if (r.balancing) for (let i = 0; i < n; i++) icv = Math.min(icv, (r.vcell - o[i] - pack.vp) / pack.ir[i] + b[i]);
      const cv = icv < imax;
      I = Math.max(0, Math.min(imax, icv));
      r.phase = cv ? 'CV' : 'CC';
      if (cv) r.sawCV = true;
      if (r.sawCV && cv && I < r.Iterm && (!r.balancing || spread < 0.012)) return finish(r, pack, 'full');
    } else {
      I = Math.min(r.Iset, P_DIS / Math.max(r.V, 1));
      r.phase = 'DIS';
      if (r.t > 0 && (r.V <= r.Vend || (r.cutCell && r.cableOK && Math.min(...r.cells) <= r.cutCell))) return finish(r, pack, 'done');
    }
    const is = r.dir === 'chg' ? I : -I;
    for (let i = 0; i < n; i++) pack.soc[i] += ((is - b[i]) * dt) / qas;
    pack.vp += (is * R1C - pack.vp) * Math.min(1, dt / TAU);
    r.I = I; r.t += dt; r.mah += (I * dt) / 3.6;
    const o2 = pack.soc.map(ocv);
    r.cells = o2.map((x, i) => x + (is - b[i]) * pack.ir[i] + pack.vp);
    r.V = sum(r.cells) + is * pack.rLead;
    r.P = r.V * I;
    r.Tint += (26 + 0.6 * r.P - r.Tint) * Math.min(1, dt / 600);
    pack.temp += (25 + 3.0 * I - pack.temp) * Math.min(1, dt / 1200);   // ước lượng: ~34 °C ở 3 A
    r.spread = Math.max(...o2) - Math.min(...o2);
    if (r.t - r.histT >= 10) { r.histT = r.t; r.hist.push([r.t, r.V, I]); }
    if (r.dir === 'chg' && lim) {
      if (lim.timerS && r.t >= lim.timerS) return 'overtime';
      if (lim.capMah && r.mah >= lim.capMah) return 'overcap';
    }
    return null;
  }
  // Tiến dtSim giây mô phỏng (bước con tối đa 2 s). Trả mã lỗi hoặc null.
  function advance(r, pack, dtSim, lim) {
    let rem = dtSim, err = null;
    while (rem > 1e-9 && !r.done && !err) { const d = Math.min(rem, 2); err = step(r, pack, d, lim); rem -= d; }
    return err;
  }
  sim.engine = { ocv, socOf, makePack, newRun, step, advance, rest, P_CHG, P_DIS };

  // =====================================================================================
  // 2. Định dạng, LCD
  // =====================================================================================
  const f2 = (x, w, d) => x.toFixed(d).padStart(w);
  const T = (text, f, blink) => [text, f || null, !!blink];
  const segLen = (a) => a.reduce((n, s) => n + s[0].length, 0);
  function LR(left, right) {
    const gap = 16 - segLen(left) - segLen(right);
    if (gap < 0) console.error('[SAC.sim] dong LCD qua 16 ky tu:', left.map((s) => s[0]).join(''), right.map((s) => s[0]).join(''));
    return [...left, T(' '.repeat(Math.max(0, gap))), ...right];
  }
  const R1 = (x) => Math.round(x * 10) / 10;
  const cyc = (i, n, d) => (i + d + n) % n;
  const mmss = (t) => String(Math.floor(t / 60)).padStart(3, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  // Chuyển hàng đoạn chữ thành 16 ký tự {c, f, b}
  function charsOf(row) {
    const out = [];
    for (const [text, f, b] of row) for (const ch of text) out.push({ c: ch, f, b });
    while (out.length < 16) out.push({ c: ' ', f: null, b: false });
    return out.slice(0, 16);
  }

  // =====================================================================================
  // 3. Style
  // =====================================================================================
  const CSS = `
.sim{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:24px;align-items:start}
.sim-col{display:grid;gap:16px;min-width:0}
@media(max-width:900px){.sim{grid-template-columns:minmax(0,1fr)}}
.sim-dev{position:relative;border-radius:22px;padding:18px 18px 24px;color:#fff;background:linear-gradient(160deg,#3b7be6 0%,#2158c2 55%,#1a479f 100%);box-shadow:0 2px 0 #7fa8f0 inset,0 -10px 24px rgba(0,0,0,.25) inset,0 18px 40px rgba(20,40,100,.28);user-select:none;-webkit-user-select:none}
.sim-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font:700 13px/1 var(--font-display);letter-spacing:.04em}
.sim-top b{font-size:clamp(16px,2.4vw,22px);font-style:italic;letter-spacing:-.01em}
.sim-top small{font-weight:500;opacity:.85;font-size:11px;letter-spacing:.02em}
.sim-bezel{margin:12px 0 6px;padding:12px;border-radius:12px;background:#0f1722;box-shadow:inset 0 2px 6px #000}
.sim-lcd{container-type:inline-size;background:var(--lcd-bg);color:var(--lcd-ink);border-radius:6px;padding:10px 10px;box-shadow:inset 0 0 16px rgba(5,20,70,.45)}
.sim-row{display:flex;font:600 calc(100cqw/10.8)/1.45 var(--mono);height:1.45em}
.sim-c{flex:1 1 0;min-width:0;text-align:center;background:rgba(20,40,0,.06);margin:0 .5px;border-radius:2px;white-space:pre;overflow:hidden}
.sim-c[data-f]{cursor:help}
.sim-c.hl,.sim-fl li.hl{outline:2px solid var(--accent);outline-offset:-1px}
.sim-c.hl{background:rgba(29,95,214,.28)}
.sim-lcd.off{background:#27301f;box-shadow:inset 0 0 16px #000}
.sim-lcd.off .sim-c{background:transparent}
.sim-c.blink{animation:sim-blink 1s steps(1) infinite}
@keyframes sim-blink{50%{opacity:.08}}
.sim-msg{min-height:20px;margin:6px 2px 0;font:500 12.5px/1.4 var(--font);color:#fff3c4}
.sim-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:8px}
.sim-bw{display:grid;justify-items:center;gap:8px}
.sim-btn{position:relative;width:min(62px,17vw);aspect-ratio:1;border-radius:50%;border:0;padding:0;background:radial-gradient(circle at 35% 30%,#fafafa,#cfd5de 60%,#9aa3b2);box-shadow:0 3px 0 #6e7787,0 6px 10px rgba(0,0,0,.35);cursor:pointer;touch-action:none;color:#1b2432;font:700 12px var(--font)}
.sim-btn.down{transform:translateY(3px);box-shadow:0 0 0 #6e7787,0 2px 4px rgba(0,0,0,.35)}
.sim-btn:focus-visible{outline:3px solid #ffe08a;outline-offset:3px}
.sim-btn svg{position:absolute;inset:-7px;width:calc(100% + 14px);height:calc(100% + 14px);pointer-events:none;transform:rotate(-90deg)}
.sim-btn svg circle{fill:none;stroke:#ffd54a;stroke-width:4;stroke-linecap:round;stroke-dasharray:188.5;stroke-dashoffset:188.5;opacity:0}
.sim-leg{display:grid;grid-template-columns:repeat(4,1fr);gap:2px 10px;margin-top:8px;text-align:center;font:600 11.5px/1.3 var(--font)}
.sim-leg b{font-weight:700}
.sim-leg span{font-weight:500;opacity:.9}
.sim-leg2{grid-column:2/4;grid-row:2;position:relative;text-align:center}
.sim-leg2 i{font-style:normal;position:absolute;top:0;transform:translateX(-50%)}
.sim-leg2 i:first-child{left:25%}
.sim-leg2 i:last-child{left:75%}
.sim-leg2 em{font-style:normal}
.sim-lab{font:600 11.5px/1.25 var(--font);text-align:center}
.sim-lab small{display:block;font-weight:400;opacity:.8}
.sim-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin-top:14px;font-size:13.5px;color:var(--ink-2)}
.sim-bar label{display:inline-flex;gap:6px;align-items:center}
.sim-scn{display:flex;flex-wrap:wrap;gap:6px}
.sim-scn .chip{white-space:normal;text-align:left;padding:6px 12px}
@media(min-width:901px){.sim>.sim-col:first-child{position:sticky;top:calc(var(--nav-h) + 16px)}}
.sim-scn .chip.on{background:var(--accent);color:#fff}
.sim-ex h3{margin:0 0 6px}
.sim-fl{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:6px}
.sim-fl li{display:grid;grid-template-columns:minmax(64px,auto) 1fr;gap:10px;align-items:start;padding:8px 10px;border-radius:10px;background:var(--surface-2);font-size:14px}
.sim-fl li b{display:block;font-weight:600}
.sim-v{font:600 13px/1.5 var(--mono);background:var(--lcd-bg);color:var(--lcd-ink);padding:1px 6px;border-radius:4px;white-space:pre;justify-self:start}
.sim-inf{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11.5px;font-weight:600;background:var(--warn-soft);color:var(--warn)}
.sim-extra{display:grid;gap:8px;margin-top:10px}
.sim-extra:empty{display:none}
.sim-hint{margin:10px 0 0;font-size:14px;color:var(--ink-2)}
.sim-pack{display:grid;gap:6px;margin-top:10px}
.sim-pc{display:grid;grid-template-columns:44px 1fr 64px;gap:8px;align-items:center;font-size:13px}
.sim-pb{height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden}
.sim-pb i{display:block;height:100%;background:var(--accent);border-radius:6px}
.sim-pc b{font:600 13px var(--mono);text-align:right}
.sim-spread{font-size:13.5px;margin-top:4px}
.sim-spread.ok{color:var(--ok)} .sim-spread.mid{color:var(--warn)} .sim-spread.bad{color:var(--danger)}
.sim-root{outline:none}
.sim-chart{margin-top:24px}
.sim-chart svg{width:100%;height:auto;display:block}
.sim-chart .lg{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink-2);margin-bottom:6px}
.sim-chart .lg i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.sim-scn-d{font-size:14px;color:var(--ink-2);margin:10px 0 0}
.sim-scn-d ol{margin:6px 0 0;padding-left:20px}
.sim-mock{display:inline-block;width:min(100%,320px);vertical-align:top}
.sim-mock .sim-row{font-size:calc(100cqw/10.8)}
`;
  function ensureStyle() {
    if (document.getElementById('sim-style')) return;
    const s = document.createElement('style');
    s.id = 'sim-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // =====================================================================================
  // 4. Khung LCD (dùng chung cho máy ảo và hình tĩnh)
  // =====================================================================================
  function buildLcd(extraClass) {
    const lcd = document.createElement('div');
    lcd.className = 'sim-lcd' + (extraClass ? ' ' + extraClass : '');
    const cells = [];
    for (let r = 0; r < 2; r++) {
      const row = document.createElement('div');
      row.className = 'sim-row';
      for (let c = 0; c < 16; c++) { const s = document.createElement('span'); s.className = 'sim-c'; s.textContent = ' '; row.appendChild(s); cells.push(s); }
      lcd.appendChild(row);
    }
    return { lcd, cells };
  }
  function paintCells(cells, rows) {
    for (let r = 0; r < 2; r++) {
      const ch = charsOf(rows[r] || []);
      for (let c = 0; c < 16; c++) {
        const el = cells[r * 16 + c], x = ch[c];
        if (el.textContent !== x.c) el.textContent = x.c;
        if (x.f) el.dataset.f = x.f; else delete el.dataset.f;
        el.classList.toggle('blink', x.b);
      }
    }
  }
  function markCells(cells, k) {
    for (const el of cells) el.classList.toggle('hl', !!k && el.dataset.f === k);
  }

  // Khung LCD tĩnh: lcdMock('LiPo BALANCE CHG', '3.0A      14.8V (4S)', {fields:[{k, at:[dòng, cột, độ dài]}]})
  sim.lcdMock = function (l1, l2, opts) {
    ensureStyle();
    const o = opts || {};
    const { lcd, cells } = buildLcd('sim-mock');
    // gán khoá trường theo vị trí
    const keyAt = new Map();
    for (const f of o.fields || []) { const [li, col, len] = f.at; for (let i = 0; i < len; i++) keyAt.set(li * 16 + col + i, f.k); }
    const strs = [String(l1 || '').padEnd(16).slice(0, 16), String(l2 || '').padEnd(16).slice(0, 16)];
    cells.forEach((el, i) => {
      el.textContent = strs[Math.floor(i / 16)][i % 16];
      const k = keyAt.get(i);
      if (k) el.dataset.f = k;
    });
    lcd.mark = (k) => markCells(cells, k);
    lcd.addEventListener('mouseover', (e) => { const f = e.target.dataset && e.target.dataset.f; if (f) { markCells(cells, f); lcd.dispatchEvent(new CustomEvent('simfield', { detail: f })); } });
    lcd.addEventListener('mouseleave', () => { markCells(cells, null); lcd.dispatchEvent(new CustomEvent('simfield', { detail: null })); });
    return lcd;
  };

  // =====================================================================================
  // 5. Máy ảo
  // =====================================================================================
  const MEM_TYPES = ['lipo', 'life', 'liio', 'lihv', 'nimh', 'nicd', 'pb'];
  const DELTA = [0.008, -0.005, -0.018, 0.007];
  const PACK_STATES = {
    fly: { v: 3.60, label: 'Vừa hạ cánh (3,60 V/cell)' },
    low: { v: 3.30, label: 'Xả sâu (3,30 V/cell)' },
    store: { v: 3.85, label: 'Đang ở mức lưu kho (3,85 V/cell)' },
    near: { v: 4.12, label: 'Gần đầy (4,12 V/cell)' },
    unused: { v: 4.15, label: 'Còn đầy, chưa bay (4,15 V/cell)' },
    weakcell: { v: 3.70, delta: [0.01, 0.0, -0.30, 0.01], ir: [5, 5, 13, 6], label: 'Một cell yếu (cell 3 thấp hơn 0,3 V, nội trở cao)' },
  };
  const PACK_Q = 5300;
  const IR_GOOD = [4, 4, 5, 4], IR_WEAK = [12, 5, 5, 6];

  const SCEN = [
    { id: 'bay', t: 'Sạc cân bằng sau bay', st: 'fly',
      d: 'Pin 4S vừa hạ cánh, đã nguội, mỗi cell khoảng 3,6 V, hơi lệch nhau. Dây cân bằng đã cắm.',
      steps: ['Đã đặt sẵn LiPo BALANCE CHG, 3,0 A, 4S.', 'Giữ ENTER 3 giây.', 'Xác nhận R:4SER S:4SER bằng ENTER.', 'Chọn tốc độ 600× và xem các cell hội tụ.'],
      setup(S) { go(S, 'lipo', 'bal', 3.0, 4); } },
    { id: 'sto', t: 'Đưa về storage', st: 'unused',
      d: 'Pin còn đầy (4,15 V/cell), hai ngày nữa mới bay. Máy phải xả xuống 3,80 V/cell, và chỉ xả được 5 W.',
      steps: ['Đã đặt sẵn LiPo STORAGE, 4S.', 'Giữ ENTER 3 giây, xác nhận.', 'Nhìn dòng xả: khoảng 0,3 A. Chọn 600× để xem mất bao lâu.'],
      setup(S) { go(S, 'lipo', 'sto', 3.0, 4); } },
    { id: 'ir', t: 'Đo nội trở', st: 'store', pack: 'good',
      d: 'Đo nội trở từng cell của pin tốt. Cần cắm dây chính và dây cân bằng.',
      steps: ['Đã vào BATT RESISTANCE.', 'Màn hình hiện nội trở từng cell, bấm INC xem TOTAL/H/L.'],
      setup(S) { S.kind = 'ir'; S.sub = 0; S.pi = M.programs.findIndex((p) => p.id === 'ir'); } },
    { id: 'irweak', t: 'Đo nội trở: một cell yếu', st: 'store', pack: 'weak',
      d: 'Giống trên nhưng cell 1 có nội trở gấp hơn hai lần các cell kia (ví dụ trong sách). Đây là dấu hiệu pin hỏng.',
      steps: ['Đã vào BATT RESISTANCE.', 'Tìm số 012 so với 005.'],
      setup(S) { S.kind = 'ir'; S.sub = 0; S.pi = M.programs.findIndex((p) => p.id === 'ir'); } },
    { id: 'meter', t: 'Đọc điện áp từng cell', st: 'fly',
      d: 'Xem điện áp từng cell và hiệu cao nhất trừ thấp nhất bằng BATT METER.',
      steps: ['Đã vào BATT METER.', 'Bấm INC để xem MAIN/H/L.'],
      setup(S) { S.kind = 'meter'; S.sub = 0; S.pi = M.programs.findIndex((p) => p.id === 'meter'); } },
    { id: 'nobal', t: 'Quên cắm dây cân bằng', st: 'fly', wiring: { balance: false },
      d: 'Chỉ cắm dây chính, quên giắc cân bằng. Máy cảnh báo, và nếu cứ chạy tiếp thì không cân bằng được.',
      steps: ['Đã đặt sẵn LiPo BALANCE CHG, 3,0 A, 4S.', 'Giữ ENTER 3 giây và đọc cảnh báo.', 'Thử ENTER để chạy tiếp: cả sáu ô cell hiện 0.00, còn khung "Pin thật" bên dưới cho thấy cell vẫn lệch.'],
      setup(S) { go(S, 'lipo', 'bal', 3.0, 4); } },
    { id: 'rev', t: 'Cắm ngược cực', st: 'fly', wiring: { reverse: true },
      d: 'Giả lập cắm ngược cực dây chính. Máy chặn lại bằng REVERSE POLARITY. Trên máy thật đừng thử.',
      steps: ['Đã đặt sẵn LiPo BALANCE CHG, 3,0 A, 4S.', 'Giữ ENTER 3 giây và đọc lỗi.'],
      setup(S) { go(S, 'lipo', 'bal', 3.0, 4); } },
    { id: 'cells', t: 'Đặt sai số cell', st: 'fly',
      d: 'Pin 4S nhưng màn hình đang đặt 3S. Máy dò được 4 cell (R) và so với 3 bạn đặt (S).',
      steps: ['Đã đặt sẵn LiPo BALANCE CHG với 3S.', 'Giữ ENTER 3 giây và đọc R:4SER S:3SER.', 'Bấm STOP, sửa số cell về 4S.'],
      setup(S) { go(S, 'lipo', 'bal', 3.0, 3); } },
  ];
  function go(S, prog, mode, cur, cells) {
    S.pi = M.programs.findIndex((p) => p.id === prog);
    const p = M.programs[S.pi];
    S.mi = p.modes.findIndex((m) => m.id === mode);
    S.kind = 'mode'; S.edit = null;
    S.v[prog + ':cells'] = cells;
    S.v[prog + ':' + mode + ':cur'] = cur;
  }

  sim.mount = function mount(el) {
    ensureStyle();
    const { h } = SAC;

    // ---------------- trạng thái ----------------
    const defSettings = () => ({ timer: { on: true, min: 120 }, cap: { on: true, mah: 5000 }, temp: { on: true, c: 50 }, unit: 'C', rest: 10, nimh: 0, nicd: 0, kb: true, bz: true, inlow: 11.0 });
    let S = null, speed = 60, sound = false, tok = 0, lastT = 0, tickN = 0;
    let scenId = null, packState = 'fly', irKind = 'good';
    // Bàn thực hành 3D (bench) gắn vào cùng một máy: dây cắm thật quyết định điện, cân bằng, cực.
    let PACK = null, external = false, powered = true, bootUntil = 0;
    let ext = { power: false, main: false, rev: false, balSocket: null };
    const listeners = {};
    const on = (k, f) => { (listeners[k] = listeners[k] || []).push(f); return () => { listeners[k] = listeners[k].filter((x) => x !== f); }; };
    const emit = (k, a) => (listeners[k] || []).forEach((f) => { try { f(a); } catch (err) { console.error('[SAC.sim] listener ' + k, err); } });
    const P = { enter: null, rep: null };

    function makePackNow() {
      const st = PACK_STATES[packState], base = st.v;
      const vs = (st.delta || DELTA).map((d) => +(base + d).toFixed(3));
      return makePack(vs, st.ir || (irKind === 'weak' ? IR_WEAK : IR_GOOD), PACK_Q);
    }
    PACK = makePackNow();
    const wiringNow = () => (external
      ? { power: ext.power, main: ext.main, reverse: ext.rev, balSocket: ext.balSocket, balance: ext.balSocket === 4 }
      : { power: true, main: true, reverse: false, balance: true });
    const balSock = () => { const w = S.wiring; return 'balSocket' in w ? w.balSocket : (w.balance ? 4 : null); };
    const rCount = () => { const b = balSock(); return b === 2 || b === 3 ? b : S.pack.n; };
    function fresh() {
      return { kind: 'mode', pi: 0, mi: 0, edit: null, v: {}, sub: 0, sysIdx: 0, sysEdit: null, settings: defSettings(),
        mem: { slots: Array(10).fill(null), n: 0, step: -1, edit: false, draft: null, view: 0, phase: 'slot' },
        phase: null, err: null, run: null, runView: 0, msg: '', tvc: null, cut: null,
        wiring: wiringNow(), pack: PACK, keepOnBoot: false };
    }
    function reset(scenario) {
      tok++;
      S = fresh();
      if (scenario) { if (scenario.wiring && !external) Object.assign(S.wiring, scenario.wiring); scenario.setup(S); S.keepOnBoot = true; }
      render();
    }
    const curProg = () => M.programs[S.pi];
    const curMode = () => (curProg().modes ? curProg().modes[S.mi] : null);

    // ---------------- trường chỉnh sửa trên màn chế độ ----------------
    function fieldsOf(prog, mode) {
      if (prog.kind === 'li') return [{ k: 'cur', min: mode.cur[0], max: mode.cur[1], step: 0.1, def: 2.0 }, { k: 'cells', scope: 'prog', min: 1, max: 6, step: 1, def: 2 }];
      if (prog.kind === 'pb') return [{ k: 'cur', min: 0.1, max: mode.id === 'dis' ? 2.0 : 6.0, step: 0.1, def: mode.id === 'dis' ? 0.1 : 2.0 }, { k: 'cells', scope: 'prog', min: 1, max: 10, step: 1, def: 1 }];
      switch (mode.id) {
        case 'chg': case 'auto': return [{ k: 'cur', min: 0.1, max: 6.0, step: 0.1, def: 2.0 }];
        case 'dis': return [{ k: 'cur', min: 0.1, max: 2.0, step: 0.1, def: 0.1 }, { k: 'cut', min: 0.1, max: 1.1, step: 0.1, def: 1.0 }];
        case 're': return [{ k: 'n', min: 1, max: 3, step: 1, def: 1 }];
        default: return [{ k: 'dir', opts: ['CHG>DCHG', 'DCHG>CHG'], def: 0 }, { k: 'n', min: 1, max: 5, step: 1, def: 1 }];
      }
    }
    const vkey = (prog, mode, f) => (f.scope === 'prog' ? prog.id : prog.id + ':' + mode.id) + ':' + f.k;
    const getV = (prog, mode, f) => { const k = vkey(prog, mode, f); return k in S.v ? S.v[k] : f.def; };
    function adjustField(prog, mode, f, d, mult) {
      const cur = getV(prog, mode, f);
      const k = vkey(prog, mode, f);
      if (f.opts) { S.v[k] = cyc(cur, f.opts.length, d); return; }
      S.v[k] = clamp(R1(cur + d * f.step * (f.step < 1 ? mult : 1)), f.min, f.max);
      if (f.step >= 1) S.v[k] = Math.round(S.v[k]);
    }
    function modeScreen() {
      const prog = curProg(), mode = curMode(), chem = CH[prog.chem], fs = fieldsOf(prog, mode), e = S.edit;
      const gv = (i) => getV(prog, mode, fs[i]);
      const l1 = [T(chem.name, 'type'), T(' '), T(mode.lcd, 'mode')];
      let l2, key;
      if (prog.kind === 'li') {
        const n = gv(1);
        l2 = LR([T(gv(0).toFixed(1) + 'A', 'cur', e === 0)], [T(`${(chem.nominal * n).toFixed(1)}V (${n}S)`, 'cells', e === 1)]);
        key = 'li-mode';
      } else if (prog.kind === 'pb') {
        const n = gv(1);
        l2 = LR([T(gv(0).toFixed(1) + 'A', 'cur', e === 0)], [T(`${(2 * n).toFixed(1)}V (${n}P)`, 'cells', e === 1)]);
        key = 'pb-' + mode.id;
      } else {
        key = 'ni-' + mode.id;
        if (mode.id === 'chg' || mode.id === 'auto') l2 = LR([T('CURRENT')], [T(gv(0).toFixed(1) + 'A', 'cur', e === 0)]);
        else if (mode.id === 'dis') l2 = LR([T(gv(0).toFixed(1) + 'A', 'cur', e === 0)], [T(`CUT: ${gv(1).toFixed(1)}V`, 'cut', e === 1)]);
        else if (mode.id === 're') l2 = LR([], [T(String(gv(0)), 'n', e === 0)]);
        else l2 = LR([T(fs[0].opts[gv(0)], 'dir', e === 0)], [T(String(gv(1)), 'n', e === 1)]);
      }
      return { key, rows: [l1, l2] };
    }

    // ---------------- bộ nhớ ----------------
    const memDefaults = (type) => {
      const c = CH[type], kind = c.kind;
      return { type, cells: kind === 'pb' ? 2 : 2, chg: 2.0, dsch: kind === 'ni' ? 1.0 : 2.0, dv: kind === 'ni' ? 1.1 : (kind === 'pb' ? 1.7 : c.cutDef), tvc: c.full || 4.2, trickle: 100, delay: 1 };
    };
    const memSteps = (d) => { const k = CH[d.type].kind; return k === 'li' ? ['type', 'cells', 'chg', 'dsch', 'dv', 'tvc', 'save'] : k === 'ni' ? ['type', 'cells', 'chg', 'trickle', 'delay', 'dv', 'dsch', 'save'] : ['type', 'cells', 'chg', 'dsch', 'dv', 'save']; };
    function memVoltsText(d) {
      const c = CH[d.type];
      return c.kind === 'pb' ? `${(2 * d.cells).toFixed(1)}V ( ${d.cells}P )` : `${(c.nominal * d.cells).toFixed(1)}V ( ${d.cells}S )`;
    }
    function memAdjust(d, step, dir, mult) {
      const c = CH[d.type];
      switch (step) {
        case 'type': { const nd = memDefaults(MEM_TYPES[cyc(MEM_TYPES.indexOf(d.type), 7, dir)]); Object.assign(d, nd); break; }
        case 'cells': d.cells = clamp(d.cells + dir, 1, c.kind === 'li' ? 6 : c.kind === 'ni' ? 15 : 10); break;
        case 'chg': d.chg = clamp(R1(d.chg + dir * 0.1 * mult), 0.1, 6.0); break;
        case 'dsch': d.dsch = clamp(R1(d.dsch + dir * 0.1 * mult), 0.1, 2.0); break;
        case 'dv': { const [lo, hi] = c.kind === 'li' ? c.cut : c.kind === 'ni' ? [0.1, 1.1] : [1.5, 1.8]; d.dv = clamp(R1(d.dv + dir * 0.1), lo, hi); break; }
        case 'tvc': d.tvc = clamp(+(d.tvc + dir * 0.01).toFixed(2), c.tvc[0], c.tvc[1]); break;
        case 'trickle': d.trickle = clamp(d.trickle + dir * 10 * mult, 10, 500); break;
        case 'delay': d.delay = clamp(d.delay + dir, 1, 20); break;
        default: break;
      }
    }
    function memScreen() {
      const m = S.mem, n = m.n + 1, title = `[BATT MEMORY ${n}]`;
      if (m.phase === 'slot') return { key: 'mem-slot', rows: [[T('[BATT MEMORY '), T(String(n), 'num'), T(']')], LR([], [T('ENTER SET->', 'set')])] };
      if (m.phase === 'saving') return { key: 'mem-saving', rows: [[T('SAVE PROGRAM')], [T('SAVE....', 'v')]] };
      if (m.phase === 'load') return { key: 'mem-load', rows: [[T('ENTER CHARGER')], [T('LOAD......', 'v')]] };
      if (m.phase === 'sum') {
        const d = m.slots[m.n];
        if (m.view === 0) return { key: 'mem-sum1', rows: [[T(title)], [T(`${CH[d.type].name} ${memVoltsText(d).replace(/ /g, '')}`, 'v')]] };
        return { key: 'mem-sum2', rows: [[T(title)], [T(`C:${d.chg.toFixed(1)}A`, 'c'), T(' '), T(`D:${d.dsch.toFixed(1)}A`, 'd')]] };
      }
      const d = m.draft, st = memSteps(d)[m.step], e = m.edit;
      const val = (t) => LR([], [T(t, 'v', e)]);
      switch (st) {
        case 'type': return { key: 'mem-type', rows: [[T('BATT TYPE')], val(CH[d.type].name)] };
        case 'cells': return { key: 'mem-volts', rows: [[T('BATT VOLTS')], val(memVoltsText(d))] };
        case 'chg': return { key: 'mem-chg', rows: [[T('CHARGE CURRENT')], val(d.chg.toFixed(1) + 'A')] };
        case 'dsch': return { key: 'mem-dsch', rows: [[T('DSCH CURRENT')], val(d.dsch.toFixed(1) + 'A')] };
        case 'dv': return { key: 'mem-dv', rows: [[T('DSCH VOLTAGE')], val(d.dv.toFixed(1) + 'V/CELL')] };
        case 'tvc': return { key: 'mem-tvc', rows: [[T('TVC=YOUR RISK')], val(d.tvc.toFixed(2) + 'V')] };
        case 'trickle': return { key: 'mem-trickle', rows: [[T('TRICKLE')], val(d.trickle + 'mA')] };
        case 'delay': return { key: 'mem-delay', rows: [[T('PEAK DELAY')], val(d.delay + 'Min')] };
        default: return { key: 'mem-save', rows: [[T('SAVE PROGRAM')], val('ENTER')] };
      }
    }
    function memKey(btn, mult) {
      const m = S.mem;
      if (m.phase === 'saving' || m.phase === 'load') return;
      if (m.phase === 'slot') {
        if (btn === 'inc' || btn === 'dec') m.n = cyc(m.n, 10, btn === 'inc' ? 1 : -1);
        else if (btn === 'enter') { m.draft = Object.assign(memDefaults('lipo'), m.slots[m.n] || {}); m.step = 0; m.edit = false; m.phase = 'set'; }
        else if (btn === 'stop') S.kind = 'prog';
        return;
      }
      if (m.phase === 'sum') {
        if (btn === 'inc' || btn === 'dec') m.view = 1 - m.view;
        else if (btn === 'stop') m.phase = 'slot';
        return;
      }
      const d = m.draft, steps = memSteps(d), st = steps[m.step];
      if (m.edit) {
        if (btn === 'inc' || btn === 'dec') memAdjust(d, st, btn === 'inc' ? 1 : -1, mult);
        else m.edit = false;
        return;
      }
      if (btn === 'inc' || btn === 'dec') m.step = cyc(m.step, steps.length, btn === 'inc' ? 1 : -1);
      else if (btn === 'stop') m.phase = 'slot';
      else if (btn === 'enter') {
        if (st === 'save') {
          m.slots[m.n] = Object.assign({}, d); m.phase = 'saving';
          const t = tok; setTimeout(() => { if (t === tok && S.kind === 'mem' && m.phase === 'saving') { m.phase = 'sum'; m.view = 0; render(); } }, 900);
        } else m.edit = true;
      }
    }
    const memHoldable = () => S.kind === 'mem' && (S.mem.phase === 'sum' || (S.mem.phase === 'slot' && !!S.mem.slots[S.mem.n]));
    function memLoad() {
      const m = S.mem, d = m.slots[m.n];
      m.phase = 'load'; render();
      const t = tok;
      setTimeout(() => {
        if (t !== tok || S.kind !== 'mem') return;
        const pi = M.programs.findIndex((p) => p.chem === d.type), prog = M.programs[pi];
        S.pi = pi; S.mi = 0; S.edit = null; S.kind = 'mode'; m.phase = 'slot';
        S.v[prog.id + ':cells'] = d.cells;
        for (const mode of prog.modes) {
          S.v[prog.id + ':' + mode.id + ':cur'] = mode.id === 'dis' ? d.dsch : d.chg;
        }
        S.tvc = prog.kind === 'li' ? d.tvc : null; S.cut = prog.kind === 'li' ? d.dv : null;
        render();
      }, 900);
    }

    // ---------------- cài đặt hệ thống ----------------
    const sysList = () => M.sysScreens;
    function sysFields(id) {
      const s = S.settings;
      const tg = (get, set) => ({ adj: () => set(!get()), on: true });
      switch (id) {
        case 'timer': return [tg(() => s.timer.on, (v) => (s.timer.on = v)), { adj: (d, m) => { if (s.timer.on) s.timer.min = clamp(s.timer.min + d * m, 1, 720); } }];
        case 'cap': return [tg(() => s.cap.on, (v) => (s.cap.on = v)), { adj: (d, m) => { if (s.cap.on) s.cap.mah = clamp(s.cap.mah + d * 100 * m, 100, 50000); } }];
        case 'temp': return [tg(() => s.temp.on, (v) => (s.temp.on = v)), { adj: (d, m) => { if (s.temp.on) s.temp.c = clamp(s.temp.c + d * m, 20, 80); } }];
        case 'unit': return [{ adj: () => { s.unit = s.unit === 'C' ? 'F' : 'C'; } }];
        case 'rest': return [{ adj: (d, m) => { s.rest = clamp(s.rest + d * m, 1, 60); } }];
        case 'nimh': return [{ adj: (d) => { s.nimh = s.nimh === 0 ? (d > 0 ? 5 : 15) : (s.nimh + d < 5 ? 0 : s.nimh + d > 15 ? 0 : s.nimh + d); } }];
        case 'nicd': return [{ adj: (d) => { s.nicd = s.nicd === 0 ? (d > 0 ? 5 : 15) : (s.nicd + d < 5 ? 0 : s.nicd + d > 15 ? 0 : s.nicd + d); } }];
        case 'beep': return [tg(() => s.kb, (v) => (s.kb = v)), tg(() => s.bz, (v) => (s.bz = v))];
        case 'inlow': return [{ adj: (d) => { s.inlow = clamp(R1(s.inlow + d * 0.1), 10.0, 11.0); } }];
        default: return [];
      }
    }
    const onoff = (b) => (b ? 'ON' : 'OFF');
    function sysScreen() {
      const id = sysList()[S.sysIdx], s = S.settings, e = S.sysEdit;
      const key = 'sys-' + id;
      const dp = (v) => (v === 0 ? 'Default' : v + 'mV');
      switch (id) {
        case 'timer': return { key, rows: [[T('Safety Timer')], s.timer.on ? LR([T('ON', 'v', e === 0)], [T(s.timer.min + 'Min', 'min', e === 1)]) : [T('OFF', 'v', e === 0)]] };
        case 'cap': return { key, rows: [[T('Capacity Cut-Off')], s.cap.on ? LR([T('ON', 'v', e === 0)], [T(s.cap.mah + 'mAH', 'mah', e === 1)]) : [T('OFF', 'v', e === 0)]] };
        case 'temp': return { key, rows: [[T('Temp Cut-Off')], s.temp.on ? LR([T('ON', 'v', e === 0)], [T(s.temp.c + '°C', 'c', e === 1), T(' '), T(Math.round(s.temp.c * 9 / 5 + 32) + '°F', 'f', e === 1)]) : [T('OFF', 'v', e === 0)]] };
        case 'unit': return { key, rows: [[T('Temperature Unit')], LR([], [T(s.unit === 'C' ? 'Celsius' : 'Fahrenheit', 'v', e === 0)])] };
        case 'rest': return { key, rows: [[T('Rest Time')], LR([T('CHG>DCHG')], [T(s.rest + 'Min', 'v', e === 0)])] };
        case 'nimh': return { key, rows: [[T('NiMH Sensitivity')], LR([T('D.Peak')], [T(dp(s.nimh), 'v', e === 0)])] };
        case 'nicd': return { key, rows: [[T('NiCd Sensitivity')], LR([T('D.Peak')], [T(dp(s.nicd), 'v', e === 0)])] };
        case 'beep': return { key, rows: [LR([T('Key Beep')], [T(onoff(s.kb), 'kb', e === 0)]), LR([T('Buzzer')], [T(onoff(s.bz), 'bz', e === 1)])] };
        case 'inlow': return { key, rows: [[T('Input. Power Low')], LR([T('Cut-Off')], [T(s.inlow.toFixed(1) + 'V', 'v', e === 0)])] };
        case 'factory': return { key, rows: [[T('Load Factory Set')], LR([], [T('Enter', 'v')])] };
        case 'version': return { key, rows: [[T('Version')], [T('HW:1.00', 'hw'), T(' '), T('FW: 1.10', 'fw')]] };
        default: return { key, rows: [[T('Serial Number:')], LR([], [T('000000', 'v')])] };
      }
    }
    function sysKey(btn, mult) {
      const id = sysList()[S.sysIdx], fs = sysFields(id);
      if (S.sysEdit != null) {
        if (btn === 'inc' || btn === 'dec') fs[S.sysEdit].adj(btn === 'inc' ? 1 : -1, mult);
        else if (btn === 'enter') {
          let nx = S.sysEdit + 1;
          // bỏ qua ô số phút/dung lượng khi đang OFF
          if (nx < fs.length && S.sysEdit === 0 && (id === 'timer' ? !S.settings.timer.on : id === 'cap' ? !S.settings.cap.on : id === 'temp' ? !S.settings.temp.on : false)) nx = fs.length;
          S.sysEdit = nx < fs.length ? nx : null;
        } else S.sysEdit = null;
        return;
      }
      if (btn === 'inc' || btn === 'dec') S.sysIdx = cyc(S.sysIdx, sysList().length, btn === 'inc' ? 1 : -1);
      else if (btn === 'stop') S.kind = 'prog';
      else if (btn === 'enter') {
        if (id === 'factory') { S.settings = defSettings(); S.msg = 'Đã khôi phục cài đặt gốc (Safety Timer 120 phút, Capacity Cut-Off 5000 mAh...).'; }
        else if (fs.length) S.sysEdit = 0;
      }
    }

    // ---------------- đo ----------------
    function meterScreen() {
      const o = S.pack.soc.map(sim.engine.ocv), n = S.pack.n;
      if (S.kind === 'meter') {
        if (S.sub === 0) {
          const v = (i) => (i < n ? o[i] : 0);
          const row = (a) => [T(f2(v(a), 4, 2), 'cell'), T(' '), T(f2(v(a + 1), 4, 2), 'cell'), T(' '), T(f2(v(a + 2), 4, 2), 'cell'), T(' V')];
          return { key: 'meter-cells', rows: [row(0), row(3)] };
        }
        return { key: 'meter-main', rows: [[T('MAIN '), T(f2(sum(o), 5, 2) + 'V', 'main')], [T('H' + Math.max(...o).toFixed(3) + 'V', 'hi'), T(' '), T('L' + Math.min(...o).toFixed(3) + 'V', 'lo')]] };
      }
      const ir = S.pack.ir.map((x) => Math.round(x * 1000));
      if (S.sub === 0) {
        const g = (i) => String(i < n ? ir[i] : 0).padStart(3, '0');
        return { key: 'ir-cells', rows: [[T(g(0), 'ir'), T(' '), T(g(1), 'ir'), T(' '), T(g(2), 'ir'), T('   mΩ')], [T(g(3), 'ir'), T('           mΩ')]] };
      }
      return { key: 'ir-total', rows: [[T(`TOTAL:${sum(ir)}mΩ`, 'total')], [T(`H:${Math.max(...ir)}mΩ`, 'hi'), T(' '), T(`L:${Math.min(...ir)}mΩ`, 'lo')]] };
    }

    // ---------------- khởi động, kiểm tra ----------------
    function fail(id) { S.kind = 'check'; S.phase = 'error'; S.err = id; S.pack.vp = 0; beep(880, 300, true); render(); }
    function startCheck() {
      const prog = curProg();
      if (prog.kind !== 'li') { S.msg = 'Máy ảo chỉ mô phỏng sạc/xả cho pin Li (LiPo, LiFe, LiIo, LiHV). NiMH, NiCd, Pb vẫn đi menu và chỉnh được.'; return; }
      S.kind = 'check'; S.phase = 'wait'; S.err = null;
      const t = ++tok;
      setTimeout(() => {
        if (t !== tok || S.kind !== 'check' || S.phase !== 'wait') return;
        if (!powered) return;
        if (!S.wiring.main) return fail('conn');
        if (S.wiring.reverse) return fail('reverse');
        const o = S.pack.soc.map(sim.engine.ocv);
        if (Math.min(...o) < 2.5) return fail('celllow');
        const mode = curMode(), chem = CH[prog.chem], tvc = S.tvc || chem.full;
        if (mode.id === 'bal' && Math.max(...o) >= tvc - 0.004) return fail('full');
        const bk = balSock();
        if (bk == null) S.phase = 'nobal';
        else if (bk >= 5) return fail('balconn');
        else S.phase = cellCheck();
        beep(1200, 80);
        render();
      }, 1200);
    }
    function cellCheck() {
      const prog = curProg(), mode = curMode();
      return rCount() === getV(prog, mode, fieldsOf(prog, mode)[1]) ? 'confirm' : 'mismatch';
    }
    function checkScreen() {
      const prog = curProg(), mode = curMode(), setN = getV(prog, mode, fieldsOf(prog, mode)[1]);
      if (S.phase === 'wait') return { key: 'check-wait', rows: [[T('BATTERY CHECK')], [T('WAIT...', 'v')]] };
      if (S.phase === 'confirm' || S.phase === 'mismatch') {
        const ok = S.phase === 'confirm';
        return { key: ok ? 'check-ok' : 'check-bad', rows: [[T(`R:${rCount()}SER`, 'r'), T(' '), T(`S:${setN}SER`, 's')], [T(ok ? 'CONFIRM(ENTER)' : 'CANCEL(STOP)', 'ok')]] };
      }
      const e = M.errScreens.find((x) => x.id === (S.phase === 'nobal' ? 'nobal' : S.err));
      return { key: 'err-' + e.id, rows: [[T(e.l1, 'msg')], [T(e.l2, 'msg')]] };
    }
    function checkKey(btn) {
      if (btn === 'stop') { tok++; S.kind = 'mode'; S.phase = null; return; }
      if (btn !== 'enter') return;
      if (S.phase === 'nobal') { S.phase = cellCheck(); return; }
      if (S.phase === 'confirm') startRun();
    }
    function startRun() {
      const prog = curProg(), mode = curMode(), chem = CH[prog.chem], fs = fieldsOf(prog, mode);
      S.run = newRun({ mode: mode.id, chem, Iset: getV(prog, mode, fs[0]), tvc: S.tvc || chem.full, cut: S.cut || chem.cutDef, cableOK: balSock() === 4 }, S.pack);
      S.runView = 0; S.kind = 'run'; S.phase = null; lastT = performance.now();
      beep(1500, 120);
    }

    // ---------------- đang chạy ----------------
    function runScreen() {
      const r = S.run, v = S.runView, st = S.settings, n = r.n;
      const code = r.chem.code + n + 's', unitF = st.unit === 'F';
      const temp = (c) => (unitF ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C');
      switch (v) {
        case 0: {
          if (r.done) return { key: 'run-done', rows: [[T(r.result === 'full' ? 'FULL' : 'DONE', 'state'), T(' '), T(code, 'type'), T(' '), T(f2(r.V, 5, 2) + 'V', 'volt')], [T(mmss(r.t), 'time'), T(' '), T(String(Math.round(r.mah)).padStart(5, '0'), 'cap'), T(' mAh')]] };
          const mc = r.mode === 'bal' ? 'BAL' : M.liModes.find((x) => x.id === r.mode).short;
          return { key: 'run-main', rows: [[T(code, 'type'), T(' '), T(r.I.toFixed(1) + 'A', 'cur'), T(' '), T(f2(r.V, 5, 2) + 'V', 'volt')], [T(mc, 'mode'), T(' '), T(mmss(r.t), 'time'), T(' '), T(String(Math.round(r.mah)).padStart(5, '0'), 'cap')]] };
        }
        case 1: {
          const c = (i) => (r.cableOK && i < n ? r.cells[i] : 0);
          const row = (a) => [T(f2(c(a), 4, 2), 'cell'), T(' '), T(f2(c(a + 1), 4, 2), 'cell'), T(' '), T(f2(c(a + 2), 4, 2), 'cell'), T(' V')];
          return { key: 'run-cells', rows: [row(0), row(3)] };
        }
        case 2: {
          const soc = clamp(sum(S.pack.soc) / n, 0, 1);
          return { key: 'run-fuel', rows: [[T('Fuel= '), T(Math.round(soc * 100) + '%', 'fuel')], [T('Cell= '), T(f2(r.V / n, 4, 2) + 'V', 'avg')]] };
        }
        case -1: return { key: 'run-endv', rows: [[T('End Voltage')], LR([], [T(`${r.Vfinal.toFixed(1)}V(${n}S)`, 'v')])] };
        case -2: return { key: 'run-inv', rows: [[T('IN Power Voltage')], LR([], [T('12.56V', 'v')])] };
        case -3: return { key: 'run-temp', rows: [LR([T('Ext. Temp')], [T('----', 'ext')]), LR([T('Int. Temp')], [T(temp(r.Tint), 'int')])] };
        case -4: return { key: 'run-tcut', rows: [[T('Temp Cut-Off')], LR([], [T(st.temp.on ? temp(st.temp.c) : 'OFF', 'v')])] };
        case -5: return { key: 'run-stime', rows: [[T('Safety Time')], st.timer.on ? LR([T('ON', 'v')], [T(st.timer.min + 'min', 'min')]) : [T('OFF', 'v')]] };
        default: return { key: 'run-ccut', rows: [[T('Capacity Cut-Off')], st.cap.on ? LR([T('ON', 'v')], [T(st.cap.mah + 'mAh', 'mah')]) : [T('OFF', 'v')]] };
      }
    }
    function runKey(btn) {
      if (btn === 'stop') { S.kind = 'mode'; S.pack.vp = 0; return; }
      if (btn === 'inc') S.runView = S.runView >= 0 ? (S.runView + 1 > 2 ? 0 : S.runView + 1) : S.runView + 1;
      if (btn === 'dec') S.runView = S.runView <= 0 ? (S.runView - 1 < -6 ? 0 : S.runView - 1) : S.runView - 1;
    }
    function tick(now) {
      if (!el.isConnected) { clearInterval(timer); return; }
      const dtReal = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); lastT = now;
      if (!powered) return;
      if (bootUntil && now >= bootUntil) { bootUntil = 0; render(); }
      if (S.kind !== 'run' || S.run.done) sim.engine.rest(PACK, dtReal * speed);
      if (S.kind === 'run' && !S.run.done) {
        const st = S.settings;
        const lim = { timerS: st.timer.on ? st.timer.min * 60 : 0, capMah: st.cap.on ? st.cap.mah : 0 };
        const wasDone = S.run.done;
        const err = sim.engine.advance(S.run, S.pack, dtReal * speed, lim);
        if (err) { fail(err); return; }
        if (S.run.done && !wasDone) beep(1000, 500, true);
        render();
      }
    }
    const timer = setInterval(() => tick(performance.now()), 100);

    // ---------------- âm thanh ----------------
    let actx = null;
    function beep(freq, ms, buzzer) {
      if (buzzer ? !S.settings.bz : !S.settings.kb) return;
      emit('beep', { freq, ms, buzzer: !!buzzer });
      if (!sound) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = freq; g.gain.value = 0.04; o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + ms / 1000);
      } catch (err) { console.warn('[SAC.sim] khong phat duoc am thanh:', err); }
    }

    // ---------------- bàn phím máy ----------------
    function press(btn, mult) {
      if (!powered) return;
      S.msg = ''; S.keepOnBoot = false;
      beep(1800, 40);
      switch (S.kind) {
        case 'prog':
          if (btn === 'inc' || btn === 'dec') S.pi = cyc(S.pi, M.programs.length, btn === 'inc' ? 1 : -1);
          else if (btn === 'enter') {
            const p = curProg();
            S.edit = null; S.mi = 0; S.sub = 0; S.tvc = null; S.cut = null;
            if (p.kind === 'li' || p.kind === 'ni' || p.kind === 'pb') S.kind = 'mode';
            else if (p.kind === 'meter' || p.kind === 'ir') S.kind = p.kind;
            else if (p.kind === 'sys') { S.kind = 'sys'; S.sysIdx = 0; S.sysEdit = null; }
            else { S.kind = 'mem'; S.mem.phase = 'slot'; }
          }
          break;
        case 'mode': {
          const prog = curProg(), mode = curMode(), fs = fieldsOf(prog, mode);
          if (S.edit != null) {
            if (btn === 'inc' || btn === 'dec') adjustField(prog, mode, fs[S.edit], btn === 'inc' ? 1 : -1, mult);
            else if (btn === 'enter') S.edit = S.edit + 1 < fs.length ? S.edit + 1 : null;
            else S.edit = null;
          } else if (btn === 'inc' || btn === 'dec') S.mi = cyc(S.mi, prog.modes.length, btn === 'inc' ? 1 : -1);
          else if (btn === 'enter') S.edit = 0;
          else S.kind = 'prog';
          break;
        }
        case 'mem': memKey(btn, mult); break;
        case 'sys': sysKey(btn, mult); break;
        case 'meter': case 'ir':
          if (btn === 'inc' || btn === 'dec') S.sub = 1 - S.sub; else if (btn === 'stop') S.kind = 'prog';
          break;
        case 'check': checkKey(btn); break;
        case 'run': runKey(btn); break;
        default: break;
      }
      render();
    }
    function holdable() {
      return (S.kind === 'mode' && S.edit == null) || memHoldable();
    }
    function holdAction() {
      S.msg = '';
      if (S.kind === 'mode' && S.edit == null) startCheck();
      else if (memHoldable()) memLoad();
      render();
    }

    // ---------------- màn hình hiện tại ----------------
    function screen() {
      if (!powered) return { key: 'off', rows: [[], []], off: true };
      if (performance.now() < bootUntil) return { key: 'boot', rows: [[T('iMAX B6AC V2')], [T('HW:1.00', 'hw'), T(' '), T('FW: 1.10', 'fw')]] };
      switch (S.kind) {
        case 'prog': return { key: 'prog', rows: [[T('BATT/PROGRAM', 'title')], LR([], [T(curProg().lcd, 'prog')])] };
        case 'mode': return modeScreen();
        case 'mem': return memScreen();
        case 'sys': return sysScreen();
        case 'meter': case 'ir': return meterScreen();
        case 'check': return checkScreen();
        default: return runScreen();
      }
    }

    // =================================================================================
    // 6. Dựng giao diện
    // =================================================================================
    const { lcd, cells } = buildLcd();
    const msgEl = h('div', { class: 'sim-msg', 'aria-live': 'polite' });
    const btnEls = {};
    const ringC = {};
    const btns = h('div', { class: 'sim-btns' }, M.buttons.map((b) => {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ring.setAttribute('viewBox', '0 0 64 64');
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', '30');
      ring.appendChild(c); ringC[b.id] = c;
      const btn = h('button', { class: 'sim-btn', type: 'button', 'aria-label': b.label + ' ' + b.sub + ' (phím ' + b.key + ')', title: b.desc + ' Phím tắt: ' + b.key }, b.key, ring);
      btnEls[b.id] = btn;
      return h('div', { class: 'sim-bw' }, btn);
    }));
    const dev = h('div', { class: 'sim-dev' },
      h('div', { class: 'sim-top' }, h('b', null, 'iMAX B6AC V2'), h('small', null, 'AC/DC Dual Power · SKYRC')),
      h('div', { class: 'sim-bezel' }, lcd), msgEl,
      // chú thích in trên máy: dòng trên BATT/PROG, DEC., INC., ENTER; dòng dưới Stop, ◄ Status ►, Start (◄ trên nút DEC, ► trên nút INC)
      h('div', { class: 'sim-leg' },
        ['BATT/PROG', 'DEC.', 'INC.', 'ENTER'].map((t) => h('b', null, t)),
        h('span', null, 'Stop'), h('span', { class: 'sim-leg2' }, h('i', null, '◄'), h('em', null, 'Status'), h('i', null, '►')), h('span', null, 'Start')),
      btns);

    // thanh điều khiển
    const SPEEDS = [0, 1, 10, 60, 600];
    const setSpeed = (s) => { speed = s; speedChips.forEach((c, i) => c.classList.toggle('on', SPEEDS[i] === s)); emit('speed', s); };
    const speedChips = SPEEDS.map((s) => h('button', { class: 'chip' + (s === speed ? ' on' : ''), type: 'button', onclick: () => setSpeed(s) }, s ? s + '×' : 'Tạm dừng'));
    const soundCb = h('input', { type: 'checkbox', onchange: (e) => { setSound(e.target.checked); beep(1500, 80, true); } });
    function setSound(v) { sound = !!v; soundCb.checked = sound; emit('sound', sound); }
    const stateSel = h('select', { class: 'input', 'aria-label': 'Trạng thái pin ban đầu', onchange: (e) => { packState = e.target.value; irKind = 'good'; tok++; PACK = makePackNow(); S.pack = PACK; S.run = null; if (S.kind === 'run' || S.kind === 'check') { S.kind = 'mode'; S.phase = null; } render(); } },
      Object.entries(PACK_STATES).map(([k, v]) => h('option', { value: k }, v.label)));
    const bar = h('div', { class: 'sim-bar' },
      h('span', null, 'Tốc độ mô phỏng'), h('span', { class: 'chips' }, speedChips),
      h('label', null, soundCb, 'Tiếng bíp'),
      h('button', { class: 'chip', type: 'button', onclick: () => { scenId = null; reset(null); updateScenUi(); } }, 'Đặt lại máy'));

    // tình huống
    const scenDesc = h('div', { class: 'sim-scn-d' });
    const scenChips = SCEN.map((s) => h('button', { class: 'chip', type: 'button', onclick: () => { pickScen(s.id); } }, s.t));
    function pickScen(id) {
      const s = SCEN.find((x) => x.id === id);
      scenId = id; packState = s.st; irKind = s.pack === 'weak' ? 'weak' : 'good'; stateSel.value = packState;
      PACK = makePackNow();
      reset(s); updateScenUi(); emit('scenario', s);
      root.focus({ preventScroll: true });
    }
    function updateScenUi() {
      scenChips.forEach((c, i) => c.classList.toggle('on', SCEN[i].id === scenId));
      const s = SCEN.find((x) => x.id === scenId);
      scenDesc.replaceChildren();
      if (!s) { scenDesc.appendChild(h('p', null, 'Máy vừa bật. Bấm các nút trên máy ảo, hoặc chọn một tình huống để máy tự đặt sẵn.')); return; }
      scenDesc.append(h('p', null, s.d), h('ol', null, s.steps.map((t) => h('li', null, t))));
    }
    const packBox = h('div', { class: 'sim-pack' });
    const wireNote = h('p', { class: 'sim-hint' });
    const scenCard = h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Chọn tình huống'),
      h('div', { class: 'sim-scn' }, scenChips),
      scenDesc);
    const packCard = h('div', { class: 'card' },
      h('div', { class: 'card-title' }, 'Pin thật bên dưới'),
      h('label', { class: 'sim-bar', style: 'margin:0' }, 'Trạng thái ban đầu', stateSel),
      packBox, wireNote);

    // giải thích
    const exBox = h('div', { class: 'card sim-ex' });
    let exKey = null, exLis = new Map(), exExtraEl = null, exExtraSig = '';
    function setHL(k) {
      markCells(cells, k);
      exLis.forEach((li, key) => li.classList.toggle('hl', !!k && key === k));
    }
    lcd.addEventListener('mouseover', (e) => { const f = e.target.dataset && e.target.dataset.f; if (f) setHL(f); });
    lcd.addEventListener('mouseleave', () => setHL(null));

    function buildEx(scr) {
      const def = LF[scr.key];
      exBox.replaceChildren(); exLis = new Map();
      if (!def) { console.error('[SAC.sim] thieu LCD_FIELDS cho man hinh:', scr.key); return; }
      exExtraEl = h('div', { class: 'sim-extra' });
      const ul = h('ul', { class: 'sim-fl' });
      for (const f of def.fields) {
        if (exLis.has(f.k)) continue;
        const li = h('li', { 'data-f': f.k }, h('span', { class: 'sim-v', 'data-live': f.k }, f.text),
          h('div', null, h('b', null, f.name, f.inferred ? [' ', h('span', { class: 'sim-inf' }, 'suy luận')] : null), f.meaning));
        li.addEventListener('mouseenter', () => setHL(f.k)); li.addEventListener('mouseleave', () => setHL(null));
        exLis.set(f.k, li); ul.appendChild(li);
      }
      exBox.append(h('span', { class: 'kicker' }, def.group),
        h('h3', null, def.title, def.inferred ? [' ', h('span', { class: 'sim-inf' }, 'màn suy luận')] : null),
        h('p', null, SAC.rich(def.summary)), exExtraEl, ul,
        def.hint ? h('p', { class: 'sim-hint' }, SAC.rich(def.hint)) : null,
        def.page ? h('p', { class: 'sim-hint' }, 'Sách tr.' + def.page) : null);
      exKey = scr.key; exExtraSig = '';
    }
    function updateEx(scr) {
      if (scr.key !== exKey) buildEx(scr);
      // giá trị sống trong từng trường
      const live = new Map();
      for (const row of scr.rows) for (const [text, f] of row) if (f) live.set(f, (live.get(f) || '') + (live.has(f) ? ' ' : '') + text.trim());
      for (const sp of exBox.querySelectorAll('[data-live]')) { const t = live.get(sp.dataset.live); if (t != null && sp.textContent !== t) sp.textContent = t; }
      // lời nhắc theo ngữ cảnh
      const ex = extras(scr);
      const sig = JSON.stringify(ex);
      if (sig !== exExtraSig && exExtraEl) {
        exExtraSig = sig; exExtraEl.replaceChildren(...ex.map(([cls, txt]) => h('p', { class: cls }, SAC.rich(txt))));
      }
    }
    function extras(scr) {
      const out = [];
      const prog = curProg();
      if (S.kind === 'mode' && prog.kind === 'li') {
        out.push(['note', '**' + curMode().name + ':** ' + curMode().desc]);
        if (['chg', 'fast'].includes(curMode().id)) out.push(['warn', 'Pin drone nên sạc bằng BALANCE CHG, không dùng ' + curMode().lcd + '.']);
        if (prog.chem !== 'lipo') out.push(['danger', 'Pin của bạn là LiPo. Chọn ' + CH[prog.chem].name + ' trên máy thật là SAI loại pin: máy sạc theo mức điện áp của loại đã chọn.']);
        if (S.tvc) out.push(['warn', 'Hồ sơ nạp từ bộ nhớ đang đặt TVC ' + S.tvc.toFixed(2) + ' V/cell.']);
      }
      if (S.kind === 'mode' && prog.kind !== 'li') out.push(['note', '**' + curMode().name + ':** ' + curMode().desc + ' Máy ảo không mô phỏng chạy chương trình này, chỉ đi menu và chỉnh số.']);
      if (S.kind === 'check') {
        if (S.phase === 'confirm') out.push(['tip', 'R và S khớp nhau. Bấm ENTER để chạy.'], ['note', WIRE_HINT]);
        if (S.phase === 'mismatch') out.push(['danger', 'R khác S: số cell bạn đặt không khớp pin. Bấm STOP, đặt lại, rồi thử lại. Máy sẽ không cho chạy.']);
        if (S.phase === 'nobal') out.push(['warn', 'Chưa cắm giắc cân bằng. Cắm lại là cách đúng. Chỉ bấm ENTER chạy tiếp nếu pin vốn không có dây cân bằng; ở chế độ BALANCE CHG, chạy tiếp nghĩa là KHÔNG cân bằng.'], ['note', WIRE_HINT]);
        if (S.phase === 'error' && S.err === 'reverse') out.push(['danger', 'Dừng ngay, rút pin, kiểm tra cực. Dây đỏ vào +, dây đen vào −. XT60 chỉ cắm được một chiều nếu không bị lắp sai chân.']);
        if (S.phase === 'error' && S.err === 'conn') out.push(['danger', 'Máy không thấy pin ở cổng OUTPUT. Kiểm tra cả chuỗi: bắp chuối → dây #3 → T-plug → dây #8 → XT60 của pin. Mã lỗi này ghi "cắm pin sai" trong sách.']);
        if (S.phase === 'error' && S.err === 'break') out.push(['danger', 'Mạch pin đứt giữa chừng (rút XT60, bắp chuối hoặc T-plug khi đang chạy). Máy dừng ngay. Cắm lại rồi bắt đầu lại.']);
        if (S.phase === 'error' && S.err === 'balconn') out.push(['danger', 'Giắc cân bằng không khớp ổ đang cắm (hoặc bị rút khi đang cân bằng). Với pin 4S, giắc 5 chân phải vào ổ "4 cell". Mã lỗi khi cắm vào ổ 5/6 cell là suy luận từ sách.']);
        if (S.phase === 'error' && S.err === 'overtime') out.push(['warn', 'Safety Timer mặc định 120 phút ngắt pin trước khi đầy. Chương Cài đặt khuyên 180 phút.']);
        if (S.phase === 'error' && S.err === 'overcap') out.push(['warn', 'Capacity Cut-Off mặc định 5000 mAh thấp hơn pin 5300 mAh. Chương Cài đặt khuyên 6000 mAh.']);
      }
      if (S.kind === 'run') {
        const r = S.run;
        out.push(['note', `Pha **${r.phase === 'CC' ? 'CC (dòng không đổi)' : r.phase === 'CV' ? 'CV (áp không đổi, dòng giảm dần)' : 'xả'}**, công suất ${r.P.toFixed(1)} W${r.dir === 'chg' ? ' (giới hạn 50 W)' : ' (giới hạn 5 W)'}.`]);
        if (r.dir === 'dis' && !r.done) {
          const soc = sum(S.pack.soc) / r.n, tgt = sim.engine.socOf(r.Vfinal / r.n);
          const mah = Math.max(0, (soc - tgt) * S.pack.Q), hrs = r.I > 0 ? mah / (r.I * 1000) : 0;
          out.push(['warn', `Xả bị chặn ${r.I.toFixed(2)} A vì chỉ được 5 W. Còn khoảng ${mah.toFixed(0)} mAh, tức khoảng ${hrs.toFixed(1)} giờ.`]);
        }
        if (Math.max(...r.cells) > 4.25) out.push(['danger', 'Có cell vượt 4,25 V. Đây là cách làm pin phồng và cháy. Dừng ngay (STOP).']);
        if (!r.cableOK) out.push(['warn', 'Không có dây cân bằng: máy không thấy từng cell (0.00) và không cân bằng. Xem khung "Pin thật" để biết cell thực tế.']);
        if (r.mode === 'chg' && r.cableOK) out.push(['note', 'CHARGE không cân bằng: các cell lệch nhau sẽ không được kéo về.']);
        if (r.done) out.push(['tip', (r.result === 'full' ? 'Sạc xong. ' : 'Xong. ') + 'Máy kêu bíp. Rút dây cân bằng trước hoặc dây chính trước đều được, nhưng nhớ rút khỏi pin rồi mới rút khỏi máy.']);
      }
      if (S.kind === 'meter' || S.kind === 'ir') out.push(['note', 'Cần cắm cả dây chính lẫn dây cân bằng. ' + WIRE_HINT]);
      if (S.msg) out.unshift(['warn', S.msg]);
      return out;
    }

    // pin thật
    function updatePack() {
      const o = S.pack.soc.map(sim.engine.ocv), sp = Math.max(...o) - Math.min(...o);
      packBox.replaceChildren(...o.map((v, i) => h('div', { class: 'sim-pc', title: 'Nội trở ' + Math.round(S.pack.ir[i] * 1000) + ' mΩ' },
        h('span', null, 'Cell ' + (i + 1)), h('div', { class: 'sim-pb' }, h('i', { style: 'width:' + clamp(((v - 3.0) / 1.3) * 100, 2, 100) + '%' })), h('b', null, v.toFixed(3) + ' V'))),
        h('div', { class: 'sim-spread ' + (sp < 0.05 ? 'ok' : sp < 0.1 ? 'mid' : 'bad') }, `Lệch cell cao nhất và thấp nhất: ${(sp * 1000).toFixed(0)} mV ` + (sp < 0.05 ? '(bình thường)' : sp < 0.1 ? '(theo dõi)' : '(lệch nhiều)')));
      const w = S.wiring;
      wireNote.textContent = `Dây cân bằng: ${w.balance ? 'đã cắm' : 'CHƯA cắm'}. Cực dây chính: ${w.reverse ? 'NGƯỢC' : 'đúng'}. Điện áp là điện áp nghỉ của từng cell.`;
    }

    // đồ thị
    const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chartSvg.setAttribute('viewBox', '0 0 640 230');
    chartSvg.setAttribute('role', 'img');
    chartSvg.setAttribute('aria-label', 'Đồ thị điện áp pin và dòng theo thời gian');
    const chartCard = h('div', { class: 'card sim-chart' }, h('div', { class: 'card-title' }, 'Điện áp và dòng theo thời gian'),
      h('div', { class: 'lg' }, h('span', null, h('i', { style: 'background:var(--accent)' }), 'Điện áp pin (V)'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'Dòng (A)')), chartSvg);
    function drawChart() {
      const r = S.run, n = S.pack.n;
      const W = 640, Hh = 230, L = 44, Rr = 36, Tp = 10, B = 26, pw = W - L - Rr, ph = Hh - Tp - B;
      const hist = r ? r.hist : [];
      const tmax = Math.max(600, hist.length ? hist[hist.length - 1][0] * 1.04 : 0);
      const vmin = n * 3.0, vmax = n * 4.3;
      const imax = Math.max(3.2, r ? r.Iset * 1.1 : 3.2);
      const x = (t) => L + (t / tmax) * pw, yv = (v) => Tp + ph - ((v - vmin) / (vmax - vmin)) * ph, yi = (i) => Tp + ph - (i / imax) * ph;
      let g = '';
      for (let i = 0; i <= 4; i++) {
        const yy = Tp + (ph * i) / 4;
        g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>`;
        g += `<text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${(vmax - ((vmax - vmin) * i) / 4).toFixed(1)}</text>`;
        g += `<text x="${W - Rr + 6}" y="${yy + 4}" font-size="11" fill="var(--ink-3)">${(imax - (imax * i) / 4).toFixed(1)}</text>`;
      }
      const stepMin = [5, 10, 15, 30, 60, 120, 240].find((m) => (tmax / 60) / m <= 6) || 240;
      for (let m = 0; m * 60 <= tmax; m += stepMin) {
        g += `<text x="${x(m * 60)}" y="${Hh - 8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${m < 60 ? m + ' ph' : (m / 60).toFixed(m % 60 ? 1 : 0) + ' h'}</text>`;
      }
      const stride = Math.max(1, Math.ceil(hist.length / 500));
      const pts = (fn) => hist.filter((_, i) => i % stride === 0 || i === hist.length - 1).map((p) => `${x(p[0]).toFixed(1)},${fn(p).toFixed(1)}`).join(' ');
      if (hist.length > 1) {
        g += `<polyline fill="none" stroke="var(--accent)" stroke-width="2.2" points="${pts((p) => yv(p[1]))}"/>`;
        g += `<polyline fill="none" stroke="var(--warn)" stroke-width="2.2" points="${pts((p) => yi(p[2]))}"/>`;
      } else g += `<text x="${W / 2}" y="${Hh / 2}" text-anchor="middle" font-size="13" fill="var(--ink-3)">Chạy một lần sạc để vẽ đồ thị</text>`;
      chartSvg.innerHTML = g;
    }

    // vẽ lại toàn bộ
    function render() {
      const scr = screen();
      paintCells(cells, scr.rows);
      lcd.classList.toggle('off', !!scr.off);
      updateEx(scr);
      updatePack();
      msgEl.textContent = S.msg || '';
      if (++tickN % 3 === 0 || S.kind !== 'run') drawChart();
      emit('render');
    }

    // ---------------- sự kiện nút ----------------
    function setRing(id, p) {
      emit('hold', { id, p });
      const c = ringC[id];
      c.style.opacity = p > 0 ? '1' : '0';
      c.style.strokeDashoffset = String(188.5 * (1 - clamp(p, 0, 1)));
    }
    function enterDown() {
      if (P.enter || !powered) return;
      const hold = holdable();
      P.enter = { t0: performance.now(), fired: false, hold };
      btnEls.enter.classList.add('down');
      if (hold) {
        const loop = () => {
          const e = P.enter; if (!e || e.fired) return;
          const p = (performance.now() - e.t0) / HOLD_MS;
          setRing('enter', p);
          if (p >= 1) { e.fired = true; setRing('enter', 0); holdAction(); return; }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    }
    function enterUp() {
      const e = P.enter; if (!e) return;
      P.enter = null; btnEls.enter.classList.remove('down'); setRing('enter', 0);
      if (e.fired) return;
      press('enter', 1);
      if (e.hold && performance.now() - e.t0 > 400) { S.msg = 'Giữ ENTER đủ 3 giây mới bắt đầu. Bấm nhanh chỉ để sửa giá trị.'; render(); }
    }
    function repeatStart(id) {
      press(id, 1);
      const t0 = performance.now();
      P.rep = setTimeout(() => {
        P.rep = setInterval(() => press(id, performance.now() - t0 > 1800 ? 10 : 1), 90);
      }, 450);
    }
    function repeatStop() { clearTimeout(P.rep); clearInterval(P.rep); P.rep = null; }
    for (const id of Object.keys(btnEls)) {
      const b = btnEls[id];
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); root.focus({ preventScroll: true });
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* trình duyệt cũ: bỏ qua capture */ }
        b.classList.add('down');
        if (id === 'enter') enterDown(); else if (id === 'stop') press('stop', 1); else repeatStart(id);
      });
      const up = () => { b.classList.remove('down'); if (id === 'enter') enterUp(); else repeatStop(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('click', (e) => e.preventDefault());
    }
    const KEYMAP = { Escape: 'stop', ArrowLeft: 'dec', ArrowRight: 'inc', Enter: 'enter' };
    const root = h('div', { class: 'sim-root', tabindex: '0', role: 'application', 'aria-label': 'Máy sạc iMAX B6AC V2 ảo' },
      h('div', { class: 'sim' },
        h('div', { class: 'sim-col' }, h('div', { class: 'card', style: 'padding:18px' }, dev, bar)),
        h('div', { class: 'sim-col' }, scenCard, exBox, packCard)),
      chartCard);
    const active = () => root.contains(document.activeElement) || root.matches(':hover');
    document.addEventListener('keydown', (e) => {
      const id = KEYMAP[e.key];
      if (!id || !active() || !root.isConnected) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || ''))) return;
      if (e.target.closest && e.target.closest('button.chip')) { if (id === 'enter') return; }
      e.preventDefault();
      if (e.repeat && id === 'enter') return;
      b_(id, true);
    });
    document.addEventListener('keyup', (e) => { const id = KEYMAP[e.key]; if (id === 'enter' && P.enter) { e.preventDefault(); b_('enter', false); } if ((id === 'inc' || id === 'dec') && P.rep) repeatStop(); });
    function b_(id, down) {
      btnEls[id].classList.toggle('down', down);
      if (id === 'enter') { if (down) enterDown(); else enterUp(); }
      else if (down) { if (id === 'stop') press('stop', 1); else if (!P.rep) repeatStart(id); }
    }
    window.addEventListener('blur', () => { repeatStop(); P.enter = null; setRing('enter', 0); });

    el.appendChild(root);
    reset(null);
    updateScenUi();
    // ---------------- cổng cho bàn thực hành 3D ----------------
    function setWiring(w) {
      external = true;
      const was = powered;
      ext = Object.assign({}, ext, w);
      powered = !!ext.power;
      if (S) S.wiring = wiringNow();
      if (powered && !was) { bootUntil = performance.now() + 1600; lastT = performance.now(); beep(1300, 120, true); }
      if (!powered && was) {
        tok++; bootUntil = 0; repeatStop(); P.enter = null; setRing('enter', 0);
        const keep = S.settings, mem = S.mem;
        if (S.keepOnBoot) { if (S.kind === 'run' || S.kind === 'check') { S.kind = 'mode'; S.phase = null; } S.run = null; }
        else { S = fresh(); S.settings = keep; S.mem = mem; }
      }
      if (powered && S.kind === 'run' && !S.run.done) {
        if (!ext.main) fail('break');
        else if (S.run.balancing && balSock() !== 4) fail('balconn');
      }
      render();
    }
    function screenChars() {
      const scr = screen();
      return { key: scr.key, off: !!scr.off, rows: [charsOf(scr.rows[0] || []), charsOf(scr.rows[1] || [])] };
    }
    function btnApi(id, down) {
      if (!powered || !btnEls[id]) return;
      btnEls[id].classList.toggle('down', down);
      if (id === 'enter') { if (down) enterDown(); else enterUp(); }
      else if (id === 'stop') { if (down) press('stop', 1); }
      else if (down) repeatStart(id); else repeatStop();
    }
    function snapshot() {
      const r = S.run, p = PACK;
      const soc = p.soc.map(sim.engine.ocv);
      const live = S.kind === 'run' && r;
      return { powered, booting: performance.now() < bootUntil, kind: S.kind, phase: S.phase, err: S.err, speed, sound,
        run: r ? { t: r.t, mah: r.mah, I: r.I, V: r.V, P: r.P, phase: r.phase, dir: r.dir, done: r.done, result: r.result, mode: r.mode, n: r.n, Tint: r.Tint, Iset: r.Iset, live: !!live && !r.done, cells: r.cells.slice(), spread: r.spread || 0 } : null,
        cells: (live && !r.done ? r.cells : soc).slice(), pack: { temp: p.temp, n: p.n, ir: p.ir.slice(), soc: p.soc.slice() }, packState };
    }
    return { reset, pickScen, press, state: () => S, el: root, on, setWiring, screenChars, btn: btnApi, snapshot,
      setSpeed, getSpeed: () => speed, setSound, getSound: () => sound, SPEEDS, scenarios: SCEN,
      packStates: Object.entries(PACK_STATES).map(([k, v]) => ({ id: k, label: v.label })),
      setPackState(k) { stateSel.value = k; packState = k; irKind = 'good'; tok++; PACK = makePackNow(); S.pack = PACK; S.run = null; if (S.kind === 'run' || S.kind === 'check') { S.kind = 'mode'; S.phase = null; } render(); emit('pack', k); },
      get packStateId() { return packState; },
      isPowered: () => powered };
  };
})();
