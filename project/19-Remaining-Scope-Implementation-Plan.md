# 19. Remaining Scope — Value-Ordered Implementation Plan

**Goal:** Close the gap between what the PRD (`02-PRD.md`) requires and what the platform actually does, sequenced by business value rather than by module order.

**Basis:** PRD audit of 2026-11-16 against `services/api/src/modules/*`, the Sceentair admin (`C:\Users\charl\vessa-re\app`), and the storefront / wholesale-portal / partner-portal apps. All modules already built are listed in the audit; this document covers only what is missing, partial, or not live.

**Ordering rule:** every item is ranked by *value now × how much is already built*. Cheap things that unblock revenue or restore trust come first; large greenfield features that the business can operate without come last.

---

## Summary

| # | Item | Business value | Already built | Effort | Wave |
|---|------|----------------|---------------|--------|------|
| 1 | Fix purchasing "0 records" + data integrity pass | Restores trust in the whole admin | ~90% | 0.5–1 d | 1 |
| 2 | Go live: storefront + Paystack live keys | Retail revenue | 100% | 1–2 d | 1 |
| 3 | Go live: wholesale portal + domain | Wholesale revenue (the core channel) | 100% | 0.5–1 d | 1 |
| 4 | Go live: partner portal + domain | Investor visibility, no dev work left | 100% | 0.5 d | 1 |
| 5 | SMS + GIGL credentials and smoke test | Delivery updates actually reach customers | 100% | 0.5 d | 1 |
| 6 | WhatsApp messaging (outbound + inbound) | The channel Nigerian retail actually uses | 0% | 4–6 d | 2 |
| 7 | Live chat / in-platform conversations | Support without leaving the platform | 0% | 6–8 d | 2 |
| 8 | WIP visibility in inventory | Factory truth: what is mid-production | ~20% | 2–3 d | 2 |
| 9 | Payroll | Closes the accounting loop | 10% (ledger type) | 3–4 d | 2 |
| 10 | Production planning (suggested batch qty) | Less dead stock, fewer stockouts | 0% | 2–3 d | 2 |
| 11 | Product profitability report | Real per-SKU margin, not guesses | ~40% (cost data exists) | 2–3 d | 3 |
| 12 | Campaign ROI / marketing performance | Spend accountability | ~50% (attribution exists) | 2–3 d | 3 |
| 13 | Loyalty programme | Repeat purchase | 10% (campaign type only) | 4–6 d | 3 |
| 14 | Recommendations | AOV uplift | 0% | 2–3 d | 3 |
| 15 | POS / mall sales | Retail expansion | 0% | 10+ d | 4 (needs decision) |
| 16 | Quality sweep (failing specs, mojibake, copy) | Prevents silent regressions | — | 1 d | ongoing |

Waves: **1** = this week, revenue/trust blockers · **2** = next 3–4 weeks, operational depth · **3** = growth, once data is clean · **4** = strategic, decision required.

---

## Wave 1 — Revenue and trust (2–4 days total)

### 1. Fix purchasing "0 records" and run a data-integrity pass

**Why:** Material purchases shows `0 records · ₦0.00 total spent` while the factory obviously buys fabric. Until the ledger, stock and purchases agree, every KPI on the dashboard is suspect. This is the cheapest possible credibility win.

**Scope**
- Reproduce against production data: `GET /api/v1/materials/purchases` (admin: `src/app/sections/purchasing/orders.ts`, badge key `pos`, `store.pos()`). Determine whether the list is empty because (a) no `material_purchases` rows exist, (b) the query/date filter is wrong, or (c) the frontend maps the response to an empty array.
- Audit the related derivations in the same pass, since they share the material-purchase feed: dashboard "total spent", analytics expenditure, and the `purchasing` badge.
- Backfill any purchases that were recorded as raw-material stock adjustments instead of purchase rows (only with owner sign-off — these are money records).

**Acceptance**
- Material purchases lists every real purchase with correct totals and supplier attribution.
- Dashboard/analytics spend figures match the purchases list for the same period.
- A short note in the repo records what the root cause was, so the same data-entry mistake is not repeated.

**Effort:** 0.5–1 day. **Risk:** backfill touches financial history — needs explicit approval.

---

### 2. Go live: storefront + Paystack live keys

**Why:** The entire retail flow is coded and tested (`apps/storefront`: landing, shop, product, cart, checkout, order tracking, account, policies, reviews, coupons, guest checkout) but the business cannot take a naira until it is deployed with live keys.

**Scope**
- Deploy `apps/storefront` as its own Vercel project (SPA rewrite to `index.html`, `/api/*` rewrite to `https://seentair-backend.onrender.com` — same first-party-cookie fix the admin uses).
- Configure the API env: `PAYSTACK_SECRET_KEY` (live), webhook URL `https://seentair-backend.onrender.com/api/v1/orders/paystack/webhook`, and confirm the webhook signature check passes (`orders/paystack.service.ts`).
- Set the storefront's public base URL in platform settings so Paystack callbacks, SEO (`seo.service.ts`) and share links resolve.
- Smoke test the PRD flow end-to-end with a real card: discover → variant → cart → checkout → pay → confirmation → track → review after `DELIVERED`.

**Acceptance**
- A live Paystack payment produces a paid order, a `payment` row, a stock movement and a confirmation view.
- Guest checkout works without an account (`16-Guest-Checkout-Specification.md`).
- Failures (declined card, webhook retry) leave the order in a coherent state and are visible in admin.

**Effort:** 1–2 days including DNS. **Depends on:** Paystack business account + webhook allow-list.

---

### 3. Go live: wholesale portal + domain

**Why:** Wholesale is the primary revenue channel (MOQ 20, tiers, invoices, tracking, custom design submission — all coded in `apps/wholesale-portal`). It needs its own hostname so buyers can be onboarded.

**Scope**
- Deploy `apps/wholesale-portal` (same Vercel pattern), set `wholesale.moq` config, and point the portal's API base at the same-origin rewrite.
- Walk one full buyer journey on production: apply → admin approval (`/wholesale/accounts`) → tier assignment → catalogue with tier pricing → bulk order clearing MOQ → invoice → tracking → reorder → custom design submission.
- Verify an under-MOQ order is rejected server-side (it already is — `orders.wholesale.spec.ts`).

**Acceptance**
- A real stockist can apply, be approved, order and see the invoice without staff intervention beyond the approval.

**Effort:** 0.5–1 day. **Depends on:** decision on the wholesale subdomain.

---

### 4. Go live: partner portal + domain

**Why:** The portal is finished (`apps/partner-portal`: overview, investment, performance, inventory visibility, documents, reports, profit sharing, settings). Publishing it converts the 40/40/20 profit-split model from a document into something partners can see.

**Scope**
- Deploy, create the partner accounts, verify the permission matrix hides customer-facing data (`05-Role-Permission-Matrix.md`).
- Confirm profit distributions and documents render for a seeded partner.

**Acceptance:** a partner logs in and sees only their own investment, performance and documents.

**Effort:** 0.5 day.

---

### 5. SMS + GIGL credentials and smoke test

**Why:** Both integrations are built behind adapters and quietly no-op without keys, so nobody notices they are dead until a customer complains.

**Scope**
- `SMS_TERMII_API_KEY` + sender ID; confirm the SMS fires on `DELIVERED` and location updates (`orders.service.ts` calls `notificationsService.onOrderStatusChange`, preferences gate it).
- GIGL credentials + pickup address; create one real delivery and confirm the waybill comes back (`logistics.service.ts` → `GiglAdapter`), then a manual multi-leg delivery for interstate.
- Verify carrier failures fall back to the manual adapter instead of failing the order.

**Acceptance:** one real SMS and one real GIGL waybill produced from production.

**Effort:** 0.5 day. **Depends on:** Termii and GIGL accounts.

---

## Wave 2 — Operational depth (2–3 weeks)

### 6. WhatsApp messaging (two-way)

**Why:** The PRD puts WhatsApp alongside SMS as the customer communication channel, and orders `source` already treats WhatsApp as a first-class channel. Every status question currently goes to someone's personal phone.

**Scope**
- **Adapter:** `notifications/whatsapp.adapter.ts` mirroring `termii.adapter.ts`; use WhatsApp Cloud API with approved templates (`order_received`, `order_shipped`, `order_delivered`, `return_window_open`). Reuse the existing `NotificationChannel.WHATSAPP` enum and extend notification preferences with `channelWhatsapp`.
- **Outbound:** `onOrderStatusChange` sends the mapped template; log provider ref on the notification row.
- **Inbound:** webhook `POST /notifications/whatsapp/webhook` with signature verification; store incoming messages and route them into the conversation model built in item 7 (do not build a second inbox).
- **Admin UI:** channel toggle in `settings/notifications`, delivery state + failure reason on the notification row, and a WhatsApp badge beside SMS in the messages inbox.

**Acceptance**
- Status change → template delivered to a real handset → delivery receipt stored.
- Inbound reply appears in the admin conversation within a second (realtime gateway).
- Missing/invalid credentials surface as a visible "not configured" state, never as a silent success.

**Effort:** 4–6 days (template approval is the long pole, start it first). **Depends on:** WhatsApp Business account + verified number.

---

### 7. Live chat / in-platform conversations

**Why:** PRD §4.18. Today `/messages` is *outbound* notifications composed from orders (`sections/messages/inbox.ts` calls `notificationsApi.send`); there is no message entity, no inbound path, no history. That is fine for announcements and wrong for support.

**Scope**
- **Backend:** new `messaging` module — `conversation` (customer or guest, order link, channel: in-platform / whatsapp / sms / email, status, assignee) and `message` (direction, body, attachments via `media`, provider ref, read-by-staff/customer, timestamps). Realtime events extend `realtime.gateway.ts`; unread counts feed the existing badge keys.
- **Admin:** rebuild `sections/messages/inbox.ts` on the conversation API — thread list with unread, order context panel (status, items, returns), quick replies (the existing macros survive), internal notes, attachment upload, assignment.
- **Storefront / wholesale:** a lightweight chat widget and a "Messages" tab in account, both on the same conversation API.
- **Fallbacks:** WhatsApp/SMS replies append to the same conversation so staff see one thread per customer.

**Acceptance**
- Customer message → appears in admin live → staff reply → customer sees it → reopening the thread preserves history and read state.
- Order context links to `/orders/all/:id`; a return or delivery question is answerable without leaving the thread.

**Effort:** 6–8 days. **Depends on:** item 6 for the WhatsApp leg (build the conversation model first, adapter second).

---

### 8. WIP visibility in inventory

**Why:** PRD §4.10 promises WIP alongside materials and finished goods. Today the ledger tracks variants and materials only, so "what is on the factory floor" is invisible to inventory and to the balance sheet.

**Scope**
- Introduce a WIP bucket tied to production batches: cutting/sewing/finishing/QC output moves into `wip` and lands in finished goods on batch completion (movements, not a mutable field — PRD §4.10).
- `GET /inventory/wip` + `itemType: 'wip'` support in summary/detail; keep existing movement invariants.
- Admin: a WIP tab on `warehouses/inventory` with batch, stage, qty and age; batch detail links to production queue.
- Analytics: WIP value on `analytics/stock` (materials + WIP + finished goods = total inventory value).

**Acceptance**
- A batch in Sewing shows its quantity as WIP; completing it moves value from WIP to finished goods with two ledger rows and no manual entry.
- Inventory valuation total changes only by production cost at the moment of transfer.

**Effort:** 2–3 days. **Risk:** migration touches existing movement consumers — cover with the stock/valuation specs first.

---

### 9. Payroll

**Why:** PRD §4.11 lists payroll; only a manual ledger entry type exists. Staff costs are currently recorded as generic expenses, so profit reporting is loose.

**Scope**
- Backend `payroll` module: `employee_compensation` (staff user, base, allowances, deductions, effective dates), `pay_run` (period, status draft/approved/paid, totals), `payslip` (per employee, gross/net, lines). Approved runs post one `ledger_entries` row of type `payroll` (approval-gated like every other fund movement).
- Admin: `finance/payroll` section (nav under Finance) — current period, generate run, review lines, approve, mark paid, payslip view/PDF; staff comp fields on `settings/team`.
- Rules: one open run per period; approval routes through `ApprovalsService` with `FUND_MOVEMENT`.

**Acceptance**
- Generating a run for 10 staff produces correct gross/net and one ledger entry on approval; deleting a draft run leaves no ledger trace.
- Payroll totals appear in accounting expenditure and in the profit report.

**Effort:** 3–4 days.

---

### 10. Production planning (suggested batch quantity)

**Why:** PRD §4.1 says batch quantity is *driven by previous sales + current orders*. Batch creation is currently manual, so planners eyeball it.

**Scope**
- `GET /production/plan?productId=` → recommended units = open-order demand (unfulfilled lines) + trailing sales velocity × lead-time window − available stock − WIP. Show the inputs, never a black box.
- Admin: "Suggested" card on the batch-create drawer in `production/queue` with the breakdown and a one-click apply; keep manual override.
- No auto-creation — this is a decision aid, matching the approval-first philosophy.

**Acceptance**
- For a seeded product the suggestion equals a hand-computed value; overriding records who overrode and why.

**Effort:** 2–3 days.

---

## Wave 3 — Growth (2–3 weeks)

### 11. Product profitability report

**Why:** PRD §4.14 asks for product profitability. Gross margin exists as a single number; per-SKU profit needs cost basis (BOM + production costs already stored).

**Scope:** endpoint `GET /analytics/product-profitability?from&to` computing revenue − COGS per variant/product (production cost per unit where known, BOM estimate otherwise, flagged when estimated); admin tab on `analytics/stock` or a new `analytics/profitability` page with sortable margin table and "estimated cost" marker; CSV export consistent with the other `sceentair-*.csv` exports.

**Acceptance:** top row matches a manual calculation for one product; rows with unknown cost are visibly flagged, never silently zero.

**Effort:** 2–3 days.

### 12. Campaign ROI / marketing performance

**Why:** `orders.source`/`channel` are captured and grouped, but no per-campaign result exists, so campaigns cannot be evaluated.

**Scope:** attribute orders to campaigns (coupon code or tracked link/UTM) — add `campaign_id` to orders via coupon/campaign claims; endpoint comparing spend vs revenue/orders/units per campaign; admin columns on `marketing/campaigns` plus a summary card; guard against treating unattributed revenue as campaign success.

**Acceptance:** a coupon-linked campaign shows its own orders and revenue; unattributed revenue is reported separately.

**Effort:** 2–3 days. **Depends on:** item 1 data being clean.

### 13. Loyalty programme

**Why:** PRD §4.13; `campaigns.type` has `loyalty` but nothing earns or burns points.

**Scope:** `loyalty_account` (points balance, tier) + `loyalty_transaction` (earn on delivered orders, redeem at checkout, manual adjust by staff with approval); rules configurable in platform settings; storefront shows balance and redemption; admin customer drawer shows history. Points post only on `DELIVERED` and reverse on return.

**Acceptance:** a delivered order earns the configured points; a return reverses them; redemption discounts an order and is visible in totals.

**Effort:** 4–6 days.

### 14. Recommendations

**Why:** PRD §4.13; today storefront rails are best-sellers, not personalised.

**Scope:** co-purchase affinity from order history (item pairs, minimum support), "customers also bought" on PDP and cart; exclude out-of-stock; fall back to best sellers when data is thin. No ML service — one SQL aggregation + cache.

**Acceptance:** recommendations respond to real co-purchase pairs for a seeded dataset and degrade gracefully on cold start.

**Effort:** 2–3 days.

---

## Wave 4 — Strategic (decision required)

### 15. POS / mall sales

PRD §4.20 is explicitly unresolved (`03-Open-Questions.md` item 1) and out of scope for v1 pending that answer. Do not start until the owner decides: physical POS, mall-integration only, or defer. If greenlit, the honest estimate is 10+ days (terminals, offline queue, till sessions, cash reconciliation) and should re-use orders/payments rather than inventing a parallel sale model.

---

## Cross-cutting quality tasks (fold into each wave, ~1 day total)

- Fix the two long-standing failing specs: `src/app/ui/spinner.spec.ts` (expects `role="status"`) and `src/app/sections/dashboard/overview-api.spec.ts` (asserts retired "0 units in" copy). Keep the suite at zero failures so new work cannot hide behind noise.
- Repair pre-existing mojibake in `src/app/ui/sidebar.ts` (done), `services/api/src/modules/accounting/accounting.controller.ts`, and the header of `project/18-*.md` — encoding damage is spreading.
- Verify the notification badge behaviour end-to-end after any data change (badge baselines re-anchor on drops; badges must never appear for counts that were never reviewed).
- Add one e2e smoke script (Playwright or API-level) covering: pay → order paid → stock moved → refund/return → stock restored; and wholesale apply → approve → order → invoice. Run it before every deploy.

---

## Definition of done (per item)

1. Server-side authorization and audit trail intact (`05`, `19` appendices) — no client-only gating.
2. Approval gates preserved for any fund/stock/price action.
3. Behaviour-level tests in the admin and API suites; the full suite stays green.
4. Production verified with real credentials, not mocks — screenshots or IDs recorded in the item's notes.
5. No secrets in source; env vars documented in the deployment runbook.

## Open decisions needed

1. Wholesale and partner subdomains (`wholesale.seentair.ng`, `partners.seentair.ng`?).
2. WhatsApp Business provider: Meta Cloud API direct vs a BSP (Termii/Twilio) — affects item 6's effort by ±2 days.
3. Whether historical raw-material stock adjustments may be backfilled into purchase rows (item 1).
4. POS priority answer (item 15).
