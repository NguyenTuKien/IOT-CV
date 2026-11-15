/* Dựng trang: render chương theo SAC.ORDER, thanh chương theo vị trí cuộn, tìm kiếm, nền sáng/tối.
   Chạy sau khi mọi ch-*.js và gói 3D đã nạp (build.py gọi SAC.boot() ở script cuối). */
(function () {
  'use strict';
  const SAC = window.SAC;
  const { h } = SAC;

  function renderChapters(main, nav) {
    for (const id of SAC.ORDER) {
      const def = SAC.chapters[id];
      if (!def) throw new Error('[SAC] thieu chuong: ' + id);
      const sec = h('section', { class: 'ch' + (id === 'hero' ? ' hero' : ''), id: 'ch-' + id, 'data-title': def.title });
      main.appendChild(sec);
      try {
        def.render(sec, def);
      } catch (err) {
        // Không nuốt lỗi: hiện ngay trên trang và in console để kiểm thử bắt được.
        console.error('[SAC] chuong ' + id + ' loi:', err);
        sec.appendChild(h('p', { class: 'danger' }, h('b', null, 'Chương này lỗi khi dựng'), String(err && err.message || err)));
      }
      if (id !== 'hero') {
        nav.appendChild(h('a', { href: '#ch-' + id, 'data-id': id }, h('b', null, String(def.num).padStart(2, '0')), def.short || def.title));
      }
    }
  }

  function scrollSpy(nav) {
    const links = new Map([...nav.querySelectorAll('a')].map((a) => [a.dataset.id, a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.id.slice(3);
        links.forEach((a) => a.classList.remove('on'));
        const a = links.get(id);
        // Chỉ cuộn ngang thanh chương. KHÔNG dùng a.scrollIntoView(): nó huỷ lượt cuộn trang đang chạy
        // (bấm link chương bị dừng giữa đường, đo 26/10/2026).
        if (a) { a.classList.add('on'); nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'auto' }); }
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('section.ch').forEach((s) => io.observe(s));
  }

  function search() {
    const pop = document.getElementById('search-pop');
    const input = document.getElementById('search-input');
    const res = document.getElementById('search-res');
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    // Chỉ mục: mỗi khối có tiêu đề (h3, card-title, th của bảng) trong từng chương
    const idx = [];
    document.querySelectorAll('section.ch').forEach((sec) => {
      sec.querySelectorAll('h2, h3, .card, tr, li').forEach((el, i) => {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text.length < 3) return;
        if (!el.id) el.id = sec.id + '-k' + i;
        idx.push({ el, sec: sec.dataset.title, text, n: norm(text) });
      });
    });
    const open = () => { pop.classList.add('open'); input.focus(); input.select(); };
    const close = () => pop.classList.remove('open');
    document.getElementById('btn-search').addEventListener('click', () => (pop.classList.contains('open') ? close() : open()));
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); open(); }
      if (e.key === 'Escape') close();
    });
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      res.replaceChildren();
      if (q.length < 2) return;
      const seen = new Set();
      for (const it of idx) {
        if (!it.n.includes(q) || seen.has(it.text)) continue;
        seen.add(it.text);
        const snippet = it.text.length > 90 ? it.text.slice(0, 90) + '…' : it.text;
        res.appendChild(h('a', { href: '#' + it.el.id, onclick: close }, snippet, h('span', null, it.sec)));
        if (seen.size >= 30) break;
      }
      if (!seen.size) res.appendChild(h('p', { class: 'note' }, 'Không thấy kết quả.'));
    });
  }

  function theme() {
    const btn = document.getElementById('btn-theme');
    const apply = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
    apply(SAC.store.get('theme', null));
    btn.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      const t = dark ? 'light' : 'dark';
      apply(t);
      SAC.store.set('theme', t);
      window.dispatchEvent(new Event('sac-theme'));
    });
  }

  SAC.boot = function () {
    const main = document.getElementById('main');
    const nav = document.getElementById('chapnav');
    document.getElementById('btn-search').appendChild(SAC.icon('search', 18));
    document.getElementById('btn-theme').appendChild(SAC.icon('sun', 18));
    renderChapters(main, nav);
    scrollSpy(nav);
    search();
    theme();
    document.getElementById('footer').appendChild(h('div', null,
      'Dựng ngày ', SAC.BUILD_DATE || '?', ' · nguồn: manual SkyRC iMAX B6AC V2 V3.10, báo cáo plans/reports/261026-*. ',
      'Mô hình XT60 / JST-XH: KiCad Library Team, kicad-packages3D, CC-BY-SA 4.0.'));
    if (location.hash) setTimeout(() => SAC.go(null, location.hash.slice(1)), 50);
  };
})();
