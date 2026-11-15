/* Chương 04: cục sạc ảo. Toàn bộ logic ở sim.js; chương chỉ dựng khung giới thiệu và gọi SAC.sim.mount. */
SAC.chapter('may-ao', {
  num: 4,
  short: 'Máy ảo',
  title: 'Cục sạc ảo bấm được',
  render(root) {
    const { h } = SAC;
    root.appendChild(SAC.head({
      num: 4, kicker: 'Máy ảo', title: 'Cục sạc ảo bấm được',
      lead: 'Cả bộ đồ nằm trên bàn: máy, pin, dây #3, dây #8, dây nguồn. Kéo từng giắc vào ổ như thật, rồi bấm nút trên máy 3D, giữ `ENTER` 3 giây và xem pin 4S nạp đầy trong vài chục giây. Tập ở đây trước, đỡ sai trên máy thật.',
    }));

    const how = h('div', { class: 'grid-2', style: 'margin-bottom:28px' },
      h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Kéo, cắm, rút'),
        h('p', null, SAC.rich('Kéo giắc tới ổ đang sáng rồi đẩy vào. Chạm giắc đang cắm để rút, hoặc kéo ngược ra. Kéo mạnh quá thì mắt xích yếu nhất bật ra. Trên điện thoại: chạm giắc, rồi chạm ổ sáng.'))),
      h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Bấm nút'),
        h('p', null, SAC.rich('Bốn nút tròn trên máy 3D bấm được. Phím tắt: `Esc` là [[BATT/PROG·Stop]], `←` [[DEC]], `→` [[INC]], `Enter` [[ENTER·Start]].'))),
      h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Giữ ENTER 3 giây'),
        h('p', null, 'Vòng vàng quanh nút chạy đủ một vòng thì máy mới bắt đầu. Bấm nhanh chỉ để sửa giá trị, như máy thật.')),
      h('div', { class: 'card flat' }, h('div', { class: 'card-title' }, 'Nén thời gian'),
        h('p', null, SAC.rich('Chọn 60× hoặc 600×. Sạc 4S từ lúc hạ cánh mất 1 giờ 40 phút thật; ở 600× chỉ khoảng 10 giây. Xả storage mất nhiều giờ, xem tại sao.'))));
    root.appendChild(how);

    // Một máy duy nhất: mặt máy 2D (bên dưới) và bàn 3D (bên trên) dùng chung một bộ máy trạng thái.
    const benchHost = h('div', { class: 'space' });
    const host = h('div');
    const simApi = SAC.sim.mount(host);
    if (SAC.bench && SAC.bench.mount) {
      root.appendChild(h('div', { class: 'kicker' }, 'Bàn thực hành 3D'));
      root.appendChild(benchHost);
      try { SAC.bench.mount(benchHost, { sim: simApi }); } catch (err) { console.error('[SAC] ban 3D loi:', err); benchHost.appendChild(h('p', { class: 'danger' }, 'Bàn 3D không dựng được: ' + err.message)); }
      root.appendChild(h('div', { class: 'kicker', style: 'margin-top:36px' }, 'Mặt máy 2D, giải thích từng chữ và đồ thị'));
    }
    root.appendChild(host);

    const legend = h('div', { class: 'grid-2 space' },
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, 'Điều máy ảo mô phỏng'),
        h('ul', { class: 'stack', style: 'margin:0;padding-left:18px;gap:6px' },
          ['Toàn bộ cây menu: 11 chương trình, 5 chế độ Li, NiMH/NiCd, Pb, BATT MEMORY (đặt, lưu, gọi), 13 cài đặt hệ thống, BATT METER, BATT RESISTANCE.',
            'Sạc CC/CV pin 4S 5300 mAh, giới hạn 50 W, cân bằng 200 mA/cell, Safety Timer và Capacity Cut-Off thật sự ngắt máy.',
            'Storage: sạc hoặc xả về 3,80 V/cell; xả bị chặn 5 W.',
            'Lỗi: REVERSE POLARITY, NO BALANCE CABLE DETECTED, số cell lệch (R/S), BATTERY WAS FULL, OVER TIME LIMIT, OVER CHARGE CAPACITY LIMIT.'].map((t) => h('li', null, SAC.rich(t))))),
      h('div', { class: 'card' },
        h('div', { class: 'card-title' }, 'Điều máy ảo không làm'),
        h('ul', { class: 'stack', style: 'margin:0;padding-left:18px;gap:6px' },
          ['Không chạy chương trình sạc/xả NiMH, NiCd, Pb (chỉ đi menu và chỉnh số).',
            'Đường cong pin là mô hình điển hình, không phải đo từ pin Ovonic thật của bạn. Thời gian chỉ để tham khảo.',
            'Các mã không có trong sách (CHG, FAS, STO, DSC, LF, màn FULL) là suy luận, có nhãn "suy luận" bên cạnh.'].map((t) => h('li', null, SAC.rich(t))))));
    root.appendChild(legend);

    const inf = h('details', { class: 'card flat space' }, h('summary', null, h('b', null, 'Danh sách các chỗ suy luận (chưa có ảnh máy thật)')),
      h('ul', { style: 'margin:10px 0 0;padding-left:18px' }, SAC.MENU.inferred.map((t) => h('li', null, t))));
    root.appendChild(inf);
  },
});
