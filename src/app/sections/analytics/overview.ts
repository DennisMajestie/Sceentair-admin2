import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { count as fmtCount, money as fmtMoney, moneyCompact } from '../../core/format';
import { Sparkline, Donut } from '../../ui/chart';
import { Icon } from '../../ui/icon';
import {
  CHANNEL_LABELS,
  Granularity,
  RANGES,
  bestDay,
  categoryRows,
  channelRows,
  granularPoints,
  marginPct,
  ordersIn,
  orderRevenue,
  orderUnits,
  pctDelta,
  previousWindow,
  totalsOf,
  windowFor,
} from './reports';

@Component({
  selector: 'app-analytics-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sparkline, Donut, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Build a report from your own numbers</span>
        <h1 class="head__title">Reports</h1>
        <p class="head__lead">Revenue, orders and stock value across every door.</p>
      </div>
      <div class="head__actions">
        <div class="seg" role="group" aria-label="Range">
          @for (r of ranges; track r.id) {
            <button type="button" class="seg__btn" [class.is-on]="range() === r.id" [attr.aria-pressed]="range() === r.id" (click)="setRange(r.id)">
              {{ r.label }}
            </button>
          }
        </div>
        <button type="button" class="btn btn--ghost" (click)="exportCsv()">
          <app-icon name="download" [size]="14" />
          Export CSV
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
        <span class="stat__label">Units sold</span>
        <span class="kpi__value">{{ count(totals().units) }}</span>
        <span class="kpi__meta">
          @if (delta('units') !== null) {
            <span class="delta" [class.delta--good]="delta('units')! >= 0" [class.delta--bad]="delta('units')! < 0">
              <app-icon [name]="delta('units')! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="11" />
              {{ pct(delta('units')!) }}
            </span>
          }
          vs previous period · net of cancellations
        </span>
      </article>

      <article class="card kpi">
        <span class="stat__label">Avg order value</span>
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
        <span class="stat__label">Stock value</span>
        <span class="kpi__value">{{ money(store.stockValue()) }}</span>
        <span class="kpi__meta">at cost, on hand now</span>
      </article>

      <article class="card kpi">
        <span class="stat__label">Gross margin</span>
        <span class="kpi__value">{{ margin().toFixed(1) }}<span class="kpi__suffix">%</span></span>
        <span class="kpi__meta">revenue less cost of goods</span>
      </article>
    </section>

    <section class="card chart-card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Revenue</h2>
          <p class="card__sub">
            @if (range() === 'ytd') { Fiscal year to date } @else { Last {{ window().days }} days }
            · by {{ granularity() }}
          </p>
        </div>
        <div class="card__tools">
          <div class="seg" role="group" aria-label="Granularity">
            @for (g of granularities; track g.id) {
              <button type="button" class="seg__btn" [class.is-on]="granularity() === g.id" [attr.aria-pressed]="granularity() === g.id" (click)="granularity.set(g.id)">
                {{ g.label }}
              </button>
            }
          </div>
          <button type="button" class="btn btn--ghost btn--sm" [class.is-on]="compare()" [attr.aria-pressed]="compare()" (click)="toggleCompare()">
            Compare
          </button>
        </div>
      </div>

      <div class="chart-box">
        <app-sparkline
          [values]="pointValues()"
          [width]="760"
          [height]="200"
          [showGrid]="true"
          [showDots]="granularity() === 'day'"
          [label]="'revenue by ' + granularity()"
        />
      </div>
      <div class="axis">
        @for (p of points(); track p.label) {
          <span>{{ p.label }}</span>
        }
      </div>

      <div class="chips">
        <button type="button" class="chip" [class.is-on]="channel() === 'all'" [attr.aria-pressed]="channel() === 'all'" (click)="channel.set('all')">All channels</button>
        @for (c of channelKeys; track c) {
          <button type="button" class="chip" [class.is-on]="channel() === c" [attr.aria-pressed]="channel() === c" (click)="channel.set(c)">
            {{ channelLabel(c) }}
          </button>
        }
      </div>

      <p class="compare">
        <strong>{{ money(totals().revenue) }}</strong> in last {{ window().days }} days
        @if (compare() && delta('revenue') !== null) {
          — {{ pct(delta('revenue')!) }} the period before.
        }
        @if (best(); as bd) {
          Best day: {{ bd.label }} ({{ money(bd.value) }}).
        }
      </p>

      <div class="goal">
        <span>
          This month <strong>{{ money(monthToDate()) }}</strong> of a
          <strong>{{ money(store.settings().goal) }}</strong> goal
        </span>
        <span class="meter goal__meter">
          <span class="meter__fill" [style.width.%]="goalPct()"></span>
        </span>
        <span class="goal__pct">{{ goalPct().toFixed(0) }}%</span>
        <button type="button" class="btn btn--ghost btn--xs" (click)="editGoal()">Edit goal</button>
      </div>
    </section>

    <section class="grid grid--2">
      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">By channel</h2>
            <p class="card__sub">Revenue by channel, {{ range() === 'ytd' ? 'fiscal year to date' : 'last ' + window().days + ' days' }}</p>
          </div>
        </div>
        <div class="donut-row">
          <app-donut [data]="donutData()" [size]="150" [center]="compact(totals().revenue)" caption="revenue" />
          <ul class="legend legend--stack">
            @for (c of channels(); track c.id) {
              <li class="legend__item">
                <span class="legend__swatch" [style.background]="c.color"></span>
                <span class="legend__name">{{ c.label }}</span>
                <span class="num">{{ money(c.revenue) }}</span>
                <span class="legend__pct">{{ c.pct.toFixed(0) }}%</span>
              </li>
            }
          </ul>
        </div>
      </article>

      <article class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">By category</h2>
            <p class="card__sub">Revenue</p>
          </div>
        </div>
        <ul class="rows">
          @for (c of categories(); track c.name) {
            <li class="tile row--tint cat">
              <span class="cat__name">{{ c.name }}</span>
              <span class="cat__bar">
                <span class="meter"><span class="meter__fill" [style.width.%]="c.pct"></span></span>
              </span>
              <span class="num">{{ money(c.revenue) }}</span>
            </li>
          }
        </ul>
        @if (leader(); as lead) {
          <p class="insight">{{ lead.name }} leads with {{ money(lead.revenue) }} — {{ lead.pct.toFixed(0) }}% of the total.</p>
        }
      </article>
    </section>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__suffix { font-size: var(--fs-xl); color: var(--muted); }
    .kpi__meta { display: flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--muted); }
    .kpi__meta .delta { display: inline-flex; align-items: center; gap: 2px; }
    .chart-card { margin-bottom: var(--gap); }
    .chart-box { height: 200px; }
    .axis { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: var(--fs-2xs); color: var(--faint); overflow: hidden; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .compare { margin: 14px 0 0; font-size: var(--fs-sm); color: var(--muted); }
    .compare strong { color: var(--text); }
    .goal { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); font-size: var(--fs-sm); }
    .goal__meter { min-width: 120px; }
    .goal__pct { font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; }
    .grid { margin-bottom: var(--gap); }
    .donut-row { display: flex; align-items: center; gap: 18px; }
    .legend--stack { display: grid; gap: 9px; align-content: center; flex: 1; }
    .legend__name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .legend__pct { font-size: var(--fs-xs); color: var(--faint); min-width: 32px; text-align: right; }
    .cat { display: grid; grid-template-columns: minmax(90px, 1fr) 1fr auto; align-items: center; gap: 12px; }
    .cat__bar .meter { display: block; }
    .insight { margin: 12px 0 0; font-size: var(--fs-sm); color: var(--muted); }
  `,
})
export class AnalyticsOverview {
  protected readonly store = inject(Store);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly ranges = RANGES;
  protected readonly granularities: { id: Granularity; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  protected readonly channelKeys = ['wholesale', 'online', 'studio'];

  protected readonly range = signal('30');
  protected readonly granularity = signal<Granularity>('day');
  protected readonly channel = signal('all');
  protected readonly compare = signal(false);

  protected readonly window = computed(() =>
    windowFor(this.spec(), Date.now(), this.store.settings().company.fiscalStart),
  );

  protected readonly spec = computed(() => RANGES.find((r) => r.id === this.range()) ?? RANGES[0]);

  protected readonly scoped = computed(() => {
    const w = this.window();
    const rows = ordersIn(this.store.orders(), w.start, w.end);
    return this.channel() === 'all' ? rows : rows.filter((o) => o.channel === this.channel());
  });

  protected readonly scopedPrev = computed(() => {
    const w = this.window();
    const p = previousWindow(w, this.spec());
    const rows = ordersIn(this.store.orders(), p.start, p.end);
    return this.channel() === 'all' ? rows : rows.filter((o) => o.channel === this.channel());
  });

  protected readonly totals = computed(() => totalsOf(this.scoped(), this.costOf));

  protected readonly prevTotals = computed(() => totalsOf(this.scopedPrev(), this.costOf));

  protected readonly margin = computed(() => marginPct(this.totals()));

  protected readonly points = computed(() =>
    granularPoints(
      this.scoped(),
      this.window(),
      this.granularity(),
      this.store.settings().prefs.weekStart === 'sun' ? 'sun' : 'mon',
    ),
  );

  protected readonly pointValues = computed(() => this.points().map((p) => p.value));

  protected readonly best = computed(() => bestDay(this.points()));

  protected readonly channels = computed(() => channelRows(this.scoped()));

  protected readonly donutData = computed(() =>
    this.channels().map((c) => ({ label: c.label, value: c.revenue, color: c.color })),
  );

  protected readonly categories = computed(() =>
    categoryRows(this.scoped(), (id) => this.store.product(id)),
  );

  protected readonly leader = computed(() => this.categories()[0] ?? null);

  protected readonly monthToDate = computed(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const rows = ordersIn(this.store.orders(), start, now.getTime());
    const scoped = this.channel() === 'all' ? rows : rows.filter((o) => o.channel === this.channel());
    return totalsOf(scoped, this.costOf).revenue;
  });

  protected readonly goalPct = computed(() => {
    const goal = this.store.settings().goal || 1;
    return Math.min(100, (this.monthToDate() / goal) * 100);
  });

  protected delta(key: 'revenue' | 'orders' | 'units' | 'aov'): number | null {
    return pctDelta(this.totals()[key], this.prevTotals()[key]);
  }

  protected pct(value: number): string {
    if (value === 0) return '0.0% flat';
    return `${Math.abs(value).toFixed(1)}%${value < 0 ? ' below' : ' above'}`;
  }

  protected channelLabel(id: string): string {
    return CHANNEL_LABELS[id] ?? id;
  }

  protected setRange(id: string): void {
    this.range.set(id);
    this.granularity.set(id === 'ytd' ? 'month' : id === '90' ? 'week' : 'day');
  }

  protected toggleCompare(): void {
    this.compare.update((v) => !v);
  }

  protected editGoal(): void {
    const goal = Number(prompt('Monthly revenue goal', String(this.store.settings().goal)));
    if (!Number.isNaN(goal) && goal > 0) {
      this.store.setGoal(goal);
    }
  }

  protected exportCsv(): void {
    const header = 'Date,Order,Channel,Units,Revenue\n';
    const rows = this.scoped()
      .map((order) =>
        [
          new Date(order.createdAt).toISOString().slice(0, 10),
          order.number,
          order.channel,
          orderUnits(order),
          orderRevenue(order),
        ]
          .map(csvCell)
          .join(','),
      )
      .join('\n');
    download('vessa-reports.csv', header + rows);
  }

  protected compact(value: number): string {
    return moneyCompact(value);
  }

  private readonly costOf = (id: string): number => this.store.product(id)?.cost ?? 0;
}

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
