/* Chương 07: 13 cài đặt hệ thống, giá trị khuyên dùng cho pin Ovonic 4S 5300 mAh. Dữ liệu ở SAC.MENU.settings. */
SAC.chapter('cai-dat', {
  num: 7,
  short: 'Cài đặt',
  title: 'Cài đặt hệ thống',
  render(root) {
    const { h } = SAC;
    const settings = SAC.MENU.settings;
    root.appendChild(SAC.head({
      num: 7, kicker: 'Cài đặt', title: '13 cài đặt, chỉnh 2 cái',
      lead: 'Vào `SYSTEM SETTING` ở cuối danh sách chương trình. Với pin 4S 5300 mAh chỉ cần đổi **Safety Timer** và **Capacity Cut-Off**. Còn lại giữ nguyên.',
    }));

    const changed = new Set(['timer', 'cap']);

    root.appendChild(h('div', { class: 'stats', style: 'margin-bottom:28px' },
      stat('180', 'phút', 'Safety Timer khuyên dùng (mặc định 120)'),
      stat('6000', 'mAh', 'Capacity Cut-Off khuyên dùng (mặc định 5000, thấp hơn pin 5300)'),
      stat('11', 'giữ nguyên', 'cài đặt còn lại để mặc định')));

    root.appendChild(h('div', { class: 'warn', style: 'margin-bottom:28px' }, h('b', null, 'Mặc định 5000 mAh sẽ ngắt máy trước khi pin đầy.'),
      SAC.rich('Pin 5300 mAh xả sâu cần nạp hơn 5000 mAh. Máy dừng với `OVER CHARGE CAPACITY LIMIT`. Thử trên '), h('a', { href: '#ch-may-ao' }, 'máy ảo'), ': chọn "Xả sâu" và giữ nguyên cài đặt.'));

    // Bảng tóm tắt
    root.appendChild(SAC.table(['Mục', 'Mặc định', 'Khuyên dùng cho pin này'],
      settings.map((s) => [`**${s.name}**`, s.def, changed.has(s.id) ? `**${s.rec}**` : s.rec])));

    const grid = h('div', { class: 'grid-2', style: 'margin-top:36px' });
    settings.forEach((s, i) => {
      const lf = SAC.LCD_FIELDS['sys-' + s.screen];
      const mock = SAC.sim.lcdMock(lf.lines[0], lf.lines[1]);
      grid.appendChild(h('div', { class: 'card', id: 'cd-' + s.id },
        h('span', { class: 'kicker' }, String(i + 1).padStart(2, '0') + (changed.has(s.id) ? ' · nên đổi' : '')),
        h('div', { class: 'card-title' }, s.name),
        mock,
        h('p', { style: 'margin:12px 0 4px;color:var(--ink-2)' }, s.vn + '. ' + s.desc),
        h('table', { class: 'kv' }, h('tbody', null,
          row('Dải chọn', s.sel), row('Mặc định', s.def), row('Khuyên dùng', changed.has(s.id) ? '**' + s.rec + '**' : s.rec))),
        h('p', { class: changed.has(s.id) ? 'warn' : 'note', style: 'margin-top:12px' }, SAC.rich(s.why))));
    });
    root.appendChild(grid);

    const fw = SAC.MENU.fw113;
    root.appendChild(h('div', { class: 'note space' }, h('b', null, 'Firmware 1.13 có thêm một tuỳ chọn (suy luận)'),
      SAC.rich(fw.desc + ' Sách V3.10 không có mục này nên bảng trên chỉ liệt kê 13 mục có trong sách.')));
    root.appendChild(h('p', { class: 'note', style: 'margin-top:12px' },
      SAC.rich('Key Beep và Buzzer nằm chung một màn hình (hai dòng), nên máy chỉ có 12 màn cho 13 mục.')));

    function stat(val, unit, label) {
      return h('div', { class: 'stat' }, h('span', { class: 'stat-val' }, val, h('span', { class: 'stat-unit' }, unit)), h('span', { class: 'stat-label' }, label));
    }
    function row(k, v) { return h('tr', null, h('th', null, k), h('td', null, SAC.rich(v))); }
  },
});
