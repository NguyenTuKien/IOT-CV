/* Chương 3 — Nối dây: một đường sạc duy nhất (OUTPUT → dây 3 → dây 8 → XT60 của pin) + dây cân bằng vào ổ "4 cells".
   Nguồn: manual V3.10/V3.20 tr.10 (thứ tự nối, ghi chú một pin, cảnh báo), tr.20 (lỗi), tr.21 (đồ trong hộp).
   Thứ tự: phía máy trước, pin sau cùng; tháo ngược lại. */
(function () {
  'use strict';
  const { h } = SAC;

  // diag = bước trong SAC.diag.wiring(); lcd = màn hình cần thấy ở bước đó (nếu có)
  const CONNECT = [
    { diag: 'power', t: 'Cắm nguồn', d: 'Dây C5 vào ổ AC IN, hoặc dây số 4 vào ắc quy 12 V (11–18 V). **Chưa cắm pin.**' },
    { diag: 'main', t: 'Dựng đường sạc phía máy', d: 'Lắp dây **8** vào dây **3** (T-plug với T-plug). Banana: đỏ vào +, đen vào − (OUTPUT).' },
    { diag: 'main', t: 'Kiểm lần cuối thông số trên màn hình', d: 'Sai thông số có thể làm hỏng pin, thậm chí cháy nổ. Xem chương 5.', lcd: ['LiPo BALANCE CHG', '3.0A 14.8V (4S)'] },
    { diag: 'main', t: 'Cắm XT60 của dây 8 vào XT60 của pin', d: 'Phía máy xong rồi mới tới pin. **Chỉ một pin** mỗi lần.' },
    { diag: 'balance', t: 'Cắm dây cân bằng vào ổ 4 cells', d: 'Jack 5 chân vào ổ "4 cells". **Dây đen quay về phía dấu âm (−).**' },
  ];

  const DISCONNECT = [
    { t: 'Bấm [[BATT/PROG]] để dừng, nếu máy đang chạy.' },
    { t: 'Rút dây cân bằng khỏi ổ 4 cells.' },
    { t: 'Rút XT60 khỏi pin.', d: 'Pin tháo ra trước, máy tháo sau.' },
    { t: 'Rút banana khỏi OUTPUT, rồi rút nguồn.' },
  ];

  const ERR_TABLE = [
    ['`CONNECTION BREAK`', 'Mạch pin bị đứt. Kiểm hai đầu XT60 và các mối T-plug.'],
    ['`CONNECT ERROR` `CHECK MAIN PORT`', 'Pin cắm sai. Kiểm đường sạc chính.'],
    ['`BALANCE CONNECT ERROR`', 'Dây cân bằng cắm sai ổ hoặc sai chiều.'],
    ['`CELL NUMBER INCORRECT`', 'Số cell đặt khác số cell máy dò. Đặt lại 4S.'],
  ];

  function stepper() {
    let cur = 0;
    const figBox = h('div', { class: 'fig' });
    const lcdBox = h('div', { style: 'max-width:340px;margin:0 auto;padding:0 12px 14px' });
    const lis = [];
    function go(i) {
      cur = i;
      lis.forEach((li, k) => li.classList.toggle('on', k === cur));
      const s = CONNECT[cur];
      figBox.replaceChildren(SAC.diag.wiring(s.diag), lcdBox);
      lcdBox.replaceChildren(s.lcd ? SAC.diag.lcd(s.lcd[0], s.lcd[1]) : '');
    }
    CONNECT.forEach((s, i) => {
      const li = h('li', { style: 'cursor:pointer', tabindex: 0, role: 'button' },
        h('div', { class: 'pin-label' }, i + 1),
        h('div', null, h('b', null, s.t), h('span', null, SAC.rich(s.d))));
      li.addEventListener('click', () => go(i));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); } });
      lis.push(li);
    });
    const nav = h('div', { class: 'chips', style: 'margin-top:14px' },
      h('button', { class: 'chip', type: 'button', onclick: () => go(Math.max(0, cur - 1)) }, '← Bước trước'),
      h('button', { class: 'chip on', type: 'button', onclick: () => go(Math.min(CONNECT.length - 1, cur + 1)) }, 'Bước sau →'));
    go(0);
    return h('div', null,
      h('div', { class: 'callout-fig' }, figBox, h('div', null, h('ol', null, lis), nav)));
  }

  function mistake(title, step, lcd, text, extra) {
    return h('div', { class: 'card' },
      h('div', { class: 'card-title' }, title),
      h('div', { style: 'background:var(--surface-2);border-radius:var(--radius-s);padding:10px;margin-bottom:12px' }, SAC.diag.wiring(step)),
      h('div', { style: 'max-width:340px;margin:0 auto 12px' }, SAC.diag.lcd(lcd[0], lcd[1])),
      h('p', { class: 'danger' }, SAC.rich(text)),
      extra || null);
  }

  const DEF = {
    num: 3,
    title: 'Nối dây đúng thứ tự',
    short: 'Nối dây',
    kicker: 'Từ ổ điện tới pin',
    lead: 'Một đường sạc duy nhất. Phía máy nối trước, pin nối sau cùng. Tháo thì ngược lại.',
  };

  SAC.chapter('noi-day', Object.assign({}, DEF, {
    render(root) {
      root.appendChild(SAC.head(DEF));

      // ---- Đường sạc ----
      const chain = h('div', { class: 'chips', style: 'align-items:center;gap:10px' });
      ['OUTPUT trên máy', 'Dây 3: banana ↔ T-plug', 'Dây 8: T-plug ↔ XT60', 'XT60 của pin'].forEach((t, i) => {
        if (i) chain.appendChild(h('span', { style: 'color:var(--ink-3)' }, '→'));
        chain.appendChild(h('span', { class: 'chip on' }, t));
      });
      root.appendChild(h('div', { class: 'card flat' },
        h('div', { class: 'card-title' }, 'Đường sạc của bạn'),
        chain,
        h('p', { style: 'margin-top:12px' }, SAC.rich('Dây cân bằng của pin cắm thẳng vào ổ "4 cells". Không cần thêm dây hay mạch cân bằng rời.'))));

      // ---- Từng bước ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Năm bước nối'),
        stepper()));

      // ---- 3D ----
      const view = h('div', { class: 'v3d' });
      root.appendChild(h('div', { class: 'space' }, h('h3', null, 'Xem trong 3D'), view));
      requestAnimationFrame(() => { SAC.view3d(view, { scene: 'wiring', view: 'iso', hotspots: false }); });

      // ---- Tháo ----
      root.appendChild(h('div', { class: 'grid-2 space' },
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, 'Khi tháo: làm ngược lại'),
          SAC.steps('nd-thao', DISCONNECT)),
        h('div', { class: 'stack' },
          h('p', { class: 'warn' }, SAC.rich('**Vì sao phía máy trước:** để tránh chập giữa hai đầu banana (theo sách, tr.10).')),
          h('p', { class: 'danger' }, SAC.rich('**Không bao giờ** cắm hai pin vào ổ cân bằng cùng lúc. Một lần một pin.')))));

      // ---- Lỗi thường gặp ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Hai lỗi nối dây hay gặp'),
        h('div', { class: 'grid-2' },
          mistake('Quên dây cân bằng', 'wrong-no-balance', ['NO BALANCE CABLE', 'DETECTED'],
            '**Máy báo lỗi.** Pin của bạn có dây cân bằng, nên **đừng** bấm [[ENTER]] để chạy tiếp. Cắm dây cân bằng rồi sạc lại.'),
          mistake('Cắm ngược cực', 'wrong-reverse', ['REVERSE POLARITY', ''],
            '**Máy báo lỗi và kêu bíp.** Cắm sai như hình có thể làm hỏng máy. Rút ngay theo thứ tự ngược, kiểm lại dây đen/đỏ.')),
        h('div', { class: 'card', style: 'margin-top:20px' },
          h('div', { class: 'card-title' }, 'Máy báo gì khi nối sai'),
          SAC.table(['Màn hình', 'Làm gì'], ERR_TABLE),
          h('p', { class: 'note', style: 'margin-top:14px' }, SAC.rich('Đủ 16 thông báo lỗi ở '), h('a', { href: '#ch-loi' }, 'chương 8'), '.'))));
    },
  }));
})();
