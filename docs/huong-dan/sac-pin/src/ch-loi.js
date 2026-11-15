/* Chương 8: 16 thông báo lỗi của B6AC V2 (sách V3.10 tr.20). Cột "Nghĩa" theo sách; "Hay do" và "Xử lý" là suy luận thực hành. */
SAC.chapter('loi', {
  num: 8,
  short: 'Báo lỗi',
  title: 'Máy báo lỗi: đọc và xử lý',
  kicker: 'Thông báo lỗi',
  lead: 'Máy hiện lỗi trên màn hình và kêu bíp. Gõ chữ trên màn hình vào ô tìm, hoặc lọc theo nhóm.',
  render(root, def) {
    const { h } = SAC;
    const LCD_W = 16;

    // g: nhóm lọc. l1/l2: hai dòng LCD đúng như sách in. meaning: theo sách. cause, fix: suy luận thực hành.
    const ERRORS = [
      { g: 'nguon', l1: 'DC IN TOO LOW', l2: '',
        meaning: 'Điện áp vào dưới 11 V.',
        cause: 'Chạy bằng nguồn DC: ắc quy yếu hoặc nguồn DC thiếu điện.',
        fix: 'Dùng nguồn DC 11–18 V đủ điện, hoặc cấp bằng dây AC.' },
      { g: 'nguon', l1: 'DC IN TOO HIGH', l2: '',
        meaning: 'Điện áp vào trên 18 V.',
        cause: 'Nguồn DC quá áp, ví dụ adapter 24 V.',
        fix: 'Rút nguồn ngay. Chỉ dùng nguồn 11–18 V.' },
      { g: 'day', l1: 'REVERSE POLARITY', l2: '',
        meaning: 'Cắm ngược cực.',
        cause: 'Dây đỏ và đen đảo ở đầu pin hoặc ở đầu XT60.',
        fix: 'Rút pin, rút dây khỏi máy. Đỏ là +, đen là −. Chưa chắc cực thì không thử lại.' },
      { g: 'day', l1: 'CONNECTION BREAK', l2: '',
        meaning: 'Mạch pin bị đứt.',
        cause: 'XT60 hoặc banana cắm lỏng, dây đứt, hoặc pin rút ra giữa chừng.',
        fix: 'Dừng, rút pin. Kiểm đầu cắm và dây, cắm chắc rồi chạy lại.' },
      { g: 'day', l1: 'CONNECT ERROR', l2: 'CHECK MAIN PORT',
        meaning: 'Pin cắm sai.',
        cause: 'Dây sạc chính chưa vào pin, hoặc vào nhầm cổng.',
        fix: 'Cắm dây chính vào cổng OUTPUT của máy, XT60 vào hết đáy rồi chạy lại.' },
      { g: 'day', l1: 'BALANCE CONNECT', l2: 'ERROR',
        meaning: 'Dây cân bằng cắm sai.',
        cause: 'Cắm nhầm ổ (không phải ổ 4S), dây đen lệch phía cực âm, hoặc giắc lỏng.',
        fix: 'Pin 4S cắm vào ổ 5 chân, dây đen phía cực âm. Mỗi lần chỉ một pin.' },
      { g: 'day', l1: 'NO BALANCE CABLE', l2: 'DETECTED',
        meaning: 'Chưa cắm dây cân bằng.',
        cause: 'Quên dây cân bằng.',
        fix: 'Cắm dây cân bằng vào ổ 4S. Pin Ovonic có dây này nên **không** bấm [[ENTER]] để bỏ qua.' },
      { g: 'cell', l1: 'CELL ERROR', l2: 'LOW VOLTAGE',
        meaning: 'Một cell có áp quá thấp.',
        cause: 'Pin xả quá sâu, hoặc một cell yếu.',
        fix: 'Đo từng cell bằng BATT METER. Cell dưới 3,0 V thì không sạc, loại pin.' },
      { g: 'cell', l1: 'CELL ERROR', l2: 'HIGH VOLTAGE',
        meaning: 'Một cell có áp quá cao.',
        cause: 'Pin vừa đầy, hoặc lệch cell nặng.',
        fix: 'Đo từng cell. Cell trên 4,25 V thì ngừng sạc, để nguội và loại pin.' },
      { g: 'cell', l1: 'CELL ERROR', l2: 'VOLTAGE-INVALID',
        meaning: 'Áp một cell không hợp lệ.',
        cause: 'Dây cân bằng tiếp xúc kém hoặc đứt một sợi.',
        fix: 'Rút, cắm lại dây cân bằng. Vẫn lỗi thì đo bằng vạn năng ở giắc XH.' },
      { g: 'cell', l1: 'CELL NUMBER', l2: 'INCORRECT',
        meaning: 'Sai số cell.',
        cause: 'Đặt 3S hoặc 6S cho pin 4S.',
        fix: 'Đặt 4S. Màn kiểm tra phải hiện `R:4SER S:4SER`, hai số khớp nhau.' },
      { g: 'cell', l1: 'BATTERY WAS FULL', l2: '',
        meaning: 'Áp pin cao hơn mức tối đa đã đặt khi sạc cân bằng.',
        cause: 'Pin đã đầy từ trước.',
        fix: 'Không cần sạc. Hai ngày tới không bay thì chuyển sang STORAGE.' },
      { g: 'gioihan', l1: 'INT.TEMP.TOO HI', l2: '',
        meaning: 'Bên trong máy sạc quá nóng.',
        cause: 'Sạc 3 A kéo dài, máy đặt chỗ kín, khe gió bị chắn.',
        fix: 'Dừng, rút pin, để máy nguội. Đặt chỗ thoáng.' },
      { g: 'gioihan', l1: 'EXT.TEMP.TOO HI', l2: '',
        meaning: 'Pin quá nóng theo đầu dò nhiệt.',
        cause: 'Chỉ có khi gắn đầu dò SK-600040 (mua thêm). Pin nóng khi sạc ≤ 1C là dấu hiệu hỏng.',
        fix: 'Dừng, đưa pin vào túi chống cháy, để nguội. Pin hay nóng thì loại.' },
      { g: 'gioihan', l1: 'OVER CHARGE', l2: 'CAPACITY LIMIT',
        meaning: 'Nạp vượt mức Capacity Cut-Off đã đặt.',
        cause: 'Mặc định 5000 mAh, thấp hơn dung lượng 5300 mAh của pin.',
        fix: 'Vào SYSTEM SETTING, đặt Capacity Cut-Off cao hơn 5300 mAh.' },
      { g: 'gioihan', l1: 'OVER TIME LIMIT', l2: '',
        meaning: 'Thời gian sạc vượt Safety Timer đã đặt.',
        cause: 'Mặc định 120 phút. Sạc từ pin cạn ở 3 A mất khoảng 1 h 40 m, sát giới hạn.',
        fix: 'Kiểm pin có sạc bình thường không. Nếu có, tăng Safety Timer (ví dụ 180 phút).' },
    ];

    const GROUPS = [
      ['all', 'Tất cả'],
      ['nguon', 'Nguồn vào'],
      ['day', 'Dây và cực'],
      ['cell', 'Cell'],
      ['gioihan', 'Nhiệt và giới hạn'],
    ];

    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    for (const e of ERRORS) {
      e.hay = norm([e.l1, e.l2, e.meaning, e.cause, e.fix].join(' '));
    }

    let group = 'all';
    let query = '';

    root.append(SAC.head(def));

    root.append(h('p', { class: 'warn' }, h('b', null, 'Lỗi mà pin nóng, phồng hay có mùi: dừng hết.'),
      'Ngắt nguồn, đưa pin vào túi chống cháy. Xem chương ', h('a', { href: '#ch-an-toan' }, 'An toàn'), '.'));

    const input = h('input', {
      type: 'search',
      placeholder: 'Gõ chữ trên màn hình: BALANCE, TEMP, CELL…',
      autocomplete: 'off',
      'aria-label': 'Tìm thông báo lỗi',
      style: 'width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit',
    });
    const chipBar = h('div', { class: 'chips' });
    const count = h('p', { class: 'note' });
    const list = h('div', { class: 'grid-2' });

    const chips = GROUPS.map(([id, label]) => {
      const b = h('button', {
        type: 'button', class: 'chip' + (id === group ? ' on' : ''), 'aria-pressed': id === group ? 'true' : 'false',
        onclick: () => {
          group = id;
          chips.forEach((c) => { const on = c.dataset.g === group; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          paint();
        },
      }, label);
      b.dataset.g = id;
      return b;
    });
    chips.forEach((c) => chipBar.appendChild(c));

    input.addEventListener('input', () => { query = norm(input.value.trim()); paint(); });

    root.append(h('div', { class: 'stack space' }, input, chipBar, count, list));

    function lcd(e) {
      return h('div', { style: 'margin-bottom:12px;line-height:1.7' },
        h('div', null, h('span', { class: 'lcd-text' }, e.l1.padEnd(LCD_W))),
        h('div', null, h('span', { class: 'lcd-text' }, e.l2.padEnd(LCD_W))));
    }

    function card(e) {
      return h('article', { class: 'card' },
        lcd(e),
        SAC.table(null, [
          ['Nghĩa (sách)', e.meaning],
          ['Hay do', e.cause],
          ['Xử lý', e.fix],
        ], 'kv'));
    }

    function paint() {
      const shown = ERRORS.filter((e) => (group === 'all' || e.g === group) && (!query || e.hay.includes(query)));
      list.replaceChildren(...shown.map(card));
      count.replaceChildren(h('b', null, shown.length + ' / ' + ERRORS.length + ' lỗi'),
        shown.length ? '' : 'Không có lỗi nào khớp. Thử bỏ bớt chữ hoặc chọn "Tất cả".');
    }
    paint();

    root.append(h('p', { class: 'note space' }, h('b', null, 'Đọc cho đúng.'),
      'Cột "Nghĩa" lấy từ sách V3.10 trang 20. "Hay do" và "Xử lý" là suy luận từ cách máy hoạt động, sách không viết.'));
  },
});
