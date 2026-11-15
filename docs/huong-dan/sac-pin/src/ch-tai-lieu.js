/* Chương 12: tài liệu chính hãng, file đã tải, nguồn tham khảo, 15 video (đã kiểm tồn tại bằng YouTube oEmbed 26/10/2026)
   và 1 video chưa kiểm được. Nguồn: plans/reports/261026-research-*.md. */
SAC.chapter('tai-lieu', {
  num: 12,
  short: 'Tài liệu',
  title: 'Tài liệu và video',
  kicker: 'Nguồn chính hãng và video',
  lead: 'Sách, firmware, phần mềm của hãng. Mười lăm video đã kiểm là có tồn tại; chất lượng chưa xem.',
  render(root, def) {
    const { h } = SAC;
    const section = (title, ...kids) => h('div', { class: 'stack space' }, h('h3', null, title), ...kids);
    const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
    const chip = (t, on) => h('span', { class: 'chip' + (on ? ' on' : '') }, t);

    root.append(SAC.head(def));

    // 1. Chính hãng
    const OFFICIAL = [
      ['Trang sản phẩm iMAX B6AC V2 (SK-100008)', 'Thông số, ảnh, link tải.', 'https://www.skyrc.com/iMAX_B6AC_V2_Charger', 'skyrc.com'],
      ['Sách hướng dẫn V3.10 (tiếng Anh)', '25 trang nội dung, in 09/2022.', 'https://www.skyrc.com/files/27/iMAX%20B6AC%20V2_Instruction_Manual_EN_V3.10.pdf', 'PDF'],
      ['Firmware V1.13', 'Thêm LiHV và tuỳ chọn dây cân bằng. Đăng 27/02/2023.', 'https://www.skyrc.com/files/111/B6AC_V2_Firmware_Update_V1.13.zip', 'ZIP'],
      ['Charger Master V1.55', 'Phần mềm Windows, 65 MB. Đăng 21/07/2026.', 'https://www.skyrc.com/files/129/Charger%20Master%20V1.55.zip', 'ZIP'],
    ];
    root.append(section('Của hãng SkyRC',
      h('div', { class: 'grid-2' }, OFFICIAL.map(([title, desc, href, kind]) =>
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, SAC.icon('link'), title),
          h('p', null, desc),
          h('p', null, chip(kind), ' ', ext(href, 'Mở link'))))),
      h('p', { class: 'note' }, h('b', null, 'Đã tải sẵn ở ổ D.'),
        'Thư mục D:\\IOT_Tools\\downloads\\b6ac-v2\\ có sách PDF, firmware (thư mục fw), Charger Master và bản chữ manual.txt. Các link của hãng chuyển hướng một lần trước khi tải.')));

    // 2. Tham khảo
    const REFS = [
      ['Oscar Liang: hướng dẫn LiPo', 'https://oscarliang.com/lipo-battery-guide/'],
      ['Oscar Liang: khi nào bỏ pin', 'https://oscarliang.com/when-retire-lipo-battery/'],
      ['Battery University BU-410: sạc ở nhiệt độ cao và thấp', 'https://batteryuniversity.com/article/bu-410-charging-at-high-and-low-temperatures'],
      ['Battery University BU-702: cất pin', 'https://batteryuniversity.com/article/bu-702-how-to-store-batteries'],
      ['Battery University BU-808: kéo dài tuổi thọ pin lithium', 'https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries'],
      ['ArduPilot: cấu hình Power Module', 'https://ardupilot.org/copter/docs/common-power-module-configuration-in-mission-planner.html'],
      ['ArduPilot: failsafe pin', 'https://ardupilot.org/copter/docs/failsafe-battery.html'],
      ['FAA PackSafe: pin lithium', 'https://www.faa.gov/hazmat/packsafe/lithium-batteries'],
    ];
    root.append(section('Đọc thêm',
      SAC.table(null, REFS.map(([t, u]) => [t, ext(u, u.replace('https://', ''))])),
      h('p', { class: 'note' }, 'Các link trên đã trả HTTP 200 ngày 26/10/2026.')));

    // 3. Video
    // tags: vi = tiếng Việt, pc = nối máy tính, st = storage, ir = nội trở. lang: ngôn ngữ nếu không phải tiếng Anh. other: cảnh báo.
    const VIDEOS = [
      { t: 'SkyRC B6AC V2 Charger Review and Usage', ch: 'AndyRC', len: '46:20', id: 'OcyGH5DeFLc', d: 'Review đầy đủ cách dùng, nhắc cả firmware và ChargeMaster.', tags: ['pc'] },
      { t: 'Review / How to Use SkyRC Imax B6AC V2', ch: 'RC Films / RCF', len: '7:46', id: 'Ekxdjj5ZWbo', d: 'Cách dùng cơ bản, sạc cân bằng.', tags: [] },
      { t: 'SkyRC iMax B6AC V2 – Charger Review', ch: 'Mark Robinson', len: '14:01', id: '1k6sVFOy-pk', d: 'Review, sạc LiPo.', tags: [] },
      { t: 'SKYRC B6AC V2 Balance Charger Review', ch: 'haloboyvash', len: '12:18', id: 'KF7vMp4Ixuc', d: 'Review, sạc cân bằng.', tags: [] },
      { t: 'IMAX B6AC V2 Basic Functions / PC Link', ch: 'RVDrones', len: '22:56', id: '9Cz0HpdnUSU', d: 'Chức năng cơ bản và nối máy tính.', tags: ['pc'] },
      { t: 'imax b6ac v2 installer pc monitor software', ch: 'TeslaBike Man', len: '3:12', id: '_-gqxrLLm78', d: 'Cài phần mềm ChargeMaster.', tags: ['pc'] },
      { t: 'SkyRC B6 mini & B6AC V2 charger Calibration', ch: 'Shawn Tong', len: '3:31', id: 'nEpgzfjXU7I', d: 'Hiệu chuẩn bằng ChargeMaster, liên quan firmware.', tags: ['pc'] },
      { t: 'iMAX B6AC V2 充電器教學 從開箱到平衡充電 & 保存模式', ch: 'WPC Systems', len: '3:21', id: 'nEynb3iW2Kc', d: 'Mở hộp, sạc cân bằng, chế độ Storage.', tags: ['st'], lang: 'Tiếng Trung' },
      { t: 'skyrc imax b6ac v2 Lipo balance & storage', ch: 'beginner rc hobby', len: '9:35', id: 'XJtVuXciJBg', d: 'Sạc cân bằng và Storage.', tags: ['st'], lang: 'Tiếng Indonesia' },
      { t: 'iMAX B6 AC Storage Mode', ch: 'EEEian Arena', len: '4:03', id: 'VMPeu5MHlFI', d: 'Chế độ Storage.', tags: ['st'] },
      { t: 'How to check the battery resistance (B6neo+)', ch: 'SkyRC', len: '1:04', id: 'lEe2-Vbskjw', d: 'Đo nội trở. Video chính hãng nhưng của máy B6neo, không phải V2.', tags: ['ir'], other: 'Máy khác: B6neo+' },
      { t: 'IMAX B6 AC V2 (review bản ac v2)', ch: 'TỚIMV Battery', len: '8:21', id: 'vy4wbICDETw', d: 'Review B6AC V2.', tags: ['vi'] },
      { t: 'sạc b6 AC v2 có đo nội trở – làm bộ nguồn đa năng', ch: 'Đại Vlogs', len: '18:31', id: 'nP3Csg3rcXc', d: 'Đo nội trở trên B6AC V2.', tags: ['vi', 'ir'] },
      { t: 'Bộ sạc xả đa năng imax B6 SkyRC v2 phiên bản mới', ch: 'Chiro Kotaro', len: '7:21', id: 'Cs3hr_UCDJc', d: 'Máy B6 V2.', tags: ['vi'], other: 'Chưa xác minh là bản AC' },
      { t: 'Hướng dẫn sạc pin imax b6 sạc pin lipo', ch: 'NamPack', len: '4:38', id: 'mtuzj8OEegU', d: 'Sạc LiPo trên máy B6.', tags: ['vi'], other: 'Không chắc là bản V2' },
    ];
    const UNVERIFIED = [
      { t: 'SkyRC iMAX B6AC Version V2 unboxing', ch: 'Michaelblog456', id: 'rWLk9jd9Kiw', d: 'Mở hộp. YouTube trả 401 khi kiểm, nhiều khả năng video tắt nhúng.' },
    ];
    const FILTERS = [['all', 'Tất cả'], ['vi', 'Tiếng Việt'], ['pc', 'Nối máy tính'], ['st', 'Storage'], ['ir', 'Nội trở']];
    const yt = (id) => 'https://www.youtube.com/watch?v=' + id;

    let filter = 'all';
    const grid = h('div', { class: 'grid-3' });
    const count = h('p', { class: 'note' });
    const bar = h('div', { class: 'chips' });
    const btns = FILTERS.map(([id, label]) => {
      const b = h('button', {
        type: 'button', class: 'chip' + (id === filter ? ' on' : ''), 'aria-pressed': id === filter ? 'true' : 'false',
        onclick: () => {
          filter = id;
          btns.forEach((x) => { const on = x.dataset.f === filter; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
          paint();
        },
      }, label);
      b.dataset.f = id;
      return b;
    });
    btns.forEach((b) => bar.appendChild(b));

    function videoCard(v, verified) {
      const badges = h('div', { class: 'chips' });
      if (v.tags && v.tags.includes('vi')) badges.append(chip('Tiếng Việt', true));
      if (v.lang) badges.append(chip(v.lang));
      if (v.other) badges.append(h('span', { class: 'est' }, v.other));
      if (!verified) badges.append(h('span', { class: 'est' }, 'chưa kiểm được'));
      return h('article', { class: 'card' + (verified ? '' : ' flat') },
        h('div', { class: 'card-title' }, SAC.icon('play'), v.t),
        h('p', null, h('b', null, v.ch), v.len ? ' · ' + v.len : ''),
        h('p', null, v.d),
        badges.childElementCount ? badges : null,
        h('p', null, ext(yt(v.id), 'Xem trên YouTube')));
    }

    function paint() {
      const shown = VIDEOS.filter((v) => filter === 'all' || v.tags.includes(filter));
      grid.replaceChildren(...shown.map((v) => videoCard(v, true)));
      count.replaceChildren(h('b', null, shown.length + ' / ' + VIDEOS.length + ' video'));
    }
    paint();

    root.append(section('Video',
      h('p', { class: 'note' }, h('b', null, 'Đã kiểm, chưa xem.'),
        'Mỗi video đã được kiểm là có tồn tại (YouTube oEmbed, 26/10/2026). Mô tả viết từ tiêu đề, kênh và lượt xem. Chưa xem nội dung. Gợi ý bắt đầu: video của AndyRC để thấy toàn máy; video của RVDrones cho phần nối máy tính.'),
      bar, count, grid));

    root.append(section('Chưa kiểm được',
      h('div', { class: 'grid-3' }, UNVERIFIED.map((v) => videoCard(v, false))),
      h('p', { class: 'note' }, 'Chưa tìm thấy video chính hãng của SkyRC hướng dẫn cập nhật firmware riêng cho B6AC V2.')));
  },
});
