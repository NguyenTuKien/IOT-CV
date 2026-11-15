/* Chương 1 — Làm quen máy: 3D cục sạc, từng mặt có chú thích đánh số, thông số, đồ trong hộp.
   Nguồn số liệu: manual V3.10/V3.20 (tr.2, 5, 21, 22), plans/reports/261026-research-b6ac-v2-manual.md và
   261026-research-b6ac-3d-va-video.md. Chỗ đo từ ảnh gắn {est}. */
(function () {
  'use strict';
  const { h } = SAC;

  // ---- Dữ liệu từng mặt: part = ID bộ phận dùng chung với 3D và SVG ----
  const FACES = [
    {
      id: 'top', label: 'Mặt trên', view: 'top',
      items: [
        { part: 'lcd', name: 'Màn hình LCD', d: 'Hai dòng, mỗi dòng 16 ký tự. Đèn nền xanh dương.' },
        { part: 'btn-batt', name: 'BATT/PROG · Stop', d: 'Dừng tiến trình, lùi một màn.' },
        { part: 'btn-dec', name: 'DEC', d: 'Lùi menu, giảm giá trị. Khi đang chạy: xem trạng thái.' },
        { part: 'btn-inc', name: 'INC', d: 'Tiến menu, tăng giá trị. Khi đang chạy: xem áp từng cell.' },
        { part: 'btn-enter', name: 'ENTER · Start', d: 'Sửa hoặc lưu giá trị. **Giữ 3 giây** để bắt đầu sạc.' },
        { part: null, name: 'Dải nhãn chế độ', d: 'LiPo/LiFe/LiIon/LiHV 1–6S · NiMH/NiCd 1–15S · Pb 2–20 V · Charge 0,1–6,0 A · Discharge 0,1–2,0 A · Circuit Power 50 W.' },
      ],
    },
    {
      id: 'right', label: 'Cạnh phải', view: 'right',
      items: [
        { part: 'out-neg', name: 'Cực âm (−), lỗ đen', d: 'Lỗ banana 4 mm, nhãn OUTPUT.' },
        { part: 'out-pos', name: 'Cực dương (+), lỗ đỏ', d: 'Dây sạc chính cắm vào hai lỗ này.' },
        { part: 'bal-4s', name: 'Ổ cân bằng 4 cells', d: 'Ổ 5 chân, dành cho pin 4S của bạn. Dây đen khớp dấu âm (−).' },
        { part: 'bal-3s', name: 'Ổ cân bằng 3 cells', d: '4 chân. Không dùng cho pin 4S.' },
        { part: 'bal-2s', name: 'Ổ cân bằng 2 cells', d: '3 chân. Không dùng cho pin 4S.' },
        { part: 'bal-6s', name: 'Ổ cân bằng 6 cells', d: '7 chân, hàng dưới. Không dùng cho pin 4S.' },
        { part: 'bal-5s', name: 'Ổ cân bằng 5 cells', d: '6 chân, hàng dưới. Không dùng cho pin 4S.' },
      ],
      note: { cls: 'warn', text: '**Mỗi lần chỉ cắm một pin** vào ổ cân bằng. Cắm sai cực có thể hỏng máy.' },
    },
    {
      id: 'left', label: 'Cạnh trái', view: 'left',
      items: [
        { part: 'ac-inlet', name: 'Ổ AC IN', d: '100–240 V, 50/60 Hz. Dây nguồn đầu C5 (ba lá) kèm máy.' },
        { part: 'dc-jack', name: 'Jack DC IN', d: '11–18 V, dùng với dây số 4 (kẹp cá sấu) vào ắc quy 12 V. Đường kính jack: chưa xác minh.' },
        { part: 'usb-pclink', name: 'Micro USB PC LINK', d: 'Nối máy tính chạy Charger Master. Cần cáp USB A ↔ micro-B có dữ liệu, không kèm máy.' },
        { part: 'temp-port', name: 'Cổng đầu dò nhiệt', d: 'Cần đầu dò SK-600040, bán riêng. Không có đầu dò thì chỉ báo nhiệt trong máy.' },
      ],
      note: { cls: 'note', text: 'Sách V3.10 vẽ cụm cổng này ở "mặt sau". Ảnh chụp thật cho thấy nó nằm ở cạnh trái.' },
    },
    {
      id: 'back', label: 'Mặt sau', view: 'back',
      items: [
        { part: 'heatsink', name: 'Cánh tản nhiệt', d: 'Nhôm, sọc ngang ở hai cạnh dài. Sách không nhắc tới quạt.' },
      ],
    },
    {
      id: 'bottom', label: 'Mặt đáy', view: 'bottom',
      items: [
        { part: 'label-bottom', name: 'Tem hologram', d: 'Hàng thật có tem chống giả kèm mã bảo mật 12 chữ số.' },
        { part: 'feet', name: 'Bốn chân đen', d: 'Giữ máy cách mặt bàn.' },
      ],
    },
  ];

  // Trong hộp — theo manual tr.21 "THE SET CONTAINS" (đánh số đúng thứ tự sách)
  const BOX = [
    { part: null, name: 'Máy sạc iMAX B6AC V2', d: 'Mã hàng SK-100008.' },
    { part: 'cable-ac', name: 'Dây nguồn AC', d: 'Đầu C5 (ba lá).' },
    { part: 'cable-banana-t', name: 'Dây sạc banana 4 mm ↔ T-plug', d: 'Banana vào hai lỗ OUTPUT, T-plug nối dây 8.' },
    { part: 'cable-dc-clips', name: 'Dây DC jack tròn ↔ kẹp cá sấu', d: 'Lấy điện từ ắc quy 12 V.' },
    { part: 'adapter-t-clips', name: 'T-plug ↔ kẹp cá sấu', d: 'Không cần cho pin XT60.' },
    { part: 'adapter-t-futaba', name: 'T-plug ↔ Futaba', d: 'Không cần cho pin XT60.' },
    { part: 'adapter-t-jst', name: 'T-plug ↔ JST', d: 'Không cần cho pin XT60.' },
    { part: 'adapter-t-xt60', name: 'T-plug ↔ XT60', d: 'Nối dây 3 với XT60 của pin.' },
  ];

  const SPEC_POWER = [
    ['Nguồn AC vào', '100–240 V, 50/60 Hz (nguồn xung tích hợp)'],
    ['Nguồn DC vào', '11–18 V'],
    ['Dòng sạc', '0,1–6,0 A, **tối đa 50 W**'],
    ['Dòng xả', '0,1–2,0 A, **tối đa 5 W**'],
    ['Dòng cân bằng', '200 mA mỗi cell, 2–6 cell'],
    ['LiPo/LiIon/LiFe/LiHV', '1–6S'],
    ['NiMH/NiCd', '1–15 cell'],
    ['Pb (chì)', '2–20 V'],
    ['Sạc đầy LiPo (TVC)', '4,18–4,25 V/cell, chỉnh được'],
    ['Ngắt khi xả LiPo', '3,0–3,3 V/cell'],
    ['Dải dung lượng', '100–50 000 mAh'],
    ['Dải đo điện áp', '0,1–25,8 V'],
  ];
  const SPEC_BODY = [
    ['Kích thước', '135 × 144 × 36 mm'],
    ['Khối lượng', '632 g'],
    ['Vỏ', 'Kim loại, 4 nút bấm'],
    ['Màn hình', 'LCD 2 × 16, đèn nền xanh dương'],
    ['Hẹn giờ an toàn', '1–720 phút hoặc tắt'],
    ['Ngắt theo nhiệt độ', '20–80 °C, cần đầu dò SK-600040'],
    ['Bộ nhớ', '10 hồ sơ sạc/xả'],
    ['Cách sạc', 'CC/CV cho Li và Pb, dò delta-peak cho NiMH/NiCd'],
    ['Chứng nhận', 'CE, FCC Part 15B'],
    ['Bảo hành', '1 năm, ở nước mua'],
  ];
  const SPEC_EST = [
    ['Hai lỗ banana', 'cách nhau ~13–14 mm {est}, viền ~11 mm {est}'],
    ['Khối ổ cân bằng', 'rộng ~40 mm {est}, mỗi hàng cao ~6 mm {est}'],
    ['Cửa sổ LCD', '~66 × 20 mm {est}'],
    ['Nút bấm', 'ø ~8 mm {est}, cách nhau ~18–20 mm {est}'],
    ['Chân đế', 'cao ~4–5 mm {est}'],
  ];

  function stat(val, unit, label) {
    return h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, h('span', { class: 'stat-unit' }, unit)),
      h('span', { class: 'stat-label' }, label));
  }

  // Hình + danh sách chú thích đánh số. Rê chuột / bấm vào dòng thì tô sáng bộ phận trên SVG (và 3D qua onHover).
  function callout(svg, items, onHover) {
    const lis = [];
    const state = { pinned: null };
    function paint(part) {
      lis.forEach((li) => li.classList.toggle('on', !!part && li.dataset.part === part));
      SAC.diag.highlight(svg, part || null);
      if (onHover) onHover(part || null);
    }
    items.forEach((it, i) => {
      const li = h('li', it.part ? { 'data-part': it.part, style: 'cursor:pointer' } : null,
        h('div', { class: 'pin-label' }, i + 1),
        h('div', null, h('b', null, it.name), h('span', null, SAC.rich(it.d))));
      if (it.part) {
        li.addEventListener('mouseenter', () => paint(it.part));
        li.addEventListener('mouseleave', () => paint(state.pinned));
        li.addEventListener('click', () => {
          state.pinned = state.pinned === it.part ? null : it.part;
          paint(state.pinned);
        });
      }
      lis.push(li);
    });
    const el = h('div', { class: 'callout-fig' }, h('div', { class: 'fig' }, svg), h('ol', null, lis));
    return { el, pin(part) { state.pinned = part; paint(part); } };
  }

  const DEF = {
    num: 1,
    title: 'Làm quen với cục sạc',
    short: 'Làm quen máy',
    kicker: 'Cục sạc B6AC V2',
    lead: 'Một hộp nhôm, bốn nút, một màn hình. Xoay máy, bấm vào từng bộ phận để biết nó làm gì.',
  };

  SAC.chapter('may', Object.assign({}, DEF, {
    render(root) {
      root.appendChild(SAC.head(DEF));

      // ---- 3D + chọn mặt ----
      let viewer = null;
      const view = h('div', { class: 'v3d' });
      const host = h('div', { class: 'stack' });
      const chipEls = {};
      const chips = h('div', { class: 'chips', style: 'margin:14px 0 22px' });

      function show(id, part, fromPick) {
        const face = FACES.find((f) => f.id === id);
        Object.keys(chipEls).forEach((k) => chipEls[k].classList.toggle('on', k === id));
        const c = callout(SAC.diag.face(face.view), face.items, (p) => { if (viewer) viewer.highlight(p); });
        // replaceChildren(null) in ra chữ "null" — chỉ truyền phần tử có thật.
        host.replaceChildren(...[c.el, face.note ? h('p', { class: face.note.cls }, SAC.rich(face.note.text)) : null].filter(Boolean));
        if (viewer && !fromPick) viewer.setView(face.view);
        if (part) c.pin(part);
      }

      FACES.forEach((f) => {
        chipEls[f.id] = h('button', { class: 'chip', type: 'button', onclick: () => show(f.id) }, f.label);
        chips.appendChild(chipEls[f.id]);
      });
      chips.appendChild(h('button', { class: 'chip', type: 'button', onclick: () => viewer && viewer.setView('iso') }, 'Toàn cảnh 3D'));

      root.append(view, chips, host);
      show('top');

      requestAnimationFrame(() => {
        viewer = SAC.view3d(view, {
          scene: 'charger', view: 'iso', hotspots: true,
          onPick(part) {
            const face = FACES.find((f) => f.items.some((i) => i.part === part));
            if (face) show(face.id, part, true);
          },
        });
      });

      // ---- Ba con số ----
      root.appendChild(h('div', { class: 'stats space' },
        stat('50', 'W', 'công suất sạc tối đa'),
        stat('6,0', 'A', 'dòng sạc tối đa'),
        stat('200', 'mA', 'dòng cân bằng mỗi cell'),
        stat('632', 'g', '135 × 144 × 36 mm')));

      // ---- Trong hộp ----
      const box = callout(SAC.diag.boxContents(), BOX);
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Trong hộp'),
        box.el,
        h('div', { class: 'grid-2', style: 'margin-top:20px' },
          h('p', { class: 'note' }, SAC.rich('**Không kèm máy:** cáp USB (A ↔ micro-B) và đầu dò nhiệt SK-600040. Cáp USB phải có dữ liệu: dùng cáp micro USB đã nạp bo ESP32 DroneBridge. Theo sách V3.10/V3.20, tr.21.')),
          h('p', { class: 'tip' }, SAC.rich('**Đường sạc của bạn:** OUTPUT → dây **3** → dây **8** → XT60 của pin. Các dây 4–7 không dùng cho pin 4S.')))));

      // ---- Thông số ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Thông số'),
        h('div', { class: 'grid-2' },
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Điện'), SAC.table(null, SPEC_POWER, 'kv')),
          h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Thân máy'), SAC.table(null, SPEC_BODY, 'kv'))),
        h('p', { class: 'note', style: 'margin-top:20px' }, SAC.rich('**Sạc pin 4S:** 50 W ÷ 16,8 V ≈ 3,0 A. Đặt 3,0 A, máy tự giới hạn theo công suất.')),
        h('div', { class: 'card flat', style: 'margin-top:20px' },
          h('div', { class: 'card-title' }, 'Kích thước chi tiết, đo từ ảnh'),
          SAC.table(null, SPEC_EST, 'kv'),
          h('p', { style: 'margin-top:10px;font-size:14px;color:var(--ink-2)' }, SAC.rich('Thang đo lấy từ ảnh Pololu, độ tin cậy trung bình đến thấp. Chưa có số đo trên máy thật.')))));

      // ---- Hàng thật ----
      root.appendChild(h('div', { class: 'space' },
        h('h3', null, 'Nhận hàng thật và đọc phiên bản'),
        h('div', { class: 'card flat' }, SAC.table(null, [
          ['Mặt đáy', 'Tem hologram chống giả, mã bảo mật 12 chữ số.'],
          ['Serial', '[[BATT/PROG]] → `SYSTEM SETTING` → `Serial Number` (6 chữ số).'],
          ['Phiên bản', 'Cùng mục `Version`: `HW:` và `FW:`.'],
          ['FW 1.13 trở lên', 'Thêm chế độ LiHV và tuỳ chọn bật/tắt yêu cầu dây cân bằng.'],
        ], 'kv'))));
    },
  }));
})();
