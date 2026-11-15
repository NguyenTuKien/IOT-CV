// Đổi STEP của KiCad (kicad-packages3D, CC-BY-SA 4.0) sang GLB nhỏ cho three.js.
//
//   node step2glb.mjs info <file.step>
//       in danh sách mesh (tên, màu, số tam giác, hộp bao) để chọn mesh giữ lại
//   node step2glb.mjs convert <file.step> <out.glb> [--keep=<regex màu hex>] [--drop=<regex màu hex>]
//                              [--rotate=x|y|z:độ] [--decimals=3] [--clipz=<z gốc>]  (bỏ tam giác nằm hẳn dưới mặt mạch)
//       giữ/loại mesh theo màu (chuỗi "rrggbb"), đổi hệ trục KiCad (Z lên) sang Y lên, đơn vị mm giữ nguyên.
//
// occt-import-js KHÔNG nằm trong repo. Cài vào ổ D:
//   cd D:\DevCache\tmp\sac-pin-tools && npm_config_cache=D:\DevCache\npm-cache npm i occt-import-js
// (thư mục chứa node_modules đổi được bằng biến SAC_TOOLS_DIR).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const toolsDir = process.env.SAC_TOOLS_DIR || 'D:\\DevCache\\tmp\\sac-pin-tools';
const require = createRequire(join(toolsDir, 'noop.js'));
const occtInit = require('occt-import-js');

const [, , cmd, input, output, ...flags] = process.argv;
if (!cmd || !input) {
  console.error('dung: node step2glb.mjs info <step> | convert <step> <glb> [--keep=re] [--drop=re] [--rotate=x:90]');
  process.exit(2);
}
const opt = Object.fromEntries(flags.filter((f) => f.startsWith('--')).map((f) => { const [k, v] = f.slice(2).split('='); return [k, v ?? true]; }));

const hex = (c) => (c ? c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : 'none');

const occt = await occtInit({ locateFile: (f) => join(toolsDir, 'node_modules/occt-import-js/dist', f) });
const res = occt.ReadStepFile(new Uint8Array(readFileSync(input)), { linearUnit: 'millimeter', linearDeflection: 0.05, angularDeflection: 0.3 });
if (!res.success) { console.error('doc STEP that bai'); process.exit(1); }

function bbox(pos) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  return { lo, hi };
}

if (cmd === 'info') {
  res.meshes.forEach((m, i) => {
    const b = bbox(m.attributes.position.array);
    const f = (a) => a.map((v) => v.toFixed(2)).join(',');
    console.log(`#${i} ${m.name || ''} color=${hex(m.color)} tris=${m.index.array.length / 3} lo=[${f(b.lo)}] hi=[${f(b.hi)}]`);
  });
  process.exit(0);
}

// ---- convert ----
const keep = opt.keep ? new RegExp(opt.keep) : null;
const drop = opt.drop ? new RegExp(opt.drop) : null;
const [rotAxis, rotDeg] = (opt.rotate || 'x:-90').split(':'); // KiCad Z-lên -> three Y-lên
const rad = (Number(rotDeg) * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
const rot = (x, y, z) => (rotAxis === 'x' ? [x, y * c - z * s, y * s + z * c] : rotAxis === 'y' ? [x * c + z * s, y, -x * s + z * c] : [x * c - y * s, x * s + y * c, z]);
const dec = Number(opt.decimals ?? 3);
const q = (v) => Number(v.toFixed(dec));

const mats = new Map(); // màu -> chỉ số vật liệu
const materials = [];
const prims = [];
const bufs = [];
let byteLen = 0;
const push = (typed) => { const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); const off = byteLen; bufs.push(b); byteLen += b.length; const pad = (4 - (b.length % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); byteLen += pad; } return { off, len: b.length }; };
const views = [], accs = [];

let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (const m of res.meshes) {
  const col = hex(m.color);
  if (keep && !keep.test(col)) continue;
  if (drop && drop.test(col)) continue;
  const src = m.attributes.position.array, n = src.length / 3;
  const pos = new Float32Array(src.length);
  for (let i = 0; i < n; i++) { const [x, y, z] = rot(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]); pos[i * 3] = q(x); pos[i * 3 + 1] = q(y); pos[i * 3 + 2] = q(z); }
  const nsrc = m.attributes.normal ? m.attributes.normal.array : null;
  const nor = new Float32Array(src.length);
  if (nsrc) for (let i = 0; i < n; i++) { const [x, y, z] = rot(nsrc[i * 3], nsrc[i * 3 + 1], nsrc[i * 3 + 2]); nor[i * 3] = q(x); nor[i * 3 + 1] = q(y); nor[i * 3 + 2] = q(z); }
  let idx = new Uint32Array(m.index.array);
  if (opt.clipz != null) { // bỏ tam giác nằm dưới mặt mạch (chân hàn): mọi đỉnh có z gốc < clipz
    const z0 = Number(opt.clipz), keepTri = [];
    for (let t = 0; t < idx.length; t += 3) if ([0, 1, 2].some((k) => src[idx[t + k] * 3 + 2] >= z0 - 1e-4)) keepTri.push(idx[t], idx[t + 1], idx[t + 2]);
    idx = new Uint32Array(keepTri);
  }
  const b = bbox(pos); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.lo[k]); hi[k] = Math.max(hi[k], b.hi[k]); }
  if (!mats.has(col)) {
    mats.set(col, materials.length);
    const rgb = m.color ? m.color.map((v) => v) : [0.7, 0.7, 0.7];
    materials.push({ name: col, pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0.0, roughnessFactor: 0.6 } });
  }
  const vp = push(pos), vn = push(nor), vi = push(idx);
  const bvP = views.push({ buffer: 0, byteOffset: vp.off, byteLength: vp.len, target: 34962 }) - 1;
  const bvN = views.push({ buffer: 0, byteOffset: vn.off, byteLength: vn.len, target: 34962 }) - 1;
  const bvI = views.push({ buffer: 0, byteOffset: vi.off, byteLength: vi.len, target: 34963 }) - 1;
  const aP = accs.push({ bufferView: bvP, componentType: 5126, count: n, type: 'VEC3', min: b.lo, max: b.hi }) - 1;
  const aN = accs.push({ bufferView: bvN, componentType: 5126, count: n, type: 'VEC3' }) - 1;
  const aI = accs.push({ bufferView: bvI, componentType: 5125, count: idx.length, type: 'SCALAR' }) - 1;
  prims.push({ attributes: { POSITION: aP, NORMAL: aN }, indices: aI, material: mats.get(col) });
}
if (!prims.length) { console.error('khong con mesh nao sau khi loc'); process.exit(1); }

const json = {
  asset: { version: '2.0', generator: 'sac-pin step2glb (occt-import-js)', copyright: 'KiCad Library Team, kicad-packages3D, CC-BY-SA 4.0 with KiCad exception' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: prims }],
  materials, bufferViews: views, accessors: accs, buffers: [{ byteLength: byteLen }],
};
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const bin = Buffer.concat(bufs);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
writeFileSync(output, Buffer.concat([head, ch(jsonBuf.length, 0x4e4f534a), jsonBuf, ch(bin.length, 0x004e4942), bin]));
console.log(`ok ${output}: ${prims.length} mesh, ${(12 + 8 + jsonBuf.length + 8 + bin.length) / 1024 | 0} KB, bbox lo=${lo.map((v) => v.toFixed(2))} hi=${hi.map((v) => v.toFixed(2))}`);
