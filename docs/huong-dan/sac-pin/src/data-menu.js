/* Dữ liệu menu của SkyRC iMAX B6AC V2: cây chương trình, 13 cài đặt hệ thống, từ điển màn hình LCD.
   Nguồn: manual V3.10 (lưu đồ tr.8, tr.9-17 thao tác, tr.18-20 đo và lỗi), ảnh các trang đã render,
   báo cáo plans/reports/261026-research-b6ac-v2-manual.md.
   Chuỗi LCD giữ nguyên như sách in; lỗi chính tả trong sách đã sửa (MiMH, TATAL, Lilo, STARG, 2P/2S của Pb).
   Mục đánh dấu `inferred: true` là SUY LUẬN, chưa có ảnh máy thật. */
(function () {
  'use strict';
  const SAC = window.SAC;

  // Ghép hai nửa dòng LCD 16 ký tự: trái dính lề trái, phải dính lề phải (đúng như ảnh sách).
  function lr(left, right) {
    const gap = 16 - left.length - right.length;
    if (gap < 0) throw new Error('[SAC.MENU] dong LCD dai qua 16 ky tu: ' + left + '|' + right);
    return left + ' '.repeat(gap) + right;
  }

  // ---------- Loại pin ----------
  SAC.CHEM = {
    lipo: { id: 'lipo', name: 'LiPo', code: 'LP', kind: 'li', prog: 'LiPo BATT', nominal: 3.7, full: 4.20, tvc: [4.18, 4.25], storage: 3.80, cut: [3.0, 3.3], cutDef: 3.0, fast: '1C' },
    life: { id: 'life', name: 'LiFe', code: 'LF', kind: 'li', prog: 'LiFe BATT', nominal: 3.3, full: 3.60, tvc: [3.58, 3.70], storage: 3.30, cut: [2.6, 2.9], cutDef: 2.6, fast: '4C', codeInferred: true },
    liio: { id: 'liio', name: 'LiIo', code: 'Li', kind: 'li', prog: 'LiIo BATT', nominal: 3.6, full: 4.10, tvc: [4.08, 4.20], storage: 3.70, cut: [2.9, 3.2], cutDef: 2.9, fast: '1C', codeInferred: true,
      note: 'Sách tự mâu thuẫn: bảng ghi sạc tối đa 4,1 V/cell, ví dụ màn hình lại là 4,2 V. Dải TVC 4,08 đến 4,20 V.' },
    lihv: { id: 'lihv', name: 'LiHV', code: 'LH', kind: 'li', prog: 'LiHV BATT', nominal: 3.8, full: 4.35, tvc: [4.25, 4.35], storage: 3.85, cut: [3.1, 3.4], cutDef: 3.1, fast: '1C', codeInferred: true,
      note: 'Cần firmware V1.13 trở lên. Màn hình mặc định 7,6 V cho 2S (3,8 V/cell).' },
    nimh: { id: 'nimh', name: 'NiMH', code: 'NM', kind: 'ni', prog: 'NiMH BATT', nominal: 1.2, cut: [0.1, 1.1], cutDef: 1.0, codeInferred: true },
    nicd: { id: 'nicd', name: 'NiCd', code: 'NC', kind: 'ni', prog: 'NiCd BATT', nominal: 1.2, cut: [0.1, 1.1], cutDef: 1.0, codeInferred: true },
    pb: { id: 'pb', name: 'Pb', code: 'Pb', kind: 'pb', prog: 'Pb BATT', nominal: 2.0, cut: [1.7, 1.8], cutDef: 1.7, codeInferred: true },
  };

  // ---------- Chế độ ----------
  // `short`: mã 3 chữ trên màn đang chạy. Sách chỉ in BAL; CHG/FAS/STO/DSC là SUY LUẬN.
  const LI_MODES = [
    { id: 'bal', lcd: 'BALANCE CHG', short: 'BAL', name: 'Sạc cân bằng', cur: [0.1, 6.0],
      desc: 'Sạc có cân bằng từng cell. Cần cắm dây cân bằng. Dùng cái này cho pin drone.' },
    { id: 'chg', lcd: 'CHARGE', short: 'CHG', shortInferred: true, name: 'Sạc thường', cur: [0.1, 6.0],
      desc: 'Sạc thường, không cân bằng. Các cell có thể lệch nhau dần.' },
    { id: 'fast', lcd: 'FAST CHARGE', short: 'FAS', shortInferred: true, name: 'Sạc nhanh', cur: [0.1, 6.0],
      desc: 'Nhanh hơn, nạp được hơi ít hơn sạc thường. Không dùng để sạc lần đầu hay sạc bình thường cho pin drone.' },
    { id: 'sto', lcd: 'STORAGE', short: 'STO', shortInferred: true, name: 'Lưu kho', cur: [0.1, 6.0],
      desc: 'Đưa pin về điện áp lưu kho: sạc nếu thấp hơn, xả nếu cao hơn. Xả bị giới hạn 5 W nên rất chậm.' },
    { id: 'dis', lcd: 'DISCHARGE', short: 'DSC', shortInferred: true, name: 'Xả', cur: [0.1, 2.0],
      desc: 'Xả tới điện áp ngắt. Pin Li thường không cần xả. Đừng để tới ngưỡng thấp nhất.' },
  ];
  const NI_MODES = [
    { id: 'chg', lcd: 'CHARGE', name: 'Sạc theo dòng đặt', desc: 'Sạc NiMH/NiCd theo dòng bạn đặt, tự ngắt khi phát hiện delta-peak.' },
    { id: 'auto', lcd: 'Auto CHARGE', name: 'Sạc tự động', desc: 'Máy tự chọn dòng. Phải đặt giới hạn dòng trên để khỏi nạp quá dòng cho pin nhỏ, nội trở thấp.' },
    { id: 'dis', lcd: 'DISCHARGE', name: 'Xả', desc: 'Xả NiMH/NiCd tới điện áp ngắt (0,1 đến 1,1 V/cell).' },
    { id: 're', lcd: 'RE-PEAK', name: 'Sạc đỉnh lặp', desc: 'Sạc tới đỉnh 1, 2 hoặc 3 lần liên tiếp, để chắc pin đã đầy.' },
    { id: 'cy', lcd: 'CYCLE', name: 'Chu kỳ', desc: '1 đến 5 chu kỳ liên tục sạc>xả hoặc xả>sạc để làm mới pin.' },
  ];
  const PB_MODES = [
    { id: 'chg', lcd: 'CHARGE', name: 'Sạc', desc: 'Sạc ắc quy chì (CC/CV).' },
    { id: 'dis', lcd: 'DISCHARGE', name: 'Xả', desc: 'Xả ắc quy chì.' },
  ];

  // Mười một chương trình, thứ tự theo lưu đồ tr.8 (báo cáo liệt kê BATT MEMORY lên trước, đó chỉ là cách xếp bảng).
  const PROGRAMS = [
    { id: 'lipo', lcd: 'LiPo BATT', kind: 'li', chem: 'lipo', modes: LI_MODES, page: 8 },
    { id: 'life', lcd: 'LiFe BATT', kind: 'li', chem: 'life', modes: LI_MODES, page: 8 },
    { id: 'liio', lcd: 'LiIo BATT', kind: 'li', chem: 'liio', modes: LI_MODES, page: 8 },
    { id: 'lihv', lcd: 'LiHV BATT', kind: 'li', chem: 'lihv', modes: LI_MODES, page: 8, fw: '1.13' },
    { id: 'nimh', lcd: 'NiMH BATT', kind: 'ni', chem: 'nimh', modes: NI_MODES, page: 8 },
    { id: 'nicd', lcd: 'NiCd BATT', kind: 'ni', chem: 'nicd', modes: NI_MODES, page: 8 },
    { id: 'pb', lcd: 'Pb BATT', kind: 'pb', chem: 'pb', modes: PB_MODES, page: 8 },
    { id: 'meter', lcd: 'BATT METER', kind: 'meter', page: 18 },
    { id: 'ir', lcd: 'BATT RESISTANCE', kind: 'ir', page: 19 },
    { id: 'sys', lcd: 'SYSTEM SETTING->', kind: 'sys', page: 16 },
    { id: 'mem', lcd: 'BATT MEMORY', kind: 'mem', page: 14 },
  ];

  // ---------- 13 cài đặt hệ thống (tr.16-17) ----------
  // `screen`: id màn hình LCD chứa mục này (Key Beep và Buzzer chung một màn, như lưu đồ).
  const SETTINGS = [
    { id: 'timer', screen: 'timer', name: 'Safety Timer', vn: 'Hẹn giờ an toàn', sel: 'OFF / ON, 1 đến 720 phút', def: 'ON 120 phút',
      desc: 'Đồng hồ chạy ngay khi bắt đầu sạc. Hết giờ thì dừng, phòng khi máy không nhận ra pin đầy hoặc pin hỏng.',
      rec: 'ON 180 phút', why: 'Sạc 5,3 Ah ở 3 A mất khoảng 106 phút cộng đuôi CV và cân bằng. 120 phút dễ ngắt sớm khi pin xả sâu. 180 phút vẫn là lưới an toàn thật.' },
    { id: 'cap', screen: 'cap', name: 'Capacity Cut-Off', vn: 'Ngắt theo dung lượng', sel: 'OFF / ON, 100 đến 50 000 mAh', def: 'ON 5000 mAh',
      desc: 'Dung lượng nạp tối đa. Tới mức này máy dừng, kể cả khi chưa thấy pin đầy.',
      rec: 'ON 6000 mAh', why: 'Mặc định 5000 mAh THẤP HƠN dung lượng pin 5300 mAh nên pin xả sâu sẽ bị ngắt trước khi đầy. 6000 mAh (khoảng 115%) vẫn chặn được pin bất thường.' },
    { id: 'temp', screen: 'temp', name: 'Temp Cut-Off', vn: 'Ngắt theo nhiệt độ', sel: 'OFF / ON, 20 đến 80 °C (68 đến 176 °F)', def: 'ON 50 °C / 122 °F',
      desc: 'Ngắt khi pin quá nóng. Chỉ có tác dụng khi cắm đầu dò nhiệt SK-600040 (không có trong hộp).',
      rec: 'ON 50 °C (giữ nguyên)', why: 'Không có đầu dò thì dòng Ext. Temp luôn hiện ---- và mục này không bảo vệ gì. Giữ 50 °C để khi mua đầu dò là dùng được ngay.' },
    { id: 'unit', screen: 'unit', name: 'Temperature Unit', vn: 'Đơn vị nhiệt độ', sel: 'Celsius / Fahrenheit', def: 'Celsius',
      desc: 'Hiển thị nhiệt độ theo độ C hay độ F.', rec: 'Celsius', why: 'Cùng đơn vị với Temp Cut-Off và với mọi số trong hướng dẫn này.' },
    { id: 'rest', screen: 'rest', name: 'Rest Time', vn: 'Thời gian nghỉ', sel: '1 đến 60 phút', def: 'CHG>DCHG 10 phút',
      desc: 'Nghỉ cho pin nguội giữa các bước của chế độ CYCLE (chỉ NiMH/NiCd).', rec: '10 phút (giữ nguyên)', why: 'Pin LiPo không dùng chế độ CYCLE nên mục này không ảnh hưởng.' },
    { id: 'nimh', screen: 'nimh', name: 'NiMH Sensitivity (D.Peak)', vn: 'Độ nhạy delta-peak NiMH', sel: 'Default (4 mV/cell) hoặc 5 đến 15 mV/cell', def: 'Default',
      desc: 'Máy báo NiMH đầy khi điện áp tụt xuống mức này so với đỉnh. Sách tự mâu thuẫn: mặc định 4 mV nằm ngoài dải 5 đến 15 mV.',
      rec: 'Default', why: 'Chỉ dành cho NiMH. Pin Li bỏ qua.' },
    { id: 'nicd', screen: 'nicd', name: 'NiCd Sensitivity (D.Peak)', vn: 'Độ nhạy delta-peak NiCd', sel: 'Default (4 mV/cell) hoặc 5 đến 15 mV/cell', def: 'Default',
      desc: 'Như trên, cho NiCd.', rec: 'Default', why: 'Chỉ dành cho NiCd. Pin Li bỏ qua.' },
    { id: 'beep', screen: 'beep', name: 'Key Beep', vn: 'Tiếng bíp khi bấm nút', sel: 'ON / OFF', def: 'ON',
      desc: 'Mỗi lần bấm nút máy bíp một tiếng để xác nhận.', rec: 'ON', why: 'Nghe tiếng bíp biết máy đã nhận nút, nhất là khi giữ ENTER 3 giây.' },
    { id: 'buzz', screen: 'beep', name: 'Buzzer', vn: 'Còi báo', sel: 'ON / OFF', def: 'ON',
      desc: 'Bíp hoặc giai điệu khi đổi trạng thái, khi xong và khi có lỗi.', rec: 'ON', why: 'Tiếng báo xong và báo lỗi là tín hiệu chính khi bạn không nhìn màn hình. Đừng tắt.' },
    { id: 'inlow', screen: 'inlow', name: 'Input Power Low Cut-Off', vn: 'Ngắt khi nguồn vào yếu', sel: '10,0 đến 11,0 V', def: '11,0 V',
      desc: 'Bảo vệ ắc quy nguồn khi chạy bằng DC: điện áp vào tụt dưới mức này thì dừng.', rec: '11,0 V (giữ nguyên)', why: 'Chạy bằng ổ cắm AC thì mục này không dùng tới. Nếu chạy bằng ắc quy 12 V, 11,0 V bảo vệ ắc quy tốt nhất.' },
    { id: 'factory', screen: 'factory', name: 'Load Factory Set', vn: 'Khôi phục cài đặt gốc', sel: 'Enter', def: 'không có',
      desc: 'Bấm ENTER để nạp lại mọi cài đặt về mặc định.', rec: 'Chỉ dùng sau khi cập nhật firmware', why: 'Ghi chú firmware khuyên chạy mục này sau khi nâng cấp. Bình thường đừng bấm: bạn sẽ mất cài đặt đã chỉnh.' },
    { id: 'version', screen: 'version', name: 'Version', vn: 'Phiên bản', sel: 'chỉ xem', def: 'HW:1.00 FW: 1.10 (ví dụ trong sách)',
      desc: 'Phiên bản phần cứng và firmware.', rec: 'Ghi lại số FW', why: 'FW dưới 1.13 thì không có LiHV và không có tuỳ chọn bật/tắt yêu cầu dây cân bằng.' },
    { id: 'serial', screen: 'serial', name: 'Serial Number', vn: 'Số sê-ri', sel: 'chỉ xem', def: '6 chữ số',
      desc: 'Số sê-ri riêng của máy.', rec: 'Ghi lại', why: 'Hàng thật có tem hologram kèm mã bảo mật 12 chữ số; số sê-ri 6 chữ số này đối chiếu với tem khi cần bảo hành.' },
  ];

  // FW >= 1.13: không có trong sách V3.10, chỉ có trong ghi chú firmware. Tên trường trên LCD chưa biết.
  const FW113 = { id: 'balreq', name: 'Yêu cầu dây cân bằng (FW 1.13)', inferred: true,
    desc: 'Bật/tắt việc máy đòi cắm dây cân bằng khi chạy CHARGE, FAST, STORAGE. Tên trường trên LCD và giá trị mặc định chưa xác minh.' };

  // Màn hình lỗi: chuỗi LCD đúng như ảnh tr.20. Ý nghĩa chi tiết và cách xử lý nằm ở chương Lỗi.
  const ERR = [
    { id: 'reverse', l1: 'REVERSE POLARITY', l2: '', vn: 'Cắm ngược cực.' },
    { id: 'break', l1: 'CONNECTION BREAK', l2: '', vn: 'Mạch pin bị đứt.' },
    { id: 'conn', l1: 'CONNECT ERROR', l2: 'CHECK MAIN PORT', vn: 'Cắm pin sai.' },
    { id: 'balconn', l1: 'BALANCE CONNECT', l2: 'ERROR', vn: 'Cắm dây cân bằng sai.' },
    { id: 'dclow', l1: 'DC IN TOO LOW', l2: '', vn: 'Điện áp vào dưới 11 V.' },
    { id: 'dchigh', l1: 'DC IN TOO HIGH', l2: '', vn: 'Điện áp vào trên 18 V.' },
    { id: 'celllow', l1: 'CELL ERROR', l2: 'LOW VOLTAGE', vn: 'Một cell có điện áp quá thấp.' },
    { id: 'cellhigh', l1: 'CELL ERROR', l2: 'HIGH VOLTAGE', vn: 'Một cell có điện áp quá cao.' },
    { id: 'cellinv', l1: 'CELL ERROR', l2: 'VOLTAGE-INVALID', vn: 'Một cell có điện áp không hợp lệ.' },
    { id: 'cellnum', l1: 'CELL NUMBER', l2: 'INCORRECT', vn: 'Sai số cell.' },
    { id: 'inttemp', l1: 'INT.TEMP.TOO HI', l2: '', vn: 'Máy sạc quá nóng bên trong.' },
    { id: 'exttemp', l1: 'EXT.TEMP.TOO HI', l2: '', vn: 'Pin quá nóng theo đầu dò ngoài.' },
    { id: 'overcap', l1: 'OVER CHARGE', l2: 'CAPACITY LIMIT', vn: 'Nạp vượt Capacity Cut-Off.' },
    { id: 'overtime', l1: 'OVER TIME LIMIT', l2: '', vn: 'Quá Safety Timer.' },
    { id: 'full', l1: 'BATTERY WAS FULL', l2: '', vn: 'Điện áp pin đã cao hơn mức tối đa đã đặt (khi sạc cân bằng).' },
    { id: 'nobal', l1: 'NO BALANCE CABLE', l2: 'DETECTED', vn: 'Chưa cắm dây cân bằng. Nếu pin không có dây cân bằng thì bấm ENTER để chạy tiếp.' },
  ];

  SAC.MENU = {
    lr,
    programs: PROGRAMS,
    liModes: LI_MODES,
    niModes: NI_MODES,
    pbModes: PB_MODES,
    settings: SETTINGS,
    fw113: FW113,
    errScreens: ERR,
    buttons: [
      { id: 'stop', label: 'BATT/PROG', sub: 'Stop', key: 'Esc', desc: 'Dừng tiến trình, hoặc lùi một màn.' },
      { id: 'dec', label: 'DEC', sub: '◄ Status', key: '←', desc: 'Lùi menu, giảm giá trị, xem trạng thái khi đang chạy.' },
      { id: 'inc', label: 'INC', sub: 'Status ►', key: '→', desc: 'Tiến menu, tăng giá trị, xem trạng thái khi đang chạy.' },
      { id: 'enter', label: 'ENTER', sub: 'Start', key: 'Enter', desc: 'Sửa hoặc lưu giá trị. Giữ từ 3 giây để bắt đầu.' },
    ],
    // Danh sách việc sách KHÔNG ghi rõ hoặc là suy luận (để chương và báo cáo trích dẫn).
    inferred: [
      'Mã loại pin trên màn đang chạy: sách chỉ in LP. Các mã LF, Li, LH, NM, NC, Pb là suy luận.',
      'Mã chế độ trên màn đang chạy: sách chỉ in BAL. Các mã CHG, FAS, STO, DSC là suy luận.',
      'Màn hình khi sạc xong: sách chỉ nói "kêu bíp". Màn FULL / DONE trong máy ảo là suy luận.',
      'Điều kiện kết thúc CC/CV (dòng đuôi bằng 10% dòng đặt, FAST CHG 25%) là suy luận.',
      'Giá trị IN Power Voltage khi cấp bằng ổ cắm AC: sách chỉ có ví dụ 12,56 V khi cấp DC.',
      'Dải TRICKLE và PEAK DELAY của NiMH/NiCd trong bộ nhớ: sách chỉ có giá trị ví dụ.',
      'Số "P" của Pb từ 1 đến 10 tương ứng 2 đến 20 V: suy luận từ dải 2 đến 20 V.',
      'Thứ tự màn NO BALANCE CABLE DETECTED so với màn BATTERY CHECK: suy luận.',
      'Tuỳ chọn bật/tắt dây cân bằng của FW 1.13: có trong ghi chú firmware, không có trong sách.',
    ],
  };

  // ---------- Từ điển màn hình LCD ----------
  // def(key, nhóm, tiêu đề, [dòng1, dòng2], mô tả, trường[], tuỳ chọn)
  // trường = [k, đoạn chữ mẫu, tên, ý nghĩa, suy luận?, chỉ số dòng?]. Vị trí được tìm tự động theo đoạn chữ mẫu.
  const LF = (SAC.LCD_FIELDS = {});
  SAC.LCD_GROUPS = ['Chọn chương trình', 'Chương trình Li', 'NiMH, NiCd, Pb', 'Bộ nhớ', 'Cài đặt hệ thống',
    'Đo điện áp và nội trở', 'Khởi động', 'Khi đang chạy', 'Thông báo lỗi'];

  function def(key, group, title, lines, summary, fields, opt) {
    const o = opt || {};
    const fs = (fields || []).map((f) => {
      const [k, text, name, meaning, inf, li] = f;
      const line = li != null ? li : lines.findIndex((l) => l.includes(text));
      const col = line < 0 ? -1 : lines[line].indexOf(text);
      if (col < 0) throw new Error('[SAC.LCD_FIELDS] ' + key + ': khong thay "' + text + '" trong man hinh');
      return { k, text, name, meaning, inferred: !!inf, at: [line, col, text.length] };
    });
    LF[key] = { key, group, title, lines, summary, hint: o.hint || '', inferred: !!o.inferred, page: o.page || null, fields: fs };
  }

  // -- Chọn chương trình
  def('prog', 'Chọn chương trình', 'Danh sách chương trình', ['BATT/PROGRAM', lr('', 'LiPo BATT')],
    'Màn hình sau khi bấm BATT/PROG. 11 chương trình, đi bằng INC/DEC.',
    [['title', 'BATT/PROGRAM', 'Tiêu đề', 'Bạn đang ở danh sách chương trình.'],
     ['prog', 'LiPo BATT', 'Tên chương trình', 'LiPo, LiFe, LiIo, LiHV, NiMH, NiCd, Pb, BATT METER, BATT RESISTANCE, SYSTEM SETTING, BATT MEMORY.']],
    { hint: 'INC/DEC để chọn, ENTER để vào.', page: 8 });

  // -- Chương trình Li
  def('li-mode', 'Chương trình Li', 'Chế độ Li (LiPo, LiFe, LiIo, LiHV)', ['LiPo BALANCE CHG', lr('3.0A', '14.8V (4S)')],
    'Máy bật lên là vào thẳng màn này (LiPo BALANCE CHG). INC/DEC đổi chế độ: BALANCE CHG, CHARGE, FAST CHARGE, STORAGE, DISCHARGE.',
    [['type', 'LiPo', 'Loại pin', 'LiPo, LiFe, LiIo hoặc LiHV. Chọn sai loại là nguy hiểm: máy sạc tới mức điện áp của loại đã chọn.'],
     ['mode', 'BALANCE CHG', 'Chế độ', 'BALANCE CHG, CHARGE, FAST CHARGE, STORAGE, DISCHARGE.'],
     ['cur', '3.0A', 'Dòng', 'Dòng sạc 0,1 đến 6,0 A (xả: 0,1 đến 2,0 A). Máy còn bị giới hạn công suất 50 W khi sạc.'],
     ['cells', '14.8V (4S)', 'Điện áp danh định và số cell', 'Số cell 1 đến 6. Điện áp danh định = số cell nhân 3,7 V (LiPo).']],
    { hint: 'ENTER: dòng nhấp nháy, chỉnh rồi ENTER. Số cell nhấp nháy tiếp, chỉnh rồi ENTER. Giữ ENTER 3 giây để bắt đầu.', page: 11 });

  // -- NiMH, NiCd, Pb
  def('ni-chg', 'NiMH, NiCd, Pb', 'NiMH/NiCd: CHARGE', ['NiMH CHARGE', lr('CURRENT', '2.0A')],
    'Sạc theo dòng bạn đặt, tự ngắt khi phát hiện delta-peak.',
    [['type', 'NiMH', 'Loại pin', 'NiMH hoặc NiCd.'], ['mode', 'CHARGE', 'Chế độ', 'Sạc theo dòng đặt.'],
     ['cur', '2.0A', 'Dòng sạc', '0,1 đến 6,0 A.']], { page: 8 });
  def('ni-auto', 'NiMH, NiCd, Pb', 'NiMH/NiCd: Auto CHARGE', ['NiMH Auto CHARGE', lr('CURRENT', '2.0A')],
    'Máy tự chọn dòng sạc. Số hiện ra là GIỚI HẠN dòng trên.',
    [['type', 'NiMH', 'Loại pin', 'NiMH hoặc NiCd.'], ['mode', 'Auto CHARGE', 'Chế độ', 'Máy tự chọn dòng.'],
     ['cur', '2.0A', 'Giới hạn dòng trên', 'Đặt thấp với pin nhỏ, nội trở thấp để khỏi nạp quá dòng.']], { page: 13 });
  def('ni-dis', 'NiMH, NiCd, Pb', 'NiMH/NiCd: DISCHARGE', ['NiMH DISCHARGE', lr('0.1A', 'CUT: 1.0V')],
    'Xả NiMH/NiCd.',
    [['type', 'NiMH', 'Loại pin', 'NiMH hoặc NiCd.'], ['mode', 'DISCHARGE', 'Chế độ', 'Xả.'],
     ['cur', '0.1A', 'Dòng xả', '0,1 đến 2,0 A.'], ['cut', 'CUT: 1.0V', 'Điện áp ngắt', '0,1 đến 1,1 V mỗi cell.']], { page: 8 });
  def('ni-re', 'NiMH, NiCd, Pb', 'NiMH/NiCd: RE-PEAK', ['NiMH RE-PEAK', lr('', '1')],
    'Sạc tới đỉnh một, hai hoặc ba lần liên tiếp.',
    [['type', 'NiMH', 'Loại pin', 'NiMH hoặc NiCd.'], ['mode', 'RE-PEAK', 'Chế độ', 'Sạc đỉnh lặp.'], ['n', '1', 'Số lần', '1 đến 3.']], { page: 13 });
  def('ni-cy', 'NiMH, NiCd, Pb', 'NiMH/NiCd: CYCLE', ['NiMH CYCLE', lr('CHG>DCHG', '1')],
    'Chu kỳ liên tục, để làm mới pin.',
    [['type', 'NiMH', 'Loại pin', 'NiMH hoặc NiCd.'], ['mode', 'CYCLE', 'Chế độ', 'Chu kỳ.'],
     ['dir', 'CHG>DCHG', 'Thứ tự', 'CHG>DCHG (sạc rồi xả) hoặc DCHG>CHG (xả rồi sạc).'], ['n', '1', 'Số chu kỳ', '1 đến 5.']], { page: 13 });
  def('pb-chg', 'NiMH, NiCd, Pb', 'Pb: CHARGE', ['Pb CHARGE', lr('2.0A', '2.0V (1P)')],
    'Sạc ắc quy chì. Số "P" là số ngăn 2 V.',
    [['type', 'Pb', 'Loại pin', 'Ắc quy chì (Gel, axit chì).'], ['mode', 'CHARGE', 'Chế độ', 'Sạc.'],
     ['cur', '2.0A', 'Dòng sạc', '0,1 đến 6,0 A.'], ['cells', '2.0V (1P)', 'Điện áp và số ngăn', 'Dải 2 đến 20 V. Số P từ 1 đến 10 (suy luận).', true]], { page: 8 });
  def('pb-dis', 'NiMH, NiCd, Pb', 'Pb: DISCHARGE', ['Pb DISCHARGE', lr('0.1A', '2.0V (1P)')],
    'Xả ắc quy chì.',
    [['type', 'Pb', 'Loại pin', 'Ắc quy chì.'], ['mode', 'DISCHARGE', 'Chế độ', 'Xả.'],
     ['cur', '0.1A', 'Dòng xả', '0,1 đến 2,0 A.'], ['cells', '2.0V (1P)', 'Điện áp và số ngăn', 'Dải 2 đến 20 V.', true]], { page: 8 });

  // -- Bộ nhớ
  const memHint = 'INC/DEC chuyển bước, ENTER sửa (nhấp nháy), INC/DEC chỉnh, ENTER lưu.';
  def('mem-slot', 'Bộ nhớ', 'Chọn ô nhớ', ['[BATT MEMORY 1]', lr('', 'ENTER SET->')],
    'Có 10 ô nhớ. ENTER để đặt hồ sơ. Giữ ENTER 3 giây để gọi hồ sơ đã lưu.',
    [['num', '1', 'Số ô nhớ', '1 đến 10. INC/DEC để đổi.'], ['set', 'ENTER SET->', 'Gợi ý', 'Bấm ENTER để bắt đầu đặt hồ sơ.']], { page: 14 });
  def('mem-type', 'Bộ nhớ', 'Bộ nhớ: loại pin', ['BATT TYPE', lr('', 'LiPo')], 'Chọn loại pin.',
    [['v', 'LiPo', 'Loại pin', 'LiPo, LiFe, LiIo, LiHV, NiMH, NiCd, Pb.']], { hint: memHint, page: 14 });
  def('mem-volts', 'Bộ nhớ', 'Bộ nhớ: số cell', ['BATT VOLTS', lr('', '7.4V ( 2S )')], 'Điện áp và số cell (Li 1S đến 6S).',
    [['v', '7.4V ( 2S )', 'Điện áp và số cell', 'Điện áp danh định và số cell.']], { hint: memHint, page: 14 });
  def('mem-chg', 'Bộ nhớ', 'Bộ nhớ: dòng sạc', ['CHARGE CURRENT', lr('', '4.9A')], 'Dòng sạc 0,1 đến 6,0 A.',
    [['v', '4.9A', 'Dòng sạc', '0,1 đến 6,0 A.']], { hint: memHint, page: 14 });
  def('mem-dsch', 'Bộ nhớ', 'Bộ nhớ: dòng xả', ['DSCH CURRENT', lr('', '2.2A')], 'Dòng xả 0,1 đến 2,0 A.',
    [['v', '2.2A', 'Dòng xả', '0,1 đến 2,0 A. Con số 2,2 A trong ví dụ của sách nằm ngoài dải này (sách tự mâu thuẫn).']], { hint: memHint, page: 14 });
  def('mem-dv', 'Bộ nhớ', 'Bộ nhớ: điện áp xả', ['DSCH VOLTAGE', lr('', '3.0V/CELL')], 'Điện áp ngắt khi xả. LiPo 3,0 đến 3,3 V/cell.',
    [['v', '3.0V/CELL', 'Điện áp ngắt', 'LiPo 3,0 đến 3,3 V mỗi cell. Đặt 3,3 V để an toàn hơn.']], { hint: memHint, page: 14 });
  def('mem-tvc', 'Bộ nhớ', 'Bộ nhớ: điện áp cuối (TVC)', ['TVC=YOUR RISK', lr('', '4.20V')], 'Chỉ cho Li. Điện áp kết thúc sạc mỗi cell. Tự chịu rủi ro nếu đặt khác mặc định.',
    [['v', '4.20V', 'TVC', 'LiPo 4,18 đến 4,25 V/cell. Dùng 4,20 V.']], { hint: memHint, page: 14 });
  def('mem-trickle', 'Bộ nhớ', 'Bộ nhớ: TRICKLE (NiMH/NiCd)', ['TRICKLE', lr('', '100mA')], 'Dòng nuôi sau khi đầy. Dải chưa có trong sách, chỉ có giá trị ví dụ.',
    [['v', '100mA', 'Dòng nuôi', 'Ví dụ 100 mA. Dải không rõ.', true]], { hint: memHint, page: 14, inferred: true });
  def('mem-delay', 'Bộ nhớ', 'Bộ nhớ: PEAK DELAY (NiMH/NiCd)', ['PEAK DELAY', lr('', '1Min')], 'Thời gian chờ dò đỉnh. Dải chưa có trong sách.',
    [['v', '1Min', 'Chờ dò đỉnh', 'Ví dụ 1 phút. Dải không rõ.', true]], { hint: memHint, page: 14, inferred: true });
  def('mem-save', 'Bộ nhớ', 'Bộ nhớ: lưu hồ sơ', ['SAVE PROGRAM', lr('', 'ENTER')], 'Bấm ENTER để lưu.',
    [['v', 'ENTER', 'Lưu', 'Bấm ENTER để lưu hồ sơ.']], { page: 14 });
  def('mem-saving', 'Bộ nhớ', 'Bộ nhớ: đang lưu', ['SAVE PROGRAM', 'SAVE....'], 'Hiện thoáng qua khi lưu.',
    [['v', 'SAVE....', 'Đang lưu', 'Hồ sơ đang được ghi.']], { page: 15 });
  def('mem-sum1', 'Bộ nhớ', 'Bộ nhớ: tóm tắt 1', ['[BATT MEMORY 1]', 'LiPo 7.4V(2S)'], 'Loại pin và số cell của hồ sơ đã lưu. INC/DEC chuyển qua màn tóm tắt dòng.',
    [['v', 'LiPo 7.4V(2S)', 'Loại và số cell', 'Loại pin, điện áp, số cell.']], { hint: 'Giữ ENTER 3 giây để gọi hồ sơ.', page: 15 });
  def('mem-sum2', 'Bộ nhớ', 'Bộ nhớ: tóm tắt 2', ['[BATT MEMORY 1]', 'C:4.9A D:2.2A'], 'Dòng sạc (C) và dòng xả (D) của hồ sơ đã lưu.',
    [['c', 'C:4.9A', 'Dòng sạc', 'Charge.'], ['d', 'D:2.2A', 'Dòng xả', 'Discharge.']], { hint: 'Giữ ENTER 3 giây để gọi hồ sơ.', page: 15 });
  def('mem-load', 'Bộ nhớ', 'Bộ nhớ: đang nạp hồ sơ', ['ENTER CHARGER', 'LOAD......'], 'Máy đang nạp hồ sơ, rồi vào màn chế độ với thông số đã lưu. Giữ ENTER 3 giây nữa để chạy.',
    [['v', 'LOAD......', 'Đang nạp', 'Máy chép thông số vào màn chế độ.']], { page: 15 });

  // -- Cài đặt hệ thống (12 màn cho 13 mục: Key Beep và Buzzer chung một màn)
  const SCR = {
    timer: ['Safety Timer', lr('ON', '120Min'), 'timer', [['v', 'ON', 'Bật/tắt', 'OFF hoặc ON.'], ['min', '120Min', 'Số phút', '1 đến 720 phút.']]],
    cap: ['Capacity Cut-Off', lr('ON', '5000mAH'), 'cap', [['v', 'ON', 'Bật/tắt', 'OFF hoặc ON.'], ['mah', '5000mAH', 'Dung lượng', '100 đến 50 000 mAh.']]],
    temp: ['Temp Cut-Off', lr('ON', '50°C 122°F'), 'temp', [['v', 'ON', 'Bật/tắt', 'OFF hoặc ON.'], ['c', '50°C', 'Nhiệt độ ngắt', '20 đến 80 °C.'], ['f', '122°F', 'Cùng giá trị, độ F', '68 đến 176 °F.']]],
    unit: ['Temperature Unit', lr('', 'Celsius'), 'unit', [['v', 'Celsius', 'Đơn vị', 'Celsius hoặc Fahrenheit.']]],
    rest: ['Rest Time', lr('CHG>DCHG', '10Min'), 'rest', [['v', '10Min', 'Số phút nghỉ', '1 đến 60 phút giữa các bước của CYCLE.']]],
    nimh: ['NiMH Sensitivity', lr('D.Peak', 'Default'), 'nimh', [['v', 'Default', 'Độ nhạy', 'Default (4 mV/cell) hoặc 5 đến 15 mV/cell.']]],
    nicd: ['NiCd Sensitivity', lr('D.Peak', 'Default'), 'nicd', [['v', 'Default', 'Độ nhạy', 'Default (4 mV/cell) hoặc 5 đến 15 mV/cell.']]],
    beep: [lr('Key Beep', 'ON'), lr('Buzzer', 'ON'), 'beep', [['kb', 'ON', 'Key Beep', 'Bíp mỗi lần bấm nút.', false, 0], ['bz', 'ON', 'Buzzer', 'Bíp hoặc giai điệu khi đổi trạng thái, xong, lỗi.', false, 1]]],
    inlow: [lr('Input. Power Low', ''), lr('Cut-Off', '11.0V'), 'inlow', [['v', '11.0V', 'Mức ngắt', '10,0 đến 11,0 V.']]],
    factory: ['Load Factory Set', lr('', 'Enter'), 'factory', [['v', 'Enter', 'Thực hiện', 'Bấm ENTER để khôi phục cài đặt gốc.']]],
    version: ['Version', 'HW:1.00 FW: 1.10', 'version', [['hw', 'HW:1.00', 'Phần cứng', 'Phiên bản phần cứng.'], ['fw', 'FW: 1.10', 'Firmware', 'Ví dụ trong sách. Máy của bạn có thể khác.']]],
    serial: ['Serial Number:', lr('', '000000'), 'serial', [['v', '000000', 'Số sê-ri', '6 chữ số, riêng cho từng máy.']]],
  };
  SAC.MENU.sysScreens = Object.keys(SCR);
  for (const id of SAC.MENU.sysScreens) {
    const s = SCR[id];
    const names = SETTINGS.filter((x) => x.screen === id);
    def('sys-' + id, 'Cài đặt hệ thống', 'Cài đặt: ' + names.map((x) => x.name).join(' và '),
      [s[0], s[1]], names.map((x) => x.desc).join(' '), s[3], { hint: 'ENTER để sửa (nhấp nháy), INC/DEC chỉnh, ENTER lưu.', page: 16 });
  }

  // -- Đo điện áp và nội trở
  def('meter-cells', 'Đo điện áp và nội trở', 'BATT METER: điện áp từng cell', ['4.20 4.19 4.19 V', '4.18 0.00 0.00 V'],
    'Cắm cả dây sạc chính lẫn dây cân bằng. 6 ô: cell 1 đến 3 ở dòng trên, cell 4 đến 6 ở dòng dưới. Cell không có thì hiện 0.00.',
    [['cell', '4.20', 'Điện áp một cell', 'Mỗi con số là một cell, theo thứ tự cell 1, 2, 3 rồi 4, 5, 6.', false, 0]], { hint: 'INC để xem MAIN/H/L.', page: 18 });
  def('meter-main', 'Đo điện áp và nội trở', 'BATT METER: tổng, cao nhất, thấp nhất', ['MAIN 25.13V', 'H4.200V L4.182V'],
    'Tổng điện áp pin, cell cao nhất (H) và thấp nhất (L). Hiệu H trừ L là độ lệch cell.',
    [['main', '25.13V', 'Tổng điện áp', 'Điện áp cả pin (ví dụ trong sách là pin 6S).'], ['hi', 'H4.200V', 'Cell cao nhất', 'High.'], ['lo', 'L4.182V', 'Cell thấp nhất', 'Low.']], { page: 18 });
  def('ir-cells', 'Đo điện áp và nội trở', 'BATT RESISTANCE: nội trở từng cell', ['012 005 005   mΩ', '006           mΩ'],
    'Nội trở từng cell tính bằng mΩ. Cell 1 đến 3 ở dòng trên, cell 4 đến 6 ở dòng dưới. Ví dụ này: cell 1 gấp đôi các cell còn lại là dấu hiệu hỏng.',
    [['ir', '012', 'Nội trở một cell', 'mΩ, theo thứ tự cell 1, 2, 3 rồi 4, 5, 6.', false, 0]], { hint: 'INC để xem TOTAL/H/L.', page: 19 });
  def('ir-total', 'Đo điện áp và nội trở', 'BATT RESISTANCE: tổng, cao nhất, thấp nhất', ['TOTAL:28mΩ', 'H:12mΩ L:5mΩ'],
    'Tổng nội trở, cell cao nhất (H), thấp nhất (L). Sách in sai thành "TATAL".',
    [['total', 'TOTAL:28mΩ', 'Tổng nội trở', 'Cộng nội trở các cell.'], ['hi', 'H:12mΩ', 'Cell cao nhất', 'High.'], ['lo', 'L:5mΩ', 'Cell thấp nhất', 'Low.']], { page: 19 });

  // -- Khởi động
  def('check-wait', 'Khởi động', 'BATTERY CHECK', ['BATTERY CHECK', 'WAIT...'], 'Máy đang đếm số cell của pin. Chờ.', [['v', 'WAIT...', 'Đang dò', 'Máy dò số cell qua dây cân bằng.']], { page: 11 });
  def('check-ok', 'Khởi động', 'Xác nhận số cell (khớp)', ['R:4SER S:4SER', 'CONFIRM(ENTER)'],
    'R là số cell máy dò được, S là số cell bạn đã đặt. Khớp nhau thì bấm ENTER để chạy.',
    [['r', 'R:4SER', 'R', 'Số cell máy dò được (Real).'], ['s', 'S:4SER', 'S', 'Số cell bạn đã đặt (Set).'], ['ok', 'CONFIRM(ENTER)', 'Xác nhận', 'Bấm ENTER để bắt đầu sạc.']], { page: 11 });
  def('check-bad', 'Khởi động', 'Xác nhận số cell (lệch)', ['R:4SER S:3SER', 'CANCEL(STOP)'],
    'R khác S: bấm STOP, quay lại sửa số cell. Đừng đi tiếp.',
    [['r', 'R:4SER', 'R', 'Số cell máy dò được.'], ['s', 'S:3SER', 'S', 'Số cell bạn đã đặt: sai.'], ['ok', 'CANCEL(STOP)', 'Huỷ', 'Bấm STOP để quay lại.']], { page: 11 });

  // -- Khi đang chạy
  const run = (k, title, lines, summary, fields, opt) => def(k, 'Khi đang chạy', title, lines, summary, fields, opt);
  run('run-main', 'Đang sạc: màn chính', ['LP4s 3.0A 16.12V', 'BAL 022:43 01234'],
    'Màn chính khi đang chạy. INC xem điện áp từng cell, rồi Fuel/Cell. DEC xem điện áp cuối, điện áp vào, nhiệt độ, Safety Time, Capacity Cut-Off.',
    [['type', 'LP4s', 'Loại pin và số cell', 'LP là LiPo, 4s là 4 cell. Sách chỉ in mã LP; mã của loại khác là suy luận.'],
     ['cur', '3.0A', 'Dòng hiện tại', 'Dòng đang chạy. Sạc 4S bị chặn ở khoảng 3 A vì giới hạn 50 W.'],
     ['volt', '16.12V', 'Điện áp pin', 'Điện áp cả pin lúc đang sạc (cao hơn lúc nghỉ vì có dòng chạy qua nội trở).'],
     ['mode', 'BAL', 'Chế độ', 'BAL là sạc cân bằng. Mã CHG/FAS/STO/DSC là suy luận.', false],
     ['time', '022:43', 'Thời gian đã chạy', 'Phút:giây, định dạng 000:00.'],
     ['cap', '01234', 'Dung lượng đã nạp hoặc xả', 'mAh, năm chữ số.']],
    { hint: 'INC hoặc DEC để xem thêm. STOP để dừng.', page: 12 });
  run('run-cells', 'Đang sạc: điện áp từng cell', ['4.07 4.06 4.11 V', '4.09 0.00 0.00 V'],
    'Điện áp từng cell lúc đang chạy, khi có cắm dây cân bằng. Không cắm dây cân bằng thì cả sáu ô hiện 0.00.',
    [['cell', '4.07', 'Điện áp một cell', 'Cell 1, 2, 3 ở dòng trên; cell 4, 5, 6 ở dòng dưới. Cell không có thì 0.00.', false, 0]], { page: 12 });
  run('run-fuel', 'Đang sạc: Fuel và Cell', ['Fuel= 90%', 'Cell= 4.10V'], 'Phần trăm dung lượng ước tính và điện áp trung bình mỗi cell.',
    [['fuel', '90%', 'Fuel', 'Phần trăm ước tính theo điện áp.'], ['avg', '4.10V', 'Điện áp trung bình mỗi cell', 'Tổng chia số cell.']], { page: 12 });
  run('run-endv', 'Đang sạc: điện áp kết thúc', ['End Voltage', lr('', '16.8V(4S)')], 'Điện áp lúc chương trình kết thúc.',
    [['v', '16.8V(4S)', 'End Voltage', 'Sạc LiPo: 4,20 V nhân số cell. Storage: 3,80 V nhân số cell. Xả: điện áp ngắt.']], { page: 12 });
  run('run-inv', 'Đang sạc: điện áp vào', ['IN Power Voltage', lr('', '12.56V')], 'Điện áp nguồn vào của máy.',
    [['v', '12.56V', 'IN Power Voltage', 'Ví dụ của sách khi cấp DC. Giá trị khi cấp bằng ổ cắm AC không có trong sách.', true]], { page: 12, inferred: true });
  run('run-temp', 'Đang sạc: nhiệt độ', [lr('Ext. Temp', '----'), lr('Int. Temp', '37°C')],
    'Nhiệt độ ngoài (đầu dò) và trong máy. Không cắm đầu dò SK-600040 thì Ext. Temp hiện ----.',
    [['ext', '----', 'Ext. Temp', 'Nhiệt độ pin theo đầu dò. ---- nghĩa là chưa cắm đầu dò.'], ['int', '37°C', 'Int. Temp', 'Nhiệt độ bên trong máy sạc.']], { page: 12 });
  run('run-tcut', 'Đang sạc: Temp Cut-Off', ['Temp Cut-Off', lr('', '50°C')], 'Nhiệt độ ngắt đã cài.',
    [['v', '50°C', 'Temp Cut-Off', 'Ngắt khi đầu dò báo pin nóng tới mức này. Cần đầu dò.']], { page: 12 });
  run('run-stime', 'Đang sạc: Safety Time', ['Safety Time', lr('ON', '200min')], 'Hẹn giờ an toàn: bật hay tắt, và số phút.',
    [['v', 'ON', 'Bật/tắt', 'Safety Timer đang bật.'], ['min', '200min', 'Số phút', 'Hết số phút này máy dừng với OVER TIME LIMIT.']], { page: 12 });
  run('run-ccut', 'Đang sạc: Capacity Cut-Off', ['Capacity Cut-Off', lr('ON', '5000mAh')], 'Ngắt theo dung lượng: bật hay tắt, và số mAh.',
    [['v', 'ON', 'Bật/tắt', 'Capacity Cut-Off đang bật.'], ['mah', '5000mAh', 'Dung lượng', 'Nạp tới số này máy dừng với OVER CHARGE CAPACITY LIMIT.']], { page: 12 });
  run('run-done', 'Sạc xong', ['FULL LP4s 16.78V', '108:12 05303 mAh'],
    'Máy kêu bíp khi xong. Sách không tả màn hình lúc này. Màn "FULL" trong máy ảo là SUY LUẬN, chưa có ảnh máy thật.',
    [['state', 'FULL', 'Trạng thái', 'Sạc xong. Xả/storage xong hiện DONE.', true], ['volt', '16.78V', 'Điện áp cuối', 'Điện áp cuối cùng.', true],
     ['time', '108:12', 'Tổng thời gian', 'Phút:giây.', true], ['cap', '05303', 'Dung lượng nạp', 'mAh.', true]],
    { inferred: true, page: 12, hint: 'STOP để quay lại. Rút dây cân bằng trước, rồi dây chính.' });

  // -- Thông báo lỗi
  for (const e of ERR) {
    const lines = [e.l1, e.l2];
    const f = [['msg', e.l1, 'Dòng chữ lỗi', e.vn, false, 0]];
    def('err-' + e.id, 'Thông báo lỗi', e.l1 + (e.l2 ? ' ' + e.l2 : ''), lines, e.vn + ' Máy kêu bíp khi báo lỗi.', f, { page: 20, hint: 'STOP để quay lại. Cách xử lý ở chương Lỗi.' });
  }
})();
