import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { count as fmtCount } from '../../core/format';
import { Store } from '../../core/store';
import { buildCustomerDetail, rememberCustomerOpener, restoreCustomerOpener } from '../../core/customer-detail';
import { Icon } from '../../ui/icon';
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

type Filter = 'all' | 'vip' | 'subscriber' | 'new' | 'none';
type SortKey = 'name' | 'city' | 'orders' | 'spend' | 'last';

interface Row {
  id: string;
  name: string;
  email: string;
  city: string;
  region: string;
  since: number;
  tags: string[];
  note?: string;
  orders: number;
  spend: number;
  lastOrder: number | null;
  initials: string;
  tone: string;
}

@Component({
  selector: 'app-customers-shoppers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, CustomerDetailDrawerComponent],
  template: `
    <div class="head head--cs">
      <h1 class="head__title">Shoppers</h1>
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
            All shoppers <span class="cs-fchip__n">{{ count(rows().length) }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'vip'" (click)="filter.set('vip')">
            VIP <span class="cs-fchip__n">{{ tagged('vip') }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'subscriber'" (click)="filter.set('subscriber')">
            Subscriber <span class="cs-fchip__n">{{ tagged('subscriber') }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'new'" (click)="filter.set('new')">
            New <span class="cs-fchip__n">{{ tagged('new') }}</span>
          </button>
          <button type="button" class="cs-fchip" [class.is-on]="filter() === 'none'" (click)="filter.set('none')">
            No orders yet <span class="cs-fchip__n">{{ noOrders() }}</span>
          </button>
        </div>
        <div class="cs-toolbar__spacer"></div>
        <label class="search cs-search">
          <app-icon name="search" [size]="15" />
          <input
            type="search"
            placeholder="Name, email or city…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            aria-label="Search shoppers"
          />
        </label>
      </div>

      @if (loading() && rows().length === 0) {
        <div class="cs-table cs-skel" style="--cols: 2.2fr 1.3fr 0.6fr 0.8fr 1fr 1.3fr" aria-hidden="true">
          @for (i of [0, 1, 2, 3, 4, 5]; track i) {
            <div class="cs-row cs-skel__row" style="--row-h: 58px"></div>
          }
        </div>
      } @else {
        <div class="cs-table" style="--cols: 2.2fr 1.3fr 0.6fr 0.8fr 1fr 1.3fr" role="table" aria-label="Shoppers">
          <div class="cs-row cs-row--head" role="row">
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('name')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'name'" (click)="setSort('name')">
                Shopper<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('city')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'city'" (click)="setSort('city')">
                City<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h cs-h--r" role="columnheader" [attr.aria-sort]="ariaSort('orders')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'orders'" (click)="setSort('orders')">
                Orders<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h cs-h--r" role="columnheader" [attr.aria-sort]="ariaSort('spend')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'spend'" (click)="setSort('spend')">
                Spend<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader" [attr.aria-sort]="ariaSort('last')">
              <button type="button" class="cs-hbtn" [class.is-asc]="dir() === 'asc'" [class.is-act]="sortBy() === 'last'" (click)="setSort('last')">
                Last order<span class="cs-chev"><app-icon name="chevron" [size]="12" /></span>
              </button>
            </div>
            <div class="cs-h" role="columnheader">Tags</div>
          </div>
          @for (r of sorted(); track r.id) {
            <a class="cs-row" role="row" [routerLink]="['/customers', 'shoppers', r.id]" [attr.data-customer-opener]="'shopper:' + r.id" (click)="rememberOpener(r.id)">
              <div class="cs-cell cs-cell--full" role="cell" data-l="Shopper">
                <span class="cell-person">
                  <span class="av av--md av--{{ r.tone }}" aria-hidden="true">{{ r.initials }}</span>
                  <span>
                    <span class="sh-name">{{ r.name }}</span>
                    <small class="sh-n">{{ r.email }}</small>
                  </span>
                </span>
              </div>
              <div class="cs-cell" role="cell" data-l="City">
                <span class="sh-place"><app-icon name="store" [size]="13" />{{ r.city }}, {{ r.region }}</span>
              </div>
              <div class="cs-cell cs-cell--r" role="cell" data-l="Orders">
                <b>{{ r.orders }}</b>
              </div>
              <div class="cs-cell cs-cell--r" role="cell" data-l="Spend">
                <span class="sh-spend">
                  <b>{{ money(r.spend) }}</b>
                  <small class="sh-n">{{ r.orders }} orders</small>
                </span>
              </div>
              <div class="cs-cell" role="cell" data-l="Last order">
                <span class="sh-last">
                  <span>{{ lo(r.lastOrder).primary ?? '—' }}</span>
                  @if (lo(r.lastOrder).full) {
                    <small>{{ lo(r.lastOrder).full }}</small>
                  }
                </span>
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
            </a>
          }
          @if (!loading() && visible().length === 0 && !error()) {
            <div class="cs-empty" [style.grid-column]="'1 / -1'">No shoppers match “{{ query() }}”.</div>
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
export class CustomerShoppers {
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

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  protected readonly detailOpen = computed(() => this.routeId() !== null);

  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');
  protected readonly sortBy = signal<SortKey>('spend');
  protected readonly dir = signal<SortDir>('desc');

  private readonly tones = ['pine', 'ocean', 'ochre', 'sage', 'rose', 'slate'];
  private readonly natural: Record<string, SortDir> = {
    name: 'asc',
    city: 'asc',
    orders: 'desc',
    spend: 'desc',
    last: 'desc',
  };
  private readonly page = signal(1);
  private readonly pageSize = 100;

  constructor() {
    restoreCustomerOpener('shopper');
    void this.loadCustomers(true);
  }

  protected rememberOpener(id: string): void {
    rememberCustomerOpener('shopper', id);
  }

  protected close(): void {
    this.router.navigate(['/customers/shoppers']);
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
          kind: 'shopper',
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

  protected readonly rows = computed<Row[]>(() =>
    this.customers()
      .filter((c) => c.kind === 'shopper')
      .map((c) => {
        const customerOrders = this.orders().filter((o) => o.customer?.id === c.id);
        const spend = customerOrders
          .filter((o) => o.status !== 'cancelled')
          .reduce((a, o) => a + o.totalAmount, 0);
        const last = customerOrders.reduce((max, o) => Math.max(max, Date.parse(o.createdAt)), 0);
        const hash = [...c.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          city: c.city,
          region: c.region,
          since: Date.parse(c.since),
          tags: c.tags,
          note: c.note,
          orders: customerOrders.length,
          spend: Math.round(spend),
          lastOrder: last || null,
          initials: c.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join(''),
          tone: this.tones[hash % this.tones.length],
        };
      }),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.rows().filter((r) => {
      if (f === 'vip' && !r.tags.includes('vip')) return false;
      if (f === 'subscriber' && !r.tags.includes('subscriber')) return false;
      if (f === 'new' && !r.tags.includes('new')) return false;
      if (f === 'none' && r.orders > 0) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    });
  });

  protected readonly sorted = computed<Row[]>(() =>
    sortRows(this.visible(), this.sortBy(), this.dir(), this.natural, (r, k) => this.sortVal(r, k)),
  );

  private sortVal(row: Row, key: string): number | string {
    switch (key) {
      case 'name': return row.name;
      case 'city': return `${row.city} ${row.region}`;
      case 'orders': return row.orders;
      case 'last': return row.lastOrder ?? 0;
      case 'spend':
      default: return row.spend;
    }
  }

  protected readonly tiles = computed(() => {
    const fresh = this.rows().filter((r) => r.since >= monthStart()).length;
    return [
      this.tile('users', 'ocean', 'Shoppers', fmtCount(this.rows().length), fresh > 0 ? `${fmtCount(fresh)} new this month` : undefined),
      this.tile('card', 'sage', 'Subscribers', fmtCount(this.tagged('subscriber')), `${this.subscriberPct().toFixed(0)}% of shoppers`),
      this.tile('cart', 'ochre', 'Spent · 30 days', this.money(this.spent30()), this.orders30() > 0 ? `${this.orders30()} orders` : undefined),
      this.tile('dollar', 'slate', 'Average spend', this.money(this.averageSpend())),
    ];
  });

  private tile(icon: string, tone: string, label: string, value: string, chip?: string) {
    return { icon, tone, label, value, chip };
  }

  protected readonly subscriberPct = computed(() => {
    const rows = this.rows();
    return rows.length > 0 ? (this.tagged('subscriber') / rows.length) * 100 : 0;
  });

  protected readonly noOrders = computed(() => this.rows().filter((r) => r.orders === 0).length);

  protected readonly spent30 = computed(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let total = 0;
    for (const o of this.orders()) {
      if (o.status === 'cancelled' || Date.parse(o.createdAt) < cutoff) continue;
      if (this.customers().find((c) => c.id === o.customer?.id)?.kind !== 'shopper') continue;
      total += o.totalAmount;
    }
    return Math.round(total);
  });

  protected readonly orders30 = computed(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return this.orders()
      .filter(
        (o) =>
          o.status !== 'cancelled' &&
          Date.parse(o.createdAt) >= cutoff &&
          this.customers().find((c) => c.id === o.customer?.id)?.kind === 'shopper',
      ).length;
  });

  protected readonly averageSpend = computed(() => {
    const rows = this.rows();
    return rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.spend, 0) / rows.length) : 0;
  });

  protected readonly lo = (ts: number | null) => lastOrderLines(ts);

  protected readonly selected = computed(() => buildCustomerDetail(this.store, this.routeId(), 'shopper'));

  protected tagged(tag: string): number {
    return this.rows().filter((r) => r.tags.includes(tag)).length;
  }

  protected isShopper(id: string): boolean {
    return this.customers().find((c) => c.id === id)?.kind === 'shopper';
  }

  protected label(tag: string): string {
    if (tag === 'vip') return 'VIP';
    if (tag === 'net30') return 'Net 30';
    if (tag === 'subscriber') return 'Subscriber';
    if (tag === 'new') return 'New';
    return tag;
  }

  protected setSort(key: string): void {
    if (this.sortBy() === key) {
      this.dir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key as SortKey);
      this.dir.set(this.natural[key] ?? 'desc');
    }
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Could not load shoppers. Please try again.';
  }
}

function monthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
