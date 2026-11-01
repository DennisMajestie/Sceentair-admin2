import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { date as fmtDate, count as fmtCount } from '../../core/format';
import { Store } from '../../core/store';
import { buildCustomerDetail, rememberCustomerOpener, restoreCustomerOpener } from '../../core/customer-detail';
import { Icon } from '../../ui/icon';
import { Sparkline } from '../../ui/chart';
import { CustomerDetailDrawerComponent } from './customer-detail-drawer';
import { moneyNgn, lastOrderLines, sortRows, SortDir } from './cs-data';
import {
  ApiCustomer,
  CustomersApiService,
} from '../../core/customers-api.service';
import {
  ApiOrder,
  OrdersApiService,
} from '../../core/orders-api.service';

type Filter = 'all' | 'vip' | 'net30' | 'new';
type SortKey = 'name' | 'city' | 'spend' | 'last';

interface Row {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  since: number;
  tags: string[];
  note?: string;
  orders: number;
  units: number;
  spend: number;
  avgOrder: number;
  unpaid: number;
  monthSpend: number;
  lastOrder: number | null;
  lastDate: string;
  initials: string;
  tone: string;
  monthly?: number[];
}

@Component({
  selector: 'app-customers-stockists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Sparkline, CustomerDetailDrawerComponent],
  template: `
    <div class="head head--cs">
      <h1 class="head__title">Stockists</h1>
    </div>

    <section class="cs-tiles" aria-label="Summary">
      @for (t of tiles(); track t.label) {
        <article class="cs-tile">
          <span class="cs-tile__icon av--{{ t.tone }}"><app-icon [name]="t.icon" [size]="17" /></span>
          <div class="cs-tile__text">
            <span class="cs-tile__label">{{ t.label }}</span>
            <span class="cs-tile__row">
              <b class="cs-tile__value">{{ t.value }}</b>
              @if (t.chip) {
                <span class="cs-tile__chip">{{ t.chip }}</span>
              }
            </span>
          </div>
        </article>
      }
    </section>

    <section class="cs-island">
      <div class="cs-toolbar">
        <div class="cs-chips" role="group" aria-label="Tag filters">
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'all'" (click)="filter.set('all')">
            All stockists <span class="cs-fchip__n">{{ count(rows().length) }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'vip'" (click)="filter.set('vip')">
            VIP <span class="cs-fchip__n">{{ tagged('vip') }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'net30'" (click)="filter.set('net30')">
            Net 30 <span class="cs-fchip__n">{{ tagged('net30') }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'new'" (click)="filter.set('new')">
            New <span class="cs-fchip__n">{{ tagged('new') }}</span>
          </button>
        </div>
        <div class="cs-toolbar__spacer"></div>
        <label class="cs-sort">
          <app-icon name="filter" [size]="15" />
          <select class="cs-sort__sel" [value]="sortBy()" (change)="setSortSelect($any($event.target).value)" aria-label="Sort accounts">
            <option value="spend">Lifetime revenue</option>
            <option value="last">Last order</option>
            <option value="name">Name</option>
            <option value="city">City</option>
          </select>
          <span class="cs-sort__chev"><app-icon name="chevron" [size]="13" /></span>
        </label>
        <div class="cs-vtoggle" role="group" aria-label="View">
          <button
            type="button"
            class="cs-vbtn"
            [class.is-on]="viewMode() === 'grid'"
            [attr.aria-pressed]="viewMode() === 'grid'"
            (click)="viewMode.set('grid')"
            aria-label="Grid view"
          >
            <app-icon name="grid" [size]="16" />
          </button>
          <button
            type="button"
            class="cs-vbtn"
            [class.is-on]="viewMode() === 'list'"
            [attr.aria-pressed]="viewMode() === 'list'"
            (click)="viewMode.set('list')"
            aria-label="List view"
          >
            <app-icon name="list" [size]="16" />
          </button>
        </div>
        <label class="search cs-search">
          <app-icon name="search" [size]="15" />
          <input
            type="search"
            placeholder="Name, contact or city…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            aria-label="Search accounts"
          />
        </label>
      </div>

      @if (loading() && rows().length === 0) {
        <div class="cs-cards cs-skel" aria-hidden="true">
          @for (i of [0, 1, 2, 3, 4, 5, 6, 7]; track i) {
            <div class="cs-skel__card"></div>
          }
        </div>
      } @else if (viewMode() === 'grid') {
        <div class="cs-cards">
          @for (r of sorted(); track r.id) {
            <a class="cs-scard" [style.--tone]="'var(--' + r.tone + ')'" [routerLink]="['/customers', 'stockists', r.id]" [attr.data-customer-opener]="'stockist:' + r.id" (click)="rememberOpener(r.id)">
              <span class="cs-scard__top">
                <span class="cs-scard__av av av--lg av--{{ r.tone }}" aria-hidden="true">{{ r.initials }}</span>
                <span class="cs-scard__id">
                  <strong class="cs-scard__name">{{ r.name }}</strong>
                  <span class="cs-scard__contact">{{ r.contact }}</span>
                </span>
              </span>
              <span class="cs-scard__place"><app-icon name="store" [size]="14" />{{ r.city }}, {{ r.region }}</span>
              <span class="cs-scard__tags">
                @for (t of r.tags; track t) {
                  <span class="cs-tag" [attr.data-tone]="t">{{ label(t) }}</span>
                }
              </span>
              <span class="cs-scard__stats">
                <span class="cs-scard__stat"><small>Lifetime</small><b>{{ money(r.spend) }}</b></span>
                <span class="cs-scard__stat"><small>Last order</small><b>{{ r.lastOrder ? relativeAgo(r.lastOrder) : '—' }}</b></span>
              </span>
              @if (r.monthly; as ms) {
                @if (ms.length > 1) {
                  <span class="cs-scard__spark">
                    <app-sparkline [values]="ms" [width]="200" [height]="40" label="monthly revenue" />
                  </span>
                }
              }
              <span class="cs-scard__foot"><b>{{ money(r.monthSpend) }}</b>&nbsp;this month</span>
            </a>
          }
          @if (!loading() && visible().length === 0 && !error()) {
            <div class="cs-empty" [style.grid-column]="'1 / -1'">No accounts match “{{ query() }}”.</div>
          }
        </div>
      } @else {
        <div class="cs-table" style="--cols: 1.8fr 1.2fr 1.1fr 0.9fr 0.9fr" role="table" aria-label="Stockist accounts">
          <div class="cs-row cs-row--head" style="--row-h: 44px" role="row">
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('name')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'name'" (click)="setSort('name')">
                Account<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('city')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'city'" (click)="setSort('city')">
                Location<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader">Tags</div>
            <div class="cs-h cs-h--r" role="columnheader" [attr.aria-sort]="ariaSort('spend')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'spend'" (click)="setSort('spend')">
                Lifetime<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('last')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'last'" (click)="setSort('last')">
                Last order<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
          </div>
          @for (r of sorted(); track r.id) {
            <a class="cs-row" style="--row-h: 52px" role="row" [routerLink]="['/customers', 'stockists', r.id]" [attr.data-customer-opener]="'stockist:' + r.id" (click)="rememberOpener(r.id)">
              <div class="cs-cell cs-cell--full" role="cell" data-l="Account">
                <span class="cell-person">
                  <span class="av av--md av--{{ r.tone }}" aria-hidden="true">{{ r.initials }}</span>
                  <span>
                    <span class="sh-name">{{ r.name }}</span>
                    <small class="sh-n">{{ r.contact }}</small>
                  </span>
                </span>
              </div>
              <div class="cs-cell" role="cell" data-l="Location">
                <span class="sh-place"><app-icon name="store" [size]="13" />{{ r.city }}, {{ r.region }}</span>
              </div>
              <div class="cs-cell" role="cell" data-l="Tags">
                <span class="sh-tags">
                  @if (r.tags.length === 0) {
                    <span class="cs-none">—</span>
                  } @else {
                    @for (t of r.tags; track t) {
                      <span class="cs-tag" [attr.data-tone]="t">{{ label(t) }}</span>
                    }
                  }
                </span>
              </div>
              <div class="cs-cell cs-cell--r" role="cell" data-l="Lifetime">
                <b>{{ money(r.spend) }}</b>
              </div>
              <div class="cs-cell" role="cell" data-l="Last order">
                <b>{{ r.lastOrder ? relativeAgo(r.lastOrder) : '—' }}</b>
              </div>
            </a>
          }
          @if (!loading() && visible().length === 0 && !error()) {
            <div class="cs-empty" [style.grid-column]="'1 / -1'">No accounts match “{{ query() }}”.</div>
          }
        </div>
      }

      @if (error()) {
        <div class="notice notice--error" role="alert">{{ error() }}</div>
      }

      <sd-customer-detail-drawer
        [open]="detailOpen()"
        [account]="selected()"
        (close)="close()"
      />
    </section>
  `,
  styles: `
    :host { display: block; }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
  `,
})
export class CustomerStockists {
  private readonly customersApi = inject(CustomersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly count = fmtCount;
  protected readonly money = moneyNgn;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly customers = signal<ApiCustomer[]>([]);
  protected readonly orders = signal<ApiOrder[]>([]);

  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('spend');
  protected readonly dir = signal<SortDir>('desc');
  protected readonly viewMode = signal<'grid' | 'list'>('grid');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  protected readonly detailOpen = computed(() => this.routeId() !== null);

  private readonly tones = ['pine', 'ocean', 'ochre', 'sage', 'rose', 'slate'];
  private readonly natural: Record<string, SortDir> = {
    name: 'asc',
    city: 'asc',
    spend: 'desc',
    last: 'desc',
  };
  private readonly page = signal(1);
  private readonly pageSize = 100;

  constructor() {
    restoreCustomerOpener('stockist');
    void this.loadCustomers(true);
  }

  protected readonly rows = computed<Row[]>(() =>
    this.customers()
      .filter((c) => c.kind === 'stockist')
      .map((c) => {
        const customerOrders = this.orders().filter((o) => o.customer?.id === c.id);
        const units = customerOrders.reduce((a, o) => a + o.items.reduce((b, l) => b + l.quantity, 0), 0);
        const spend = customerOrders.reduce((a, o) => a + o.totalAmount, 0);
        const last = customerOrders.reduce((max, o) => Math.max(max, Date.parse(o.createdAt)), 0);
        const hash = [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthSpend = customerOrders
          .filter((o) => Date.parse(o.createdAt) >= monthStart.getTime())
          .reduce((a, o) => a + o.totalAmount, 0);
        return {
          id: c.id,
          name: c.name,
          contact: c.contact,
          email: c.email,
          phone: c.phone,
          city: c.city,
          region: c.region,
          since: Date.parse(c.since),
          tags: c.tags,
          note: c.note,
          orders: customerOrders.length,
          units,
          spend: Math.round(spend),
          avgOrder: customerOrders.length ? Math.round(spend / customerOrders.length) : 0,
          unpaid: Math.round(
            customerOrders
              .filter((o) => o.paymentStatus !== 'paid')
              .reduce((a, o) => a + o.totalAmount, 0),
          ),
          monthSpend: Math.round(monthSpend),
          lastOrder: last || null,
          lastDate: last ? new Date(last).toISOString().slice(0, 10) : '',
          initials: c.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? '')
            .join(''),
          tone: this.tones[hash % this.tones.length],
          monthly: months(customerOrders),
        };
      }),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    let list = this.rows();
    if (f === 'vip') list = list.filter((r) => r.tags.includes('vip'));
    if (f === 'net30') list = list.filter((r) => r.tags.includes('net30'));
    if (f === 'new') list = list.filter((r) => r.tags.includes('new'));
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q),
    );
  });

  protected readonly sorted = computed<Row[]>(() =>
    sortRows(this.visible(), this.sortBy(), this.dir(), this.natural, (r, k) => this.sortVal(r, k)),
  );

  private sortVal(row: Row, key: string): number | string {
    switch (key) {
      case 'name': return row.name;
      case 'city': return `${row.city} ${row.region}`;
      case 'last': return row.lastOrder ?? 0;
      case 'spend':
      default: return row.spend;
    }
  }

  protected readonly tiles = computed(() => {
    const net30 = this.tagged('net30');
    return [
      this.tile('Store', 'ocean', 'Stockists', fmtCount(this.rows().length), net30 > 0 ? `${net30} Net 30` : undefined),
      this.tile('Package', 'sage', 'Wholesale · 90 days', this.money(this.wholesale90())),
      this.tile('Cart', 'ochre', 'Average order', this.money(this.avgOrder())),
      this.tile('Card', 'slate', 'On account, unpaid', this.money(this.unpaid()), 'Net 30'),
    ];
  });

  private tile(icon: string, tone: string, label: string, value: string, chip?: string) {
    return { icon, tone, label, value, chip };
  }

  protected readonly lifetime = computed(() => this.rows().reduce((a, r) => a + r.spend, 0));

  protected readonly wholesale90 = computed(() => {
    const cutoff = Date.now() - 90 * 86400000;
    let total = 0;
    for (const o of this.orders()) {
      if (o.status === 'cancelled' || Date.parse(o.createdAt) < cutoff) continue;
      if (o.channel !== 'wholesale') continue;
      total += o.totalAmount;
    }
    return Math.round(total);
  });

  protected readonly avgOrder = computed(() => {
    const orders = this.orders().filter((o) => o.channel === 'wholesale' && o.status !== 'cancelled');
    if (orders.length === 0) return 0;
    const total = orders.reduce((a, o) => a + o.totalAmount, 0);
    return Math.round(total / orders.length);
  });

  protected readonly unpaid = computed(() => {
    let total = 0;
    for (const o of this.orders()) {
      if (o.paymentStatus === 'paid' || o.status === 'cancelled' || o.channel !== 'wholesale') continue;
      total += o.totalAmount;
    }
    return Math.round(total);
  });

  protected readonly selected = computed(() => buildCustomerDetail(this.store, this.routeId(), 'stockist'));

  protected tagged(tag: string): number {
    return this.rows().filter((r) => r.tags.includes(tag)).length;
  }

  protected label(tag: string): string {
    if (tag === 'vip') return 'VIP';
    if (tag === 'net30') return 'Net 30';
    if (tag === 'subscriber') return 'Subscriber';
    if (tag === 'new') return 'New';
    return tag;
  }

  protected relativeAgo(ts: number): string {
    return lastOrderLines(ts).primary ?? '';
  }

  protected setSort(key: string): void {
    if (this.sortBy() === key) {
      this.dir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key as SortKey);
      this.dir.set(this.natural[key] ?? 'desc');
    }
  }

  protected setSortSelect(value: string): void {
    const key = value as SortKey;
    this.sortBy.set(key);
    this.dir.set(this.natural[key] ?? 'desc');
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  protected rememberOpener(id: string): void {
    rememberCustomerOpener('stockist', id);
  }

  protected close(): void {
    this.router.navigate(['/customers/stockists']);
  }

  private async loadCustomers(reset: boolean): Promise<void> {
    if (!reset && this.loading()) return;
    const requestId = reset ? ++this.listRequestId : this.listRequestId;
    this.loading.set(true);
    this.error.set(null);
    const page = reset ? 1 : this.page() + 1;
    if (reset) {
      this.page.set(0);
      this.customers.set([]);
    }
    try {
      const [customerResult, orderResult] = await Promise.all([
        this.customersApi.list({
          page,
          limit: this.pageSize,
          kind: 'stockist',
        }),
        this.ordersApi.list({ page: 1, limit: 100 }),
      ]);
      if (requestId !== this.listRequestId) return;
      this.page.set(page);
      this.customers.update((list) => reset ? customerResult.data : [...list, ...customerResult.data]);
      this.orders.set(orderResult.data);
    } catch (err) {
      if (requestId === this.listRequestId) this.error.set(this.errorMessage(err));
    } finally {
      if (requestId === this.listRequestId) this.loading.set(false);
    }
  }

  private listRequestId = 0;

  private errorMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Could not load stockists. Please try again.';
  }
}

function months(orders: { createdAt: string; items: { quantity: number }[] }[]): number[] {
  const values: number[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = orders
      .filter((o) => {
        const c = new Date(o.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      })
      .reduce((a, o) => a + o.items.reduce((b, l) => b + l.quantity, 0), 0);
    values.push(Math.round(value));
  }
  return values;
}
