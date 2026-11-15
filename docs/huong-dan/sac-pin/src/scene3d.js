/* Lane 3D/2D — cảnh 3D (three.js) cho trang hướng dẫn sạc B6AC V2.
   window.SAC.view3d(el, {scene:'hero'|'charger'|'battery'|'wiring', view, hotspots, onPick}) -> {setView, highlight, dispose}

   Kích thước lấy từ SAC.dims (diag-a-util.js) để khớp sơ đồ 2D. Đơn vị: mm.
   Hệ thế giới: x phải (cạnh phải = cổng ra + ổ cân bằng), y lên, z về phía người dùng (mặt trước = nút bấm).
   Đổi từ toạ độ máy: x_w = x - 72 ; z_w = 67.5 - d ; y_w = y.

   ƯỚC LƯỢNG (chưa đo máy thật, đã ghi trên trang bằng badge .est ở nơi dùng số này):
   - độ cao hai tầng, vị trí nút / LCD / dải chữ, cánh tản nhiệt, 5 vít mỗi đầu (đo từ ảnh Pololu 0J6154/0J6155)
   - pin Ovonic 4S 5300 mAh ~155 x 43 x 35 mm (hãng chưa công bố; Tattu 140x41x42, ZOP 139x46x50)
   - chiều dài dây, cỡ dây (12 AWG), màu dây cân bằng (đen + 4 đỏ), kích thước giắc T-plug (Deans)
   ĐO/THEO MODEL: XT60 đực/cái, ổ JST-XH 5 chân là model KiCad (kicad-packages3D, CC-BY-SA 4.0) đổi sang GLB. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './bench3d.js';   // cảnh 'bench' (SAC.bench.mount) nằm ở file riêng, dùng lại các hàm dựng xuất ở cuối file này

const T = THREE;
const FOV = 28;
const VIEW_LABEL = { front: 'Trước', top: 'Trên', left: 'Trái', right: 'Phải', back: 'Sau', bottom: 'Dưới', iso: '3/4' };
const VIEW_DIR = {
  front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
  top: [0, 1, 0.0008], bottom: [0, -1, 0.0008], iso: [0.9, 0.8, 1.15],
};
const HERO_TAGS = ['lcd', 'out-pos', 'bal-4s', 'batt', 'batt-xt60'];
const TAGS = {
  charger: ['lcd', 'btn-batt', 'btn-enter', 'out-neg', 'out-pos', 'bal-4s', 'ac-inlet', 'dc-jack', 'usb-pclink', 'temp-port', 'heatsink'],
  battery: ['batt', 'batt-label', 'batt-xt60', 'batt-balance'],
  wiring: ['out-pos', 'bal-4s', 'cable-banana-t', 'adapter-t-xt60', 'batt-xt60', 'batt-balance', 'batt'],
  hero: HERO_TAGS,
};
const PART_LABEL = {
  lcd: 'Màn hình', 'btn-batt': 'BATT/PROG', 'btn-dec': 'DEC', 'btn-inc': 'INC', 'btn-enter': 'ENTER',
  'out-pos': 'Cổng ra +', 'out-neg': 'Cổng ra −', 'bal-4s': 'Cân bằng 4S', 'bal-2s': '2S', 'bal-3s': '3S', 'bal-5s': '5S', 'bal-6s': '6S',
  'ac-inlet': 'Nguồn AC', 'dc-jack': 'DC 11–18 V', 'usb-pclink': 'PC LINK', 'temp-port': 'Cảm biến nhiệt', heatsink: 'Tản nhiệt',
  feet: 'Chân đế', 'label-bottom': 'Nhãn đáy', batt: 'Pin 4S', 'batt-label': 'Nhãn pin', 'batt-xt60': 'XT60 của pin',
  'batt-balance': 'Dây cân bằng', 'cable-banana-t': 'Dây bắp chuối → T', 'adapter-t-xt60': 'Dây T → XT60',
};

function dims() {
  const k = window.SAC && window.SAC.dims;
  if (!k) throw new Error('[SAC 3D] thieu SAC.dims: diag-a-util.js phai nap truoc scene3d');
  return k;
}
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

const mark = (n) => { const S = (window.SAC = window.SAC || {}); (S.marks = S.marks || []).push([n, Math.round(performance.now())]); };
/* ---------------- model GLB (base64 trong window.SAC_MODELS) ---------------- */
const MODEL_NAMES = ['xt60-m', 'xt60-f', 'xh-b5b'];
let modelsPromise = null;
function loadModels() {
  if (modelsPromise) return modelsPromise;
  mark('glb:start');
  const src = window.SAC_MODELS || {};
  const loader = new GLTFLoader();
  modelsPromise = Promise.all(MODEL_NAMES.map((name) => new Promise((resolve) => {
    const b64 = src[name];
    if (!b64) { console.warn('[SAC 3D] thieu model ' + name + ', dung hinh khoi thay the'); resolve(null); return; }
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    loader.parse(u8.buffer, '', (gltf) => {
      gltf.scene.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; });
      resolve(gltf.scene);
    }, (err) => { console.warn('[SAC 3D] model ' + name + ' loi: ' + (err && err.message), err); resolve(null); });
  }))).then((arr) => { mark('glb:done'); return Object.fromEntries(MODEL_NAMES.map((n, i) => [n, arr[i]])); });
  return modelsPromise;
}

/* ---------------- canvas texture (dùng chung giữa các cảnh, không dispose) ---------------- */
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.shared = true;
  texCache.set(key, t);
  return t;
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

/* ---------------- vật liệu (mỗi cảnh tạo bộ riêng) ---------------- */
function makeMats() {
  const std = (o) => new T.MeshStandardMaterial(o);
  return {
    blue: new T.MeshPhysicalMaterial({ color: 0x1c5fcf, metalness: 0.7, roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.45 }),
    black: std({ color: 0x15171b, roughness: 0.5, metalness: 0.1 }),
    white: std({ color: 0xf1efe6, roughness: 0.5, side: T.DoubleSide }),
    gold: std({ color: 0xd9a63b, metalness: 1, roughness: 0.28 }),
    silver: std({ color: 0xc9ced6, metalness: 1, roughness: 0.26 }),
    rubber: std({ color: 0x101012, roughness: 0.92 }),
    btn: new T.MeshPhysicalMaterial({ color: 0xe6e8ec, metalness: 0.3, roughness: 0.3, clearcoat: 0.6 }),
    screw: std({ color: 0x3a3e45, metalness: 0.8, roughness: 0.35 }),
    red: std({ color: 0xc8202a, roughness: 0.4 }),
    cableRed: new T.MeshPhysicalMaterial({ color: 0xc8202a, roughness: 0.45, clearcoat: 0.3 }),
    cableBlack: new T.MeshPhysicalMaterial({ color: 0x1a1a1c, roughness: 0.45, clearcoat: 0.3 }),
    xt60: std({ color: 0xf0bf12, roughness: 0.45 }),
    pack: std({ color: 0x14181f, roughness: 0.55, metalness: 0.05 }),
    dark: std({ color: 0x07080a, roughness: 0.7 }),
  };
}

/* ---------------- hình học tiện ích ---------------- */
function roundedShape(pts) {
  const s = new T.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[(i + n - 1) % n], c = pts[i], q = pts[(i + 1) % n];
    const v1 = new T.Vector2(p[0] - c[0], p[1] - c[1]), v2 = new T.Vector2(q[0] - c[0], q[1] - c[1]);
    const l1 = v1.length(), l2 = v2.length();
    v1.normalize(); v2.normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
    const t = Math.min(c[2] / Math.tan(ang / 2), l1 / 2, l2 / 2);
    const a = [c[0] + v1.x * t, c[1] + v1.y * t], b = [c[0] + v2.x * t, c[1] + v2.y * t];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
function rectShape(w, h, r) {
  const s = new T.Shape();
  s.moveTo(r, 0); s.lineTo(w - r, 0); s.quadraticCurveTo(w, 0, w, r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(r, h); s.quadraticCurveTo(0, h, 0, h - r); s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
  return s;
}
function rectHole(w, h, x0, y0, r) { const p = rectShape(w, h, r); const path = new T.Path(p.getPoints(8).reverse().map((v) => new T.Vector2(v.x + x0, v.y + y0))); return path; }

/* ---------------- ngữ cảnh dựng cảnh ---------------- */
class Ctx {
  constructor(models) {
    this.k = dims();
    this.m = makeMats();
    this.models = models;
    this.parts = new Map();   // partId -> Mesh[]
    this.anchors = [];        // {part,label,pos,normal}
    this.geos = [];
  }
  geo(g) { this.geos.push(g); return g; }
  mesh(g, mat, parent, x = 0, y = 0, z = 0) { const m = new T.Mesh(this.geo(g), mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
  reg(part, obj) {
    const list = this.parts.get(part) || [];
    obj.traverse((o) => { if (o.isMesh) { o.userData.part = part; list.push(o); } });
    this.parts.set(part, list);
  }
  decal(tex, w, h, parent, pos, rot, order = 1) {
    const mat = new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 * order, polygonOffsetUnits: -2 * order });
    const m = new T.Mesh(this.geo(new T.PlaneGeometry(w, h)), mat);
    m.position.set(...pos); m.rotation.set(...rot); m.userData.decal = true; parent.add(m);
    return m;
  }
  anchor(part, pos, normal, label, off) { this.anchors.push({ part, pos: new T.Vector3(...pos), normal: new T.Vector3(...normal).normalize(), label: label || PART_LABEL[part] || part, off: off || [0, 0] }); }
}

/* ================= MÁY SẠC ================= */
function lcdTexture(l1, l2) {
  return canvasTex('lcd:' + l1 + '|' + l2, 1024, 310, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f78e6'); grad.addColorStop(1, '#1f55b8');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const cw = w / 16, ch = h / 2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 16; c++) {
      g.fillStyle = 'rgba(8,30,90,.22)'; g.fillRect(c * cw + 5, r * ch + 14, cw - 10, ch - 28);
    }
    g.fillStyle = '#eaf4ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(ch * 0.62)}px Consolas, "Cascadia Mono", "Courier New", monospace`;
    [l1, l2].forEach((line, r) => [...line.padEnd(16).slice(0, 16)].forEach((chr, c) => { if (chr !== ' ') g.fillText(chr, c * cw + cw / 2, r * ch + ch / 2 + 2); }));
    const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
}

function frontTierTex(k) {
  const S = 14;
  return canvasTex('front-tier', k.W * S, k.STEP0 * S, (g, w, h) => {
    const X = (x) => x * S, Y = (d) => (k.STEP0 - d) * S;
    g.fillStyle = 'rgba(255,255,255,.93)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    // Chú thích nút: HAI dòng. Dòng trên (xa nút hơn): BATT/PROG, DEC., INC., ENTER. Dòng dưới (sát nút): Stop, ◄ Status ►, Start.
    // ◄ nằm ngay trên nút DEC, ► ngay trên nút INC, chữ Status ở giữa hai nút đó (ảnh bìa manual).
    const bx = k.BTN.x, L1 = 24.6, L2 = 21.0;
    g.font = `bold ${2.6 * S}px Arial, sans-serif`;
    ['BATT/PROG', 'DEC.', 'INC.', 'ENTER'].forEach((t, i) => g.fillText(t, X(bx[i]), Y(L1)));
    g.font = `${2.4 * S}px Arial, sans-serif`;
    g.fillText('Stop', X(bx[0]), Y(L2)); g.fillText('Start', X(bx[3]), Y(L2));
    g.fillText('◄', X(bx[1]), Y(L2)); g.fillText('►', X(bx[2]), Y(L2)); g.fillText('Status', X((bx[1] + bx[2]) / 2), Y(L2));
    // dải nhãn chế độ: 3 cột x 2 hàng
    const cols = [[['LiPo/LiFe/LiIon/LiHV', '1-6S'], ['Circuit Power', '50W']], [['NiMH/NiCd', '1-15S'], ['Charge', '0.1-6.0A']], [['Pb(Lead Acid)', '2-20V'], ['Discharge', '0.1-2.0A']]];
    const cw = (k.STRIP.x1 - k.STRIP.x0) / 3, rowH = 4;
    cols.forEach((col, ci) => col.forEach((cell, ri) => {
      const x0 = k.STRIP.x0 + ci * cw + 0.5, d0 = k.STRIP.d0 + (1 - ri) * (rowH + 0.8), vw = 9.5;
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.35 * S; rr(g, X(x0), Y(d0 + rowH), (cw - 1) * S, rowH * S, 0.9 * S); g.stroke();
      g.fillStyle = '#0a0f1a'; rr(g, X(x0 + cw - 1 - vw), Y(d0 + rowH), vw * S, rowH * S, 0.9 * S); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `bold ${2.1 * S}px Arial, sans-serif`; g.textAlign = 'left';
      g.fillText(cell[0], X(x0 + 1), Y(d0 + rowH / 2)); g.textAlign = 'center';
      g.fillText(cell[1], X(x0 + cw - 1 - vw / 2), Y(d0 + rowH / 2));
    }));
    // cạnh phải: OUTPUT và Balance Socket, chữ đọc dọc theo mép (từ trước ra sau)
    g.save(); g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'center';
    const along = (txt, x, d, size, bold) => { g.save(); g.translate(X(x), Y(d)); g.rotate(-Math.PI / 2); g.font = `${bold ? 'bold ' : ''}${size * S}px Arial, sans-serif`; g.fillText(txt, 0, 0); g.restore(); };
    along('OUTPUT', 139, 8.5, 2.6, true);
    // ⊟ (−) ở chuối phía trước, ⊞ (+) ở chuối phía sau: ô vuông bo tròn trắng, dấu tối
    [[k.BAN.neg.d, '−'], [k.BAN.pos.d, '+']].forEach(([d, t]) => {
      g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, X(133.5 - 1.6), Y(d + 1.6), 3.2 * S, 3.2 * S, 0.7 * S); g.fill();
      g.fillStyle = '#17306b'; g.fillRect(X(133.5 - 1.0), Y(d + 0.25), 2.0 * S, 0.5 * S); if (t === '+') g.fillRect(X(133.5 - 0.25), Y(d + 1.0), 0.5 * S, 2.0 * S);
      g.fillStyle = 'rgba(255,255,255,.92)';
    });
    // Bảng "Balance Socket": tiêu đề, hàng 1 (4/3/2 cells), hàng 2 (6/5 cells). ⊕ đầu trước, ⊖ đầu sau.
    {
      const T2 = window.SAC.balTable(), rowX = [[131.2, 134.7], [134.7, 138.2]], titleX = 128.4;
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.28 * S; g.fillStyle = 'rgba(255,255,255,.95)';
      along(T2.title, titleX, (T2.d0 + T2.d1) / 2, 2.5, true);
      T2.rows.forEach((row, ri) => {
        const [xa, xb] = rowX[ri];
        row.forEach((c) => {
          g.strokeRect(X(xa), Y(c.d1), (xb - xa) * S, (c.d1 - c.d0) * S);
          along(c.text, (xa + xb) / 2, (c.d0 + c.d1) / 2, 2.0, true);
        });
      });
      const sym = (t, d) => {
        g.beginPath(); g.arc(X(134.7), Y(d), 1.5 * S, 0, 7); g.stroke();
        g.fillRect(X(134.7 - 0.9), Y(d) - 0.25 * S, 1.8 * S, 0.5 * S); if (t === '+') g.fillRect(X(134.7) - 0.25 * S, Y(d) - 0.9 * S, 0.5 * S, 1.8 * S);
      };
      sym('+', T2.d0 - 3.4); sym('-', T2.d1 + 3.4);
    }
    g.restore();
  });
}
function rearTierTex(k) {
  const S = 14, H = k.BODY_D - k.STEP1;
  return canvasTex('rear-tier', k.W * S, H * S, (g, w, h) => {
    const X = (x) => x * S, Y = (d) => (129 - d) * S;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `italic 900 ${10 * S}px Arial, sans-serif`; g.fillStyle = '#e8262d'; g.fillText('iMAX', X(18), Y(112));
    const iw = g.measureText('iMAX').width;
    g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `italic 800 ${8 * S}px Arial, sans-serif`; g.fillText('B6AC', X(18) + iw + 1.5 * S, Y(112.5));
    const bw = g.measureText('B6AC').width; g.font = `italic 700 ${4.4 * S}px Arial, sans-serif`; g.fillText('V2', X(18) + iw + bw + 3 * S, Y(114));
    g.font = `italic 700 ${4.4 * S}px Arial, sans-serif`; g.fillText('AC/DC Dual Power', X(18), Y(101));
    g.fillText('Professional Balance Charger/Discharger', X(18), Y(94.5));
    g.textAlign = 'right'; g.font = `italic 900 ${7 * S}px Arial, sans-serif`; g.fillStyle = 'rgba(255,255,255,.96)'; g.fillText('SKYRC', X(136), Y(112));
  });
}
function frontGrooveTex(k) {
  const S = 12;
  return canvasTex('front-grooves', k.W * S, 25 * S, (g, w, h) => {
    for (let y = 1.2; y < 24.6; y += 1.3) {
      const py = y * S;
      g.fillStyle = 'rgba(6,24,80,.5)'; g.fillRect(0, py, w, 0.42 * S);
      g.fillStyle = 'rgba(255,255,255,.17)'; g.fillRect(0, py + 0.42 * S, w, 0.2 * S);
    }
  });
}
function leftFaceTex(k) {
  const S = 12, Hh = 40, L = k.LEFT;
  return canvasTex('left-face', k.D * S, Hh * S, (g, w, h) => {
    const X = (d) => (k.D - d) * S, Y = (y) => (Hh - y) * S;
    // khe gió
    const slot = (d, y0, y1) => {
      const x = X(d) - (L.ventW / 2) * S, y = Y(y1), hh = (y1 - y0) * S;
      const gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, '#05070c'); gr.addColorStop(0.7, '#0a0d14'); gr.addColorStop(1, '#6b3a14');
      g.fillStyle = gr; rr(g, x, y, L.ventW * S, hh, (L.ventW / 2) * S); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.3 * S; g.stroke();
    };
    L.ventTall.forEach((d) => slot(d, L.ventY0, L.ventY1));
    L.ventShort.forEach((d) => slot(d, L.ventShortY0, L.ventY1));
    // nhãn CAUTION
    const c = L.caution, cx = X(c.d1), cy = Y(c.y1), cwid = (c.d1 - c.d0) * S, chei = (c.y1 - c.y0) * S;
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 0.35 * S; g.strokeRect(cx, cy, cwid, chei);
    g.fillStyle = '#e03030'; g.beginPath(); g.moveTo(cx + 3.6 * S, cy + 2.2 * S); g.lineTo(cx + 6.4 * S, cy + 7 * S); g.lineTo(cx + 0.8 * S, cy + 7 * S); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = `bold ${2.2 * S}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', cx + 3.6 * S, cy + 5.6 * S);
    g.textAlign = 'left'; g.font = `bold ${2.6 * S}px Arial`; g.fillText('CAUTION', cx + 8 * S, cy + 3 * S);
    g.font = `bold ${1.5 * S}px Arial`; g.fillText('RISK OF', cx + 8 * S, cy + 5.4 * S); g.fillText('ELECTRIC SHOCK', cx + 8 * S, cy + 7.1 * S); g.fillText('DO NOT OPEN', cx + 8 * S, cy + 8.8 * S);
    // chữ dưới cổng
    g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.95)';
    g.font = `bold ${2.4 * S}px Arial`; g.fillText('AC IN~ 100-240V', X((L.ac.d0 + L.ac.d1) / 2), Y(9.2)); g.fillText('50/60Hz', X((L.ac.d0 + L.ac.d1) / 2), Y(6.2));
    g.fillText('DC IN 11-18V', X(63), Y(7.6));
    g.fillText('PC LINK', X((L.usb.d0 + L.usb.d1) / 2), Y(8.7));
    // ký hiệu cực DC: ⊖─●─⊕ (tâm âm, vỏ dương theo manual) và nhiệt kế
    const dy = Y(10.6), dx = X(63);
    g.strokeStyle = '#fff'; g.lineWidth = 0.3 * S;
    [[-5.4, '−'], [0, ''], [5.4, '+']].forEach(([o, t]) => { g.beginPath(); g.arc(dx + o * S, dy, 1.1 * S, 0, 7); if (o === 0) { g.fillStyle = '#fff'; g.fill(); } else g.stroke(); if (t) { g.font = `bold ${1.6 * S}px Arial`; g.fillStyle = '#fff'; g.fillText(t, dx + o * S, dy + 0.1 * S); } });
    g.beginPath(); g.moveTo(dx - 4.2 * S, dy); g.lineTo(dx - 1.2 * S, dy); g.moveTo(dx + 1.2 * S, dy); g.lineTo(dx + 4.2 * S, dy); g.stroke();
    const tx = X(29.5), ty = Y(8);
    g.strokeStyle = '#fff'; g.lineWidth = 0.35 * S; g.fillStyle = '#e03030'; rr(g, tx - 0.7 * S, ty - 3.4 * S, 1.4 * S, 4.6 * S, 0.7 * S); g.stroke();
    g.beginPath(); g.arc(tx, ty + 1.4 * S, 1.3 * S, 0, 7); g.fill(); g.stroke(); g.font = `bold ${1.9 * S}px Arial`; g.fillStyle = '#fff'; g.fillText('°C', tx + 3 * S, ty - 2.4 * S);
  });
}
function bottomLabelTex() {
  return canvasTex('bottom-label', 960, 580, (g, w, h) => {
    g.fillStyle = '#eceef1'; rr(g, 0, 0, w, h, 24); g.fill();
    g.fillStyle = '#15171b'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = 'bold 56px Arial'; g.fillText('SKYRC  iMAX B6AC V2', 50, 80);
    g.font = '34px Arial';
    ['AC 100-240 V  50/60 Hz   ·   DC 11-18 V', 'Charge 0.1-6.0 A   ·   Circuit Power 50 W', 'Discharge 0.1-2.0 A   ·   5 W', 'LiPo/LiFe/LiIon/LiHV 1-6S  ·  NiMH/NiCd 1-15S']
      .forEach((s, i) => g.fillText(s, 50, 170 + i * 56));
    const gr = g.createLinearGradient(640, 330, 900, 540);
    ['#ff6bd6', '#6bd6ff', '#fff36b', '#8aff7a', '#ff6bd6'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    g.fillStyle = gr; rr(g, 650, 340, 250, 200, 14); g.fill();
    g.fillStyle = 'rgba(0,0,0,.55)'; g.font = '28px Arial'; g.fillText('Nhãn minh hoạ', 50, 520);
  });
}

function makeHeader(ctx, n, glbOk) {
  const k = ctx.k, w = k.BAL_PITCH * (n - 1) + k.BAL_MARGIN, h = k.BAL_H, g = new T.Group();
  const ring = rectShape(w, h, 0.5); ring.holes.push(rectHole(w - 1.6, h - 1.6, 0.8, 0.8, 0.3));
  const wall = new T.Mesh(ctx.geo(new T.ExtrudeGeometry(ring, { depth: 5, bevelEnabled: false })), ctx.m.white); wall.position.z = 2; g.add(wall);
  ctx.mesh(new T.BoxGeometry(w, h, 2).translate(w / 2, h / 2, 1), ctx.m.white, g);
  for (let i = 0; i < n; i++) ctx.mesh(new T.BoxGeometry(0.64, 0.64, 3.8).translate(k.BAL_MARGIN / 2 + i * k.BAL_PITCH, h / 2, 3.9), ctx.m.gold, g);
  return g;
}
function xtModel(ctx, name, mat) {
  const src = ctx.models[name];
  if (!src) { // dự phòng có log: khối hộp đúng kích thước XT60 15,9 x 8,1 x 16
    const g = new T.Group();
    ctx.mesh(new T.BoxGeometry(15.9, 16, 8.1).translate(3.6, 8, 0), mat.xt60, g);
    [0, 7.2].forEach((x) => ctx.mesh(new T.CylinderGeometry(2.1, 2.1, 12).translate(x, 6, 0), mat.gold, g));
    return g;
  }
  const g = src.clone(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const nm = o.material && o.material.name;
    o.material = nm === 'e7c863' ? mat.gold : mat.xt60;
  });
  return g;
}
function xhModel(ctx) {
  const src = ctx.models['xh-b5b'];
  if (!src) return null;
  const g = src.clone(true);
  g.traverse((o) => { if (o.isMesh) o.material = ctx.m.white; });
  return g;
}
function basisGroup(child, xAxis, yAxis, zAxis, pos) {
  const holder = new T.Group();
  holder.matrixAutoUpdate = false;
  holder.matrix.makeBasis(new T.Vector3(...xAxis), new T.Vector3(...yAxis), new T.Vector3(...zAxis)).setPosition(...pos);
  holder.add(child);
  return holder;
}

function buildCharger(ctx) {
  const k = ctx.k, m = ctx.m, g = new T.Group();
  g.name = 'charger';
  const hw = k.W / 2, hd = k.D / 2;
  const X = (x) => x - hw, Zd = (d) => hd - d;

  // --- thân nhôm: biên dạng cạnh (z-y) đùn dọc x, bo + vát ---
  const bt = 0.8;
  const u0 = -hd + bt, u1 = k.BODY_D - hd - bt;
  const shape = roundedShape([
    [u0, k.BODY_BOT + bt, 1.2], [u1, k.BODY_BOT + bt, 1.6], [u1, k.REAR_TOP - bt, 1.6],
    [k.STEP1 - hd, k.REAR_TOP - bt, 1.4], [k.STEP0 - hd, k.FRONT_TOP - bt, 1.4], [u0, k.FRONT_TOP - bt, 1.6]]);
  // ô khoét ở tấm đầu phải cho khối ổ cân bằng (sâu 8 mm): lỗ xuyên thân + khối chèn lấp phần còn lại
  const POCKET = { d0: 33.6, d1: 73.7, y0: 12.3, y1: 26.1, deep: 8 };
  shape.holes.push(new T.Path([[POCKET.d0, POCKET.y0], [POCKET.d1, POCKET.y0], [POCKET.d1, POCKET.y1], [POCKET.d0, POCKET.y1]].map(([d, y]) => new T.Vector2(d - hd, y))));
  const depth = k.W - 2 * bt;
  const bodyGeo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 6 });
  bodyGeo.rotateY(Math.PI / 2); bodyGeo.translate(-(depth / 2), 0, 0);
  ctx.mesh(bodyGeo, m.blue, g).name = 'body';
  const pw = POCKET.d1 - POCKET.d0, ph = POCKET.y1 - POCKET.y0, pz = Zd((POCKET.d0 + POCKET.d1) / 2), py0 = (POCKET.y0 + POCKET.y1) / 2;
  ctx.mesh(new T.BoxGeometry(k.W - POCKET.deep, ph, pw), m.blue, g, -POCKET.deep / 2, py0, pz);                  // khối chèn
  ctx.mesh(new T.BoxGeometry(0.1, ph + 2.4, pw + 2.4), m.blue, g, -hw - 0.02, py0, pz);                        // che vát mép lỗ ở đầu trái
  ctx.mesh(new T.BoxGeometry(0.1, ph - 0.4, pw - 0.4), m.dark, g, hw - POCKET.deep + 0.06, py0, pz);           // đáy ô tối

  // --- cánh tản nhiệt phía sau ---
  const fins = new T.Group();
  k.FINS_Y.forEach((y) => ctx.mesh(new RoundedBoxGeometry(k.W - 2, k.FIN_T, k.FIN + 0.6, 2, 0.4), m.blue, fins, 0, y, Zd(k.BODY_D) - (k.FIN - 0.6) / 2));
  g.add(fins); ctx.reg('heatsink', fins);

  // --- chân đế ---
  const feet = new T.Group();
  k.FEET.x.forEach((fx) => k.FEET.d.forEach((fd) => ctx.mesh(new RoundedBoxGeometry(k.FEET.w, k.FOOT, k.FEET.l, 2, 0.8), m.rubber, feet, X(fx), k.FOOT / 2, Zd(fd))));
  g.add(feet); ctx.reg('feet', feet);

  // --- decal in: mặt trước (khía), tầng trước, tầng sau, nhãn đáy ---
  ctx.decal(frontGrooveTex(k), k.W, 25, g, [0, (k.BODY_BOT + k.FRONT_TOP) / 2, hd + 0.04], [0, 0, 0], 1);
  ctx.decal(frontTierTex(k), k.W, k.STEP0, g, [0, k.FRONT_TOP + 0.05, hd - k.STEP0 / 2], [-Math.PI / 2, 0, 0], 1);
  const rearLen = k.BODY_D - k.STEP1;
  ctx.decal(rearTierTex(k), k.W, rearLen, g, [0, k.REAR_TOP + 0.05, hd - k.STEP1 - rearLen / 2], [-Math.PI / 2, 0, 0], 1);
  ctx.decal(leftFaceTex(k), k.D, 40, g, [-hw - 0.12, 20, 0], [0, -Math.PI / 2, 0], 1);
  const lab = ctx.decal(bottomLabelTex(), 96, 58, g, [0, k.BODY_BOT - 0.05, -4], [Math.PI / 2, 0, 0], 1);
  lab.userData.decal = false; ctx.reg('label-bottom', lab);

  // --- nút bấm ---
  const dome = [[4.5, 0], [4.5, 0.5], [4.3, 1.2], [3.8, 2.0], [2.4, 2.35], [0, 2.4]].map(([r, y]) => new T.Vector2(r, y));
  k.BTN.x.forEach((bx, i) => {
    const b = new T.Group(); b.position.set(X(bx), k.FRONT_TOP, Zd(k.BTN.d));
    ctx.mesh(new T.CylinderGeometry(5.3, 5.3, 0.7, 28).translate(0, 0.3, 0), m.black, b);
    ctx.mesh(new T.LatheGeometry(dome, 28), m.btn, b, 0, 0.5, 0);
    g.add(b); ctx.reg(k.BTN.ids[i], b);
    (g.userData.btns = g.userData.btns || {})[k.BTN.ids[i]] = b;
    ctx.anchor(k.BTN.ids[i], [X(bx), k.FRONT_TOP + 3.5, Zd(k.BTN.d)], [0, 1, 0]);
  });

  // --- LCD ---
  const L = k.LCD, lw = L.x1 - L.x0, ld = L.d1 - L.d0, lcx = X((L.x0 + L.x1) / 2), lcz = Zd((L.d0 + L.d1) / 2);
  const lcd = new T.Group();
  ctx.mesh(new RoundedBoxGeometry(lw + 2 * L.frame, 0.9, ld + 2 * L.frame, 2, 0.4), m.black, lcd, lcx, k.FRONT_TOP + 0.25, lcz);
  const glass = new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: lcdTexture('LiPo BALANCE CHG', '3.0A 14.8V(4S)'), emissiveIntensity: 0.8, roughness: 0.25, metalness: 0 });
  const gm = ctx.mesh(new T.PlaneGeometry(lw, ld), glass, lcd, lcx, k.FRONT_TOP + 0.72, lcz); gm.rotation.x = -Math.PI / 2;
  const tab = canvasTex('display-tab', 256, 64, (c, w, h) => { c.fillStyle = '#0a0f1a'; rr(c, 0, 0, w, h, 10); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; rr(c, 3, 3, w - 6, h - 6, 8); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DISPLAY', w / 2, h / 2 + 2); });
  const tm = ctx.decal(tab, 12, 3, lcd, [X(L.x1 - 8), k.FRONT_TOP + 0.76, Zd(L.d0 - 1.6)], [-Math.PI / 2, 0, 0], 2); tm.userData.decal = false;
  g.userData.lcdGlass = gm; g.userData.lcdMat = glass;
  g.add(lcd); ctx.reg('lcd', lcd);
  ctx.anchor('lcd', [lcx, k.FRONT_TOP + 1, Zd(L.d1 + 3)], [0, 1, 0]);

  // --- 5 vít mỗi tấm đầu (vít đầu tròn, rãnh chữ thập) ---
  const screwProfile = [[2.4, 0], [2.25, 0.7], [1.6, 1.0], [0, 1.0]].map(([r, y]) => new T.Vector2(r, y));
  const screwGeo = ctx.geo(new T.LatheGeometry(screwProfile, 16)), slotGeo = ctx.geo(new T.BoxGeometry(3, 0.3, 0.55)), slotGeo2 = ctx.geo(new T.BoxGeometry(0.55, 0.3, 3));
  [1, -1].forEach((side) => k.SCREWS.forEach(([sd, sy]) => {
    const s = new T.Group(); s.position.set(side * hw, sy, Zd(sd)); s.rotation.z = -side * Math.PI / 2;
    s.add(new T.Mesh(screwGeo, m.screw));
    [slotGeo, slotGeo2].forEach((sg) => { const sl = new T.Mesh(sg, m.dark); sl.position.y = 0.98; s.add(sl); });
    g.add(s);
  }));

  // ===== cạnh phải: 2 bắp chuối + lỗ nhỏ + 5 ổ cân bằng =====
  [['out-neg', k.BAN.neg, 0x17181b], ['out-pos', k.BAN.pos, 0xc8202a]].forEach(([id, p, col]) => {
    const b = new T.Group(); b.position.set(hw, p.y, Zd(p.d)); b.rotation.z = -Math.PI / 2;
    const plastic = new T.MeshStandardMaterial({ color: col, roughness: 0.4, side: T.DoubleSide });
    const collar = [[5.3, -1.5], [5.3, 0.7], [4.8, 0.95], [3.7, 0.95], [3.7, -1.5]].map(([r, y]) => new T.Vector2(r, y));
    ctx.mesh(new T.LatheGeometry(collar, 32), plastic, b);
    const sock = [[2.05, -1.5], [2.05, 0.35], [3.7, 0.35]].map(([r, y]) => new T.Vector2(r, y));
    ctx.mesh(new T.LatheGeometry(sock, 24), new T.MeshStandardMaterial({ color: 0xd9a63b, metalness: 1, roughness: 0.3, side: T.DoubleSide }), b);
    ctx.mesh(new T.CircleGeometry(2.05, 20).rotateX(-Math.PI / 2), m.dark, b, 0, -1.4, 0);
    g.add(b); ctx.reg(id, b);
    ctx.anchor(id, [hw + 1, p.y, Zd(p.d)], [1, 0, 0], null, id === 'out-neg' ? [-22, 18] : [10, 26]);
  });
  { // lỗ tròn nhỏ (công dụng chưa xác minh) — chỉ là vết lõm tối, không gắn bộ phận
    const h = ctx.mesh(new T.CylinderGeometry(k.HOLE.r, k.HOLE.r, 0.5, 20).rotateZ(-Math.PI / 2), m.dark, g, hw + 0.05, k.HOLE.y, Zd(k.HOLE.d));
    h.userData.decal = true;
  }
  k.BAL.forEach((s) => {
    const w = k.BAL_PITCH * (s.n - 1) + k.BAL_MARGIN;
    let hdr = null;
    if (s.id === 'bal-4s') {
      const glb = xhModel(ctx);
      if (glb) { // pin 1 ở x=0, mở lên +y, dày theo z (-2,35..+3,4) → mở ra +x, hàng chân chạy về phía sau (-z)
        hdr = basisGroup(glb, [0, 0, -1], [1, 0, 0], [0, -1, 0], [hw - 7.8, s.y0 + k.BAL_H / 2 + 0.5, Zd(s.d0 + k.BAL_MARGIN / 2)]);
      }
    }
    if (!hdr) { hdr = makeHeader(ctx, s.n); hdr.rotation.y = Math.PI / 2; hdr.position.set(hw - 7.8, s.y0, Zd(s.d0)); }
    if (k.BAL_NEG_BACK) {     // chân 1 (đen, ⊖) về phía SAU: lật ổ 180° quanh trục x qua tâm ổ
      const piv = new T.Vector3(hw - 4, s.y0 + k.BAL_H / 2, Zd(s.d0 + w / 2)), wrap = new T.Group();
      wrap.matrixAutoUpdate = false;
      wrap.matrix.makeTranslation(piv.x, piv.y, piv.z).multiply(new T.Matrix4().makeRotationX(Math.PI)).multiply(new T.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z));
      wrap.add(hdr); g.add(wrap);
    } else g.add(hdr);
    ctx.reg(s.id, hdr);
    ctx.anchor(s.id, [hw + 1, s.y0 + k.BAL_H / 2, Zd(s.d0 + w / 2)], [1, 0, 0], null, [14, -16]);
  });

  // ===== cạnh trái: AC C6, DC, USB, cổng nhiệt =====
  const LF = k.LEFT;
  const leftPort = (id, box, depthMm, wallW, build) => {
    const w = box.d1 - box.d0, h = box.y1 - box.y0, grp = new T.Group();
    grp.position.set(-hw - 0.3, box.y0, Zd(box.d1)); grp.rotation.y = -Math.PI / 2;
    build(grp, w, h);
    g.add(grp); ctx.reg(id, grp);
    ctx.anchor(id, [-hw - 1, (box.y0 + box.y1) / 2, Zd((box.d0 + box.d1) / 2)], [-1, 0, 0]);
  };
  leftPort('ac-inlet', LF.ac, 3, 1.6, (grp, w, h) => {
    const s = rectShape(w, h, 1.2); s.holes.push(rectHole(w - 3, h - 3, 1.5, 1.5, 1));
    ctx.mesh(new T.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }), m.black, grp);
    ctx.mesh(new T.BoxGeometry(w - 3, h - 3, 0.2).translate(w / 2, h / 2, 0.1), m.dark, grp);
    [[w / 2, h * 0.72], [w * 0.3, h * 0.38], [w * 0.7, h * 0.38]].forEach(([px, py]) => ctx.mesh(new T.CylinderGeometry(1.25, 1.25, 4.2, 16).rotateX(Math.PI / 2).translate(px, py, 2.0), m.silver, grp));
  });
  leftPort('dc-jack', LF.dc, 2, 1, (grp, w, h) => {
    const s = rectShape(w, h, 0.8); s.holes.push(rectHole(w - 2, h - 2, 1, 1, 0.6));
    ctx.mesh(new T.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: false }), m.black, grp);
    ctx.mesh(new T.CylinderGeometry(2.6, 2.6, 1.4, 20).rotateX(Math.PI / 2).translate(w / 2, h / 2, 0.7), m.dark, grp);
    ctx.mesh(new T.CylinderGeometry(0.8, 0.8, 2.6, 12).rotateX(Math.PI / 2).translate(w / 2, h / 2, 1.3), m.silver, grp);
  });
  leftPort('usb-pclink', LF.usb, 1.5, 0.6, (grp, w, h) => {
    const s = rectShape(w, h, 0.5); s.holes.push(rectHole(w - 1.2, h - 1.2, 0.6, 0.6, 0.3));
    ctx.mesh(new T.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false }), m.silver, grp);
    ctx.mesh(new T.BoxGeometry(w - 2.4, h - 1.6, 0.9).translate(w / 2, h / 2, 0.5), m.black, grp);
  });
  leftPort('temp-port', LF.temp, 3, 0.8, (grp, w, h) => {
    const s = rectShape(w, h, 0.4); s.holes.push(rectHole(w - 1.6, h - 1.2, 0.8, 0.6, 0.2));
    ctx.mesh(new T.ExtrudeGeometry(s, { depth: 3.4, bevelEnabled: false }), m.black, grp);
    [-2.54, 0, 2.54].forEach((o) => ctx.mesh(new T.BoxGeometry(0.64, 0.64, 2.6).translate(w / 2 + o, h / 2, 1.5), m.gold, grp));
  });
  ctx.anchor('heatsink', [0, 21, -hd - k.FIN], [0, 0, -1]);
  return g;
}

/* ================= PIN + DÂY ================= */
function packLabelTex(k) {
  const S = 10;
  return canvasTex('pack-label', (k.BATT.L - 6) * S, (k.BATT.W - 6) * S, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#0e1b3a'); gr.addColorStop(1, '#15151a');
    g.fillStyle = gr; rr(g, 0, 0, w, h, 24); g.fill();
    g.fillStyle = '#2f7bff'; g.fillRect(0, h * 0.72, w, h * 0.06);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `italic 900 ${h * 0.34}px Arial, sans-serif`; g.fillText('OVONIC', w * 0.05, h * 0.3);
    g.font = `bold ${h * 0.16}px Arial, sans-serif`; g.fillText('4S  5300mAh  14.8V', w * 0.05, h * 0.56);
    g.font = `${h * 0.1}px Arial, sans-serif`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('Li-Po Battery · hard case', w * 0.05, h * 0.89);
    g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = `bold ${h * 0.2}px Arial`; g.fillText('4S', w * 0.97, h * 0.3);
  });
}
function tube(ctx, pts, r, mat, parent, tension = 0.5) {
  const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)), false, 'catmullrom', tension);
  return ctx.mesh(new T.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 10, false), mat, parent);
}
// Giắc T-plug (Deans). EST: 12 x 7,5 x 17 mm, hai tiếp điểm cách 7,2 mm; trục theo +x, hàng theo z.
function deans(ctx, female, x0, y, zc, parent) {
  const m = ctx.m, g = new T.Group(), L = female ? 17 : 15;
  ctx.mesh(new RoundedBoxGeometry(L, 7.5, 12.4, 2, 0.9), female ? m.black : m.xt60, g, x0 + L / 2, y, zc);
  if (!female) [-3.6, 3.6].forEach((o) => ctx.mesh(new T.BoxGeometry(5.5, 0.5, 4.6), m.gold, g, x0 - 2.4, y, zc + o));
  else [-3.6, 3.6].forEach((o) => ctx.mesh(new T.BoxGeometry(0.4, 5, 4.2), m.dark, g, x0 + L - 0.1, y, zc + o));
  parent.add(g); return g;
}
function bananaPlug(ctx, color, y, z, parent) {
  const k = ctx.k;
  const prof = [[3.2, 0], [4.3, 1.2], [4.3, 9], [3.7, 10.5], [3.7, 18.5], [2.6, 20.5], [2.0, 22]].map(([r, h]) => new T.Vector2(r, h));
  const boot = ctx.mesh(new T.LatheGeometry(prof, 24), new T.MeshPhysicalMaterial({ color: color === 'red' ? 0xc8202a : 0x1a1a1c, roughness: 0.4, clearcoat: 0.3, side: T.DoubleSide }), parent, 0, 0, 0);
  boot.rotation.z = -Math.PI / 2; boot.position.set(k.W / 2 + 0.95, y, z);
}

function addBattery(ctx, parent, opts) {
  // pin nằm dọc theo x, tâm (0,H/2,0), dây ra đầu +x. Trả các điểm neo để nối cáp.
  const k = ctx.k, B = k.BATT, m = ctx.m, g = new T.Group();
  const body = ctx.mesh(new RoundedBoxGeometry(B.L, B.H, B.W, 4, 3), m.pack, g, 0, B.H / 2, 0);
  ctx.reg('batt', body);
  const lab = ctx.decal(packLabelTex(k), B.L - 6, B.W - 6, g, [-1, B.H + 0.04, 0], [-Math.PI / 2, 0, 0], 1);
  lab.userData.decal = false; ctx.reg('batt-label', lab);
  const xe = B.L / 2, yl = 20, mBase = xe + opts.leadLen;
  // dây xả 12 AWG đỏ/đen
  const red = [xe - 2, yl, -3.6], blk = [xe - 2, yl, 3.6];
  [[red, m.cableRed], [blk, m.cableBlack]].forEach(([p, mat]) => {
    tube(ctx, [[p[0], p[1], p[2]], [xe + 6, yl, p[2]], [xe + opts.leadLen * 0.5, yl - 5, p[2]], [mBase - 6, yl, p[2]], [mBase + 1, yl, p[2]]], 1.95, mat, g);
  });
  const mm = xtModel(ctx, 'xt60-m', m);
  const mh = basisGroup(mm, [0, 0, 1], [1, 0, 0], [0, 1, 0], [mBase, yl, -3.6]);
  g.add(mh); ctx.reg('batt-xt60', mh);
  parent.add(g);
  return { group: g, xe, yl, mBase };
}

function balanceLead(ctx, parent, path, plugCenter, facing) {
  // 5 dây mảnh: đen + 4 đỏ (EST, màu giữa khác nhau theo hãng). path: điểm giữa dây (world của parent).
  const m = ctx.m, grp = new T.Group();
  const lat = ctx.k.BAL_NEG_BACK ? [-5, -2.5, 0, 2.5, 5] : [5, 2.5, 0, -2.5, -5]; // đen về phía SAU máy (dấu ⊖ ở đầu sau, manual tr.10)
  const colors = [m.cableBlack, m.cableRed, m.cableRed, m.cableRed, m.cableRed];
  lat.forEach((o, i) => {
    const n = path.length;
    const pts = path.map((p, idx) => { const s = idx / (n - 1); return [p[0], p[1], p[2] + o * (0.15 + 0.85 * s * s)]; });
    tube(ctx, pts, 0.55, colors[i], grp);
  });
  // vỏ XHP-5: EST 13,4 x 4,6 x 9,8 (hàng chân theo z)
  const [px, py, pz] = plugCenter;
  const body = new T.Group();
  ctx.mesh(new RoundedBoxGeometry(9.8, 4.6, 13.4, 2, 0.5), m.white, body, px, py, pz);
  ctx.mesh(new T.BoxGeometry(3, 0.9, 5), m.white, body, px + facing * 0.5, py + 2.6, pz);
  grp.add(body);
  parent.add(grp); ctx.reg('batt-balance', grp);
  return grp;
}

/* ================= CẢNH ================= */
function shadowDecal(ctx, parent, w, d, x, z) {
  const tex = canvasTex('shadow', 256, 256, (g, cw, ch) => {
    g.clearRect(0, 0, cw, ch);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.012)'; const ins = i * 2.1; g.fillRect(ins, ins, cw - 2 * ins, ch - 2 * ins); }
  });
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const m = new T.Mesh(ctx.geo(new T.PlaneGeometry(w, d)), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); m.userData.decal = true; parent.add(m);
}

function buildScene(ctx, kind) {
  const k = ctx.k, root = new T.Group();
  if (kind === 'battery') {
    const b = addBattery(ctx, root, { leadLen: 52 });
    shadowDecal(ctx, root, k.BATT.L + 90, k.BATT.W + 50, 24, 0);
    const bx = b.xe;
    balanceLead(ctx, root, [[bx - 2, 8, 12], [bx + 8, 6, 14], [bx + 30, 1.5, 22], [bx + 50, 2.3, 26], [bx + 56, 2.3, 26]], [bx + 66, 2.3, 26], -1);
    ctx.anchor('batt', [0, k.BATT.H + 3, 0], [0, 1, 0]); ctx.anchor('batt-label', [-30, k.BATT.H, 10], [0, 1, 0]);
    ctx.anchor('batt-xt60', [b.mBase + 8, 30, -3.6], [0, 1, 0]); ctx.anchor('batt-balance', [bx + 66, 6, 26], [0, 1, 0]);
    return root;
  }
  const ch = buildCharger(ctx);
  root.add(ch);
  shadowDecal(ctx, root, k.W + 60, k.D + 60, 0, 0);
  if (kind === 'charger') return root;

  // ---- hero / wiring: máy + pin đặt trước máy + chuỗi dây thật của hộp (#3 bắp chuối→T, #8 T→XT60) ----
  const hw = k.W / 2, off = { x: 0, z: 150 };
  const pack = new T.Group(); pack.position.set(off.x, 0, off.z);
  const b = addBattery(ctx, pack, { leadLen: 52 });
  root.add(pack);
  shadowDecal(ctx, root, k.BATT.L + 60, k.BATT.W + 50, off.x, off.z);
  const mTop = off.x + b.mBase + 16;               // mặt trên XT60 đực (cao 16 mm) theo x thế giới
  const fEnd = mTop + 16.7;                        // đuôi XT60 cái (cao 16,7 mm) nơi dây #8 thoát ra
  const zr = off.z - 3.6, zb = off.z + 3.6, yl = b.yl;
  // XT60 cái (dây #8)
  const xf = xtModel(ctx, 'xt60-f', ctx.m);
  const fh = basisGroup(xf, [0, 0, 1], [-1, 0, 0], [0, -1, 0], [fEnd, yl, zr]);
  const adapter = new T.Group(); adapter.add(fh);
  const dx0 = fEnd + 45;                    // giắc T cái của dây #8
  [[zr, ctx.m.cableRed], [zb, ctx.m.cableBlack]].forEach(([z, mat]) => tube(ctx, [[fEnd - 3, yl, z], [fEnd + 12, yl - 5, z], [dx0 - 12, yl - 4, z], [dx0 + 2, yl, z]], 1.95, mat, adapter));
  deans(ctx, true, dx0, yl, off.z, adapter);
  root.add(adapter); ctx.reg('adapter-t-xt60', adapter);
  // dây #3: bắp chuối → T đực
  const cable = new T.Group();
  const tx = dx0 + 17;                              // đầu giắc T đực (mặt giao) và dây thoát ra +x
  deans(ctx, false, tx, yl, off.z, cable);
  const reds = [[hw + 22.9, 15.7, k.D / 2 - k.BAN.pos.d], [115, 11, 43], [145, 4, 55], [190, 2.2, 85], [tx + 12, 2.2, 105], [tx + 38, 6, 128], [tx + 40, 15, zr], [tx + 26, 20, zr], [tx + 15, yl, zr]];
  const blks = [[hw + 22.9, 15.7, k.D / 2 - k.BAN.neg.d], [112, 12, 58], [135, 5, 70], [175, 2.2, 100], [tx + 8, 2.2, 120], [tx + 28, 6, 138], [tx + 28, 15, zb], [tx + 22, yl, zb], [tx + 15, yl, zb]];
  tube(ctx, reds, 1.95, ctx.m.cableRed, cable); tube(ctx, blks, 1.95, ctx.m.cableBlack, cable);
  [['red', reds[0]], ['black', blks[0]]].forEach(([c, p]) => bananaPlug(ctx, c, p[1], p[2], cable));
  root.add(cable); ctx.reg('cable-banana-t', cable);
  // dây cân bằng cắm thẳng vào ổ "4 cell": đầu đen hướng về cực ⊖ (phía trước máy, z lớn)
  const s4 = k.BAL.find((s) => s.id === 'bal-4s');
  const pz = k.D / 2 - (s4.d0 + k.BAL_MARGIN / 2 + k.BAL_PITCH * 2), py = s4.y0 + k.BAL_H / 2;
  const px = hw - 0.8 - 4.3 + 4.9;
  const path = [[px + 4.9, py, pz], [px + 14, py - 4, pz + 1], [100, 3, 30], [104, 0.8, 55], [104, 0.8, 100], [96, 0.8, 128], [92, 0.8, 152], [off.x + b.xe + 8, 6, off.z + 12], [off.x + b.xe - 2, 8, off.z + 12]];
  balanceLead(ctx, root, path, [px, py, pz], +1);
  ctx.anchor('out-pos', [hw + 12, 22, 47], [0.3, 1, 0], 'Cổng ra + / −', [-8, 20]);
  ctx.anchor('batt', [off.x, 38.5, off.z], [0, 1, 0]); ctx.anchor('batt-xt60', [mTop - 6, 29, off.z], [0, 1, 0]);
  ctx.anchor('cable-banana-t', [150, 6, 62], [0, 1, 0]); ctx.anchor('adapter-t-xt60', [dx0 - 12, 27, off.z], [0, 1, 0]);
  ctx.anchor('batt-balance', [off.x + b.xe + 6, 12, off.z + 12], [0, 1, 0], null, [-24, 18]);
  return root;
}

/* ================= GL DÙNG CHUNG =================
   Tạo WebGLRenderer và PMREM mất vài giây (nhất là phần mềm swiftshader) nên chỉ làm MỘT lần cho cả trang.
   Mỗi khung nhìn có canvas 2D riêng; cảnh được vẽ vào vùng góc dưới-trái của canvas WebGL chung rồi chép sang canvas 2D. */
const GL = { renderer: null, env: null, pr: 1, bufW: 0, bufH: 0, soft: false };
// GPU phần mềm (swiftshader, llvmpipe): bỏ khử răng cưa MSAA và vẽ nhẹ hơn, vì mỗi khung có thể mất hàng trăm ms.
function isSoftwareGL() {
  try {
    const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
    if (!g) return false;
    const e = g.getExtension('WEBGL_debug_renderer_info'), name = e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch (err) { return false; }
}
const nextFrame = () => new Promise((res) => { let done = false; const f = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(f); setTimeout(f, 150); });
// Chờ GPU làm xong lệnh đã gửi mà KHÔNG chặn luồng chính (rào WebGL2 + thăm dò); nếu không có rào thì chờ một khung hình.
function gpuIdle(maxMs = 30000) {
  const gl = GL.renderer && GL.renderer.getContext();
  if (!gl || !gl.fenceSync) return nextFrame();
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
  const t0 = performance.now();
  return new Promise((res) => {
    const poll = () => {
      const st = gl.clientWaitSync(sync, 0, 0);
      if (st === gl.TIMEOUT_EXPIRED && performance.now() - t0 < maxMs) { setTimeout(poll, 25); return; }
      gl.deleteSync(sync); res();
    };
    poll();
  });
}
// Khi người dùng đang cuộn trang thì tạm dừng mọi việc vẽ 3D (tới 150 ms sau lần cuộn cuối), để cuộn mượt.
let lastScroll = 0;
window.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
const scrollBusy = () => performance.now() - lastScroll < 150;
const scrollWait = () => Math.max(0, 150 - (performance.now() - lastScroll)) + 10;
// Biên dịch shader theo từng nhóm vật liệu, nhường khung hình giữa các nhóm (mỗi lần compile() có thể chặn vài chục ms).
async function stagedCompile(scene, camera) {
  const reps = new Map();
  scene.traverseVisible((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints)) return;
    for (const m of [].concat(o.material)) {
      if (!m) continue;
      const k = [m.type, !!m.map, !!m.emissiveMap, !!m.alphaMap, m.transparent, m.clearcoat > 0, m.sheen > 0, m.side, !!o.isInstancedMesh, m.flatShading, m.vertexColors, m.metalness > 0.5].join('|');
      if (!reps.has(k)) reps.set(k, o);
    }
  });
  let n = 0;
  for (const o of reps.values()) { GL.renderer.compile(o, camera, scene); if (++n % 2 === 0) await nextFrame(); }
  await gpuIdle();
}
let glPromise = null;
function glReady() {
  if (glPromise) return glPromise;
  glPromise = (async () => {
    await nextFrame();
    mark('gl:create');
    GL.soft = isSoftwareGL();
    const r = new T.WebGLRenderer({ antialias: !GL.soft, alpha: true, powerPreference: 'high-performance' });
    GL.pr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(GL.pr); r.toneMapping = T.ACESFilmicToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap; r.setClearColor(0x000000, 0);
    r.debug.checkShaderErrors = false;   // mặc định three hỏi trạng thái liên kết ngay => chặn luồng chính hàng giây trên GPU phần mềm
    GL.renderer = r;
    mark('gl:renderer');
    await nextFrame();
    const pm = new T.PMREMGenerator(r);
    GL.env = pm.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: GL.soft ? 64 : 128 });   // 128 đủ cho ánh sáng phòng mờ; 256 chậm gấp 4
    pm.dispose();
    await gpuIdle();
    mark('gl:env');
    return GL;
  })();
  return glPromise;
}
// Độ phân giải động: nếu một khung hình quá chậm (GPU phần mềm) thì giảm tỉ lệ vẽ, nhanh lại thì tăng dần. GPU thật luôn ở 1.
function adaptQuality(qual, ms) {
  if (ms > 90 && qual.q > 0.4) qual.q = Math.max(0.4, qual.q * 0.7);
  else if (ms < 25 && qual.q < 1) qual.q = Math.min(1, qual.q * 1.15);
}
function glPresent(scene, camera, w, h, canvas2d, g2d, exposure, qual) {
  const r = GL.renderer, pr = GL.pr, t0 = performance.now(), q = qual ? qual.q : 1;
  if (w > GL.bufW || h > GL.bufH) { GL.bufW = Math.max(GL.bufW, w); GL.bufH = Math.max(GL.bufH, h); r.setSize(GL.bufW, GL.bufH, false); }
  r.toneMappingExposure = exposure;
  const vw = Math.max(1, Math.round(w * q)), vh = Math.max(1, Math.round(h * q));
  r.setViewport(0, 0, vw, vh); r.setScissor(0, 0, vw, vh); r.setScissorTest(true);
  r.render(scene, camera);
  const pw = Math.max(1, Math.round(vw * pr)), ph = Math.max(1, Math.round(vh * pr)), bh = r.domElement.height;
  g2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
  g2d.drawImage(r.domElement, 0, bh - ph, pw, ph, 0, 0, canvas2d.width, canvas2d.height);
  if (qual) adaptQuality(qual, performance.now() - t0);
}
// Hàng đợi dựng: mỗi lần chỉ một cảnh nặng, nhường khung hình giữa các bước để trang vẫn bấm được.
let buildChain = Promise.resolve();
function enqueueBuild(fn) { const p = buildChain.then(fn); buildChain = p.catch(() => {}); return p; }
const PH_STYLE = 'position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:12px;font:500 14px/1.4 var(--font);color:var(--ink-3);background:linear-gradient(150deg,var(--surface-2),color-mix(in srgb,var(--accent) 14%,var(--surface-2)) 60%,var(--surface-2));border-radius:inherit;z-index:1;pointer-events:none';
function makePlaceholder(text) { const d = document.createElement('div'); d.className = 'v3d-ph'; d.setAttribute('style', PH_STYLE); d.textContent = text || 'Đang tải mô hình 3D…'; return d; }
const isNear = (el) => { const r = el.getBoundingClientRect(); return r.bottom > -800 && r.top < window.innerHeight + 800; };
// Chạy run() khi phần tử tới gần khung nhìn (800 px). Trả hàm huỷ.
function whenNear(el, run) {
  let cancelled = false, io = null;
  const go = () => { if (!cancelled) run(); };
  if (!('IntersectionObserver' in window)) setTimeout(go, 0);
  else { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '800px 0px' }); io.observe(el); }
  return () => { cancelled = true; if (io) io.disconnect(); };
}

/* ================= VIEW ================= */
window.SAC = window.SAC || {};
// SAC.view3d trả API ngay (setView/highlight xếp hàng), dựng cảnh khi phần tử tới gần khung nhìn.
window.SAC.view3d = function view3d(el, opts = {}) {
  el.classList.add('v3d');
  const ph = makePlaceholder(); el.appendChild(ph);
  const pend = { view: opts.view || 'iso', hl: null };
  let real = null, disposed = false, cancel = () => {};
  const arm = () => {
    cancel = whenNear(el, () => {
      enqueueBuild(async () => {
        if (disposed) return;
        if (!isNear(el)) { arm(); return; }   // người dùng đã cuộn đi trong lúc chờ hàng đợi: đợi lần tới gần sau
        mark('v3d:' + (opts.scene || 'charger') + ':run');
        await glReady();
        if (disposed) return;
        real = buildView3d(el, Object.assign({}, opts, { view: pend.view, __first: () => ph.remove() }));
        if (pend.hl) real.highlight(pend.hl);
        await real.built;
      }).catch((err) => { console.error('[SAC 3D] dung canh that bai', err); ph.textContent = 'Không dựng được mô hình 3D: ' + (err && err.message); });
    });
  };
  arm();
  return {
    setView(name) { pend.view = name; if (real) real.setView(name); },
    highlight(part) { pend.hl = part || null; if (real) real.highlight(part); },
    get ready() { return !!(real && real.isReady()); },
    dispose() { disposed = true; cancel(); ph.remove(); if (real) real.dispose(); },
  };
};
function buildView3d(el, opts = {}) {
  const sceneKind = opts.scene || 'charger';
  const tag = 'v3d:' + sceneKind + ':';
  mark(tag + 'start');
  el.classList.add('v3d');
  const state = { disposed: false, ready: false, pending: { view: opts.view || (sceneKind === 'hero' || sceneKind === 'wiring' ? 'iso' : 'iso'), hl: null } };

  const canvas = document.createElement('canvas');   // canvas 2D: nhận ảnh từ WebGL dùng chung
  const g2d = canvas.getContext('2d');
  canvas.style.touchAction = 'none';
  el.appendChild(canvas);
  let exposure = 1;

  let visible = true, raf = 0, dirty = true, scrollT = 0;
  const qual = { q: GL.soft ? 0.6 : 1 };
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, 1, 1, 6000);
  scene.environment = GL.env.texture;
  const key = new T.DirectionalLight(0xffffff, 2.1); key.position.set(160, 280, 240); scene.add(key);
  const fill = new T.DirectionalLight(0xbfd4ff, 0.45); fill.position.set(-220, 120, 80); scene.add(fill);
  const applyTheme = () => { const d = isDark(); exposure = d ? 0.82 : 1.0; scene.environmentIntensity = d ? 0.45 : 0.6; request(); };
  applyTheme();
  window.addEventListener('sac-theme', applyTheme);
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', applyTheme);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; controls.rotateSpeed = 0.8;

  // UI
  const bar = document.createElement('div'); bar.className = 'v3d-bar';
  const chips = {};
  Object.keys(VIEW_LABEL).forEach((name) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = VIEW_LABEL[name];
    b.addEventListener('click', () => api.setView(name)); chips[name] = b; bar.appendChild(b);
  });
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  const hint = document.createElement('div'); hint.className = 'v3d-hint'; hint.textContent = 'Kéo để xoay · cuộn để phóng';
  el.append(bar, hint);
  const tagEls = [];

  let ctx = null, root = null, bounds = null, anchors = [];
  const boundPts = [], tmpP = new T.Vector3();
  const raycaster = new T.Raycaster(), ndc = new T.Vector2();
  const hlState = { sel: null, hover: null };
  let tween = null, curView = null, frame = 0, size = { w: 0, h: 0 }, userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; tween = null; });
  controls.addEventListener('change', () => request());   // vẽ lại chỉ khi camera đổi (kể cả quán tính damping)

  function fitFor(dirArr) {
    const dir = new T.Vector3(...dirArr).normalize(), center = bounds.getCenter(new T.Vector3());
    const fwd = dir.clone().negate(), up = new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(fwd, up).normalize(), upv = new T.Vector3().crossVectors(right, fwd).normalize();
    const tv = Math.tan(T.MathUtils.degToRad(FOV / 2)), asp = camera.aspect || 1;
    let dist = 1;
    for (const q of boundPts) {                    // góc hộp bao từng chi tiết; điểm gần máy ảnh cần lùi xa hơn một lượng đúng bằng độ sâu của nó
      const p = tmpP.copy(q).sub(center), z = p.dot(fwd) * -1;   // z > 0: gần máy ảnh hơn tâm
      dist = Math.max(dist, Math.abs(p.dot(upv)) / tv * 1.04 + z, Math.abs(p.dot(right)) / (tv * asp) * 1.04 + z);
    }
    return { dir, center, dist };
  }
  function goto(name, immediate) {
    if (!VIEW_DIR[name]) throw new Error('[SAC 3D] view la: ' + name);
    curView = name;
    Object.entries(chips).forEach(([n, b]) => { const on = n === name; b.classList.toggle('on', on); b.style.background = on ? 'var(--ink)' : ''; b.style.color = on ? 'var(--bg)' : ''; });
    if (!state.ready) { state.pending.view = name; return; }
    if (!immediate) userMoved = true;
    const f = fitFor(VIEW_DIR[name]);
    const toPos = f.center.clone().addScaledVector(f.dir, f.dist);
    controls.minDistance = f.dist * 0.25; controls.maxDistance = f.dist * 2.2;
    if (immediate) { camera.position.copy(toPos); controls.target.copy(f.center); camera.lookAt(f.center); controls.update(); tween = null; return; }
    const fromOff = camera.position.clone().sub(controls.target);
    tween = { t0: performance.now(), dur: 650, fromDir: fromOff.clone().normalize(), fromDist: fromOff.length(), fromTarget: controls.target.clone(), toDir: f.dir.clone(), toDist: f.dist, toTarget: f.center.clone() };
  }
  function stepTween(now) {
    if (!tween) return;
    const p = Math.min(1, (now - tween.t0) / tween.dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const qa = new T.Quaternion(), qb = new T.Quaternion().setFromUnitVectors(tween.fromDir, tween.toDir);
    const q = qa.slerp(qb, e);
    const dir = tween.fromDir.clone().applyQuaternion(q).normalize();
    const target = tween.fromTarget.clone().lerp(tween.toTarget, e), dist = T.MathUtils.lerp(tween.fromDist, tween.toDist, e);
    controls.target.copy(target); camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target);
    if (p >= 1) tween = null;
  }

  // ---- highlight ----
  function emissive(part, on, strength) {
    const list = ctx && ctx.parts.get(part); if (!list) return;
    list.forEach((mesh) => {
      const mt = mesh.material; if (!mt || !mt.emissive) return;
      if (!mesh.userData.emi) mesh.userData.emi = { c: mt.emissive.clone(), i: mt.emissiveIntensity };
      if (on) { mt.emissive.set(0x2f7bff); mt.emissiveIntensity = strength; } else { mt.emissive.copy(mesh.userData.emi.c); mt.emissiveIntensity = mesh.userData.emi.i; }
    });
  }
  function refreshHighlight() {
    if (!ctx) return;
    for (const part of ctx.parts.keys()) emissive(part, false, 0);
    if (hlState.hover) emissive(hlState.hover, true, 0.35);
    if (hlState.sel) emissive(hlState.sel, true, 0.75);
    request();
  }

  // ---- hotspot ----
  function buildTags() {
    const want = opts.hotspots ? (TAGS[sceneKind] || []) : [];
    anchors = ctx.anchors.filter((a) => want.includes(a.part));
    anchors.forEach((a) => {
      const t = document.createElement('div'); t.className = 'v3d-tag'; t.textContent = a.label; t.setAttribute('role', 'button'); t.tabIndex = 0;
      const pick = () => { if (opts.onPick) opts.onPick(a.part); };
      t.addEventListener('click', pick); t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      t.addEventListener('pointerdown', (e) => e.stopPropagation());
      t.addEventListener('pointerenter', () => { hlState.hover = a.part; refreshHighlight(); });
      t.addEventListener('pointerleave', () => { hlState.hover = null; refreshHighlight(); });
      el.appendChild(t); tagEls.push(t); a.el = t;
    });
  }
  const tmpV = new T.Vector3(), tmpD = new T.Vector3();
  function updateTags(checkOcclusion) {
    if (!anchors.length) return;
    const cam = camera.position;
    const narrow = size.w < 520;                   // màn hình hẹp: bỏ nhãn cho đỡ rối
    anchors.forEach((a) => {
      if (narrow) { a.el.style.display = 'none'; return; }
      const p = tmpV.copy(a.pos).addScaledVector(a.normal, 2.5);
      tmpD.copy(cam).sub(p);
      const dist = tmpD.length(); tmpD.normalize();
      let show = a.normal.dot(tmpD) > 0.2;
      const proj = p.clone().project(camera);
      if (proj.z > 1 || Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05) show = false;
      if (show && checkOcclusion) {
        raycaster.set(cam, p.clone().sub(cam).normalize()); raycaster.far = dist - 1;
        const hit = raycaster.intersectObjects(root.children, true).find((h) => !h.object.userData.decal);
        a.occluded = !!hit; raycaster.far = Infinity;
      }
      if (a.occluded) show = false;
      a.el.style.display = show ? '' : 'none';
      if (show) { a.el.style.left = ((proj.x + 1) / 2 * size.w + a.off[0]) + 'px'; a.el.style.top = ((1 - proj.y) / 2 * size.h + a.off[1] - 6) + 'px'; }
    });
  }

  // ---- chọn bộ phận ----
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(root.children, true).find((h) => !h.object.userData.decal);
    return hit && hit.object.userData.part || null;
  }
  let down = null, hoverT = 0;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; if (e.pointerType === 'mouse') controls.enableZoom = true; });
  canvas.addEventListener('pointerup', (e) => {
    if (!state.ready || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved < 5 && dt < 500) { const part = pickAt(e); if (part && opts.onPick) opts.onPick(part); }
  });
  canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; if (hlState.hover) { hlState.hover = null; refreshHighlight(); canvas.style.cursor = ''; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.ready || e.buttons) return;
    const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
    const part = pickAt(e);
    if (part !== hlState.hover) { hlState.hover = part; canvas.style.cursor = part ? 'pointer' : ''; refreshHighlight(); }
  });

  // ---- vòng lặp ----
  function resize() {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    if (w === size.w && h === size.h) return;
    size = { w, h }; canvas.width = Math.round(w * GL.pr); canvas.height = Math.round(h * GL.pr); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (state.ready && !tween && curView && !userMoved) goto(curView, true);
    request();
  }
  const ro = new ResizeObserver(resize); ro.observe(el);
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) request(); });
  io.observe(el);
  const onVis = () => { if (!document.hidden) request(); }; document.addEventListener('visibilitychange', onVis);
  // Vẽ theo yêu cầu: chỉ lên lịch khung hình khi có gì đó đổi (camera, tween, tô sáng, kích thước, giao diện). Rảnh thì 0 khung hình.
  function request() {
    dirty = true;
    if (raf || scrollT || state.disposed || !visible || document.hidden) return;
    raf = requestAnimationFrame(tick);
  }
  const loop = request;
  function tick(now) {
    raf = 0;
    if (state.disposed || !visible || document.hidden) return;
    if (!state.ready || !size.w) return;
    if (scrollBusy()) { scrollT = setTimeout(() => { scrollT = 0; request(); }, scrollWait()); return; }
    stepTween(now);
    controls.update();                 // phát 'change' (=> request) nếu camera còn dịch chuyển
    if (tween) dirty = true;
    if (!dirty) return;
    dirty = false;
    glPresent(scene, camera, size.w, size.h, canvas, g2d, exposure, qual);
    if (frame === 0) { mark(tag + 'first-render'); if (opts.__first) opts.__first(); }
    frame++; updateTags(true);
    if (tween) request();
  }

  // ---- khởi tạo bất đồng bộ (model GLB), nhường khung hình giữa các bước nặng ----
  const builtP = (async () => {
    const models = await loadModels();
    if (state.disposed) return;
    await nextFrame();
    ctx = new Ctx(models); root = buildScene(ctx, sceneKind); scene.add(root);
    mark(tag + 'scene');
    await nextFrame();
    if (state.disposed) return;
    await stagedCompile(scene, camera);   // tạo chương trình shader sớm theo từng nhóm: với checkShaderErrors=false việc liên kết chạy ở tiến trình GPU, song song với JS
    mark(tag + 'compiled');
    if (state.disposed) return;
    // vật liệu riêng cho từng bộ phận để tô sáng không lan sang bộ phận khác
    ctx.parts.forEach((list) => list.forEach((mesh) => { if (mesh.material && !mesh.userData.own) { mesh.material = mesh.material.clone(); mesh.userData.own = true; } }));
    root.traverse((o) => { if (o.userData.decal) o.raycast = () => {}; });
    bounds = new T.Box3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.decal) return;
      const bb = new T.Box3().setFromObject(o); bounds.union(bb);
      for (let i = 0; i < 8; i++) boundPts.push(new T.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z));
    });
    buildTags();
    state.ready = true; resize();
    goto(state.pending.view, true);
    hlState.sel = state.pending.hl; refreshHighlight();
    mark(tag + 'built');
    loop();
  })();

  const api = {
    built: builtP, isReady: () => state.ready,
    setView(name) { goto(name, false); loop(); },
    highlight(part) { state.pending.hl = part || null; hlState.sel = part || null; refreshHighlight(); },
    dispose() {
      if (state.disposed) return;
      state.disposed = true; cancelAnimationFrame(raf); clearTimeout(scrollT);
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('sac-theme', applyTheme); mq.removeEventListener('change', applyTheme);
      controls.dispose();
      if (ctx) { ctx.geos.forEach((g) => g.dispose()); scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((mt) => mt.dispose()); }); }
      bar.remove(); hint.remove(); tagEls.forEach((t) => t.remove()); canvas.remove();
    },
  };
  chips[state.pending.view] && (chips[state.pending.view].classList.add('on'), chips[state.pending.view].style.background = 'var(--ink)', chips[state.pending.view].style.color = 'var(--bg)');
  return api;
}

/* Xuất cho bench3d.js (cảnh bàn thực hành). Không đổi hành vi của SAC.view3d. */
window.SAC = window.SAC || {};
window.SAC.texCache = texCache;
export { scrollBusy, scrollWait, stagedCompile, isNear, gpuIdle, GL, glReady, glPresent, nextFrame, enqueueBuild, whenNear, makePlaceholder, mark, T, Ctx, buildCharger, loadModels, xtModel, xhModel, basisGroup, canvasTex, rr, rectShape, rectHole, makeMats, packLabelTex, shadowDecal, RoundedBoxGeometry, isDark, FOV };
