/* Chương 11: an toàn LiPo. Nguồn: báo cáo Ovonic mục 2 và 4, SAFETY.md mục 6, manual B6AC V2 tr.10–11. */
SAC.chapter('an-toan', {
  num: 11,
  short: 'An toàn',
  title: 'An toàn khi dùng pin LiPo',
  kicker: 'Sạc, cất, mang, bỏ',
  lead: 'LiPo cháy rất nhanh khi hỏng. Sáu luật dưới đây đủ cho phần lớn rủi ro.',
  render(root, def) {
    const { h } = SAC;
    const section = (title, ...kids) => h('div', { class: 'stack space' }, h('h3', null, title), ...kids);
    const stat = (val, unit, label) => h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, unit ? h('span', { class: 'stat-unit' }, unit) : null),
      h('span', { class: 'stat-label' }, label));
    const list = (items) => h('ul', null, items.map((t) => h('li', null, SAC.rich(t))));
    const chip = (t) => h('span', { class: 'chip' }, t);

    root.append(SAC.head(def));

    root.append(h('p', { class: 'danger' }, h('b', null, 'Không sạc pin phồng, móp, nóng, hay có cell dưới 3,0 V.'),
      'Pin phồng không sửa được. Bỏ pin.'));

    // 1. Ba thẻ luật
    root.append(h('div', { class: 'grid-3 space' },
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, SAC.icon('fire'), 'Khi sạc'),
        list([
          'Trong **túi chống cháy**, trên nền không cháy.',
          'Luôn **có người trông**.',
          'Xa vật dễ cháy.',
          'Luôn sạc cân bằng.',
          'Chờ pin nguội. Sạc ở 0–45 °C.',
          'Nối dây vào máy trước, vào pin sau. Tháo thì ngược lại.',
          'Mỗi lần chỉ một pin trên ổ cân bằng.',
        ])),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, SAC.icon('battery'), 'Bỏ pin khi'),
        list([
          'Vỏ phồng, căng, không phẳng.',
          'Móp, rách vỏ, dây hở.',
          'Nóng khi sạc ở 1C hoặc thấp hơn.',
          'Sau bay nóng đến mức không cầm quá 10 s.',
          'Một cell lần nào cũng thấp hơn, hoặc lệch trên 0,2–0,3 V.',
          'Nội trở một cell gấp đôi các cell còn lại.',
        ])),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, SAC.icon('bolt'), 'Không bao giờ'),
        list([
          'Sạc khi không có người.',
          'Sạc pin phồng hoặc còn nóng.',
          'Để áp nghỉ một cell dưới 3,0 V.',
          'Sạc quá 4,20 V mỗi cell.',
          'Cắm ngược cực. Sách hãng nói có thể hỏng máy.',
        ]))));

    // 2. Cháy
    root.append(section('Nếu pin bốc khói hoặc cháy',
      h('ol', { class: 'steps' },
        h('li', null, SAC.rich('Cắt điện sạc, **nếu làm được an toàn**.')),
        h('li', null, SAC.rich('Để pin cháy hết trong túi. Hoặc xúc bằng xẻng ra chỗ trống, phủ cát.')),
        h('li', null, SAC.rich('Không hít khói. Đứng xa, đứng đầu gió.')),
        h('li', null, SAC.rich('Bình ABC hoặc CO₂ dùng cho đồ xung quanh.')),
        h('li', null, SAC.rich('Pin đã cháy hoặc phồng sau va đập: để ngoài trời, trên nền cát, **ít nhất vài giờ** rồi mới chạm.'))),
      h('p', { class: 'note' }, h('b', null, 'Số điện thoại cứu hỏa.'),
        'Báo cáo nghiên cứu không có số này nên trang không ghi. Ghi sẵn số ở nơi sạc.')));

    // 3. Cất giữ
    root.append(section('Cất giữ',
      h('div', { class: 'stats' },
        stat('3,80–3,85', 'V', 'mỗi cell khi cất (40–50% dung lượng)'),
        stat('15,2–15,4', 'V', 'cả pin 4S khi cất'),
        stat('0–45', '°C', 'khoảng nhiệt độ được sạc')),
      list([
        'Sẽ không bay trong 2–3 ngày: dùng **STORAGE**.',
        'Nơi mát, khô. Để đầy quá vài ngày làm pin già nhanh.',
        'Xả của B6AC chỉ 5 W, từ đầy về mức cất mất 5–6 giờ. Nhanh hơn: bay đến khi nghỉ ở khoảng 3,85 V.',
        'Trời lạnh nội trở tăng, sụt áp mạnh hơn khi bay.',
      ]),
      h('p', { class: 'note' }, h('b', null, 'Chưa có số nhiệt độ cất giữ.'), 'Nguồn chỉ ghi "mát, khô". ', chip('chưa xác minh'))));

    // 4. Vận chuyển
    root.append(section('Mang đi máy bay',
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' },
          h('div', { class: 'stat' },
            h('span', { class: 'stat-val' }, '78,4', h('span', { class: 'stat-unit' }, 'Wh')),
            h('span', { class: 'stat-label' }, '14,8 V × 5,3 Ah. Dưới 100 Wh: xách tay, bọc kín đầu cắm.'))),
        h('div', { class: 'card flat' },
          h('p', null, 'Pin 6S khoảng 5000 mAh là ~111 Wh. Mức 100–160 Wh cần hãng bay đồng ý, tối đa 2 viên.'),
          h('p', null, 'Quy định của hãng bay Việt Nam: ', chip('chưa xác minh'), ' Thường theo IATA tương tự.'))),
      h('p', { class: 'note' }, h('b', null, 'Nguồn.'),
        h('a', { href: 'https://www.faa.gov/hazmat/packsafe/lithium-batteries', target: '_blank', rel: 'noopener' }, 'FAA PackSafe'),
        ', xem ngày 26/10/2026.')));

    // 5. Thải bỏ
    root.append(section('Bỏ pin ở Việt Nam',
      h('ol', { class: 'steps' },
        h('li', null, SAC.rich('Xả về khoảng 3,0 V mỗi cell bằng chế độ DISCHARGE của B6AC.')),
        h('li', null, SAC.rich('Dán băng keo kín đầu cắm.')),
        h('li', null, SAC.rich('Mang tới điểm thu gom rác điện tử. **Không** vứt vào rác sinh hoạt.'))),
      h('p', { class: 'note' }, h('b', null, 'Danh sách điểm thu pin hiện tại: chưa xác minh.'),
        'Một bài báo nêu chương trình Việt Nam Tái Chế có điểm cố định ở Hà Nội và TP.HCM. ',
        h('a', { href: 'https://nongnghiepmoitruong.vn/thu-hoi-pin-va-rac-thai-dien-tu-can-che-tai-manh-hon-d675124.html', target: '_blank', rel: 'noopener' }, 'Đọc bài'),
        '. Trang của chương trình không mở được khi kiểm.')));

    root.append(h('p', { class: 'note space' }, h('b', null, 'Luật riêng của dự án.'),
      'SAFETY.md mục 6 và 7: không dùng pin phồng, đo từng cell trước mỗi buổi bay, đo thông mạch trước lần cắm pin đầu tiên.'));
  },
});
