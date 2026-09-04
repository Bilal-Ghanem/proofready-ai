# ProofReady AI

A polished, local-first MVP that helps small EU-facing organizations create an operational AI-literacy working file: AI use inventory, provider/deployer context, role-aware literacy action matrix, controls checklist, action plan, policy starter, and JSON/PDF export.

## Run

The app has no runtime dependencies.

```bash
cd proofready-ai
python3 -m http.server 4173
```

Open:

- `http://localhost:4173/launch.html` — private conversion landing page
- `http://localhost:4173/` — interactive product MVP
- `http://localhost:4173/validation/article4-checklist.html` — printable lead magnet

## Verify

```bash
npm test
npm run check
npm run smoke # requires Chrome and a running local server on port 4173
```

## MVP boundaries

- Data is stored in browser `localStorage`; there is no backend or account system.
- Export is JSON; the browser print flow provides PDF output.
- The completeness score, suggested modules and policy text are operational aids—not a legal assessment, certification or legal advice.
- The MVP now records organisation role, staff experience, literacy actions, completion dates, evidence references, and source/template version.
- A paid launch should add import and branded PDF output; encrypted cloud sync only if buyers demand it; and qualified legal review of public claims before launch.

## Files

- `launch.html` / `landing.css` — private conversion landing page and founding offers
- `index.html` — application shell and all workflow screens
- `styles.css` — responsive visual system and print styles
- `app.js` — UI state, local persistence, CRUD, export and navigation
- `core.js` — testable readiness, risk, training, action-plan and policy logic
- `tests/core.test.mjs` — unit tests for the core workflow
- `tests/browser-smoke.mjs` — dependency-free Chrome/CDP workflow smoke test
- `artifacts/proofready-demo.png` and `proofready-landing.png` — screenshots produced by the browser smoke test
- `validation/article4-checklist.html` — printable 15-item buyer lead magnet
- `validation/FOUNDING_OFFER.md` — paid-pilot scope, discovery script and validation gate
- `REPORT.md` — executive validation verdict, gate, economics summary and package index
- `validation/MARKET.md` — September 2026 regulation, market, buyer, competitor, substitute, demand, channel and failure analysis
- `validation/ECONOMICS.md` — explicit budgets, funnel assumptions, unit economics and 3/6/12-month scenarios
- `validation/PROSPECTS.csv` — 30 public-business prospects with qualification notes and personalised openers
- `validation/OUTREACH.md` — unsent research experiment, brand-only identity, form path, interview guide and tracking schema
- `validation/LANDING_COPY.md` — evidence-backed, non-certifying landing/sales copy
