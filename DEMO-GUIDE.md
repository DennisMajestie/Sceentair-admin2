# Vessa Admin - Client Demo Guide

Everything below was verified against the local stack on 10 Nov 2026: all 43 routes render, zero console errors, zero horizontal overflow, backend and frontend running.

- Frontend: http://localhost:4200 (Angular 20)
- Backend: http://localhost:3000/api/v1 (NestJS + Postgres, DB `seentair_dev`)
- Login: `owner@seentair.test` / `Password123!` (role `business_owner_admin`)
- Screenshots of every page: `../screenshots/guide/*.png`, machine report in `../screenshots/guide/report.json`

---

## 1. Pre-flight runbook (do this 15 minutes before the call)

### 1.1 Database

Postgres must be listening on `5432`, database `seentair_dev`, user `mac`. If the API starts and every page is empty, this is the first thing to check.

### 1.2 Backend

```powershell
cd "C:\Users\charl\Downloads\sentair-fashion\Sentair Limited\services\api"
npm run migration:run        # safe/idempotent; required for production_batches.cancelled_at
node dist/main.js            # port 3000
```

If port 3000 is already taken by an old instance, kill it first:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

Health checks (in a second terminal):

```powershell
curl.exe -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"owner@seentair.test\",\"password\":\"Password123!\"}"
```

- Expect an `accessToken`.
- `GET /api/v1/audit-log/verify` must return `{"total":92,"valid":92,"broken":0,...}`. If `broken > 0`, the demo chain integrity story is dead - investigate before the call.

### 1.3 Frontend

```powershell
cd C:\Users\charl\vessa-re\app
npx ng serve --port 4200
```

Wait for `Local: http://localhost:4200/`. The first compile takes ~45 s.

Optional smoke test before the client joins (rewrites all 43 screenshots and prints `OVERFLOW` if any page breaks):

```powershell
node guide-shots.mjs
```

### 1.4 Demo hygiene

- Sign in once and stay in the tab. Do **not** hard-refresh (F5) during the demo: the access token lives in memory (15 min) and a reload relies on the refresh cookie. Rapid reloads get throttled and you land on `/signin`.
- Navigate with the sidebar or the `Ctrl/Cmd+K` command palette, never the address bar.
- Use light mode. The topbar toggles dark mode if the client asks; it is polished, but all screenshots are light.
- `index.html` hardcodes `http://localhost:3000/api/v1`. The Render production URL is unreachable, so the local stack **is** the demo.
- Close Slack/Teams notifications.

---

## 2. Suggested 20-minute demo narrative

### Opening (1 min)

Sign in on `/signin`. Point out: branded split layout, password visibility toggle, error states, "remember me".

### 2.1 Dashboard (3 min)

1. **Overview** (`Dashboard > Overview`, H1 "Welcome back, <first name>")
   - Sales KPIs, revenue trend, recent orders, top sellers, stock alerts, recent activity.
   - Talking point: one screen answers "how is the business doing today".
   - Note: this page is an in-progress refactor (KPI row moved from stock counts to sales/open orders). It builds and renders; do not switch branches now.
2. **Activity** - audit-derived event feed, newest first.
3. **Alerts** - operational alerts (low stock, failed payments, approvals).

### 2.2 Orders (4 min)

1. **All orders** - filter by status/channel, open an order drawer, walk through line items, customer, payment, fulfilment, status actions.
2. **Board** - kanban across the order lifecycle; the visual "wow" moment for operations.
3. **Returns** - RMA queue and resolution (currently empty; narrate the flow, or create one from an order drawer if you want a live action).
4. **Deliveries** - shipment list, tracking, cost, create delivery.
5. **Custom orders** - bespoke/made-to-order requests.

### 2.3 Products (3 min)

1. **Product catalog** - 19 seeded products, search/filter, category chips, product editor with media, pricing, variants, stock.
2. **Batches** - production batches per SKU with yield/efficiency.
3. **Review moderation** - approve/reject customer reviews (empty; narrate).

### 2.4 Warehouse (3 min) - strongest data in the system

1. **Inventory** (Stock ledger) - 56 tracked items, filter by type, open an item for its audited movement history; every movement is append-only.
2. **Stock summary** - 60 per-location cards across finished goods and raw materials (this page used to be labelled "Locations"; sidebar now matches the page title).
3. **Cycle counts** - scheduled physical counts and reconciliation.

### 2.5 Production (2 min)

1. **Production queue** - batches by stage: Production Planned, Cutting, Sewing, Finishing, Quality Check; advance stage, cancel.
2. **Tech packs** - measurements, cutting efficiency, yield per colourway.
3. **Floor kiosk** - full-screen station for the factory floor; hand this to a machinist, not a manager. (Empty until batches exist; create a batch in the queue first if you want to show it.)

### 2.6 Purchasing (1 min)

Material purchases (POs), Materials, Suppliers. These are empty in the seed data - frame it as "clean workspace, ready for your suppliers", or create a supplier live.

### 2.7 Customers, wholesale (3 min)

1. **Shoppers** - 6 customers, LTV/orders, customer detail drawer with order history and audit trail.
2. **Stockists** - wholesale retail partners (empty).
3. **Wholesale accounts** - 1 account with application/review flow and tier assignment.
4. **Wholesale tiers** - 1 pricing tier; show discount rules.

### 2.8 Marketing (2 min)

Campaigns, Coupon wallet, Coupon campaigns, Media library. All empty. Best live moment of the demo: create a coupon campaign and issue a coupon, then show it in the wallet. Ask the client for a campaign name and discount to make it theirs.

### 2.9 Finance (4 min) - the differentiator

1. **Accounting ledger** - revenue/expense entries (empty).
2. **Approval queue** - refunds, purchase orders, price changes waiting on the owner (empty).
3. **Audit log** - 93 entries, hash-chained. Scroll the cards, open one to show before/after state and payload, then show the stat row: **Total entries 92, Valid blocks 92, Broken blocks 0, Head hash**. This is the "nobody can quietly edit history" story.
4. **Partners** - equity partners and profit distributions (empty).

### 2.10 Analytics (3 min)

1. **Reports** - build a report from your own numbers.
2. **Sales** - who buys, what sells, when; 6 seeded orders.
3. **Stock health** - cover, low stock, value across 19 products.

### 2.11 Settings and Help (2 min)

1. **Team & roles** - 9 members, role/permission matrix. Show that a `wholesaler` sees far less than the owner.
2. **Security** - password, sessions, 2FA.
3. **Account / Company / Notifications** - forms, currency, branding, channels.
4. **Help center** - 4 searchable articles; **My tickets** - support ticket flow (empty).

### Express route, if you only get 5 minutes

Overview -> All orders -> Board -> Inventory -> Audit log -> Sales analytics -> Team & roles. That path shows money, operations, stock, trust and access control in five clicks.

---

## 3. Route-by-route cheat sheet

Sidebar label -> route -> page title. Use this if the client asks "where do I find X".

| Module | Sidebar | Route | Page title | Demo value | Seed data |
|---|---|---|---|---|---|
| Dashboard | Overview | `/dashboard/overview` | Welcome back, ... | KPI + trends | Mixed |
| Dashboard | Activity | `/dashboard/activity` | Activity | Audit feed | 93 events |
| Dashboard | Alerts | `/dashboard/alerts` | Alerts | Ops alerts | Derived |
| Products | Catalog | `/products/catalog` | Product catalog | Grid, editor | 19 |
| Products | Batches | `/products/batches` | Batches | Yield/efficiency | 1 |
| Products | Reviews | `/products/reviews` | Review moderation | Moderation | 0 |
| Orders | All orders | `/orders/all` | All orders | Drawer, status | 6 |
| Orders | Board | `/orders/board` | Board | Kanban | 6 |
| Orders | Returns | `/orders/returns` | Returns | RMA flow | 0 |
| Orders | Deliveries | `/deliveries` | Deliveries | Tracking | 0 |
| Orders | Custom orders | `/orders/custom` | Custom orders | Bespoke | 1 |
| Messages | Messages | `/messages` | Messages | Threads + send | 5 threads |
| Purchasing | Material purchases | `/purchasing/orders` | Material purchases | PO flow | 0 |
| Purchasing | Materials | `/purchasing/materials` | Materials | Raw materials | 0 |
| Purchasing | Suppliers | `/purchasing/suppliers` | Suppliers | Directory | 0 |
| Production | Queue | `/production` | Production queue | Stages | 0 |
| Production | Tech packs | `/production/tech-packs` | Tech packs | Measurements | 0 |
| Production | Floor kiosk | `/production/kiosk` | Production line | Floor station | 0 |
| Warehouses | Inventory | `/warehouses/inventory` | Inventory | Movement ledger | 56 |
| Warehouses | Stock summary | `/warehouses/locations` | Stock summary | Per-location | 60 |
| Warehouses | Cycle counts | `/warehouses/counts` | Cycle counts | Reconciliation | 1 |
| Customers | Shoppers | `/customers/shoppers` | Shoppers | CRM drawer | 6 |
| Customers | Stockists | `/customers/stockists` | Stockists | Wholesale retail | 0 |
| Wholesale | Wholesale accounts | `/wholesale/accounts` | Wholesale accounts | Approvals | 1 |
| Wholesale | Wholesale tiers | `/wholesale/tiers` | Wholesale tiers | Pricing tiers | 1 |
| Marketing | Campaigns | `/marketing/campaigns` | Campaigns | CRM campaigns | 0 |
| Marketing | Coupon wallet | `/coupons/wallet` | Coupon wallet | Customer coupons | 0 |
| Marketing | Coupon campaigns | `/coupons/campaigns` | Coupon campaigns | Issue coupons | 0 |
| Marketing | Media library | `/media` | Media library | Assets | 0 |
| Finance | Accounting ledger | `/accounting/ledger` | Accounting ledger | Revenue/expense | 0 |
| Finance | Approval queue | `/approvals` | Approval queue | Owner approvals | 0 |
| Finance | Audit log | `/audit/log` | Audit log | Hash chain | 93 |
| Finance | Partners | `/partners` | Partners | Equity/profit | 0 |
| Analytics | Reports | `/analytics/overview` | Reports | Report builder | Derived |
| Analytics | Sales | `/analytics/sales` | Sales | Who/what/when | 6 rows |
| Analytics | Stock health | `/analytics/stock` | Stock health | Cover/value | 19 rows |
| Settings | Account | `/settings/account` | Account | Profile | Form |
| Settings | Company | `/settings/company` | Company | Business config | Form |
| Settings | Team & roles | `/settings/team` | Team & roles | Permissions | 9 |
| Settings | Notifications | `/settings/notifications` | Notifications | Channels | Form |
| Settings | Security | `/settings/security` | Security | Sessions/2FA | 27 |
| Help | Help center | `/help/center` | How can we help? | Articles + search | 4 |
| Help | My tickets | `/help/tickets` | My tickets | Support | 0 |

---

## 4. Landmines and how to handle them

1. **Empty modules** (coupons, campaigns, media, partners, POs, materials, suppliers, production, returns, deliveries, tickets, stockists, ledger, approvals). All show polished empty states, not errors. Either pre-seed, create one record live, or say "clean workspace". Never open five empty modules in a row - it reads as "unfinished".
2. **Hard refresh = sign-out risk.** Token is in memory. Use in-app navigation. If you do land on `/signin`, sign in again calmly; nothing is lost.
3. **Silent API failures.** The global store swallows load errors (`.catch(() => {})`), so a failing endpoint looks like an empty page. If a page that should have data is empty, assume a backend problem and switch to a data-rich page (Inventory, Audit log, Sales) instead of debugging live.
4. **Local API only.** Do not demo the Render URL; it is dead. `index.html` points at `localhost:3000`.
5. **Dashboard refactor is uncommitted WIP** (`sections/dashboard/overview.*` + two new specs). It compiles and renders; just don't `git stash`/`checkout` during the call.
6. **Port collisions** are the most likely failure: two API instances on 3000 make responses flap. Run the pre-flight port check.
7. **Empty-state verbs.** "New" / "Create" buttons open drawers and forms even with no data, which is a good fallback demo beat when a list is empty.

---

## 5. Recovery checklist

| Symptom | Action |
|---|---|
| Page is blank / all lists empty | `curl http://localhost:3000/api/v1/audit-log/verify`; if it fails, restart the API |
| `Cannot GET ...` in console | Wrong endpoint path; check `app/src/app/core/*-api.service.ts` before editing anything live |
| Redirected to `/signin` | Sign in again; avoid reloads |
| `vite-error-overlay` covers the page | Frontend compile error; check the `ng serve` terminal, fix, wait for rebuild |
| 500 from `coupons/admin/campaigns` | Backend running stale `dist`; rebuild (`npm run build`) and restart |
| 500 from `production-batches` | Run `npm run migration:run`, restart API |
| Horizontal scrollbar | Known audit-log hash issue is fixed; anything new is a regression - capture a screenshot, fix after the call |
| Everything is slow | Close extra browser tabs; the dev build is not optimised |

---

## 6. What was fixed in this pass

- Normalised API response drift across 10 services (`materials`, `suppliers`, `marketing`, `wholesale`, `partners`, `help`, `coupons` and inventory) so bare arrays, `{data,total}` wrappers and grouped objects all hydrate correctly. Lists no longer crash on `.map` / `.filter` / `.length`.
- `wholesale/accounts` now maps the nested `user` and `tier` objects into `tierId`, `tierName`, `userId`; `wholesale/tiers` gets a `createdAt` fallback.
- `help/articles` maps `summary` -> `blurb`, joins `content: string[]`, and derives keywords so search/filter works.
- `coupons/mine` flattens `{available,used,expired,revoked}` and camelises both snake_case and camelCase payloads.
- Backend: added the missing `claim_kind` column mapping on `CouponCampaign`; applied the two pending migrations (`notification.read_at`, `production_batches.cancelled_at`); fixed a pre-existing TypeScript build error in `coupons.service.ts` (`customerCouponId` missing on `EligibleCouponView`). Backend rebuilt from source.
- Audit log overflow: long head hash no longer stretches the stat grid (`.stat` min-width + `overflow-wrap`).
- Sidebar labels now match page titles: Inventory, Stock summary, Material purchases, Accounting ledger, Reports, Stock health, Messages.
- Verified: 43/43 routes render, 0 console errors (one benign GSAP warning on Team & roles), 0 horizontal overflow.

---

## 7. Before you present

- [ ] Postgres up, API on 3000, frontend on 4200
- [ ] Login succeeds, `/audit-log/verify` shows 92/92/0
- [ ] `node guide-shots.mjs` ends with `DONE` and no `OVERFLOW`
- [ ] Decide which empty modules you will skip or fill live
- [ ] One browser tab, light mode, notifications off
- [ ] Keep this file and the `../screenshots/guide` folder open on a second screen
