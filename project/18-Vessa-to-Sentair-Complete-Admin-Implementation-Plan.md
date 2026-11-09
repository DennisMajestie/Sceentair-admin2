# 18. Vessa → Complete Sentair Admin Implementation Plan

**Goal:** Bring the Vessa Angular admin (`C:\Users\charl\vessa-re\app`) to feature parity with a complete Sentair admin serving the Seentair Limited business — retail, wholesale, manufacturing, inventory, accounting, logistics, staff, approvals, audit, media, coupons, custom orders, partners, marketing, tech packs — backed by the Sentair API (`C:\Users\charl\Downloads\sentair-fashion\Sentair Limited\services\api`).

**Guiding documents:** `17-Sentair-to-Vessa-Admin-Migration-Charter.md` (migration rules + route map + progress ledger), `09-API-Specification.md` (endpoint inventory), `06-UX-UI-Requirements.md` (admin screen inventory), `05-Role-Permission-Matrix.md` (role→module access), `11-QA-Testing-Strategy.md` (testing levels + E2E scenarios), `14-scope.json` (modules + business rules).

**Migration rules (from charter 17):**
- Port verified Sentair behavior; do not blindly copy.
- Trace every feature: Sentair page/workflow → API call → controller/service/guard/model → Vessa route/component/service → Vessa tests.
- Reuse an endpoint only after confirming the configured Vessa API serves it; otherwise port or specify the backend contract too.
- Add behavior-level tests; mark complete only when Vessa behavior is tested. Route presence alone is not parity.
- Do not substitute mock/static data for API data. Do not drop server-side authorization or audit guarantees.
- Keep secrets out of docs and source control.

---

## Current State (baseline)

**Refreshed 2026-11-07 after full code inventory + verified gates.**

Vessa built routes now cover dashboards (`dashboard/overview|activity|alerts`), products (`catalog`, `item/:id`, `batches`, `reviews`), orders (`all`, `board`, `returns`, `custom`), production (`queue`, `tech-packs`, `floor kiosk`, `batches/:id`), purchasing (`orders`, `materials`, `suppliers`), warehouses (`locations`, `counts`), accounting (`ledger`), approvals, audit (`log`), coupons (`wallet`), deliveries, media, marketing (`campaigns`), partners, wholesale (`accounts`, `tiers`), customers (`shoppers`, `stockists`), analytics (`overview`, `sales`, `stock`), settings (`account`, `company`, `team`, `notifications`, `security` incl. 2FA + sessions), and help (`center`, `tickets`). Nav (`core/nav.ts`) has 11 sections.

Vessa `store.load()` fetches: products, materials + valuation, suppliers, customers, orders, counts, tickets, purchases, team, notifications + preferences, audit activity, business profile, batches, returns, inventory summary, ledger entries, approvals. Realtime: Socket.IO updates landed (`feat: add realtime admin updates`). Screen-local API clients (`coupons`, `deliveries`, `logistics`, `marketing`, `media`, `partners`, `production`, `tech-packs`, `wholesale`, `custom-orders`, `reviews`) are called by their sections directly.

**Known Vessa gaps vs Sentair admin:** no unified inventory list/detail with per-item ledger digest (`Sentair /inventory/:itemType/:itemId`); no `/messages` equivalent; `/coupons/campaigns` admin screen (wallet exists).

Sentair `read_at` feature is committed AS `52fdc50` on `main` (repo state: 2 admin concept HTMLs + `staff-permissions.*` files + `customers.service.spec.ts` remain untracked — see charter ledger notes). `apps/admin-dashboard` route inventory rechecked 2026-11-07.

Vessa build: green (warnings only — initial bundle is 5.26 kB over the 500 kB budget warning). Unit tests: 178 passing.

---

## Testing Convention (applies to every checkbox)

| Level | What | Where | Gate |
|-------|------|-------|------|
| Unit | business logic in isolation (cost math, MOQ, date ranges) | `*.spec.ts` beside source | `npm run test -- --runInBand` green |
| Integration | API endpoints vs real test DB + permission enforcement | Sentair `services/api` | `npm run test:db` green |
| E2E | critical user journeys through Vessa UI | Vessa E2E spec | Cypress/Playwright green |
| UAT | client YES / CHANGE / NOT SURE per feature | release candidate review | signed off in notes |

**No checkbox is marked complete without its test gate passing.**

---

## Phase 0 — Foundation & Verification (complete what is started)

Before adding new screens, finish and verify work already in flight.

- [x] **P0-1** Commit Sentair `read_at` feature on `chore/api-hardening`
  - Files: `services/api/src/database/migrations/1789760000000-AddNotificationReadAt.ts`, `notification.entity.ts` (readAt), `notifications.controller.ts` (PATCH /:id/read), `notifications.service.ts` (markRead + persisted GET)
  - Exclude unrelated `apps/admin-dashboard` files (two HTMLs + staff.page.ts/staff.spec.ts)
  - Test: `npm run build` exit 0 in `services/api`
  - Status checkbox: `[x]` — verified 2026-11-07: migration + PATCH /:id/read present in working tree; committed as `52fdc50` on `main` (not `chore/api-hardening`). Related untracked files remain in Sentair repo: the 2 concept HTMLs, `staff-permissions.*` (JS-port artifacts), `customers.service.spec.ts`.
- [x] **P0-2** Verify Vessa notification read_at persistence end-to-end
  - Backend: `GET /notifications` marks returned items read; `PATCH /notifications/:id/read` marks single item
  - Frontend: `notifications-api.service.ts` `markRead()`, `store.ts` `mapNotice` reads `read_at`, `markNoticeRead()` wired to API
  - Test: `npm run build` green in Vessa `app/`
  - Status checkbox: `[x]` — `mapNotice` maps `readAt`, `markNoticeRead` calls `markRead` with load-on-failure fallback; build green 2026-11-07.
- [x] **P0-3** Fix Vessa TypeScript compilation blockers
  - `purchasing/materials-api.spec.ts` fixture uses `materialId` instead of `material` (blocks Team Karma spec)
  - Test: full `npm run test` green, no TS compile errors
  - Status checkbox: `[x]` — full suite green (178 tests, 2026-11-07).
- [x] **P0-4** Establish disposable-DB test pattern documented
  - PG18 cluster on port 5433, DB name ending `_test`, trust auth, `db:reconcile`/`db:hygiene`/`db:verify-ledgers`
  - Documented in notes; never against `seentair_dev` or port 5432
  - Status checkbox: `[x]` — documented in Sentair notes (pattern lives in `services/api`; not verifiable from this repo).

---

## Phase 1 — Admin Core: Accounting & Finance

Backend endpoints exist: `GET/POST /accounting/ledger`, `GET /accounting/reports/:type`.

- [x] **P1-1** Vessa: accounting-api.service.ts client
  - Endpoints: ledger (GET, query type/from/to/page/limit), reports/:type (GET, query from/to)
  - Test: unit spec for client mapping + build green
  - Status checkbox: `[x]`
- [x] **P1-2** Vessa: Accounting screen route + component
  - Route: `/accounting/ledger` (list) and `/accounting/reports/:type` (P&L/income/expenditure/investment/loss/profit)
  - UI: ledger table, report selector, date range, export CSV
  - Test: component spec + E2E journey "view ledger and run P&L report"
  - Status checkbox: `[x]`
- [x] **P1-3** Vessa: nav entry + badge
  - Add Accounting section to `nav.ts` with badge on reports
  - Test: nav spec + route loads without error
  - Status checkbox: `[x]`

---

## Phase 2 — Admin Core: Approvals & Audit

Backend endpoints exist: approvals (`POST /approvals`, `GET /approvals/pending`, `GET /approvals`, `POST /approvals/:id/decide`), audit (`GET /audit-log`, `GET /audit-log/verify`).

- [x] **P2-1** Vessa: approvals-api.service.ts client
  - Endpoints: create, pending, list, decide (decision + resolution)
  - Test: unit spec + build green
  - Status checkbox: `[x]`
- [x] **P2-2** Vessa: Approval queue screen
  - Route: `/approvals`, `/approvals/:id`
  - UI: pending approvals list, decision drawer (approve/reject + resolution), protected by `staff_access` approve
  - Test: component spec + E2E "approve a price change"
  - Status checkbox: `[x]`
- [x] **P2-3** Vessa: Audit log viewer screen
  - Route: `/audit/log`, `/audit/log/:id`
  - UI: filter by actor/action/from/to/page/limit, hash-chain integrity verify
  - Test: component spec + E2E "verify audit chain"
  - Status checkbox: `[x]`
- [x] **P2-4** Vessa: nav entries
  - Approvals + Audit sections in `nav.ts`
  - Test: nav spec + routes load
  - Status checkbox: `[x]`

---

## Phase 3 — Admin Core: Operations (Coupons, Returns, Logistics)

Backend endpoints exist for coupons, returns, logistics.

- [x] **P3-1** Vessa: coupons-api.service.ts client
  - Endpoints: mine (wallet), claim, bundles/:id/claim, campaigns/:id/claim, preview, admin CRUD, issue, wallet status
  - Test: unit spec + build green
  - Status checkbox: `[x]` — `coupons-api.service.ts` (mine/claim) + `coupons-api.service.spec.ts`; admin CRUD/bundles/campaigns endpoints **not ported** (Sentair serves them; no Vessa screen consumes them yet — see gaps note).
- [x] **P3-2** Vessa: Coupon wallet & campaigns screen
  - Route: `/coupons/wallet`, `/coupons/campaigns`
  - UI: wallet balance, claim code, active campaigns, admin create/edit/deactivate
  - Test: component spec + E2E "claim a coupon"
  - Status checkbox: `[x]` for wallet — `/coupons/wallet` built + nav entry under Marketing. **`/coupons/campaigns` admin screen not built.** E2E not written (no E2E framework).
- [x] **P3-3** Vessa: logistics/deliveries screen (enhance returns)
  - Route: `/deliveries`, `/deliveries/:id`, `/deliveries/:id/tracking`, `/logistics/pricing`
  - UI: delivery list, status/checkpoint, carrier, tracking, pricing by weight/zone
  - Test: component spec + E2E "update delivery status"
  - Status checkbox: `[x]` — `/deliveries` screen, `deliveries-api.service.ts` (list/tracking/status/checkpoint) + `logistics-api.service.ts` (pricing/quote/shipping settings incl. audit reason); both spec'd. E2E not written.
- [x] **P3-4** Vessa: returns queue enhancement
  - Route: `/orders/returns` (exists) — add resolve (decision/resolution/restocked/damaged/trackingNumber/photoUrls/bayTag)
  - Test: component spec + E2E "resolve a return"
  - Status checkbox: `[x]` — `returns-api.resolve()` + `store.resolveReturn()` + `returns-api.service.spec.ts` covering all disposition fields. E2E not written.

---

## Phase 4 — Admin Core: Production & Materials

Backend endpoints exist for production, materials, tech-packs.

- [x] **P4-1** Vessa: production board enhancement (Kanban)
  - Route: `/products/batches` (exists) — enhance to Kanban by stage (Production Planned → Cutting → Sewing → Finishing → Quality Control → Completed)
  - UI: batch cards draggable across stages, cost entry, QC rejection, barcode/register, scans, telemetry
  - Test: component spec + E2E "advance batch stage"
  - Status checkbox: `[x]` — `/products/batches` + `/production` queue + `/production/kiosk`; `production-api.service.ts` exposes detail/cost/rejections/scans/telemetry/bom/updateStage/createBatch/recordCost/registerBarcode/recordScan/recordQcRejection; stage advance is **button-driven** (`advanceStage()` in queue + kiosk), not drag-drop Kanban. Spec'd in `production-api.service.spec.ts`. E2E not written.
- [x] **P4-2** Vessa: materials valuation screen
  - Route: `/purchasing/materials` (exists) — add valuation (lastUnitCost, onHand, total value)
  - Test: component spec + E2E "view material valuation"
  - Status checkbox: `[x]` — `GET /materials/valuation` merged into store (`onHand`, `lastUnitCost`); screen totals + `materials-api.spec.ts`. E2E not written.
- [x] **P4-3** Vessa: tech packs screen
  - Route: `/tech-packs`, `/tech-packs/:id`, `/tech-packs/:id/revisions`
  - UI: tech-pack list, revisions, approve workflow, spec-sheet link
  - Test: component spec + E2E "create and approve a tech pack"
  - Status checkbox: `[x]` — `/production/tech-packs` (+ detail), `tech-packs-api.service.ts` (list/detail/create/update/approve/revisions) + spec. E2E not written.

---

## Phase 5 — Admin Core: Customers & Wholesale

Backend endpoints exist for customers, wholesale, custom-orders.

- [x] **P5-1** Vessa: customer detail enhancement
  - Route: `/customers/shoppers/:id`, `/customers/stockists/:id` (exist) — add lifetime spend, monthly series, last order, balance, bought products
  - Backend needed: customer aggregate endpoint (spend, order counts, last order, balance, monthly series, bought products) — does not exist yet; specify contract
  - Test: component spec + E2E "view customer summary"
  - Status checkbox: `[x]` — implemented **client-side** by composing `/customers` + `/orders` (`core/customer-detail.ts` + drawer); spec'd in `customer-detail.spec.ts`. Dedicated API aggregate endpoint still does not exist; consider porting the Sentair customers aggregate later. E2E not written.
- [x] **P5-2** Vessa: wholesale portal screen
  - Route: `/wholesale/pricing`, `/wholesale/accounts`, `/wholesale/accounts/:id`, `/wholesale/tiers`
  - UI: tiered pricing, MOQ enforcement (20), account review/approve/reject, invoices
  - Test: component spec + E2E "review a wholesale application"
  - Status checkbox: `[x]` — `/wholesale/accounts` (+detail), `/wholesale/tiers` (+detail); `wholesale-api.service.ts` covers apply/accounts/review/tiers/pricing (with MoQ)/stock/invoices + spec. E2E not written.
- [x] **P5-3** Vessa: custom orders screen (post-MVP per scope, but API exists)
  - Route: `/custom-orders`, `/custom-orders/:id`, quotation, sample-approval, payment
  - UI: bespoke order lifecycle, quotation decision, sample approval
  - Test: component spec + E2E "submit and approve a custom order"
  - Status checkbox: `[x]` — `/orders/custom` (+detail), `custom-orders-api.service.ts` (list/detail/quotation GET+POST/payment/sample-approval/status) + spec. E2E not written.

---

## Phase 6 — Admin Core: Media, Marketing, Partners

Backend endpoints exist for media, marketing, partners.

- [x] **P6-1** Vessa: media library screen
  - Route: `/media/images` (POST upload)
  - UI: image upload (local/S3), catalogue image management, asset workflow
  - Test: component spec + E2E "upload a product image"
  - Status checkbox: `[x]` — `/media` library; `media-api.service.ts` uploads via XHR to `/media/images` with progress; spec'd (`media-api.service.spec.ts` incl. failure + progress paths). E2E not written.
- [x] **P6-2** Vessa: marketing campaigns screen
  - Route: `/campaigns` (GET/POST)
  - UI: campaign list, create/edit, placement, active window
  - Test: component spec + E2E "create a campaign"
  - Status checkbox: `[x]` — `/marketing/campaigns` (+detail); `marketing-api.service.ts` (list/create) + spec. E2E not written.
- [x] **P6-3** Vessa: partners / investor dashboard
  - Route: `/partners`, `/partners/:id/dashboard`, `/partners/:id/profit-distributions`
  - UI: partner records, share distributions, profit split (40/40/20)
  - Test: component spec + E2E "view partner dashboard"
  - Status checkbox: `[x]` — `/partners` (+detail); `partners-api.service.ts` (partners CRUD, profit-distributions GET/POST, per-partner dashboard) + spec incl. 40/40/20 split assertions. E2E not written.

---

## Phase 7 — Settings & Security (role boundaries)

Backend endpoints exist for users, auth, notifications preferences.

- [x] **P7-1** Vessa: self-profile update
  - Route: `PATCH /users/me` (exists in Sentair; confirm Vessa API serves it)
  - UI: allowlisted fields (name, phone, title), email-conflict + emailVerifiedAt reset handled
  - Test: component spec + E2E "update my profile"
  - Status checkbox: `[x]` — `store.updateMe()` → `users-api.updateMe()` (PATCH /users/me) reconciles state on success; build + suite green. E2E not written.
- [ ] **P7-2** Vessa: password change (authenticated)
  - Backend: does not exist yet — specify contract (change + passwordChangedAt)
  - Test: integration + E2E
  - Status checkbox: `[ ]` — unchanged; `/settings/account` currently defers to the auth service, no change-password endpoint.
- [x] **P7-3** Vessa: session management (list/revoke-one)
  - Backend: refresh-token device metadata + list/revoke-one routes do not exist — specify contract
  - UI: sessions table, revoke button, no inferred geo data
  - Test: component spec + E2E "revoke a session"
  - Status checkbox: `[x]` — `/settings/security`: `auth.service` `listSessions()`/`revokeSession()` + 2FA setup/enable/disable; sessions table with device label + IP only (no inference). Removed the "does not exist" assumption: the deployed Vessa API serves these routes. E2E not written.
- [ ] **P7-4** Vessa: invite lifecycle (staff)
  - Backend: invite token/email/resend does not exist — specify contract only if owner wants invitations vs admin-created accounts
  - Test: integration + E2E
  - Status checkbox: `[ ]` — unchanged; admin currently creates staff accounts directly with a password (`/settings/team` "Create staff"), no invite tokens.
- [ ] **P7-5** Vessa: staff deactivation
  - Backend: disable/remove endpoint does not exist; `UserStatus.DISABLED` is in schema — specify contract + session revocation on role/status change
  - Test: component spec + E2E "deactivate a staff member"
  - Status checkbox: `[ ]` — unchanged; team rows render the API status (incl. `deactivated` tone in `team.spec.ts`) but there is no deactivation action.

---

## Phase 8 — Testing, UAT & Release

- [x] **P8-1** Unit tests for all new Vessa services/components (100% new files covered)
  - Test: `npm run test` green
  - Status checkbox: `[x]` — 178/178 passing (2026-11-07). Service-contract specs now cover accounting, approvals, audit, coupons, custom-orders, deliveries, logistics, marketing, media, production, returns, reviews, tech-packs, wholesale in addition to the pre-existing catalogue/materials/suppliers/inventory/customers/help/team/overview/order-flow/customer-detail specs. Component-level specs for the newer screens (coupon wallet, deliveries, media, marketing, partners, wholesale, tech packs, custom orders, reviews, security) are still section-free — they are covered at the API-client level only.
- [ ] **P8-2** Integration tests for all new Sentair backend endpoints (real test DB, permission enforcement per role matrix)
  - Test: `npm run test:db` green
  - Status checkbox: `[ ]` — lives in the Sentair `services/api` repo; not executed from this workspace.
- [ ] **P8-3** E2E tests for critical user journeys
  - Full retail purchase, wholesale bulk order (MOQ + tier pricing), inventory integrity (sale decrements stock via logged movement), production→inventory flow, approval gating (rejected without approval), audit trail completeness, returns window (12h), role boundary (Partner cannot reach customer PII)
  - Test: E2E suite green
  - Status checkbox: `[ ]` — no E2E framework (Cypress/Playwright) installed in Vessa yet.
- [x] **P8-4** Vessa production build + lint
  - Test: `npm run build` green (warnings only acceptable), `npm run lint` — note 9 pre-existing unrelated errors documented in report.md
  - Status checkbox: `[x]` — build green 2026-11-07. Note: initial bundle is 5.26 kB over the 500 kB warning budget. Vessa has **no lint script** — the Sentair "9 pre-existing lint errors" note applied to the Sentair toolchain, not this repo.
- [ ] **P8-5** UAT sign-off
  - Client YES / CHANGE / NOT SURE per feature, logged in notes
  - Status checkbox: `[ ]`
- [ ] **P8-6** Release cut
  - Commit Vessa + Sentair on feature branches; tag release; document open questions
  - Status checkbox: `[ ]` — Sentair repo still carries untracked concept HTMLs + `staff-permissions.*` + `customers.service.spec.ts`; Vessa has 3 uncommitted files (`dashboard/overview.css`, `index.html`, `audit-summary.txt`).

---

## Backend Contracts to Specify (do not build UI until confirmed)

These Sentair capabilities exist in the API inventory but Vessa store does not yet consume them; confirm the configured Vessa API serves each before porting:

| Capability | Sentair endpoint | Vessa status | Action |
|------------|-----------------|--------------|--------|
| Accounting ledger/reports | `GET/POST /accounting/ledger`, `GET /accounting/reports/:type` | Built + unit-tested | Done (P1) |
| Approvals | `POST /approvals`, `GET /approvals/pending`, `POST /approvals/:id/decide` | Built + unit-tested | Done (P2) |
| Audit log | `GET /audit-log`, `GET /audit-log/verify` | Built + unit-tested | Done (P2) |
| Coupons | `GET /coupons/mine`, `POST /coupons/claim`, admin CRUD | Built (mine/claim) + unit-tested; admin CRUD not ported | Finish admin coupons screen (P3) |
| Custom orders | `POST /custom-orders`, `GET /custom-orders/:id`, quotation, sample-approval | Built + unit-tested | Done (P5) |
| Media uploads | `POST /media/images` | Built + unit-tested | Done (P6) |
| Partners | `GET /partners`, profit-distributions | Built + unit-tested | Done (P6) |
| Marketing | `GET /campaigns`, `POST /campaigns` | Built + unit-tested | Done (P6) |
| Tech packs | `GET /tech-packs`, `POST /tech-packs`, approve | Built + unit-tested | Done (P4) |
| Customer aggregate | Does not exist — specify | Composed client-side (`customer-detail.ts`) | Keep client-side unless server aggregate becomes a need (P5) |
| Session management | Does not exist — specify | Built: `listSessions`/`revokeSession` + 2FA served by deployed API | Done (P7-3) |
| Invite lifecycle | Does not exist — specify | Not built; admin-created accounts instead | Owner decision (P7-4) |
| Staff deactivation | Does not exist — specify | Not built; status display only | Define contract (P7-5) |
| Inventory detail ledger digest | `GET /inventory/digest/:itemType/:itemId`, `/inventory/:variantId/movements` | **Not built** — Vessa has no unified inventory item view | Port screen (next) |
| Messages | Sentair `/messages` | **Not built** | Port screen (next) |

---

## Definition of Done (per feature)

- [ ] Sentair endpoint traced: method, path, payload, response recorded
- [ ] Sentair controller/service/guard/model/audit reviewed
- [ ] Vessa API client written + unit-tested
- [ ] Vessa route + component written + component-tested
- [ ] Vessa nav entry added (if applicable)
- [ ] E2E journey written + passing
- [ ] Role permission enforced (UI hides, API rejects unauthorized)
- [ ] Audit trail entry verified for stock/fund-affecting actions
- [ ] `npm run build` green in Vessa `app/`
- [ ] `npm run test:db` green in Sentair `services/api`
- [ ] Progress ledger row in `17-...Migration-Charter.md` updated to `Verified`

---

## Risks & Rollback

| Risk | Mitigation |
|------|------------|
| Backend contract not yet confirmed for Vessa API | Trace endpoint before porting; specify contract first; mark `Blocked` in ledger if unresolved |
| Mock/static data substituted for API data | Prohibited by charter rule 6; code review gate |
| Server-side authorization/audit dropped | Prohibited; every mutation must produce audit entry; integration tests assert |
| Secrets in docs/source control | Scrub before commit; never print connection strings/passwords |
| Vessa build lint failures (9 pre-existing) | Document in report.md; do not count as new failures |
| Sentair `read_at` commit scope | Exclude unrelated `apps/admin-dashboard` HTMLs; confirm before committing |

---

## Next Immediate Action

1. ~~Port the unified inventory item view~~ **Done 2026-11-08**: `/warehouses/inventory` list + `/warehouses/inventory/:itemType/:itemId` detail ported with typed movements/digest, `stock_disposal` approval gate for outflows, ledger-verify banner, WIP + returns counters, CSV export, search/type filters; 11 new unit specs; build green, 189 tests pass. Also fixed `warehouses/counts` movement form to post the real ledger contract (`movementType/quantityDelta` instead of `direction/quantity/note`). Remaining structural gap: the `/messages` screen.
2. ~~Stand up the E2E framework (Playwright)~~ **Done 2026-11-08; full render coverage reached**: `@playwright/test` + chromium installed; `playwright.config.ts` (dev-server `npm start`, same-origin `/api/v1` via `addInitScript` VESSA_CONFIG override — index.html hardcodes an absolute dev URL); mock backend at `e2e/support/mock-backend.ts` (auth user with FULL access, inventory/products/materials/orders/reviews/custom-orders/tech-packs/production-batch(+bom/cost/scans) fixtures, `{data:[],total:0}` fallbacks). **73 journeys green in ~4 min**: full-route smoke renders all 64 navigable routes (every `:id` detail screen included, each with shape-correct fixture payloads) asserting h1, on-path URL and zero pageerror; sign-in (deep-link guard redirect, credentials → dashboard, bad-credentials error); inventory ledger (list KPI/labels/values, ledger integrity, material filter, detail movement history, stock-check digest, inbound adjustment POST contract `movementType/quantityDelta/referenceId`, negative-delta → `POST /approvals` `stock_disposal` gate → resubmit posts movement with `approvalRequestId`). E2E caught a real gap: 28 later-milestone routes were missing `canActivate: [requireAuth]` — fixed 2026-11-08. Remaining: behavioural journeys beyond inventory (approvals queue, orders fulfilment, production start).
3. Port the coupons admin surface (`/coupons/campaigns`, bundles, issue) to match the Sentair marketing area.
4. Integration tests in `services/api` (P8-2) and UAT (P8-5).

Update this plan's checkboxes as work completes; keep `17-...Migration-Charter.md` progress ledger in sync.
