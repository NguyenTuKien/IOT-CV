/* Chương mở đầu: 3D cục sạc + pin, ba con số cần nhớ, mục lục dạng thẻ. Mẫu phong cách cho các chương khác. */
SAC.chapter('hero', {
  num: 0,
  title: 'Sạc pin 4S đúng cách với B6AC V2',
  render(root) {
    const { h } = SAC;
    const view = h('div', { class: 'v3d' });
    const left = h('div', null, view);
    const right = h('div', null,
      h('span', { class: 'kicker' }, 'SkyRC iMAX B6AC V2 · Ovonic 4S 5300 mAh'),
      h('h1', null, 'Sạc pin 4S đúng cách.'),
      h('p', { class: 'lead' }, 'Nối dây, đọc màn hình, sạc cân bằng, cất giữ, đo nội trở và nối máy tính. Viết cho đúng bộ đồ của drone IOT-CV.'),
      h('div', { class: 'stats space' },
        stat('3,0', 'A', 'dòng sạc tối đa cho pin 4S (giới hạn 50 W)'),
        stat('4,20', 'V', 'mỗi cell khi đầy — 16,80 V cả pin'),
        stat('3,85', 'V', 'mỗi cell khi cất giữ quá 2 ngày')),
      h('p', { class: 'warn space' }, h('b', null, 'Luôn sạc cân bằng, trong túi chống cháy, có người trông.'),
        'Không sạc pin phồng, pin còn nóng sau khi bay, hay pin có cell dưới 3,0 V.'));
    root.append(left, right);

    const toc = h('nav', { class: 'toc', style: 'grid-column: 1 / -1' });
    for (const id of SAC.ORDER) {
      if (id === 'hero') continue;
      const def = SAC.chapters[id];
      if (!def) continue;
      toc.appendChild(h('a', { href: '#ch-' + id }, h('b', null, String(def.num).padStart(2, '0')), def.short || def.title));
    }
    root.appendChild(toc);

    // 3D mount sau khi khung đã có kích thước
    requestAnimationFrame(() => {
      SAC.view3d(view, { scene: 'hero', view: 'iso', hotspots: true, onPick: (part) => SAC.go(partChapter(part)) });
    });

    function stat(val, unit, label) {
      return h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, val, h('span', { class: 'stat-unit' }, unit)), h('span', { class: 'stat-label' }, label));
    }
    function partChapter(part) {
      if (!part) return 'may';
      if (part.startsWith('batt')) return 'pin';
      if (part.startsWith('cable') || part.startsWith('adapter') || part.startsWith('bal') || part.startsWith('out')) return 'noi-day';
      if (part === 'usb-pclink') return 'may-tinh';
      if (part.startsWith('btn') || part === 'lcd') return 'may-ao';
      return 'may';
    }
  },
});
