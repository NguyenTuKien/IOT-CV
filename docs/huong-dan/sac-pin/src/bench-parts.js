/* Bàn thực hành 3D: mô hình các món đồ (giắc, dây, pin, ắc quy, ổ cắm). Mọi giắc dựng trong hệ cục bộ:
   +x = chiều cắm vào (đầu giắc ở x = +Lh), gốc ở giữa thân, dây thoát ra ở x = -Lh, y lên, z ngang (hàng chân).
   Kích thước: XT60 / JST-XH theo model KiCad; banana, T-plug (Deans), IEC C5, jack DC, kẹp cá sấu là ƯỚC LƯỢNG. */
import { T, xtModel, xhModel, basisGroup, RoundedBoxGeometry, packLabelTex } from './scene3d.js';

const PI = Math.PI;

function mats() {
  const phys = (o) => new T.MeshPhysicalMaterial(o);
  return {
    red: phys({ color: 0xc8202a, roughness: 0.35, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
    black: phys({ color: 0x17181b, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
    gold: phys({ color: 0xe0ac3c, metalness: 1, roughness: 0.22 }),
    steel: phys({ color: 0xcfd4dc, metalness: 1, roughness: 0.25 }),
    yellow: phys({ color: 0xf0bf12, roughness: 0.42, clearcoat: 0.2 }),
    dark: new T.MeshStandardMaterial({ color: 0x07080a, roughness: 0.7 }),
    white: new T.MeshStandardMaterial({ color: 0xf1efe6, roughness: 0.5, side: T.DoubleSide }),
    pack: new T.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.05 }),
    rubber: new T.MeshStandardMaterial({ color: 0x101012, roughness: 0.92 }),
    cord: phys({ color: 0x202226, roughness: 0.55, sheen: 1, sheenRoughness: 0.5, sheenColor: new T.Color(0x667088) }),
    wood: new T.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.85 }),
    batt: new T.MeshStandardMaterial({ color: 0x24303d, roughness: 0.6 }),
    lead: new T.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.8, roughness: 0.4 }),
  };
}
export const makeBenchMats = mats;

function mesh(g, mat, parent, x = 0, y = 0, z = 0, geos) {
  const m = new T.Mesh(g, mat); m.position.set(x, y, z); if (parent) parent.add(m); if (geos) geos.push(g); m.castShadow = true; m.receiveShadow = true; return m;
}
const alongX = (m) => { m.rotation.z = -PI / 2; return m; };       // trục hình trụ y -> x

export function centerGroup(src) {            // dời tâm hộp bao về gốc, trả nhóm bọc
  const wrap = new T.Group(); wrap.add(src);
  const bb = new T.Box3().setFromObject(wrap), c = bb.getCenter(new T.Vector3());
  src.position.sub(c);
  return { wrap, size: bb.getSize(new T.Vector3()) };
}

// Mỗi hàm trả {group, Lh}. ctx = {m: mats, geos: [], models}
export function bananaPlug(ctx, color) {
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  const plastic = color === 'red' ? M.red : M.black;
  const prof = [[1.9, -19], [2.4, -15], [3.4, -11], [4.2, -8], [4.4, -6], [4.4, 3.5], [3.8, 5.5], [2.8, 6.4]].map(([r, x]) => new T.Vector2(r, x));
  const lathe = new T.Mesh(new T.LatheGeometry(prof, 28), plastic); geos.push(lathe.geometry); alongX(lathe); lathe.castShadow = true; g.add(lathe);
  mesh(new T.CylinderGeometry(2.05, 2.05, 13, 20).rotateZ(-PI / 2), M.gold, g, 12.5, 0, 0, geos);
  // vòng lò xo của chân banana
  [9.5, 12, 14.5].forEach((x) => mesh(new T.TorusGeometry(2.1, 0.28, 8, 20).rotateY(PI / 2), M.gold, g, x, 0, 0, geos));
  return { group: g, Lh: 19, restY: 4.4 };
}

export function deansMale(ctx) {            // dây #3: T-plug đực (hai lá), thân vàng
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new RoundedBoxGeometry(12, 7.5, 12.4, 2, 0.9), M.yellow, g, -3, 0, 0, geos);
  [-3.6, 3.6].forEach((z) => mesh(new T.BoxGeometry(7.5, 0.7, 4.6), M.gold, g, 5.2, 0, z, geos));
  mesh(new T.BoxGeometry(0.6, 7.6, 1.2), M.dark, g, -9, 0, 0, geos);
  return { group: g, Lh: 9, restY: 3.8 };
}
export function deansFemale(ctx) {           // dây #8: T-plug cái, thân đen, miệng ở +x
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new RoundedBoxGeometry(17, 7.5, 12.4, 2, 0.9), M.black, g, 0, 0, 0, geos);
  [-3.6, 3.6].forEach((z) => mesh(new T.BoxGeometry(0.5, 4.6, 4.4), M.dark, g, 8.3, 0, z, geos));
  return { group: g, Lh: 8.5, restY: 3.8 };
}
export function xt60Male(ctx) {
  const M = ctx.bm;
  const src = ctx.xt(ctx, 'xt60-m');
  const g = basisGroup(src, [0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, 0]);
  const { wrap, size } = centerGroup(g);
  wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: wrap, Lh: size.x / 2 || 8, restY: size.y / 2 || 4, size };
}
export function xt60Female(ctx) {
  const src = ctx.xt(ctx, 'xt60-f');
  const g = basisGroup(src, [0, 0, -1], [1, 0, 0], [0, -1, 0], [0, 0, 0]);
  const { wrap, size } = centerGroup(g);
  wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: wrap, Lh: size.x / 2 || 8.3, restY: size.y / 2 || 4, size };
}
export function xhPlug(ctx) {                // giắc cân bằng XHP-5: thân trắng, hàng chân dọc z
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new RoundedBoxGeometry(9.8, 4.6, 13.4, 2, 0.5), M.white, g, 0, 0, 0, geos);
  mesh(new T.BoxGeometry(3, 0.9, 5), M.white, g, 0.5, 2.6, 0, geos);
  return { group: g, Lh: 4.9, restY: 2.4 };
}
export function iecC5(ctx) {                 // đầu IEC C5 (ba lỗ), ước lượng
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new RoundedBoxGeometry(24, 15, 22, 2, 1.6), M.black, g, 0, 0, 0, geos);
  [[12.2, 4.5, 0], [12.2, -3.4, -5.2], [12.2, -3.4, 5.2]].forEach(([x, y, z]) => mesh(new T.CylinderGeometry(1.7, 1.7, 0.6, 14).rotateZ(PI / 2), M.dark, g, x, y, z, geos));
  mesh(new T.CylinderGeometry(4.2, 4.2, 14, 16).rotateZ(PI / 2), M.black, g, -17, 0, 0, geos);
  return { group: g, Lh: 12, restY: 7.5 };
}
export function dcBarrel(ctx) {              // jack DC (đầu cắm máy): ước lượng
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new T.CylinderGeometry(5.2, 5.2, 18, 24).rotateZ(PI / 2), M.black, g, -5, 0, 0, geos);
  mesh(new T.CylinderGeometry(3.4, 3.4, 8, 20).rotateZ(PI / 2), M.steel, g, 8.5, 0, 0, geos);
  mesh(new T.CylinderGeometry(1.1, 1.1, 8.2, 12).rotateZ(PI / 2), M.dark, g, 8.5, 0, 0, geos);
  mesh(new T.CylinderGeometry(3, 3, 8, 14).rotateZ(PI / 2), M.rubber, g, -17, 0, 0, geos);
  return { group: g, Lh: 12.5, restY: 5.2 };
}
export function alligatorClip(ctx, color) {  // kẹp cá sấu, hàm mở về +x
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos, plastic = color === 'red' ? M.red : M.black;
  mesh(new RoundedBoxGeometry(26, 9, 12, 2, 1.4), plastic, g, -8, 0, 0, geos);
  const jaw = new T.Shape(); jaw.moveTo(0, 0); jaw.lineTo(24, -1.2); jaw.lineTo(26, 0); jaw.lineTo(24, 1.2); jaw.lineTo(0, 3); jaw.closePath();
  [-1, 1].forEach((s) => {
    const m = new T.Mesh(new T.ExtrudeGeometry(jaw, { depth: 8, bevelEnabled: false }), M.steel); geos.push(m.geometry);
    m.position.set(2, s * 3.2, -4); m.rotation.x = 0; m.scale.set(1, s, 1); m.castShadow = true; g.add(m);
  });
  mesh(new T.CylinderGeometry(2.8, 2.8, 8, 14).rotateZ(PI / 2), M.rubber, g, -24, 0, 0, geos);
  return { group: g, Lh: 26, restY: 6 };
}

/* ---- pin ---- */
export function packBody(ctx, K) {
  const M = ctx.bm, B = K.BATT, g = new T.Group(), geos = ctx.geos;
  const body = mesh(new RoundedBoxGeometry(B.L, B.H, B.W, 4, 3), M.pack, g, 0, B.H / 2, 0, geos);
  const lab = new T.Mesh(new T.PlaneGeometry(B.L - 8, B.W - 6), new T.MeshStandardMaterial({ map: packLabelTex(K), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  geos.push(lab.geometry); lab.rotation.x = -PI / 2; lab.position.set(-1, B.H + 0.05, 0); lab.userData.decal = true; g.add(lab);
  mesh(new RoundedBoxGeometry(6, 14, 20, 2, 1.2), M.rubber, g, B.L / 2 + 1, 20, 0, geos);   // ống bọc chỗ dây ra
  return { group: g, body };
}

/* ---- ổ cắm tường (dải ổ cắm) + ắc quy 12 V ---- */
export function wallStrip(ctx) {
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos;
  mesh(new RoundedBoxGeometry(90, 30, 50, 2, 3), new T.MeshStandardMaterial({ color: 0xe7e5df, roughness: 0.5 }), g, 0, 15, 0, geos);
  mesh(new T.BoxGeometry(34, 0.6, 14), M.dark, g, 12, 30.1, 0, geos);
  // phích Mỹ (NEMA 1-15) của dây nguồn số 2 (sách tr.21): thân đen dẹt, hai lưỡi dẹt, cắm cố định trong ổ
  mesh(new RoundedBoxGeometry(12, 22, 30, 2, 2), M.black, g, -52, 18, 0, geos);
  [-5.6, 5.6].forEach((z) => mesh(new T.BoxGeometry(14, 6.5, 1.6), M.steel, g, -42, 18, z, geos));
  return g;
}
export function carBattery(ctx, size, post) {
  const M = ctx.bm, g = new T.Group(), geos = ctx.geos, { w, d, h } = size;
  mesh(new RoundedBoxGeometry(w, h, d, 2, 3), M.batt, g, 0, h / 2, 0, geos);
  mesh(new T.BoxGeometry(w + 2, 5, d + 2), new T.MeshStandardMaterial({ color: 0x1b242e, roughness: 0.6 }), g, 0, h - 2.5, 0, geos);
  const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 96;
  const c = cvs.getContext('2d'); c.fillStyle = '#e8c41a'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#111'; c.font = 'bold 44px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('12 V', 128, 40); c.font = 'bold 20px Arial'; c.fillText('Ắc quy (minh hoạ)', 128, 76);
  const tex = new T.CanvasTexture(cvs); tex.colorSpace = T.SRGBColorSpace; ctx.tex.push(tex);
  const lab = new T.Mesh(new T.PlaneGeometry(w * 0.7, w * 0.26), new T.MeshStandardMaterial({ map: tex, roughness: 0.6 })); geos.push(lab.geometry);
  lab.position.set(0, h * 0.55, d / 2 + 0.2); g.add(lab);
  [['+', post.pos, M.red], ['-', post.neg, M.black]].forEach(([s, p, mat]) => {
    mesh(new T.CylinderGeometry(7.5, 8.5, 11, 20), M.lead, g, p.x, h + 5.5, p.z, geos);
    mesh(new T.CylinderGeometry(4, 4, 0.5, 14), mat, g, p.x, h + 11.3, p.z, geos);
  });
  return g;
}
