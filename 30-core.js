/* ============================================================
   Tridosha UI core — state, storage, rendering helpers, charts
   ============================================================ */
const EMPTY = () => ({ profile: null, prakriti: null, vikriti: [], checkins: {}, meals: [], saved: { meals: [], blends: [] }, plan: null });
let S = EMPTY();
const store = { mode: 'pending', col: null, cache: {}, chain: Promise.resolve(), error: null, sample: false, real: null };
const caps = { downloads: null, sample: null, images: false };
const ui = { route: 'home', obStep: 0, pf: null, pq: null, vk: null, ci: null, food: { q: '', cat: '', dosha: '', fit: false, open: null }, spice: { sel: ['blackpepper', 'redchilipowder'], dish: 'aloo_tamatar', a: 'seed-mild', b: 'seed-spicy', draft: null }, an: null, jf: null, jShow: 14, trend: 30, srcTab: 'method', srcKind: '', confirm: null, photo: null, grocery: false, exportText: null };
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = s => { const d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const fmtDay = s => { const d = new Date(s + 'T12:00:00'); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const avg = a => a.length ? sum(a) / a.length : null;

/* ---------- Storage ---------- */
const LKEY = 'tridosha:v1';
function localLoad() { try { const raw = localStorage.getItem(LKEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function localSave() { try { localStorage.setItem(LKEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
function localOK() { try { localStorage.setItem(LKEY + ':t', '1'); localStorage.removeItem(LKEY + ':t'); return true; } catch (e) { return false; } }
function hasData(s) { return !!(s.profile || s.prakriti || s.vikriti.length || Object.keys(s.checkins).length || s.meals.length || s.saved.meals.length || s.saved.blends.length || s.plan); }
function docsOf(s) {
  const out = {};
  for (const k of ['profile', 'prakriti', 'plan']) if (s[k]) out[k] = JSON.stringify(s[k]);
  if (s.vikriti.length) out.vikriti = JSON.stringify(s.vikriti);
  if (s.saved.meals.length || s.saved.blends.length) out.saved = JSON.stringify(s.saved);
  const bm = {}; for (const m of s.meals) (bm['meals-' + m.date.slice(0, 7)] = bm['meals-' + m.date.slice(0, 7)] || []).push(m);
  const bc = {}; for (const [d, c] of Object.entries(s.checkins)) (bc['checkins-' + d.slice(0, 7)] = bc['checkins-' + d.slice(0, 7)] || {})[d] = c;
  for (const [id, v] of Object.entries(bm)) out[id] = JSON.stringify(v);
  for (const [id, v] of Object.entries(bc)) out[id] = JSON.stringify(v);
  return out;
}
function fromDocs(docs) {
  const s = EMPTY();
  for (const [id, json] of Object.entries(docs)) {
    let v; try { v = JSON.parse(json); } catch (e) { continue; }
    if (id.startsWith('meals-') && Array.isArray(v)) s.meals.push(...v);
    else if (id.startsWith('checkins-') && v) Object.assign(s.checkins, v);
    else if (id in s && v) s[id] = v;
  }
  s.meals.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  s.saved = Object.assign({ meals: [], blends: [] }, s.saved);
  return s;
}
async function flushDb() {
  if (store.mode !== 'db' || store.sample) return;
  const docs = docsOf(S);
  try {
    for (const [id, json] of Object.entries(docs)) if (store.cache[id] !== json) { await store.col.doc(id).set({ json, t: Date.now() }); store.cache[id] = json; }
    for (const id of Object.keys(store.cache)) if (!(id in docs)) { await store.col.doc(id).delete(); delete store.cache[id]; }
    store.error = null;
  } catch (e) {
    store.error = (e && e.code) || 'unavailable';
    if (e && e.code === 'invalid_argument') { store.mode = localOK() ? 'local' : 'memory'; localSave(); }
  }
  setStatus();
}
function persist() {
  if (store.sample) return;
  if (store.mode === 'db') store.chain = store.chain.then(flushDb);
  else if (store.mode === 'local') { if (!localSave()) store.mode = 'memory'; }
  setStatus();
}
function statusInfo() {
  if (store.sample) return ['warn', 'Sample mode: nothing is saved'];
  if (store.mode === 'pending') return ['', 'Checking for saved data'];
  if (store.mode === 'db') return store.error ? ['bad', 'Last save failed; will retry on your next change'] : ['ok', 'Saved to your private account space'];
  if (store.mode === 'local') return ['warn', 'Saved in this browser only'];
  return ['bad', 'Not saved: storage is unavailable here'];
}
function setStatus() { const [cls, text] = statusInfo(); for (const el of document.querySelectorAll('.status')) { el.className = 'status ' + cls; el.innerHTML = '<i></i>' + esc(text); } }
async function wipeAll() {
  if (store.mode === 'db') { try { for (const id of Object.keys(store.cache)) await store.col.doc(id).delete(); } catch (e) { store.error = 'unavailable'; } store.cache = {}; }
  try { localStorage.removeItem(LKEY); } catch (e) { }
  S = EMPTY(); resetDrafts();
}
function resetDrafts() { ui.pf = null; ui.pq = null; ui.vk = null; ui.ci = null; ui.an = null; ui.jf = null; ui.obStep = 0; ui.confirm = null; }
async function boot() {
  const local = localLoad();
  if (local) S = Object.assign(EMPTY(), local, { saved: Object.assign({ meals: [], blends: [] }, local.saved) });
  readRoute(); render(true);
  const c = window.claude;
  const fallback = () => { store.mode = localOK() ? 'local' : 'memory'; };
  if (!c || !c.use) { fallback(); setStatus(); return; }
  c.use('downloads').then(d => { caps.downloads = d; }).catch(() => { });
  c.use('sample').then(async s => { caps.sample = s; if (s) { try { const l = await s.limits(); caps.images = !!(l && l.images); } catch (e) { } if (caps.images && (ui.route === 'analyzer' || ui.route === 'journal')) render(); } }).catch(() => { });
  try {
    const [user, db] = await Promise.all([c.use('user'), c.use('db')]);
    const id = user ? await user.id() : null;
    if (db && id) {
      store.col = db.collection('data/users/' + id);
      const snap = await store.col.limit(1000).get();
      const remote = {};
      for (const d of snap.docs) { const b = d.data(); if (b && typeof b.json === 'string') remote[d.id] = b.json; }
      store.cache = remote; store.mode = 'db';
      if (Object.keys(remote).length) { const loaded = fromDocs(remote); if (store.sample) store.real = loaded; else { S = loaded; resetDrafts(); } }
      else if (!store.sample && hasData(S)) persist();
    } else fallback();
  } catch (e) { fallback(); }
  if (store.mode === 'local' && !store.sample && hasData(S)) localSave();
  render();
}

/* ---------- Navigation and rendering ---------- */
const NAV = [
  ['Start', [['home', 'Welcome']]],
  ['You', [['dashboard', 'Dashboard'], ['prakriti', 'Prakriti'], ['vikriti', 'Vikriti'], ['checkin', 'Daily check-in']]],
  ['Food', [['foods', 'Food explorer'], ['spices', 'Spice comparison'], ['analyzer', 'Recipe analyzer']]],
  ['Plan', [['meals', 'Meal ideas'], ['planner', 'Weekly planner'], ['journal', 'Journal'], ['trends', 'Trends']]],
  ['About', [['sources', 'Sources and method'], ['settings', 'Profile and privacy']]]
];
const LOGO = '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="10" r="7.5" fill="var(--vata)" opacity=".85"/><circle cx="9.5" cy="19.5" r="7.5" fill="var(--kapha)" opacity=".85"/><circle cx="20.5" cy="19.5" r="7.5" fill="var(--pitta)" opacity=".85"/></svg>';
const TAB_ICONS = {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  checkin: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  analyzer: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M13.5 7c0-1.5 1.5-1.5 1.5-3"/>',
  journal: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'
};
const tabIcon = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_ICONS[k] + '</svg>';
function readRoute() { const h = (location.hash || '#home').slice(1); ui.route = PAGES[h] ? h : 'home'; }
function go(r) { if (('#' + r) === location.hash) { render(true); } else location.hash = r; }
function needsDot(r) { if (store.mode === 'pending') return false; if (r === 'checkin') return !!(S.profile && !S.checkins[todayStr()]); if (r === 'prakriti') return !!(S.profile && !S.prakriti); if (r === 'vikriti') return !!(S.prakriti && !S.vikriti.length); return false; }
function renderNav() {
  const link = ([r, label]) => '<a class="navlink" href="#' + r + '"' + (ui.route === r ? ' aria-current="page"' : '') + '><span>' + label + '</span>' + (needsDot(r) && ui.route !== r ? '<span class="dot" title="Something to do here"></span>' : '') + '</a>';
  $('#side').innerHTML = '<a class="brand" href="#home">' + LOGO + '<b>Tridosha</b></a>' + NAV.map(([g, items]) => '<div class="navgroup"><h4>' + g + '</h4>' + items.map(link).join('') + '</div>').join('') + '<span class="status" style="margin-top:auto"></span>';
  $('#brandTop').innerHTML = LOGO + '<b>Tridosha</b>';
  const tabs = [['home', 'Home'], ['checkin', 'Today'], ['analyzer', 'Analyze'], ['journal', 'Journal']];
  const inTabs = tabs.some(t => t[0] === ui.route);
  $('#tabs').innerHTML = tabs.map(([r, l]) => '<a href="#' + r + '"' + (ui.route === r ? ' aria-current="page"' : '') + '>' + tabIcon(r) + l + '</a>').join('') + '<button type="button" data-act="more"' + (!inTabs ? ' aria-current="page"' : '') + '>' + tabIcon('more') + 'More</button>';
  $('#banner').innerHTML = store.sample ? '<div class="banner"><span><b>Sample data.</b> These entries are invented examples, not yours. Nothing you do in sample mode is saved.</span><button class="btn sm" data-act="sample-clear">Leave sample mode</button></div>' : '';
  setStatus();
}
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  if (el.dataset && el.dataset.act) return Object.entries(el.dataset).map(([k, v]) => '[data-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '="' + CSS.escape(v) + '"]').join('');
  return null;
}
function render(top) {
  const key = top ? null : focusKey(document.activeElement);
  renderNav();
  $('#view').innerHTML = PAGES[ui.route]();
  if (top) window.scrollTo(0, 0);
  else if (key) { const el = document.querySelector('#view ' + key); if (el) { el.focus({ preventScroll: true }); if (el.tagName === 'INPUT' && el.type === 'text') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } } } }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function openSheet() {
  $('#sheet').hidden = false;
  $('#sheet').innerHTML = '<div class="sheet" data-act="sheet-close"><div role="dialog" aria-label="All sections">' + NAV.map(([g, items]) => '<div class="navgroup"><h4>' + g + '</h4>' + items.map(([r, l]) => '<a class="navlink" href="#' + r + '"' + (ui.route === r ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') + '</div>').join('') + '<span class="status"></span><button class="btn" data-act="sheet-close">Close</button></div></div>';
  setStatus();
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }

/* ---------- Small view helpers ---------- */
const EFF_SVG = { '-': '<path d="M5 9 1 2.5h8z" fill="currentColor"/>', '+': '<path d="M5 1 9 7.5H1z" fill="currentColor"/>', '~': '<path d="M5 .8 9.2 5 5 9.2.8 5z" fill="currentColor"/>', '?': '<circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>' };
const eff = (code, d, short) => '<span class="eff ' + EFFECT[code].cls + '"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' + EFF_SVG[code] + '</svg>' + (d ? '<span class="muted">' + (short ? d.toUpperCase() : DOSHA[d]) + '</span> ' : '') + EFFECT[code].word + '</span>';
const tierTag = t => '<span class="tag ' + t + '" title="' + esc(TIER[t].long) + '">' + TIER[t].label + '</span>';
const srcTags = ids => (ids || []).map(id => SRC[id] ? '<a class="tag" href="#sources" data-act="src-open" data-id="' + id + '" title="' + esc(SRC[id].title + ', ' + SRC[id].loc) + '">' + id + '</a>' : '').join(' ');
const meter = (label, pct, cls, val) => '<div class="meter"><span>' + label + '</span><span class="track"><i class="' + cls + '" style="width:' + clamp(pct, 0, 100) + '%"></i></span><b class="num">' + val + '</b></div>';
const chip = (act, attrs, label, on) => '<button type="button" class="chip" data-act="' + act + '" ' + Object.entries(attrs).map(([k, v]) => 'data-' + k + '="' + esc(v) + '"').join(' ') + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
const seg = (act, attrs, opts, cur, label) => '<span class="seg" role="group" aria-label="' + esc(label || '') + '">' + opts.map(([v, l]) => '<button type="button" data-act="' + act + '" ' + Object.entries(attrs).map(([k, x]) => 'data-' + k + '="' + esc(x) + '"').join(' ') + ' data-v="' + esc(v) + '" aria-pressed="' + (String(cur) === String(v) ? 'true' : 'false') + '">' + esc(l) + '</button>').join('') + '</span>';
const select = (id, chg, attrs, opts, cur) => '<select id="' + id + '" data-chg="' + chg + '" ' + Object.entries(attrs || {}).map(([k, v]) => 'data-' + k + '="' + esc(v) + '"').join(' ') + '>' + opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
const pagehead = (eyebrow, title, text) => '<div class="pagehead"><span class="eyebrow">' + eyebrow + '</span><h1>' + title + '</h1>' + (text ? '<p>' + text + '</p>' : '') + '</div>';
const empty = (text, btn) => '<div class="empty"><p>' + text + '</p>' + (btn || '') + '</div>';
function stepBar(step) { const pos = step + 3; const cls = step < 0 ? 'neg' : step === 0 ? 'mid' : ''; return '<div class="steps ' + cls + '" role="img" aria-label="Step ' + pos + ' of 5">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= pos ? 'on' : '') + '"></i>').join('') + '</div>'; }
const nutLine = n => '<span class="num">' + Math.round(n[0]) + ' kcal · ' + r1(n[1]) + ' g protein · ' + r1(n[2]) + ' g carbs · ' + r1(n[3]) + ' g fat · ' + r1(n[4]) + ' g fibre</span>';

/* ---------- Charts ---------- */
function triangle(share) {
  const cx = 150, cy = 128, R = 92, ang = { v: -90, p: 30, k: 150 }, col = { v: 'var(--vata)', p: 'var(--pitta)', k: 'var(--kapha)' };
  const pt = (d, f) => { const a = ang[d] * Math.PI / 180; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const scale = x => clamp(x / 0.7, 0.03, 1);
  let g = '';
  for (const f of [0.2, 0.4, 0.6]) g += '<polygon points="' + ['v', 'p', 'k'].map(d => pt(d, f / 0.7).map(r1).join(',')).join(' ') + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  for (const d of 'vpk') { const [x, y] = pt(d, 1); g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + r1(x) + '" y2="' + r1(y) + '" stroke="var(--line)" stroke-width="1"/>'; }
  g += '<text x="' + (cx + 4) + '" y="' + r1(cy - R * 0.2 / 0.7 - 3) + '" style="font-size:9px">20%</text><text x="' + (cx + 4) + '" y="' + r1(cy - R * 0.4 / 0.7 - 3) + '" style="font-size:9px">40%</text><text x="' + (cx + 4) + '" y="' + r1(cy - R * 0.6 / 0.7 - 3) + '" style="font-size:9px">60%</text>';
  const pts = ['v', 'p', 'k'].map(d => pt(d, scale(share[d])));
  g += '<polygon points="' + pts.map(p => p.map(r1).join(',')).join(' ') + '" fill="var(--sage)" fill-opacity=".28" stroke="var(--sage)" stroke-width="2" stroke-linejoin="round"/>';
  ['v', 'p', 'k'].forEach((d, i) => { g += '<circle cx="' + r1(pts[i][0]) + '" cy="' + r1(pts[i][1]) + '" r="5" fill="' + col[d] + '" stroke="var(--surface)" stroke-width="2"/>'; });
  const lab = { v: [cx, 16, 'middle'], p: [cx + 84, cy + 74, 'middle'], k: [cx - 84, cy + 74, 'middle'] };
  for (const d of 'vpk') g += '<text x="' + lab[d][0] + '" y="' + lab[d][1] + '" text-anchor="' + lab[d][2] + '" style="font-size:13px;font-weight:700;fill:' + col[d] + '">' + DOSHA[d] + ' ' + Math.round(share[d] * 100) + '%</text>';
  return '<svg class="chart" viewBox="0 0 300 216" role="img" aria-label="Share of answers: Vata ' + Math.round(share.v * 100) + ' percent, Pitta ' + Math.round(share.p * 100) + ' percent, Kapha ' + Math.round(share.k * 100) + ' percent" style="max-width:340px;margin:0 auto">' + g + '</svg>';
}
// series: [{name, color, pts:[[dateStr, y]]}], dates: ordered list of date strings spanning the x axis
function lineChart(series, dates, o) {
  o = Object.assign({ min: 0, max: 5, ticks: 5, h: 210, unit: '' }, o);
  const W = 640, H = o.h, L = 34, Rr = 14, T = 12, B = 26, n = dates.length;
  const x = i => L + (n <= 1 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (n - 1));
  const y = v => T + (H - T - B) * (1 - (v - o.min) / (o.max - o.min));
  const idx = Object.fromEntries(dates.map((d, i) => [d, i]));
  let g = '';
  for (let t = 0; t <= o.ticks; t++) { const v = o.min + (o.max - o.min) * t / o.ticks; g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + r1(y(v)) + '" y2="' + r1(y(v)) + '" stroke="var(--line)" stroke-width="1"' + (t ? ' stroke-dasharray="2 4"' : '') + '/><text x="' + (L - 6) + '" y="' + r1(y(v) + 4) + '" text-anchor="end">' + r1(v) + '</text>'; }
  const marks = n <= 8 ? dates.map((d, i) => i) : [0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1];
  for (const i of marks) g += '<text x="' + r1(x(i)) + '" y="' + (H - 7) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + fmtDate(dates[i]) + '</text>';
  for (const s of series) {
    const p = s.pts.filter(q => idx[q[0]] != null && q[1] != null).map(q => [x(idx[q[0]]), y(q[1])]);
    if (!p.length) continue;
    if (p.length > 1) g += '<polyline points="' + p.map(q => q.map(r1).join(',')).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    p.forEach((q, i) => { g += '<circle cx="' + r1(q[0]) + '" cy="' + r1(q[1]) + '" r="' + (i === p.length - 1 ? 4.5 : 2.4) + '" fill="' + s.color + '"' + (i === p.length - 1 ? ' stroke="var(--surface)" stroke-width="1.5"' : '') + '/>'; });
  }
  const legend = '<div class="legend">' + series.map(s => '<span><i class="swatch" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
  return '<div class="stack">' + legend + '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Trend chart') + '">' + g + '</svg></div>';
}
function dateRange(days) { const t = todayStr(), out = []; for (let i = days - 1; i >= 0; i--) out.push(addDays(t, -i)); return out; }

/* ---------- Sample data (in memory only) ---------- */
function sampleData() {
  const s = EMPTY(), t = todayStr();
  s.profile = { done: true, age: '35–44', diet: 'vegetarian', allergens: [], otherAllergy: '', exclusions: [], cuisines: ['North Indian', 'Gujarati'], activity: 'light', bed: '23:15', wake: '06:45', region: 'india', climate: 'hot-dry', season: 'auto', goals: ['Steadier digestion', 'Better sleep'], dislikesText: 'okra', dislikes: ['okra'], likesText: 'paneer, moong dal', kcal: '', health: { consent: false, conditions: [], pregnancy: '', meds: '' } };
  const ans = {}; PQ.forEach((q, i) => { ans[q.id] = [1, 1, 0, 1, 0, 1, 2, 1, 0, 1, 'ns', 1][i % 12]; });
  s.prakriti = { qv: VERSIONS.prakritiQ, sv: VERSIONS.prakritiScore, date: addDays(t, -24), answers: ans, result: scorePrakriti(ans) };
  const wk = [
    { bloat: { f: 2, s: 1, d: 1 }, burn: { f: 2, s: 2, d: 1 }, irritable: { f: 2, s: 1, d: 1 }, sleep: { f: 1, s: 1, d: 0 } },
    { bloat: { f: 3, s: 2, d: 1 }, constip: { f: 2, s: 1, d: 0 }, sleep: { f: 3, s: 2, d: 1 }, restless: { f: 2, s: 2, d: 0 }, burn: { f: 1, s: 1, d: 1 }, stress: { f: 3, s: 2, d: 1 } },
    { bloat: { f: 4, s: 2, d: 1 }, constip: { f: 3, s: 2, d: 1 }, sleep: { f: 3, s: 2, d: 1 }, restless: { f: 3, s: 2, d: 1 }, dry: { f: 3, s: 1, d: 1 }, energy: { f: 2, s: 2, d: 0 }, stress: { f: 3, s: 2, d: 1 } }
  ];
  wk.forEach((a, i) => { const r = scoreVikriti(a); s.vikriti.push({ date: addDays(t, -15 + i * 7), qv: VERSIONS.vikritiQ, sv: VERSIONS.vikritiScore, ans: a, loads: r.loads }); });
  for (let i = 20; i >= 0; i--) { if (i === 9 || i === 4) continue; const k = (i * 7) % 5; s.checkins[addDays(t, -i)] = { bloat: i < 10 ? [2, 1, 2, 3, 1][k] : [0, 1, 1, 0, 2][k], burn: [0, 1, 0, 0, 1][k], heavy: [0, 0, 1, 0, 0][k], bowel: i < 8 ? ['c', 'n', 'c', 'n', 'n'][k] : 'n', energy: [3, 4, 2, 3, 3][k], sleepQ: i < 10 ? [2, 3, 2, 3, 4][k] : [4, 3, 4, 3, 4][k], sleepH: [6, 6.5, 5.5, 7, 6.5][k], stress: i < 10 ? [4, 3, 4, 3, 2][k] : [2, 3, 2, 3, 2][k], feel: i < 8 && k < 2 ? ['restless'] : [], activity: ['light', 'none', 'moderate', 'light', 'none'][k], note: '' }; }
  const dish = (id) => ({ dishId: id, name: DISH[id].name, items: DISH[id].ing.map(([a, b, c]) => ({ id: a, qty: b, unit: c })), serves: 2 });
  const log = (back, time, slot, id, comfort, sym, enjoy) => s.meals.push(Object.assign({ id: uid(), date: addDays(t, -back), time, slot, portion: 'regular', after: { comfort, energy: comfort >= 4 ? 4 : 3, enjoy, symptoms: sym }, note: '' }, dish(id)));
  [[13, 1, ['bloat']], [11, 2, ['bloat']], [9, 4, []], [6, 2, ['bloat', 'heavy']], [4, 2, ['bloat']], [1, 4, []]].forEach(([b, c, sy]) => log(b, '13:15', 'lunch', 'aloo_tamatar', c, sy, 4));
  [[12, 5], [10, 4], [7, 5], [5, 5], [2, 4]].forEach(([b, c]) => log(b, '20:10', 'dinner', 'moong_dal', c, [], 4));
  [[12, 4], [8, 4], [3, 5]].forEach(([b, c]) => log(b, '08:20', 'breakfast', 'moong_chilla', c, [], 5));
  [[8, 3, ['heavy']], [3, 3, ['heavy']], [0, 4, []]].forEach(([b, c, sy]) => log(b, '21:20', 'dinner', 'palak_paneer', c, sy, 5));
  log(6, '20:30', 'dinner', 'khichdi', 5, [], 3); log(0, '13:00', 'lunch', 'khichdi', 5, [], 4);
  s.meals.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return s;
}
