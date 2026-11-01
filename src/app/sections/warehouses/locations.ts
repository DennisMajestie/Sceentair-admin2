import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { count as fmtCount, money as fmtMoney } from '../../core/format';
import { Icon } from '../../ui/icon';
import {
  ApiInventorySummaryItem,
  InventoryApiService,
} from '../../core/inventory-api.service';

const KIND_LABEL: Record<string, string> = {
  VARIANT: 'Finished goods',
  MATERIAL: 'Raw materials',
};

@Component({
  selector: 'app-warehouses-locations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Inventory ledger</span>
        <h1 class="head__title">Stock summary</h1>
        <p class="head__lead">{{ rows().length }} tracked items across finished goods and raw materials.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/warehouses/counts">
          <app-icon name="truck" [size]="14" />
          Cycle counts
        </a>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Tracked items</span>
        <span class="kpi__value">{{ count(rows().length) }}</span>
        <span class="kpi__meta">finished goods and raw materials</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Total on hand</span>
        <span class="kpi__value">{{ count(totalUnits()) }}</span>
        <span class="kpi__meta">units across all tracked items</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Finished goods</span>
        <span class="kpi__value">{{ count(finishedGoodsUnits()) }}</span>
        <span class="kpi__meta">variant units on hand</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Raw materials</span>
        <span class="kpi__value">{{ count(rawMaterialUnits()) }}</span>
        <span class="kpi__meta">material units on hand</span>
      </article>
    </section>

    @if (loading() && rows().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3, 4, 5, 6, 7]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 58px"></div>
        }
      </div>
    } @else {
      <section class="loc-list">
        @for (l of visible(); track l.itemId) {
          <article class="card lcard">
            <div class="lcard__main">
              <span class="lcard__kind">{{ kindLabel(l.itemType) }}</span>
              <span class="lcard__id mono">{{ l.itemId }}</span>
            </div>
            <span class="lcard__qty num">{{ count(l.currentQuantity) }}</span>
          </article>
        }
        @if (!loading() && visible().length === 0 && !error()) {
          <div class="cs-empty">No tracked items found.</div>
        }
      </section>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .loc-list { display: grid; gap: var(--gap); margin-bottom: var(--gap); }
    .lcard { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; padding: 16px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); }
    .lcard__main { display: grid; gap: 2px; line-height: 1.25; }
    .lcard__kind { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .lcard__id { font-size: var(--fs-xs); color: var(--muted); font-family: var(--fs-mono, monospace); }
    .lcard__qty { font-size: var(--fs-xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
    .cs-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
  `,
})
export class WarehouseLocations {
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly router = inject(Router);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ApiInventorySummaryItem[]>([]);

  constructor() {
    void this.loadInventory();
  }

  private async loadInventory(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.inventoryApi.summary({ page: 1, limit: 100 });
      this.items.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load inventory summary.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed<ApiInventorySummaryItem[]>(() => this.items());

  protected readonly finishedGoodsUnits = computed(() =>
    this.items().filter((i) => i.itemType === 'VARIANT').reduce((a, i) => a + i.currentQuantity, 0),
  );
  protected readonly rawMaterialUnits = computed(() =>
    this.items().filter((i) => i.itemType === 'MATERIAL').reduce((a, i) => a + i.currentQuantity, 0),
  );
  protected readonly totalUnits = computed(() =>
    this.items().reduce((a, i) => a + i.currentQuantity, 0),
  );

  protected readonly visible = computed(() => this.rows());

  protected kindLabel(itemType: string): string {
    return KIND_LABEL[itemType] ?? itemType;
  }
}
