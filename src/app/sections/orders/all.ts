import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { date as fmtDate, relative, statusLabel, statusTone } from '../../core/format';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { AuthService } from '../../core/auth.service';
import {
  ApiOrder,
  ApiOrderChannel,
  ApiOrderStatus,
  ApiPublicConfig,
  ApiTracking,
  OrdersApiService,
} from '../../core/orders-api.service';

const API_STATUSES: { id: ApiOrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'order_received', label: 'Order received' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'returned', label: 'Returned' },
  { id: 'stock_exception', label: 'Stock exception' },
  { id: 'cancelled', label: 'Cancelled' },
];

const API_FLOW: ApiOrderStatus[] = [
  'awaiting_payment',
  'order_received',
  'processing',
  'shipped',
  'delivered',
];

@Component({
  selector: 'app-orders-all',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">All orders</h1>
        <p class="head__lead">{{ totalOrders() }} orders from the API.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/orders/board">Board</a>
        <a class="btn btn--ghost" routerLink="/orders/returns">Returns</a>
      </div>
    </div>

    <div class="stats" aria-label="Order summary">
      <article class="stat">
        <span class="stat__label">Total orders</span>
        <strong class="stat__value">{{ totalOrders() }}</strong>
        <span class="stat__detail">All matching orders</span>
      </article>
      <article class="stat">
        <span class="stat__label">Open</span>
        <strong class="stat__value">{{ openCount() }}</strong>
        <span class="stat__detail">Open on this page</span>
      </article>
      <article class="stat">
        <span class="stat__label">Loaded</span>
        <strong class="stat__value">{{ rows().length }}</strong>
        <span class="stat__detail">Orders currently loaded</span>
      </article>
      <article class="stat">
        <span class="stat__label">Unpaid</span>
        <strong class="stat__value">{{ unpaidCount() }}</strong>
        <span class="stat__detail">On this page</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        @for (s of statuses; track s.id) {
          <button type="button" class="seg__btn" [class.is-on]="status() === s.id" [attr.aria-pressed]="status() === s.id" (click)="setStatus(s.id)">
            {{ s.label }} <span class="seg__count">{{ statusCount(s.id) }}</span>
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search loaded orders" [value]="query()" (input)="setQuery($any($event.target).value)" />
      </label>
    </div>

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }
    @if (loading() && rows().length === 0) {
      <div class="order-empty" role="status"><strong>Loading orders…</strong></div>
    }

    <div class="order-grid" aria-label="Sales orders">
      @for (row of shown(); track row.id) {
        <a class="order-card" [routerLink]="'/orders/all/' + row.id" [attr.aria-label]="'Open order ' + row.id + ' for ' + row.customer">
          <span class="order-card__top">
            <span class="order-card__identity">
              <span class="order-card__avatar" aria-hidden="true">{{ initials(row.customer) }}</span>
              <span class="order-card__heading">
                <strong>{{ row.customer }}</strong>
                <small>ID {{ row.shortId }} · placed {{ date(row.createdAt) }}</small>
              </span>
            </span>
            <span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span>
          </span>

          @if (row.stepIndex >= 0) {
            <span class="order-progress" role="img" [attr.aria-label]="'Fulfillment status: ' + row.label">
              @for (step of flow; track step; let i = $index) {
                <span class="order-progress__step" [class.is-done]="row.stepIndex >= i" [class.is-current]="row.status === step">
                  <span class="order-progress__dot"></span>
                  <small>{{ labels[step] }}</small>
                </span>
              }
            </span>
          } @else {
            <span class="order-progress order-progress--placeholder" aria-hidden="true"></span>
          }

          <span class="order-lines">
            @for (line of row.lines.slice(0, 2); track line.id) {
              <span class="order-line">
                <span class="order-line__name">{{ line.name }}{{ line.size ? ' · ' + line.size : '' }}</span>
                <span class="order-line__qty">{{ line.qty }} × {{ money(line.price) }}</span>
              </span>
            }
            @if (row.lines.length > 2) {
              <small class="order-lines__more">+ {{ row.lines.length - 2 }} more {{ row.lines.length - 2 === 1 ? 'line' : 'lines' }}</small>
            }
          </span>

          <span class="order-card__bottom">
            <span class="order-card__meta">
              <small>{{ row.units }} {{ row.units === 1 ? 'unit' : 'units' }}</small>
              <small>{{ row.paymentStatusLabel }}</small>
            </span>
            <span class="order-card__total">
              <span class="badge" [class.badge--good]="row.paymentStatus === 'paid'" [class.badge--warn]="row.paymentStatus !== 'paid'">
                {{ row.paymentStatusLabel }}
              </span>
              <strong>{{ money(row.total) }}</strong>
            </span>
          </span>
        </a>
      }
      @if (!loading() && visible().length === 0 && !error()) {
        <div class="order-empty">
          <strong>No orders match.</strong>
          <span>Try a different status or search.</span>
        </div>
      }
    </div>
    <div class="card order-foot">
      <div class="foot">
        <span>
          Showing <b>{{ rows().length }}</b> of {{ totalOrders() }} orders ·
          <b>{{ money(filteredTotal()) }}</b> loaded subtotal
        </span>
        @if (hasMore()) {
          <button type="button" class="btn btn--ghost btn--sm" [disabled]="loading()" (click)="showMore()">
            {{ loading() ? 'Loading…' : 'Load next page' }}
            <app-icon name="chevronDown" [size]="14" />
          </button>
        }
      </div>
    </div>

    <app-drawer [open]="!!selected() || detailLoading()" (close)="close()" label="Order detail" appearance="detail">
      <ng-container drawerTitle>
        @if (selected(); as o) {
          <div class="dhead">
            <span class="dhead__avatar" aria-hidden="true">{{ initials(o.customer) }}</span>
            <span class="dhead__text">
              <strong class="mono">Order {{ o.id }}</strong>
              <span>{{ o.customer }}</span>
            </span>
          </div>
        }
      </ng-container>
      @if (detailLoading() && !selected()) {
        <div class="order-empty" role="status">Loading order details…</div>
      }
      @if (selected(); as o) {
        <div class="dbody">
          <div class="dstatus">
            <span class="badge" [class]="'badge badge--' + o.tone">{{ o.label }}</span>
            <span class="badge" [class.badge--good]="o.paymentStatus === 'paid'" [class.badge--warn]="o.paymentStatus !== 'paid'">
              {{ o.paymentStatusLabel }}
            </span>
          </div>

          @if (o.stepIndex >= 0) {
          <div class="flow">
            @for (step of flow; track step; let i = $index) {
              <div class="flow__item">
                <button
                  type="button"
                  class="flow__node"
                  [class.is-done]="o.stepIndex >= i"
                  [class.is-now]="o.status === step"
                  [disabled]="!canAdvance(o, step)"
                  [attr.aria-current]="o.status === step ? 'step' : null"
                  [attr.aria-label]="labels[step] + (o.status === step ? ', current status' : '')"
                  (click)="advance(o, step)"
                >
                  @if (o.stepIndex > i) {
                    <app-icon name="check" [size]="11" />
                  } @else {
                    {{ i + 1 }}
                  }
                </button>
                <span [class.is-current]="o.status === step">{{ labels[step] }}</span>
              </div>
            }
          </div>
          }

          <div class="summary">
            <article class="summary__card">
              <span>Order total</span>
              <strong>{{ money(o.total) }}</strong>
              <small>{{ o.units }} units across {{ o.lines.length }} {{ o.lines.length === 1 ? 'line' : 'lines' }}</small>
            </article>
            <article class="summary__card">
              <span>Delivery fee</span>
              <strong>{{ o.deliveryFee === null ? 'Not available' : money(o.deliveryFee) }}</strong>
              <small>{{ o.deliveryMethodLabel }}</small>
            </article>
            <article class="summary__card">
              <span>Items</span>
              <strong>{{ o.units }} units</strong>
              <small>{{ o.lines.length }} line items</small>
            </article>
            <article class="summary__card">
              <span>Placed</span>
              <strong>{{ date(o.createdAt) }}</strong>
              <small>{{ ago(o.createdAt) }}</small>
            </article>
          </div>

          @if (o.paymentStatus !== 'paid') {
            <div class="notice" role="status">
              <app-icon name="alert" [size]="14" />
              <span>Payment is still due for this order.</span>
            </div>
          }

          <h3 class="dlabel">Items</h3>
          <ul class="lines">
            @for (line of o.lines; track line.id) {
              <li class="line">
                <span class="thumb thumb--sm">
                  @if (line.imageUrl) {
                    <img [src]="line.imageUrl" [alt]="line.name" referrerpolicy="no-referrer" />
                  } @else {
                    <span class="thumb__empty" aria-label="Product image unavailable">—</span>
                  }
                </span>
                <span class="line__text">
                  <strong>{{ line.name }}</strong>
                  <span>{{ line.size }} · {{ line.sku }} · {{ line.qty }} × {{ money(line.price) }}</span>
                </span>
                <span class="line__nums">
                  <span class="num strong">{{ money(line.lineTotal) }}</span>
                </span>
              </li>
            }
          </ul>

          <div class="totals">
            <div><span>Items subtotal</span><strong>{{ money(o.subtotal) }}</strong></div>
            @if (o.deliveryFee !== null) {
              <div><span>Delivery fee</span><strong>{{ money(o.deliveryFee) }}</strong></div>
            }
            <div><span>VAT / coupon breakdown</span><strong>Not available in order response</strong></div>
            <div><span>Payment</span><strong>{{ o.paymentStatusLabel }}</strong></div>
            <div class="totals__grand"><span>Order total</span><strong>{{ money(o.total) }}</strong></div>
          </div>

          <h3 class="dlabel">Customer</h3>
          <div class="customer">
            <span class="customer__avatar" aria-hidden="true">{{ initials(o.customer) }}</span>
            <span class="customer__text">
              <strong>{{ o.customer }}</strong>
              <span>{{ o.customerContact }}</span>
            </span>
          </div>

          @if (o.shippingAddress) {
            <h3 class="dlabel">Ship to</h3>
            <div class="customer__text">
              <strong>{{ o.shippingAddress.line }}</strong>
              <span>{{ o.shippingAddress.city }}, {{ o.shippingAddress.state }} · {{ o.shippingAddress.phone }}</span>
              @if (o.shippingAddress.landmark) {
                <span>{{ o.shippingAddress.landmark }}</span>
              }
            </div>
          }

          <h3 class="dlabel">Fulfillment</h3>
          <dl class="facts">
            <div><dt>Requested method</dt><dd>{{ o.deliveryMethodLabel }}</dd></div>
            @for (delivery of o.deliveries; track delivery.legNumber) {
              <div><dt>Carrier · leg {{ delivery.legNumber }}</dt><dd>{{ delivery.carrier }}</dd></div>
              <div><dt>Delivery status</dt><dd>{{ statusLabel(delivery.status) }}</dd></div>
              @if (delivery.trackingRef) {
                <div><dt>Tracking</dt><dd>{{ delivery.trackingRef }}</dd></div>
              }
            }
            @if (o.deliveries.length === 0) {
              <div><dt>Shipment</dt><dd>No delivery leg recorded</dd></div>
            }
          </dl>

          @if (o.status === 'processing') {
            <h3 class="dlabel">Pack out</h3>
            <div class="packout">
              <label class="field">
                <span class="field__label">Delivery note</span>
                <input type="text" [value]="packNote()" (input)="packNote.set($any($event.target).value)" placeholder="e.g. leave with the front desk" />
              </label>
              <div class="packout__grid">
                <label class="field">
                  <span class="field__label">Gross weight (kg)</span>
                  <input type="number" min="0" step="0.01" [value]="packWeightKg()" (input)="packWeightKg.set($any($event.target).value)" />
                </label>
                <label class="field">
                  <span class="field__label">Pallet ref</span>
                  <input type="text" [value]="packPalletRef()" (input)="packPalletRef.set($any($event.target).value)" placeholder="e.g. PLT-014" />
                </label>
              </div>
              <div class="packout__actions">
                <button type="button" class="btn" [disabled]="packSaving()" (click)="savePackOut(o.id)">
                  {{ packSaving() ? 'Saving…' : 'Save pack-out' }}
                </button>
              </div>
            </div>
          }

          <h3 class="dlabel">Timeline</h3>
          <ol class="timeline">
            @for (h of o.history; track h.at) {
              <li>
                <span class="timeline__dot"></span>
                <span class="timeline__text">
                  <strong>{{ h.label }}</strong>
                  <span>{{ h.actor ? 'by ' + h.actor + ' · ' : '' }}{{ h.note || 'Status updated' }} · {{ date(h.at) }} · {{ ago(h.at) }}</span>
                </span>
              </li>
            }
          </ol>
          <div class="dfooter">
            @if (o.hasShortfall && o.status !== 'cancelled') {
              <span class="dfooter__prompt">Short lines need allocation before dispatch.</span>
              <button type="button" class="btn" [disabled]="stockBusy() !== null" (click)="retryAllocation()">
                {{ stockBusy() === 'allocate' ? 'Allocating…' : 'Retry allocation' }}
              </button>
              <button type="button" class="btn btn--ghost destructive" [disabled]="stockBusy() !== null" (click)="refundOrder()">
                {{ stockBusy() === 'refund' ? 'Refunding…' : 'Refund & cancel' }}
              </button>
            } @else if (nextStep(o); as next) {
              <button type="button" class="btn" [disabled]="!canAdvance(o, next)" (click)="advance(o, next)">
                Advance to {{ labels[next] }}
              </button>
            } @else {
              <span class="dfooter__complete">{{ actionMessage(o) }}</span>
            }
          </div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .select {
      padding: 7px 12px;
      border: 1px solid var(--line-2);
      border-radius: 999px;
      background: var(--raised);
      font-size: var(--fs-sm);
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-top: 1px solid var(--line);
      font-size: var(--fs-xs);
      color: var(--muted);
    }
    .foot b { color: var(--text); }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .stat {
      display: grid;
      gap: 5px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: var(--r-card);
      background: var(--surface);
    }
    .stat__label { color: var(--muted); font-size: var(--fs-xs); font-weight: 600; }
    .stat__value { font-size: var(--fs-2xl); line-height: 1; font-variant-numeric: tabular-nums; }
    .stat__detail { color: var(--faint); font-size: var(--fs-2xs); }
    .strong { font-weight: 700; }
    .late { color: var(--bad); font-weight: 600; }
    .dhead { display: flex; align-items: center; gap: 10px; }
    .dhead__avatar, .customer__avatar {
      display: grid; flex: none; width: 38px; height: 38px; place-items: center;
      border: 1px solid var(--line); border-radius: 12px; background: var(--well);
      color: var(--primary); font-size: var(--fs-xs); font-weight: 700;
    }
    .dhead__text, .customer__text { display: grid; min-width: 0; gap: 2px; }
    .dhead__text strong { font-size: var(--fs-md); }
    .dhead__text span, .customer__text span { overflow: hidden; color: var(--muted); font-size: var(--fs-2xs); text-overflow: ellipsis; white-space: nowrap; }
    .dbody { display: grid; gap: 13px; padding-bottom: 2px; }
    .dstatus { display: flex; gap: 7px; }
    .flow { display: flex; align-items: flex-start; justify-content: space-between; gap: 0; padding: 3px 5px 8px; }
    .flow__item { position: relative; z-index: 0; display: grid; flex: 1; justify-items: center; gap: 5px; color: var(--faint); font-size: 10px; }
    .flow__item:not(:last-child)::after { position: absolute; z-index: -1; top: 12px; left: calc(50% + 12px); width: calc(100% - 24px); height: 2px; background: var(--line-2); content: ''; }
    .flow__node { display: grid; width: 24px; height: 24px; place-items: center; border: 2px solid var(--line-2); border-radius: 50%; background: var(--surface); color: var(--muted); font-size: 10px; font-weight: 700; }
    .flow__node.is-done { border-color: var(--primary); background: var(--primary); color: var(--on-primary); }
    .flow__node.is-now { box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
    .flow__node:not([disabled]) { cursor: pointer; }
    .flow__node:focus-visible, .customer__link:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
    .flow__item .is-current { color: var(--text); font-weight: 700; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .summary__card { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--well); }
    .summary__card span, .summary__card small { color: var(--muted); font-size: 10px; }
    .summary__card strong { font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
    .notice { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs); }
    .notice app-icon { color: var(--primary); }
    .dlabel {
      margin: 2px 0 -5px;
      font-size: var(--fs-2xs);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--faint);
    }
    .lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
    .line { display: flex; align-items: center; gap: 11px; }
    .line { min-height: 62px; padding: 7px 0; border-bottom: 1px solid var(--line); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
    .line__text { display: grid; flex: 1; min-width: 0; gap: 3px; line-height: 1.25; }
    .line__text strong { font-size: var(--fs-sm); }
    .line__text span { overflow: hidden; color: var(--faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .line__nums { display: grid; justify-items: end; font-size: var(--fs-xs); color: var(--text); }
    .totals { display: grid; gap: 6px; padding: 10px; border: 1px dashed var(--line-2); border-radius: 12px; font-size: var(--fs-xs); }
    .totals div { display: flex; justify-content: space-between; gap: 10px; }
    .totals span { color: var(--muted); }
    .totals__grand { padding-top: 7px; border-top: 1px solid var(--line); font-weight: 700; }
    .customer { display: flex; align-items: center; gap: 9px; padding: 9px; border-radius: 12px; background: var(--well); }
    .customer__avatar { width: 34px; height: 30px; border-radius: 9px; }
    .customer__text { flex: 1; }
    .customer__text strong { font-size: var(--fs-xs); }
    .customer__link { color: var(--primary); font-size: var(--fs-2xs); font-weight: 700; text-decoration: none; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-sm); font-weight: 600; }
    .timeline { list-style: none; margin: 0; padding: 0 0 4px; display: grid; gap: 11px; }
    .timeline li { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; }
    .timeline__dot { width: 9px; height: 9px; border-radius: 999px; background: var(--primary); margin-top: 4px; }
    .timeline__text { display: grid; line-height: 1.3; }
    .timeline__text strong { font-size: var(--fs-xs); }
    .timeline__text span { font-size: var(--fs-2xs); color: var(--faint); }
    .dfooter { position: sticky; bottom: -14px; z-index: 2; display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin: 0 -14px -14px; padding: 10px 14px; border-top: 1px solid var(--line); background: var(--surface); }
    .dfooter__complete { align-self: center; color: var(--muted); font-size: var(--fs-xs); }
    .dfooter__prompt { flex: 1; min-width: 0; text-align: left; color: var(--bad); font-size: var(--fs-xs); font-weight: 600; }
    .destructive { color: var(--bad); }
    .packout { display: grid; gap: 9px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--well); }
    .packout .field { display: grid; gap: 4px; }
    .packout input { padding: 7px 10px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--raised); color: var(--text); font-size: var(--fs-sm); }
    .packout__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .packout__actions { display: flex; justify-content: flex-end; }
  `,
})
export class OrdersAll {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly api = inject(OrdersApiService);
  private readonly auth = inject(AuthService);

  protected readonly statuses = API_STATUSES;
  protected readonly flow = API_FLOW;
  protected readonly labels: Record<ApiOrderStatus, string> = {
    awaiting_payment: 'Awaiting payment',
    order_received: 'Order received',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    returned: 'Returned',
    stock_exception: 'Stock exception',
    cancelled: 'Cancelled',
  };

  protected readonly status = signal<ApiOrderStatus | 'all'>('all');
  protected readonly query = signal('');
  protected readonly now = Date.now();
  protected readonly date = fmtDate;
  protected readonly publicConfig = signal<ApiPublicConfig | null>(null);
  protected readonly statusLabel = (value: string) => statusLabel(value.replaceAll('_', ' '));
  protected readonly loading = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<ApiOrder[]>([]);
  protected readonly selectedOrder = signal<ApiOrder | null>(null);
  protected readonly tracking = signal<ApiTracking | null>(null);
  protected readonly totalOrders = signal(0);
  private readonly page = signal(0);
  private readonly pageSize = 100;

  protected readonly unpaidCount = computed(
    () => this.rows().filter((row) => row.paymentStatus !== 'paid').length,
  );
  protected readonly openCount = computed(
    () => this.rows().filter((row) => !['delivered', 'returned', 'cancelled'].includes(row.status)).length,
  );
  protected readonly rows = computed(() => this.orders().map((order) => this.rowFor(order)));

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((row) =>
      `${row.id} ${row.customer} ${row.customerContact} ${row.lines.map((line) => line.name).join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  });

  protected readonly shown = this.visible;
  protected readonly hasMore = computed(() => this.orders().length < this.totalOrders());

  protected readonly filteredTotal = computed(() =>
    this.rows().reduce((sum, row) => sum + row.total, 0),
  );

  protected readonly stockBusy = signal<'allocate' | 'refund' | null>(null);
  protected readonly packSaving = signal(false);
  protected readonly packNote = signal('');
  protected readonly packWeightKg = signal('');
  protected readonly packPalletRef = signal('');

  constructor() {
    void this.loadPublicConfig();
    void this.loadOrders(true);
    this.route.paramMap
      .pipe(map((params) => params.get('id')), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((id) => {
        if (id) void this.loadDetail(id);
        else {
          this.detailRequestId += 1;
          this.detailLoading.set(false);
          this.selectedOrder.set(null);
          this.tracking.set(null);
          this.error.set(null);
        }
      });
  }

  protected async showMore(): Promise<void> {
    await this.loadOrders(false);
  }

  protected setStatus(value: ApiOrderStatus | 'all'): void {
    this.status.set(value);
    void this.loadOrders(true);
  }

  protected statusCount(value: ApiOrderStatus | 'all'): number {
    return value === 'all' ? this.rows().length : this.rows().filter((row) => row.status === value).length;
  }

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected readonly selected = computed(() => {
    const order = this.selectedOrder();
    if (!order) return null;
    const items = order.items ?? [];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tracking = this.tracking();
    const customer = order.customer?.name || order.guestName || order.guestEmail || 'Walk-in customer';
    return {
      id: order.id,
      customer,
      customerContact: order.customer?.email || order.customer?.phone || order.guestEmail || 'Contact unavailable',
      status: order.status,
      tone: statusTone(order.status),
      label: this.labelFor(order.status),
      paymentStatus: order.paymentStatus,
      paymentStatusLabel: this.labelFor(order.paymentStatus),
      createdAt: Date.parse(order.createdAt),
      deliveryFee: order.deliveryFee ?? null,
      deliveryMethodLabel: order.deliveryMethod ? this.labelFor(order.deliveryMethod) : 'Not specified',
      shippingAddress: order.shippingAddress,
      total: order.totalAmount,
      subtotal,
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      hasShortfall: items.some((item) => (item.shortfall ?? 0) > 0),
      stepIndex: API_FLOW.indexOf(order.status),
      lines: items.map((item) => ({
        id: item.id,
        name: item.variant.product?.name || item.variant.sku,
        size: [item.variant.size, item.variant.colour].filter(Boolean).join(' · '),
        sku: item.variant.sku,
        imageUrl: item.variant.imageUrl || item.variant.product?.primaryImageUrl || null,
        qty: item.quantity,
        price: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
      deliveries: tracking?.deliveries ?? [],
      history: (tracking?.events ?? []).map((event) => ({
        at: Date.parse(event.createdAt),
        label: this.labelFor(event.status),
        note: event.note ?? null,
        actor: event.actor ?? null,
      })),
    };
  });

  protected async advance(
    order: { id: string; status: ApiOrderStatus; paymentStatus: string; channel?: ApiOrderChannel },
    status: ApiOrderStatus,
  ): Promise<void> {
    if (!this.canAdvance(order, status)) return;
    this.error.set(null);
    try {
      await this.api.updateStatus(order.id, status);
      this.toasts.show(`${this.labelFor(status)} — order updated`, 'good');
      await Promise.all([this.loadDetail(order.id), this.loadOrders(true)]);
    } catch (error) {
      this.error.set(this.errorMessage(error));
    }
  }

  protected canAdvance(
    order: { id: string; status: ApiOrderStatus; paymentStatus: string; channel?: ApiOrderChannel },
    to: ApiOrderStatus,
  ): boolean {
    const currentIndex = API_FLOW.indexOf(order.status);
    if (currentIndex < 0 || API_FLOW[currentIndex + 1] !== to || order.paymentStatus !== 'paid') {
      return false;
    }
    const module = order.channel === 'wholesale'
      ? 'wholesale_orders'
      : order.channel === 'custom'
        ? 'custom_orders'
        : 'retail_orders';
    return this.auth.user()?.access[module] === 'full';
  }

  protected async retryAllocation(): Promise<void> {
    const order = this.selectedOrder();
    if (!order || this.stockBusy() !== null) return;
    this.stockBusy.set('allocate');
    try {
      await this.api.allocateStockException(order.id);
      this.toasts.show('Short lines allocated', 'good');
      await Promise.all([this.loadDetail(order.id), this.loadOrders(true)]);
    } catch (error) {
      this.toasts.show(error instanceof Error ? error.message : 'Could not allocate the short lines.', 'bad');
    } finally {
      this.stockBusy.set(null);
    }
  }

  protected async refundOrder(): Promise<void> {
    const order = this.selectedOrder();
    if (!order || this.stockBusy() !== null) return;
    this.stockBusy.set('refund');
    try {
      await this.api.refundStockException(order.id);
      this.toasts.show('Order refunded and cancelled', 'good');
      await Promise.all([this.loadDetail(order.id), this.loadOrders(true)]);
    } catch (error) {
      this.toasts.show(error instanceof Error ? error.message : 'Could not refund the order.', 'bad');
    } finally {
      this.stockBusy.set(null);
    }
  }

  protected async savePackOut(orderId: string): Promise<void> {
    if (this.packSaving()) return;
    this.packSaving.set(true);
    const weight = this.packWeightKg().trim();
    try {
      await this.api.fulfil(orderId, {
        deliveryNote: this.packNote().trim() || null,
        grossWeightKg: weight === '' || Number.isNaN(Number(weight)) ? null : Number(weight),
        palletRef: this.packPalletRef().trim() || null,
      });
      this.toasts.show('Pack-out saved', 'good');
      await Promise.all([this.loadDetail(orderId), this.loadOrders(true)]);
    } catch (error) {
      this.toasts.show(error instanceof Error ? error.message : 'Could not save the pack-out.', 'bad');
    } finally {
      this.packSaving.set(false);
    }
  }

  protected ago(ts: number): string {
    return relative(ts, this.now);
  }

  protected money(value: number): string {
    const config = this.publicConfig();
    if (!config) return new Intl.NumberFormat().format(value);
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currencyCode,
      currencyDisplay: 'symbol',
    }).format(value);
  }

  protected initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  }

  protected nextStep(order: { status: ApiOrderStatus; paymentStatus: string }): ApiOrderStatus | undefined {
    if (order.paymentStatus !== 'paid') return undefined;
    const index = API_FLOW.indexOf(order.status);
    return index >= 0 ? API_FLOW[index + 1] : undefined;
  }

  protected actionMessage(order: { status: ApiOrderStatus; paymentStatus: string }): string {
    if (order.status === 'awaiting_payment' && order.paymentStatus !== 'paid') return 'Awaiting payment';
    if (order.status === 'stock_exception') return 'Resolve stock exception';
    if (order.status === 'cancelled') return 'Order cancelled';
    if (order.status === 'returned') return 'Order returned';
    if (order.status === 'delivered') return 'Order delivered';
    if (order.paymentStatus !== 'paid') return 'Payment required before fulfillment';
    return 'No further status action';
  }

  protected close(): void {
    this.router.navigate(['/orders/all']);
  }

  private async loadOrders(reset: boolean): Promise<void> {
    if (!reset && this.loading()) return;
    const requestId = reset ? ++this.listRequestId : this.listRequestId;
    this.loading.set(true);
    this.error.set(null);
    const page = reset ? 1 : this.page() + 1;
    if (reset) {
      this.page.set(0);
      this.orders.set([]);
      this.totalOrders.set(0);
    }
    try {
      if (!this.publicConfig()) {
        this.publicConfig.set(await this.api.publicConfig());
      }
      const result = await this.api.list({
        page,
        limit: this.pageSize,
        ...(this.status() === 'all' ? {} : { status: this.status() as ApiOrderStatus }),
      });
      if (requestId !== this.listRequestId) return;
      this.page.set(page);
      this.totalOrders.set(result.total);
      this.orders.update((orders) => reset ? result.data : [...orders, ...result.data]);
    } catch (error) {
      if (requestId === this.listRequestId) this.error.set(this.errorMessage(error));
    } finally {
      if (requestId === this.listRequestId) this.loading.set(false);
    }
  }

  private async loadDetail(id: string): Promise<void> {
    const requestId = ++this.detailRequestId;
    this.detailLoading.set(true);
    this.error.set(null);
    this.selectedOrder.set(null);
    this.tracking.set(null);
    try {
      const [order, tracking] = await Promise.all([this.api.detail(id), this.api.tracking(id)]);
      if (requestId !== this.detailRequestId) return;
      this.selectedOrder.set(order);
      this.tracking.set(tracking);
      if (this.detailLoadedId !== id) {
        this.detailLoadedId = id;
        this.packNote.set('');
        this.packWeightKg.set('');
        this.packPalletRef.set('');
      }
    } catch (error) {
      if (requestId === this.detailRequestId) this.error.set(this.errorMessage(error));
    } finally {
      if (requestId === this.detailRequestId) this.detailLoading.set(false);
    }
  }

  private listRequestId = 0;
  private detailRequestId = 0;
  private detailLoadedId: string | null = null;

  private async loadPublicConfig(): Promise<void> {
    this.publicConfig.set(await this.api.publicConfig());
  }

  private rowFor(order: ApiOrder) {
    const items = order.items ?? [];
    const customer = order.customer?.name || order.guestName || order.guestEmail || 'Walk-in customer';
    return {
      id: order.id,
      shortId: order.id.slice(0, 8),
      customer,
      customerContact: order.customer?.email || order.guestEmail || '',
      status: order.status,
      createdAt: Date.parse(order.createdAt),
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      total: order.totalAmount,
      paymentStatus: order.paymentStatus,
      paymentStatusLabel: this.labelFor(order.paymentStatus),
      tone: statusTone(order.status),
      label: this.labelFor(order.status),
      stepIndex: API_FLOW.indexOf(order.status),
      lines: items.map((item) => ({
        id: item.id,
        name: item.variant.product?.name || item.variant.sku,
        size: [item.variant.size, item.variant.colour].filter(Boolean).join(' · '),
        qty: item.quantity,
        price: item.unitPrice,
      })),
    };
  }

  private labelFor(value: string): string {
    return statusLabel(value.replaceAll('_', ' '));
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = error.error;
      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const message = payload.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(' ');
      }
    }
    if (error instanceof Error && error.message) return error.message;
    return 'The order request failed. Please try again.';
  }
}
