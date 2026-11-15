/* Bàn thực hành 3D: SAC.bench.mount(el, {sim}) — cục sạc, pin và mọi dây rời trên mặt bàn. Kéo thả giắc vào ổ như thật.
   - Dây là sợi dây vật lý (PBD, bench-rope.js): kéo pin thì dây kéo theo, kéo mạnh thì mắt xích yếu nhất bật ra.
   - Điện, cực, ổ cân bằng suy ra từ chỗ cắm thật rồi đẩy vào ĐÚNG máy trạng thái của sim.js (SAC.sim.mount) — cùng một bộ máy với mặt máy 2D.
   - LCD 3D là CanvasTexture vẽ từ sim.screenChars(); 4 nút trên máy 3D bấm được (giữ ENTER 3 giây có vòng tiến độ).
   Hệ toạ độ như scene3d.js: x phải, y lên, z về phía người xem, mm. Máy sạc đặt ở gốc, không dịch chuyển. */
import { scrollBusy, scrollWait, stagedCompile, isNear, gpuIdle, GL, glReady, glPresent, nextFrame, enqueueBuild, whenNear, makePlaceholder, mark, T, Ctx, buildCharger, loadModels, xtModel, isDark } from './scene3d.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeBody, Rope, World } from './bench-rope.js';
import * as PT from './bench-parts.js';
import { ensureBenchStyle, cellColor, drawBenchChart } from './bench-ui.js';

const SAC = (window.SAC = window.SAC || {});
const PI = Math.PI, TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const angLerp = (a, b, t) => a + ((((b - a + PI) % TAU) + TAU) % TAU - PI) * t;
const mmss = (t) => String(Math.floor(t / 3600)).padStart(2, '0') + ':' + String(Math.floor((t % 3600) / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');

// Lực giữ của từng loại giắc (đơn vị: mm dây bị dãn quá chiều dài trước khi giắc bật ra). Nhỏ = dễ bật ra. Thứ tự thực tế: dây cân bằng bật trước, XT60 bật sau cùng.
const HOLD = { xh: 2.5, ban: 4.5, clip: 4.5, dc: 5.5, c5: 7, 'deans-m': 8, 'xt60-m': 12 };
const FITS = { ban: ['ban'], 'deans-m': ['deans-f'], 'xt60-m': ['xt60-f'], xh: ['xh'], c5: ['iec'], dc: ['dcjack'], clip: ['post'] };
const NAMES = { banR: 'bắp chuối đỏ', banK: 'bắp chuối đen', t3: 'T-plug dây #3', t8: 'T-plug dây #8', f8: 'XT60 dây #8', xt60m: 'XT60 của pin', xh: 'giắc cân bằng', c5: 'dây nguồn AC', dcp: 'giắc DC', clipR: 'kẹp đỏ', clipK: 'kẹp đen', pack: 'pin' };
const BTN_SIM = { 'btn-batt': 'stop', 'btn-dec': 'dec', 'btn-inc': 'inc', 'btn-enter': 'enter' };
const BAL_CELLS = { 'bal-2s': 2, 'bal-3s': 3, 'bal-4s': 4, 'bal-5s': 5, 'bal-6s': 6 };
const VIEWS = { all: ['Toàn cảnh', [0.25, 1.0, 0.95]], right: ['Cổng ra (phải)', [0.62, 0.78, 0.9]], left: ['Nguồn (trái)', [-0.7, 0.8, 0.75]], top: ['Từ trên', [0, 1, 0.001]] };
const NARROW = { right: [[-10, 0, -40], [340, 40, 200]], left: [[-300, 0, -190], [60, 60, 170]] };
const BOXES = { all: [[-420, 0, -215], [500, 70, 265]], right: [[-40, 0, -50], [360, 40, 235]], left: [[-400, 0, -190], [70, 60, 200]], top: [[-420, 0, -215], [500, 70, 265]] };

// SAC.bench.mount trả API ngay (mọi lời gọi xếp hàng), dựng bàn 3D khi khung tới gần khung nhìn.
const Q_METHODS = ['setView', 'resetLayout', 'autoWire', 'rotate', 'zoom', 'plug', 'unplug', 'dispose'];
function mount(el, opts = {}) {
  const sim = opts.sim;
  if (!sim || !sim.setWiring) throw new Error('[SAC.bench] can truyen {sim: SAC.sim.mount(...)}');
  const wrapEl = document.createElement('div');
  wrapEl.className = 'bench-ph';
  wrapEl.setAttribute('style', 'position:relative;height:clamp(400px,66vh,700px);border-radius:20px;overflow:hidden;border:1px solid var(--line)');
  wrapEl.appendChild(makePlaceholder('Đang tải bàn thực hành 3D…'));
  el.appendChild(wrapEl);
  let real = null, disposed = false, queue = [], resolveReady = null, cancel = () => {};
  const ready = new Promise((r) => { resolveReady = r; });
  const arm = () => {
    cancel = whenNear(wrapEl, () => {
      enqueueBuild(async () => {
        if (disposed) return;
        if (!isNear(wrapEl)) { arm(); return; }
        mark('bench:run');
        await glReady();
        if (disposed) return;
        wrapEl.remove();
        real = mountNow(el, opts);
        await real.built;
        queue.forEach(([m, a]) => real[m](...a)); queue = [];
        resolveReady(real);
      }).catch((err) => { console.error('[SAC.bench] dung that bai', err); wrapEl.textContent = 'Không dựng được bàn 3D: ' + (err && err.message); });
    });
  };
  arm();
  const api = { ready, isReady: () => !!(real && real.isReady()) };
  const call = (m) => (...a) => { if (real && real.isReady()) return real[m](...a); queue.push([m, a]); return null; };
  Q_METHODS.forEach((m) => { api[m] = call(m); });
  api.dispose = () => { disposed = true; cancel(); wrapEl.remove(); if (real) real.dispose(); };
  ['screenOf', 'state', 'circuit', 'log', 'perf', 'frames'].forEach((m) => { api[m] = (...a) => (real ? real[m](...a) : null); });
  SAC.benchApi = api;
  return api;
}

function mountNow(el, opts = {}) {
  const sim = opts.sim;
  if (!sim || !sim.setWiring) throw new Error('[SAC.bench] can truyen {sim: SAC.sim.mount(...)}');
  mark('bench:mount');
  ensureBenchStyle();
  const { h } = SAC;
  const K = SAC.dims, HW = K.W / 2, HD = K.D / 2;
  const narrow = () => el.clientWidth < 620;
  const mobile = innerWidth < 760 || matchMedia('(pointer:coarse)').matches;
  const ROPE_N = mobile ? 8 : 12;
  const st = { disposed: false, ready: false };

  // ============ DOM ============
  const stage = h('div', { class: 'bench-stage' });
  const loading = h('div', { class: 'bench-loading' }, 'Đang dựng bàn thực hành 3D…');
  const viewsEl = h('div', { class: 'bench-views' });
  const coarse = matchMedia('(pointer:coarse)').matches;
  const hint = h('div', { class: 'bench-hint' }, coarse ? 'Chạm giắc rồi chạm ổ đang sáng, hoặc kéo giắc vào ổ · chạm giắc đang cắm để rút · vuốt ở ngoài khung để cuộn trang' : 'Kéo giắc tới ổ đang sáng rồi đẩy vào · chạm giắc đang cắm để rút · R xoay · cuộn chuột khi đang kéo để nâng/hạ');
  const toast = h('div', { class: 'bench-toast', role: 'status', 'aria-live': 'polite' });
  const over = h('div', { class: 'bench-over' });
  const bell = h('div', { class: 'bench-bell', 'aria-hidden': 'true' }, '♪');
  const cellsEl = h('div', { class: 'bench-cells' });
  const cellBars = [0, 1, 2, 3].map((i) => { const b = h('b'); const wrap = h('div', { class: 'bench-cell' }, h('i', null, b), h('span', null, 'C' + (i + 1))); return { b, wrap, lab: wrap.lastChild }; });
  cellsEl.append(h('div', { class: 'row' }, cellBars.map((c) => c.wrap)), h('small'));
  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringSvg.setAttribute('viewBox', '0 0 60 60'); ringSvg.setAttribute('class', 'bench-ring');
  const ringC = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); ringC.setAttribute('cx', '30'); ringC.setAttribute('cy', '30'); ringC.setAttribute('r', '25'); ringSvg.appendChild(ringC);
  over.append(cellsEl, ringSvg);
  stage.append(loading, viewsEl, hint, toast, over, bell);

  const speedChips = sim.SPEEDS.map((s) => h('button', { class: 'chip', type: 'button', onclick: () => sim.setSpeed(s) }, s ? s + '×' : 'Tạm dừng'));
  const packSel = h('select', { class: 'input', 'aria-label': 'Trạng thái pin ban đầu', onchange: (e) => sim.setPackState(e.target.value) },
    sim.packStates.map((p) => h('option', { value: p.id }, p.label)));
  const soundCb = h('input', { type: 'checkbox', checked: true, onchange: (e) => sim.setSound(e.target.checked) });
  const rotBtn = h('button', { class: 'chip', type: 'button', onclick: () => rotateActive(PI / 4), title: 'Xoay giắc đang cầm hoặc đang chọn 45° (phím R)' }, '⟳ Xoay');
  const resetBtn = h('button', { class: 'chip', type: 'button', onclick: () => resetLayout(true) }, 'Dọn lại bàn');
  const scnChips = sim.scenarios.map((sc) => h('button', { class: 'chip', type: 'button', title: sc.d, onclick: () => sim.pickScen(sc.id) }, sc.t));
  const ctl = h('div', { class: 'bench-ctl' },
    h('span', null, 'Tình huống'), h('span', { class: 'chips' }, scnChips), h('br'),
    h('span', null, 'Tốc độ'), h('span', { class: 'chips' }, speedChips),
    h('label', null, 'Pin lúc đầu ', packSel), h('label', null, soundCb, ' Tiếng bíp'), rotBtn, resetBtn);
  const statEl = h('div', { class: 'bench-stat' });
  const explEl = h('p', { class: 'bench-expl' });
  const stepsEl = h('ol', { class: 'bench-steps' });
  const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); chartSvg.setAttribute('viewBox', '0 0 640 190'); chartSvg.setAttribute('role', 'img'); chartSvg.setAttribute('aria-label', 'Đồ thị điện áp, dòng và dung lượng khi sạc');
  const root = h('div', { class: 'bench-root', tabindex: '0', role: 'application', 'aria-label': 'Bàn thực hành sạc pin 3D' },
    stage, ctl,
    h('div', { class: 'bench-grid' },
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Trạng thái máy sạc'), statEl, explEl),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Làm lần lượt'), stepsEl)),
    h('div', { class: 'card bench-chart' }, h('div', { class: 'card-title' }, 'Điện áp, dòng, dung lượng theo thời gian'),
      h('div', { class: 'lg' }, h('span', null, h('i', { style: 'background:var(--accent)' }), 'Điện áp pin (V)'), h('span', null, h('i', { style: 'background:var(--warn)' }), 'Dòng (A)'), h('span', null, h('i', { style: 'background:var(--ok)' }), 'Dung lượng (0 đến 5300 mAh)')), chartSvg));
  el.appendChild(root);
  sim.setSound(true);

  // ============ three.js ============
  const canvas = document.createElement('canvas'), g2d = canvas.getContext('2d');   // canvas 2D nhận ảnh từ WebGL dùng chung (scene3d.js)
  let exposure = 1;
  canvas.style.touchAction = 'none'; stage.insertBefore(canvas, stage.firstChild);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 5, 6000);
  scene.environment = GL.env.texture;
  const key = new T.DirectionalLight(0xffffff, 2.3); key.position.set(230, 430, 330); key.castShadow = true;
  key.shadow.mapSize.set(mobile || GL.soft ? 1024 : 2048, mobile || GL.soft ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -520, right: 520, top: 430, bottom: -430, near: 50, far: 1200 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.6; key.shadow.radius = 4;
  key.target.position.set(40, 0, 20); scene.add(key, key.target);
  const fill = new T.DirectionalLight(0xbfd4ff, 0.5); fill.position.set(-260, 160, 100); scene.add(fill);
  const lcdLight = new T.PointLight(0xc6e05a, 0, 160, 1.6); lcdLight.position.set(-HW + 45, 38, HD - 51); scene.add(lcdLight);
  const applyTheme = () => {
    const d = isDark();
    exposure = d ? 0.85 : 1.0; scene.environmentIntensity = d ? 0.5 : 0.65; wake(150);
    scene.background = new T.Color(d ? 0x14171b : 0xe9e6df);
    if (tableMat) { tableTex = paintTable(d); tableMat.map = tableTex; tableMat.needsUpdate = true; }
  };
  window.addEventListener('sac-theme', applyTheme);
  const controls = new OrbitControls(camera, canvas);   // đăng ký SAU listener pointerdown của bench (xem dưới) để bench bắt trước
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enableZoom = false; controls.enablePan = true; controls.screenSpacePanning = false;
  controls.maxPolarAngle = 1.5; controls.rotateSpeed = 0.8; controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
  controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };

  // ============ trạng thái ============
  let sctx = null, pctx = null, charger = null, world = null, tableMat = null, tableTex = null;
  const bodies = {}, ropes = [], ropeVis = [], ports = [], pickMeshes = [], btnMeshes = [], disposables = { tex: [], geos: [] };
  let lcdCanvas = null, lcdTex = null, lcdKey = '', lcdG = null, btnGroups = {}, btnPress = {};
  let beads = null, markerPool = [], tagPool = [];
  let selected = null, activeBody = null, drag = null, pointer = { x: 0, y: 0, in: false }, lastWiring = '', lastCircuit = null;
  let autoToken = 0, tween = null, curView = 'all', userMoved = false, visible = true, raf = 0, lastNow = 0, acc = 0, frame = 0, size = { w: 0, h: 0 };
  // Vẽ theo yêu cầu: chỉ chạy vòng lặp khi có gì chuyển động, hoặc 20 khung/s khi đang sạc, hoặc 2 khung/s để nháy trường LCD. Rảnh thì 0 khung hình.
  const qual = { q: GL.soft ? 0.6 : 1 };
  let dbgWho = '', awakeUntil = 0, needRender = true, settle = 0, physActive = true, lastRender = 0, scrollT = 0, blinkT = 0, lcdBlink = false, panelsT = 0;
  const evlog = []; let cpuMs = 0;
  let flowPhase = 0, samples = [], sampleRunKey = null, toastT = 0, bellT = 0, ringP = 0, audio = null;
  const raycaster = new T.Raycaster(), ndc = new T.Vector2(), tmpV = new T.Vector3();

  // ============ tiện ích ============
  function say(text, kind) {
    toast.textContent = text; toast.className = 'bench-toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastT); toastT = setTimeout(() => { toast.classList.remove('on'); }, kind === 'bad' ? 6500 : 4500);
  }
  function sfx(kind) {
    if (!sim.getSound()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime, seq = kind === 'pop' ? [[260, 0, 0.09, 'sawtooth']] : kind === 'thunk' ? [[160, 0, 0.05, 'sine']] : [[1500, 0, 0.012, 'square'], [620, 0.018, 0.03, 'triangle']];
      seq.forEach(([f, d, l, w]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = w; o.frequency.value = f; g.gain.setValueAtTime(0.05, t0 + d); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d + l); o.connect(g); g.connect(audio.destination); o.start(t0 + d); o.stop(t0 + d + l + 0.01); });
    } catch (err) { console.warn('[SAC.bench] khong phat duoc am thanh:', err); }
  }

  function paintTable(dark) {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = dark ? '#2b3036' : '#cfcbc1'; g.fillRect(0, 0, 1200, 800);
    const n = g.createLinearGradient(0, 0, 1200, 800); n.addColorStop(0, 'rgba(255,255,255,.05)'); n.addColorStop(1, 'rgba(0,0,0,.07)'); g.fillStyle = n; g.fillRect(0, 0, 1200, 800);
    g.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)'; g.lineWidth = 1;
    for (let x = 0; x <= 1200; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 800); g.stroke(); }
    for (let y = 0; y <= 800; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    g.strokeStyle = dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.2)';
    for (let x = 0; x <= 1200; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 800); g.stroke(); }
    for (let y = 0; y <= 800; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    if (tableTex) tableTex.dispose();
    return t;
  }

  // ============ dựng cảnh ============
  async function build(models) {
    mark('bench:build-start');
    sctx = new Ctx(models);
    pctx = { bm: PT.makeBenchMats(), geos: [], tex: [], xt: (c, n) => xtModel(sctx, n, sctx.m) };
    disposables.geos = pctx.geos; disposables.tex = pctx.tex;

    // bàn
    tableMat = new T.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    tableTex = paintTable(isDark()); tableMat.map = tableTex;
    const table = new T.Mesh(new T.PlaneGeometry(1200, 800), tableMat); table.rotation.x = -PI / 2; table.position.set(45, 0, 25); table.receiveShadow = true; scene.add(table);
    pctx.geos.push(table.geometry);

    // máy sạc (cố định) + LCD sống
    charger = buildCharger(sctx); scene.add(charger);
    charger.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingSphere(); o.castShadow = !o.userData.decal && o.geometry.boundingSphere.radius > 9; o.receiveShadow = true; } });
    mark('bench:charger');
    await nextFrame();
    lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 1024; lcdCanvas.height = 310; lcdG = lcdCanvas.getContext('2d');
    lcdTex = new T.CanvasTexture(lcdCanvas); lcdTex.colorSpace = T.SRGBColorSpace; lcdTex.anisotropy = 8; pctx.tex.push(lcdTex);
    const lm = charger.userData.lcdMat; lm.emissiveMap = lcdTex; lm.emissiveIntensity = 0.9; lm.needsUpdate = true;
    Object.keys(BTN_SIM).forEach((id) => { btnGroups[id] = charger.userData.btns[id]; btnPress[id] = 0; btnGroups[id].userData.y0 = btnGroups[id].position.y; (sctx.parts.get(id) || []).forEach((m) => { m.userData.btn = id; btnMeshes.push(m); }); });
    sctx.parts.get('lcd').forEach((m) => { m.userData.part = 'lcd'; });

    world = new World({ charger: { x0: -HW, x1: HW, z0: -HD, z1: HD, top: 33 }, iter: mobile ? 6 : 8, sub: 2 });

    await nextFrame();
    // ---- vật thể ----
    const mk = (id, kind, built, o) => {
      const b = makeBody(Object.assign({ id, state: 'free', restY: built.restY ?? 4, y: built.restY ?? 4, invM: 0.2, invI: 0.004, radius: 9 }, o));
      b.kind = kind; b.Lh = built.Lh || 0; b.obj = built.group; b.ports = []; b.hold = HOLD[o.plug] || 1; b.drive = null; b.pullA = 0; b.lift = o.lift || 28;
      scene.add(built.group);
      built.group.traverse((m) => { if (m.isMesh) { m.userData.body = b; m.castShadow = !m.userData.decal; m.receiveShadow = true; if (!m.userData.decal) pickMeshes.push(m); } });
      world.addBody(b); bodies[id] = b; return b;
    };
    const XTM = PT.xt60Male(pctx), XTF = PT.xt60Female(pctx);
    const pk = PT.packBody(pctx, K);
    const pack = mk('pack', 'pack', { group: pk.group, restY: 0, Lh: K.BATT.L / 2 }, { invM: 0.05, invI: 0.00004, radius: 56, lift: 20 });
    pack.body = pk.body;
    mk('banR', 'plug', PT.bananaPlug(pctx, 'red'), { plug: 'ban' });
    mk('banK', 'plug', PT.bananaPlug(pctx, 'black'), { plug: 'ban' });
    mk('t3', 'plug', PT.deansMale(pctx), { plug: 'deans-m' });
    mk('t8', 'socket', PT.deansFemale(pctx), {});
    mk('f8', 'socket', XTF, {});
    mk('xt60m', 'plug', XTM, { plug: 'xt60-m' });
    mk('xh', 'plug', PT.xhPlug(pctx), { plug: 'xh' });
    mk('c5', 'plug', PT.iecC5(pctx), { plug: 'c5', radius: 12 });
    mk('dcp', 'plug', PT.dcBarrel(pctx), { plug: 'dc' });
    mk('clipR', 'plug', PT.alligatorClip(pctx, 'red'), { plug: 'clip', lift: 60, radius: 12 });
    mk('clipK', 'plug', PT.alligatorClip(pctx, 'black'), { plug: 'clip', lift: 60, radius: 12 });
    world.packs.push({ body: pack, L: K.BATT.L, W: K.BATT.W, H: K.BATT.H, trim: 12 });

    // ổ cắm tường + ắc quy
    const strip = PT.wallStrip(pctx); strip.position.set(-368, 0, -172); strip.rotation.y = 0; scene.add(strip);
    const BAT = { x: -318, z: 150, w: 100, d: 74, h: 85 };
    const postL = { pos: { x: 30, z: -17 }, neg: { x: 30, z: 17 } };
    const bat = PT.carBattery(pctx, BAT, postL); bat.position.set(BAT.x, 0, BAT.z); scene.add(bat);
    bat.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

    // ---- ổ cắm (cổng) ----
    const addPort = (p) => { p.occupant = null; ports.push(p); return p; };
    addPort({ id: 'out-pos', type: 'ban', label: 'OUT +', x: HW + 0.95, y: K.BAN.pos.y, z: HD - K.BAN.pos.d, ang: 0, depth: 11 });
    addPort({ id: 'out-neg', type: 'ban', label: 'OUT −', x: HW + 0.95, y: K.BAN.neg.y, z: HD - K.BAN.neg.d, ang: 0, depth: 11 });
    K.BAL.forEach((s) => addPort({ id: s.id, type: 'xh', cells: BAL_CELLS[s.id], label: s.label, x: HW + 0.2, y: s.y0 + K.BAL_H / 2, z: HD - (s.d0 + K.BAL_MARGIN / 2 + K.BAL_PITCH * (s.n - 1) / 2), ang: 0, depth: 9 }));
    addPort({ id: 'ac', type: 'iec', label: 'Nguồn AC', x: -HW - 3, y: (K.LEFT.ac.y0 + K.LEFT.ac.y1) / 2, z: HD - (K.LEFT.ac.d0 + K.LEFT.ac.d1) / 2, ang: PI, depth: 11 });
    addPort({ id: 'dc', type: 'dcjack', label: 'DC 11–18 V', x: -HW - 2.2, y: (K.LEFT.dc.y0 + K.LEFT.dc.y1) / 2, z: HD - (K.LEFT.dc.d0 + K.LEFT.dc.d1) / 2, ang: PI, depth: 9 });
    const postTop = BAT.h + 11.5;
    addPort({ id: 'post+', type: 'post', radial: true, label: 'Cực + ắc quy', x: BAT.x + postL.pos.x, y: postTop, z: BAT.z + postL.pos.z, ang: 0, depth: 0 });
    addPort({ id: 'post-', type: 'post', radial: true, label: 'Cực − ắc quy', x: BAT.x + postL.neg.x, y: postTop, z: BAT.z + postL.neg.z, ang: 0, depth: 0 });
    const t8p = addPort({ id: 't8', type: 'deans-f', owner: bodies.t8, label: 'T-plug dây #8', lx: bodies.t8.Lh, ly: 0, lz: 0, localAng: 0, depth: 9 });
    const f8p = addPort({ id: 'f8', type: 'xt60-f', owner: bodies.f8, label: 'XT60 dây #8', lx: bodies.f8.Lh, ly: 0, lz: 0, localAng: 0, depth: 10 });
    bodies.t8.ports.push(t8p); bodies.f8.ports.push(f8p);

    // ---- dây ----
    const B = bodies, Lp = K.BATT.L / 2 - 3;
    const R = (id, a, b, len, r, wires, flow, n) => {
      const at = (s) => (s.body ? { body: B[s.body], lx: s.lx, ly: s.ly || 0, lz: s.lz || 0 } : { wx: s.wx, wy: s.wy, wz: s.wz });
      const rp = new Rope({ id, n: n || ROPE_N, length: len, radius: r, a: at(a), b: at(b), bend: r < 1 ? 0.7 : 0.9 });
      rp.flow = flow; rp.wires = wires; world.addRope(rp); ropes.push(rp);
      ropeVis.push(makeRopeVis(rp, wires, r)); return rp;
    };
    const red = pctx.bm.red, blk = pctx.bm.black;
    R('banR', { body: 'banR', lx: -19 }, { body: 't3', lx: -9, lz: -3.6 }, 330, 1.95, [{ r: 1.95, m: red, o: 0 }], +1);
    R('banK', { body: 'banK', lx: -19 }, { body: 't3', lx: -9, lz: 3.6 }, 330, 1.95, [{ r: 1.95, m: blk, o: 0 }], -1);
    R('t8R', { body: 't8', lx: -bodies.t8.Lh, lz: 3.6 }, { body: 'f8', lx: -bodies.f8.Lh, lz: 3.6 }, 150, 1.95, [{ r: 1.95, m: red, o: 0 }], +1);
    R('t8K', { body: 't8', lx: -bodies.t8.Lh, lz: -3.6 }, { body: 'f8', lx: -bodies.f8.Lh, lz: -3.6 }, 150, 1.95, [{ r: 1.95, m: blk, o: 0 }], -1);
    R('pkR', { body: 'xt60m', lx: -bodies.xt60m.Lh, lz: -3.6 }, { body: 'pack', lx: Lp, ly: 20, lz: -3.6 }, 100, 1.95, [{ r: 1.95, m: red, o: 0 }], +1);
    R('pkK', { body: 'xt60m', lx: -bodies.xt60m.Lh, lz: 3.6 }, { body: 'pack', lx: Lp, ly: 20, lz: 3.6 }, 100, 1.95, [{ r: 1.95, m: blk, o: 0 }], -1);
    const bm = pctx.bm, balMats = [blk, red, red, red, red];
    R('bal', { body: 'xh', lx: -bodies.xh.Lh }, { body: 'pack', lx: Lp, ly: 8, lz: 0 }, 140, 0.55, (K.BAL_NEG_BACK ? [-5, -2.5, 0, 2.5, 5] : [5, 2.5, 0, -2.5, -5]).map((o, i) => ({ r: 0.55, m: balMats[i], o })), +1, mobile ? 7 : 10);
    R('cord', { body: 'c5', lx: -22 }, { wx: -355, wy: 18, wz: -172 }, 420, 3.0, [{ r: 3.0, m: bm.cord, o: 0 }], 0, mobile ? 10 : 14);
    R('dcR', { body: 'dcp', lx: -20 }, { body: 'clipR', lx: -31 }, 320, 1.6, [{ r: 1.6, m: red, o: 0 }], 0);
    R('dcK', { body: 'dcp', lx: -20 }, { body: 'clipK', lx: -31 }, 320, 1.6, [{ r: 1.6, m: blk, o: 0 }], 0);

    // ---- hạt chạy dọc dây (dòng điện) ----
    const bgeo = new T.SphereGeometry(2.7, 10, 8); pctx.geos.push(bgeo);
    const bmat = new T.MeshBasicMaterial({ color: 0xffb02e }); disposables.bmat = bmat;
    beads = new T.InstancedMesh(bgeo, bmat, 6 * 8 + 10); beads.count = 0; beads.frustumCulled = false; scene.add(beads);

    // ---- điểm đánh dấu ổ (chạm để cắm) ----
    const ringG = new T.TorusGeometry(8.5, 0.9, 8, 28); pctx.geos.push(ringG);
    const hitG = new T.SphereGeometry(10, 10, 8); pctx.geos.push(hitG);
    for (let i = 0; i < 12; i++) {
      const mat = new T.MeshBasicMaterial({ color: 0x2f7bff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }); disposables['mm' + i] = mat;
      const g = new T.Group(); const ring = new T.Mesh(ringG, mat); const hit = new T.Mesh(hitG, new T.MeshBasicMaterial({ visible: false })); hit.userData.marker = i;
      ring.renderOrder = 20; g.add(ring, hit); g.visible = false; scene.add(g);
      const tag = h('div', { class: 'bench-tag' }); over.appendChild(tag);
      markerPool.push({ g, ring, hit, mat, tag, cand: null });
    }

    // ---- khung nhìn ----
    Object.entries(VIEWS).forEach(([k, [label]]) => { const b = h('button', { class: 'chip', type: 'button', onclick: () => setView(k) }, label); b.dataset.v = k; viewsEl.appendChild(b); });
    viewsEl.append(h('button', { class: 'chip', type: 'button', 'aria-label': 'Phóng to', onclick: () => zoomBy(0.8) }, '＋'), h('button', { class: 'chip', type: 'button', 'aria-label': 'Thu nhỏ', onclick: () => zoomBy(1.25) }, '－'));
    mark('bench:ropes'); physWake(1500);
    await stagedCompile(scene, camera);
    mark('bench:compiled');
    resetLayout(false);
    // Cho dây nằm yên trước khi hiện (mô phỏng ~4 s trong nền, chia đoạn nhỏ để không chặn trang): lúc mở ra bàn đã tĩnh, không phải vẽ nhiều khung để chờ dây ổn định.
    for (let k = 0; k < 6; k++) { for (let i = 0; i < 40; i++) world.step(1 / 60); await nextFrame(); if (st.disposed) return; }
    awakeUntil = 0; physActive = true; settle = 24;
    st.ready = true; loading.remove();
    resize(true);
    setView(narrow() ? 'right' : 'all', true);
    simLink();
    wake(300); schedulePanels();
  }

  // ---------- hình dây ----------
  function makeRopeVis(rp, wires, r) {
    const M = rp.n <= 8 ? 3 : 3, rings = (rp.n - 1) * M + 1, RAD = r < 1 ? 5 : 9;
    const vis = { rp, rings, RAD, wires: [], cx: new Float32Array(rings * 3), tx: new Float32Array(rings * 3), nx: new Float32Array(rings * 3) };
    wires.forEach((w) => {
      const pos = new Float32Array(rings * RAD * 3), nor = new Float32Array(rings * RAD * 3), idx = [];
      for (let i = 0; i < rings - 1; i++) for (let j = 0; j < RAD; j++) { const a = i * RAD + j, b = i * RAD + (j + 1) % RAD, c = (i + 1) * RAD + j, d = (i + 1) * RAD + (j + 1) % RAD; idx.push(a, c, b, b, c, d); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setIndex(idx);
      const m = new T.Mesh(geo, w.m); m.frustumCulled = false; m.castShadow = w.r > 1; m.receiveShadow = false; scene.add(m);
      pctx.geos.push(geo); vis.wires.push({ mesh: m, geo, pos, nor, r: w.r, o: w.o });
    });
    return vis;
  }
  function updateRopeVis(v) {
    const P = v.rp.P, n = v.rp.n, M = (v.rings - 1) / (n - 1), c = v.cx;
    const pt = (i, k) => P[3 * clamp(i, 0, n - 1) + k];
    for (let q = 0; q < v.rings; q++) {          // Catmull-Rom đều
      const f = q / M, i = Math.min(n - 2, Math.floor(f)), t = f - i, t2 = t * t, t3 = t2 * t;
      for (let k = 0; k < 3; k++) {
        const p0 = pt(i - 1, k), p1 = pt(i, k), p2 = pt(i + 1, k), p3 = pt(i + 2, k);
        c[3 * q + k] = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      }
    }
    const RAD = v.RAD;
    for (let q = 0; q < v.rings; q++) {
      const a = Math.max(0, q - 1), b = Math.min(v.rings - 1, q + 1);
      let tx = c[3 * b] - c[3 * a], ty = c[3 * b + 1] - c[3 * a + 1], tz = c[3 * b + 2] - c[3 * a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let nx = tz, ny = 0, nz = -tx; let nl = Math.hypot(nx, nz);
      if (nl < 1e-3) { nx = 1; nz = 0; nl = 1; }
      nx /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (const w of v.wires) {
        for (let j = 0; j < RAD; j++) {
          const ph = (j / RAD) * TAU, cs = Math.cos(ph), sn = Math.sin(ph), o = (q * RAD + j) * 3;
          const ux = cs * nx + sn * bx, uy = cs * ny + sn * by, uz = cs * nz + sn * bz;
          w.pos[o] = c[3 * q] + w.o * nx + w.r * ux; w.pos[o + 1] = c[3 * q + 1] + w.o * ny + w.r * uy; w.pos[o + 2] = c[3 * q + 2] + w.o * nz + w.r * uz;
          w.nor[o] = ux; w.nor[o + 1] = uy; w.nor[o + 2] = uz;
        }
      }
    }
    for (const w of v.wires) { w.geo.attributes.position.needsUpdate = true; w.geo.attributes.normal.needsUpdate = true; }
  }

  // ============ giắc, ổ: hình học cắm ============
  function portWorld(Q) {
    if (!Q.owner) return { x: Q.x, y: Q.y, z: Q.z, ang: Q.ang };
    const o = Q.owner, c = Math.cos(o.yaw), s = Math.sin(o.yaw);
    return { x: o.x + Q.lx * c - Q.lz * s, y: o.y + Q.ly, z: o.z + Q.lx * s + Q.lz * c, ang: o.yaw + Q.localAng };
  }
  const plugTip = (P) => ({ x: P.x + Math.cos(P.yaw) * P.Lh, y: P.y, z: P.z + Math.sin(P.yaw) * P.Lh });
  // ứng viên cắm. Chế độ 'plug': mover là giắc P vào cổng Q. Chế độ 'owner': mover là thân có cổng Q kéo về giắc P (đang tự do).
  function candidate(mode, Q, P) {
    if (mode === 'plug') {
      const w = portWorld(Q), ox = Math.cos(w.ang), oz = Math.sin(w.ang);
      if (Q.radial) return { mode, Q, P, O: null, A: [Q.x, Q.y, Q.z], u: [0, 1, 0], len: 55, depth: 0, mouth: [Q.x, Q.y, Q.z] };
      return { mode, Q, P, O: Q.owner || null, A: [w.x - ox * Q.depth, w.y, w.z - oz * Q.depth], u: [ox, 0, oz], len: 70 + Q.depth, depth: Q.depth, mouth: [w.x, w.y, w.z] };
    }
    const tip = plugTip(P), dx = Math.cos(P.yaw), dz = Math.sin(P.yaw);
    return { mode, Q, P, O: Q.owner, A: [tip.x - dx * Q.depth, tip.y, tip.z - dz * Q.depth], u: [dx, 0, dz], len: 70 + Q.depth, depth: Q.depth, mouth: [tip.x, tip.y, tip.z] };
  }
  function poseAt(c, a, cur) {
    const tx = c.A[0] + c.u[0] * a, ty = c.A[1] + c.u[1] * a, tz = c.A[2] + c.u[2] * a;
    if (c.mode === 'plug') {
      const P = c.P;
      if (c.Q.radial) { const yw = cur ? cur.yaw : P.yaw; return { x: tx - Math.cos(yw) * (P.Lh - 8), y: ty, z: tz - Math.sin(yw) * (P.Lh - 8), yaw: yw }; }
      return { x: tx + c.u[0] * P.Lh, y: ty, z: tz + c.u[2] * P.Lh, yaw: Math.atan2(-c.u[2], -c.u[0]) };
    }
    const Q = c.Q, yaw = Math.atan2(-c.u[2], -c.u[0]) - Q.localAng, cs = Math.cos(yaw), sn = Math.sin(yaw);
    return { x: tx - (Q.lx * cs - Q.lz * sn), y: ty - Q.ly, z: tz - (Q.lx * sn + Q.lz * cs), yaw };
  }
  function candidatesFor(X) {
    const out = [];
    if (X.kind === 'plug') {
      for (const Q of ports) if (!Q.occupant && Q.owner !== X && FITS[X.plug].includes(Q.type) && (!Q.owner || Q.owner.state !== 'held' || Q.owner === X)) out.push(candidate('plug', Q, X));
    } else if (X.kind === 'socket') {
      for (const Q of X.ports) if (!Q.occupant) for (const key in bodies) { const P = bodies[key]; if (P.kind === 'plug' && P.state === 'free' && FITS[P.plug].includes(Q.type)) out.push(candidate('owner', Q, P)); }
    }
    return out;
  }
  function raySeg(O, D, A, u, len) {
    const wx = O.x - A[0], wy = O.y - A[1], wz = O.z - A[2];
    const b = D.x * u[0] + D.y * u[1] + D.z * u[2], d = D.x * wx + D.y * wy + D.z * wz, e = u[0] * wx + u[1] * wy + u[2] * wz;
    const den = 1 - b * b;
    let s = Math.abs(den) > 1e-6 ? (e - b * d) / den : 0;
    s = clamp(s, 0, len);
    const t = Math.max(0, b * s - d);
    const dx = O.x + D.x * t - (A[0] + u[0] * s), dy = O.y + D.y * t - (A[1] + u[1] * s), dz = O.z + D.z * t - (A[2] + u[2] * s);
    return { s, r: Math.hypot(dx, dy, dz) };
  }

  // ---------- cắm / rút ----------
  function startSeat(X, c, aFrom) {
    physWake();
    X.state = 'seating'; X.guided = false; X.drive = null;
    X.seat = { c, t0: performance.now(), aFrom, dur: 280, mover: c.mode === 'plug' ? c.P : c.O };
    if (c.mode === 'owner') { c.P.state = 'seating'; c.O.state = 'seating'; X.state = 'seating'; }
    X.tens = [0, 0]; X.tensEma = 0;
  }
  function finishSeat(X) {
    const c = X.seat.c, P = c.P, Q = c.Q; X.seat = null;
    P.state = 'plugged'; P.port = Q; P.host = Q.owner || null; Q.occupant = P; P.pullA = 0; P.plugT = performance.now(); P.tens = [0, 0]; P.tensEma = 0;
    if (c.mode === 'owner') { c.O.state = 'free'; }
    evlog.push({ t: Math.round(performance.now()), ev: 'plug', id: P.id, port: Q.id });
    sfx('click'); onCircuitChange(P);
  }
  function unplug(P, kick) {
    physWake();
    const Q = P.port; if (!Q) return;
    Q.occupant = null; P.port = null; P.host = null; P.state = 'free'; P.tens = [0, 0]; P.tensEma = 0; P.pullA = 0;
    if (kick) { const w = portWorld(Q), ox = Math.cos(w.ang), oz = Math.sin(w.ang); P.x += ox * kick; P.z += oz * kick; if (Q.radial) P.y += kick; }
    onCircuitChange(P, true);
  }
  function plugPose(P) {
    const Q = P.port, c = candidate('plug', Q, P);
    return poseAt(c, -0 + P.pullA, P);
  }
  function applyPose(b, p) { b.x = p.x; b.y = p.y; b.z = p.z; b.yaw = p.yaw; }

  // ---------- điện ----------
  function circuit() {
    const P = (id) => bodies[id].port, pid = (b) => (b ? b.id : null);
    const ac = !!(P('c5') && P('c5').id === 'ac');
    const dcIn = !!(P('dcp') && P('dcp').id === 'dc'), cr = pid(P('clipR')), ck = pid(P('clipK'));
    const dcOk = dcIn && cr === 'post+' && ck === 'post-', dcRev = dcIn && cr === 'post-' && ck === 'post+';
    const bR = P('banR'), bK = P('banK');
    const bans = !!(bR && bK && bR.type === 'ban' && bK.type === 'ban');
    const t3t8 = !!(P('t3') && P('t3').owner === bodies.t8), xt = !!(P('xt60m') && P('xt60m').owner === bodies.f8);
    const main = bans && t3t8 && xt;
    return { power: ac || dcOk, ac, dcOk, dcRev, bans, t3t8, xt, main, rev: main && bR.id === 'out-neg', bal: P('xh') ? P('xh').cells : null, anyBan: !!(bR || bK), balPlugged: !!P('xh') };
  }
  function onCircuitChange(b, unplugged) {
    const c = circuit(), prev = lastCircuit; lastCircuit = c;
    if (!unplugged && b) {
      if (b.id === 'xt60m' && !(c.bans && c.t3t8)) say('Thứ tự an toàn: nối dây vào máy sạc trước, cắm pin XT60 sau cùng (sách tr.10). Đầu XT60 hở là đầu có điện nếu máy đã bật.', 'warn');
      else if ((b.id === 'banR' || b.id === 'banK') && c.xt) say('Pin đã cắm vào dây trước khi dây gắn vào máy. Lần sau: gắn dây vào máy trước, pin cắm sau cùng.', 'warn');
      else if (b.id === 'xh' && c.bal !== 4) say(`Giắc 5 chân của pin 4S phải vào ổ "4 cells". Đây là ổ ${c.bal} cells: máy sẽ báo lỗi hoặc dò sai số cell.`, 'bad');
      else if ((b.id === 'banR' || b.id === 'banK') && c.bans && c.rev) say('Bắp chuối đỏ đang ở cực −: máy sẽ báo REVERSE POLARITY khi bạn bắt đầu. Đỏ phải vào +.', 'bad');
      else if ((b.id === 'clipR' || b.id === 'clipK') && c.dcRev) say('Kẹp đỏ đang ở cực −: máy không lên điện. Đỏ vào cực +, đen vào cực −.', 'bad');
    }
    pushWiring(true); updateGuide(true);
  }
  function pushWiring(force) {
    const c = lastCircuit || circuit(), key = c.power + '|' + c.main + '|' + c.rev + '|' + c.bal;
    if (!force && key === lastWiring) return;
    lastWiring = key; sim.setWiring({ power: c.power, main: c.main, rev: c.rev, balSocket: c.bal });
  }
  function simLink() { lastCircuit = circuit(); pushWiring(true); }

  // ============ bố cục ban đầu ============
  const START = {
    pack: [250, 80, PI], xt60m: [172, 128, PI], f8: [150, 152, 0], t8: [100, 206, 0], t3: [238, 216, PI],
    banR: [192, 22, PI], banK: [192, -2, PI], xh: [166, 58, PI],
    c5: [-175, -48, 0], dcp: [-178, 78, 0], clipR: [-232, 128, PI], clipK: [-232, 176, PI],
  };
  function resetLayout(announce) {
    autoToken++; physWake(1500);
    for (const id in bodies) if (bodies[id].port) { bodies[id].port.occupant = null; bodies[id].port = null; }
    for (const id in bodies) {
      const b = bodies[id], s = START[id];
      b.state = 'free'; b.host = null; b.seat = null; b.drive = null; b.guided = false; b.pullA = 0; b.tens = [0, 0]; b.tensEma = 0;
      b.x = s[0]; b.z = s[1]; b.yaw = s[2]; b.y = b.restY;
    }
    for (const r of ropes) r.init();
    selected = null; drag = null; controls.enabled = true;
    lastCircuit = circuit(); pushWiring(true); updateGuide(true);
    if (announce) say('Đã dọn lại bàn: mọi giắc về chỗ cũ.', 'ok');
  }

  // ============ camera ============
  function fitFor(box, dirArr) {
    const dir = new T.Vector3(...dirArr).normalize(), lo = box[0], hi = box[1];
    const center = new T.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    const fwd = dir.clone().negate(), up = new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(fwd, up).normalize(), upv = new T.Vector3().crossVectors(right, fwd).normalize();
    const tv = Math.tan(T.MathUtils.degToRad(camera.fov / 2)), asp = camera.aspect || 1;
    let dist = 100;
    for (let i = 0; i < 8; i++) {
      const p = tmpV.set(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]).sub(center), zc = -p.dot(fwd);
      dist = Math.max(dist, Math.abs(p.dot(upv)) / tv * 1.05 + zc, Math.abs(p.dot(right)) / (tv * asp) * 1.05 + zc);
    }
    return { dir, center, dist };
  }
  function setView(name, immediate) {
    curView = name; userMoved = false; wake(1000);
    viewsEl.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.v === name));
    if (!st.ready) return;
    const nb = narrow() && NARROW[name];
    const f = fitFor(nb || BOXES[name], VIEWS[name][1]);
    controls.minDistance = f.dist * 0.3; controls.maxDistance = f.dist * 1.8;
    if (immediate) { camera.position.copy(f.center).addScaledVector(f.dir, f.dist); controls.target.copy(f.center); camera.lookAt(f.center); controls.update(); tween = null; return; }
    const off = camera.position.clone().sub(controls.target);
    tween = { t0: performance.now(), dur: 700, fd: off.clone().normalize(), fdist: off.length(), ft: controls.target.clone(), td: f.dir.clone(), tdist: f.dist, tt: f.center.clone() };
  }
  function stepTween(now) {
    if (!tween) return;
    const p = Math.min(1, (now - tween.t0) / tween.dur), e = ease(p);
    const q = new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(tween.fd, tween.td), e);
    const dir = tween.fd.clone().applyQuaternion(q).normalize(), target = tween.ft.clone().lerp(tween.tt, e), dist = lerp(tween.fdist, tween.tdist, e);
    controls.target.copy(target); camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target);
    if (p >= 1) tween = null;
  }
  controls.addEventListener('start', () => { userMoved = true; tween = null; });
  controls.addEventListener('change', () => wake(250));

  // ============ con trỏ ============
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function pickAt() {
    const hm = markerPool.filter((m) => m.g.visible).map((m) => m.hit);
    if (hm.length) { const hit = raycaster.intersectObjects(hm, false)[0]; if (hit) return { type: 'marker', marker: markerPool[hit.object.userData.marker] }; }
    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
    const bh = raycaster.intersectObjects(btnMeshes, false)[0];
    if (bh && (!hit || bh.distance < hit.distance)) return { type: 'button', id: bh.object.userData.btn };
    if (hit) return { type: 'body', body: hit.object.userData.body, point: hit.point };
    return null;
  }
  function planeHit(y) {
    const pl = new T.Plane(new T.Vector3(0, 1, 0), -y), out = new T.Vector3();
    return raycaster.ray.intersectPlane(pl, out) ? out : null;
  }
  const bodyActive = (b) => b.state === 'free' || b.state === 'held' || b.state === 'plugged';

  canvas.addEventListener('pointerdown', (e) => {
    if (!st.ready || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    root.focus({ preventScroll: true });
    if (e.pointerType === 'mouse') controls.enableZoom = true;   // cuộn chuột phóng to chỉ sau khi bấm vào khung (khỏi chặn cuộn trang)
    autoToken++; wake(300);
    if (audio && audio.state === 'suspended') audio.resume();
    setRay(e); pointer = { x: e.clientX, y: e.clientY, in: true };
    const pk = pickAt();
    if (!pk) { selectBody(null); return; }
    controls.enabled = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    if (pk.type === 'button') { drag = { kind: 'button', id: pk.id, pid: e.pointerId }; sim.btn(BTN_SIM[pk.id], true); btnPress[pk.id] = 1; return; }
    if (pk.type === 'marker') { drag = { kind: 'marker', marker: pk.marker, pid: e.pointerId, x0: e.clientX, y0: e.clientY }; return; }
    const b = pk.body;
    if (!bodyActive(b)) { controls.enabled = true; return; }
    drag = { kind: 'body', body: b, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, mode: b.state === 'plugged' ? 'plug-undecided' : 'move', point: pk.point.clone(), t0: performance.now() };
    activeBody = b;
  }, { capture: true });
  canvas.addEventListener('pointermove', (e) => {
    if (!st.ready) return;
    pointer = { x: e.clientX, y: e.clientY, in: true };
    if (!drag) { if (e.pointerType === 'mouse' && !e.buttons) hoverCursor(e); return; }
    if (e.pointerId !== drag.pid) return;
    if (drag.kind === 'body' && !drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) { drag.moved = true; beginMove(e); }
  });
  let hoverT = 0;
  function hoverCursor(e) {
    const now = performance.now(); if (now - hoverT < 80) return; hoverT = now;
    setRay(e); const pk = pickAt();
    canvas.style.cursor = !pk ? '' : pk.type === 'button' || pk.type === 'marker' ? 'pointer' : 'grab';
  }
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag; drag = null; controls.enabled = true;
    try { canvas.releasePointerCapture(d.pid); } catch (err) { /* đã nhả */ }
    if (d.kind === 'button') { sim.btn(BTN_SIM[d.id], false); btnPress[d.id] = 0; return; }
    if (d.kind === 'marker') { if (Math.hypot((e ? e.clientX : d.x0) - d.x0, (e ? e.clientY : d.y0) - d.y0) < 8 && selected) flyTo(selected, d.marker.cand); return; }
    const b = d.body;
    if (!d.moved) { // chạm
      if (b.state === 'plugged') tapUnplug(b); else selectBody(selected === b ? null : b);
      return;
    }
    if (b.state === 'held') { b.state = 'free'; b.drive = null; b.guided = false; sfx('thunk'); selectBody(null); }
    else if (b.state === 'plugged') { /* kéo hụt: pullA tự về 0 */ }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { pointer.in = false; if (!drag) controls.enableZoom = false; });
  canvas.addEventListener('wheel', (e) => {
    if (drag && drag.kind === 'body' && drag.body.state === 'held') { e.preventDefault(); drag.body.lift = clamp(drag.body.lift - Math.sign(e.deltaY) * 8, 8, 110); }
  }, { passive: false });
  canvas.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') controls.enableZoom = false; });
  function zoomBy(f) { wake(300); const off = camera.position.clone().sub(controls.target), d = clamp(off.length() * f, controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).addScaledVector(off.normalize(), d); userMoved = true; tween = null; }

  function beginMove(e) {
    const b = drag.body;
    setRay(e);
    if (drag.mode === 'plug-undecided') {
      const Q = b.port, w = portWorld(Q), ox = Math.cos(w.ang), oz = Math.sin(w.ang);
      // hướng kéo ban đầu so với trục cắm
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      const p0 = drag.point.clone().project(camera);
      const a = tmpV.set(drag.point.x + ox * 30, drag.point.y, drag.point.z + oz * 30).project(camera);
      const sx = (a.x - p0.x) * size.w / 2, sy = -(a.y - p0.y) * size.h / 2, sl = Math.hypot(sx, sy) || 1;
      const axial = (dx * sx + dy * sy) / sl / (Math.hypot(dx, dy) || 1);
      drag.mode = (!Q.owner || axial > 0.6 || Q.radial) ? 'pull' : 'cluster';
      drag.hit0 = null; drag.w = w;
      if (drag.mode === 'cluster') { drag.body = Q.owner; drag.mode = 'move'; }
    }
    const t = drag.body;
    if (drag.mode === 'move') {
      t.state = 'held'; t.drive = 'drag'; t.guided = false; selectBody(t, true);
      const planeY = drag.point.y + (t.lift - t.y);
      const hit = planeHit(Math.max(planeY, 2)) || drag.point;
      drag.grab = [hit.x - t.x, hit.z - t.z]; drag.planeY = Math.max(planeY, 2);
    }
  }
  function tapUnplug(P) {
    physWake();
    P.state = 'held'; P.drive = 'unplug'; P.unp = { t0: performance.now(), c: candidate('plug', P.port, P), from: 0 };
    sfx('click');
  }
  function flyTo(X, c) {
    autoToken++; physWake();
    X.state = 'held'; X.drive = 'fly'; X.guided = false;
    const from = { x: X.x, y: X.y, z: X.z, yaw: X.yaw };
    const aStart = c.depth + 26, to = poseAt(c, aStart, X);
    X.fly = { t0: performance.now(), dur: 650, from, to, c, aStart };
    selectBody(null);
  }
  function flyToPose(X, to, dur) {
    physWake();
    X.state = 'held'; X.drive = 'fly'; X.guided = false;
    X.fly = { t0: performance.now(), dur: dur || 700, from: { x: X.x, y: X.y, z: X.z, yaw: X.yaw }, to: { x: to[0], y: X.restY, z: to[1], yaw: to[2] }, c: null, aStart: 0 };
  }
  function selectBody(b, quiet) {
    selected = b; if (b) activeBody = b;
    updateMarkers(); wake(200);
  }
  function rotateActive(d) {
    const b = (drag && drag.body) || selected || activeBody;
    if (!b || b.state === 'plugged' || b.state === 'seating') { say('Chọn hoặc cầm một giắc (chưa cắm) rồi bấm Xoay.'); return; }
    b.yaw += d; physWake();
  }

  // ---------- dấu ổ ----------
  function updateMarkers() {
    const X = (drag && drag.body && drag.body.state === 'held') ? drag.body : selected;
    const list = X && bodyActive(X) && X.state !== 'plugged' ? candidatesFor(X) : [];
    markerPool.forEach((m, i) => {
      const c = list[i]; m.cand = c || null; m.g.visible = !!c; m.tag.style.display = 'none';
      if (!c) return;
      const mo = c.mouth; m.g.position.set(mo[0], mo[1], mo[2]);
      m.g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(c.mode === 'plug' ? c.u[0] : -c.u[0], c.mode === 'plug' ? c.u[1] : 0, c.mode === 'plug' ? c.u[2] : -c.u[2]));
      m.tag.textContent = c.mode === 'plug' ? c.Q.label : NAMES[c.P.id];
      m.tag.className = 'bench-tag' + (c.mode === 'plug' && c.Q.type === 'xh' && c.Q.cells !== 4 ? ' dim' : '');
    });
  }

  // ============ cập nhật mỗi khung ============
  function updateHeld(b, now, dt) {
    if (b.drive === 'drag' && drag && drag.body === b) {
      setRay({ clientX: pointer.x, clientY: pointer.y });
      const ph = planeHit(drag.planeY);
      if (ph) {
        const free = { x: ph.x - drag.grab[0], z: ph.z - drag.grab[1], y: b.lift, yaw: b.yaw };
        free.x = clamp(free.x, -430, 530); free.z = clamp(free.z, -240, 290);
        let best = null;
        const O = raycaster.ray.origin, D = raycaster.ray.direction;
        for (const c of candidatesFor(b)) {
          const res = raySeg(O, D, c.A, c.u, c.len), rmax = c.Q.radial ? 16 + 0.1 * res.s : 9 + 0.12 * res.s;
          if (res.r < rmax && (!best || res.r / rmax < best.q)) best = { c, s: res.s, r: res.r, q: res.r / rmax, rmax };
        }
        if (best) {
          const w = smooth((1 - best.q) / 0.7), al = poseAt(best.c, best.s, b);
          applyPose(b, { x: lerp(free.x, al.x, w), y: lerp(free.y, al.y, w), z: lerp(free.z, al.z, w), yaw: angLerp(free.yaw, al.yaw, w) });
          b.guided = w > 0.05;
          const seatA = best.c.Q.radial ? 10 : best.c.depth + 3.5;
          if (w > 0.8 && best.s <= seatA && best.r < (best.c.Q.radial ? 12 : 6)) { startSeat(b, best.c, best.s); drag.moved = true; selectBody(null); return; }
        } else { b.guided = false; applyPose(b, free); }
      }
    } else if (b.drive === 'fly') {
      const f = b.fly, p = clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
      applyPose(b, { x: lerp(f.from.x, f.to.x, e), y: lerp(f.from.y, f.to.y, e) + Math.sin(p * PI) * 34, z: lerp(f.from.z, f.to.z, e), yaw: angLerp(f.from.yaw, f.to.yaw, e) });
      if (p >= 1) { b.fly = null; if (f.c) startSeat(b, candidateRefresh(f.c), f.aStart); else { b.state = 'free'; b.drive = null; } }
    } else if (b.drive === 'unplug') {
      const u = b.unp, p = clamp((now - u.t0) / 240, 0, 1);
      applyPose(b, poseAt(u.c, 22 * ease(p), b));
      if (p >= 1) { const Q = b.port; unplug(b); b.unp = null; b.state = 'free'; b.drive = null; }
    }
  }
  const candidateRefresh = (c) => candidate(c.mode, c.Q, c.P);

  function updateSeat(b, now) {
    const s = b.seat; if (!s) return;
    const c = candidateRefresh(s.c), p = clamp((now - s.t0) / s.dur, 0, 1);
    const a = p < 0.8 ? lerp(s.aFrom, -0.8, ease(p / 0.8)) : lerp(-0.8, 0, (p - 0.8) / 0.2);
    const mover = c.mode === 'plug' ? c.P : c.O;
    applyPose(mover, poseAt(c, a, mover));
    if (p >= 1) { s.c = c; finishSeat(b); }
  }

  function pullUpdate(b, now) {
    // đang kéo giắc đã cắm ra: pullA là độ trồi ra theo trục
    if (!(drag && drag.body === b && drag.mode === 'pull' && drag.moved)) { if (b.pullA > 0.05) b.pullA *= 0.7; else b.pullA = 0; return; }
    setRay({ clientX: pointer.x, clientY: pointer.y });
    const w = portWorld(b.port), ox = Math.cos(w.ang), oz = Math.sin(w.ang);
    const hit = planeHit(drag.point.y) ; if (!hit) return;
    if (!drag.hit0) { drag.hit0 = hit.clone(); }
    let dist = (hit.x - drag.hit0.x) * ox + (hit.z - drag.hit0.z) * oz;
    if (b.port.radial) dist = Math.hypot(hit.x - drag.hit0.x, hit.z - drag.hit0.z);
    b.pullA = clamp(dist * 0.5, 0, 9);
    if (dist > 16) {
      const P = b; unplug(P, 4); P.state = 'held'; P.drive = 'drag'; selectBody(P, true);
      P.lift = Math.max(P.y, 18); drag.mode = 'move'; drag.planeY = Math.max(P.y, 6) + 0; drag.point.y = P.y; const hh = planeHit(drag.planeY) || hit;
      drag.grab = [hh.x - P.x, hh.z - P.z]; sfx('thunk');
    }
  }

  function stepPhysics(now, dt) {
    // 1. vật bị điều khiển / hoạt cảnh
    for (const id in bodies) {
      const b = bodies[id];
      if (b.state === 'held') updateHeld(b, now, dt);
      if (b.state === 'seating') updateSeat(b, now);
    }
    // 2. giắc đã cắm bám theo ổ (ổ có thể nằm trên vật di động)
    for (const id in bodies) {
      const b = bodies[id];
      if (b.state === 'plugged') { pullUpdate(b, now); if (b.state === 'plugged') applyPose(b, plugPose(b)); }
    }
    // 3. độ cao + va chạm thân máy
    const kz = 1 - Math.exp(-14 * dt);
    for (const id in bodies) {
      const b = bodies[id];
      if (b.state === 'free') { b.y += (b.restY - b.y) * kz; world.collideBody(b); }
      else if (b.state === 'held' && b.drive === 'drag') { world.collideBody(b); }
      b.invM = b.invMFree; b.invI = b.invIFree;
    }
    // 4. dây
    world.step(dt);
    // 5. lực kéo -> chuyển sang vật chủ, bật giắc yếu nhất
    for (const id in bodies) {
      const b = bodies[id];
      if (b.state !== 'plugged') continue;
      if (b.host && b.host.state === 'free') { b.host.x += b.tens[0] * 0.8; b.host.z += b.tens[1] * 0.8; }
      else if (b.host && b.host.state === 'plugged') { /* chuỗi lồng nhau: không có trong sơ đồ này */ }
      if (b.tensEma > b.hold && !(drag && drag.body === b)) {
        const name = NAMES[b.id] || 'giắc', quick = now - (b.plugT || 0) < 2500 && !(drag && drag.kind === 'body');
        evlog.push({ t: Math.round(now), ev: 'pop', id: b.id, tens: +b.tensEma.toFixed(2), hold: b.hold });
        unplug(b, 5); sfx('pop');
        say(quick ? `Dây ngắn quá, không với tới ổ này nên ${name} bật ra. Đưa pin lại gần máy rồi cắm lại.` : `Dây bị kéo mạnh quá: ${name} bật ra khỏi ổ. Đúng như thật, mắt xích yếu nhất bật trước.`, 'bad');
      }
    }
  }

  // ---------- LCD sống ----------
  function drawLcd(now) {
    const sc = sim.screenChars(), blink = Math.floor(now / 500) % 2;
    lcdBlink = !sc.off && sc.rows.some((r) => r.some((c) => c.b));
    let key = sc.off ? 'off' : sc.rows.map((r) => r.map((c) => c.c + (c.b ? blink : '')).join('')).join('|');
    if (key === lcdKey) return; lcdKey = key;
    const g = lcdG, w = 1024, hh = 310, cw = w / 16, ch = hh / 2, on = !sc.off;
    const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, on ? '#2f78e6' : '#1a2233'); gr.addColorStop(1, on ? '#1f55b8' : '#141a26'); // manual tr.22: Display Backlight Blue
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) { g.fillStyle = on ? 'rgba(8,30,90,.22)' : 'rgba(255,255,255,.025)'; g.fillRect(c * cw + 4, r * ch + 12, cw - 8, ch - 24); }
    if (on) {
      g.fillStyle = '#eaf4ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(ch * 0.64)}px Consolas, "Cascadia Mono", "Courier New", monospace`;
      sc.rows.forEach((row, r) => row.forEach((x, c) => { if (x.c !== ' ' && !(x.b && blink)) g.fillText(x.c, c * cw + cw / 2, r * ch + ch / 2 + 3); }));
    }
    lcdTex.needsUpdate = true;
    const lm = charger.userData.lcdMat; lm.emissiveIntensity = on ? 0.95 : 0.12; lcdLight.intensity = on ? 380 : 0;
  }

  // ---------- hạt dòng điện ----------
  function updateBeads(dt, snap) {
    const run = snap.run, c = lastCircuit;
    let I = 0, dir = 1;
    if (run && run.live && c && c.main) { I = run.I; dir = run.dir === 'dis' ? -1 : 1; }
    const balOn = run && run.live && run.mode === 'bal' && c && c.bal === 4;
    if (I < 0.02 && !balOn) { beads.count = 0; return; }
    flowPhase = (flowPhase + dt * (0.16 + 0.11 * I)) % 1;
    const m = new T.Matrix4(), tmp = [0, 0, 0]; let k = 0;
    const col = new T.Color(dir > 0 ? 0xffb02e : 0x3cc8ff); beads.material.color.copy(col);
    for (const rp of ropes) {
      const main = rp.id === 'banR' || rp.id === 'banK' || rp.id === 't8R' || rp.id === 't8K' || rp.id === 'pkR' || rp.id === 'pkK';
      const isBal = rp.id === 'bal';
      if (!((main && I >= 0.02) || (isBal && balOn))) continue;
      const nb = main ? 6 : 3, sign = (rp.flow || 1) * dir, ph = isBal ? (flowPhase * 0.25) : flowPhase;
      for (let i = 0; i < nb && k < beads.instanceMatrix.count; i++) {
        let u = (ph + i / nb) % 1; if (sign < 0) u = 1 - u;
        rp.sample(u, tmp);
        m.makeTranslation(tmp[0], tmp[1] + (main ? 0.4 : 0.2), tmp[2]); if (isBal) m.scale(new T.Vector3(0.45, 0.45, 0.45));
        beads.setMatrixAt(k++, m);
      }
    }
    beads.count = k; beads.instanceMatrix.needsUpdate = true;
  }

  // ---------- phủ HTML (ô cell, vòng ENTER, nhãn ổ) ----------
  function project(x, y, z, out) {
    tmpV.set(x, y, z).project(camera);
    out.x = (tmpV.x + 1) / 2 * size.w; out.y = (1 - tmpV.y) / 2 * size.h; out.z = tmpV.z; return out;
  }
  const pj = { x: 0, y: 0, z: 0 };
  function updateOverlay(snap, now) {
    // ô cell trên pin
    const pk = bodies.pack; project(pk.x, 52, pk.z, pj);
    const show = pj.z < 1 && size.w > 0;
    cellsEl.style.display = show ? 'block' : 'none';
    if (show) { cellsEl.style.left = clamp(pj.x, 80, size.w - 80) + 'px'; cellsEl.style.top = clamp(pj.y - 26, 90, size.h - 8) + 'px'; }
    const cells = snap.cells, run = snap.run, balIdx = new Set();
    const mn = Math.min(...cells);
    if (run && run.live && run.mode === 'bal' && lastCircuit && lastCircuit.bal === 4) cells.forEach((v, i) => { if (v - mn > 0.006) balIdx.add(i); });
    cellBars.forEach((cb, i) => {
      const v = cells[i] || 0, f = clamp((v - 3.0) / 1.3, 0.02, 1);
      cb.b.style.height = (f * 100).toFixed(1) + '%'; cb.b.style.background = cellColor(v);
      cb.lab.textContent = v.toFixed(3); cb.wrap.classList.toggle('bal', balIdx.has(i));
    });
    const sp = Math.max(...cells) - mn;
    cellsEl.lastChild.textContent = `Lệch ${(sp * 1000).toFixed(0)} mV · ${snap.pack.temp.toFixed(1)} °C`;
    // vòng giữ ENTER
    const eb = btnGroups['btn-enter'];
    if (ringP > 0.001 && eb) {
      project(eb.position.x, eb.position.y + 3, eb.position.z, pj);
      ringSvg.style.display = 'block'; ringSvg.style.left = pj.x + 'px'; ringSvg.style.top = pj.y + 'px';
      ringC.style.strokeDashoffset = String(157 * (1 - clamp(ringP, 0, 1)));
    } else ringSvg.style.display = 'none';
    // nhãn ổ
    markerPool.forEach((m) => {
      if (!m.g.visible) { m.tag.style.display = 'none'; return; }
      const mo = m.cand.mouth; project(mo[0], mo[1] + 8, mo[2], pj);
      const pulse = 1 + 0.18 * Math.sin(now / 160); m.ring.scale.setScalar(pulse);
      m.tag.style.display = pj.z < 1 ? 'block' : 'none'; m.tag.style.left = pj.x + 'px'; m.tag.style.top = pj.y + 'px';
    });
  }

  // ---------- bảng trạng thái ----------
  let statT = 0;
  function updatePanels(snap, now, force) {
    if (!force && now - statT < 200) return; statT = now;
    const r = snap.run, scr = sim.screenChars(), LF = SAC.LCD_FIELDS || {};
    const V = snap.cells.reduce((a, b) => a + b, 0);
    const tile = (val, lab) => h('div', null, h('b', null, val), h('span', null, lab));
    const live = r && (r.live || r.done);
    const tiles = live ? [
      tile(r.I.toFixed(2) + ' A', r.dir === 'dis' ? 'Dòng xả (LCD: A)' : 'Dòng sạc (LCD: A)'),
      tile(r.V.toFixed(2) + ' V', 'Điện áp pin (LCD: V)'),
      tile(Math.round(r.mah) + ' mAh', 'Đã nạp vào pin (LCD: mAh)'),
      tile(mmss(r.t), 'Thời gian đã chạy (LCD: giờ:phút)'),
      tile(r.done ? (r.result === 'full' ? 'FULL' : 'XONG') : r.phase === 'CC' ? 'CC' : r.phase === 'CV' ? 'CV' : 'XẢ', r.phase === 'CC' ? 'Dòng không đổi' : r.phase === 'CV' ? 'Áp không đổi, dòng giảm' : 'Trạng thái'),
      tile(r.P.toFixed(0) + ' W', 'Công suất (tối đa 50 W)'),
      tile(snap.pack.temp.toFixed(1) + ' °C', 'Nhiệt pin (ước lượng)'),
      tile(Math.round(r.Tint) + ' °C', 'Nhiệt trong máy sạc'),
    ] : [
      tile(V.toFixed(2) + ' V', 'Điện áp cả pin'), tile((V / 4).toFixed(2) + ' V', 'Trung bình mỗi cell'),
      tile(snap.pack.temp.toFixed(1) + ' °C', 'Nhiệt pin (ước lượng)'),
      tile(!snap.powered ? 'Tắt' : snap.booting ? 'Khởi động' : 'Chờ lệnh', 'Máy sạc'),
    ];
    statEl.replaceChildren(...tiles);
    const def = LF[scr.key];
    explEl.replaceChildren();
    if (def) explEl.append(h('b', null, 'Màn hình đang hiện: '), SAC.rich(def.title + '. ' + def.summary));
    else explEl.textContent = '';
    // đồ thị
    if (r && r.live) {
      const rk = 'run';
      if (sampleRunKey !== rk || (samples.length && r.t < samples[samples.length - 1][0] - 1)) { samples = []; sampleRunKey = rk; }
      if (!samples.length || r.t - samples[samples.length - 1][0] >= Math.max(15, r.t / 120)) samples.push([r.t, r.V, r.I, r.mah]);
    } else if (!r) { sampleRunKey = null; }
    drawBenchChart(chartSvg, samples, snap.pack.n || 4, r ? r.Iset : 3, 5300);
    updateGuide(false, snap);
  }
  let guideSig = '';
  function updateGuide(force, snap) {
    snap = snap || sim.snapshot();
    const c = lastCircuit || circuit(), r = snap.run;
    const steps = [
      ['Cắm dây nguồn AC vào ổ bên trái máy (hoặc cáp DC 12 V có kẹp cá sấu vào ắc quy)', c.power, null],
      ['Cắm hai bắp chuối của dây #3 vào OUTPUT: đỏ vào +, đen vào −', c.bans && !c.rev, c.rev ? 'Đang ngược cực' : null],
      ['Nối T-plug dây #3 với T-plug dây #8', c.t3t8, null],
      ['Cắm XT60 của pin vào dây #8 (pin cắm SAU CÙNG)', c.xt, null],
      ['Cắm giắc cân bằng 5 chân vào ổ "4 cells" (dây đen về phía dấu ⊖, đầu sau)', c.bal === 4, c.balPlugged && c.bal !== 4 ? 'Sai ổ' : null],
      ['Trên máy: LiPo BALANCE CHG, 3,0 A, 4S. Giữ ENTER 3 giây', !!(r && (r.live || r.done)) || snap.kind === 'run', null],
      ['Màn BATTERY CHECK: R:4SER S:4SER thì bấm ENTER xác nhận', !!(r && (r.live || r.done)), snap.kind === 'check' && snap.phase === 'mismatch' ? 'R khác S' : null],
      ['Chọn 600× và chờ đến khi máy hiện FULL và bíp', !!(r && r.done), null],
      ['Rút ngược lại: giắc cân bằng, XT60 của pin, rồi mới rút dây khỏi máy', !!(r && r.done) && !c.xt && !c.balPlugged, null],
    ];
    const sig = steps.map((s, i) => (s[1] ? 1 : 0) + (s[2] || '')).join(',');
    if (!force && sig === guideSig) return; guideSig = sig;
    let now = steps.findIndex((s) => !s[1]);
    stepsEl.replaceChildren(...steps.map((s, i) => h('li', { class: (s[1] ? 'done ' : '') + (i === now ? 'now ' : '') + (s[2] ? 'bad' : '') }, h('i', null, s[1] ? '✓' : s[2] ? '!' : String(i + 1)), h('span', null, s[0] + (s[2] ? ' (' + s[2] + ')' : '')))));
  }

  // ============ vòng lặp ============
  function resize(force) {
    const w = stage.clientWidth, hh = stage.clientHeight; if (!w || !hh) return;
    if (!force && w === size.w && hh === size.h) return;
    size = { w, h: hh }; canvas.width = Math.round(w * GL.pr); canvas.height = Math.round(hh * GL.pr); camera.aspect = w / hh; camera.updateProjectionMatrix();
    if (st.ready && !tween && !userMoved) setView(curView, true);
    wake(150);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) { needRender = true; lastNow = 0; kick(); schedulePanels(); } });
  io.observe(stage);
  const onVis = () => { if (!document.hidden) { needRender = true; lastNow = 0; kick(); } }; document.addEventListener('visibilitychange', onVis);

  function kick() { if (raf || st.disposed || !visible || document.hidden || !st.ready) return; raf = requestAnimationFrame(tick); }
  function wake(ms = 500) { awakeUntil = Math.max(awakeUntil, performance.now() + ms); needRender = true; kick(); }
  function physWake(ms = 700) { physActive = true; settle = 0; wake(ms); }
  function schedulePanels() {
    if (panelsT || st.disposed || !st.ready) return;
    panelsT = setTimeout(() => {
      panelsT = 0; if (st.disposed || !visible) return;
      if (scrollBusy()) { schedulePanels(); return; }
      const snap = sim.snapshot(), now = performance.now(); updatePanels(snap, now, true); updateOverlay(snap, now);
    }, 120);
  }
  function motionNow() {
    if (drag || tween) return true;
    for (const id in bodies) { const b = bodies[id]; if (b.state === 'held' || b.state === 'seating' || b.pullA > 0.05) return true; }
    for (const k in btnGroups) if (btnPress[k] || (btnGroups[k].userData.cur || 0) > 0.05) return true;
    return markerPool.some((m) => m.g.visible);
  }
  function bodyMotion() {
    let m = 0;
    for (const id in bodies) {
      const b = bodies[id], l = b._l || (b._l = [b.x, b.z, b.y, b.yaw]);
      const mv = Math.max(Math.abs(b.x - l[0]), Math.abs(b.z - l[1]), Math.abs(b.y - l[2]), Math.abs(b.yaw - l[3]) * 8); if (mv > m) dbgWho = id + ':' + mv.toFixed(3);
      m = Math.max(m, mv);
      l[0] = b.x; l[1] = b.z; l[2] = b.y; l[3] = b.yaw;
    }
    return m;
  }
  function scheduleBlink(snap) {
    if (!lcdBlink || !snap.powered || blinkT) return;
    blinkT = setTimeout(() => { blinkT = 0; needRender = true; kick(); }, 500 - (performance.now() % 500) + 5);
  }

  function tick(now) {
    raf = 0;
    if (st.disposed || !visible || document.hidden || !st.ready) return;
    if (scrollBusy()) { if (!scrollT) scrollT = setTimeout(() => { scrollT = 0; lastNow = 0; kick(); }, scrollWait()); return; }
    let dt = (now - lastNow) / 1000; if (!lastNow || dt > 0.1) dt = 1 / 60; lastNow = now;
    const snap = sim.snapshot();
    const runLive = !!(snap.run && snap.run.live);
    stepTween(now);
    const motion = motionNow();
    const fast = motion || physActive || now < awakeUntil;
    const slowDue = runLive && now - lastRender >= 48;
    if (!(fast || needRender || slowDue)) { if (runLive) kick(); else scheduleBlink(snap); return; }
    const c0 = performance.now();
    frame++;
    if (fast) {
      acc += dt; let n = 0;
      while (acc >= 1 / 60 && n < 3) { stepPhysics(now, 1 / 60); acc -= 1 / 60; n++; }
      if (n === 3) acc = 0;
      const bm = bodyMotion();
      settle = (!motion && world.maxMove < 0.06 && bm < 0.05) ? settle + Math.max(1, n) : 0;
      physActive = settle < 30;          // yên liên tục ~0,5 s thì thôi mô phỏng
      controls.update();                 // quán tính camera; phát 'change' nếu còn dịch chuyển
    } else acc = 0;
    // chỉ "đang ổn định" (không kéo, không hoạt cảnh): vẽ tối đa ~16 khung/s cho nhẹ
    if (!(motion || needRender || slowDue) && now - lastRender < 60) { kick(); return; }
    // hiển thị
    for (const id in bodies) { const b = bodies[id]; b.obj.position.set(b.x, b.y, b.z); b.obj.rotation.y = -b.yaw; }
    for (const v of ropeVis) updateRopeVis(v);
    for (const id in btnGroups) { const g = btnGroups[id], tgt = btnPress[id] ? 1.5 : 0; g.userData.cur = (g.userData.cur || 0) + (tgt - (g.userData.cur || 0)) * 0.5; g.position.y = g.userData.y0 - g.userData.cur; }
    drawLcd(now);
    updateBeads(Math.min(0.1, Math.max(0.001, (now - lastRender) / 1000)), snap);
    if (fast && frame % 6 === 0) { lastCircuit = circuit(); pushWiring(false); }
    updateOverlay(snap, now);
    if (drag && drag.kind === 'body' && drag.body.state === 'held') { if (frame % 4 === 0) updateMarkers(); }
    cpuMs += (performance.now() - c0 - cpuMs) * 0.05;
    lastRender = now; needRender = false;
    glPresent(scene, camera, size.w, size.h, canvas, g2d, exposure, qual);
    if (frame <= 4) mark('bench:frame' + frame + ' progs=' + GL.renderer.info.programs.length);
    if (fast || runLive) kick(); else scheduleBlink(snap);
  }

  // ============ phím tắt ============
  const KEYS = { Escape: 'stop', ArrowLeft: 'dec', ArrowRight: 'inc', Enter: 'enter' };
  const benchActive = () => root.contains(document.activeElement) || root.matches(':hover');
  const keyDown = (e) => {
    if (!benchActive() || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) return;
    if (e.key === 'r' || e.key === 'R') { rotateActive(e.shiftKey ? -PI / 4 : PI / 4); e.preventDefault(); return; }
    const id = KEYS[e.key]; if (!id) return;
    if (e.target.closest && e.target.closest('button') && id === 'enter') return;
    e.preventDefault(); if (e.repeat) return; wake(300); sim.btn(id, true); btnPress['btn-' + (id === 'stop' ? 'batt' : id)] = 1;
  };
  const keyUp = (e) => { const id = KEYS[e.key]; if (!id || !benchActive()) return; wake(300); sim.btn(id, false); btnPress['btn-' + (id === 'stop' ? 'batt' : id)] = 0; };
  document.addEventListener('keydown', keyDown); document.addEventListener('keyup', keyUp);

  // ============ liên kết với sim ============
  const offs = [
    sim.on('hold', (e) => { ringP = e.p; if (st.ready) updateOverlay(sim.snapshot(), performance.now()); }),
    sim.on('render', () => { needRender = true; kick(); schedulePanels(); }),
    sim.on('beep', (e) => { bell.classList.add('on'); clearTimeout(bellT); bellT = setTimeout(() => bell.classList.remove('on'), e.buzzer ? 900 : 160); }),
    sim.on('speed', (s) => { speedChips.forEach((c, i) => c.classList.toggle('on', sim.SPEEDS[i] === s)); schedulePanels(); }),
    sim.on('sound', (v) => { soundCb.checked = v; }),
    sim.on('pack', (k) => { packSel.value = k; samples = []; wake(200); schedulePanels(); }),
    sim.on('scenario', (s) => { packSel.value = sim.packStateId; samples = []; if (st.ready) autoWire({ rev: !!(s.wiring && s.wiring.reverse), nobal: !!(s.wiring && s.wiring.balance === false) }); }),
  ];
  speedChips.forEach((c, i) => c.classList.toggle('on', sim.SPEEDS[i] === sim.getSpeed()));
  packSel.value = sim.packStateId;

  // ============ tự cắm theo kịch bản (có hoạt cảnh) ============
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function plugPart(id, portId, token) {
    const b = bodies[id], Q = ports.find((p) => p.id === portId);
    if (!b || !Q) throw new Error('[SAC.bench] khong co ' + id + ' hoac ' + portId);
    if (b.port) unplug(b);
    if (token !== autoToken) return false;
    let c;
    if (b.kind === 'plug') c = candidate('plug', Q, b); else c = candidate('owner', Q, bodies[portId === 't8' ? 't3' : 'xt60m']);
    flyTo(b, c); autoToken--;     // flyTo tăng token; giữ nguyên để chuỗi tự cắm không tự huỷ
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) { await wait(60); if (token !== autoToken) return false; if (b.port === Q || (c.mode === 'owner' && Q.occupant)) break; }
    await wait(120);
    return true;
  }
  async function autoWire(plan) {
    plan = plan || {};
    resetLayout(false);
    const token = autoToken;
    say('Máy ảo đang cắm dây theo kịch bản. Chạm vào bàn để dừng và tự làm tiếp.', 'ok');
    flyToPose(bodies.pack, START.pack, 800); await wait(900);   // người thật cũng đưa pin lại gần máy trước khi nối
    if (token !== autoToken) return;
    const seq = [
      ['c5', 'ac'], ['banR', plan.rev ? 'out-neg' : 'out-pos'], ['banK', plan.rev ? 'out-pos' : 'out-neg'],
      ['t3', 't8'], ['xt60m', 'f8'], ...(plan.nobal ? [] : [['xh', 'bal-4s']]),
    ];
    for (const [id, port] of seq) { if (token !== autoToken) return; await plugPart(id, port, token); }
    if (token === autoToken) say(plan.rev ? 'Đã cắm NGƯỢC cực để bạn thấy lỗi. Giữ ENTER 3 giây để chạy.' : plan.nobal ? 'Cố ý không cắm dây cân bằng. Giữ ENTER 3 giây để chạy.' : 'Đã cắm xong. Giữ ENTER 3 giây trên nút ENTER 3D (hoặc ở mặt máy 2D) để chạy.', 'ok');
  }

  // ============ dựng ============
  const built = loadModels().then((models) => { if (!st.disposed) return build(models); }).catch((err) => { console.error('[SAC.bench] dung canh that bai', err); loading.textContent = 'Không dựng được bàn 3D: ' + err.message; });
  applyTheme();

  const api = {
    setView, resetLayout, autoWire, rotate: rotateActive, zoom: zoomBy, frames: () => frame,
    plug: (id, port) => plugPart(id, port, autoToken),
    unplug: (id) => { const b = bodies[id]; if (b && b.port) unplug(b); },
    // phục vụ kiểm thử: toạ độ màn hình (px, theo cửa sổ) của một món đồ hoặc một ổ
    screenOf(what) {
      const Q = ports.find((p) => p.id === what), b = bodies[what]; let v;
      if (btnGroups[what]) { const g = btnGroups[what]; v = [g.position.x, g.position.y + 2.5, g.position.z]; } else if (Q) { const w = portWorld(Q); v = [w.x, w.y, w.z]; } else if (b) { const tp = b.kind === 'plug' ? plugTip(b) : { x: b.x, y: b.y, z: b.z }; v = [b.kind === 'plug' ? b.x : tp.x, b.y + 4, b.kind === 'plug' ? b.z : tp.z]; } else return null;
      project(v[0], v[1], v[2], pj); const r = canvas.getBoundingClientRect(); return { x: r.left + pj.x, y: r.top + pj.y, behind: pj.z >= 1 };
    },
    state() { const o = {}; for (const id in bodies) { const b = bodies[id]; o[id] = { x: +b.x.toFixed(1), z: +b.z.toFixed(1), y: +b.y.toFixed(1), yaw: +b.yaw.toFixed(2), state: b.state, port: b.port ? b.port.id : null, tens: +b.tensEma.toFixed(2) }; } return o; },
    circuit: () => circuit(), log: () => evlog.slice(), perf: () => ({ who: dbgWho, moves: ropes.map((r) => { let m = 0, wi = 0; for (let i = 0; i < r.P.length; i++) { const d = Math.abs(r.P[i] - r.Q[i]); if (d > m) { m = d; wi = i; } } return r.id + ':' + m.toFixed(3) + '@' + Math.floor(wi / 3) + '/' + r.n + ' y' + r.P[3 * Math.floor(wi / 3) + 1].toFixed(1); }), physActive, settle, maxMove: world ? +world.maxMove.toFixed(4) : 0, needRender, motion: motionNow(), lcdBlink, cpuMs: +cpuMs.toFixed(2), calls: GL.renderer.info.render.calls, tris: GL.renderer.info.render.triangles }),
    dispose() {
      if (st.disposed) return; st.disposed = true; cancelAnimationFrame(raf); clearTimeout(scrollT); clearTimeout(blinkT); clearTimeout(panelsT); autoToken++;
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', keyDown); document.removeEventListener('keyup', keyUp);
      window.removeEventListener('sac-theme', applyTheme); offs.forEach((f) => f());
      controls.dispose();
      scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      (disposables.tex || []).forEach((t) => t.dispose()); if (tableTex) tableTex.dispose();
      if (sctx) sctx.geos.forEach((g) => g.dispose());
      root.remove();
    },
  };
  api.built = built; api.isReady = () => st.ready;
  return api;
}

SAC.bench = { mount };
