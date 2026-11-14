import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, money as fmtMoney, moneyCompact } from '../../core/format';
import { Icon } from '../../ui/icon';

interface CoverRow {
  id: string;
  name: string;
  free: number;
  sold: number;
  days: number | null;
  status: 'Critical' | 'Watch' | 'Healthy';
}

interface ExpiryRow {
  id: string;
  lot: string;
  product: string;
  left: number;
  days: number;
  value: number;
}

@Component({
  selector: 'app-analytics-stock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">How healthy the shelves are</span>
        <h1 class="head__title">Stock health</h1>
        <p class="head__lead">Cover, accuracy, expiry and dead stock in one read.</p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--ghost" (click)="exportStock()">
          <app-icon name="download" [size]="14" />
          Export stock
        </button>
        <a class="btn btn--ghost" routerLink="/warehouses/counts">
          <app-icon name="warehouses" [size]="14" />
          Cycle counts
        </a>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Stock value</span>
        <span class="kpi__value">{{ money(store.stockValue()) }}</span>
        <span class="kpi__meta">at cost, {{ count(store.unitsOnHand()) }} units</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Median cover</span>
        <span class="kpi__value">{{ medianCover() }}<span class="kpi__suffix">days</span></span>
        <span class="kpi__meta">selling products · last 30 days</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Time on the shelf</span>
        <span class="kpi__value">{{ daysOnShelf() }}<span class="kpi__suffix">days</span></span>
        <span class="kpi__meta">{{ turns().toFixed(1) }}× a year</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Expiring ≤ 90 days</span>
        <span class="kpi__value">{{ money(expiringValue()) }}</span>
        <span class="kpi__meta">{{ count(expiryLots().length) }} lots · alerts at 90 days</span>
      </article>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Days of cover</h2>
          <p class="card__sub">Available stock at the last 30 days’ sell rate</p>
        </div>
        <div class="card__tools">
          <div class="seg" role="group" aria-label="Cover filter">
            <button type="button" class="seg__btn" [class.is-on]="coverFilter() === 'all'" [attr.aria-pressed]="coverFilter() === 'all'" (click)="coverFilter.set('all')">
              All {{ coverRows().length }}
            </button>
            <button type="button" class="seg__btn" [class.is-on]="coverFilter() === 'risk'" [attr.aria-pressed]="coverFilter() === 'risk'" (click)="coverFilter.set('risk')">
              At risk {{ atRisk() }}
            </button>
            <button type="button" class="seg__btn" [class.is-on]="coverFilter() === 'healthy'" [attr.aria-pressed]="coverFilter() === 'healthy'" (click)="coverFilter.set('healthy')">
              Healthy {{ healthy() }}
            </button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="num-col">Free</th>
              <th class="num-col">Sold</th>
              <th class="num-col">Days</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of visibleCover(); track r.id) {
              <tr>
                <td>
                  <a class="prod" [routerLink]="'/products/item/' + r.id">
                    <strong>{{ r.name }}</strong>
                    <span>{{ r.free }} free · {{ r.sold }} sold</span>
                  </a>
                </td>
                <td class="num-col">{{ count(r.free) }}</td>
                <td class="num-col">{{ count(r.sold) }}</td>
                <td class="num-col">{{ r.days === null ? 'No recent sales' : r.days + ' days' }}</td>
                <td>
                  <span class="badge" [class.badge--bad]="r.status === 'Critical'" [class.badge--warn]="r.status === 'Watch'">
                    {{ r.status }}
                  </span>
                </td>
                <td class="num-col">
                  <a class="btn btn--ghost btn--xs" [routerLink]="'/products/item/' + r.id">View product</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid grid--2">
      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Stock accuracy</h2>
            <p class="card__sub">From finished cycle counts</p>
          </div>
        </div>
        <p class="big">{{ accuracy().toFixed(1) }}%</p>
        <p class="card__sub">{{ count(doneCounts().length) }} counts · {{ count(accuracyLines().total) }} lines</p>
        <ul class="rows">
          @for (c of doneCounts(); track c.id) {
            <li class="tile row--tint cnt">
              <span class="cnt__name">
                <strong>{{ c.number }}</strong>
                <span>{{ locationName(c.locId) }} · {{ c.zone }} · {{ c.lines.length }} lines</span>
              </span>
              <span class="badge" [class.badge--good]="c.variance === 0" [class.badge--warn]="c.variance > 0">
                {{ c.variance === 0 ? 'Exact' : c.variance + ' off' }}
              </span>
            </li>
          }
        </ul>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Value by location</h2>
            <p class="card__sub">At cost</p>
          </div>
        </div>
        <p class="big">{{ compact(store.stockValue()) }} at cost</p>
        <ul class="rows">
          @for (l of byLocation(); track l.id) {
            <li class="tile row--tint loc">
              <span class="loc__name">{{ l.name }}</span>
              <span class="loc__bar">
                <span class="meter"><span class="meter__fill" [style.width.%]="l.pct"></span></span>
              </span>
              <span class="num">{{ money(l.value) }}</span>
              <span class="loc__pct">{{ l.pct.toFixed(0) }}%</span>
            </li>
          }
        </ul>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Value by category</h2>
            <p class="card__sub">Finished goods at cost</p>
          </div>
        </div>
        <p class="big">{{ compact(categoryValue()) }}</p>
        <ul class="rows">
          @for (c of byCategory(); track c.name) {
            <li class="tile row--tint cat">
              <span class="cat__name">{{ c.name }}</span>
              <span class="cat__bar">
                <span class="meter"><span class="meter__fill" [style.width.%]="c.pct"></span></span>
              </span>
              <span class="num">{{ money(c.value) }}</span>
            </li>
          }
        </ul>
        @if (categoryLead(); as lead) {
          <p class="insight">{{ lead.name }} holds {{ lead.pct.toFixed(0) }}% of it — {{ money(lead.value) }}.</p>
        }
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Sell-through</h2>
            <p class="card__sub">Share of stock sold in 30 days</p>
          </div>
        </div>
        <p class="big">{{ sellThrough().toFixed(0) }}%</p>
        <ul class="rows">
          @for (c of sellThroughByCategory(); track c.name) {
            <li class="tile row--tint sell">
              <span class="sell__name">{{ c.name }}</span>
              <span class="sell__bar">
                <span class="meter"><span class="meter__fill" [style.width.%]="c.pct"></span></span>
              </span>
              <span class="num">{{ c.pct.toFixed(0) }}%</span>
            </li>
          }
        </ul>
        <p class="insight">
          Stock turns {{ turns().toFixed(1) }}× a year — about {{ daysOnShelf() }} days on the shelf.
          @if (fastest(); as f) {
            Fastest: {{ f.name }} ({{ f.pct.toFixed(0) }}%).
          }
        </p>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Expiry exposure</h2>
            <p class="card__sub">Value at cost of lots that expire soon</p>
          </div>
        </div>
        <ul class="rows">
          @for (b of expiryBuckets(); track b.label) {
            <li class="tile row--tint exp">
              <span class="exp__label">{{ b.label }}</span>
              <span class="num">{{ money(b.value) }}</span>
              <span class="exp__meta">{{ b.lots }} lots · {{ count(b.units) }} units</span>
            </li>
          }
        </ul>
        <ul class="rows rows--tight">
          @for (l of expiryLots(); track l.id) {
            <li class="lot">
              <span>{{ l.product }}</span>
              <span class="mono">{{ l.lot }} · {{ l.left }} left</span>
              <span class="num">{{ l.days }} d</span>
            </li>
          }
        </ul>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Dead stock</h2>
            <p class="card__sub">On the shelf, with no sale in the last 30 days</p>
          </div>
        </div>
        @if (deadStock().length === 0) {
          <p class="empty">No stocked products are without a sale in the last 30 days.</p>
        } @else {
          <ul class="rows">
            @for (p of deadStock(); track p.id) {
              <li class="tile row--tint lot">
                <span>{{ p.name }}</span>
                <span class="num">{{ count(p.onHand) }} units</span>
                <span class="num">{{ money(p.value) }}</span>
              </li>
            }
          </ul>
        }
      </article>
    </section>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__suffix { font-size: var(--fs-xl); color: var(--muted); margin-left: 2px; }
    .kpi__meta { display: flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--muted); }
    .grid { margin-bottom: var(--gap); }
    .big { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin: 0; }
    .cnt { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; }
    .cnt__name { display: grid; line-height: 1.25; }
    .cnt__name span { font-size: var(--fs-2xs); color: var(--faint); }
    .loc, .cat, .sell { display: grid; grid-template-columns: minmax(90px, 1fr) 1fr auto auto; align-items: center; gap: 12px; }
    .sell { grid-template-columns: minmax(90px, 1fr) 1fr auto; }
    .loc__bar .meter, .cat__bar .meter, .sell__bar .meter { display: block; }
    .loc__pct { font-size: var(--fs-xs); color: var(--faint); min-width: 34px; text-align: right; }
    .exp { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 12px; }
    .exp__meta { font-size: var(--fs-2xs); color: var(--faint); }
    .rows--tight { margin-top: 12px; }
    .lot { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: var(--fs-sm); }
    .lot .mono { font-size: var(--fs-2xs); color: var(--faint); }
    .insight { margin: 12px 0 0; font-size: var(--fs-sm); color: var(--muted); }
    .prod { display: grid; line-height: 1.25; }
    .prod span { font-size: var(--fs-2xs); color: var(--faint); }
    .num-col { text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class AnalyticsStock {
  protected readonly store = inject(Store);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly coverFilter = signal<'all' | 'risk' | 'healthy'>('all');

  protected readonly soldByProduct = computed(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const map = new Map<string, number>();
    let total = 0;
    for (const m of this.store.moves()) {
      if (m.kind !== 'sale' || m.at < cutoff) continue;
      const qty = Math.abs(m.qty);
      map.set(m.itemId, (map.get(m.itemId) ?? 0) + qty);
      total += qty;
    }
    return { map, total, cutoff };
  });

  protected readonly reservedByProduct = computed(() => {
    const reserved = new Map<string, number>();
    for (const order of this.store.openOrders()) {
      for (const line of order.lines) {
        reserved.set(line.productId, (reserved.get(line.productId) ?? 0) + line.qty);
      }
    }
    return reserved;
  });

  protected readonly coverRows = computed<CoverRow[]>(() =>
    this.store
      .products()
      .map((p) => {
        const onHand = Object.values(p.stock).reduce((a, b) => a + b, 0);
        const free = Math.max(0, onHand - (this.reservedByProduct().get(p.id) ?? 0));
        const sold = this.soldByProduct().map.get(p.id) ?? 0;
        const perDay = sold / 30;
        const days = perDay > 0 ? Math.round(free / perDay) : null;
        const status: CoverRow['status'] =
          days === null ? 'Healthy' : days < 14 ? 'Critical' : days < 45 ? 'Watch' : 'Healthy';
        return { id: p.id, name: `${p.name} ${p.size}`, free, sold, days, status };
      })
      .sort((a, b) => (a.days ?? Number.POSITIVE_INFINITY) - (b.days ?? Number.POSITIVE_INFINITY)),
  );

  protected readonly visibleCover = computed(() => {
    const rows = this.coverRows();
    if (this.coverFilter() === 'risk') return rows.filter((r) => r.status !== 'Healthy');
    if (this.coverFilter() === 'healthy') return rows.filter((r) => r.status === 'Healthy');
    return rows;
  });

  protected readonly atRisk = computed(() => this.coverRows().filter((r) => r.status !== 'Healthy').length);

  protected readonly healthy = computed(() => this.coverRows().filter((r) => r.status === 'Healthy').length);

  protected readonly medianCover = computed(() => {
    const days = this.coverRows()
      .map((r) => r.days)
      .filter((day): day is number => day !== null)
      .sort((a, b) => a - b);
    if (days.length === 0) return 0;
    const mid = Math.floor(days.length / 2);
    return days.length % 2 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);
  });

  protected readonly turns = computed(() => {
    const value = this.store.stockValue();
    if (value === 0) return 0;
    const cutoff = this.soldByProduct().cutoff;
    let cogs = 0;
    for (const m of this.store.moves()) {
      if (m.kind !== 'sale' || m.at < cutoff) continue;
      cogs += Math.abs(m.value);
    }
    return (cogs / value) * 12;
  });

  protected readonly daysOnShelf = computed(() => {
    const t = this.turns();
    return t > 0 ? Math.round(365 / t) : 0;
  });

  protected readonly doneCounts = computed(() =>
    this.store
      .counts()
      .filter((c) => c.status === 'done')
      .map((c) => ({
        id: c.id,
        number: c.number,
        locId: c.locId,
        zone: c.zone,
        lines: c.lines,
        variance: c.lines.reduce((a, l) => a + (l.counted === null ? 0 : Math.abs(l.counted - l.expected)), 0),
      })),
  );

  protected readonly accuracyLines = computed(() => {
    let total = 0;
    let exact = 0;
    for (const c of this.doneCounts()) {
      for (const l of c.lines) {
        if (l.counted === null) continue;
        total += 1;
        if (l.counted === l.expected) exact += 1;
      }
    }
    return { total, exact };
  });

  protected readonly accuracy = computed(() => {
    const { total, exact } = this.accuracyLines();
    return total > 0 ? (exact / total) * 100 : 0;
  });

  protected readonly byLocation = computed(() => this.store.stockByLocation());

  protected readonly byCategory = computed(() => {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const p of this.store.products()) {
      const units = Object.values(p.stock).reduce((a, b) => a + b, 0);
      const value = units * p.cost;
      totals.set(p.category, (totals.get(p.category) ?? 0) + value);
      grand += value;
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value), pct: grand > 0 ? (value / grand) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  });

  protected readonly categoryValue = computed(() =>
    this.byCategory().reduce((a, c) => a + c.value, 0),
  );

  protected readonly categoryLead = computed(() => this.byCategory()[0] ?? null);

  protected readonly sellThroughByCategory = computed(() => {
    const sold = new Map<string, number>();
    const cutoff = this.soldByProduct().cutoff;
    for (const m of this.store.moves()) {
      if (m.kind !== 'sale' || m.at < cutoff) continue;
      const p = this.store.product(m.itemId);
      if (!p) continue;
      sold.set(p.category, (sold.get(p.category) ?? 0) + Math.abs(m.qty));
    }
    const rows = this.byCategory().map((c) => {
      const units = this.store
        .products()
        .filter((p) => p.category === c.name)
        .reduce((a, p) => a + Object.values(p.stock).reduce((b, q) => b + q, 0), 0);
      const s = sold.get(c.name) ?? 0;
      const denom = s + units;
      return { name: c.name, pct: denom > 0 ? (s / denom) * 100 : 0 };
    });
    return rows.sort((a, b) => b.pct - a.pct);
  });

  protected readonly sellThrough = computed(() => {
    const sold = this.soldByProduct().total;
    const onHand = this.store.unitsOnHand();
    const denom = sold + onHand;
    return denom > 0 ? (sold / denom) * 100 : 0;
  });

  protected readonly fastest = computed(() => this.sellThroughByCategory()[0] ?? null);

  protected readonly expiryLots = computed<ExpiryRow[]>(() => {
    const now = Date.now();
    return this.store
      .batches()
      .filter((b) => b.status === 'released' && b.left > 0)
      .map((b) => {
        const p = this.store.product(b.productId) ?? this.store.productForVariant(b.productId);
        return {
          id: b.id,
          lot: b.lot,
          product: p ? [p.name, p.size].filter(Boolean).join(' ') : b.productId,
          left: b.left,
          days: Math.round((b.expiresAt - now) / 86400000),
          value: b.left * (p?.cost ?? 0),
        };
      })
      .filter((l) => l.days >= 0 && l.days <= 90)
      .sort((a, b) => a.days - b.days);
  });

  protected readonly expiringValue = computed(() =>
    this.expiryLots().reduce((a, l) => a + l.value, 0),
  );

  protected readonly expiryBuckets = computed(() => {
    const lots = this.expiryLots();
    const bucket = (lo: number, hi: number) => {
      const rows = lots.filter((l) => (lo === 0 ? l.days >= 0 : l.days > lo) && l.days <= hi);
      return {
        label: lo === 0 ? '≤ 30 days' : lo === 30 ? '31–60 days' : '61–90 days',
        value: rows.reduce((a, l) => a + l.value, 0),
        lots: rows.length,
        units: rows.reduce((a, l) => a + l.left, 0),
      };
    };
    return [bucket(0, 30), bucket(30, 60), bucket(60, 90)];
  });

  protected readonly deadStock = computed(() => {
    const sold = this.soldByProduct().map;
    return this.store
      .products()
      .filter((p) => !sold.has(p.id) && Object.values(p.stock).some((units) => units > 0))
      .map((p) => {
        const onHand = Object.values(p.stock).reduce((a, b) => a + b, 0);
        return { id: p.id, name: `${p.name} ${p.size}`, onHand, value: onHand * p.cost };
      });
  });

  protected locationName(id: string): string {
    return this.store.location(id)?.name ?? id;
  }

  protected compact(value: number): string {
    return moneyCompact(value);
  }

  protected exportStock(): void {
    const header = 'Product,Free,Sold,Days,Status\n';
    const rows = this.coverRows()
      .map((r) =>
        [r.name, r.free, r.sold, r.days ?? 'No recent sales', r.status].map(csvCell).join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vessa-stock.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}