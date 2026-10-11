# Tridosha

Personalized Ayurvedic wellness tracker: Prakriti (baseline) and Vikriti (current state) assessments, a sourced food and spice database, a recipe analyzer, meal ideas, a weekly planner, a journal and trends.

Educational only. It does not diagnose, treat or measure anything in the body. Every food classification is provisional and has not been checked against a printed edition.

## Files

| File | Contents |
| --- | --- |
| `00-head.html` | Title, fonts, styles and page shell |
| `10-data.js` | Source registry, foods, questionnaires, dishes |
| `20-engine.js` | Scoring, recipe parser, dish rules, recommendations (no DOM) |
| `30-core.js` | State, storage, rendering helpers, charts |
| `40-pages.js`, `45-pages2.js` | The pages |
| `50-actions.js` | Sources page, settings, event handlers, start-up |
| `tridosha.html` | Built single-file page |

## Build

```sh
./build.sh
```

Open `tridosha.html` in a browser. Outside Claude it saves to the browser's local storage; the photo estimate and file export need the Claude artifact runtime.

The Postgres schema for a Next.js and Supabase port is in the app under Sources and method, Build blueprint.
