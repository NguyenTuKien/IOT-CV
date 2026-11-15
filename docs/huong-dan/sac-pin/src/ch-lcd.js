/* Chương 06: từ điển màn hình LCD. Dựng hoàn toàn từ SAC.LCD_FIELDS (data-menu.js); không phụ thuộc SAC.diag. */
SAC.chapter('lcd', {
  num: 6,
  short: 'Màn hình',
  title: 'Đọc màn hình LCD',
  render(root) {
    const { h } = SAC;
    root.appendChild(SAC.head({
      num: 6, kicker: 'Màn hình', title: 'Đọc màn hình LCD',
      lead: 'Mọi màn hình trong sách, từng trường một. Rê chuột lên một dòng trong bảng để thấy nó nằm ở đâu trên màn hình.',
    }));

    const groups = SAC.LCD_GROUPS;
    const entries = Object.values(SAC.LCD_FIELDS);

    root.appendChild(h('div', { class: 'chips', style: 'margin-bottom:28px' },
      groups.map((g, i) => h('a', { class: 'chip', href: '#lcd-g' + i }, g))));

    root.appendChild(h('div', { class: 'note', style: 'margin-bottom:28px' }, h('b', null, 'Cách đọc'),
      SAC.rich('Chữ trắng trên nền xanh (đèn nền LCD của máy là màu xanh dương) là đúng chuỗi in trong sách. Nhãn **suy luận** nghĩa là sách không in và chưa có ảnh máy thật. Các nút: [[BATT/PROG·Stop]] [[DEC]] [[INC]] [[ENTER·Start]].')));

    groups.forEach((g, gi) => {
      const list = entries.filter((e) => e.group === g);
      if (!list.length) return;
      const sec = h('section', { id: 'lcd-g' + gi, style: 'margin-top:40px' }, h('h3', null, g));
      const isErr = g === 'Thông báo lỗi';
      const grid = h('div', { class: isErr ? 'grid-3' : 'grid-2', style: 'margin-top:16px' });
      for (const e of list) grid.appendChild(isErr ? errCard(e) : screenCard(e));
      sec.appendChild(grid);
      if (isErr) sec.appendChild(h('p', { class: 'note', style: 'margin-top:16px' }, 'Nguyên nhân và cách xử lý từng lỗi: xem chương ', h('a', { href: '#ch-loi' }, 'Lỗi'), '.'));
      root.appendChild(sec);
    });

    function screenCard(e) {
      const mock = SAC.sim.lcdMock(e.lines[0], e.lines[1], { fields: e.fields.map((f) => ({ k: f.k, at: f.at })) });
      const rows = new Map();
      const table = h('table', { class: 'tbl', style: 'margin-top:12px' }, h('tbody', null, e.fields.map((f) => {
        const tr = h('tr', null,
          h('td', { style: 'width:1%;white-space:nowrap' }, h('span', { class: 'lcd-text' }, f.text)),
          h('td', null, h('b', null, f.name), f.inferred ? [' ', h('span', { class: 'est' }, 'suy luận')] : null, h('br'), SAC.rich(f.meaning)));
        rows.set(f.k + '|' + f.text, tr);
        tr.addEventListener('mouseenter', () => mock.mark(f.k));
        tr.addEventListener('mouseleave', () => mock.mark(null));
        return tr;
      })));
      mock.addEventListener('simfield', (ev) => { rows.forEach((tr, key) => tr.style.background = ev.detail && key.startsWith(ev.detail + '|') ? 'var(--accent-soft)' : ''); });
      return h('div', { class: 'card' },
        h('div', { class: 'card-title' }, e.title, e.inferred ? h('span', { class: 'est' }, 'suy luận') : null),
        mock, h('p', { style: 'margin-top:12px' }, SAC.rich(e.summary)),
        e.hint ? h('p', { class: 'tip', style: 'margin-top:8px' }, SAC.rich(e.hint)) : null,
        table, e.page ? h('p', { style: 'margin-top:8px;font-size:13px;color:var(--ink-3)' }, 'Sách tr.' + e.page) : null);
    }
    function errCard(e) {
      return h('div', { class: 'card' }, SAC.sim.lcdMock(e.lines[0], e.lines[1]), h('p', { style: 'margin-top:12px' }, SAC.rich(e.summary)));
    }
  },
});
