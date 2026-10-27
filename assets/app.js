(() => {
  const C = { ink:'#262423', tan:'#E2C9A1', taupe:'#C2AF8C', brown:'#836852', gold:'#D19E35', cream:'#EFE4D9', line:'#E6DCCF' };
  const TYPE_COLOR = { interne: C.ink, externe: C.gold };
  const TYPE_LABEL = { interne: 'Newsletters internes', externe: 'Newsletters externes' };
  const NS = 'http://www.w3.org/2000/svg';
  const tip = document.getElementById('tip');
  let all = [], filter = 'all';

  const pct = (v, d = 1) => (v * 100).toFixed(d).replace('.', ',') + ' %';
  const fmtDate = s => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const shortDate = s => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const sum = (a, k) => a.reduce((t, c) => t + (c[k] || 0), 0);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));

  function agg(list) {
    const sent = sum(list, 'sent'), del = sum(list, 'delivered');
    return {
      n: list.length, sent, del,
      bounces: sum(list, 'bounces'),
      open: del ? sum(list, 'opens_unique') / del : 0,
      click: del ? sum(list, 'clicks_unique') / del : 0,
      bounce: sent ? sum(list, 'bounces') / sent : 0,
      unsub: del ? sum(list, 'unsubs') / del : 0,
      unsubs: sum(list, 'unsubs'),
    };
  }

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs = {}) {
    const t = el('text', { x, y, 'font-size': 12, fill: C.brown, ...attrs }, parent);
    t.textContent = s; return t;
  }
  function svg(host, w, h) {
    host.innerHTML = '';
    return el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, host);
  }
  function hover(node, html) {
    node.style.cursor = 'pointer';
    node.addEventListener('mousemove', e => {
      tip.innerHTML = html; tip.style.opacity = 1;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
      tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    });
    node.addEventListener('mouseleave', () => (tip.style.opacity = 0));
  }
  const empty = (host, msg = 'Aucune campagne pour ce filtre pour le moment.') => (host.innerHTML = `<p class="empty">${msg}</p>`);
  const campTip = c => `<b>${esc(c.title)}</b><br>${fmtDate(c.send_time)} · ${c.type}<br>Ouverture ${pct(c.open_rate)} · Clic ${pct(c.click_rate)}<br>${c.delivered} délivrés sur ${c.sent} · ${c.bounces} rebonds`;

  /* ---------- KPIs ---------- */
  function kpis(list) {
    const a = agg(list);
    const items = [
      { v: a.n, l: a.n > 1 ? 'campagnes envoyées' : 'campagne envoyée', dark: true },
      { v: pct(a.open).replace(' %', '<small> %</small>'), l: "taux d'ouverture moyen" },
      { v: pct(a.click).replace(' %', '<small> %</small>'), l: 'taux de clic moyen' },
      { v: pct(a.bounce).replace(' %', '<small> %</small>'), l: 'taux de rebond moyen' },
      { v: a.unsubs, l: a.unsubs > 1 ? 'désabonnements au total' : 'désabonnement au total' },
    ];
    document.getElementById('kpis').innerHTML = items.map(i =>
      `<div class="kpi${i.dark ? ' dark' : ''}"><span class="bar"></span><div class="v">${i.v}</div><div class="l">${i.l}</div></div>`).join('');
  }

  /* ---------- 01 time series ---------- */
  function timeChart(list) {
    const host = document.getElementById('chart-time');
    const leg = document.getElementById('legend-time');
    if (!list.length) { empty(host); leg.innerHTML = ''; return; }
    const narrow = host.clientWidth < 600;
    const W = narrow ? 520 : 1000, H = narrow ? 300 : 300, L = 46, R = 20, T = 14, B = 34;
    const s = svg(host, W, H);
    const t0 = new Date(list[0].send_time).getTime();
    const t1 = new Date(list[list.length - 1].send_time).getTime();
    const span = Math.max(t1 - t0, 1);
    const X = c => list.length === 1 ? (L + W - R) / 2 : L + (new Date(c.send_time).getTime() - t0) / span * (W - L - R);
    const Y = v => T + (1 - v) * (H - T - B);

    for (let v = 0; v <= 1.0001; v += 0.25) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: C.line }, s);
      txt(s, L - 10, Y(v) + 4, Math.round(v * 100) + ' %', { 'text-anchor': 'end' });
    }
    const maxT = narrow ? 4 : 8;
    const ticks = list.length <= maxT ? list : list.filter((_, i) => i % Math.ceil(list.length / maxT) === 0);
    ticks.forEach(c => txt(s, X(c), H - 10, shortDate(c.send_time), { 'text-anchor': 'middle' }));

    const types = [...new Set(list.map(c => c.type))];
    const legend = [];
    types.forEach(tp => {
      const pts = list.filter(c => c.type === tp);
      const col = TYPE_COLOR[tp];
      [['open_rate', 0], ['click_rate', 1]].forEach(([k, dashed]) => {
        if (pts.length > 1) el('polyline', {
          points: pts.map(c => `${X(c)},${Y(c[k])}`).join(' '),
          fill: 'none', stroke: col, 'stroke-width': dashed ? 2 : 2.6,
          'stroke-dasharray': dashed ? '6 6' : '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        }, s);
        pts.forEach(c => {
          const dot = el('circle', { cx: X(c), cy: Y(c[k]), r: dashed ? 4.5 : 6.5,
            fill: dashed ? '#FCF9F5' : col, stroke: col, 'stroke-width': 2 }, s);
          hover(dot, campTip(c));
        });
      });
      legend.push(`<span><i class="line" style="background:${col}"></i>Ouverture ${TYPE_LABEL[tp].replace('Newsletters ', '')}</span>`,
                  `<span style="color:${col}"><i class="dash"></i><span style="color:#4a4542">Clic ${TYPE_LABEL[tp].replace('Newsletters ', '')}</span></span>`);
    });
    leg.innerHTML = legend.join('');
  }

  /* ---------- 02 donut ---------- */
  function donut(list) {
    const host = document.getElementById('chart-donut');
    if (!list.length) return empty(host);
    const a = agg(list);
    const s = svg(host, 420, 250);
    host.querySelector('svg').style.maxWidth = '420px';
    const cx = 125, cy = 125, r = 92, sw = 28, circ = 2 * Math.PI * r;
    const share = a.sent ? a.del / a.sent : 0;
    const g = el('g', { transform: `rotate(-90 ${cx} ${cy})` }, s);
    const b = el('circle', { cx, cy, r, fill: 'none', stroke: C.tan, 'stroke-width': sw }, g);
    const d = el('circle', { cx, cy, r, fill: 'none', stroke: C.ink, 'stroke-width': sw,
      'stroke-dasharray': `${Math.max(circ * share - 3, 0)} ${circ}` }, g);
    hover(d, `<b>Délivrés</b><br>${a.del} emails sur ${a.sent}`);
    hover(b, `<b>Rebonds</b><br>${a.bounces} adresses en échec`);
    txt(s, cx, cy + 6, pct(share).replace(' ', ''), { 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 300, fill: C.ink });
    txt(s, cx, cy + 30, 'délivrés', { 'text-anchor': 'middle', 'font-size': 13 });
    const rows = [[C.ink, a.del, 'emails délivrés'], [C.tan, a.bounces, 'rebonds'], [null, a.sent, 'envois au total']];
    rows.forEach(([col, v, l], i) => {
      const y = 78 + i * 52;
      if (col) el('rect', { x: 262, y: y - 22, width: 10, height: 10, rx: 3, fill: col }, s);
      txt(s, col ? 282 : 262, y - 4, v, { 'font-size': 30, 'font-weight': 300, fill: C.ink });
      txt(s, col ? 282 : 262, y + 14, l, { 'font-size': 12 });
    });
  }

  /* ---------- 03 compare ---------- */
  function compare(list) {
    const host = document.getElementById('chart-compare');
    const types = ['interne', 'externe'].filter(tp => filter === 'all' || filter === tp);
    const data = types.map(tp => ({ tp, a: agg(list.filter(c => c.type === tp)) }));
    if (!list.length) return empty(host);
    const metrics = [['open', 'Ouverture'], ['click', 'Clic'], ['bounce', 'Rebond'], ['unsub', 'Désabonnement']];
    const W = 520, rowH = 62, H = metrics.length * rowH + 10, L = 120, R = 64;
    const s = svg(host, W, H);
    const max = Math.max(0.05, ...data.flatMap(d => metrics.map(([k]) => d.a[k])));
    const scale = v => v / Math.min(1, max * 1.1) * (W - L - R);
    metrics.forEach(([k, label], i) => {
      const y0 = 8 + i * rowH;
      txt(s, 0, y0 + 24, label, { 'font-size': 13, fill: C.ink, 'font-weight': 600 });
      data.forEach((d, j) => {
        const y = y0 + j * 22 + 8;
        el('rect', { x: L, y, width: W - L - R, height: 14, rx: 7, fill: C.cream }, s);
        if (d.a.n) {
          const bar = el('rect', { x: L, y, width: Math.max(scale(d.a[k]), d.a[k] ? 4 : 0), height: 14, rx: 7, fill: TYPE_COLOR[d.tp] }, s);
          hover(bar, `<b>${TYPE_LABEL[d.tp]}</b><br>${label} ${pct(d.a[k])}<br>${d.a.n} campagne${d.a.n > 1 ? 's' : ''}`);
        }
        txt(s, W - R + 10, y + 12, d.a.n ? pct(d.a[k]) : 'n.d.', { 'font-size': 12, fill: d.a.n ? C.ink : C.taupe });
      });
    });
    const legend = data.map(d => `<span><i style="background:${TYPE_COLOR[d.tp]}"></i>${TYPE_LABEL[d.tp]}${d.a.n ? '' : ' (pas encore de campagne)'}</span>`).join('');
    host.insertAdjacentHTML('beforeend', `<div class="legend">${legend}</div>`);
  }

  /* ---------- 04 per campaign ---------- */
  function bars(list) {
    const host = document.getElementById('chart-bars');
    if (!list.length) return empty(host);
    const narrow = host.clientWidth < 600;
    const items = list.slice(narrow ? -5 : -12);
    const W = narrow ? 520 : 1000, H = 330, L = 46, R = 10, T = 14, B = 64;
    const s = svg(host, W, H);
    const Y = v => T + (1 - v) * (H - T - B);
    for (let v = 0; v <= 1.0001; v += 0.25) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: C.line }, s);
      txt(s, L - 10, Y(v) + 4, Math.round(v * 100) + ' %', { 'text-anchor': 'end' });
    }
    const slot = (W - L - R) / Math.max(items.length, 4);
    const bw = Math.min(26, slot / 4.2);
    items.forEach((c, i) => {
      const cx = L + slot * i + slot / 2;
      const vals = [[c.open_rate, C.ink], [c.click_rate, C.gold], [c.sent ? c.bounces / c.sent : 0, C.tan]];
      const g = el('g', {}, s);
      vals.forEach(([v, col], j) => {
        const x = cx + (j - 1.5) * (bw + 4);
        el('rect', { x, y: Y(v), width: bw, height: Math.max(Y(0) - Y(v), v ? 0 : 1.5), rx: 4, fill: col }, g);
      });
      el('rect', { x: cx - slot / 2, y: T, width: slot, height: H - T - B, fill: 'transparent' }, g);
      hover(g, campTip(c));
      el('circle', { cx: cx - (bw + 4) * 1.5 + 4, cy: H - 44, r: 4, fill: TYPE_COLOR[c.type] }, s);
      txt(s, cx - (bw + 4) * 1.5 + 13, H - 40, shortDate(c.send_time), { 'font-size': 12, fill: C.ink, 'font-weight': 600 });
      const lim = narrow ? 12 : 22;
      const t = c.title.length > lim ? c.title.slice(0, lim - 1) + '…' : c.title;
      txt(s, cx - (bw + 4) * 1.5, H - 22, t, { 'font-size': 11 });
    });
  }

  function render() {
    const list = all.filter(c => filter === 'all' || c.type === filter);
    kpis(list); timeChart(list); donut(list); compare(list); bars(list);
  }

  document.getElementById('filter').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll('#filter button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  fetch('data/campaigns.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
      all = (d.campaigns || []).filter(c => c.sent > 0).sort((a, b) => a.send_time.localeCompare(b.send_time));
      document.getElementById('updated').textContent = 'Mis à jour le ' + new Date(d.updated).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      render();
    })
    .catch(() => { document.getElementById('kpis').innerHTML = '<p class="empty">Les données n\'ont pas pu être chargées.</p>'; });

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
})();
