/* Khung chung: đăng ký chương, tạo phần tử, lưu trạng thái. Mọi file ch-*.js gọi SAC.chapter(). */
(function () {
  'use strict';
  const SAC = (window.SAC = window.SAC || {});

  // Thứ tự chương cố định — đổi thứ tự ở đây, không ở từng file chương.
  SAC.ORDER = ['hero', 'may', 'pin', 'noi-day', 'may-ao', 'quy-trinh', 'lcd', 'cai-dat', 'loi', 'may-tinh', 'drone', 'an-toan', 'tai-lieu'];
  SAC.chapters = {};

  SAC.chapter = function (id, def) {
    if (!SAC.ORDER.includes(id)) throw new Error('[SAC] chuong la: ' + id);
    if (SAC.chapters[id]) throw new Error('[SAC] chuong dang ky hai lan: ' + id);
    SAC.chapters[id] = Object.assign({ id }, def);
  };

  // h('div', {class:'card', onclick: fn}, 'chữ', child, [mảng con])
  SAC.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  };

  // Dòng chữ có định dạng nhẹ: **đậm**, `LCD`, [[NÚT]], {est} → span .est
  SAC.rich = function (text) {
    const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = esc
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`(.+?)`/g, '<span class="lcd-text">$1</span>')
      .replace(/\[\[(.+?)\]\]/g, '<span class="kbd">$1</span>')
      .replace(/\{est\}/g, '<span class="est">ước lượng</span>');
    const span = document.createElement('span');
    span.innerHTML = html;
    return span;
  };

  // Đầu chương chuẩn
  SAC.head = function (def) {
    const h = SAC.h;
    return h('header', { class: 'ch-head' },
      h('span', { class: 'kicker' }, String(def.num).padStart(2, '0') + ' · ' + (def.kicker || def.title)),
      h('h2', null, def.title),
      def.lead ? h('p', { class: 'lead' }, SAC.rich(def.lead)) : null);
  };

  SAC.store = {
    get(key, dflt) {
      try { const v = localStorage.getItem('sac-b6ac:' + key); return v == null ? dflt : JSON.parse(v); } catch { return dflt; }
    },
    set(key, val) {
      try { localStorage.setItem('sac-b6ac:' + key, JSON.stringify(val)); } catch { /* bỏ qua: trình duyệt chặn lưu */ }
    },
  };

  SAC.go = function (id, anchor) {
    const el = document.getElementById(anchor || 'ch-' + id);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  // Danh sách bước có tick, lưu theo key
  SAC.steps = function (key, items) {
    const h = SAC.h;
    const done = new Set(SAC.store.get('steps:' + key, []));
    return h('ol', { class: 'steps' }, items.map((it, i) => {
      const li = h('li', { 'data-check': i, class: done.has(i) ? 'done' : null },
        SAC.rich(it.t || it), it.d ? h('small', null, SAC.rich(it.d)) : null);
      li.addEventListener('click', () => {
        li.classList.toggle('done');
        li.classList.contains('done') ? done.add(i) : done.delete(i);
        SAC.store.set('steps:' + key, [...done]);
      });
      return li;
    }));
  };

  // Bảng từ mảng: cols = ['Cột 1', ...], rows = [[...], ...]; ô là chuỗi (qua rich) hoặc Node
  SAC.table = function (cols, rows, cls) {
    const h = SAC.h;
    const cell = (tag, c) => h(tag, null, c instanceof Node ? c : SAC.rich(c ?? ''));
    return h('div', { class: 'tbl-wrap' }, h('table', { class: cls || 'tbl' },
      cols ? h('thead', null, h('tr', null, cols.map((c) => cell('th', c)))) : null,
      h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => cell(cols ? 'td' : i === 0 ? 'th' : 'td', c)))))));
  };

  SAC.icons = {
    search: '<path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9 16-4.3-4.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    sun: '<circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    battery: '<rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    pc: '<rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    drone: '<circle cx="5" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2"/>',
    fire: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-4 9-2-1-3-3-3-3-2 3-2 4-2 6 0 4 3 7 7 7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    play: '<path d="M8 5v14l11-7L8 5Z" fill="currentColor"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };
  SAC.icon = function (name, size = 20) {
    const p = SAC.icons[name];
    if (!p) throw new Error('[SAC] icon la: ' + name);
    const span = document.createElement('span');
    span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${p}</svg>`;
    return span.firstChild;
  };
})();
