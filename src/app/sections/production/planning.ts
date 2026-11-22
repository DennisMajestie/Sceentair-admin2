import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { count as fmtCount } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import {
  ApiPlanningRow,
  ProductionApiService,
} from '../../core/production-api.service';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-production-planning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Production</span>
        <h1 class="head__title">Planning</h1>
        <p class="head__lead">
          What to make next: recent sales and open orders minus finished stock and work in progress.
          Refresh after a sale or a batch change to see the suggestion move.
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/production">Production queue</a>
        <button class="btn btn--ghost" type="button" [disabled]="loading()" (click)="load()">
          Refresh
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center"><app-spinner size="md" label="Loading planning suggestions" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load planning suggestions.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else if (rows().length === 0) {
      <div class="empty">
        <strong>No variants need planning.</strong>
        <span>Nothing has recent sales or open orders above the stock and WIP already available.</span>
      </div>
    } @else {
      <section class="kpis" aria-label="Planning summary">
        <article class="card kpi">
          <span class="stat__label">Window</span>
          <span class="kpi__value">{{ count(windowDays()) }}</span>
          <span class="kpi__meta">days of sales counted</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Variants to plan</span>
          <span class="kpi__value">{{ count(rows().length) }}</span>
          <span class="kpi__meta">with demand to cover</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Suggested units</span>
          <span class="kpi__value">{{ count(suggestedUnits()) }}</span>
          <span class="kpi__meta">across all variants</span>
        </article>
      </section>

      <section class="card panel">
        <h2 class="panel__title">Suggested batches</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col" class="num">Sold {{ windowDays() }}d</th>
                <th scope="col" class="num">Open orders</th>
                <th scope="col" class="num">Stock on hand</th>
                <th scope="col" class="num">In production</th>
                <th scope="col" class="num">Suggested</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.variantId) {
                <tr>
                  <td class="mono">{{ row.sku }}</td>
                  <td>{{ row.productName }}</td>
                  <td class="num">{{ count(row.soldLastWindow) }}</td>
                  <td class="num">{{ count(row.openOrderUnits) }}</td>
                  <td class="num">{{ count(row.stockOnHand) }}</td>
                  <td class="num">{{ count(row.inProduction) }}</td>
                  <td class="num"><strong [class.has-suggestion]="row.suggested > 0">{{ count(row.suggested) }}</strong></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <p class="source">
        Suggestions are computed from the order book and inventory ledger on every read; starting a
        batch still follows the normal approval rules.
      </p>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi__meta, .source { color: var(--muted); font-size: var(--fs-xs); }
    .panel { margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.08em; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: var(--fs-mono, monospace); }
    .has-suggestion { color: var(--primary); }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    .source { margin: 0; }
    @media (max-width: 800px) { .table-wrap { overflow-x: auto; } }
  `,
})
export class ProductionPlanning {
  private readonly api = inject(ProductionApiService);

  protected readonly count = fmtCount;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<ApiPlanningRow[]>([]);
  protected readonly windowDays = signal(0);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.planning();
      this.rows.set(result.variants ?? []);
      this.windowDays.set(result.windowDays ?? 0);
    } catch (err) {
      this.rows.set([]);
      this.error.set(friendlyErrorMessage(err, 'The planning service is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly suggestedUnits = computed(() =>
    this.rows().reduce((sum, row) => sum + Math.max(0, row.suggested), 0),
  );
}
