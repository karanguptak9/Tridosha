/* ---------- Sources, method and build blueprint ---------- */
const SQL = `-- Tridosha · Supabase (Postgres) schema, migration 0001
create extension if not exists pgcrypto;

-- Reference data: readable by every signed-in user, writable by service role only
create table citations (
  id text primary key,                      -- 'CS-SU27', 'R-PRASHER08'
  evidence_type text not null check (evidence_type in
    ('classical','later_classical','modern_interpretation','observational','controlled_clinical','nutrition','unverified')),
  attribution text not null, title text not null,
  locator text,                             -- chapter and verse, or journal, year, pages
  edition text, url text, doi text,
  relevance text not null, limitations text,
  verified_by text, verified_at timestamptz -- null until checked against a printed edition
);
create table foods (
  id text primary key, name_en text not null, name_hi text, name_translit text,
  regional_names jsonb not null default '{}',
  category text not null check (category in ('veg','leg','grain','dairy','protein','fruit','spice','fat')),
  portion_label text not null, portion_grams numeric not null check (portion_grams > 0),
  kcal numeric, protein_g numeric, carb_g numeric, fat_g numeric, fibre_g numeric,
  diet_class text not null check (diet_class in ('vegan','veg','egg','fish','meat')),
  allergens text[] not null default '{}', aliases text[] not null default '{}',
  data_version text not null
);
create table food_properties (
  food_id text primary key references foods on delete cascade,
  rasa text[] not null, guna text[] not null,
  virya text check (virya in ('heating','cooling','mild','disputed')),
  vipaka text check (vipaka in ('sweet','sour','pungent')),
  preparation_notes text, amount_notes text
);
create table dosha_associations (
  food_id text references foods on delete cascade,
  dosha text check (dosha in ('vata','pitta','kapha')),
  effect text not null check (effect in ('pacifying','aggravating','conditional','not_established')),
  evidence_tier text not null check (evidence_tier in ('C','N','M','U')),
  confidence text not null check (confidence in ('chapter_level','verse_verified','interpretive','low')),
  disagreement text,
  primary key (food_id, dosha)
);
create table food_citations (
  food_id text references foods on delete cascade,
  citation_id text references citations, claim text not null,
  primary key (food_id, citation_id)
);
create table cooking_methods (id text primary key, label text not null);
create table recipes (
  id text primary key, name text not null, subtitle text, aliases text[] not null default '{}',
  method_id text references cooking_methods, moisture text check (moisture in ('dry','semi','gravy','soupy')),
  meal_slots text[] not null, staple text, base_servings int not null default 2,
  owner_id uuid references auth.users       -- null for seed recipes
);
create table recipe_ingredients (
  recipe_id text references recipes on delete cascade, food_id text references foods,
  quantity numeric not null check (quantity > 0), unit text not null, position int not null,
  primary key (recipe_id, food_id)
);
create table scoring_algorithm_versions (
  id text primary key,                      -- 'PS-1.0', 'VS-1.0', 'DR-1.0'
  kind text not null check (kind in ('prakriti','vikriti','dish_rules')),
  description text not null, validated boolean not null default false,
  released_at timestamptz not null default now()
);
create table questionnaire_definitions (
  id text primary key,                      -- 'PQ-1.0', 'VQ-1.0'
  kind text not null check (kind in ('prakriti','vikriti','daily')),
  instrument_citation text references citations, validated boolean not null default false,
  limitations text not null
);
create table questions (
  id text primary key, questionnaire_id text not null references questionnaire_definitions,
  category text not null, prompt text not null, rationale text not null,
  allow_not_applicable boolean not null default false, position int not null
);
create table answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references questions on delete cascade, label text not null, position int not null
);
create table scoring_rules (
  algorithm_id text references scoring_algorithm_versions,
  option_id uuid references answer_options on delete cascade,
  dosha text check (dosha in ('vata','pitta','kapha')), weight numeric not null,
  primary key (algorithm_id, option_id, dosha)
);

-- User data: every table carries user_id and is locked by row-level security
create table user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  age_range text, diet text not null, allergens text[] not null default '{}', other_allergy text,
  exclusions text[] not null default '{}', cuisines text[] not null default '{}',
  activity text, bedtime time, wake_time time, region text, climate text, season_override text,
  goals text[] not null default '{}', disliked_foods text[] not null default '{}', kcal_target int,
  health_consent_at timestamptz,            -- null = no health data stored
  conditions text[], pregnancy_status text, medication_note text,
  updated_at timestamptz not null default now(),
  check (health_consent_at is not null or (conditions is null and pregnancy_status is null and medication_note is null))
);
create table assessment_responses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  questionnaire_id text not null references questionnaire_definitions,
  answers jsonb not null, completed_at timestamptz not null default now()
);
create table assessment_results (
  response_id uuid primary key references assessment_responses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  algorithm_id text not null references scoring_algorithm_versions,
  scores jsonb not null,                    -- shares for prakriti, 0-100 loads for vikriti
  label text, answered int, total int, flags jsonb not null default '[]'
);
create table prakriti_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  response_id uuid not null references assessment_responses, set_at timestamptz not null default now()
);
create table vikriti_assessments (
  response_id uuid primary key references assessment_responses on delete cascade,
  user_id uuid not null references auth.users on delete cascade, week_of date not null,
  unique (user_id, week_of)
);
create table symptom_logs (
  user_id uuid references auth.users on delete cascade, log_date date,
  bloating smallint check (bloating between 0 and 3), heartburn smallint check (heartburn between 0 and 3),
  heaviness smallint check (heaviness between 0 and 3), bowel text check (bowel in ('hard','comfortable','loose')),
  energy smallint check (energy between 1 and 5), sleep_quality smallint check (sleep_quality between 1 and 5),
  sleep_hours numeric check (sleep_hours between 0 and 24), stress smallint check (stress between 1 and 5),
  feelings text[] not null default '{}', activity text, note text,
  primary key (user_id, log_date)
);
create table meal_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  eaten_on date not null, eaten_at time, slot text, name text not null, recipe_id text references recipes,
  ingredients jsonb, servings int, portion text check (portion in ('small','regular','large')),
  comfort smallint check (comfort between 1 and 5), energy_after smallint check (energy_after between 1 and 5),
  enjoyment smallint check (enjoyment between 1 and 5), symptoms text[] not null default '{}',
  ingredient_source text not null default 'typed' check (ingredient_source in ('typed','preset','photo_confirmed')),
  note text, created_at timestamptz not null default now()
);
create table personalized_recommendations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('food','swap','blend','dish','plan')), payload jsonb not null,
  focus_dosha text, basis text check (basis in ('vikriti','prakriti','none')), season text,
  rules_version text references scoring_algorithm_versions, created_at timestamptz not null default now()
);
create table recommendation_explanations (
  recommendation_id uuid references personalized_recommendations on delete cascade, position int,
  rule text not null, text text not null, citation_ids text[] not null default '{}',
  primary key (recommendation_id, position)
);
create table user_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  recommendation_id uuid references personalized_recommendations on delete set null,
  helpful boolean, comment text, created_at timestamptz not null default now()
);

create index on assessment_responses (user_id, questionnaire_id, completed_at desc);
create index on meal_entries (user_id, eaten_on desc);
create index on meal_entries (user_id, recipe_id);
create index on symptom_logs (user_id, log_date desc);
create index on personalized_recommendations (user_id, created_at desc);
create index on foods using gin (aliases);

-- Row-level security: a user sees and changes only their own rows
do $$ declare t text; begin
  foreach t in array array['user_preferences','assessment_responses','assessment_results','prakriti_profiles',
    'vikriti_assessments','symptom_logs','meal_entries','personalized_recommendations','user_feedback'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
  foreach t in array array['citations','foods','food_properties','dosha_associations','food_citations','cooking_methods',
    'recipe_ingredients','scoring_algorithm_versions','questionnaire_definitions','questions','answer_options','scoring_rules'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;
alter table recipes enable row level security;
create policy read_seed_or_own on recipes for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy write_own on recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
alter table recommendation_explanations enable row level security;
create policy own_expl on recommendation_explanations for select using (
  exists (select 1 from personalized_recommendations r where r.id = recommendation_id and r.user_id = auth.uid()));

-- Export and deletion: one RPC returns every row for auth.uid() as JSON;
-- deleting the auth.users row cascades through every user table above.`;
const ACCEPT = [
  ['A user can register and complete a Prakriti questionnaire', () => !!S.prakriti, 'Sign-in comes from your Claude account; the questionnaire is on the Prakriti page.'],
  ['The app explains the resulting profile and its limitations', () => !!S.prakriti, 'Result page: label rules, steadiness note, limitations, scoring details.'],
  ['The user can complete a separate Vikriti assessment', () => S.vikriti.length > 0, 'Separate questionnaire, separate scoring version, separate scale.'],
  ['Both results are displayed without misleading direct percentage comparisons', () => !!(S.prakriti && S.vikriti.length), 'Dashboard: two panels, shares against a 0–100 load, compared only in words.'],
  ['A user can log a potato-and-tomato sabzi with spices', () => S.meals.some(m => (m.items || []).some(i => i.id === 'potato') && (m.items || []).some(i => i.id === 'tomato')), 'Recipe analyzer, then "Log this meal".'],
  ['The app recognizes the ingredients and suggests preparation adjustments', () => null, 'Built in. Try the placeholder sentence on the analyzer page.'],
  ['The user can compare black pepper against red chili powder', () => null, 'Built in. It is the default comparison on the spice page.'],
  ['The app suggests moong dal and paneer recipes consistent with user preferences', () => null, 'Built in. Meal ideas include moong dal, khichdi, palak paneer and others; paneer becomes tofu for vegan profiles.'],
  ['Food allergies and restrictions are respected', () => null, 'Built in. Diet, seven allergens and three exclusions filter every suggestion and are checked in the analyzer.'],
  ['Every traditional classification has a traceable source or is clearly marked provisional', () => null, 'Built in, with a caveat: all entries carry a source pointer and all are marked provisional until verified against print.'],
  ['Daily entries and historical trends persist', () => store.mode === 'db' ? true : store.mode === 'local' ? true : null, 'Saved per person; the status line shows where.'],
  ['No recommendation claims to diagnose, cure, or quantitatively correct a dosha imbalance', () => null, 'Built in. Readings are ordinal labels with reasons; no percentages are attached to foods or dishes.']
];
function srcCard(id) { const s = SRC[id]; const used = FOODS.filter(f => f.src.includes(id)).length; return '<div class="reading" id="src-' + id + '"><div class="row between"><b>' + esc(s.title) + '</b><span class="tag">' + id + '</span></div><div class="small">' + esc(s.attr) + '</div><div class="small muted">' + esc(s.loc) + '</div><div class="small">' + esc(s.rel) + '</div>' + (s.limits ? '<div class="small muted"><b>Limitations:</b> ' + esc(s.limits) + '</div>' : '') + '<div class="row small"><span class="tag ' + (s.kind === 'classical' ? 'C' : s.kind === 'nighantu' ? 'N' : s.kind === 'modern' ? 'M' : '') + '">' + KIND_LABEL[s.kind] + '</span>' + (used ? '<span class="muted num">Cited by ' + used + ' food entries</span>' : '') + (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">Open source</a>' : '') + '</div></div>'; }
PAGES.sources = () => {
  let h = pagehead('Sources and method', 'Where every number and label comes from', 'Three kinds of claim are kept apart throughout: what classical texts teach, how modern authors interpret them, and what scientific studies have observed.') +
    '<div class="row">' + seg('src-tab', {}, [['method', 'Method'], ['registry', 'Source registry'], ['blueprint', 'Build blueprint']], ui.srcTab, 'Section') + '</div>';
  if (ui.srcTab === 'method') {
    h += '<section class="panel"><h2>Scientific boundaries</h2><ul class="prose"><li>Vata, Pitta and Kapha are constructs of traditional Ayurvedic medicine. No laboratory test measures them, and no study has shown that a diet changes them.</li><li>A handful of observational studies report genetic, biochemical or microbiome differences between people whom clinicians classified as extreme Prakriti types. They are interesting and limited: small samples, pre-selected extremes, and clinician assessment in place of a questionnaire.</li><li>Reviews of diagnostic reliability in Ayurveda find few rigorous studies and uneven agreement between assessors. That is why every score in this app is labelled exploratory.</li><li>No controlled clinical evidence is cited for any food recommendation here, because the app found none it could verify for constitution-matched diets. Suggestions are traditional guidance and ordinary nutrition.</li></ul></section>' +
      '<section class="panel"><h2>Evidence labels</h2><div class="stack">' + Object.entries(TIER).map(([k, t]) => '<div class="row" style="align-items:baseline">' + tierTag(k) + '<span class="small" style="flex:1 1 16rem">' + t.long + '</span><span class="small muted num">' + FOODS.filter(f => f.tier === k).length + ' entries</span></div>').join('') + '<div class="row" style="align-items:baseline"><span class="tag prov">Provisional</span><span class="small" style="flex:1 1 16rem">Applies to every food entry today. The classification and its chapter-level citation were compiled from general knowledge of the texts and have not been checked against a printed edition. Verse numbers are deliberately not given, because unverified verse numbers would be invented precision.</span></div></div></section>' +
      '<section class="grid2"><div class="panel"><h3>Prakriti score <span class="tag">' + VERSIONS.prakritiScore + '</span></h3><p class="small">One point per answer to the dosha whose traditional description was chosen. Skipped questions are excluded. Shares are points divided by total points. Equal weights throughout. Label rules and a plain-language steadiness note are shown with the result.</p><p class="small muted">Status: exploratory. The questionnaire (' + VERSIONS.prakritiQ + ') follows the trait domains of ' + srcTags(['CS-VI8', 'SS-SH4', 'AH-SH3']) + ' but is not a published instrument. Published instruments exist, for example ' + srcTags(['R-SHILPA11', 'R-RASTOGI12']) + '; this app does not reproduce them and has no reliability or validity statistics of its own.</p></div>' +
      '<div class="panel"><h3>Vikriti index <span class="tag">' + VERSIONS.vikritiScore + '</span></h3><p class="small">For each recent symptom, frequency over the week times severity, averaged over the symptoms traditionally associated with a dosha, scaled to 0–100. Duration triggers medical-attention prompts and does not enter the index.</p><p class="small muted">Status: exploratory. The symptom-to-dosha mapping follows the general classical account of dosha qualities ' + srcTags(['CS-SU1', 'AH-SU1']) + ' and is a simplification.</p></div></section>' +
      '<section class="panel"><h3>Why the two are never subtracted</h3><p class="small" style="max-width:44rem">The Prakriti shares always add to 100% and describe which answers you gave. The Vikriti loads are three separate symptom indexes that could all be 0 or all be high. Subtracting one from the other would produce a number with no meaning, and would wrongly imply that an even split or a zero difference is the healthy state. The dashboard shows both and compares them in a sentence.</p></section>' +
      '<section class="panel"><h3>Dish readings <span class="tag">' + VERSIONS.dishRules + '</span></h3><div class="tablewrap"><table><tbody>' + RULES.map(r => '<tr><td class="num" style="font-weight:700">' + r[0] + '</td><td><b>' + r[1] + '.</b> ' + r[2] + '</td></tr>').join('') + '</tbody></table></div><p class="small muted">Chili heat per serving uses rough pungency factors chosen for this app (red chili powder highest, then black pepper, then mustard, with ginger and garlic low). Thresholds: below 0.5 mild, up to 1.3 medium, above that hot. Half a teaspoon of chili powder for two people lands at medium.</p></section>' +
      '<section class="panel"><h3>Order of priority in recommendations</h3><ol class="small prose"><li><b>Safety.</b> Allergens, diet, exclusions. A dish that cannot be adapted is removed.</li><li><b>Medical cautions</b> you chose to share. Flagged foods are held back and explained.</li><li><b>Nutritional adequacy.</b> Protein and fibre are shown per dish and per day; protein-rich dishes get a ranking bonus.</li><li><b>Your own record.</b> Dishes you repeatedly logged discomfort after are moved down.</li><li><b>Traditional suitability</b> for your current pattern, then season.</li></ol><p class="small muted">Nutrition values are rounded approximations for cross-checking against ' + srcTags(['IFCT', 'USDA']) + '. They are not lab-measured for your ingredients.</p></section>' +
      '<section class="panel"><h3>Versions in this build</h3><div class="tablewrap"><table><tbody>' + Object.entries({ 'Prakriti questionnaire': VERSIONS.prakritiQ, 'Prakriti scoring': VERSIONS.prakritiScore, 'Vikriti questionnaire': VERSIONS.vikritiQ, 'Vikriti scoring': VERSIONS.vikritiScore, 'Dish rules': VERSIONS.dishRules, 'Food data': VERSIONS.foodData }).map(([k, v]) => '<tr><td>' + k + '</td><td class="num">' + v + '</td></tr>').join('') + '</tbody></table></div></section>';
  } else if (ui.srcTab === 'registry') {
    const kinds = Object.keys(KIND_LABEL), list = Object.keys(SRC).filter(id => !ui.srcKind || SRC[id].kind === ui.srcKind);
    h += '<section class="panel"><div class="chips">' + chip('src-kind', { v: '' }, 'All ' + Object.keys(SRC).length, !ui.srcKind) + kinds.map(k => chip('src-kind', { v: k }, KIND_LABEL[k] + ' ' + Object.values(SRC).filter(s => s.kind === k).length, ui.srcKind === k)).join('') + '</div><div class="note small">No controlled clinical evidence is registered, and no entry is marked "unsupported", because unsupported claims were left out instead of being listed. Journal references were confirmed to exist by search. Two have no link because a DOI or stable address was not confirmed; find them by title.</div><div class="grid2">' + list.map(srcCard).join('') + '</div></section>' +
      '<section class="panel"><h3>Translations and editions to verify against</h3><dl class="kv small">' + TRANSLATIONS.map(t => '<dt>' + t[0] + '</dt><dd>' + t[1] + '</dd>').join('') + '</dl><p class="small muted">Verse numbering differs between editions, which is one more reason citations here stop at the chapter.</p></section>';
  } else {
    h += '<section class="panel"><h2>What this build is</h2><p style="max-width:44rem">A working single-page implementation of the Tridosha specification: all fourteen pages, the scoring and dish-rule engines, the starter dataset, and per-person persistence. It is not the Next.js and Supabase codebase the specification names; a published page cannot ship a server, migrations or a test runner. What follows maps this build onto that stack so it can be ported.</p><div class="tablewrap"><table><thead><tr><th>Specified</th><th>In this build</th><th>Port</th></tr></thead><tbody>' + [
      ['Next.js, React, TypeScript', 'One HTML page, plain JavaScript, hash routes', 'Each page function becomes a route under app/; the engine file is framework-free and moves to lib/ unchanged, with types added'],
      ['Tailwind CSS, shadcn/ui', 'Hand-written CSS on a small token set', 'Tokens map to a Tailwind theme; chips, segmented controls and panels map to shadcn ToggleGroup, Tabs and Card'],
      ['Supabase auth and Postgres', 'Claude account identity and a private per-person document store', 'Schema and row-level security below; documents map one-to-one to tables'],
      ['Recharts', 'Small inline SVG charts drawn to scale', 'RadarChart for the Prakriti triangle, LineChart for trends'],
      ['Optional AI', 'Photo-to-ingredients estimate through the viewer\'s own Claude, always user-confirmed', 'Server action calling the Claude API with the same prompt and the same confirmation step'],
      ['Runnable tests', 'The engine was exercised on all 22 seed dishes and the acceptance sentence before publishing', 'Vitest unit tests for scorePrakriti, scoreVikriti, parseRecipe, analyzeDish, adaptDish; Playwright for the twelve acceptance flows']
    ].map(r => '<tr>' + r.map(c => '<td class="small">' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></section>' +
      '<section class="panel"><h2>Acceptance criteria</h2><div>' + ACCEPT.map((a, i) => { const st = a[1](); return '<div class="todo' + (st !== false ? ' done' : '') + '"><span class="tick" aria-hidden="true">' + (st === false ? '' : '✓') + '</span><div><b>' + (i + 1) + '. ' + a[0] + '</b><div class="small muted">' + a[2] + '</div></div><span class="tag">' + (st === true ? 'Done by you' : st === false ? 'Not done yet' : 'Built in') + '</span></div>'; }).join('') + '</div></section>' +
      '<section class="panel"><h2>Delivery phases</h2><div class="grid3">' + [
        ['Phase 1 · Functional MVP', ['Onboarding and profile', 'Prakriti questionnaire', 'Vikriti questionnaire', 'Dosha profile visualisation', 'Daily check-in', 'Searchable food and spice database', 'Recipe analyzer', 'Persistent storage'], 'All present'],
        ['Phase 2 · Personalization', ['Personalized meal suggestions', 'Food journal', 'Recipe modifications', 'Saved dishes and spice blends', 'Nutritional information', 'Weekly planner and grocery list'], 'All present, on the starter dataset'],
        ['Phase 3 · Advanced analytics', ['7, 30 and 90 day trends', 'Food and symptom counts with sample size', 'Journal-informed ranking', 'Research methodology panel', 'Qualitative baseline-versus-current reading'], 'Present; learning is rule-based, not a trained model']
      ].map(p => '<div class="stack"><h3>' + p[0] + '</h3><ul class="small">' + p[1].map(x => '<li>' + x + '</li>').join('') + '</ul><span class="tag">' + p[2] + '</span></div>').join('') + '</div><h4>Before a public launch</h4><ul class="small prose"><li>Have a qualified Ayurvedic scholar verify each of the ' + FOODS.length + ' food entries against a named edition, record verse numbers, and clear the provisional flag entry by entry.</li><li>Replace approximate nutrition with licensed IFCT or USDA values keyed by food code.</li><li>Run a test-retest and inter-rater study on the questionnaire, or license a published instrument.</li><li>Clinical and legal review of the safety prompts and the medical-caution lists.</li><li>Accessibility audit with screen-reader users; Hindi interface text.</li></ul></section>' +
      '<section class="panel"><header><h2>Database schema and row-level security</h2><button class="btn sm" data-act="copy-sql">Copy SQL</button></header><p class="small muted">22 tables. Reference data is read-only to users; every user table is locked to its owner. Health details can only be stored once consent is recorded, enforced by a check constraint.</p><div class="code" id="sql" tabindex="0">' + esc(SQL) + '</div></section>';
  }
  return h;
};

/* ---------- Profile, privacy and settings ---------- */
PAGES.settings = () => {
  const [cls, st] = statusInfo();
  let h = pagehead('Profile and privacy', 'Your details and your data', 'Change anything about your profile, export everything, or delete it all.');
  h += '<section class="panel"><header><h2>Profile</h2>' + (S.profile && S.profile.updated ? '<span class="small muted">Last saved ' + fmtDate(S.profile.updated) + '</span>' : '') + '</header>' + [0, 1, 2, 3].map(i => '<div class="stack" style="gap:14px"><h4>' + PF_TITLES[i] + '</h4>' + pfSection(i) + '</div>' + (i < 3 ? '<hr>' : '')).join('') + '<div class="row"><button class="btn primary" data-act="pf-save">Save profile</button></div></section>';
  h += '<section class="panel"><h2>Privacy</h2><dl class="kv"><dt>Where your data is</dt><dd><span class="status ' + cls + '" style="padding:0"><i></i>' + esc(st) + '</span><div class="small muted">' + (store.mode === 'db' ? 'Each person who opens this page gets a private space tied to their own account. Other viewers, including whoever shared the page with you, cannot read it.' : store.mode === 'local' ? 'Your entries are kept in this browser on this device. They will not follow you to another device, and clearing site data removes them.' : store.mode === 'pending' ? 'Still checking.' : 'This view cannot store anything. Entries last until you close the page.') + '</div></dd><dt>What is stored</dt><dd class="small">Your profile, questionnaire answers and results with their version numbers, check-ins, meals, saved meals and blends, and your weekly plan. Photos are never stored: a photo is sent once for an ingredient estimate and discarded.</dd><dt>Health details</dt><dd class="small">' + (S.profile && S.profile.health && S.profile.health.consent ? 'You chose to share them. Turn the switch off in the profile above and save to remove them.' : 'Not shared.') + '</dd><dt>Advertising and tracking</dt><dd class="small">This page contains no advertising, analytics or third-party tracking code, and nothing you enter is used for advertising.</dd></dl>' +
    '<hr><div class="row"><button class="btn" data-act="export">Export my data</button>' + (ui.confirm === 'wipe' ? '<span class="note alert small" style="flex:1 1 18rem">This permanently deletes your profile, assessments, check-ins, meals, blends and plan. <button class="btn sm danger" data-act="wipe-yes">Yes, delete everything</button> <button class="btn sm" data-act="confirm-no">Keep my data</button></span>' : '<button class="btn danger" data-act="wipe-ask"' + (hasData(S) && !store.sample ? '' : ' disabled') + '>Delete all my data</button>') + '</div>' +
    (ui.exportText != null ? '<label class="f" for="export-text">Your data as JSON. Select all and copy.<textarea id="export-text" readonly style="min-height:160px;font-family:ui-monospace,Menlo,monospace;font-size:.78rem">' + esc(ui.exportText) + '</textarea></label>' : '') + '</section>';
  h += '<section class="panel"><h3>Sample data</h3><p class="small muted">Loads an invented three-week history so you can see every chart filled in. Sample mode saves nothing and your own entries return when you leave it.</p><div class="row">' + (store.sample ? '<button class="btn" data-act="sample-clear">Leave sample mode</button>' : '<button class="btn" data-act="sample-load">View sample data</button>') + '</div></section>';
  return h;
};

/* ============================================================
   Actions
   ============================================================ */
function startAnalysis(text, extra) {
  const r = parseRecipe(text);
  if (!r.items.length) { ui.an = null; return false; }
  let name = r.dish ? r.dish.name : String(text).split(/\bwith\b|[:,.]/i)[0].trim().slice(0, 48);
  name = name ? name[0].toUpperCase() + name.slice(1) : 'Custom dish';
  ui.an = Object.assign({ name, dishId: r.dish ? r.dish.id : null, items: r.items, method: r.method, water: r.water, portion: 'regular', serves: 2, unknown: r.unknown, usedPreset: r.usedPreset }, extra || {});
  return true;
}
function dishToAn(id) { const d = DISH[id], ad = adaptDish(d, S.profile); ui.anText = d.name; ui.an = { name: d.name, dishId: d.id, items: ad.items.map(i => Object.assign({}, i)), method: d.method, water: d.water, portion: 'regular', serves: 2, unknown: [], usedPreset: true, adapted: ad.notes }; }
const PHOTO_ERR = { not_granted: 'Photo estimates need your permission to ask Claude. You can still type the dish.', rate_limited: 'Too many requests just now. Try again in a little while.', image_rejected: 'That image could not be read. Try a JPEG or PNG under 20 MB.', images_unavailable: 'Photo estimates are not available in this view.', none: 'No food could be identified in that photo. Type the dish instead.' };
async function photoEstimate(file, to) {
  if (!caps.sample || !file) return;
  ui.photo = { busy: true }; render();
  try {
    const data = await caps.sample.json('The attached photo shows a meal, most likely Indian home cooking. Reply with only a JSON object of the form {"dish": string, "ingredients": [{"name": string, "grams": number}]}. List the visible or very likely ingredients of the whole plate with a rough weight in grams each. Use plain English ingredient names such as potato, tomato, onion, white rice, wheat roti, moong dal, toor dal, paneer, yogurt, chicken, ghee, oil, cumin, turmeric, coriander powder, red chili powder, green chili, mustard seeds, salt. If the photo does not show food, reply {"dish": "", "ingredients": []}. Example: {"dish": "aloo sabzi with roti", "ingredients": [{"name": "potato", "grams": 200}, {"name": "wheat roti", "grams": 60}]}', { images: [file] });
    const list = (data && Array.isArray(data.ingredients) ? data.ingredients : []).filter(x => x && x.name).slice(0, 24);
    if (!list.length) throw { code: 'none' };
    const text = list.map(x => (Math.round(+x.grams) > 0 ? Math.round(+x.grams) + ' g ' : '') + String(x.name)).join(', ');
    ui.photo = null;
    if (!startAnalysis(text, { fromPhoto: true })) throw { code: 'none' };
    if (data.dish) ui.an.name = String(data.dish).slice(0, 48).replace(/^./, c => c.toUpperCase());
    ui.an.items.forEach(i => { if (!i.assumed) i.assumed = false; });
    ui.anText = (data.dish ? data.dish + ': ' : '') + text;
    if (to === 'jf') { const j = jfDraft(); Object.assign(j, { name: ui.an.name, items: ui.an.items, serves: 1, dishId: ui.an.dishId, fromPhoto: true }); ui.an.serves = 1; }
    else { ui.an.serves = 1; if (ui.route !== 'analyzer') { go('analyzer'); return; } }
  } catch (e) { ui.photo = { err: PHOTO_ERR[e && e.code] || 'The photo estimate did not work this time. Type the dish instead, or try again.' }; }
  render();
}
function saveProfile(then) {
  const p = clone(pfDraft());
  p.dislikes = parseRecipe(p.dislikesText || '').items.map(i => i.id);
  if (!p.health.consent) p.health = { consent: false, conditions: [], pregnancy: '', meds: '' };
  else if (!p.health.consentAt) p.health.consentAt = new Date().toISOString();
  p.done = true; p.updated = todayStr();
  S.profile = p; ui.pf = null; ui.obOpen = false; ui.obStep = 0; persist(); toast('Profile saved');
  if (then) go(then); else render();
}
const ACT = {
  more: () => openSheet(), 'sheet-close': (d, el, e) => { if (e.target === el || el.tagName === 'BUTTON') closeSheet(); },
  'sample-load': () => { if (!store.sample) { store.real = S; store.sample = true; } S = sampleData(); resetDrafts(); toast('Sample data loaded'); go('dashboard'); },
  'sample-clear': () => { S = store.real || EMPTY(); store.real = null; store.sample = false; resetDrafts(); toast('Back to your own data'); go('home'); },
  'ob-go': () => { ui.obOpen = true; render(); const el = $('#onboard'); if (el) el.scrollIntoView({ block: 'start' }); },
  'ob-next': () => { ui.obStep = Math.min(3, ui.obStep + 1); render(); }, 'ob-back': () => { ui.obStep = Math.max(0, ui.obStep - 1); render(); },
  'pf-set': d => { pfDraft()[d.k] = d.v; render(); },
  'pf-toggle': d => { const a = pfDraft()[d.k]; const i = a.indexOf(d.v); i < 0 ? a.push(d.v) : a.splice(i, 1); render(); },
  'pf-cond': d => { const a = pfDraft().health.conditions; const i = a.indexOf(d.v); i < 0 ? a.push(d.v) : a.splice(i, 1); render(); },
  'pf-save': d => saveProfile(d.then),
  // prakriti
  'pq-start': () => { pqDraft().mode = 'quiz'; ui.pq.i = 0; render(true); },
  'pq-pick': d => { const q = pqDraft(), qu = PQ[q.i]; q.answers[qu.id] = d.v === 'ns' || d.v === 'na' ? d.v : +d.v; if (q.ret) { q.ret = false; q.mode = 'review'; } else if (q.i < PQ.length - 1) q.i++; else q.mode = 'review'; render(); },
  'pq-back': () => { const q = pqDraft(); q.i = Math.max(0, q.i - 1); render(); },
  'pq-fwd': () => { const q = pqDraft(); if (q.i < PQ.length - 1) q.i++; else q.mode = 'review'; render(); },
  'pq-review': () => { pqDraft().mode = 'review'; render(true); },
  'pq-jump': d => { const q = pqDraft(); q.i = +d.i; q.mode = 'quiz'; q.ret = true; render(true); },
  'pq-cancel': () => { ui.pq = null; render(true); },
  'pq-restart': () => { ui.pq = { mode: 'quiz', i: 0, answers: {} }; render(true); },
  'pq-score': () => { const q = pqDraft(); S.prakriti = { qv: VERSIONS.prakritiQ, sv: VERSIONS.prakritiScore, date: todayStr(), answers: clone(q.answers), result: scorePrakriti(q.answers), sources: ['CS-VI8', 'SS-SH4', 'AH-SH3'] }; q.mode = 'result'; persist(); toast('Prakriti profile saved'); render(true); },
  // vikriti
  'vk-f': d => { const v = vkDraft(); const a = v.ans[d.id] || (v.ans[d.id] = { f: 0, s: 1, d: 0 }); a.f = +d.v; if (!a.f) delete v.ans[d.id]; render(); },
  'vk-s': d => { const v = vkDraft(); (v.ans[d.id] || (v.ans[d.id] = { f: 1, s: 1, d: 0 })).s = +d.v; render(); },
  'vk-new': () => { const t = S.vikriti.find(e => e.date === todayStr()); ui.vk = { mode: 'form', ans: t ? clone(t.ans) : {}, view: S.vikriti.length - 1 }; render(true); },
  'vk-cancel': () => { ui.vk = null; render(true); },
  'vk-save': () => { const v = vkDraft(), r = scoreVikriti(v.ans), e = { date: todayStr(), qv: VERSIONS.vikritiQ, sv: VERSIONS.vikritiScore, ans: clone(v.ans), loads: r.loads }; const i = S.vikriti.findIndex(x => x.date === e.date); i < 0 ? S.vikriti.push(e) : S.vikriti[i] = e; S.vikriti.sort((a, b) => a.date.localeCompare(b.date)); ui.vk = null; persist(); toast('Assessment saved'); render(true); },
  'vk-view': d => { vkDraft().view = +d.i; render(true); },
  'vk-del': d => { if (ui.confirm !== 'vk' + d.i) { ui.confirm = 'vk' + d.i; toast('Select Delete again to remove that assessment'); return; } S.vikriti.splice(+d.i, 1); ui.vk = null; ui.confirm = null; persist(); render(); },
  // check-in
  ci: d => { const c = ciDraft(); const num = ['bloat', 'burn', 'heavy', 'energy', 'sleepQ', 'stress'].includes(d.k); const v = num ? +d.v : d.v; c[d.k] = c[d.k] === v && !['bloat', 'burn', 'heavy'].includes(d.k) ? (num ? 0 : '') : v; render(); },
  'ci-feel': d => { const a = ciDraft().feel; const i = a.indexOf(d.v); i < 0 ? a.push(d.v) : a.splice(i, 1); render(); },
  'ci-save': () => { const c = clone(ciDraft()), date = c.date; delete c.date; c.sleepH = c.sleepH === '' ? '' : +c.sleepH; S.checkins[date] = c; ui.ci = null; persist(); toast('Check-in saved for ' + fmtDate(date)); render(); },
  'ci-open': d => { ui.ci = Object.assign({ date: d.d }, clone(S.checkins[d.d] || { bloat: 0, burn: 0, heavy: 0, bowel: '', energy: 0, sleepQ: 0, sleepH: '', stress: 0, feel: [], activity: '', note: '' })); render(true); },
  // foods
  'food-open': d => { ui.food.open = ui.food.open === d.id ? null : d.id; $('#foodlist').innerHTML = foodListHtml(); const el = document.querySelector('[data-act="food-open"][data-id="' + d.id + '"]'); if (el) el.focus({ preventScroll: true }); },
  'food-cat': d => { ui.food.cat = d.v; ui.food.open = null; render(); }, 'food-fit': () => { ui.food.fit = !ui.food.fit; render(); },
  'src-open': (d, el, e) => { e.preventDefault(); ui.srcTab = 'registry'; ui.srcKind = ''; if (ui.route !== 'sources') { ui.pendingSrc = d.id; go('sources'); } else { render(); scrollSrc(d.id); } },
  'src-tab': d => { ui.srcTab = d.v; render(); }, 'src-kind': d => { ui.srcKind = d.v; render(); },
  'copy-sql': async () => { try { await navigator.clipboard.writeText(SQL); toast('SQL copied'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#sql')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selected. Copy with your keyboard.'); } },
  // spices
  'sp-toggle': d => { const a = ui.spice.sel, i = a.indexOf(d.id); if (i >= 0) a.splice(i, 1); else if (a.length >= 4) { toast('Compare up to four at a time'); return; } else a.push(d.id); render(); },
  'sp-preset': d => { ui.spice.sel = d.v.split(','); render(); },
  'sp-tadka': () => { ui.spice.a = 'seed-mild'; ui.spice.b = 'seed-spicy'; render(); const el = $('#sp-a'); if (el) el.scrollIntoView({ block: 'center' }); },
  'bl-new': () => { ui.spice.draft = { name: '', fat: 'ghee', items: [['cumin', 1, 'tsp']] }; render(); }, 'bl-cancel': () => { ui.spice.draft = null; render(); },
  'bl-rm': d => { ui.spice.draft.items.splice(+d.i, 1); render(); },
  'bl-save': () => { const d = ui.spice.draft; const b = { id: uid(), name: (d.name || '').trim() || 'My blend', fat: d.fat, items: d.items.filter(i => i[1] > 0) }; S.saved.blends.push(b); ui.spice.draft = null; ui.spice.b = b.id; persist(); toast('Blend saved'); render(); },
  'bl-del': d => { S.saved.blends = S.saved.blends.filter(b => b.id !== d.id); persist(); render(); },
  'bl-adopt': d => { const b = DOSHA_BLENDS[d.d]; const items = b.items.filter(([id]) => foodCheck(FOOD[id], S.profile).ok); S.saved.blends.push({ id: uid(), name: b.name, fat: foodCheck(FOOD.ghee, S.profile).ok ? 'ghee' : 'oil', items }); persist(); toast('Saved to your blends'); },
  // analyzer
  'an-run': () => { const t = ($('#an-text') || {}).value || ui.anText || ''; ui.anText = t; ui.photo = null; if (!t.trim()) { toast('Type a dish or some ingredients first'); return; } if (!startAnalysis(t)) toast('No ingredients recognised. Try plain names such as potato, dal, paneer.'); render(); },
  'an-clear': () => { ui.an = null; ui.anText = ''; render(); },
  'an-dish': d => { const dd = DISH[d.id]; ui.anText = dd.name; ui.an = { name: dd.name, dishId: dd.id, items: dd.ing.map(([id, qty, unit]) => ({ id, qty, unit, assumed: true })), method: dd.method, water: dd.water, portion: 'regular', serves: 2, unknown: [], usedPreset: true }; render(); },
  'an-rm': d => { ui.an.items.splice(+d.i, 1); if (!ui.an.items.length) ui.an = null; render(); },
  'an-portion': d => { ui.an.portion = d.v; render(); },
  'an-log': () => { const a = ui.an; ui.jf = null; const j = jfDraft(); Object.assign(j, { name: a.name, dishId: a.dishId, items: clone(a.items).map(i => ({ id: i.id, qty: i.qty, unit: i.unit })), serves: a.serves, portion: a.portion, fromPhoto: a.fromPhoto }); go('journal'); },
  'an-fav': () => { const a = ui.an; S.saved.meals.push({ id: uid(), name: a.name, dishId: a.dishId, items: a.items.map(i => ({ id: i.id, qty: i.qty, unit: i.unit })), serves: a.serves, method: a.method, water: a.water }); persist(); toast('Saved to your regular meals'); },
  'meal-analyze': d => { dishToAn(d.id); go('analyzer'); },
  'meal-log': d => { const dd = DISH[d.id], ad = adaptDish(dd, S.profile); ui.jf = null; const j = jfDraft(); Object.assign(j, { name: dd.name, dishId: dd.id, items: ad.items.concat(ad.staple ? STAPLES[ad.staple].ing.map(([id, q, u]) => ({ id, qty: q * 2, unit: u })) : []), serves: 2, slot: d.slot || j.slot }); go('journal'); },
  // planner
  'plan-new': () => { const P = S.profile; const off = S.plan ? (S.plan.off || 0) + 1 : 0; S.plan = generatePlan(P, currentFocus(S), seasonFor(P), S.meals, off); S.plan.off = off; persist(); toast('Week built'); render(); },
  'plan-swap': d => { const P = S.profile, day = S.plan.days[+d.i], pool = rankDishes(d.s, P, currentFocus(S), seasonFor(P), S.meals).map(r => r.dish.id).filter(id => !Object.entries(day).some(([s, v]) => s !== d.s && v === id)); if (pool.length < 2) { toast('Nothing else fits this slot'); return; } day[d.s] = pool[(pool.indexOf(day[d.s]) + 1) % pool.length]; persist(); render(); },
  'plan-grocery': () => { ui.grocery = !ui.grocery; render(); },
  // journal
  'jf-set': d => { jfDraft()[d.k] = d.v; render(); },
  'jf-after': d => { const a = jfDraft().after; a[d.k] = a[d.k] === +d.v ? 0 : +d.v; render(); },
  'jf-sym': d => { const a = jfDraft().after.symptoms, i = a.indexOf(d.v); i < 0 ? a.push(d.v) : a.splice(i, 1); render(); },
  'jf-fav': d => { const m = S.saved.meals.find(x => x.id === d.id); if (!m) return; const j = jfDraft(); Object.assign(j, { name: m.name, dishId: m.dishId, items: clone(m.items), serves: m.serves || 2 }); render(); },
  'jf-edit-items': () => { const j = jfDraft(); ui.anText = j.name; ui.an = { name: j.name, dishId: j.dishId, items: clone(j.items).map(i => Object.assign({ assumed: false }, i)), method: j.dishId && DISH[j.dishId] ? DISH[j.dishId].method : 'saute', water: j.dishId && DISH[j.dishId] ? DISH[j.dishId].water : 'semi', portion: j.portion, serves: j.serves || 2, unknown: [], fromPhoto: j.fromPhoto }; go('analyzer'); },
  'jf-reset': () => { ui.jf = null; render(); },
  'jf-save': () => { const j = jfDraft(); const nameEl = $('#jf-name'); if (nameEl && nameEl.value !== j.name) CHG['jf-name'](nameEl.value); if (!j.name.trim()) { toast('Say what you ate first'); return; } const has = j.after.comfort || j.after.energy || j.after.enjoy || j.after.symptoms.length; const m = { id: j.editId || uid(), date: j.date, time: j.time, slot: j.slot, name: j.name.trim(), dishId: j.dishId, items: j.items && j.items.length ? j.items.map(i => ({ id: i.id, qty: i.qty, unit: i.unit })) : null, serves: j.serves || 2, portion: j.portion, after: has ? clone(j.after) : null, note: j.note }; const i = S.meals.findIndex(x => x.id === m.id); i < 0 ? S.meals.push(m) : S.meals[i] = m; S.meals.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))); ui.jf = null; persist(); toast('Meal saved'); render(); },
  'j-edit': d => { const m = S.meals.find(x => x.id === d.id); if (!m) return; ui.jf = Object.assign({}, clone(m), { editId: m.id, after: Object.assign({ comfort: 0, energy: 0, enjoy: 0, symptoms: [] }, clone(m.after || {})) }); render(true); },
  'j-fav': d => { const m = S.meals.find(x => x.id === d.id); if (!m) return; if (S.saved.meals.some(x => x.name === m.name)) { toast('Already in your regular meals'); return; } S.saved.meals.push({ id: uid(), name: m.name, dishId: m.dishId, items: clone(m.items || []), serves: m.serves || 2 }); persist(); toast('Saved to your regular meals'); render(); },
  'j-del': d => { if (ui.confirm !== 'j' + d.id) { ui.confirm = 'j' + d.id; toast('Select Delete again to remove that entry'); return; } S.meals = S.meals.filter(x => x.id !== d.id); ui.confirm = null; persist(); render(); },
  'j-more': () => { ui.jShow += 30; render(); },
  trend: d => { ui.trend = +d.v; render(); },
  // settings
  export: async () => { const text = JSON.stringify({ app: 'Tridosha', exported: new Date().toISOString(), versions: VERSIONS, data: S }, null, 2); if (caps.downloads) { try { await caps.downloads.save({ filename: 'tridosha-export-' + todayStr() + '.json', data: text }); toast('Export saved'); return; } catch (e) { if (e && e.code === 'declined') return; } } ui.exportText = text; render(); const el = $('#export-text'); if (el) { el.focus(); el.select(); } },
  'wipe-ask': () => { ui.confirm = 'wipe'; render(); }, 'confirm-no': () => { ui.confirm = null; render(); },
  'wipe-yes': async () => { await wipeAll(); ui.exportText = null; toast('All your data has been deleted'); go('home'); }
};
const CHG = {
  pf: (v, d) => { pfDraft()[d.k] = v; render(); },
  'pf-consent': (v, d, el) => { pfDraft().health.consent = el.checked; render(); },
  'pf-health': (v, d) => { pfDraft().health[d.k] = v; },
  'vk-d': (v, d) => { const a = vkDraft().ans[d.id]; if (a) a.d = +v; },
  'ci-date': v => { if (v) ACT['ci-open']({ d: v }); },
  'food-d': v => { ui.food.dosha = v; ui.food.open = null; render(); },
  'sp-dish': v => { ui.spice.dish = v; render(); }, 'sp-ab': (v, d) => { ui.spice[d.k] = v; render(); },
  'bl-fat': v => { ui.spice.draft.fat = v; }, 'bl-q': (v, d) => { ui.spice.draft.items[+d.i][1] = Math.max(0, +v || 0); },
  'bl-add': v => { if (!v) return; const f = FOOD[v]; ui.spice.draft.items.push([v, f.def[0], f.def[1]]); render(); },
  'an-q': (v, d) => { const it = ui.an.items[+d.i]; it.qty = Math.max(0, +v || 0); it.assumed = false; render(); },
  'an-u': (v, d) => { const it = ui.an.items[+d.i]; it.unit = v; it.assumed = false; render(); },
  'an-add': v => { if (!v) return; const f = FOOD[v]; ui.an.items.push({ id: v, qty: f.def[0], unit: f.def[1], assumed: true }); render(); },
  'an-serves': v => { ui.an.serves = clamp(Math.round(+v) || 1, 1, 12); render(); },
  'an-opt': (v, d) => { ui.an[d.k] = v; render(); },
  photo: (v, d, el) => { const file = el.files && el.files[0]; el.value = ''; photoEstimate(file, d.to); },
  jf: (v, d) => { jfDraft()[d.k] = v; },
  'jf-name': v => { const j = jfDraft(); j.name = v; const r = parseRecipe(v); j.dishId = r.dish ? r.dish.id : null; j.items = v.trim() ? r.items.map(i => ({ id: i.id, qty: i.qty, unit: i.unit })) : null; j.serves = 2; j.fromPhoto = false; render(); }
};
const INP = {
  pf: (v, d) => { pfDraft()[d.k] = v; }, 'pf-health': (v, d) => { pfDraft().health[d.k] = v; },
  ci: (v, d) => { ciDraft()[d.k] = v; }, jf: (v, d) => { jfDraft()[d.k] = v; },
  'food-q': v => { ui.food.q = v; ui.food.open = null; $('#foodlist').innerHTML = foodListHtml(); },
  'an-text': v => { ui.anText = v; }, 'bl-name': v => { ui.spice.draft.name = v; }
};
function scrollSrc(id) { const el = document.getElementById('src-' + id); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('focus'); } }
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = ACT[el.dataset.act]; if (fn) { if (!/^(vk-del|j-del|wipe)/.test(el.dataset.act) && ui.confirm && ui.confirm !== 'wipe') ui.confirm = null; fn(el.dataset, el, e); } });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el.value, el.dataset, el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el.value, el.dataset, el); });
document.addEventListener('submit', e => e.preventDefault());
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.id === 'an-text') ACT['an-run'](); });
window.addEventListener('hashchange', () => { closeSheet(); readRoute(); if (ui.route === 'home') ui.obOpen = false; render(true); if (ui.pendingSrc) { scrollSrc(ui.pendingSrc); ui.pendingSrc = null; } });
boot();
