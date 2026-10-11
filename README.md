# Tridosha

Personalized Ayurvedic wellness tracker: Prakriti (baseline) and Vikriti (current state) assessments, a sourced food and spice database, a recipe analyzer, meal ideas, a weekly planner, a journal and trends.

Educational only. It does not diagnose, treat or measure anything in the body. Every food classification is provisional and has not been checked against a printed edition.

## Two builds

| Build | File | Saves to |
| --- | --- | --- |
| Hosted site | `docs/index.html` | A Supabase database: no sign-in, several profiles per browser |
| Single file | `tridosha.html` | The browser's local storage |

## Set up the hosted site

1. **Create a Supabase project** at supabase.com (the free tier is enough).
2. **Create the tables.** In the project's SQL editor, paste and run `supabase/migrations/0001_init.sql`. It creates `profiles` and `documents`, turns on row-level security so each visitor reaches only their own rows, caps each at 12 profiles, and adds the function behind "Delete all profiles".
3. **Connect the site.** In Project Settings → API, copy the project URL and the `anon` public key into `docs/config.js`. The anon key is designed to be public; never put the `service_role` key there.
4. **Publish.** In this repository's Settings → Pages, choose "Deploy from a branch", branch `main`, folder `/docs`. The site appears at `https://<user>.github.io/Tridosha/`.
5. **Turn on anonymous sign-ins.** In Supabase → Authentication → Sign In / Providers, enable "Allow anonymous sign-ins". The site has no sign-in screen; it uses this to give each browser its own private space. With it off, the site still works but saves to the browser only.

Until step 3 is done the site runs in demo mode and saves to the browser only.

Anonymous sign-ins are rate-limited per IP address (30 an hour by default), and Supabase recommends adding a CAPTCHA under Authentication → Attack Protection if the site gets abused.

### How profiles work

- There is no sign-up. The first visit from a browser creates an anonymous Supabase user for it, silently.
- That browser can hold up to 12 profiles (for example one per family member). Each profile has its own questionnaire results, check-ins, meals, blends and weekly plan.
- Data is stored as JSON documents in `documents`, keyed by profile: `profile`, `prakriti`, `vikriti`, `saved`, `plan`, and month buckets `meals-YYYY-MM` and `checkins-YYYY-MM`.
- Users can export a profile's data, delete it, delete a profile, or delete everything.
- Profiles are tied to the browser: they cannot be opened from another device, and clearing the site's browser data makes them unreachable.

The photo-to-ingredients estimate is not available on the hosted site.

## Files

| File | Contents |
| --- | --- |
| `00-head.html` | Title, fonts, styles and page shell |
| `10-data.js` | Source registry, foods, questionnaires, dishes |
| `20-engine.js` | Scoring, recipe parser, dish rules, recommendations (no DOM) |
| `30-core.js` | State, storage, rendering helpers, charts |
| `40-pages.js`, `45-pages2.js` | The pages |
| `50-actions.js` | Sources page, settings, event handlers, start-up |
| `60-supabase.js` | Hosted build only: accounts, profiles, database storage |
| `supabase/migrations/0001_init.sql` | Tables, row-level security, account deletion |
| `docs/` | Built hosted site and its `config.js` |
| `tridosha.html` | Built single-file page |

## Build

```sh
./build.sh
```

Run it after changing any source file; it rebuilds both pages.

The Postgres schema for a Next.js and Supabase port is in the app under Sources and method, Build blueprint.
