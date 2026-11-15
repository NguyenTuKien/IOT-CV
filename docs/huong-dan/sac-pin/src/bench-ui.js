/* Bàn thực hành 3D: giao diện HTML phủ lên khung 3D (CSS tiêm lúc dùng, mọi class có tiền tố .bench-). */

export const BENCH_CSS = `
.bench-root{display:grid;gap:14px;outline:none}
.bench-stage{position:relative;height:clamp(400px,66vh,700px);border-radius:20px;overflow:hidden;background:var(--surface-2);border:1px solid var(--line);touch-action:none;user-select:none;-webkit-user-select:none}
.bench-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.bench-views{position:absolute;top:10px;left:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:4;pointer-events:none}
.bench-views .chip{pointer-events:auto;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(6px);padding:5px 11px;font-size:13px}
.bench-views .chip.on{background:var(--ink);color:var(--bg)}
.bench-hint{position:absolute;left:12px;bottom:10px;right:12px;font-size:12.5px;color:var(--ink-2);pointer-events:none;text-shadow:0 0 6px var(--surface-2),0 0 2px var(--surface-2);z-index:3}
.bench-toast{position:absolute;left:50%;top:52px;transform:translate(-50%,-8px);max-width:min(560px,92%);padding:9px 14px;border-radius:12px;background:var(--warn-soft);color:var(--warn);border:1px solid var(--warn);font-size:13.5px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:6;text-align:center}
.bench-toast.on{opacity:1;transform:translate(-50%,0)}
.bench-toast.bad{background:var(--danger-soft);color:var(--danger);border-color:var(--danger)}
.bench-toast.ok{background:var(--ok-soft);color:var(--ok);border-color:var(--ok)}
.bench-over{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.bench-tag{position:absolute;transform:translate(-50%,-100%);padding:2px 8px;border-radius:999px;background:var(--accent);color:#fff;font:600 11.5px/1.5 var(--font);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);display:none}
.bench-tag.dim{background:var(--ink-2)}
.bench-cells{position:absolute;display:none;transform:translate(-50%,-100%);padding:6px 8px 5px;border-radius:12px;background:color-mix(in srgb,var(--surface) 90%,transparent);border:1px solid var(--line);box-shadow:0 4px 14px rgba(0,0,0,.2);font:600 11px/1.2 var(--mono)}
.bench-cells .row{display:flex;gap:6px;align-items:flex-end}
.bench-cell{display:grid;gap:2px;justify-items:center;width:30px}
.bench-cell i{display:block;position:relative;width:18px;height:54px;border-radius:5px;background:var(--surface-2);border:1px solid var(--line);overflow:hidden}
.bench-cell i b{position:absolute;left:0;right:0;bottom:0;border-radius:3px 3px 0 0;transition:height .15s linear,background .15s linear}
.bench-cell.bal i{outline:2px solid var(--warn);outline-offset:1px}
.bench-cells small{display:block;text-align:center;margin-top:3px;font:500 10.5px var(--font);color:var(--ink-2)}
.bench-ring{position:absolute;width:62px;height:62px;margin:-31px 0 0 -31px;display:none;transform:rotate(-90deg)}
.bench-ring circle{fill:none;stroke:#ffd54a;stroke-width:5;stroke-linecap:round;stroke-dasharray:157;stroke-dashoffset:157;filter:drop-shadow(0 0 4px rgba(255,213,74,.9))}
.bench-bell{position:absolute;right:14px;top:50px;font-size:22px;opacity:0;transition:opacity .25s;z-index:5;pointer-events:none}
.bench-bell.on{opacity:1}
.bench-ctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;font-size:13.5px;color:var(--ink-2)}
.bench-ctl .chips{display:inline-flex;gap:6px;flex-wrap:wrap}
.bench-ctl .chip.on{background:var(--accent);color:#fff}
.bench-ctl select{max-width:100%}
.bench-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:860px){.bench-grid{grid-template-columns:minmax(0,1fr)}.bench-stage{height:clamp(360px,58vh,560px)}}
.bench-stat{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;margin:0 0 10px}
.bench-stat div{padding:8px 10px;border-radius:10px;background:var(--surface-2)}
.bench-stat b{display:block;font:600 17px/1.2 var(--mono)}
.bench-stat span{display:block;font-size:11.5px;color:var(--ink-2);margin-top:2px}
.bench-expl{font-size:14px;color:var(--ink-2);margin:0}
.bench-expl b{color:var(--ink)}
.bench-steps{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.bench-steps li{display:grid;grid-template-columns:22px 1fr;gap:8px;padding:6px 8px;border-radius:9px;font-size:13.5px;background:var(--surface-2);color:var(--ink-2)}
.bench-steps li i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;border:1.5px solid var(--ink-3);color:var(--ink-3)}
.bench-steps li.done{color:var(--ink)}
.bench-steps li.done i{background:var(--ok);border-color:var(--ok);color:#fff}
.bench-steps li.now{outline:2px solid var(--accent);color:var(--ink)}
.bench-steps li.bad i{background:var(--danger);border-color:var(--danger);color:#fff}
.bench-chart svg{width:100%;height:auto;display:block}
.bench-chart .lg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ink-2);margin-bottom:4px}
.bench-chart .lg i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle}
@media(max-width:620px){.bench-views .chip{padding:3px 9px;font-size:12px}.bench-cells{transform:translate(-50%,-100%) scale(.68);transform-origin:50% 100%}.bench-hint{font-size:11.5px}}
.bench-loading{position:absolute;inset:0;display:grid;place-items:center;font-size:14px;color:var(--ink-2)}
`;

export function ensureBenchStyle() {
  if (document.getElementById('bench-style')) return;
  const s = document.createElement('style'); s.id = 'bench-style'; s.textContent = BENCH_CSS; document.head.appendChild(s);
}

export function cellColor(v) {
  if (v < 3.45) return '#d6453a';
  if (v < 3.75) return '#e8892a';
  if (v < 4.05) return '#d6c230';
  if (v < 4.17) return '#8fc43c';
  return '#2fae5c';
}

// Biểu đồ nhỏ: điện áp pin (V), dòng (A), dung lượng (mAh). samples: [t, V, I, mAh]
export function drawBenchChart(svg, samples, n, Iset, qmax) {
  const W = 640, H = 190, L = 40, R = 40, Tp = 8, B = 22, pw = W - L - R, ph = H - Tp - B;
  const tmax = Math.max(600, samples.length ? samples[samples.length - 1][0] * 1.04 : 0);
  const vmin = n * 3.0, vmax = n * 4.3, imax = Math.max(3.2, (Iset || 3) * 1.1);
  const x = (t) => L + (t / tmax) * pw, yv = (v) => Tp + ph - ((v - vmin) / (vmax - vmin)) * ph, yi = (i) => Tp + ph - (i / imax) * ph, ym = (m) => Tp + ph - (m / qmax) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const yy = Tp + (ph * i) / 4;
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>`;
    g += `<text x="${L - 5}" y="${yy + 4}" text-anchor="end" font-size="10.5" fill="var(--ink-3)">${(vmax - ((vmax - vmin) * i) / 4).toFixed(1)}</text>`;
    g += `<text x="${W - R + 5}" y="${yy + 4}" font-size="10.5" fill="var(--ink-3)">${(imax - (imax * i) / 4).toFixed(1)}</text>`;
  }
  const stepMin = [5, 10, 15, 30, 60, 120, 240].find((m) => (tmax / 60) / m <= 6) || 240;
  for (let m = 0; m * 60 <= tmax; m += stepMin) g += `<text x="${x(m * 60)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--ink-3)">${m < 60 ? m + ' ph' : (m / 60).toFixed(m % 60 ? 1 : 0) + ' h'}</text>`;
  if (samples.length > 1) {
    const stride = Math.max(1, Math.ceil(samples.length / 400)), pick = samples.filter((_, i) => i % stride === 0 || i === samples.length - 1);
    const line = (fn, col) => `<polyline fill="none" stroke="${col}" stroke-width="2" points="${pick.map((p) => `${x(p[0]).toFixed(1)},${fn(p).toFixed(1)}`).join(' ')}"/>`;
    g += line((p) => ym(p[3]), 'var(--ok)') + line((p) => yv(p[1]), 'var(--accent)') + line((p) => yi(p[2]), 'var(--warn)');
  } else g += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="12.5" fill="var(--ink-3)">Chạy một lần sạc để vẽ đồ thị</text>`;
  svg.innerHTML = g;
}
