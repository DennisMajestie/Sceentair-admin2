import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { count as fmtCount, titleCase } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import { ApiWipSummary, ProductionApiService } from '../../core/production-api.service';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-production-wip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Production</span>
        <h1 class="head__title">Work in progress</h1>
        <p class="head__lead">
          Units on the factory floor and raw materials already issued into open runs. Recomputed
          from live batch and usage records on every load.
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
      <div class="load-center"><app-spinner size="sm" label="Loading work in progress" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load work in progress.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else if (!hasData()) {
      <div class="empty">
        <strong>Nothing on the factory floor.</strong>
        <span>
          No open production batch has units or material usage recorded yet. Start a run in the
          production queue and it will appear here.
        </span>
        <a class="btn btn--ghost" routerLink="/production">Go to production queue</a>
      </div>
    } @else {
      <section class="kpis" aria-label="Work in progress metrics">
        <article class="card kpi">
          <span class="stat__label">Units in production</span>
          <span class="kpi__value">{{ count(units()) }}</span>
          <span class="kpi__meta">across {{ count(batches()) }} active {{ batches() === 1 ? 'batch' : 'batches' }}</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Active batches</span>
          <span class="kpi__value">{{ count(batches()) }}</span>
          <span class="kpi__meta">open production runs</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Stages occupied</span>
          <span class="kpi__value">{{ count(stages().length) }}</span>
          <span class="kpi__meta">with units or batches on the floor</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Materials issued</span>
          <span class="kpi__value">{{ count(materials().length) }}</span>
          <span class="kpi__meta">distinct raw materials in WIP</span>
        </article>
      </section>

      <section class="card panel">
        <h2 class="panel__title">By production stage</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Stage</th><th scope="col" class="num">Batches</th><th scope="col" class="num">Units</th><th scope="col">Share of WIP</th></tr>
            </thead>
            <tbody>
              @for (stage of stages(); track stage.stage) {
                <tr>
                  <td><strong>{{ titleCase(stage.stage) }}</strong></td>
                  <td class="num">{{ count(stage.batches) }}</td>
                  <td class="num">{{ count(stage.units) }}</td>
                  <td>
                    <span class="bar" aria-hidden="true"><i [style.width.%]="share(stage.units)"></i></span>
                    <span class="muted">{{ share(stage.units) }}%</span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted">No active batches on the floor.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card panel">
        <h2 class="panel__title">Materials issued to WIP</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Material</th><th scope="col" class="num">Quantity</th><th scope="col">Unit</th></tr>
            </thead>
            <tbody>
              @for (material of materials(); track material.materialId) {
                <tr>
                  <td><strong>{{ material.materialName }}</strong></td>
                  <td class="num">{{ count(material.quantity) }}</td>
                  <td class="muted">{{ material.unit }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="muted">No materials issued to open runs.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <p class="source">
        This snapshot excludes completed and cancelled batches, and is never stored as a counter
        that can drift from the batches and usage ledger behind it.
      </p>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi__meta, .muted, .source { color: var(--muted); font-size: var(--fs-xs); }
    .panel { margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.08em; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .bar { display: inline-block; width: 90px; height: 6px; margin-right: 8px; border-radius: 99px; background: var(--well); overflow: hidden; vertical-align: middle; }
    .bar i { display: block; height: 100%; background: var(--primary); }
    .empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    .source { margin: 0; }
    @media (max-width: 620px) { .bar { width: 54px; } }
  `,
})
export class ProductionWip {
  private readonly productionApi = inject(ProductionApiService);

  protected readonly count = fmtCount;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly wip = signal<ApiWipSummary | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.wip.set(await this.productionApi.wip());
    } catch (err) {
      this.wip.set(null);
      this.error.set(friendlyErrorMessage(err, 'The production service is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly stages = computed(() => this.wip()?.stages ?? []);
  protected readonly materials = computed(() => this.wip()?.materials ?? []);
  protected readonly units = computed(() => this.wip()?.totalUnits ?? 0);
  protected readonly batches = computed(() => this.wip()?.activeBatches ?? 0);
  protected readonly hasData = computed(
    () => this.stages().length > 0 || this.materials().length > 0,
  );

  protected readonly titleCase = titleCase;

  protected share(units: number): number {
    const total = this.units();
    return total > 0 ? Math.round((units / total) * 100) : 0;
  }
}
