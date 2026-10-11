/* ============================================================
   Hosted build only: profiles stored in Supabase, with no sign-in screen.
   Loaded last. Its boot, render, flushDb, statusInfo and wipeAll
   replace the ones in 30-core.js (later declarations win).
   ============================================================ */
var web;
const CFG = window.TRIDOSHA_CONFIG || {};
const PID_KEY = 'tridosha:pid';
const webOn = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && !/YOUR-/.test(CFG.supabaseUrl + CFG.supabaseAnonKey));
const activeProfile = () => web && web.profiles.find(p => p.id === web.pid);
const errText = e => (e && (e.message || e.error_description)) || 'Something went wrong. Check your connection and try again.';

async function boot() {
  await null; // let the rest of the script finish loading first
  web = { on: webOn(), configured: webOn(), sb: null, session: null, ready: false, profiles: [], pid: null, pname: '', err: '', confirm: null };
  caps.downloads = { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return { status: 'saved' }; } };
  readRoute();
  if (!web.on) {
    const local = localLoad();
    if (local) S = Object.assign(EMPTY(), local, { saved: Object.assign({ meals: [], blends: [] }, local.saved) });
    store.mode = localOK() ? 'local' : 'memory'; web.ready = true; render(true); return;
  }
  NAV[4][1].push(['account', 'Profiles']);
  render(true);
  try {
    web.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    web.sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => onAuth(ev, session), 0); });
    const { data, error } = await web.sb.auth.getSession();
    if (error) throw error;
    if (data.session) await onAuth('INIT', data.session); else await anonSignIn();
  } catch (e) { localFallback(); }
}
// No sign-in screen: each browser gets its own invisible account the first time it opens the site.
async function anonSignIn() {
  const { data, error } = await web.sb.auth.signInAnonymously();
  if (error || !data.session) return localFallback();
  await onAuth('INIT', data.session);
}
// Database unreachable or anonymous sign-ins switched off: keep working, saving to this browser.
function localFallback() {
  web.on = false; web.session = null; web.pid = null;
  const i = NAV[4][1].findIndex(x => x[0] === 'account'); if (i >= 0) NAV[4][1].splice(i, 1);
  const local = localLoad();
  S = local ? Object.assign(EMPTY(), local, { saved: Object.assign({ meals: [], blends: [] }, local.saved) }) : EMPTY();
  resetDrafts(); store.mode = localOK() ? 'local' : 'memory'; web.ready = true; render(true);
}
async function onAuth(ev, session) {
  const was = web.session && web.session.user.id, now = session && session.user.id;
  if (was === now) { web.session = session; return; }
  web.session = session;
  if (now && now !== was) await loadProfiles();
  if (!now) { S = EMPTY(); resetDrafts(); web.profiles = []; web.pid = null; store.cache = {}; store.mode = 'pending'; store.sample = false; store.real = null; web.ready = false; render(true); return anonSignIn(); }
  web.ready = true; render(true);
}
async function loadProfiles() {
  const { data, error } = await web.sb.from('profiles').select('id,name,created_at').order('created_at');
  if (error) { web.err = errText(error); web.profiles = []; web.pid = null; return; }
  web.err = ''; web.profiles = data || [];
  let pid = null; try { pid = localStorage.getItem(PID_KEY); } catch (e) { }
  if (!web.profiles.find(p => p.id === pid)) pid = web.profiles.length === 1 ? web.profiles[0].id : null;
  if (pid) await openProfile(pid); else web.pid = null;
}
async function openProfile(pid) {
  await store.chain; // finish saving the profile being left
  const { data, error } = await web.sb.from('documents').select('doc_id,body').eq('profile_id', pid);
  if (error) { web.err = errText(error); return false; }
  const docs = {}; for (const r of data || []) docs[r.doc_id] = JSON.stringify(r.body);
  store.cache = docs; store.sample = false; store.real = null; store.error = null; store.mode = 'db';
  S = fromDocs(docs); resetDrafts(); web.pid = pid; web.err = '';
  try { localStorage.setItem(PID_KEY, pid); } catch (e) { }
  return true;
}
async function flushDb() {
  if (store.mode !== 'db' || store.sample || !web || !web.pid) return;
  const pid = web.pid, docs = docsOf(S);
  try {
    const up = Object.entries(docs).filter(([id, j]) => store.cache[id] !== j).map(([id, j]) => ({ profile_id: pid, doc_id: id, body: JSON.parse(j), updated_at: new Date().toISOString() }));
    if (up.length) { const { error } = await web.sb.from('documents').upsert(up); if (error) throw error; if (web.pid === pid) for (const u of up) store.cache[u.doc_id] = docs[u.doc_id]; }
    const gone = Object.keys(store.cache).filter(id => !(id in docs));
    if (gone.length && web.pid === pid) { const { error } = await web.sb.from('documents').delete().eq('profile_id', pid).in('doc_id', gone); if (error) throw error; for (const id of gone) delete store.cache[id]; }
    store.error = null;
  } catch (e) { store.error = 'unavailable'; }
  setStatus();
}
function statusInfo() {
  if (store.sample) return ['warn', 'Sample mode: nothing is saved'];
  if (!web || !web.ready) return ['', 'Loading'];
  if (!web.on) return store.mode === 'local' ? ['warn', 'Saved in this browser only'] : ['bad', 'Not saved: storage is unavailable here'];
  if (store.mode === 'db') { const p = activeProfile(); return store.error ? ['bad', 'Last save failed; will retry on your next change'] : ['ok', 'Saved' + (p ? ' · ' + p.name : '')]; }
  return ['', 'Choose a profile'];
}
async function wipeAll() {
  if (web && web.on && web.pid) { await store.chain; const { error } = await web.sb.from('documents').delete().eq('profile_id', web.pid); if (error) store.error = 'unavailable'; store.cache = {}; }
  else { try { localStorage.removeItem(LKEY); } catch (e) { } }
  S = EMPTY(); resetDrafts();
}

/* ---------- Screens ---------- */
function profileRows(manage) {
  return web.profiles.map(p => '<div class="todo"><span class="tick" aria-hidden="true" style="' + (p.id === web.pid ? 'background:var(--sage);border-color:var(--sage);color:var(--surface)' : '') + '">' + (p.id === web.pid ? '✓' : '') + '</span><div><b>' + esc(p.name) + '</b><div class="small muted">' + (p.id === web.pid ? 'Active now' : 'Added ' + fmtDate(String(p.created_at).slice(0, 10))) + '</div></div><div class="row" style="justify-content:flex-end">' + (p.id === web.pid ? '' : '<button class="btn sm' + (manage ? '' : ' primary') + '" data-act="pr-open" data-id="' + p.id + '">' + (manage ? 'Switch to' : 'Open') + '</button>') + (manage ? '<button class="btn sm quiet" data-act="pr-rename" data-id="' + p.id + '">Rename</button>' + (web.confirm === 'pr' + p.id ? '<button class="btn sm danger" data-act="pr-del" data-id="' + p.id + '">Confirm delete</button>' : '<button class="btn sm quiet" data-act="pr-del" data-id="' + p.id + '">Delete</button>') : '') + '</div></div>').join('');
}
function profileAdd() { return '<div class="row" style="align-items:flex-end"><label class="f" for="pr-name" style="flex:1 1 12rem">' + (web.rename ? 'New name' : 'Add a profile') + '<input type="text" id="pr-name" maxlength="60" data-inp="pr-name" value="' + esc(web.pname) + '" placeholder="For example Asha, Dad, or Me"></label><button class="btn primary" data-act="pr-add">' + (web.rename ? 'Save name' : 'Add profile') + '</button>' + (web.rename ? '<button class="btn" data-act="pr-cancel">Cancel</button>' : '') + '</div>'; }
function profilePicker() {
  return '<div class="gate stack">' + '<a class="brand" href="#home">' + LOGO + '<b>Tridosha</b></a><section class="panel"><h2>' + (web.profiles.length ? 'Who is this for?' : 'Add your first profile') + '</h2><p class="small muted">Each profile keeps its own questionnaire results, check-ins, meals and plan. No sign-in needed: they are saved for this browser.</p>' + (web.err ? '<div class="note alert small" role="alert">' + esc(web.err) + '</div>' : '') + (web.profiles.length ? '<div>' + profileRows(false) + '</div>' : '') + profileAdd() + '</section></div>';
}
function accountPage() {
  return pagehead('Profiles', 'Whose data is open', 'Add up to 12 profiles, for example one per family member. Switching profiles swaps every page of the app to that person\'s entries.') +
    '<section class="panel"><header><h2>Profiles</h2><span class="small muted num">' + web.profiles.length + ' of 12</span></header>' + (web.err ? '<div class="note alert small" role="alert">' + esc(web.err) + '</div>' : '') + '<div>' + profileRows(true) + '</div>' + profileAdd() + '<p class="small muted">Deleting a profile permanently removes its assessments, check-ins, meals, blends and plan.</p></section>' +
    '<section class="panel"><h2>Where this is kept</h2><p class="small" style="max-width:42rem">There is no sign-in. The first time this browser opened the site it was given its own private space in the database, and these profiles live there. Other visitors cannot see them. Because nothing ties that space to an email address, the profiles cannot be opened from another device, and clearing this site\'s browser data makes them unreachable. Use Export on the Profile and privacy page to keep a copy.</p><div class="row">' + (web.confirm === 'account' ? '<span class="note alert small" style="flex:1 1 18rem">This permanently deletes every profile saved from this browser. <button class="btn sm danger" data-act="au-delete">Yes, delete everything</button> <button class="btn sm" data-act="pr-cancel">Keep it</button></span>' : '<button class="btn danger" data-act="au-delete-ask">Delete all profiles</button>') + '</div></section>';
}
PAGES.account = () => (web && web.on && web.session ? accountPage() : PAGES.home());
const _settings = PAGES.settings, _sources = PAGES.sources;
PAGES.settings = () => { const h = _settings(); return web && web.on ? h.replace('Each person who opens this page gets a private space tied to their own account. Other viewers, including whoever shared the page with you, cannot read it.', 'Stored in the project database under the active profile, in a private space belonging to this browser. Other visitors cannot read it. <a href="#account">Manage profiles</a>').replace('>Delete all my data<', '>Delete this profile\'s data<') : h; };
PAGES.sources = () => _sources().replace('Sign-in comes from your Claude account;', 'No sign-up: each browser gets a private space, with profiles inside it;').replace('Claude account identity and a private per-person document store', 'Supabase anonymous sessions, profiles per browser, and a document table locked by row-level security').replace('It is not the Next.js and Supabase codebase the specification names; a published page cannot ship a server, migrations or a test runner.', 'It is a static site with Supabase storage, not the Next.js codebase the specification names.');

function render(top) {
  const key = top ? null : focusKey(document.activeElement);
  const gate = web && web.on && (!web.ready || !web.session || !web.pid);
  document.querySelector('.app').classList.toggle('locked', !!gate);
  renderNav();
  if (web && web.ready && !web.configured && !store.sample) $('#banner').innerHTML = '<div class="banner"><span><b>Demo mode.</b> No database is connected, so entries stay in this browser. Add your Supabase details to config.js to turn on profiles.</span></div>';
  $('#view').innerHTML = !web || !web.ready ? '<div class="empty" style="margin-top:12vh">Loading…</div>' : gate ? (web.session ? profilePicker() : '<div class="empty" style="margin-top:12vh">Loading…</div>') : PAGES[ui.route]();
  if (top) window.scrollTo(0, 0);
  else if (key) { const el = document.querySelector('#view ' + key); if (el) { el.focus({ preventScroll: true }); if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'password')) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } } } }
}

/* ---------- Actions ---------- */
Object.assign(ACT, {
  'au-delete-ask': () => { web.confirm = 'account'; render(); },
  'au-delete': async () => { const { error } = await web.sb.rpc('delete_my_account'); if (error) { web.err = errText(error); web.confirm = null; return render(); } try { localStorage.removeItem(PID_KEY); } catch (e) { } web.confirm = null; await web.sb.auth.signOut(); toast('Everything deleted'); },
  'pr-open': async d => { if (await openProfile(d.id)) { toast('Now using ' + activeProfile().name); go('home'); } else render(); },
  'pr-add': async () => {
    const name = (($('#pr-name') || {}).value || web.pname).trim().slice(0, 60);
    if (!name) { web.err = 'Give the profile a name.'; return render(); }
    if (web.rename) { const { error } = await web.sb.from('profiles').update({ name }).eq('id', web.rename); if (error) web.err = errText(error); else { web.profiles.find(p => p.id === web.rename).name = name; web.err = ''; } web.rename = null; web.pname = ''; return render(); }
    const { data, error } = await web.sb.from('profiles').insert({ name }).select('id,name,created_at').single();
    if (error) { web.err = errText(error); return render(); }
    web.profiles.push(data); web.pname = ''; web.err = '';
    if (!web.pid) { await openProfile(data.id); toast('Profile created'); go('home'); } else { toast('Profile added'); render(); }
  },
  'pr-rename': d => { web.rename = d.id; web.pname = web.profiles.find(p => p.id === d.id).name; web.confirm = null; render(); const el = $('#pr-name'); if (el) el.focus(); },
  'pr-cancel': () => { web.rename = null; web.pname = ''; web.confirm = null; render(); },
  'pr-del': async d => {
    if (web.confirm !== 'pr' + d.id) { web.confirm = 'pr' + d.id; return render(); }
    web.confirm = null;
    if (d.id === web.pid) await store.chain;
    const { error } = await web.sb.from('profiles').delete().eq('id', d.id);
    if (error) { web.err = errText(error); return render(); }
    web.profiles = web.profiles.filter(p => p.id !== d.id);
    if (d.id === web.pid) { web.pid = null; S = EMPTY(); resetDrafts(); store.cache = {}; store.mode = 'pending'; try { localStorage.removeItem(PID_KEY); } catch (e) { } }
    toast('Profile deleted'); render(true);
  }
});
INP['pr-name'] = v => { web.pname = v; };
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || !web) return; if (e.target.id === 'pr-name') ACT['pr-add'](); });
