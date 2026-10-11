/* ============================================================
   Tridosha engine — scoring, parsing, dish rules, recommendations
   Pure functions; no DOM.
   ============================================================ */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((s, x) => s + x, 0);
const r1 = x => Math.round(x * 10) / 10;
const todayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); };

/* ---------- Prakriti scoring (PS-1.0) ----------
   Each chosen option adds its weights to a running total per dosha.
   "Not sure" and "Not applicable" add nothing and leave the question out.
   Share = a dosha's total / all three totals. It describes the answers,
   not the body. All questions carry equal weight (no weighting has been
   validated). */
function scorePrakriti(answers) {
  const tot = { v: 0, p: 0, k: 0 }, byCat = {};
  let answered = 0;
  for (const q of PQ) {
    const a = answers[q.id];
    if (typeof a !== 'number') continue;
    answered++;
    const w = q.opts[a].w;
    const c = byCat[q.cat] || (byCat[q.cat] = { v: 0, p: 0, k: 0, n: 0 });
    c.n++;
    for (const d of 'vpk') { tot[d] += w[d] || 0; c[d] += w[d] || 0; }
  }
  const all = tot.v + tot.p + tot.k;
  const share = { v: 0, p: 0, k: 0 };
  if (all) for (const d of 'vpk') share[d] = tot[d] / all;
  const order = ['v', 'p', 'k'].sort((a, b) => share[b] - share[a]);
  const [a, b, c] = order;
  let type, label, desc;
  if (!all) { type = 'none'; label = 'Not scored'; desc = ''; }
  else if (share[a] - share[c] < 0.10) { type = 'mixed'; label = 'Mixed pattern'; desc = 'Your answers were spread almost evenly across the three descriptions.'; }
  else if (share[a] >= 0.5 && share[a] - share[b] >= 0.15) { type = 'single'; label = DOSHA[a] + '-dominant pattern'; desc = 'At least half of your answers matched the traditional ' + DOSHA[a] + ' descriptions, clearly ahead of the other two.'; }
  else if (share[a] - share[b] < 0.15 && share[c] < 0.25) { type = 'dual'; label = DOSHA[a] + '–' + DOSHA[b] + ' pattern'; desc = 'Your answers were shared between the ' + DOSHA[a] + ' and ' + DOSHA[b] + ' descriptions, with few matching ' + DOSHA[c] + '.'; }
  else { type = 'leaning'; label = DOSHA[a] + '-leaning pattern'; desc = 'More of your answers matched ' + DOSHA[a] + ' than the others, without a strong lead.'; }
  const coverage = answered / PQ.length;
  const margin = share[a] - share[b];
  let stability = 'Low';
  if (coverage >= 0.8 && margin >= 0.15) stability = 'Higher';
  else if (coverage >= 0.66 && margin >= 0.07) stability = 'Moderate';
  return { tot, share, order, type, label, desc, answered, total: PQ.length, coverage, margin, stability, byCat, lead: all ? a : null, second: all ? b : null };
}

/* ---------- Vikriti scoring (VS-1.0) ----------
   Symptom load for a dosha = 100 × Σ weight × (frequency/4) × (severity/3)
   ÷ Σ weight, over the symptoms traditionally associated with it.
   Each load is an independent 0–100 index of recent symptoms. The three
   are not shares of a whole and are never subtracted from Prakriti shares. */
function scoreVikriti(ans) {
  const num = { v: 0, p: 0, k: 0 }, den = { v: 0, p: 0, k: 0 }, active = [], flags = [];
  for (const q of VQ) {
    const a = ans[q.id] || { f: 0 };
    const inten = (a.f / 4) * ((a.f ? (a.s || 1) : 0) / 3);
    if (q.assoc) for (const d of 'vpk') if (q.assoc[d]) { den[d] += q.assoc[d]; num[d] += q.assoc[d] * inten; }
    if (a.f > 0) {
      active.push({ id: q.id, text: q.text, f: a.f, s: a.s || 1, d: a.d || 0, inten, assoc: q.assoc });
      if ((a.d || 0) >= 3) flags.push({ id: q.id, text: q.text, why: 'present for more than three months' });
      else if (a.f >= 4 && (a.s || 1) >= 3 && (a.d || 0) >= 1) flags.push({ id: q.id, text: q.text, why: 'strong, daily, and lasting more than a week' });
      else if (a.f >= 3 && (a.d || 0) >= 2) flags.push({ id: q.id, text: q.text, why: 'frequent for more than a month' });
    }
  }
  const loads = {};
  for (const d of 'vpk') loads[d] = Math.round(100 * num[d] / den[d]);
  active.sort((x, y) => y.inten - x.inten);
  return { loads, active, flags };
}
function vikritiFocus(loads) {
  const order = ['v', 'p', 'k'].sort((a, b) => loads[b] - loads[a]);
  if (loads[order[0]] < 15) return null;
  return { d: order[0], d2: loads[order[1]] >= 15 && loads[order[0]] - loads[order[1]] < 8 ? order[1] : null };
}
function currentFocus(S) {
  const vk = S.vikriti && S.vikriti.length ? S.vikriti[S.vikriti.length - 1] : null;
  if (vk) { const f = vikritiFocus(vk.loads); if (f) return Object.assign(f, { basis: 'vikriti', date: vk.date }); }
  if (S.prakriti && S.prakriti.result && S.prakriti.result.lead && S.prakriti.result.type !== 'mixed') return { d: S.prakriti.result.lead, d2: S.prakriti.result.type === 'dual' ? S.prakriti.result.second : null, basis: 'prakriti' };
  return null;
}

/* ---------- Units ---------- */
function toGrams(f, qty, unit) {
  const tsp = f.tsp || (f.cat === 'spice' ? 2.5 : 5);
  switch (unit) {
    case 'g': case 'ml': return qty;
    case 'tsp': return qty * tsp;
    case 'tbsp': return qty * tsp * 3;
    case 'cup': return qty * (f.cup || 150);
    case 'pinch': return qty * 0.3;
    case 'pc': return qty * (f.pc || f.g);
    default: return qty;
  }
}
function fmtQty(q) {
  const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };
  const whole = Math.floor(q), rest = Math.round((q - whole) * 100) / 100;
  if (fr[rest]) return (whole || '') + fr[rest];
  return String(Math.round(q * 100) / 100);
}
function fmtItem(it) { const f = FOOD[it.id]; const u = it.unit === 'pc' ? '' : ' ' + it.unit; return fmtQty(it.qty) + u + ' ' + f.en.toLowerCase(); }

/* ---------- Recipe parser ---------- */
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIASES = [];
for (const f of FOODS) for (const a of (f.al || [])) ALIASES.push({ a, id: f.id, re: new RegExp('\\b' + escRe(a) + '(?:es|s)?\\b', 'g') });
ALIASES.sort((x, y) => y.a.length - x.a.length);
const DISH_ALIASES = [];
for (const d of DISHES) for (const a of d.al) DISH_ALIASES.push({ a, id: d.id });
DISH_ALIASES.sort((x, y) => y.a.length - x.a.length);
const NUM = '(\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|\\ba\\b|\\ban\\b|\\bone\\b|\\btwo\\b|\\bthree\\b|\\bfour\\b|\\bhalf\\b)';
const UNIT = '(tsp|teaspoons?|tbsp|tablespoons?|cups?|kg|gms?|grams?|g|ml|l|pinch(?:es)?|cloves?|pieces?|pcs?|pods?|sticks?|medium|large|small|whole)';
const RE_BEFORE = new RegExp(NUM + '\\s*' + UNIT + '?\\.?\\s*(?:of\\s+)?(?:[a-z]+\\s+)?$');
const RE_AFTER = new RegExp('^\\s*[:\\-–(]?\\s*' + NUM + '\\s*' + UNIT + '?');
const STOP = new Set(('sabzi sabji curry masala tadka powder seeds seed fresh chopped sliced diced boiled cooked with and the for some little taste made style home dish recipe simple spicy mild plain mixed bowl plate serving servings ground whole fried roasted steamed grilled gravy dry into then also plus about each small medium large finely grated crushed pinch cups teaspoon tablespoon bhurji pulao khichdi tamatar leaves leaf').split(' '));
function normText(t) {
  let s = ' ' + String(t || '').toLowerCase() + ' ';
  s = s.replace(/chill?i(?:e)?s\b/g, 'chilis').replace(/chilli|chile\b/g, 'chili').replace(/&/g, ' and ');
  const fr = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67 };
  s = s.replace(/(\d+)?\s*([½¼¾⅓⅔])/g, (m, w, f) => ' ' + ((+w || 0) + fr[f]));
  s = s.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (m, w, a, b) => String(+w + a / b));
  s = s.replace(/\bcloves?(\s+of)?\s+garlic/g, 'pcs garlic').replace(/garlic\s+cloves?/g, 'garlic');
  return s;
}
function parseNum(n) {
  n = n.trim();
  const words = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, half: 0.5 };
  if (words[n] != null) return words[n];
  if (n.includes('/')) { const [a, b] = n.split('/').map(Number); return b ? a / b : a; }
  return parseFloat(n);
}
function normUnit(u, f, q) {
  if (!u) { if (f.pc && q <= 12) return ['pc', q]; if (q >= 20) return ['g', q]; return [f.def ? f.def[1] : 'g', q]; }
  if (/^tsp|^teasp/.test(u)) return ['tsp', q];
  if (/^tbsp|^tablesp/.test(u)) return ['tbsp', q];
  if (/^cup/.test(u)) return ['cup', q];
  if (u === 'kg') return ['g', q * 1000];
  if (u === 'l') return ['ml', q * 1000];
  if (/^g/.test(u)) return ['g', q];
  if (u === 'ml') return ['ml', q];
  if (/^pinch/.test(u)) return ['pinch', q];
  if (u === 'large') return ['pc', q * 1.3];
  if (u === 'small') return ['pc', q * 0.7];
  return ['pc', q];
}
function parseRecipe(text) {
  const s = normText(text);
  let work = s, dish = null;
  for (const da of DISH_ALIASES) { if (new RegExp('\\b' + escRe(da.a) + '\\b').test(s)) { dish = DISH[da.id]; break; } }
  const found = [];
  for (const al of ALIASES) {
    al.re.lastIndex = 0; let m;
    while ((m = al.re.exec(work))) {
      found.push({ id: al.id, idx: m.index, len: m[0].length });
      work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
      al.re.lastIndex = m.index + m[0].length;
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  const items = [], seen = {};
  for (const h of found) {
    const f = FOOD[h.id];
    let qty = null, unit = null;
    const before = s.slice(Math.max(0, h.idx - 30), h.idx).match(RE_BEFORE);
    const after = s.slice(h.idx + h.len, h.idx + h.len + 18).match(RE_AFTER);
    const m = before || after;
    if (m) { const q = parseNum(m[1]); if (isFinite(q) && q > 0) { [unit, qty] = normUnit(m[2], f, q); } }
    if (seen[h.id]) { if (qty != null && seen[h.id].assumed) Object.assign(seen[h.id], { qty, unit, assumed: false }); continue; }
    const it = qty != null ? { id: h.id, qty, unit, assumed: false } : { id: h.id, qty: f.def[0], unit: f.def[1], assumed: true };
    seen[h.id] = it; items.push(it);
  }
  let usedPreset = false, out = items;
  if (dish && items.length < 3) {
    usedPreset = true;
    out = dish.ing.map(([id, qty, unit]) => seen[id] && !seen[id].assumed ? seen[id] : { id, qty, unit, assumed: true });
    for (const it of items) if (!out.find(o => o.id === it.id)) out.push(it);
  }
  // leftovers
  let left = work;
  if (dish) for (const da of DISH_ALIASES) left = left.replace(new RegExp('\\b' + escRe(da.a) + '\\b', 'g'), ' ');
  const unknown = [...new Set((left.match(/[a-z]{4,}/g) || []).filter(w => !STOP.has(w) && !new RegExp('^' + UNIT + '$').test(w)))].slice(0, 8);
  // method guess
  let method = dish ? dish.method : 'saute', water = dish ? dish.water : 'semi';
  if (!dish) {
    if (/deep[- ]?fr|pakora|puri\b|bhaji/.test(s)) { method = 'fried'; water = 'dry'; }
    else if (/dal\b|soup|rasam|sambar|khichdi|porridge/.test(s)) { method = 'pressure'; water = 'soupy'; }
    else if (/curry|gravy|rasedar|jhol|korma/.test(s)) { method = 'simmer'; water = 'gravy'; }
    else if (/roast|grill|tandoor|bharta|baked/.test(s)) { method = 'roast'; water = 'dry'; }
    else if (/raw|salad|raita|chutney/.test(s)) { method = 'raw'; water = 'semi'; }
    else if (/sabzi|sabji|bhurji|stir|poriyal|thoran/.test(s)) { method = 'saute'; water = out.find(i => i.id === 'tomato') ? 'semi' : 'dry'; }
  }
  return { items: out, dish, usedPreset, unknown, method, water };
}

/* ---------- Dish analysis (DR-1.0) ---------- */
const DRY_WEIGHT = { moong: 2.5, toor: 2.5, masoor: 2.5, chanadal: 2.5, urad: 2.5, oats: 2.5 };
const SUIT = { 2: 'Well suited', 1: 'Generally suited', 0: 'Depends on preparation', '-1': 'Less suited as prepared', '-2': 'Least suited as prepared' };
const EVAL = { '-': 1, '~': 0, '+': -1, '?': 0 };
function dishNutrition(items, serves) {
  const n = [0, 0, 0, 0, 0];
  for (const it of items) { const f = FOOD[it.id]; const g = toGrams(f, it.qty, it.unit); for (let i = 0; i < 5; i++) n[i] += (f.nut[i] || 0) * g / f.g; }
  return n.map(x => x / (serves || 1));
}
function analyzeDish(items, o) {
  o = Object.assign({ method: 'saute', water: 'semi', portion: 'regular', serves: 2 }, o || {});
  const rows = items.filter(it => FOOD[it.id]).map(it => { const f = FOOD[it.id]; return { it, f, g: toGrams(f, it.qty, it.unit) }; });
  const isFat = r => r.f.cat === 'fat' || r.f.fatType;
  const mains = rows.filter(r => !r.f.spice && !isFat(r));
  for (const r of mains) r.sg = r.g * (DRY_WEIGHT[r.f.id] || 1); // dry pulses and oats swell when cooked
  const total = sum(mains.map(r => r.sg)) || 1;
  for (const r of rows) {
    if (isFat(r)) r.role = 'Cooking fat';
    else if (r.f.spice) r.role = 'Seasoning';
    else { r.share = r.sg / total; r.role = r.share >= 0.25 ? 'Base' : r.share >= 0.05 ? 'Supporting' : 'Minor'; }
  }
  let base = mains.filter(r => r.role === 'Base');
  if (!base.length && mains.length) { const top = mains.slice().sort((a, b) => b.sg - a.sg)[0]; top.role = 'Base'; base = [top]; }
  const baseShare = sum(base.map(r => r.share)) || 1;
  const fats = rows.filter(isFat);
  const fatG = sum(fats.map(r => r.g)) / o.serves;
  const fatLevel = o.method === 'fried' ? 'heavy' : fatG < 0.5 ? 'none' : fatG < 5 ? 'light' : fatG <= 12 ? 'moderate' : 'heavy';
  const mainFat = fats.slice().sort((a, b) => b.g - a.g)[0];
  const heat = sum(rows.map(r => r.g * (r.f.heatG || 0))) / o.serves;
  const heatClass = heat < 0.5 ? 'mild' : heat <= 1.3 ? 'medium' : 'hot';
  const sourShare = sum(mains.filter(r => r.f.sour).map(r => r.sg)) / total;
  const sourSpice = rows.some(r => r.f.spice && r.f.sour);
  const digs = rows.filter(r => r.f.dig).map(r => r.f.en.toLowerCase());
  const cools = rows.filter(r => r.f.cool).map(r => r.f.en.toLowerCase());
  const gasBase = base.filter(r => r.f.gas).map(r => r.f.en.toLowerCase());
  const has = id => rows.some(r => r.f.id === id);
  const names = l => l.join(', ');
  const readings = {};
  for (const d of 'vpk') {
    const trace = [];
    const m = sum(base.map(r => r.share * EVAL[r.f[d]])) / baseShare;
    const b0 = m >= 0.34 ? 1 : m <= -0.34 ? -1 : 0;
    trace.push({ rule: 'R2', delta: b0, base: true, text: 'Base: ' + base.map(r => r.f.en.toLowerCase() + ' (' + EFFECT[r.f[d]].word.toLowerCase() + ')').join(', ') + '.', src: [...new Set(base.flatMap(r => r.f.src))].slice(0, 3) });
    const mod = (rule, delta, text, src) => trace.push({ rule, delta, text, src: src || ['CS-VI1'] });
    if (d === 'v') {
      if (o.water === 'gravy' || o.water === 'soupy') mod('R4', 1, 'Moist, soft cooking counters dryness.');
      if (o.method === 'raw') mod('R4', -1, 'Uncooked food is read as cold and rough.');
      else if (o.water === 'dry' && (fatLevel === 'none' || fatLevel === 'light')) mod('R4', -1, 'Dry cooking with little fat adds to dry, rough qualities.');
      if (digs.length >= 2 && gasBase.length) mod('R3', 1, 'Carminative seasoning (' + names(digs.slice(0, 4)) + ') is the traditional pairing for ' + names(gasBase) + '.', ['CS-VI1', 'CS-SU27']);
      if (heatClass === 'hot') mod('R3', -1, 'Very pungent seasoning is read as drying in excess.', ['CS-VI1', 'AH-SU10']);
      if (mainFat && (mainFat.f.id === 'ghee' || mainFat.f.id === 'sesameoil') && (fatLevel === 'moderate' || fatLevel === 'heavy') && b0 <= 0 && o.water === 'dry') mod('R5', 1, mainFat.f.en + ' adds unctuousness to a dry dish.', ['CS-SU13']);
    }
    if (d === 'p') {
      if (heatClass === 'hot') mod('R3', -1, 'Chili and pepper together reach a hot level for this many servings.', ['CS-VI1', 'LAD']);
      if (sourShare >= 0.25 || (sourSpice && sourShare >= 0.1)) mod('R3', -1, 'Sour ingredients make up about ' + Math.round(sourShare * 100) + '% of the dish' + (sourSpice ? ', plus a sour spice' : '') + '.', ['CS-VI1', 'AH-SU10']);
      if (mainFat && mainFat.f.id === 'ghee') mod('R5', 1, 'Cooked in ghee, which is classically read as Pitta-pacifying.', ['CS-SU13']);
      if (mainFat && mainFat.f.hotOil) mod('R5', -1, 'Mustard oil is classically described as sharp and heating.', ['CS-SU27']);
      if (cools.length >= 2) mod('R3', 1, 'Aromatic, low-heat seasoning (' + names(cools) + ').', ['BPN', 'LAD']);
      if (o.method === 'fried') mod('R4', -1, 'Deep-frying is read as heating and heavy.');
    }
    if (d === 'k') {
      if (o.method === 'fried' || fatLevel === 'heavy') mod('R5', -1, 'A large amount of fat adds heavy, unctuous qualities.', ['CS-VI1', 'CS-SU13']);
      if (heatClass !== 'mild') mod('R3', 1, 'Pungent seasoning is the traditional counter to heavy, cool qualities.', ['CS-VI1', 'AH-SU10']);
      if ((o.water === 'dry' || o.method === 'roast') && fatLevel !== 'heavy' && o.method !== 'fried') mod('R4', 1, 'Dry or roasted cooking keeps the dish light.');
      if (o.portion === 'large') mod('R6', -1, 'A large portion is itself read as heavy.', ['CS-SU5']);
    }
    const mods = clamp(sum(trace.filter(t => !t.base).map(t => t.delta)), -2, 2);
    let step = clamp(b0 + mods, -2, 2);
    if (d === 'p' && heatClass === 'medium' && step > 1) { step = 1; trace.push({ rule: 'R3', delta: 0, text: 'Medium chili heat keeps this from the top reading.', src: ['LAD'] }); }
    readings[d] = { step, label: SUIT[step], base: b0, trace };
  }
  // documented combinations
  const combos = [];
  if ((has('fish') || has('salmon')) && has('milk')) combos.push({ text: 'Fish with milk is named as an incompatible combination in the classical lists.', src: ['CS-SU26'], tier: 'C' });
  if (has('milk') && rows.some(r => r.f.sour)) combos.push({ text: 'Milk with sour foods is named as an incompatible combination in the classical lists.', src: ['CS-SU26'], tier: 'C' });
  if (has('milk') && has('banana')) combos.push({ text: 'Some modern authors advise against milk with banana. This is not a classical rule.', src: ['LAD'], tier: 'M' });
  if (has('melon') && mains.length > 1) combos.push({ text: 'Modern authors advise eating melon on its own. This is not a classical rule.', src: ['LAD'], tier: 'M' });
  if ((has('yogurt') || has('greekyogurt')) && o.slot === 'dinner') combos.push({ text: 'Classical advice is to avoid yogurt at night.', src: ['CS-SU7'], tier: 'C' });
  if ((has('yogurt') || has('greekyogurt')) && o.method !== 'raw' && o.method !== 'mixed') combos.push({ text: 'Several classical lists advise against heating yogurt. Curries that simmer yogurt are common all the same; this is a note, not a warning.', src: ['CS-SU26'], tier: 'C' });
  // uncertainty
  const uncertain = [];
  for (const r of base) {
    if (r.f.tier === 'M') uncertain.push(r.f.en + ' has no classical description; its reading is a modern interpretation.');
    if (r.f.tier === 'U') uncertain.push(r.f.en + ' has no established traditional classification and was treated as neutral.');
    if (r.f.dis) uncertain.push(r.f.en + ': sources disagree. ' + r.f.dis);
  }
  if (items.some(i => i.assumed)) uncertain.push('Some quantities are typical amounts filled in for you. Correct them for a better reading.');
  return { rows, base, readings, heat, heatClass, fatG, fatLevel, mainFat: mainFat ? mainFat.f : null, sourShare, combos, uncertain, nut: dishNutrition(items, o.serves), o, digs, cools, gasBase };
}

/* ---------- Profile checks ---------- */
function avoidedAllergens(P) { const a = new Set((P && P.allergens) || []); if (P && P.health && P.health.consent && (P.health.conditions || []).includes('celiac')) a.add('gluten'); return a; }
function foodCheck(f, P) {
  const hard = [], soft = [];
  if (!P) return { ok: true, hard, soft };
  if (P.diet && !DIET_ALLOW[P.diet].includes(f.diet)) hard.push('not ' + DIETS[P.diet].toLowerCase());
  const al = avoidedAllergens(P);
  for (const a of f.alg) if (al.has(a)) hard.push('contains ' + ALLERGENS[a].toLowerCase());
  for (const e of (P.exclusions || [])) if (EXCLUSIONS[e] && EXCLUSIONS[e].test(f)) hard.push(EXCLUSIONS[e].label.toLowerCase());
  if ((P.dislikes || []).includes(f.id)) soft.push('on your dislike list');
  if (f.hingGluten && al.has('gluten')) soft.push('compounded hing usually contains wheat; use a gluten-free one');
  return { ok: !hard.length, hard, soft };
}
function conditionFlags(f, P) {
  const out = [];
  if (!P || !P.health || !P.health.consent) return out;
  const list = (P.health.conditions || []).slice();
  if (P.health.pregnancy === 'pregnant') list.push('pregnant');
  for (const c of list) if (CONDITIONS[c] && CONDITIONS[c].flag(f)) out.push({ c, label: CONDITIONS[c].label, msg: CONDITIONS[c].msg });
  return out;
}
const SWAP = { paneer: ['tofu'], ghee: ['oil', 'coconutoil'], butter: ['oil'], mustardseeds: ['cumin'], mustardoil: ['oil'], sesameoil: ['oil'], greekyogurt: ['yogurt'], wheat: ['rice'] };
function adaptDish(dish, P) {
  const notes = [], items = [];
  let ok = true;
  const mainsG = sum(dish.ing.filter(([id]) => !FOOD[id].spice && FOOD[id].cat !== 'fat').map(([id, q, u]) => toGrams(FOOD[id], q, u))) || 1;
  for (const [id, qty, unit] of dish.ing) {
    const f = FOOD[id], chk = foodCheck(f, P);
    if (chk.ok) { if (chk.soft.length && f.hingGluten) notes.push('Use gluten-free hing.'); if ((P && (P.dislikes || []).includes(id)) && f.spice) { notes.push('Left out ' + f.en.toLowerCase() + ' (on your dislike list).'); continue; } items.push({ id, qty, unit }); continue; }
    const alt = (SWAP[id] || []).find(a => foodCheck(FOOD[a], P).ok);
    if (alt) { items.push({ id: alt, qty, unit }); notes.push(f.en + ' replaced with ' + FOOD[alt].en.toLowerCase() + ' (' + chk.hard[0] + ').'); continue; }
    const share = toGrams(f, qty, unit) / mainsG;
    if (f.spice || f.cat === 'fat' || f.allium || share < 0.15) { notes.push('Made without ' + f.en.toLowerCase() + ' (' + chk.hard[0] + ').' + (f.allium ? ' A pinch of hing is the usual stand-in.' : '')); continue; }
    ok = false; notes.push(f.en + ' is central to this dish and ' + chk.hard[0] + '.');
  }
  if (P && items.some(i => (P.dislikes || []).includes(i.id) && !FOOD[i.id].spice)) { ok = false; notes.push('Contains something on your dislike list.'); }
  let staple = dish.staple;
  if (staple === 'roti' && !foodCheck(FOOD.wheat, P).ok) staple = 'rice';
  return { ok, items, notes, staple };
}

/* ---------- Suggested modifications ---------- */
function suggestMods(A, d, P) {
  const out = [], has = id => A.rows.some(r => r.f.id === id), row = id => A.rows.find(r => r.f.id === id);
  const can = id => foodCheck(FOOD[id], P).ok;
  const add = (change, why) => out.push({ change, why });
  if (d === 'p') {
    if (has('redchilipowder')) add('Use half the red chili powder and make up the flavour with ½ tsp extra coriander powder.', 'Chili is the strongest Pitta-raising item here; coriander is traditionally read as suiting Pitta.');
    else if (has('driedredchili') || has('greenchili')) add('Leave the chilies whole and lift them out before serving.', 'You keep the aroma with much less heat.');
    if (row('tomato') && row('tomato').share >= 0.15) add('Use half the tomato and finish with fresh coriander leaves.', 'Sourness is the second Pitta-raising quality in this dish.');
    if (has('amchur')) add('Reduce amchur to a pinch, or leave it out.', 'It adds sourness without bulk.');
    if (A.mainFat && A.mainFat.id !== 'ghee') add(can('ghee') ? 'Cook in ghee instead of ' + A.mainFat.en.toLowerCase() + '.' : 'Cook in coconut oil instead of ' + A.mainFat.en.toLowerCase() + '.', 'Both are classically read as cooling fats.');
    if (has('mustardseeds')) add('Swap mustard seeds for cumin in the tempering.', 'Cumin is milder.');
    if (!A.cools.includes('fennel seed') && can('fennel')) add('Add ½ tsp crushed fennel to the masala.', 'A small aromatic addition that modern authors read as cooling.');
    if (has('garlic')) add('Use one clove of garlic instead of several.', 'Garlic is classically Pitta-raising.');
  }
  if (d === 'v') {
    if (A.gasBase.length && A.digs.length < 3) add('Add a pinch of hing and ¼ tsp ajwain to the hot fat before anything else.', 'The traditional pairing for ' + A.gasBase.join(' and ') + '.');
    if (A.o.water === 'dry') add('Add ½ cup of water and simmer for five minutes so the dish is moist.', 'Dry preparations are read as Vata-raising.');
    if (A.fatLevel === 'none' || A.fatLevel === 'light') add(can('ghee') ? 'Finish with 1 tsp ghee per serving.' : 'Finish with 1 tsp sesame or neutral oil per serving.', 'Unctuousness is the classical counter to dryness.');
    if (A.heatClass === 'hot') add('Halve the chili.', 'Very pungent food is read as drying.');
    if (A.o.method === 'raw') add('Cook it, or at least warm it through.', 'Warm, cooked food is the standard Vata advice.');
    if (!has('ginger')) add('Add 1 tsp grated fresh ginger.', 'Warming and classically read as easing gas.');
    add('Serve it hot, freshly made.', 'Leftover and cold food is read as harder on Vata.');
  }
  if (d === 'k') {
    if (A.fatLevel === 'heavy' || A.o.method === 'fried') add('Cut the fat to 1 tsp per serving and dry-roast the spices first.', 'Heaviness and oiliness are the Kapha concerns here.');
    if (has('paneer')) add(can('tofu') ? 'Use half the paneer and more vegetables, or use tofu.' : 'Use half the paneer and more vegetables.', 'Paneer is the heaviest ingredient in the dish.');
    if (has('potato')) add('Replace half the potato with cauliflower or bottle gourd.', 'Lighter vegetables with the same cooking method.');
    if (A.heatClass === 'mild') add('Add ¼ tsp black pepper and 1 tsp grated ginger.', 'Pungent, light seasoning is the traditional counter to heaviness.');
    if (has('rice') || has('wheat')) add('Serve a smaller portion of rice or roti, or use barley or millet.', 'Barley and millets are classically read as lighter and drying.');
    if (has('yogurt') || has('greekyogurt')) add('Thin the yogurt into buttermilk with roasted cumin.', 'Buttermilk is classically read as light where yogurt is heavy.');
    if (A.o.portion === 'large') add('Take a regular portion.', 'Quantity is one of the eight classical factors of diet.');
  }
  return out.slice(0, 5);
}

/* ---------- Seasons ---------- */
function seasonFor(P, date) {
  if (P && P.season && P.season !== 'auto') return P.season;
  const m = (date || new Date()).getMonth(), region = (P && P.region) || 'india';
  if (region === 'india') return m >= 11 || m <= 1 ? 'winter' : m <= 3 ? 'spring' : m <= 5 ? 'summer' : m <= 8 ? 'rains' : 'autumn';
  let s = m >= 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  if (region === 'south') s = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[s];
  if (region === 'tropical') s = m >= 5 && m <= 9 ? 'rains' : 'summer';
  return s;
}

/* ---------- Journal-derived tolerance and correlations ---------- */
const SYMPTOMS = { bloat: 'bloating', burn: 'heartburn', heavy: 'heaviness', loose: 'loose stools', cramps: 'cramps' };
const mealKey = m => m.dishId || String(m.name || '').trim().toLowerCase();
function tolerance(meals, key) {
  const logs = meals.filter(m => mealKey(m) === key && m.after).slice(-6);
  const bad = logs.filter(m => (m.after.comfort && m.after.comfort <= 2) || (m.after.symptoms || []).length).length;
  return { n: logs.length, bad, demote: logs.length >= 3 && bad / logs.length >= 0.6 };
}
const MIN_N = 4;
function correlations(meals) {
  const withAfter = meals.filter(m => m.after);
  const groups = {};
  for (const m of withAfter) (groups[mealKey(m)] = groups[mealKey(m)] || []).push(m);
  const out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < MIN_N) continue;
    const recent = list.slice(-6);
    for (const s of Object.keys(SYMPTOMS)) {
      const k = recent.filter(m => (m.after.symptoms || []).includes(s)).length;
      if (k < 2 || k / recent.length < 0.5) continue;
      const others = withAfter.filter(m => mealKey(m) !== key);
      const ok = others.filter(m => (m.after.symptoms || []).includes(s)).length;
      out.push({ key, name: recent[recent.length - 1].name, symptom: SYMPTOMS[s], k, n: recent.length, total: list.length, otherK: ok, otherN: others.length });
    }
  }
  return { found: out, eligible: Object.values(groups).filter(l => l.length >= MIN_N).length, groups: Object.keys(groups).length };
}

/* ---------- Recommendations ---------- */
function recommendFoods(P, focus) {
  const res = { suggest: {}, moderate: [], check: [], neutral: {} };
  for (const f of FOODS) {
    const chk = foodCheck(f, P);
    if (!chk.ok || chk.soft.includes('on your dislike list')) continue;
    const flags = conditionFlags(f, P);
    if (flags.length) { res.check.push({ f, flags }); continue; }
    if (!focus) { (res.neutral[f.cat] = res.neutral[f.cat] || []).push(f); continue; }
    const e = f[focus.d], e2 = focus.d2 ? f[focus.d2] : null;
    if (e === '-' && e2 !== '+') (res.suggest[f.cat] = res.suggest[f.cat] || []).push(f);
    else if (e === '+') res.moderate.push(f);
  }
  return res;
}
function rankDishes(slot, P, focus, season, meals) {
  const out = [];
  for (const d of DISHES) {
    if (slot && !d.slots.includes(slot)) continue;
    const ad = adaptDish(d, P);
    if (!ad.ok) continue;
    const A = analyzeDish(ad.items, { method: d.method, water: d.water, serves: 2, slot });
    const stapleItems = ad.staple ? STAPLES[ad.staple].ing.map(([id, qty, unit]) => ({ id, qty, unit })) : [];
    const sn = dishNutrition(stapleItems, 1);
    const nut = A.nut.map((x, i) => x + sn[i]);
    const tol = tolerance(meals || [], d.id);
    const seasonLean = SEASONS[season] ? SEASONS[season].lean : null;
    let score = 0; const why = [];
    if (focus) { score += A.readings[focus.d].step * 2; why.push(A.readings[focus.d].label.toLowerCase() + ' for ' + DOSHA[focus.d]); if (focus.d2) score += A.readings[focus.d2].step; }
    if (seasonLean && A.readings[seasonLean].step > 0) { score += 0.5; }
    if (nut[1] >= 15) { score += 1; why.push(Math.round(nut[1]) + ' g protein'); }
    if (nut[4] >= 8) score += 0.5;
    if (tol.demote) { score -= 3; why.push('you logged discomfort after ' + tol.bad + ' of ' + tol.n + ' recent times'); }
    const flags = [...new Map(ad.items.flatMap(i => conditionFlags(FOOD[i.id], P).map(fl => [fl.c, fl]))).values()];
    if (flags.length) score -= 1;
    out.push({ dish: d, ad, A, nut, score, why, tol, flags });
  }
  return out.sort((a, b) => b.score - a.score || b.nut[1] - a.nut[1]);
}
const SLOTS = ['breakfast', 'lunch', 'dinner'];
function generatePlan(P, focus, season, meals, offset) {
  const ranked = {}; for (const s of SLOTS) ranked[s] = rankDishes(s, P, focus, season, meals).filter(r => !r.tol.demote);
  const days = [], recent = [];
  for (let i = 0; i < 7; i++) {
    const day = {};
    for (const s of SLOTS) {
      const pool = ranked[s]; if (!pool.length) { day[s] = null; continue; }
      const top = pool.slice(0, Math.max(3, Math.ceil(pool.length * 0.7)));
      let pick = null;
      for (let j = 0; j < top.length; j++) { const c = top[(i * 2 + j + (offset || 0) + (s === 'dinner' ? 1 : 0)) % top.length]; if (!recent.slice(-5).includes(c.dish.id) && !Object.values(day).includes(c.dish.id)) { pick = c; break; } }
      if (!pick) pick = top.find(c => !Object.values(day).includes(c.dish.id)) || top[0];
      day[s] = pick.dish.id; recent.push(pick.dish.id);
    }
    days.push(day);
  }
  return { days, made: todayStr(), focus: focus ? focus.d : null, season };
}
function planDayTotals(day, P) {
  const n = [0, 0, 0, 0, 0];
  for (const s of SLOTS) { const id = day[s]; if (!id || !DISH[id]) continue; const ad = adaptDish(DISH[id], P); const dn = dishNutrition(ad.items, 2); const sn = ad.staple ? dishNutrition(STAPLES[ad.staple].ing.map(([id, qty, unit]) => ({ id, qty, unit })), 1) : [0, 0, 0, 0, 0]; for (let i = 0; i < 5; i++) n[i] += dn[i] + sn[i]; }
  return n;
}
function groceryList(plan, P) {
  const tot = {};
  for (const day of plan.days) for (const s of SLOTS) {
    const id = day[s]; if (!id || !DISH[id]) continue;
    const ad = adaptDish(DISH[id], P);
    const all = ad.items.map(i => [i.id, toGrams(FOOD[i.id], i.qty, i.unit) / 2]).concat(ad.staple ? STAPLES[ad.staple].ing.map(([i, q, u]) => [i, toGrams(FOOD[i], q, u)]) : []);
    for (const [fid, g] of all) tot[fid] = (tot[fid] || 0) + g;
  }
  const byCat = {};
  for (const [fid, g] of Object.entries(tot)) { const f = FOOD[fid]; (byCat[f.cat] = byCat[f.cat] || []).push({ f, g }); }
  for (const c in byCat) byCat[c].sort((a, b) => b.g - a.g);
  return byCat;
}
function fmtGrocery(f, g) {
  if (f.spice && f.id !== 'garlic' && f.id !== 'ginger') { const t = g / (f.tsp || 2.5); return t < 0.3 ? 'a few pinches' : '≈ ' + fmtQty(Math.max(0.25, Math.round(t * 4) / 4)) + ' tsp'; }
  if (f.id === 'garlic') return '≈ ' + Math.ceil(g / 3) + ' cloves';
  if (f.id === 'eggs') return Math.ceil(g / 50) + ' eggs';
  if (g >= 1000) return '≈ ' + r1(g / 1000) + ' kg';
  return '≈ ' + Math.ceil(g / 10) * 10 + (f.id === 'milk' || f.id === 'buttermilk' ? ' ml' : ' g');
}
function blendSummary(items, fatId) {
  const rows = items.map(([id, qty, unit]) => ({ f: FOOD[id], g: toGrams(FOOD[id], qty, unit) }));
  const heat = sum(rows.map(r => r.g * (r.f.heatG || 0))) / 2;
  const heatClass = heat < 0.5 ? 'mild' : heat <= 1.3 ? 'medium' : 'hot';
  const read = {};
  for (const d of 'vpk') {
    const pac = rows.filter(r => r.f[d] === '-').length, agg = rows.filter(r => r.f[d] === '+').length;
    let step = pac > agg + 1 ? 1 : agg > pac ? -1 : agg === pac && agg > 0 ? 0 : pac > agg ? 1 : 0;
    if (d === 'p' && heatClass === 'hot') step = -1;
    if (d === 'p' && fatId && FOOD[fatId] && FOOD[fatId].hotOil) step = Math.min(step, 0) - (heatClass === 'mild' ? 0 : 1);
    if (d === 'k' && heatClass !== 'mild') step = Math.max(step, 1);
    read[d] = { step: clamp(step, -1, 1), pac, agg };
  }
  return { heat, heatClass, read };
}
if (typeof module !== 'undefined') module.exports = { scorePrakriti, scoreVikriti, parseRecipe, analyzeDish, adaptDish, rankDishes, generatePlan, groceryList, correlations, suggestMods, recommendFoods, blendSummary, foodCheck, currentFocus, planDayTotals, fmtItem };
