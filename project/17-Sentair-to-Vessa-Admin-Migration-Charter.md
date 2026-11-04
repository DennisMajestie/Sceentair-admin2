# Sentair-to-Vessa Admin Migration Charter

## Direction

Vessa Admin is the product being made into the canonical admin application. The existing Sentair Limited platform is the reference implementation for working admin behavior, business logic, API contracts, authorization, audit behavior, and tests. Port verified functionality from Sentair into Vessa; do not treat Sentair as the target product or assume that a similarly named Vessa screen has feature parity.

This is a migration, not a visual-only redesign and not a blind copy. Preserve Vessa's product identity, route conventions, domain model, and approved requirements while bringing over compatible working functionality. When a Sentair behavior conflicts with Vessa's approved requirements, record and resolve the conflict instead of silently copying it.

## Repository Roots

| Purpose | Root |
|---|---|
| Sentair reference monorepo | `C:\Users\charl\Downloads\sentair-fashion\Sentair Limited` |
| Sentair admin dashboard | `C:\Users\charl\Downloads\sentair-fashion\Sentair Limited\apps\admin-dashboard` |
| Sentair core API | `C:\Users\charl\Downloads\sentair-fashion\Sentair Limited\services\api` |
| Vessa target project | `C:\Users\charl\vessa-re\app` |
| Vessa admin frontend | `C:\Users\charl\vessa-re\app\src\app` |
| Vessa project requirements | `C:\Users\charl\vessa-re\app\project` |

Keep work in the Vessa repository unless the user explicitly asks for a Sentair change. Never report a Sentair edit or test as a Vessa implementation. Always confirm the active path before running commands or applying changes.

## Migration Rules

For every feature, trace and record the complete behavior chain:

1. Sentair page, user workflow, state transitions, validations, confirmation, loading/error/empty states, and accessibility behavior.
2. Sentair API client call and exact HTTP method/path/payload/response.
3. API controller, service, authorization guard, data model/migration, audit/approval behavior, and relevant tests.
4. Vessa route, component, service, data model, and existing tests that are the destination.
5. Implement the behavior in Vessa using its existing patterns. Reuse an endpoint only after confirming the configured Vessa API actually serves it; otherwise port or specify the backend contract too.
6. Add behavior-level tests, then run the narrow spec and target app build. Mark the mapping complete only when the Vessa behavior is tested; route presence alone is not parity.

Do not substitute mock/static data for API data, do not drop server-side authorization or audit guarantees, and do not claim changes are persisted unless the API write succeeds. Keep API keys, passwords, and environment secrets out of docs and source control.

## Initial Admin Route Map

The following is an initial route-level inventory, not a completed parity audit.

| Sentair admin area | Sentair routes | Vessa starting point | Initial assessment |
|---|---|---|---|
| Home/dashboard | `/` | `/dashboard/overview`, `/dashboard/activity`, `/dashboard/alerts` | Partial candidate; trace metrics and activity contracts |
| Approvals | `/approvals` | None found | Gap to audit |
| Production and batch detail | `/production`, `/production/:id` | `/products/batches`, `/products/batches/:id` | Partial candidate; compare stages, costs, QA, and approvals |
| Floor kiosk | `/floor-kiosk` | None found | Gap to audit |
| Orders and detail | `/orders`, `/orders/:id` | `/orders/all`, `/orders/all/:id`, `/orders/board` | Candidate; verify lifecycle, payment, fulfillment, and audit behavior |
| Returns | `/returns` | `/orders/returns`, `/orders/returns/:id` | Candidate; verify request/resolve/restock/refund behavior |
| Catalogue and product detail | `/catalogue`, `/catalogue/:id` | `/products/catalog`, `/products/item/:id` | Candidate; compare variants, sales, BOM, and specs |
| Inventory and counts | `/inventory`, `/inventory/:itemType/:itemId`, `/inventory/counts` | `/warehouses/locations`, `/warehouses/counts`, `/analytics/stock` | Partial candidate; verify ledger, valuation, and count workflows |
| Reviews | `/reviews` | None found | Gap to audit |
| Partners | `/partners` | None found | Gap to audit |
| Materials and purchases | `/materials`, `/materials/:id`, `/purchases` | `/purchasing/materials`, `/purchasing/orders` | Candidate; compare receiving, usage, valuation, and supplier linkage |
| Vendors | `/vendors` | `/purchasing/suppliers` | Candidate; compare supplier CRUD and purchasing workflows |
| Wholesale | `/wholesale` | No direct route found | Gap to audit; customer stockists are not proof of wholesale parity |
| Custom orders | `/custom-orders` | None found | Gap to audit |
| Accounting | `/accounting` | None found | Gap to audit |
| Staff and permissions | `/staff` | `/settings/team` | Partial; Sentair has role matrix, five access levels, save confirmation, and API persistence |
| Logistics | `/logistics` | None found | Gap to audit |
| Marketing | `/marketing` | None found | Gap to audit |
| Tech packs | `/tech-pack`, `/tech-pack/:id` | None found | Gap to audit |
| Help and tickets | `/help`, `/help/tickets` | `/help/center`, `/help/tickets` | Candidate; compare article and ticket workflows |
| Messages | `/messages` | None found | Gap to audit |
| Audit/security | `/audit`, `/security` | No direct route found | Gap to audit; dashboard activity is not automatically equivalent |
| Settings | `/settings` | `/settings/account`, `/settings/company`, `/settings/notifications`, `/settings/team` | Partial; compare full settings and security surface |

Vessa routes are defined in `src/app/app.routes.ts`; Sentair routes are defined in `apps/admin-dashboard/src/app/app.routes.ts`. Recheck both before updating this table.

## Sentair API Endpoint Inventory

Source scan of `services/api/src/modules/**/*.controller.ts`. Paths below are relative to `/api/v1`. This is a controller inventory, not an assertion that every route is called by the admin frontend; trace actual UI usage and authorization before porting.

| Module/controller | Endpoints |
|---|---|
| Accounting | `GET /accounting/ledger`, `POST /accounting/ledger`, `GET /accounting/reports/:type` |
| Analytics | `GET /analytics/dashboard`, `/best-sellers`, `/low-stock`, `/inventory-movement-trend`, `/inventory-valuation` |
| Approvals | `POST /approvals`, `GET /approvals/pending`, `GET /approvals`, `POST /approvals/:id/decide` |
| Audit | `GET /audit-log`, `GET /audit-log/verify` |
| Auth | `POST /auth/login`, `/register`, `/refresh`, `/2fa/verify`, `/2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`, `/logout`; `GET /auth/me` |
| Business | `GET /business/profile`, `PATCH /business/profile` |
| Catalogue | `GET /products`, `/products/:id`, `/products/:id/variants`, `/collections`, `/categories`; `POST /products`, `/products/:id/variants`, `/collections`, `/categories`; `PATCH /products/:id`, `/products/:id/variants/:variantId`; `DELETE /products/:id`, `/products/:id/sale`; `PUT /products/:id/sale`, `/variants/:variantId/bom`; `GET /variants/:variantId/bom`, `/variants/:variantId/spec-sheet` |
| Checkout shipping | Admin: `GET /checkout-shipping/admin/settings`, `/zones`, `/rates`; `PATCH /checkout-shipping/admin/settings`, `/zones/:id`; `POST /checkout-shipping/admin/zones`, `/rates`; `DELETE /checkout-shipping/admin/zones/:id`. Public checkout: `GET /checkout-shipping/states`, `POST /checkout-shipping/quote` |
| Coupons and campaigns | `GET /coupon-campaigns/active`, `/coupons/admin/coupons`, `/coupons/admin/bundles`, `/coupons/admin/campaigns`, `/coupons/admin/report`, `/coupons/mine`; `POST /coupons/admin/coupons`, `/coupons/admin/bundles`, `/coupons/admin/campaigns`, `/coupons/admin/coupons/:id/issue`, `/coupons/claim`, `/coupons/bundles/:id/claim`, `/coupons/campaigns/:id/claim`, `/coupons/preview`; `PATCH /coupons/admin/coupons/:id`, `/coupons/admin/wallet/:id`; `DELETE /coupons/admin/coupons/:id`, `/coupons/admin/campaigns/:id` |
| Custom orders | `POST /custom-orders`, `/custom-orders/:id/quotation`, `/custom-orders/:id/accept-quote`, `/custom-orders/:id/payment`, `/custom-orders/:id/sample-approval`; `GET /custom-orders`, `/custom-orders/:id`, `/custom-orders/:id/quotation`; `PATCH /custom-orders/:id/status` |
| Customers | `GET /customers`, `GET /customers/:id` |
| Help | `GET /help/articles`, `/help/tickets`; `POST /help/tickets`; `PATCH /help/tickets/:id/status` |
| Inventory | `GET /inventory/summary`, `/inventory/ledger/verify`, `/inventory/counts`, `/inventory/digest/:itemType/:itemId`, `/inventory/:variantId/movements`; `POST /inventory/counts`, `/inventory/:variantId/movements` |
| Logistics | `GET /deliveries`, `/deliveries/:id/tracking`, `/logistics/quote`, `/logistics/pricing`; `POST /deliveries`, `/deliveries/:id/checkpoint`, `/logistics/pricing`; `PATCH /deliveries/:id/status` |
| Marketing | `GET /campaigns`, `POST /campaigns` |
| Materials | `GET /materials`, `/materials/low-stock`, `/materials/valuation`, `/materials/purchases`, `/materials/:id`; `POST /materials`, `/materials/:id/purchase`, `/materials/:id/usage` |
| Suppliers | `GET /materials/suppliers`, `/materials/suppliers/:id`; `POST /materials/suppliers`; `PATCH /materials/suppliers/:id`; `DELETE /materials/suppliers/:id` |
| Media | `POST /media/images` |
| Notifications | `GET /notifications`, `/notifications/preferences`; `PATCH /notifications/preferences`, `/notifications/:id/read`; `POST /notifications/send` |
| Orders/payments | `POST /orders`, `/orders/:id/payment`, `/orders/:id/reorder`, `/orders/:id/stock-exception/allocate`, `/orders/:id/stock-exception/refund`, `/payments/paystack/webhook`; `GET /orders`, `/orders/:id`, `/orders/:id/detail`, `/orders/:id/tracking`; `PATCH /orders/:id/status`, `/orders/:id/fulfilment` |
| Partners | `POST /partners`, `/profit-distributions`; `GET /partners`, `/partners/me/dashboard`, `/partners/:id/dashboard`, `/partners/:id/profit-distributions` |
| Production | `GET /production-batches`, `/production-batches/:id`, `/production-batches/:id/cost`, `/production-batches/:id/qc-rejections`, `/production-batches/:id/scans`, `/production-batches/:id/telemetry`, `/production-batches/:id/bom`; `POST /production-batches`, `/:id/cost`, `/:id/qc-rejection`, `/:id/barcode`, `/:id/scans`, `/:id/telemetry`; `PATCH /production-batches/:id/stage` |
| Public config | `GET /config/public` |
| Returns | `POST /returns`; `GET /returns`; `PATCH /returns/:id/resolve` |
| Reviews | `POST /orders/:id/review`; `GET /products/:id/reviews`, `/reviews/summaries`, `/reviews/pending`; `PATCH /reviews/:id/status` |
| Tech packs | `GET /tech-packs`, `/tech-packs/:id`, `/tech-packs/:id/revisions`; `POST /tech-packs`, `/tech-packs/:id/approve`; `PUT /tech-packs/:id` |
| Users and roles | `GET /users`, `/users/roles`, `/users/:id`; `POST /users`; `PATCH /users/me`, `/users/:id/role`; `PUT /users/roles/:roleName/permissions` |
| Wholesale | `POST /wholesale/apply`, `/wholesale/accounts`, `/wholesale/tiers`; `GET /wholesale/pricing`, `/wholesale/stock`, `/wholesale/invoices`, `/wholesale/accounts`, `/wholesale/accounts/:id`, `/wholesale/tiers`; `PATCH /wholesale/accounts/:id`, `/wholesale/tiers/:id`; `DELETE /wholesale/tiers/:id` |
| Wishlist | `GET /wishlist`; `POST /wishlist/items`, `/wishlist/merge`; `DELETE /wishlist/items/:productId` |

The users/roles endpoint is confirmed in Sentair's controller and API client: `GET /users/roles` loads the matrix, and `PUT /users/roles/:roleName/permissions` replaces a role's complete permission set. Sentair's staff page keeps a draft, supports `none`, `own`, `view`, `approve`, and `full`, protects `staff_access` from being disabled, confirms the change, then saves and reports success/failure. This is a representative migration to verify in Vessa, not a Vessa implementation by itself.

## Progress Ledger

Start each port by adding or updating a row here with source evidence, Vessa destination, API/data dependencies, tests, and status (`Not started`, `In progress`, `Verified`, or `Blocked`). Keep this document honest: an inventory is not feature parity, a passing source test is not a target test, and a frontend build is not proof of server-side persistence.

| Feature | Sentair evidence | Vessa destination | Status / verification |
|---|---|---|---|
| Staff role permissions | Admin `staff.page.ts`; `GET /users/roles`; `PUT /users/roles/:roleName/permissions`; five access levels; confirmation; protected `staff_access` | `/settings/team`; `UsersApiService`; Vessa API specification | In progress: API client and draft/confirm/save UI ported; Vessa production build passes. |
| Accounting ledger | `GET /accounting/ledger`, `POST /accounting/ledger`, `GET /accounting/reports/:type` (`Sentair` controller inventory, charter §Sentair API Endpoint Inventory) | `/accounting/ledger`; `AccountingApiService`; `store.ledgerEntries`; Vessa build green | Verified: API client, ledger grid, drawer detail, filters (type/date/search), net-balance stats, nav entry (`icon: dollar`), production build exit 0. |
| Approval queue | `POST /approvals`, `GET /approvals/pending`, `GET /approvals`, `POST /approvals/:id/decide` (`Sentair` controller inventory, charter §Sentair API Endpoint Inventory) | `/approvals`; `ApprovalsApiService`; local `ApprovalRow[]`; Vessa build green | Verified: API client (create/pending/list/decide), queue grid with status filter + search, decision drawer (approve/reject + justification/payload), nav entry (`icon: check`), production build exit 0. |
| Audit log | `GET /audit-log`, `GET /audit-log/verify` (`Sentair` controller inventory, charter §Sentair API Endpoint Inventory) | `/audit/log`; `AuditApiService`; local `AuditRow[]`; Vessa build green | Verified: API client (list/verify), entry grid with actor/action/date filters, chain integrity stats (valid/broken/head hash), entry detail drawer with before/after state, nav entry (`icon: alert`), production build exit 0. |