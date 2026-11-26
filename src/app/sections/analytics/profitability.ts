import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { count as fmtCount, money as fmtMoney } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import {
  AnalyticsApiService,
  type ProductProfitability,
} from '../../core/analytics-api.service';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-analytics-profitability',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Analytics</span>
        <h1 class="head__title">Product profitability</h1>
        <p class="head__lead">
          Revenue minus the cost of the units sold, per product. A margin is only shown where a
          cost basis is known — never guessed.
        </p>
      </div>
      <div class="head__actions">
        <label class="field-inline">
          <span>Show</span>
          <select [value]="limit()" (change)="onLimit($event)">
            <option [value]="8">Top 8</option>
            <option [value]="20">Top 20</option>
            <option [value]="50">Top 50</option>
          </select>
        </label>
        <button class="btn btn--ghost" type="button" [disabled]="loading()" (click)="load()">
          Refresh
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center"><app-spinner size="sm" label="Loading profitability" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load profitability.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else if (rows().length === 0) {
      <div class="empty">
        <strong>No sold products in this view.</strong>
        <span>Profitability needs completed sales with a known cost basis.</span>
      </div>
    } @else {
      @if (!withRecordedCost()) {
        <p class="notice" role="status">
          No completed batch costs have been recorded yet — cost and margin are estimated from the
          catalogue, not from production records.
        </p>
      }

      <section class="kpis" aria-label="Profitability summary">
        <article class="card kpi">
          <span class="stat__label">Products</span>
          <span class="kpi__value">{{ count(rows().length) }}</span>
          <span class="kpi__meta">in this view</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Revenue</span>
          <span class="kpi__value">{{ money(revenue()) }}</span>
          <span class="kpi__meta">from sold units</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Total margin</span>
          <span class="kpi__value">{{ money(margin()) }}</span>
          <span class="kpi__meta">revenue minus cost of units sold</span>
        </article>
      </section>

      <section class="card panel">
        <h2 class="panel__title">By product</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" class="num">Units sold</th>
                <th scope="col" class="num">Revenue</th>
                <th scope="col" class="num">Cost of units</th>
                <th scope="col" class="num">Margin</th>
                <th scope="col" class="num">Margin %</th>
                <th scope="col">Cost basis</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.productId) {
                <tr>
                  <td><strong>{{ row.productName }}</strong></td>
                  <td class="num">{{ count(row.unitsSold) }}</td>
                  <td class="num">{{ money(row.revenue) }}</td>
                  <td class="num">{{ row.costOfUnitsSold === null ? '—' : money(row.costOfUnitsSold) }}</td>
                  <td class="num" [class.negative]="row.margin !== null && row.margin < 0">
                    {{ row.margin === null ? '—' : money(row.margin) }}
                  </td>
                  <td class="num">{{ row.marginPct === null ? '—' : row.marginPct.toFixed(1) + '%' }}</td>
                  <td><span class="badge" [class.badge--good]="row.costBasis === 'recorded'" [class.badge--warn]="row.costBasis === 'estimated'">{{ basis(row.costBasis) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
  styles: `
    .field-inline { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--muted); }
    .field-inline select { height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--text); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi__meta { color: var(--muted); font-size: var(--fs-xs); }
    .panel { margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.08em; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .negative { color: var(--bad); font-weight: 700; }
    .notice { margin: 0 0 var(--gap); padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs); }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 900px) { .table-wrap { overflow-x: auto; } }
  `,
})
export class AnalyticsProfitability {
  private readonly api = inject(AnalyticsApiService);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly limit = signal(8);
  protected readonly rows = signal<ProductProfitability['products']>([]);
  protected readonly withRecordedCost = signal(false);

  constructor() {
    void this.load();
  }

  protected onLimit(event: Event): void {
    this.limit.set(Number((event.target as HTMLSelectElement).value) || 8);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.productProfitability(this.limit());
      this.rows.set(result.products ?? []);
      this.withRecordedCost.set(result.withRecordedCost ?? false);
    } catch (err) {
      this.rows.set([]);
      this.error.set(friendlyErrorMessage(err, 'The analytics service is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected basis(value: string): string {
    if (value === 'recorded') return 'Recorded';
    if (value === 'estimated') return 'Estimated';
    return 'Unknown';
  }

  protected readonly revenue = computed(() =>
    this.rows().reduce((sum, row) => sum + row.revenue, 0),
  );

  protected readonly margin = computed(() =>
    this.rows().reduce((sum, row) => sum + (row.margin ?? 0), 0),
  );
}
