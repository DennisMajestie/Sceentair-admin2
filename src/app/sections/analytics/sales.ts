import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, money as fmtMoney } from '../../core/format';
import { Icon } from '../../ui/icon';
import {
  RANGES,
  channelRows,
  ordersIn,
  orderRevenue,
  orderUnits,
  pctDelta,
  previousWindow,
  stateRows,
  totalsOf,
  windowFor,
} from './reports';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
  share: number;
  daily: number;
}

interface BuyerRow {
  id: string;
  name: string;
  place: string;
  orders: number;
  revenue: number;
  share: number;
  last: number;
}

@Component({
  selector: 'app-analytics-sales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Who buys, what sells, and when</span>
        <h1 class="head__title">Sales</h1>
        <p class="head__lead">Channel mix, the buyers behind it and the products carrying it.</p>
      </div>
      <div class="head__actions">
        <div class="seg" role="group" aria-label="Range">
          @for (r of ranges; track r.id) {
            <button type="button" class="seg__btn" [class.is-on]="range() === r.id" [attr.aria-pressed]="range() === r.id" (click)="range.set(r.id)">
              {{ r.label }}
            </button>
          }
        </div>
        <button type="button" class="btn btn--ghost" (click)="exportCsv()">
          <app-icon name="download" [size]="14" />
          Export orders
        </button>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Revenue</span>
        <span class="kpi__value">{{ money(totals().revenue) }}</span>
        <span class="kpi__meta">
          @if (delta('revenue') !== null) {
            <span class="delta" [class.delta--good]="delta('revenue')! >= 0" [class.delta--bad]="delta('revenue')! < 0">
              <app-icon [name]="delta('revenue')! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="11" />
              {{ pct(delta('revenue')!) }}
            </span>
          }
          vs previous period
        </span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Orders</span>
        <span class="kpi__value">{{ count(totals().orders) }}</span>
        <span class="kpi__meta">
          @if (delta('orders') !== null) {
            <span class="delta" [class.delta--good]="delta('orders')! >= 0" [class.delta--bad]="delta('orders')! < 0">
              <app-icon [name]="delta('orders')! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="11" />
              {{ pct(delta('orders')!) }}
            </span>
          }
          vs previous period
        </span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Average order</span>
        <span class="kpi__value">{{ money(totals().aov) }}</span>
        <span class="kpi__meta">
          @if (delta('aov') !== null) {
            <span class="delta" [class.delta--good]="delta('aov')! >= 0" [class.delta--bad]="delta('aov')! < 0">
              <app-icon [name]="delta('aov')! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="11" />
              {{ pct(delta('aov')!) }}
            </span>
          }
          across all channels
        </span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Units sold</span>
        <span class="kpi__value">{{ count(totals().units) }}</span>
        <span class="kpi__meta">
          @if (delta('units') !== null) {
            <span class="delta" [class.delta--good]="delta('units')! >= 0" [class.delta--bad]="delta('units')! < 0">
              <app-icon [name]="delta('units')! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="11" />
              {{ pct(delta('units')!) }}
            </span>
          }
          net of cancellations
        </span>
      </article>
    </section>

    <section class="grid grid--2">
      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Revenue by channel</h2>
            <p class="card__sub">Last {{ window().days }} days</p>
          </div>
        </div>
        <ul class="rows">
          @for (c of channels(); track c.id) {
            <li class="tile row--tint chan">
              <span class="chan__name">
                <strong>{{ c.label }}</strong>
                <span>{{ c.orders }} orders · {{ count(c.units) }} units</span>
              </span>
              <span class="chan__bar">
                <span class="meter"><span class="meter__fill" [style.width.%]="c.pct" [style.background]="c.color"></span></span>
              </span>
              <span class="num chan__value">{{ money(c.revenue) }}</span>
              <span class="chan__pct">{{ c.pct.toFixed(0) }}%</span>
            </li>
          }
        </ul>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Sales by state</h2>
            <p class="card__sub">Where the revenue ships to</p>
          </div>
        </div>
        <ul class="rows">
          @for (b of buyers(); track b.id) {
            <li class="tile row--tint buyer">
              <span class="buyer__name">
                <strong>{{ b.name }}</strong>
                <span>{{ b.place }} · {{ b.orders }} orders · last {{ ago(b.last) }}</span>
              </span>
              <span class="num buyer__value">{{ money(b.revenue) }}</span>
            </li>
          }
        </ul>
        <p class="insight">{{ topState() }}</p>
      </article>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Products</h2>
          <p class="card__sub">Last {{ window().days }} days · sorted by revenue</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="num-col">Units</th>
              <th class="num-col">Revenue</th>
              <th class="num-col">Share</th>
              <th class="num-col">Daily units</th>
            </tr>
          </thead>
          <tbody>
            @for (p of products(); track p.id) {
              <tr>
                <td>
                  <a class="prod" [routerLink]="'/products/item/' + p.id">
                    <strong>{{ p.name }}</strong>
                    <span class="mono">{{ p.sku }}</span>
                  </a>
                </td>
                <td class="num-col">{{ count(p.units) }}</td>
                <td class="num-col">{{ money(p.revenue) }}</td>
                <td class="num-col">{{ p.share.toFixed(1) }}%</td>
                <td class="num-col">{{ p.daily.toFixed(1) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__meta { display: flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--muted); }
    .kpi__meta .delta { display: inline-flex; align-items: center; gap: 2px; }
    .grid { margin-bottom: var(--gap); }
    .chan, .buyer { display: grid; grid-template-columns: minmax(140px, 1.4fr) 1fr auto auto; align-items: center; gap: 12px; }
    .buyer { grid-template-columns: 1fr auto; }
    .chan__name, .buyer__name { display: grid; line-height: 1.25; }
    .chan__name span, .buyer__name span { font-size: var(--fs-2xs); color: var(--faint); }
    .chan__bar .meter { display: block; }
    .chan__value, .buyer__value { font-size: var(--fs-sm); text-align: right; min-width: 76px; }
    .chan__pct { font-size: var(--fs-xs); color: var(--faint); min-width: 34px; text-align: right; }
    .insight { margin: 12px 0 0; font-size: var(--fs-sm); color: var(--muted); }
    .prod { display: grid; line-height: 1.25; }
    .prod span { font-size: var(--fs-2xs); color: var(--faint); }
    .num-col { text-align: right; font-variant-numeric: tabular-nums; }
  `,
})
export class AnalyticsSales {
  protected readonly store = inject(Store);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly ranges = RANGES.filter((r) => r.id !== 'ytd');
  protected readonly range = signal('30');

  protected readonly window = computed(() =>
    windowFor(this.spec(), Date.now(), this.store.settings().company.fiscalStart),
  );

  protected readonly spec = computed(() => RANGES.find((r) => r.id === this.range()) ?? RANGES[0]);

  protected readonly scoped = computed(() =>
    ordersIn(this.store.orders(), this.window().start, this.window().end),
  );

  protected readonly scopedPrev = computed(() => {
    const p = previousWindow(this.window(), this.spec());
    return ordersIn(this.store.orders(), p.start, p.end);
  });

  protected readonly totals = computed(() => totalsOf(this.scoped(), this.costOf));

  protected readonly prevTotals = computed(() => totalsOf(this.scopedPrev(), this.costOf));

  protected readonly channels = computed(() => channelRows(this.scoped()));

  protected readonly buyers = computed<BuyerRow[]>(() => {
    const map = new Map<string, { name: string; revenue: number; orders: number; last: number }>();
    let grand = 0;
    for (const o of this.scoped()) {
      const entry = map.get(o.customerId) ?? {
        name: o.customerName || 'Guest',
        revenue: 0,
        orders: 0,
        last: 0,
      };
      entry.revenue += orderRevenue(o);
      entry.orders += 1;
      entry.last = Math.max(entry.last, o.createdAt);
      map.set(o.customerId, entry);
      grand += orderRevenue(o);
    }
    return [...map.entries()]
      .map(([id, v]) => {
        const c = this.store.customer(id);
        return {
          id,
          name: c?.name ?? v.name,
          place: c ? `${c.city}, ${c.region}` : '',
          orders: v.orders,
          revenue: Math.round(v.revenue),
          share: grand > 0 ? (v.revenue / grand) * 100 : 0,
          last: v.last,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  });

  protected readonly topState = computed(() => {
    const rows = stateRows(this.scoped(), (o) => this.store.customer(o.customerId)?.region ?? '—');
    if (rows.length === 0) return '';
    const top = rows[0];
    return `${top.name} leads with ${this.money(top.revenue)} across ${top.orders} orders — ${top.pct.toFixed(0)}% of the total.`;
  });

  protected readonly products = computed<ProductRow[]>(() => {
    const sales = new Map<string, { units: number; revenue: number }>();
    let grand = 0;
    for (const o of this.scoped()) {
      for (const l of o.lines) {
        const row = sales.get(l.productId) ?? { units: 0, revenue: 0 };
        row.units += l.qty;
        row.revenue += l.qty * l.price;
        sales.set(l.productId, row);
        grand += l.qty * l.price;
      }
    }
    const rows = [...sales.entries()]
      .map(([id, sale]) => {
        const p = this.store.product(id) ?? this.store.productForVariant(id);
        return {
          id,
          name: p ? [p.name, p.size].filter(Boolean).join(' ') : id,
          sku: p?.sku ?? '',
          units: sale.units,
          revenue: Math.round(sale.revenue),
          share: grand > 0 ? (sale.revenue / grand) * 100 : 0,
          daily: sale.units / Math.max(1, this.window().days),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    return rows;
  });

  protected delta(key: 'revenue' | 'orders' | 'units' | 'aov'): number | null {
    return pctDelta(this.totals()[key], this.prevTotals()[key]);
  }

  protected pct(value: number): string {
    if (value === 0) return '0.0% flat';
    return `${Math.abs(value).toFixed(1)}%${value < 0 ? ' below' : ' above'}`;
  }

  protected ago(at: number): string {
    const days = Math.max(0, Math.round((Date.now() - at) / 86400000));
    if (days === 0) return 'today';
    if (days === 1) return '1 d ago';
    return `${days} d ago`;
  }

  protected exportCsv(): void {
    const header = 'Product,Units,Revenue,Share\n';
    const rows = this.products()
      .map((p) =>
        [p.name, p.units, p.revenue, `${p.share.toFixed(1)}%`].map(csvCell).join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vessa-sales.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private readonly costOf = (id: string): number => this.store.product(id)?.cost ?? 0;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
