import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  count as fmtCount,
  money as fmtMoney,
  relative as fmtRelative,
  statusLabel as fmtStatusLabel,
  titleCase,
} from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast';
import { NotificationsApiService } from '../../core/notifications-api.service';
import { OrdersApiService, type ApiOrder } from '../../core/orders-api.service';
import { ReturnsApiService } from '../../core/returns-api.service';

export interface CustomerThread {
  id: string;
  name: string;
  orders: ApiOrder[];
  lifetimeValue: number;
  lastOrderAt: string;
}

interface ActivityEntry {
  text: string;
  actor: string;
  at: number;
}

/** Canned starters for the composer; text only, there is no macro backend. */
export const MACROS = [
  {
    label: 'Send tracking',
    text: 'Hello! Your order is with the courier; we will share the live tracking link as soon as it is dispatched.',
  },
  {
    label: 'Size exchange',
    text: 'Thanks for reaching out. Size exchanges follow the returns window: request within 12 hours of receipt and we will guide you through the swap.',
  },
  {
    label: 'Payment reminder',
    text: 'Hi! Your order is reserved and awaiting full payment; it ships as soon as payment is confirmed.',
  },
];

/** Groups recent orders by customer account; guest orders have no one to message. */
export function threadsFrom(orders: readonly ApiOrder[]): CustomerThread[] {
  const byCustomer = new Map<string, CustomerThread>();
  for (const order of orders) {
    if (!order.customer) continue;
    const thread = byCustomer.get(order.customer.id) ?? {
      id: order.customer.id,
      name: order.customer.name,
      orders: [],
      lifetimeValue: 0,
      lastOrderAt: order.createdAt,
    };
    thread.orders.push(order);
    thread.lifetimeValue += Number(order.totalAmount) || 0;
    if (new Date(order.createdAt) > new Date(thread.lastOrderAt)) thread.lastOrderAt = order.createdAt;
    byCustomer.set(order.customer.id, thread);
  }
  const list = [...byCustomer.values()];
  for (const thread of list) {
    thread.orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  return list.sort((a, b) => Date.parse(b.lastOrderAt) - Date.parse(a.lastOrderAt));
}

function orderRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function channelLabel(channel: string): string {
  return titleCase(channel.replace(/_/g, ' '));
}

const CLOSED_STATUSES: ApiOrder['status'][] = ['delivered', 'returned', 'cancelled'];

function errorText(err: unknown, fallback: string): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : fallback;
}

/**
 * Customer support desk. There is no inbound messaging yet (live chat and
 * WhatsApp are future integrations), so the desk is built on what is real:
 * customers with recent orders, and an order update that goes out as an
 * in-platform notification tied to one of their orders.
 */
@Component({
  selector: 'app-messages-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, Drawer, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Support</span>
        <h1 class="head__title">Messages</h1>
        <p class="head__lead">
          Send an order update to a customer. It arrives as an in-app notification on their order;
          inbound chat and WhatsApp are not connected yet.
        </p>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Customers</span>
        <span class="kpi__value">{{ count(threads().length) }}</span>
        <span class="kpi__meta">with recent orders</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Open orders</span>
        <span class="kpi__value">{{ count(openOrders()) }}</span>
        <span class="kpi__meta">not yet delivered</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Awaiting payment</span>
        <span class="kpi__value">{{ count(unpaidOrders()) }}</span>
        <span class="kpi__meta">the most common reason to get in touch</span>
      </article>
      <a class="card kpi kpi--link" routerLink="/orders/returns">
        <span class="stat__label">Returns requested</span>
        <span class="kpi__value">{{ count(returnsPending()) }}</span>
        <span class="kpi__meta">handled on the Returns page</span>
      </a>
    </section>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input
          type="search"
          placeholder="Search customers"
          aria-label="Search customers"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>
      <span class="badge">{{ summary() }}</span>
    </div>

    @if (loading() && threads().length === 0) {
      <div class="load-center" role="status">
        <app-spinner size="sm" label="Loading inbox" />
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col" class="num">Orders</th>
                <th scope="col" class="num">Lifetime value</th>
                <th scope="col">Last order</th>
                <th scope="col">Latest order</th>
                <th scope="col">Update</th>
              </tr>
            </thead>
            <tbody>
              @for (thread of rows(); track thread.id) {
                <tr>
                  <td>
                    <button type="button" class="row-link" (click)="open(thread)">{{ thread.name }}</button>
                  </td>
                  <td class="num">{{ count(thread.orders.length) }}</td>
                  <td class="num">{{ money(thread.lifetimeValue) }}</td>
                  <td class="sub-cell">{{ ago(thread.lastOrderAt) }}</td>
                  <td>
                    <span class="badge" [class]="'badge badge--' + tone(thread.orders[0].status)">
                      {{ statusLabel(thread.orders[0].status) }}
                    </span>
                  </td>
                  <td>
                    @if (canSend()) {
                      <button type="button" class="btn btn--ghost btn--xs" (click)="open(thread)">
                        Send update
                      </button>
                    } @else {
                      <span class="sub-cell">View only</span>
                    }
                  </td>
                </tr>
              }
              @if (!loading() && rows().length === 0 && !error()) {
                <tr>
                  <td colspan="6" class="empty">
                    {{ query().trim() ? 'No customers match that search' : 'No customers yet' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Send a customer update">
      <ng-container drawerTitle>
        @if (selected(); as thread) {
          <div class="dtitle">
            <strong>{{ thread.name }}</strong>
            <span class="sub">{{ money(thread.lifetimeValue) }} lifetime · {{ count(thread.orders.length) }} orders</span>
          </div>
        }
      </ng-container>
      @if (selected(); as thread) {
        <div class="dbody">
          @if (canSend()) {
            <form class="dform" (ngSubmit)="send(thread)">
              <label class="field">
                <span class="field__label">Regarding order</span>
                <select [(ngModel)]="orderId" name="orderId">
                  @for (order of thread.orders; track order.id) {
                    <option [value]="order.id">
                      {{ orderRef(order.id) }}, {{ statusLabel(order.status) }}
                    </option>
                  }
                </select>
              </label>
              <label class="field">
                <span class="field__label">Message</span>
                <textarea rows="4" [(ngModel)]="draft" name="draft"></textarea>
              </label>
              @if (draftError()) {
                <span class="field-error" role="alert">{{ draftError() }}</span>
              }
              <div class="macros" role="group" aria-label="Starter messages">
                @for (macro of macros; track macro.label) {
                  <button type="button" class="btn btn--ghost btn--xs" (click)="applyMacro(macro.text)">
                    {{ macro.label }}
                  </button>
                }
              </div>
              <div class="dform__actions">
                <button type="submit" class="btn btn--primary" [disabled]="sending()">
                  {{ sending() ? 'Sending…' : 'Send update' }}
                </button>
              </div>
            </form>
          } @else {
            <div class="notice notice--info" role="status">
              Your role can see customers but not message them.
            </div>
          }

          <h3 class="dlabel">Order activity</h3>
          <ol class="activity">
            @for (entry of activity(); track entry.text) {
              <li class="activity__item">
                <span class="activity__text">{{ entry.text }}</span>
                <span class="sub">
                  {{ entry.actor }} · {{ relative(entry.at) }}
                </span>
              </li>
            }
            @if (activity().length === 0) {
              <li class="activity__item activity__item--empty">No orders on record.</li>
            }
          </ol>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi--link { color: var(--text); text-decoration: none; }
    .kpi--link:hover { border-color: var(--primary); }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .row-link { font-weight: 700; color: var(--text); background: none; border: 0; padding: 0; cursor: pointer; font-size: inherit; }
    .row-link:hover { color: var(--primary); }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .sub-cell { color: var(--muted); font-size: var(--fs-xs); }
    .search { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 38px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--muted); }
    .search input { border: 0; background: none; color: var(--text); font-size: var(--fs-md); min-width: 190px; outline: none; }
    .notice { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs); margin-bottom: var(--gap); }
    .notice--error { border-color: var(--bad); color: var(--bad); }
    .notice--info { border-color: var(--primary); color: var(--primary); margin-bottom: 0; }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
    .dtitle { display: grid; gap: 2px; }
    .dbody { display: grid; gap: 16px; }
    .dform { display: grid; gap: 12px; }
    .dform__actions { display: flex; justify-content: flex-end; }
    .field { display: grid; gap: 5px; }
    .field select, .field textarea { padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); font-family: inherit; }
    .field select:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--primary); }
    .field-error { color: var(--bad); font-size: var(--fs-xs); }
    .macros { display: flex; flex-wrap: wrap; gap: 8px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); margin: 0; }
    .activity { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .activity__item { display: grid; gap: 2px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); }
    .activity__item--empty { color: var(--muted); font-size: var(--fs-sm); text-align: center; }
    .activity__text { font-size: var(--fs-sm); font-weight: 600; }
  `,
})
export class MessagesInbox {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly returnsApi = inject(ReturnsApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;
  protected readonly relative = fmtRelative;
  protected readonly statusLabel = fmtStatusLabel;
  protected readonly orderRef = orderRef;
  protected readonly macros = MACROS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<ApiOrder[]>([]);
  protected readonly returnsPending = signal(0);
  protected readonly query = signal('');

  protected readonly selected = signal<CustomerThread | null>(null);
  protected readonly sending = signal(false);
  protected readonly draftError = signal<string | null>(null);
  protected draft = '';
  protected orderId = '';

  /** Sending a notification is a write on the communication module. */
  protected readonly canSend = computed(
    () => this.auth.user()?.access['communication'] === 'full',
  );

  protected readonly threads = computed(() => threadsFrom(this.orders()));

  protected readonly rows = computed(() => {
    const term = this.query().trim().toLowerCase();
    return term
      ? this.threads().filter((thread) => thread.name.toLowerCase().includes(term))
      : this.threads();
  });

  protected readonly summary = computed(() => {
    const n = this.rows().length;
    return `${fmtCount(n)} ${n === 1 ? 'customer' : 'customers'}`;
  });

  protected readonly openOrders = computed(
    () => this.orders().filter((order) => !CLOSED_STATUSES.includes(order.status)).length,
  );

  protected readonly unpaidOrders = computed(
    () => this.orders().filter((order) => order.paymentStatus !== 'paid').length,
  );

  protected readonly activity = computed<ActivityEntry[]>(() => {
    const thread = this.selected();
    if (!thread) return [];
    return thread.orders.map((order) => ({
      text: `${orderRef(order.id)} · ${channelLabel(order.channel)} · ${fmtMoney(Number(order.totalAmount))} · ${fmtStatusLabel(order.status)}`,
      actor: order.paymentStatus === 'paid' ? 'Paid' : 'Awaiting payment',
      at: Date.parse(order.createdAt) || 0,
    }));
  });

  constructor() {
    void this.load();
  }

  protected tone(status: string): string {
    return status === 'awaiting_payment' ? 'warn' : '';
  }

  /** `relative` takes a timestamp; order timestamps arrive as ISO strings. */
  protected ago(iso: string): string {
    return fmtRelative(Date.parse(iso) || 0);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const [ordersResult] = await Promise.allSettled([
      this.ordersApi.list({ page: 1, limit: 100 }),
      this.returnsApi
        .list(1, 50)
        .then((list) =>
          this.returnsPending.set(list.data.filter((r) => r.status === 'requested').length),
        )
        .catch(() => this.returnsPending.set(0)),
    ]);
    if (ordersResult.status === 'fulfilled') {
      this.orders.set(ordersResult.value.data);
    } else if (this.orders().length === 0) {
      this.error.set(errorText(ordersResult.reason, 'The server did not respond.'));
    }
    this.loading.set(false);
  }

  protected open(thread: CustomerThread): void {
    this.selected.set(thread);
    this.orderId = thread.orders[0]?.id ?? '';
    this.draft = '';
    this.draftError.set(null);
  }

  protected close(): void {
    this.selected.set(null);
    this.draftError.set(null);
  }

  protected applyMacro(text: string): void {
    this.draft = this.draft.trim() ? `${this.draft.trim()}\n${text}` : text;
  }

  protected async send(thread: CustomerThread): Promise<void> {
    const message = this.draft.trim();
    if (!message) {
      this.draftError.set('Write the update first.');
      return;
    }
    if (!this.orderId) return;
    this.draftError.set(null);
    this.sending.set(true);
    try {
      await this.notificationsApi.send({
        recipientId: thread.id,
        channel: 'in_platform',
        type: 'order_update',
        message,
        relatedOrderId: this.orderId,
      });
      this.selected.set(null);
      this.draft = '';
      this.toasts.show(`Update sent to ${thread.name}`, 'good');
    } catch (err) {
      this.draftError.set(errorText(err, 'The update could not be sent.'));
    } finally {
      this.sending.set(false);
    }
  }
}
