/* ============================================================
   Tridosha pages
   ============================================================ */
const PAGES = {};
const AGE = ['18–24', '25–34', '35–44', '45–54', '55–64', '65 or older'];
const CUISINES = ['North Indian', 'Punjabi', 'Gujarati', 'Maharashtrian', 'Bengali', 'South Indian', 'Other or mixed'];
const GOALS = ['Steadier digestion', 'Better sleep', 'Steadier energy', 'More regular meals', 'More plant protein', 'Cook at home more'];
const ACTIVITY = [['seated', 'Mostly seated'], ['light', 'Lightly active'], ['moderate', 'Moderately active'], ['very', 'Very active']];
const REGIONS = [['india', 'India and South Asia'], ['north', 'Northern temperate (Europe, North America, East Asia)'], ['south', 'Southern temperate (Australia, southern Africa, South America)'], ['tropical', 'Tropical']];
const CLIMATES = [['', 'Choose'], ['hot-dry', 'Hot and dry'], ['hot-humid', 'Hot and humid'], ['temperate', 'Temperate'], ['cold-dry', 'Cold and dry'], ['cold-damp', 'Cold and damp']];
const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const PERMS = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
const LV4 = [[0, 'None'], [1, 'Mild'], [2, 'Moderate'], [3, 'Strong']];
const LV5 = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
function defaultProfile() { return { done: false, age: '', diet: 'vegetarian', allergens: [], otherAllergy: '', exclusions: [], cuisines: [], activity: '', bed: '', wake: '', region: 'india', climate: '', season: 'auto', goals: [], dislikesText: '', dislikes: [], likesText: '', kcal: '', health: { consent: false, conditions: [], pregnancy: '', meds: '' } }; }
function pfDraft() { if (!ui.pf) ui.pf = clone(S.profile || defaultProfile()); ui.pf.health = Object.assign({ consent: false, conditions: [], pregnancy: '', meds: '' }, ui.pf.health); return ui.pf; }
function focusText() { const f = currentFocus(S); if (!f) return null; return { f, text: f.basis === 'vikriti' ? 'your ' + fmtDate(f.date) + ' Vikriti assessment, where most reported symptoms were ones traditionally associated with ' + DOSHA[f.d] + (f.d2 ? ' and ' + DOSHA[f.d2] : '') : 'your Prakriti answers, which leaned ' + DOSHA[f.d] + (f.d2 ? ' and ' + DOSHA[f.d2] : '') + ' (no Vikriti assessment with enough symptoms yet)' }; }

/* ---------- Profile form sections ---------- */
const PF_TITLES = ['About you', 'Food safety and preferences', 'Where you live and what you want', 'Health details (optional)'];
function pfSection(i) {
  const p = pfDraft();
  if (i === 0) return '<div class="grid2">' +
    '<label class="f" for="pf-age">Age range' + select('pf-age', 'pf', { k: 'age' }, [['', 'Choose']].concat(AGE.map(a => [a, a])), p.age) + '</label>' +
    '<div class="stack"><span class="f">Diet</span><div class="chips">' + Object.entries(DIETS).map(([k, l]) => chip('pf-set', { k: 'diet', v: k }, l, p.diet === k)).join('') + '</div></div></div>' +
    '<div class="stack"><span class="f">Cuisines you usually cook or eat</span><div class="chips">' + CUISINES.map(c => chip('pf-toggle', { k: 'cuisines', v: c }, c, p.cuisines.includes(c))).join('') + '</div></div>' +
    '<div class="stack"><span class="f">Activity level</span><div class="chips">' + ACTIVITY.map(([k, l]) => chip('pf-set', { k: 'activity', v: k }, l, p.activity === k)).join('') + '</div></div>' +
    '<div class="grid2"><label class="f" for="pf-bed">Usual bedtime<input type="time" id="pf-bed" data-chg="pf" data-k="bed" value="' + esc(p.bed) + '"></label><label class="f" for="pf-wake">Usual wake time<input type="time" id="pf-wake" data-chg="pf" data-k="wake" value="' + esc(p.wake) + '"></label></div>' +
    '<p class="small muted">Tridosha is written for adults. It is not designed for children or teenagers.</p>';
  if (i === 1) {
    const dl = parseRecipe(p.dislikesText || '').items.map(x => FOOD[x.id].en);
    return '<div class="stack"><span class="f">Allergies and intolerances the app should screen for</span><div class="chips">' + Object.entries(ALLERGENS).map(([k, l]) => chip('pf-toggle', { k: 'allergens', v: k }, l, p.allergens.includes(k))).join('') + '</div></div>' +
      '<label class="f" for="pf-other">Any other allergy<input type="text" id="pf-other" data-inp="pf" data-k="otherAllergy" value="' + esc(p.otherAllergy) + '" placeholder="For example peanuts, tree nuts, shellfish"></label>' +
      '<p class="small muted">The app can only screen for the seven allergens above. Anything you type in the box is shown back to you as a reminder but is not checked against recipes.</p>' +
      '<div class="stack"><span class="f">Religious or personal exclusions</span><div class="chips">' + Object.entries(EXCLUSIONS).map(([k, e]) => chip('pf-toggle', { k: 'exclusions', v: k }, e.label, p.exclusions.includes(k))).join('') + '</div></div>' +
      '<label class="f" for="pf-dislikes">Foods you dislike<input type="text" id="pf-dislikes" data-chg="pf" data-k="dislikesText" value="' + esc(p.dislikesText) + '" placeholder="For example okra, eggplant, mint"></label>' +
      (dl.length ? '<div class="chips">' + dl.map(n => '<span class="chip static">Will skip: ' + esc(n) + '</span>').join('') + '</div>' : '') +
      '<label class="f" for="pf-likes">Foods you especially like<input type="text" id="pf-likes" data-inp="pf" data-k="likesText" value="' + esc(p.likesText) + '" placeholder="For example paneer, moong dal, mango"></label>';
  }
  if (i === 2) return '<div class="grid2"><label class="f" for="pf-region">Region' + select('pf-region', 'pf', { k: 'region' }, REGIONS, p.region) + '</label>' +
    '<label class="f" for="pf-climate">Climate where you live' + select('pf-climate', 'pf', { k: 'climate' }, CLIMATES, p.climate) + '</label></div>' +
    '<label class="f" for="pf-season">Season right now' + select('pf-season', 'pf', { k: 'season' }, [['auto', 'Work it out from my region and the date (' + SEASONS[seasonFor(Object.assign({}, p, { season: 'auto' }))].label.toLowerCase() + ')']].concat(Object.entries(SEASONS).map(([k, s]) => [k, s.label])), p.season) + '</label>' +
    '<div class="stack"><span class="f">What you want from this</span><div class="chips">' + GOALS.map(g => chip('pf-toggle', { k: 'goals', v: g }, g, p.goals.includes(g))).join('') + '</div></div>' +
    '<label class="f" for="pf-kcal" style="max-width:16rem">Daily calorie target, if you already have one<input type="number" id="pf-kcal" inputmode="numeric" min="0" step="50" data-inp="pf" data-k="kcal" value="' + esc(p.kcal) + '" placeholder="Leave empty to skip"></label>';
  const h = p.health;
  return '<div class="note calm">Everything in this section is optional. It is used for one thing: to stop the app suggesting foods or spice amounts that are commonly cautioned for your situation. It is never used to diagnose anything.</div>' +
    '<label class="row" for="pf-consent" style="font-weight:600"><input type="checkbox" id="pf-consent" data-chg="pf-consent"' + (h.consent ? ' checked' : '') + '> I choose to share health details for safety screening</label>' +
    (h.consent ? '<div class="stack"><span class="f">Conditions</span><div class="chips">' + Object.entries(CONDITIONS).filter(([k]) => k !== 'pregnant').map(([k, c]) => chip('pf-cond', { v: k }, c.label, h.conditions.includes(k))).join('') + '</div></div>' +
      '<label class="f" for="pf-preg" style="max-width:20rem">Pregnancy status' + select('pf-preg', 'pf-health', { k: 'pregnancy' }, [['', 'Not applicable or prefer not to say'], ['pregnant', 'Pregnant'], ['breastfeeding', 'Breastfeeding']], h.pregnancy) + '</label>' +
      '<label class="f" for="pf-meds">Medicines the app should remind you about<input type="text" id="pf-meds" data-inp="pf-health" data-k="meds" value="' + esc(h.meds) + '" placeholder="Shown back to you on the meal ideas page; not interpreted"></label>' +
      '<p class="small muted">Turning this off later removes these details from your saved profile.</p>' : '<p class="small muted">Left off, the app screens for allergies and diet only.</p>');
}

/* ---------- Welcome and onboarding ---------- */
function nextSteps() {
  return [
    { done: !!(S.profile && S.profile.done), label: 'Set up your profile', sub: 'Diet, allergies, cuisine and climate. About two minutes.', r: 'home', act: 'ob-go' },
    { done: !!S.prakriti, label: 'Answer the Prakriti questionnaire', sub: PQ.length + ' questions about lifelong traits.', r: 'prakriti' },
    { done: S.vikriti.length > 0, label: 'Take the Vikriti assessment', sub: VQ.length + ' questions about the last seven days.', r: 'vikriti' },
    { done: !!S.checkins[todayStr()], label: 'Do today\'s check-in', sub: 'Eight quick answers.', r: 'checkin' },
    { done: S.meals.length > 0, label: 'Analyze and log a meal', sub: 'Type a dish in plain words; the app finds the ingredients.', r: 'analyzer' }
  ];
}
PAGES.home = () => {
  const steps = nextSteps(), next = steps.find(s => !s.done), done = S.profile && S.profile.done;
  let h = '<section class="hero"><div class="stack" style="gap:16px"><span class="pagehead"><span class="eyebrow">Personalized Ayurvedic wellness</span></span><h1>Your constitution is one reading. How you are this week is another.</h1>' +
    '<p class="lead">Tridosha keeps the two apart. It records your baseline (Prakriti), tracks your current state (Vikriti), and turns both into food, spice and recipe suggestions that respect your diet and allergies.</p>' +
    '<div class="row">' + (next ? (next.act ? '<button class="btn primary" data-act="' + next.act + '">' + next.label + '</button>' : '<a class="btn primary" href="#' + next.r + '">' + next.label + '</a>') : '<a class="btn primary" href="#dashboard">Open your dashboard</a>') +
    (!hasData(S) && !store.sample ? '<button class="btn" data-act="sample-load">Explore with sample data</button>' : '') + '</div></div>' +
    '<div class="panel"><header><h3>Getting started</h3><span class="small muted num">' + steps.filter(s => s.done).length + ' of ' + steps.length + ' done</span></header><div>' +
    steps.map(s => '<div class="todo' + (s.done ? ' done' : '') + '"><span class="tick" aria-hidden="true">' + (s.done ? '✓' : '') + '</span><div><b>' + s.label + '</b><div class="small muted">' + s.sub + '</div></div>' + (s.act ? '<button class="btn sm' + (s.done ? ' quiet' : '') + '" data-act="' + s.act + '">' + (s.done ? 'Edit' : 'Start') + '</button>' : '<a class="btn sm' + (s.done ? ' quiet' : '') + '" href="#' + s.r + '">' + (s.done ? 'Open' : 'Start') + '</a>') + '</div>').join('') + '</div></div></section>';
  h += '<section class="duo" aria-label="Prakriti and Vikriti"><div><h4>Prakriti · baseline</h4><h2>The pattern you have had all your life</h2><p class="muted">Build, skin, appetite, sleep, the way you learn and react. Ayurveda treats this mix of Vata, Pitta and Kapha as individual and fairly stable. Yours is not expected to be an even three-way split, and it is not a target to move toward.</p><p class="small"><span class="tag">Measured here by</span> a ' + PQ.length + '-question survey of long-standing traits</p></div>' +
    '<div><h4>Vikriti · current state</h4><h2>What has shifted lately</h2><p class="muted">Ayurvedic theory describes the current state as moving with food, sleep, stress, activity, climate and season. It is assessed from recent symptoms and tracked over time against your own history.</p><p class="small"><span class="tag">Measured here by</span> a weekly symptom assessment and a daily check-in, on a separate scale</p></div></section>';
  if (!done || ui.obOpen) {
    const i = ui.obStep;
    h += '<section class="panel" id="onboard"><header><div><h4>Profile · step ' + (i + 1) + ' of 4</h4><h2>' + PF_TITLES[i] + '</h2></div><div style="flex:1 1 140px;max-width:220px"><div class="progress"><i style="width:' + ((i + 1) * 25) + '%"></i></div></div></header>' + pfSection(i) +
      '<div class="row between"><button class="btn" data-act="ob-back"' + (i === 0 ? ' disabled' : '') + '>Back</button>' + (i < 3 ? '<button class="btn primary" data-act="ob-next">Next</button>' : '<button class="btn primary" data-act="pf-save" data-then="prakriti">Save profile and continue</button>') + '</div></section>';
  }
  h += '<section class="grid3">' + [
    ['foods', 'Food explorer', FOODS.length + ' foods and spices with taste, qualities, potency, dosha associations, nutrition and a source for each classification.'],
    ['analyzer', 'Recipe analyzer', 'Type "aloo tamatar with jeera and lal mirch". It finds the ingredients, reads the dish as a whole and suggests small changes.'],
    ['spices', 'Spice comparison', 'Black pepper against red chili powder, cumin against mustard seeds, a mild tadka against a spicy one.'],
    ['meals', 'Meal ideas', 'Foods, swaps, spice blends and dishes ranked for your current pattern, after your diet and allergies are applied.'],
    ['journal', 'Journal and trends', 'Log meals and how you felt. Patterns are shown only when there are enough entries, with the count beside them.'],
    ['sources', 'Sources and method', 'Every scoring rule is written out. Classical teaching, modern interpretation and scientific evidence are kept separate.']
  ].map(([r, t, d]) => '<a class="panel" href="#' + r + '" style="text-decoration:none;color:inherit"><h3>' + t + '</h3><p class="small muted">' + d + '</p></a>').join('') + '</section>';
  h += '<section class="panel"><h3>What Tridosha is not</h3><div class="grid2"><ul class="small prose"><li>Doshas are traditional Ayurvedic concepts. They are not clinically validated biological quantities, and nothing here measures them in your body.</li><li>A score such as "42% Vata" means 42% of your answers matched the traditional Vata descriptions. It is an exploratory indicator, not a diagnosis.</li></ul><ul class="small prose"><li>No food here is called harmful because of its Ayurvedic classification. Allergies, diet and medical cautions always come before dosha considerations.</li><li>Symptoms that persist, worsen or worry you belong with a clinician. The app says so when your entries suggest it.</li></ul></div></section>';
  if (hasData(S) && !store.sample) h += '<p class="small muted">Want to see a filled-in example? <button class="btn sm quiet" data-act="sample-load">View sample data</button> Your own entries are kept and come back when you leave sample mode.</p>';
  return h;
};

/* ---------- Prakriti ---------- */
function pqDraft() { if (!ui.pq) ui.pq = S.prakriti ? { mode: 'result', i: 0, answers: clone(S.prakriti.answers) } : { mode: 'intro', i: 0, answers: {} }; return ui.pq; }
function prakritiResult(R, compact) {
  const order = ['v', 'p', 'k'];
  return '<div class="' + (compact ? 'stack' : 'grid2') + '" style="align-items:' + (compact ? 'stretch' : 'center') + '"><div>' + triangle(R.share) + '</div><div class="stack">' + order.map(d => meter('<span class="d' + d + '" style="font-weight:700">' + DOSHA[d] + '</span>', R.share[d] * 100, 'bg-' + d, Math.round(R.share[d] * 100) + '%')).join('') +
    '<p class="small muted">Share of your answered questions that matched each traditional description. These are not amounts of anything in the body.</p>' + (compact ? '' : '<p>' + R.desc + '</p>') + '</div></div>';
}
PAGES.prakriti = () => {
  const q = pqDraft();
  let h = pagehead('Prakriti · baseline constitution', 'Your lifelong pattern', 'Questions about traits that have been true for most of your adult life. Answer for the long run, not for this month.');
  if (q.mode === 'intro') {
    return h + '<section class="panel"><h2>Before you start</h2><ul class="prose"><li>' + PQ.length + ' questions in ' + Object.keys(PCATS).length + ' areas, about ten minutes.</li><li>Each question has three descriptions. Pick the one closest to you over the years. If none fits, choose "Not sure" and the question is left out of the score.</li><li>The order of the three descriptions changes from question to question, so there is no pattern to follow.</li><li>You can go back, review every answer before scoring, and revise later.</li></ul>' +
      '<div class="note">This questionnaire was written for this app from the trait domains in Charaka Samhita, Vimanasthana 8. It has not been tested for reliability or validity, and it is not one of the published instruments. Treat the result as a structured self-description. ' + srcTags(['CS-VI8', 'SS-SH4', 'AH-SH3', 'R-KURANDE13']) + '</div>' +
      '<div class="row"><button class="btn primary" data-act="pq-start">Start the questionnaire</button></div></section>';
  }
  if (q.mode === 'quiz') {
    const qu = PQ[q.i], perm = PERMS[(q.i * 5 + 2) % 6], a = q.answers[qu.id], n = Object.keys(q.answers).length;
    return h + '<section class="panel"><header><h4>Question ' + (q.i + 1) + ' of ' + PQ.length + ' · ' + PCATS[qu.cat][0] + '</h4><span class="small muted num">' + n + ' answered</span></header><div class="progress"><i style="width:' + Math.round((q.i + 1) / PQ.length * 100) + '%"></i></div>' +
      '<h2 id="pq-q">' + esc(qu.text) + '</h2><div class="stack" role="group" aria-labelledby="pq-q">' + perm.map(oi => '<button type="button" class="opt" data-act="pq-pick" data-v="' + oi + '" aria-pressed="' + (a === oi) + '"><span class="mark"></span><span>' + esc(qu.opts[oi].t) + '</span></button>').join('') +
      '<div class="row"><button type="button" class="opt alt" style="width:auto" data-act="pq-pick" data-v="ns" aria-pressed="' + (a === 'ns') + '">Not sure</button>' + (qu.na ? '<button type="button" class="opt alt" style="width:auto" data-act="pq-pick" data-v="na" aria-pressed="' + (a === 'na') + '">Does not apply to me</button>' : '') + '</div></div>' +
      '<details><summary>Why this is asked</summary><p class="small muted">' + esc(qu.why || PCATS[qu.cat][1]) + '</p></details>' +
      '<div class="row between"><button class="btn" data-act="pq-back"' + (q.i === 0 ? ' disabled' : '') + '>Back</button><div class="row"><button class="btn quiet" data-act="pq-review">Review answers</button><button class="btn" data-act="pq-fwd">' + (q.i === PQ.length - 1 ? 'Finish' : 'Next') + '</button></div></div></section>';
  }
  if (q.mode === 'review') {
    const n = PQ.filter(x => typeof q.answers[x.id] === 'number').length, need = Math.ceil(PQ.length * 2 / 3);
    let list = '';
    for (const [ck, [cn]] of Object.entries(PCATS)) {
      list += '<h4 style="margin-top:8px">' + cn + '</h4>' + PQ.map((x, i) => x.cat !== ck ? '' : '<div class="todo" style="padding:8px 0"><span class="small muted num">' + (i + 1) + '</span><div><div class="small muted">' + esc(x.text) + '</div><div>' + (typeof q.answers[x.id] === 'number' ? esc(x.opts[q.answers[x.id]].t) : '<span class="muted">' + (q.answers[x.id] === 'na' ? 'Does not apply' : q.answers[x.id] === 'ns' ? 'Not sure' : 'Not answered') + '</span>') + '</div></div><button class="btn sm quiet" data-act="pq-jump" data-i="' + i + '">Change</button></div>').join('');
    }
    return h + '<section class="panel"><header><h2>Review your answers</h2><span class="small muted num">' + n + ' of ' + PQ.length + ' answered</span></header>' + (n < need ? '<div class="note">Answer at least ' + need + ' questions to get a score. You have ' + n + '.</div>' : '') +
      '<div class="row"><button class="btn primary" data-act="pq-score"' + (n < need ? ' disabled' : '') + '>Score my answers</button>' + (S.prakriti ? '<button class="btn" data-act="pq-cancel">Discard changes</button>' : '') + '</div><div>' + list + '</div></section>';
  }
  const P = S.prakriti, R = P.result;
  h += '<section class="panel"><header><div><h4>Baseline profile · ' + fmtDate(P.date) + '</h4><h2>' + R.label + '</h2></div><span class="tag prov">Exploratory questionnaire score</span></header>' + prakritiResult(R) +
    '<dl class="kv"><dt>Questions answered</dt><dd class="num">' + R.answered + ' of ' + R.total + (R.coverage < 0.8 ? ' — answering more would make the picture steadier' : '') + '</dd><dt>Lead over second</dt><dd class="num">' + Math.round(R.margin * 100) + ' percentage points</dd><dt>How steady this label is</dt><dd>' + R.stability + '. ' + (R.stability === 'Higher' ? 'Most questions were answered and one description is clearly ahead, so changing a few answers would probably not change the label.' : R.stability === 'Moderate' ? 'Changing a handful of answers could change the label.' : 'The lead is small or many questions were skipped. Read the label loosely.') + ' This is a description of the arithmetic, not a statistical confidence level.</dd><dt>Versions</dt><dd class="num small">Questionnaire ' + esc(P.qv) + ', scoring ' + esc(P.sv) + '</dd></dl>' +
    '<div class="row"><button class="btn" data-act="pq-review">Review or revise answers</button><button class="btn quiet" data-act="pq-restart">Retake from the start</button><a class="btn primary" href="#' + (S.vikriti.length ? 'dashboard' : 'vikriti') + '">' + (S.vikriti.length ? 'Open dashboard' : 'Continue to Vikriti') + '</a></div></section>';
  h += '<section class="grid2"><div class="panel"><h3>How to read this</h3><ul class="small prose"><li>This is your baseline. Ayurveda does not treat an even three-way split as the ideal, and the app never asks you to move toward one.</li><li>The label describes which traditional portrait your answers resembled. It says nothing certain about health, personality or disease risk.</li><li>Self-report is imperfect: published reviews find that even trained assessors often disagree on Prakriti. ' + srcTags(['R-KURANDE13']) + '</li><li>Studies linking Prakriti groups to genetic or microbiome differences are observational and used clinician assessment, not a survey like this one. ' + srcTags(['R-PRASHER08', 'R-GOVIND15', 'R-CHAUHAN18']) + '</li></ul></div>' +
    '<div class="panel"><h3>Where your answers leaned, by area</h3><div class="tablewrap"><table><thead><tr><th>Area</th><th class="n">Answered</th><th class="n">V</th><th class="n">P</th><th class="n">K</th></tr></thead><tbody>' + Object.entries(PCATS).map(([ck, [cn]]) => { const c = R.byCat[ck] || { v: 0, p: 0, k: 0, n: 0 }; const tot = PQ.filter(x => x.cat === ck).length; return '<tr><td>' + cn + '</td><td class="n">' + c.n + '/' + tot + '</td><td class="n dv">' + c.v + '</td><td class="n dp">' + c.p + '</td><td class="n dk">' + c.k + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>';
  h += '<section class="panel"><details><summary>How the score is calculated</summary><div class="prose small"><p>Each of the three descriptions in a question belongs to one dosha and counts as one point for it. "Not sure" and "Does not apply" count for nothing and remove the question from the total. Every question has the same weight, because no weighting scheme for this questionnaire has been validated.</p><p>The share for a dosha is its points divided by all points. The label follows fixed rules: <b>mixed</b> when the highest and lowest shares are less than 10 points apart; <b>dominant</b> when one share is at least 50% and at least 15 points ahead of the next; <b>dual</b> when the top two are within 15 points and the third is under 25%; otherwise <b>leaning</b>.</p><p>Your answers, the questionnaire version, the scoring version and the completion date are saved together, so a result can always be traced to what produced it.</p></div></details></section>';
  return h;
};

/* ---------- Vikriti ---------- */
function vkDraft() { if (!ui.vk) ui.vk = { mode: S.vikriti.length ? 'result' : 'form', ans: {}, view: S.vikriti.length - 1 }; return ui.vk; }
const assocText = a => !a ? 'No single traditional association; tracked on its own' : 'Traditionally associated with ' + Object.keys(a).map(d => DOSHA[d]).join(' and ');
function loadsBlock(loads) { return ['v', 'p', 'k'].map(d => meter('<span class="d' + d + '" style="font-weight:700">' + DOSHA[d] + '</span>', loads[d], 'bg-' + d, loads[d])).join('') + '<p class="small muted">Recent symptom load, 0 to 100, for the symptoms traditionally associated with each dosha. Each bar stands alone; they are not parts of a whole and are not compared arithmetically with Prakriti.</p>'; }
PAGES.vikriti = () => {
  const v = vkDraft();
  let h = pagehead('Vikriti · current state', 'How the last seven days have been', 'A separate assessment of recent, changeable symptoms. Repeat it weekly to see what is becoming more or less frequent for you.');
  if (v.mode === 'form') {
    h += '<section class="panel"><header><h2>In the last 7 days, how often did you notice…</h2><span class="small muted num">' + VQ.length + ' items</span></header><div>' + VQ.map(q => {
      const a = v.ans[q.id] || { f: 0 };
      return '<div class="stack" style="padding:13px 0;border-bottom:1px solid var(--line)"><b id="vk-l-' + q.id + '">' + esc(q.text) + '</b>' + seg('vk-f', { id: q.id }, FREQ.map((l, i) => [i, l]), a.f, q.text) +
        (a.f > 0 ? '<div class="row"><span class="small muted">How strong?</span>' + seg('vk-s', { id: q.id }, [[1, 'Mild'], [2, 'Moderate'], [3, 'Strong']], a.s || 1, 'Severity') + '<label class="row small muted" for="vk-d-' + q.id + '">Going on for ' + '<span style="min-width:9.5rem">' + select('vk-d-' + q.id, 'vk-d', { id: q.id }, DUR.map((l, i) => [i, l]), a.d || 0) + '</span></label></div>' : '') + '</div>';
    }).join('') + '</div><div class="row"><button class="btn primary" data-act="vk-save">Save this assessment</button>' + (S.vikriti.length ? '<button class="btn" data-act="vk-cancel">Cancel</button>' : '') + '</div></section>';
    return h;
  }
  const E = S.vikriti[clamp(v.view, 0, S.vikriti.length - 1)], R = scoreVikriti(E.ans), prev = S.vikriti[S.vikriti.indexOf(E) - 1];
  h += '<section class="panel"><header><div><h4>Assessment of ' + fmtDay(E.date) + '</h4><h2>' + (R.active.length ? R.active.length + ' symptom' + (R.active.length > 1 ? 's' : '') + ' reported' : 'No symptoms reported') + '</h2></div><span class="tag prov">Exploratory symptom index</span></header>' +
    '<div class="grid2"><div class="stack">' + loadsBlock(R.loads) + '</div><div class="stack">' + (R.active.length ? '<h4>What you reported</h4>' + R.active.map(s => { const pf = prev && prev.ans[s.id] ? prev.ans[s.id].f : 0; const delta = prev ? (s.f > pf ? ' · more often than on ' + fmtDate(prev.date) : s.f < pf ? ' · less often than on ' + fmtDate(prev.date) : ' · same as ' + fmtDate(prev.date)) : ''; return '<div><b>' + esc(s.text) + '</b><div class="small muted">' + FREQ[s.f] + ', ' + SEV[s.s].toLowerCase() + ', ' + DUR[s.d].toLowerCase() + delta + '</div><div class="tiny muted">' + assocText(s.assoc) + '</div></div>'; }).join('') : '<p class="muted">Nothing to list this week.</p>') +
    (prev ? (() => { const gone = Object.keys(prev.ans).filter(id => prev.ans[id].f > 0 && !(E.ans[id] && E.ans[id].f > 0)); return gone.length ? '<p class="small muted">No longer reported since ' + fmtDate(prev.date) + ': ' + gone.map(id => VQ_BY[id].text.toLowerCase()).join('; ') + '.</p>' : ''; })() : '') + '</div></div>' +
    (R.flags.length ? '<div class="note alert"><b>Worth raising with a doctor.</b> ' + R.flags.map(f => esc(f.text) + ' (' + f.why + ')').join('; ') + '. A food tracker is the wrong tool for symptoms that last or are severe.</div>' : '') +
    '<details><summary>Symptoms that need prompt medical attention</summary><ul class="small">' + RED_FLAGS.map(x => '<li>' + x + '</li>').join('') + '</ul><p class="small muted">If any of these apply, see a doctor now, whatever this app shows.</p></details>' +
    '<div class="row"><button class="btn primary" data-act="vk-new">' + (E.date === todayStr() ? 'Redo today\'s assessment' : 'Start a new assessment') + '</button><a class="btn" href="#dashboard">Compare with Prakriti</a></div></section>';
  h += '<section class="panel"><h3>How to read this</h3><ul class="small prose"><li>A symptom being "traditionally associated with Vata" is a statement about Ayurvedic texts. It is not a finding that you have a Vata imbalance, and it is not a medical explanation of the symptom.</li><li>Bloating, heartburn, poor sleep and the rest have ordinary clinical causes that this app cannot assess.</li><li>The useful comparison is with your own earlier assessments: is something becoming more or less frequent?</li></ul></section>';
  if (S.vikriti.length > 1) h += '<section class="panel"><h3>Earlier assessments</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th class="n">Vata load</th><th class="n">Pitta load</th><th class="n">Kapha load</th><th></th></tr></thead><tbody>' + S.vikriti.map((e, i) => '<tr><td>' + fmtDay(e.date) + '</td><td class="n">' + e.loads.v + '</td><td class="n">' + e.loads.p + '</td><td class="n">' + e.loads.k + '</td><td><button class="btn sm quiet" data-act="vk-view" data-i="' + i + '">View</button><button class="btn sm quiet" data-act="vk-del" data-i="' + i + '">Delete</button></td></tr>').reverse().join('') + '</tbody></table></div></section>';
  h += '<section class="panel"><details><summary>How the index is calculated</summary><div class="prose small"><p>For each symptom, frequency (0 to 4) is divided by 4 and severity (1 to 3) by 3, and the two are multiplied. A symptom present every day and strong scores 1; one present on one or two days and mild scores about 0.08.</p><p>A dosha\'s load is the weighted average of those scores over the symptoms traditionally associated with it, times 100. Feeling too cold counts half toward Vata and half toward Kapha. Stress is recorded but not assigned to any dosha.</p><p>Duration does not change the load. It decides whether the app suggests seeing a doctor. Version ' + VERSIONS.vikritiScore + '.</p></div></details></section>';
  return h;
};

/* ---------- Dashboard ---------- */
PAGES.dashboard = () => {
  let h = pagehead('Dashboard', 'Baseline and current state, side by side', 'Two panels on two different scales. They are read together in words, never subtracted from each other.');
  const P = S.prakriti, V = S.vikriti[S.vikriti.length - 1];
  if (!P && !V) return h + empty('Nothing to show yet. The dashboard fills in once you have answered the Prakriti questionnaire or a Vikriti assessment.', '<div class="row"><a class="btn primary" href="#prakriti">Start with Prakriti</a><button class="btn" data-act="sample-load">Explore with sample data</button></div>');
  h += '<section class="grid2">';
  h += '<div class="panel"><header><div><h4>Panel A · Prakriti (baseline)</h4><h2>' + (P ? P.result.label : 'Not assessed yet') + '</h2></div>' + (P ? '<span class="tag prov">Share of answers</span>' : '') + '</header>' + (P ? prakritiResult(P.result, true) + '<dl class="kv small"><dt>Primary type</dt><dd>' + P.result.label + '</dd><dt>Answered</dt><dd class="num">' + P.result.answered + ' of ' + P.result.total + ' questions</dd><dt>Steadiness</dt><dd>' + P.result.stability + '</dd><dt>Limitations</dt><dd>Self-reported, unvalidated questionnaire. <a href="#prakriti">Details</a></dd></dl>' : empty('Answer ' + PQ.length + ' questions about lifelong traits to fill this panel.', '<a class="btn primary" href="#prakriti">Start Prakriti</a>')) + '</div>';
  h += '<div class="panel"><header><div><h4>Panel B · Vikriti (current pattern)</h4><h2>' + (V ? 'Week to ' + fmtDate(V.date) : 'Not assessed yet') + '</h2></div>' + (V ? '<span class="tag prov">Symptom load 0–100</span>' : '') + '</header>';
  if (V) {
    const R = scoreVikriti(V.ans), prev = S.vikriti[S.vikriti.length - 2];
    h += '<div class="stack">' + loadsBlock(R.loads) + '</div>';
    if (R.active.length) h += '<div class="tablewrap"><table><thead><tr><th>Symptom</th><th>This week</th>' + (prev ? '<th>' + fmtDate(prev.date) + '</th>' : '') + '<th>Traditional association</th></tr></thead><tbody>' + R.active.slice(0, 7).map(s => '<tr><td>' + esc(s.text) + '</td><td>' + FREQ[s.f] + '</td>' + (prev ? '<td class="muted">' + FREQ[(prev.ans[s.id] || { f: 0 }).f] + '</td>' : '') + '<td class="small">' + (s.assoc ? Object.keys(s.assoc).map(d => '<span class="d' + d + '">' + DOSHA[d] + '</span>').join(', ') : '<span class="muted">none</span>') + '</td></tr>').join('') + '</tbody></table></div>';
    else h += '<p class="muted">No symptoms reported in the latest assessment.</p>';
    if (R.flags.length) h += '<div class="note alert small"><b>Worth raising with a doctor:</b> ' + R.flags.map(f => esc(f.text.toLowerCase()) + ' (' + f.why + ')').join('; ') + '.</div>';
  } else h += empty('A ' + VQ.length + '-item check of the last seven days fills this panel.', '<a class="btn primary" href="#vikriti">Start Vikriti</a>');
  h += '</div></section>';
  // reading together
  if (P && V) {
    const f = vikritiFocus(V.loads), lead = P.result.lead;
    let txt;
    if (!f) txt = 'You reported few symptoms this week, so nothing points toward a particular traditional pattern. Your baseline answers leaned ' + DOSHA[lead] + '.';
    else if (f.d === lead) txt = 'Most of this week\'s symptoms are ones the tradition associates with ' + DOSHA[f.d] + ', which is also the description your baseline answers matched most. Ayurvedic texts hold that a person\'s dominant dosha is the one most easily increased, so a traditional reading would not find this surprising.';
    else txt = 'Most of this week\'s symptoms are ones the tradition associates with ' + DOSHA[f.d] + (f.d2 ? ' and ' + DOSHA[f.d2] : '') + ', while your baseline answers leaned ' + DOSHA[lead] + '. A traditional reading would look to recent influences (food, sleep, season, stress) more than to constitution.';
    h += '<section class="panel"><h3>Reading the two together</h3><p style="max-width:44rem">' + txt + '</p><p class="small muted" style="max-width:44rem">Panel A counts matching answers about lifelong traits. Panel B measures how often and how strongly recent symptoms occurred. Because the scales differ, the app does not compute an "imbalance percentage" from them. Meal ideas follow Panel B when it has enough to go on, and Panel A otherwise.</p><div class="row"><a class="btn primary" href="#meals">See meal ideas for this pattern</a><a class="btn" href="#trends">Open trends</a></div></section>';
  }
  if (S.vikriti.length >= 2) {
    const dates = S.vikriti.map(e => e.date);
    h += '<section class="panel"><header><h3>Symptom load across your assessments</h3><span class="small muted num">' + S.vikriti.length + ' assessments</span></header>' + lineChart(['v', 'p', 'k'].map(d => ({ name: DOSHA[d] + '-associated symptoms', color: 'var(--' + { v: 'vata', p: 'pitta', k: 'kapha' }[d] + ')', pts: S.vikriti.map(e => [e.date, e.loads[d]]) })), dates, { min: 0, max: Math.max(40, Math.ceil(Math.max(...S.vikriti.flatMap(e => Object.values(e.loads))) / 20) * 20), ticks: 4, label: 'Symptom load by assessment date' }) + '</section>';
  } else if (V) h += '<section class="panel flat"><p class="muted small">A trend line appears here after your second weekly assessment. You have one so far.</p></section>';
  // observations from check-ins
  const last7 = dateRange(7).map(d => S.checkins[d]).filter(Boolean);
  if (last7.length) {
    const a = k => avg(last7.map(c => c[k]).filter(x => x != null && x !== ''));
    const cnt = k => last7.filter(c => c[k] > 0).length;
    h += '<section class="panel"><header><h3>Food, sleep and lifestyle, last 7 days</h3><span class="small muted num">' + last7.length + ' of 7 days checked in</span></header><div class="grid3"><dl class="kv small"><dt>Sleep</dt><dd class="num">' + (a('sleepH') != null ? r1(a('sleepH')) + ' h average' : 'no entries') + '</dd><dt>Sleep quality</dt><dd class="num">' + (a('sleepQ') != null ? r1(a('sleepQ')) + ' of 5' : '—') + '</dd></dl><dl class="kv small"><dt>Stress</dt><dd class="num">' + (a('stress') != null ? r1(a('stress')) + ' of 5' : '—') + '</dd><dt>Energy</dt><dd class="num">' + (a('energy') != null ? r1(a('energy')) + ' of 5' : '—') + '</dd></dl><dl class="kv small"><dt>Days with bloating</dt><dd class="num">' + cnt('bloat') + ' of ' + last7.length + '</dd><dt>Days with heartburn</dt><dd class="num">' + cnt('burn') + ' of ' + last7.length + '</dd></dl></div><p class="small muted">Meals logged this week: ' + S.meals.filter(m => m.date >= addDays(todayStr(), -6)).length + '. Averages over fewer than four days are rough.</p></section>';
  }
  return h;
};

/* ---------- Daily check-in ---------- */
function ciDraft() { if (!ui.ci) { const d = todayStr(); ui.ci = Object.assign({ date: d }, clone(S.checkins[d] || { bloat: 0, burn: 0, heavy: 0, bowel: '', energy: 0, sleepQ: 0, sleepH: '', stress: 0, feel: [], activity: '', note: '' })); } return ui.ci; }
PAGES.checkin = () => {
  const c = ciDraft(), exists = !!S.checkins[c.date];
  const row = (label, body) => '<div class="stack" style="padding:12px 0;border-bottom:1px solid var(--line)"><b>' + label + '</b>' + body + '</div>';
  let h = pagehead('Daily check-in', 'How was today?', 'Eight quick answers. They feed the trends page and the dashboard\'s weekly observations.');
  h += '<section class="panel"><header><label class="f" for="ci-date" style="max-width:12rem">Day<input type="date" id="ci-date" max="' + todayStr() + '" data-chg="ci-date" value="' + c.date + '"></label>' + (exists ? '<span class="tag">Already saved for this day; saving again replaces it</span>' : '') + '</header><div>' +
    row('1. Bloating or gas', seg('ci', { k: 'bloat' }, LV4, c.bloat, 'Bloating')) + row('2. Burning or heartburn', seg('ci', { k: 'burn' }, LV4, c.burn, 'Heartburn')) + row('3. Heaviness after meals', seg('ci', { k: 'heavy' }, LV4, c.heavy, 'Heaviness')) +
    row('4. Bowel movement', seg('ci', { k: 'bowel' }, [['c', 'Hard or none'], ['n', 'Comfortable'], ['l', 'Loose']], c.bowel, 'Bowel')) +
    row('5. Energy <span class="small muted" style="font-weight:400">1 low, 5 high</span>', seg('ci', { k: 'energy' }, LV5, c.energy, 'Energy')) +
    row('6. Last night\'s sleep <span class="small muted" style="font-weight:400">1 poor, 5 excellent</span>', '<div class="row">' + seg('ci', { k: 'sleepQ' }, LV5, c.sleepQ, 'Sleep quality') + '<label class="row small muted" for="ci-sleeph">Hours <input type="number" id="ci-sleeph" min="0" max="16" step="0.5" inputmode="decimal" style="width:5.5rem" data-inp="ci" data-k="sleepH" value="' + esc(c.sleepH) + '"></label></div>') +
    row('7. Stress <span class="small muted" style="font-weight:400">1 calm, 5 very stressed</span>', seg('ci', { k: 'stress' }, LV5, c.stress, 'Stress')) +
    row('8. Anything else today?', '<div class="chips">' + [['restless', 'Restless'], ['irritable', 'Irritable'], ['sluggish', 'Sluggish'], ['dry', 'Dry skin or mouth'], ['hot', 'Felt too hot'], ['cold', 'Felt too cold']].map(([k, l]) => chip('ci-feel', { v: k }, l, c.feel.includes(k))).join('') + '</div>') +
    row('Activity <span class="small muted" style="font-weight:400">optional</span>', seg('ci', { k: 'activity' }, [['none', 'None'], ['light', 'Light'], ['moderate', 'Moderate'], ['vigorous', 'Vigorous']], c.activity, 'Activity')) +
    '</div><label class="f" for="ci-note">Note<input type="text" id="ci-note" data-inp="ci" data-k="note" value="' + esc(c.note) + '" placeholder="Optional. Travel, a late night, a missed meal…"></label>' +
    '<div class="row"><button class="btn primary" data-act="ci-save">Save check-in</button><a class="btn" href="#journal">Log a meal</a></div></section>';
  const days = dateRange(14);
  h += '<section class="panel"><header><h3>Last 14 days</h3><span class="small muted num">' + days.filter(d => S.checkins[d]).length + ' of 14 checked in</span></header><div class="row" style="gap:6px">' + days.map(d => '<button class="chip' + (S.checkins[d] ? ' on' : '') + '" data-act="ci-open" data-d="' + d + '" title="' + fmtDay(d) + (S.checkins[d] ? ': saved' : ': no entry') + '" style="padding:6px 9px"><span class="num">' + new Date(d + 'T12:00:00').getDate() + '</span></button>').join('') + '</div><p class="small muted">Filled days have an entry. Select any day to add or edit it.</p></section>';
  return h;
};

/* ---------- Food explorer ---------- */
function foodListHtml() {
  const F0 = ui.food, q = F0.q.trim().toLowerCase();
  const list = FOODS.filter(f => (!F0.cat || f.cat === F0.cat) && (!F0.dosha || f[F0.dosha] === '-') && (!F0.fit || foodCheck(f, S.profile).ok) && (!q || (f.en + ' ' + f.tr + ' ' + f.hi + ' ' + f.reg + ' ' + (f.al || []).join(' ')).toLowerCase().includes(q)));
  if (!list.length) return empty('No foods match. Clear the search or filters to see all ' + FOODS.length + '.');
  return '<div class="foodlist">' + list.map(f => {
    const open = F0.open === f.id, chk = foodCheck(f, S.profile);
    let row = '<button type="button" class="foodrow" data-act="food-open" data-id="' + f.id + '" aria-expanded="' + open + '"><span class="stack" style="gap:2px"><span><b>' + esc(f.en) + '</b> <span class="hi muted">' + esc(f.hi) + '</span>' + (!chk.ok ? ' <span class="tag" title="' + esc(chk.hard.join('; ')) + '">Not in your diet</span>' : '') + '</span><span class="tiny muted">' + esc(f.tr) + ' · ' + CATS[f.cat] + '</span></span><span class="effs">' + ['v', 'p', 'k'].map(d => eff(f[d], d, true)).join('') + '</span>' + tierTag(f.tier) + '</button>';
    if (open) {
      const flags = conditionFlags(f, S.profile);
      row += '<div class="fooddetail"><div class="grid2"><dl class="kv"><dt>Hindi</dt><dd><span class="hi">' + esc(f.hi) + '</span> · ' + esc(f.tr) + '</dd>' + (f.reg ? '<dt>Regional names</dt><dd>' + esc(f.reg) + '</dd>' : '') + '<dt>Category</dt><dd>' + CATS[f.cat] + '</dd><dt>Taste (rasa)</dt><dd>' + f.rasa.join(', ') + '</dd><dt>Qualities (guna)</dt><dd>' + esc(f.guna.join(', ')) + '</dd><dt>Potency (virya)</dt><dd>' + (f.virya === 'disputed' ? 'sources disagree' : f.virya) + '</dd><dt>Post-digestive effect (vipaka)</dt><dd>' + (f.vipaka || 'not documented') + '</dd></dl>' +
        '<dl class="kv"><dt>Vata</dt><dd>' + eff(f.v) + '</dd><dt>Pitta</dt><dd>' + eff(f.p) + '</dd><dt>Kapha</dt><dd>' + eff(f.k) + '</dd><dt>Evidence</dt><dd>' + tierTag(f.tier) + ' <span class="tag prov">Provisional</span><div class="small muted">' + TIER[f.tier].long + (f.low ? ' Low confidence.' : '') + '</div></dd><dt>Sources</dt><dd>' + (f.src.length ? srcTags(f.src) : '<span class="muted">none</span>') + '</dd></dl></div>' +
        (f.dis ? '<div class="note small"><b>Sources disagree.</b> ' + esc(f.dis) + '</div>' : '') +
        '<div class="grid2"><div class="stack"><h4>Preparation changes the reading</h4><p class="small">' + esc(f.prep) + '</p><h4>Notes</h4><p class="small">' + esc(f.note) + '</p>' + (f.amt ? '<h4>Culinary amount</h4><p class="small">' + esc(f.amt) + '. ' + esc(f.amtNote || '') + '</p>' : '') + '</div>' +
        '<div class="stack"><h4>Nutrition per ' + esc(f.portion) + ' <span style="text-transform:none;letter-spacing:0;font-weight:400">(' + f.g + ' g, approximate)</span></h4><div class="tablewrap"><table><thead><tr><th class="n">kcal</th><th class="n">Protein</th><th class="n">Carbs</th><th class="n">Fat</th><th class="n">Fibre</th></tr></thead><tbody><tr>' + f.nut.map((x, i) => '<td class="n">' + (x == null ? '—' : i ? r1(x) + ' g' : Math.round(x)) + '</td>').join('') + '</tr></tbody></table></div><p class="tiny muted">Rounded values for cross-checking against ' + srcTags(['IFCT', 'USDA']) + '</p>' +
        '<dl class="kv small"><dt>Allergens</dt><dd>' + (f.alg.length ? f.alg.map(a => ALLERGENS[a]).join(', ') : 'none of the seven screened') + (f.hingGluten ? ' · compounded hing usually contains wheat' : '') + '</dd><dt>Fits diets</dt><dd>' + Object.entries(DIET_ALLOW).filter(([, a]) => a.includes(f.diet)).map(([k]) => DIETS[k]).join(', ') + '</dd>' + (S.profile ? '<dt>For your profile</dt><dd>' + (chk.ok ? 'Allowed' + (chk.soft.length ? ' · ' + chk.soft.join('; ') : '') : 'Excluded: ' + chk.hard.join('; ')) + '</dd>' : '') + '</dl></div></div>' +
        (flags.length ? '<div class="note alert small">' + flags.map(fl => '<b>' + fl.label + ':</b> ' + fl.msg).join('<br>') + '</div>' : '') + '</div>';
    }
    return row;
  }).join('') + '</div><p class="small muted">' + list.length + ' of ' + FOODS.length + ' shown.</p>';
}
PAGES.foods = () => {
  const F0 = ui.food;
  return pagehead('Food explorer', 'What the tradition says about each food', 'A starter set of ' + FOODS.length + ' foods and spices. Each entry shows its traditional properties, where the classification comes from, and how sure the app is.') +
    '<section class="panel"><div class="grid2"><label class="f" for="food-q">Search in English, Hindi or a regional name<input type="search" id="food-q" data-inp="food-q" value="' + esc(F0.q) + '" placeholder="aloo, moong, jeera, thayir…"></label><label class="f" for="food-d">Show only foods classed as pacifying for' + select('food-d', 'food-d', {}, [['', 'Any'], ['v', 'Vata'], ['p', 'Pitta'], ['k', 'Kapha']], F0.dosha) + '</label></div>' +
    '<div class="chips">' + chip('food-cat', { v: '' }, 'All', !F0.cat) + Object.entries(CATS).map(([k, l]) => chip('food-cat', { v: k }, l, F0.cat === k)).join('') + (S.profile ? chip('food-fit', {}, 'Only what fits my diet and allergies', F0.fit) : '') + '</div>' +
    '<div class="legend">' + ['-', '+', '~', '?'].map(c => '<span>' + eff(c) + '</span>').join('') + ['C', 'N', 'M', 'U'].map(t => '<span>' + tierTag(t) + '</span>').join('') + '</div>' +
    '<div class="note small"><b>Every classification is provisional.</b> The entries were compiled from general knowledge of the cited chapters and modern food lists. None has yet been checked line by line against a printed edition by a qualified reader. Citations point to the chapter to check, not to a verified verse. <a href="#sources">How sources are handled</a></div>' +
    '<div id="foodlist">' + foodListHtml() + '</div></section>';
};

/* ---------- Spice comparison ---------- */
const SPICES = FOODS.filter(f => f.spice);
function allBlends() { return SEED_BLENDS.concat(S.saved.blends); }
function blendCard(b) { if (!b) return ''; const sm = blendSummary(b.items, b.fat); const lab = s => s > 0 ? 'Suits' : s < 0 ? 'Less suited' : 'Mixed'; return '<div class="reading"><div class="row between"><b>' + esc(b.name) + '</b><span class="tag">' + sm.heatClass + ' heat</span></div><div class="small muted">' + (b.fat && FOOD[b.fat] ? 'In ' + FOOD[b.fat].en.toLowerCase() + ': ' : '') + b.items.map(([id, q, u]) => fmtItem({ id, qty: q, unit: u })).join(', ') + '</div><dl class="kv small">' + ['v', 'p', 'k'].map(d => '<dt class="d' + d + '">' + DOSHA[d] + '</dt><dd>' + lab(sm.read[d].step) + ' <span class="muted">(' + sm.read[d].pac + ' pacifying, ' + sm.read[d].agg + ' aggravating)</span></dd>').join('') + '</dl></div>'; }
PAGES.spices = () => {
  const sp = ui.spice, sel = sp.sel.map(id => FOOD[id]).filter(Boolean), dish = DISH[sp.dish];
  let h = pagehead('Spice comparison', 'Choose between spices with the reasons in view', 'Pick two to four spices. The table shows what tradition says about each and what swapping one in would do to a dish.');
  h += '<section class="panel"><div class="row"><span class="small muted">Quick comparisons</span>' + [['blackpepper,redchilipowder', 'Black pepper vs red chili powder'], ['cumin,mustardseeds', 'Cumin vs mustard seeds'], ['coriander,amchur', 'Coriander vs amchur'], ['greenchili,driedredchili,redchilipowder', 'Three chilies']].map(([v, l]) => '<button class="btn sm" data-act="sp-preset" data-v="' + v + '">' + l + '</button>').join('') + '<button class="btn sm" data-act="sp-tadka">Mild tadka vs spicy tadka</button></div>' +
    '<div class="chips">' + SPICES.map(f => chip('sp-toggle', { id: f.id }, f.en, sp.sel.includes(f.id))).join('') + '</div>';
  if (sel.length < 2) h += empty('Select at least two spices to compare.');
  else {
    const rowT = (label, fn) => '<tr><th scope="row" style="background:transparent;text-transform:none;letter-spacing:0;font-size:.86rem">' + label + '</th>' + sel.map(f => '<td>' + fn(f) + '</td>').join('') + '</tr>';
    const variant = f => { const items = dish.ing.filter(([id]) => !sp.sel.includes(id)).map(([id, qty, unit]) => ({ id, qty, unit })); items.push({ id: f.id, qty: f.def[0], unit: f.def[1] }); return analyzeDish(items, { method: dish.method, water: dish.water }); };
    h += '<div class="tablewrap"><table><thead><tr><th></th>' + sel.map(f => '<th style="text-transform:none;letter-spacing:0;font-size:.95rem;color:var(--ink)">' + esc(f.en) + '<div class="hi muted" style="font-weight:400">' + esc(f.hi) + '</div></th>').join('') + '</tr></thead><tbody>' +
      rowT('Vata', f => eff(f.v)) + rowT('Pitta', f => eff(f.p)) + rowT('Kapha', f => eff(f.k)) +
      rowT('Heating or cooling', f => f.virya === 'disputed' ? 'Sources disagree' : f.virya[0].toUpperCase() + f.virya.slice(1)) + rowT('Taste', f => f.rasa.join(', ')) + rowT('Qualities', f => esc(f.guna.join(', '))) + rowT('After digestion', f => f.vipaka || '—') +
      rowT('Usual amount', f => esc(f.amt || '—')) + rowT('When amount matters', f => '<span class="small">' + esc(f.amtNote || 'Within the usual range, amount changes little.') + '</span>') +
      rowT('In ' + esc(dish.name.toLowerCase()), f => { const A = variant(f); return '<div class="stack small" style="gap:3px">' + ['v', 'p', 'k'].map(d => '<span><span class="d' + d + '" style="font-weight:700">' + d.toUpperCase() + '</span> ' + A.readings[d].label + '</span>').join('') + '<span class="muted">' + fmtItem({ id: f.id, qty: f.def[0], unit: f.def[1] }) + ', ' + A.heatClass + ' heat</span></div>'; }) +
      rowT('Evidence', f => tierTag(f.tier) + '<div style="margin-top:4px">' + srcTags(f.src) + '</div>') + rowT('Where sources differ', f => '<span class="small">' + esc(f.dis || '—') + '</span>') +
      '</tbody></table></div><label class="f" for="sp-dish" style="max-width:22rem">Dish used for the "in a dish" row' + select('sp-dish', 'sp-dish', {}, DISHES.map(d => [d.id, d.name]), sp.dish) + '</label><p class="small muted">That row rebuilds the dish with each spice in turn, at its usual amount and without the others you selected, then reads it with the same rules as the recipe analyzer.</p>';
    if (sel.length === 2 && sp.sel.includes('blackpepper') && sp.sel.includes('redchilipowder')) h += '<div class="note calm small"><b>In short.</b> Both are pungent and classed as raising Pitta. Black pepper is classical, used by the quarter-teaspoon, and its heat fades fast. Chili powder is a post-16th-century arrival with no classical entry; modern authors rank it harder on Pitta because its heat is stronger and lingers. For a Pitta-leaning week, the usual advice is pepper in place of chili, in a smaller amount.</div>';
  }
  h += '</section>';
  // blends
  const blends = allBlends(), A = blends.find(b => b.id === sp.a) || blends[0], B = blends.find(b => b.id === sp.b) || blends[1];
  h += '<section class="panel"><header><h2>Everyday blends</h2><span class="small muted">Amounts are for one dish serving 2 to 4</span></header><div class="grid2"><label class="f" for="sp-a">Blend A' + select('sp-a', 'sp-ab', { k: 'a' }, blends.map(b => [b.id, b.name]), A.id) + '</label><label class="f" for="sp-b">Blend B' + select('sp-b', 'sp-ab', { k: 'b' }, blends.map(b => [b.id, b.name]), B ? B.id : '') + '</label></div><div class="grid2">' + blendCard(A) + blendCard(B) + '</div><p class="small muted">"Suits" and "Less suited" count how many spices in the blend are classed as pacifying or aggravating for that dosha, then adjust for overall chili heat and for mustard oil. It is a tally, not a measurement.</p>';
  const d = sp.draft;
  if (!d) h += '<div class="row"><button class="btn" data-act="bl-new">Build a blend</button>' + S.saved.blends.map(b => '<span class="chip static">' + esc(b.name) + ' <button class="btn sm quiet" style="padding:0 4px" data-act="bl-del" data-id="' + b.id + '" aria-label="Delete ' + esc(b.name) + '">Delete</button></span>').join('') + '</div>';
  else h += '<div class="panel flat"><h3>New blend</h3><div class="grid2"><label class="f" for="bl-name">Name<input type="text" id="bl-name" data-inp="bl-name" value="' + esc(d.name) + '" placeholder="My weekday tadka"></label><label class="f" for="bl-fat">Bloomed in' + select('bl-fat', 'bl-fat', {}, [['', 'Not specified'], ['ghee', 'Ghee'], ['oil', 'Neutral oil'], ['mustardoil', 'Mustard oil'], ['coconutoil', 'Coconut oil'], ['sesameoil', 'Sesame oil']], d.fat) + '</label></div>' +
    (d.items.length ? '<div class="stack">' + d.items.map((it, i) => '<div class="row"><span style="min-width:9rem;font-weight:600">' + FOOD[it[0]].en + '</span><input type="number" id="bl-q-' + i + '" aria-label="Amount of ' + FOOD[it[0]].en + '" min="0" step="0.25" style="width:5.5rem" data-chg="bl-q" data-i="' + i + '" value="' + it[1] + '"><span class="small muted">' + it[2] + '</span><button class="btn sm quiet" data-act="bl-rm" data-i="' + i + '">Remove</button></div>').join('') + '</div>' : '<p class="small muted">Add spices below.</p>') +
    '<label class="f" for="bl-add" style="max-width:18rem">Add a spice' + select('bl-add', 'bl-add', {}, [['', 'Choose']].concat(SPICES.filter(f => !d.items.find(i => i[0] === f.id)).map(f => [f.id, f.en])), '') + '</label><div class="row"><button class="btn primary" data-act="bl-save"' + (d.items.length < 2 ? ' disabled' : '') + '>Save blend</button><button class="btn" data-act="bl-cancel">Cancel</button></div></div>';
  h += '</section>';
  return h;
};
