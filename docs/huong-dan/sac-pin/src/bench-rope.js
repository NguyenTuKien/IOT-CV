/* Bàn thực hành 3D: vật lý dây (PBD) + vật thể phẳng trên bàn. Không phụ thuộc three.js để kiểm thử được bằng node.
   Đơn vị mm, giây. Hệ: x phải, y lên, z về phía người xem. yaw quay từ +x sang +z: hướng thế giới của trục x cục bộ = (cos yaw, sin yaw).
   Điểm cục bộ (lx, lz) -> thế giới: x + lx*c - lz*s ; z + lx*s + lz*c. */

export const G = 9800;

export function makeBody(o) {
  const b = Object.assign({
    id: '', x: 0, z: 0, y: 0, yaw: 0, invM: 0.2, invI: 0.002, fixed: false,
    state: 'free',        // free | held | plugged | seating | fixed
    restY: 4, tens: [0, 0], tensEma: 0, radius: 10, guided: false,
  }, o);
  b.invMFree = b.invM; b.invIFree = b.invI;
  return b;
}

export function attachWorld(at, out) {
  const b = at.body;
  if (!b) { out[0] = at.wx; out[1] = at.wy; out[2] = at.wz; return out; }
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  out[0] = b.x + at.lx * c - at.lz * s;
  out[1] = b.y + (at.ly || 0);
  out[2] = b.z + at.lx * s + at.lz * c;
  return out;
}

export class Rope {
  // a, b: {body, lx, ly, lz} hoặc {wx, wy, wz} (đầu ghim vào thế giới)
  constructor(o) {
    this.id = o.id; this.n = o.n; this.length = o.length; this.r = o.radius; this.a = o.a; this.b = o.b;
    this.bend = o.bend == null ? 0.88 : o.bend; this.seg = o.length / (o.n - 1);
    this.P = new Float64Array(3 * o.n); this.Q = new Float64Array(3 * o.n);
    this.tmpA = [0, 0, 0]; this.tmpB = [0, 0, 0];
    this.init();
  }
  init() {
    const A = attachWorld(this.a, [0, 0, 0]), B = attachWorld(this.b, [0, 0, 0]), n = this.n;
    const dx = B[0] - A[0], dz = B[2] - A[2], d = Math.hypot(dx, dz) || 1;
    const sag = Math.max(0, this.length - d);             // phần dây thừa phình ra bên cạnh để khỏi căng ngay
    const nx = -dz / d, nz = dx / d, bulge = Math.sqrt(sag * d) * 0.35;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), k = Math.sin(Math.PI * u) * bulge;
      this.P[3 * i] = A[0] + dx * u + nx * k; this.P[3 * i + 1] = Math.max(this.r, A[1] + (B[1] - A[1]) * u); this.P[3 * i + 2] = A[2] + dz * u + nz * k;
    }
    this.Q.set(this.P);
  }
  // điểm trên dây theo tham số u (0..1)
  sample(u, out) {
    const f = Math.min(this.n - 1 - 1e-6, Math.max(0, u * (this.n - 1))), i = Math.floor(f), t = f - i, P = this.P;
    for (let k = 0; k < 3; k++) out[k] = P[3 * i + k] * (1 - t) + P[3 * (i + 1) + k] * t;
    return out;
  }
}

export class World {
  constructor(o) {
    this.ropes = []; this.bodies = [];
    this.charger = o.charger;               // {x0,x1,z0,z1,top}
    this.packs = [];                        // {body, L, W, H}
    this.iter = o.iter || 8; this.sub = o.sub || 2;
    this.damp = 0.985; this.maxMove = 0;
  }
  addBody(b) { this.bodies.push(b); return b; }
  addRope(r) { this.ropes.push(r); return r; }

  collideParticle(P, i, r) {
    const j = 3 * i;
    if (P[j + 1] < r) P[j + 1] = r;
    const c = this.charger;
    if (c && P[j] > c.x0 - r && P[j] < c.x1 + r && P[j + 2] > c.z0 - r && P[j + 2] < c.z1 + r && P[j + 1] < c.top + r) {
      const dl = P[j] - (c.x0 - r), dr = (c.x1 + r) - P[j], df = P[j + 2] - (c.z0 - r), db = (c.z1 + r) - P[j + 2], dt = (c.top + r) - P[j + 1];
      const m = Math.min(dl, dr, df, db, dt);
      if (m === dt) P[j + 1] = c.top + r; else if (m === dl) P[j] = c.x0 - r; else if (m === dr) P[j] = c.x1 + r; else if (m === df) P[j + 2] = c.z0 - r; else P[j + 2] = c.z1 + r;
    }
    for (const pk of this.packs) {
      const b = pk.body, cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
      const dx = P[j] - b.x, dz = P[j + 2] - b.z; let lx = dx * cs + dz * sn; const lz = -dx * sn + dz * cs;
      const trim = pk.trim || 0, hl = (pk.L - trim) / 2 + r, hw = pk.W / 2 + r, top = b.y + pk.H + r;
      const lxc = lx;
      lx -= -trim / 2;   // hộp va chạm ngắn hơn pin ở phía đầu dây ra, để điểm bám của dây không nằm trong hộp
      if (Math.abs(lx) < hl && Math.abs(lz) < hw && P[j + 1] < top && P[j + 1] > b.y - 1) {
        const ex = hl - Math.abs(lx), ez = hw - Math.abs(lz), ey = top - P[j + 1];
        const lw = lx + (-trim / 2);   // về lại toạ độ cục bộ gốc (tâm pin)
        if (ey <= ex && ey <= ez) P[j + 1] = top;
        else if (ex < ez) { const nl = Math.sign(lx || 1) * hl + (-trim / 2); P[j] = b.x + nl * cs - lz * sn; P[j + 2] = b.z + nl * sn + lz * cs; }
        else { const nz = Math.sign(lz || 1) * hw; P[j] = b.x + lw * cs - nz * sn; P[j + 2] = b.z + lw * sn + nz * cs; }
      }
    }
  }

  // Ràng buộc đầu dây với điểm bám trên vật thể. at.end = 0 (hạt đầu) hoặc n-1.
  pinEnd(rope, at, idx) {
    const P = rope.P, w = rope.tmpA;
    attachWorld(at, w);
    const j = 3 * idx;
    let cx = w[0] - P[j], cy = w[1] - P[j + 1], cz = w[2] - P[j + 2];
    const d = Math.hypot(cx, cy, cz);
    if (d < 1e-9) return;
    const nx = cx / d, ny = cy / d, nz = cz / d, b = at.body;
    if (!b || b.state === 'fixed') { P[j] += cx; P[j + 1] += cy; P[j + 2] += cz; return; }
    const co = Math.cos(b.yaw), si = Math.sin(b.yaw);
    const rx = at.lx * co - at.lz * si, rz = at.lx * si + at.lz * co;
    const torque = rz * nx - rx * nz;                  // dyaw ∝ torque
    const nxz2 = nx * nx + nz * nz;
    const locked = b.state === 'plugged' || b.state === 'seating';
    const held = b.state === 'held';
    const invM = locked || held ? 0 : b.invM, invI = locked || held ? 0 : b.invI;
    const wb = invM * nxz2 + invI * torque * torque;
    const lam = d / (1 + wb);
    P[j] += nx * lam; P[j + 1] += ny * lam; P[j + 2] += nz * lam;
    if (invM || invI) {
      // ma sát tĩnh: lực kéo quá nhỏ không làm vật nhúc nhích
      const mx = nx * lam * invM, mz = nz * lam * invM;
      if (Math.hypot(mx, mz) > 0.12) { b.x -= mx; b.z -= mz; b.yaw += torque * lam * invI; }
    }
  }

  step(dt) {
    const h = dt / this.sub;
    for (let s = 0; s < this.sub; s++) this.substep(h);
    this.measureTension();
    let mm = 0;   // chuyển dịch lớn nhất của một hạt dây trong bước con vừa rồi (mm): dưới ngưỡng thì dây đã yên
    for (const rp of this.ropes) { const P = rp.P, Q = rp.Q; for (let i = 0; i < P.length; i++) { const d = Math.abs(P[i] - Q[i]); if (d > mm) mm = d; } }
    this.maxMove = mm;
  }

  // Lực kéo = độ DÃN hình học của sợi dây: khoảng cách hai đầu bám trừ chiều dài dây. Vật bị giữ (đã cắm / đang cầm)
  // nhận vector kéo về phía đầu kia của dây. Đo bằng hình học chứ không bằng hiệu chỉnh của bộ giải, vì bộ giải
  // cũng "đuổi theo" điểm bám khi vật bị dịch chuyển nhanh (lúc cắm), không phải lực căng thật.
  measureTension() {
    for (const b of this.bodies) { b.tens[0] = 0; b.tens[1] = 0; }
    const A = [0, 0, 0], B = [0, 0, 0];
    for (const rp of this.ropes) {
      attachWorld(rp.a, A); attachWorld(rp.b, B);
      const dx = B[0] - A[0], dz = B[2] - A[2], dy = B[1] - A[1], d = Math.hypot(dx, dy, dz), ex = d - rp.length;
      if (ex <= 0) continue;
      const ux = dx / d, uz = dz / d;
      const ba = rp.a.body, bb = rp.b.body;
      if (ba && (ba.state === 'plugged' || ba.state === 'seating')) { ba.tens[0] += ux * ex; ba.tens[1] += uz * ex; }
      if (bb && (bb.state === 'plugged' || bb.state === 'seating')) { bb.tens[0] -= ux * ex; bb.tens[1] -= uz * ex; }
    }
    for (const b of this.bodies) { const m = Math.hypot(b.tens[0], b.tens[1]); b.tensEma += (m - b.tensEma) * 0.4; }
  }

  substep(h) {
    for (const rp of this.ropes) {
      const P = rp.P, Q = rp.Q, n = rp.n, g = G * h * h;
      for (let i = 0; i < n; i++) {
        const j = 3 * i;
        const vx = (P[j] - Q[j]) * this.damp, vy = (P[j + 1] - Q[j + 1]) * this.damp, vz = (P[j + 2] - Q[j + 2]) * this.damp;
        Q[j] = P[j]; Q[j + 1] = P[j + 1]; Q[j + 2] = P[j + 2];
        // ma sát bàn: dây nằm trên bàn mất gần hết tốc độ ngang
        const onT = P[j + 1] <= rp.r + 0.3;
        const f = onT ? 0.55 : 1;
        P[j] += vx * f; P[j + 1] += vy - g; P[j + 2] += vz * f;
      }
    }
    for (let it = 0; it < this.iter; it++) {
      for (const rp of this.ropes) {
        const P = rp.P, n = rp.n, L = rp.seg;
        this.pinEnd(rp, rp.a, 0);
        this.pinEnd(rp, rp.b, n - 1);
        for (let i = 0; i < n - 1; i++) {
          const j = 3 * i, k = j + 3;
          const dx = P[k] - P[j], dy = P[k + 1] - P[j + 1], dz = P[k + 2] - P[j + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-9, e = (d - L) / d * 0.5;
          P[j] += dx * e; P[j + 1] += dy * e; P[j + 2] += dz * e;
          P[k] -= dx * e; P[k + 1] -= dy * e; P[k + 2] -= dz * e;
        }
        if (rp.bend > 0) {
          const minD = 2 * L * rp.bend;
          for (let i = 1; i < n - 3; i++) {   // bỏ hai đầu: độ cứng uốn của dây không được đẩy vật ở đầu dây
            const j = 3 * i, k = j + 6;
            const dx = P[k] - P[j], dy = P[k + 1] - P[j + 1], dz = P[k + 2] - P[j + 2];
            const d = Math.hypot(dx, dy, dz) || 1e-9;
            if (d < minD) { const e = (d - minD) / d * 0.25; P[j] += dx * e; P[j + 1] += dy * e; P[j + 2] += dz * e; P[k] -= dx * e; P[k + 1] -= dy * e; P[k + 2] -= dz * e; }
          }
        }
        for (let i = 0; i < n; i++) this.collideParticle(P, i, rp.r);
      }
    }
  }

  // đẩy vật thể phẳng ra khỏi thân máy sạc
  collideBody(b) {
    const c = this.charger; if (!c || b.guided) return;
    const r = b.radius;
    if (b.x > c.x0 - r && b.x < c.x1 + r && b.z > c.z0 - r && b.z < c.z1 + r && b.y < c.top + 8) {
      const dl = b.x - (c.x0 - r), dr = (c.x1 + r) - b.x, df = b.z - (c.z0 - r), db = (c.z1 + r) - b.z, m = Math.min(dl, dr, df, db);
      if (m === dl) b.x = c.x0 - r; else if (m === dr) b.x = c.x1 + r; else if (m === df) b.z = c.z0 - r; else b.z = c.z1 + r;
    }
  }
}
