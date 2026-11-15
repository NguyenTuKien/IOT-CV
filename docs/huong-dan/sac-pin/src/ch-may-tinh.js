/* Chương 9: nối B6AC V2 với máy tính, Charger Master V1.55, firmware V1.13.
   Đã thử trên máy thật ngày 27/10/2026 (laptop Windows 11, máy sạc SK-100008, firmware 1.13).
   Ảnh chụp thật nằm ở src/images/, build.py nhúng thành window.SAC_IMAGES.
   Phần CHƯA thử (đồ thị lúc sạc, nâng firmware) vẫn là khung giữ chỗ <figure data-shot>. */
SAC.chapter('may-tinh', {
  num: 9,
  short: 'Máy tính',
  title: 'Nối máy sạc với máy tính',
  kicker: 'Charger Master và firmware',
  lead: 'Cắm cáp micro USB vào cổng PC LINK ở cạnh trái máy. Đặt chương trình, đổi cài đặt hệ thống, xem điện áp từng cell và đồ thị sạc.',
  render(root, def) {
    const { h } = SAC;
    const imgs = window.SAC_IMAGES || {};
    const chip = (t) => h('span', { class: 'chip' }, t);
    const section = (title, ...kids) => h('div', { class: 'stack space' }, h('h3', null, title), ...kids);
    const stat = (val, unit, label) => h('div', { class: 'stat' },
      h('span', { class: 'stat-val' }, val, unit ? h('span', { class: 'stat-unit' }, unit) : null),
      h('span', { class: 'stat-label' }, label));
    // Ảnh chụp thật nếu có trong src/images/, không thì khung giữ chỗ.
    const shot = (id, what) => imgs[id]
      ? h('figure', { 'data-shot': id, style: 'margin:0' },
        h('img', { src: imgs[id], alt: what, loading: 'lazy', style: 'display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:var(--radius-s)' }),
        h('figcaption', { style: 'margin-top:6px;font-size:.9em;color:var(--ink-3)' }, what))
      : h('figure', {
        'data-shot': id,
        style: 'margin:0;padding:34px 16px;border:2px dashed var(--line);border-radius:var(--radius-s);text-align:center;color:var(--ink-3)',
      }, h('figcaption', null, h('b', { style: 'display:block;color:var(--ink-2)' }, what), 'Chưa chụp: cần một lần sạc thật'));

    root.append(SAC.head(def));

    root.append(h('div', { class: 'stats' },
      stat('V1.55', '', 'Charger Master, chỉ chạy trên Windows'),
      stat('0', '', 'driver cần cài: máy hiện như thiết bị HID'),
      stat('V1.13', '', 'firmware trong máy của bạn, đã là bản mới nhất')));

    // 1. Cần gì
    root.append(section('Cần gì',
      SAC.table(null, [
        ['Cáp', 'USB-A sang micro-B, **có dây dữ liệu**. Hộp máy không kèm cáp (sách tr.21). Cáp micro USB dùng nạp bo ESP32 DroneBridge (COM4) **đã chạy được** với máy sạc.'],
        ['Cáp chỉ sạc?', 'Cáp chỉ sạc không có dây dữ liệu. Dấu hiệu: máy sạc có điện mà Charger Master đứng mãi ở "Detecting...".'],
        ['Cổng', 'Micro USB "PC LINK", cạnh trái máy, giữa giắc DC và cổng nhiệt độ.'],
        ['Điện cho máy', 'Cấp AC hoặc DC cho máy sạc. Cáp USB không nuôi máy.'],
        ['Phần mềm', 'Charger Master V1.55, tải từ skyrc.com. Đã cài ở D:\\IOT_Tools\\apps\\ChargeMaster.'],
        ['Driver', h('span', null, 'Không cần. Windows nhận máy là "USB Input Device", mã ', h('code', null, 'VID_0000 PID_0001'), '. ', chip('đã thử 27/10'))],
      ], 'kv')));

    // 2. Cài đặt
    root.append(section('Cài và mở Charger Master',
      SAC.steps('pc-cai', [
        { t: 'Giải nén ChargeMaster_V1.55.zip.', d: 'File: D:\\IOT_Tools\\downloads\\b6ac-v2\\ChargeMaster_V1.55.zip. Trong zip có một file "charger master V1.55.exe", 65 MB, không có chữ ký số.' },
        { t: 'Bung bộ cài mà không cài vào ổ C.', d: 'File exe là bộ cài Advanced Installer. Lệnh "charger master V1.55.exe" /extract:"<thư mục>" bung ra sẵn các file chương trình. Chép thư mục đó vào D:\\IOT_Tools\\apps\\ChargeMaster là chạy được, không cần cài.' },
        { t: 'Cấp điện cho máy sạc, rồi cắm cáp USB vào PC LINK.' },
        { t: 'Mở "Charger Master.exe" TỪ CHÍNH THƯ MỤC CÀI.', d: 'Đây là trình khởi chạy. Nó dò máy ("Detecting..."), đọc mã máy (B6AC V2 là 100008), rồi tự đóng và mở chương trình con "Charger Master2.exe".' },
        { t: 'Thấy dòng "USB Connected!" và "B6AC V2" ở đáy cửa sổ là đã nối xong.' },
      ]),
      h('p', { class: 'warn' }, h('b', null, 'Lỗi gặp thật: "The system cannot find the file specified".'),
        'Hiện ngay sau "Detecting..." nếu mở trình khởi chạy bằng lối tắt hay lệnh có thư mục làm việc khác thư mục cài. Nó tìm chương trình con theo đường dẫn tương đối. Cách sửa: bấm đúp file exe trong thư mục cài, hoặc chạy ',
        h('code', null, "Start-Process 'D:\\IOT_Tools\\apps\\ChargeMaster\\Charger Master.exe' -WorkingDirectory 'D:\\IOT_Tools\\apps\\ChargeMaster'"), '.'),
      shot('charger-master-charge', 'Tab Charge: chọn chương trình, loại pin, chế độ, số cell, dòng sạc. Cột Status hiện điện áp tổng và 8 cell (0.00 V khi máy chưa chạy chương trình nào).')));

    // 3. Ba tab
    root.append(section('Ba tab làm việc',
      SAC.table(['Tab', 'Có gì', 'Ghi chú'], [
        ['Charge', 'Battery Type, Charger Mode, Cell, Current (sạc và xả), nút START. Cột Status: Voltage, Cell1 đến Cell8, Safety Timer, Capacity Cut, Protect Temp.', 'Ô "Program" ở trên lấy một chương trình đã lưu trong máy.'],
        ['System', 'Rest Time, Time Protected (Safety Timer), Capacity Limited (Capacity Cut), Battery temperature limited, Buzzer phím và hệ thống. Nút Save to charger, Load from charger, Factory default.', 'Là SYSTEM SETTING trên máy, sửa bằng chuột. Phải bấm **Save to charger** thì máy mới nhận.'],
        ['Program', 'Danh sách chương trình lưu trong máy (Storage) và ô sửa: NAME, loại pin, số cell, dòng sạc và xả, điện áp kết thúc, Option.', 'Máy của bạn có sẵn chương trình LiHv, nghĩa là firmware đã ở V1.13.'],
      ]),
      h('div', { class: 'grid-2' },
        shot('charger-master-system', 'Tab System. Máy của bạn: rest 10 phút, safety timer 180 phút, capacity cut 8000 mAh, nhiệt 50 °C, bật cả hai còi.'),
        shot('charger-master-program', 'Tab Program: các chương trình đang lưu trong máy và ô sửa chương trình.')),
      h('p', { class: 'note' }, h('b', null, 'Gợi ý cho pin 5300 mAh.'), 'Capacity Cut 8000 mAh thì vẫn an toàn nhưng lỏng. Đặt khoảng 6000 mAh (khoảng 115% dung lượng) sẽ cắt sớm hơn nếu có gì bất thường. Đây là gợi ý của người viết, chưa đổi trên máy.')));

    // 4. Phần mềm làm được gì
    const unverified = chip('chưa thử: cần một lần sạc');
    root.append(section('Phần mềm làm được gì',
      h('div', { class: 'grid-3' },
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Điều khiển sạc'), h('p', null, 'Chọn chế độ, số cell, dòng rồi bấm START trên máy tính.')),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Từng cell'), h('p', null, 'Cột Status có ô cho tổng và 8 cell. Pin 4S dùng Cell1 đến Cell4.')),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Cài đặt và chương trình'), h('p', null, 'Sửa SYSTEM SETTING và chương trình lưu trong máy bằng chuột.')),
        h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Đồ thị thời gian thực', unverified), h('p', null, 'Sách V3.10 ghi có. Chỉ xuất hiện khi máy đang chạy.')),
        h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Nội trở (IR)', unverified), h('p', null, 'Chưa thấy ô IR trong ba tab khi máy đứng yên.')),
        h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Xuất dữ liệu', unverified), h('p', null, 'Chưa thấy nút xuất trong ba tab.'))),
      h('div', { class: 'grid-2' },
        shot('charger-master-graph', 'Đồ thị khi đang sạc'),
        shot('charger-master-cells', 'Cột Status khi đang sạc 4S'))));

    // 5. Firmware V1.13
    root.append(section('Firmware V1.13',
      h('p', { class: 'tip' }, h('b', null, 'Máy của bạn đã chạy V1.13.'), 'Tab System của Charger Master đọc được "The current version: 1.13" từ máy, và danh sách chương trình có sẵn LiHv. Không cần nâng.'),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, 'V1.13 có gì'),
          h('ul', null,
            h('li', null, 'Thêm chế độ LiHV.'),
            h('li', null, 'Sạc CHARGE, FAST, STORAGE không bắt buộc cắm dây cân bằng. Bật hoặc tắt trong System Setting.'))),
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, 'Nếu sau này có bản mới'),
          h('p', null, 'Hãng phát hành dạng file exe riêng (B6AC_SK_V1.13.exe là bản hiện có). Cắm cáp, cấp điện, mở file, bấm "upgrade", xong chạy Load Factory Set rồi đặt lại Safety Timer và Capacity Cut.'))),
      h('p', { class: 'warn' }, h('b', null, 'Đang nâng thì đừng rút cáp hay nguồn.'), 'Sau khi nâng, vẫn nên giữ yêu cầu dây cân bằng ở chế độ BẬT.')));

    // 6. Sửa lỗi
    root.append(section('Không nối được',
      SAC.table(['Hiện tượng', 'Hay do', 'Thử'], [
        ['"The system cannot find the file specified" ngay sau "Detecting..."', 'Mở trình khởi chạy với thư mục làm việc sai. ' + '(gặp thật 27/10)', 'Bấm đúp file trong thư mục cài, hoặc Start-Process kèm -WorkingDirectory như ở trên.'],
        ['Đứng mãi ở "Detecting..."', 'Cáp chỉ sạc, hoặc máy sạc chưa có điện.', 'Cấp điện cho máy trước. Đổi cáp có dữ liệu. Cắm thẳng cổng USB của PC, không qua hub.'],
        ['Máy không sáng khi cắm USB', 'USB không cấp điện cho máy.', 'Cấp AC hoặc DC cho máy.'],
        ['Status toàn 0.00 V', 'Máy chưa chạy chương trình nào, hoặc chưa cắm pin.', 'Bình thường khi máy đứng yên. Số chỉ chạy khi đang sạc, xả hay đo.'],
        ['Windows chặn file exe', 'Bộ cài không có chữ ký số, SmartScreen hay phần mềm bảo vệ có thể chặn.', 'Chỉ dùng file tải từ skyrc.com. Bấm "More info" rồi "Run anyway" nếu chắc chắn nguồn.'],
        ['Windows đòi driver', 'Không nên có: máy là HID.', 'Chụp lại thông báo. Đừng cài driver lạ.'],
      ]),
      h('p', { class: 'note' }, h('b', null, 'Nguồn.'), 'Thử trên máy thật ngày 27/10/2026, cùng báo cáo plans/reports/261026-research-b6ac-v2-manual.md mục 10. Link tải nằm ở chương ', h('a', { href: '#ch-tai-lieu' }, 'Tài liệu'), '.')));
  },
});
