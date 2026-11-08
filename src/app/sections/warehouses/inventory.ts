import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { count as fmtCount, money as fmtMoney, titleCase } from '../../core/format';
import { Icon } from '../../ui/icon';
import {
  ApiInventorySummaryItem,
  InventoryApiService,
  type InventoryItemType,
} from '../../core/inventory-api.service';
import { CatalogueApiService, type ApiProductVariant } from '../../core/catalogue-api.service';
import { MaterialsApiService, type ApiMaterial } from '../../core/materials-api.service';
import { ProductionApiService } from '../../core/production-api.service';
import { ReturnsApiService } from '../../core/returns-api.service';

interface VariantRef {
  sku: string;
  price: number;
  productName: string;
  size: string;
  colour: string;
}

interface MaterialRef {
  name: string;
  category: string;
}

interface StockRow {
  itemType: InventoryItemType;
  itemId: string;
  label: string;
  quantity: number;
  movements: string;
  value: number | null;
}

interface LedgerReport {
  total: number;
  valid: number;
  broken: number;
  headHash: string | null;
}

function lookupError(err: unknown): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : String(err);
}

function movementLabel(movementType: string): string {
  return titleCase(movementType.toLowerCase().replace(/_/g, ' '));
}

function downloadCsv(name: string, rows: (string | number)[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function shortId(itemId: string): string {
  return itemId.slice(0, 8);
}

function materialCategoryLabel(category: string): string {
  return category ? movementLabel(category) : 'None';
}

function fingerprint(hash: string | null): string | null {
  return hash ? hash.slice(0, 16) : null;
}

@Component({
  selector: 'app-warehouses-inventory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Stock ledger</span>
        <h1 class="head__title">Inventory</h1>
        <p class="head__lead">
          Every tracked item, its net movement history and estimated value.
          Stock is never edited here — detail pages record audited movements.
        </p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--ghost" (click)="exportCsv()">
          <app-icon name="download" [size]="15" />
          Export CSV
        </button>
        <button type="button" class="btn btn--primary" (click)="checkLedger()">
          <app-icon name="shield" [size]="15" />
          Check ledger
        </button>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Finished units</span>
        <span class="kpi__value">{{ count(finishedUnits()) }}</span>
        <span class="kpi__meta">variant units on hand</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Finished value</span>
        <span class="kpi__value">{{ money(finishedValue()) }}</span>
        <span class="kpi__meta">estimated at unit price</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Raw materials</span>
        <span class="kpi__value">{{ count(materialCount()) }}</span>
        <span class="kpi__meta">tracked material items</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Work in progress</span>
        <span class="kpi__value">{{ count(wipUnits()) }}</span>
        <span class="kpi__meta">units still in the queue</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Returns awaiting</span>
        <span class="kpi__value">{{ count(returnsAwaiting()) }}</span>
        <span class="kpi__meta">requested by customers</span>
      </article>
    </section>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Item type filter">
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
          All {{ rows().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'variant'" [attr.aria-pressed]="filter() === 'variant'" (click)="filter.set('variant')">
          Finished goods {{ finishedUnits() === 0 ? '' : finishedCount() }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'material'" [attr.aria-pressed]="filter() === 'material'" (click)="filter.set('material')">
          Raw materials {{ materialCount() }}
        </button>
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <span class="sr-only">Search inventory</span>
        <input type="search" placeholder="Search items…" [ngModel]="query()" (ngModelChange)="query.set($event)" name="invQuery" />
      </label>
    </div>

    @if (ledgerReport(); as report) {
      <div class="notice" [class.notice--error]="report.broken > 0" role="status">
        @if (report.broken === 0) {
          Ledger verified: {{ count(report.valid) }} of {{ count(report.total) }} entries intact.
        } @else {
          {{ count(report.broken) }} of {{ count(report.total) }} ledger entries do not match their record.
        }
        @if (fp(); as fpShort) {
          <span class="sub">Latest entry fingerprint: {{ fpShort }}</span>
        }
      </div>
    }

    @if (loading() && rows().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 58px"></div>
        }
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Type</th>
                <th scope="col" class="num">In stock</th>
                <th scope="col">In and out by movement</th>
                <th scope="col" class="num">Estimated value</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visible(); track key(row)) {
                <tr>
                  <td>
                    <a class="row-link" [routerLink]="detailLink(row)">{{ row.label }}</a>
                    <span class="sub mono">{{ row.itemId }}</span>
                  </td>
                  <td>{{ kindLabel(row.itemType) }}</td>
                  <td class="num">{{ count(row.quantity) }}</td>
                  <td class="sub-cell">{{ row.movements }}</td>
                  <td class="num">{{ row.value === null ? '—' : money(row.value) }}</td>
                  <td>
                    <a class="btn btn--ghost btn--xs" [routerLink]="detailLink(row)">Open</a>
                  </td>
                </tr>
              }
              @if (!loading() && visible().length === 0 && !error()) {
                <tr>
                  <td colspan="6" class="empty">
                    {{ rows().length === 0 ? 'No stock recorded yet' : 'No items match these filters' }}
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
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .row-link { font-weight: 700; color: var(--text); }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .mono { font-family: var(--fs-mono, monospace); }
    .sub-cell { color: var(--muted); font-size: var(--fs-xs); }
    .search input {
      height: 38px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px;
      background: var(--surface); color: var(--text); font-size: var(--fs-md); min-width: 210px;
    }
    .search input:focus-visible { outline: 2px solid var(--primary); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .notice {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs); margin-bottom: var(--gap);
    }
    .notice--error { border-color: var(--bad); color: var(--bad); }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
  `,
})
export class WarehouseStock {
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly productionApi = inject(ProductionApiService);
  private readonly returnsApi = inject(ReturnsApiService);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<ApiInventorySummaryItem[]>([]);
  protected readonly variantsRef = signal<Map<string, VariantRef>>(new Map());
  protected readonly materialsRef = signal<Map<string, MaterialRef>>(new Map());
  protected readonly filter = signal<'all' | InventoryItemType>('all');
  protected readonly ledgerReport = signal<LedgerReport | null>(null);
  protected readonly ledgerBus = signal(false);
  protected readonly wip = signal(0);
  protected readonly returnsAwaitingRequested = signal(0);
  protected readonly query = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [summaryResult] = await Promise.allSettled([
        this.inventoryApi.summary(),
        this.catalogueApi
          .list({ page: 1, limit: 100 })
          .then((list) => {
            const index = new Map<string, VariantRef>();
            for (const product of list.data) {
              for (const variant of product.variants) {
                index.set(variant.id, {
                  sku: variant.sku,
                  price: variant.priceOverride ?? product.basePrice,
                  productName: product.name,
                  size: variant.size ?? product.sizeClass ?? '',
                  colour: variant.colour ?? '',
                });
              }
            }
            this.variantsRef.set(index);
          })
          .catch(() => this.variantsRef.set(new Map())),
        this.materialsApi
          .list({ page: 1, limit: 100 })
          .then((list) => {
            const index = new Map<string, MaterialRef>();
            for (const material of list.data as ApiMaterial[]) {
              index.set(material.id, { name: material.name, category: material.category ?? '' });
            }
            this.materialsRef.set(index);
          })
          .catch(() => this.materialsRef.set(new Map())),
        this.productionApi
          .list(1, 100)
          .then((list) => {
            const stages = list.stages ?? [];
            const lastStage = stages[stages.length - 1];
            const wip = stages.length
              ? list.data.filter(
                  (b) => (stages as string[]).indexOf(b.stage) < (stages as string[]).indexOf(lastStage),
                )
              : [];
            this.wip.set(wip.reduce((a, b) => a + b.quantity, 0));
          })
          .catch(() => this.wip.set(0)),
        this.returnsApi
          .list(1, 50)
          .then((list) =>
            this.returnsAwaitingRequested.set(
              list.data.filter((r) => r.status === 'requested').length,
            ),
          )
          .catch(() => this.returnsAwaitingRequested.set(0)),
      ]);
      if (summaryResult.status === 'fulfilled') {
        this.summary.set(summaryResult.value);
      } else {
        this.error.set(lookupError(summaryResult.reason));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected kindLabel(itemType: string): string {
    const normalized = itemType.toLowerCase();
    if (normalized === 'variant') return 'Finished goods';
    if (normalized === 'material') return 'Raw materials';
    return itemType;
  }

  protected labelForItemType(itemType: string, itemId: string): string {
    if (itemType.toLowerCase() === 'variant') {
      return this.variantsRef().get(itemId)?.sku ?? shortId(itemId);
    }
    if (itemType.toLowerCase() === 'material') {
      return this.materialsRef().get(itemId)?.name ?? shortId(itemId);
    }
    return shortId(itemId);
  }

  protected priceFor(row: ApiInventorySummaryItem): number | null {
    if (row.itemType.toLowerCase() !== 'variant') return null;
    return this.variantsRef().get(row.itemId)?.price ?? null;
  }

  protected movementsText(row: ApiInventorySummaryItem): string {
    return Object.entries(row.byMovementType)
      .map(([movementType, delta]) => `${movementLabel(movementType)} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`)
      .join(', ');
  }

  protected readonly rows = computed<StockRow[]>(() =>
    this.summary().map((source) => {
      const itemType = (source.itemType.toLowerCase() === 'variant'
        ? 'variant'
        : 'material') as InventoryItemType;
      const price = this.priceFor(source);
      return {
        itemType,
        itemId: source.itemId,
        label: this.labelForItemType(source.itemType, source.itemId),
        quantity: source.currentQuantity,
        movements: this.movementsText(source) || 'No movements',
        value: price === null ? null : price * source.currentQuantity,
      };
    }),
  );

  protected readonly finishedCount = computed(() =>
    this.rows().filter((r) => r.itemType === 'variant').length,
  );

  protected readonly finishedUnits = computed(() =>
    this.rows().filter((r) => r.itemType === 'variant').reduce((a, r) => a + r.quantity, 0),
  );

  protected readonly finishedValue = computed(() =>
    this.rows().reduce((a, r) => a + (r.value ?? 0), 0),
  );

  protected readonly materialCount = computed(() =>
    this.rows().filter((r) => r.itemType === 'material').length,
  );

  protected readonly returnsAwaiting = computed(() => this.returnsAwaitingRequested());
  protected readonly wipUnits = computed(() => this.wip());

  protected readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    const type = this.filter();
    return this.rows().filter(
      (row) =>
        (type === 'all' || row.itemType === type) &&
        (!term ||
          row.label.toLowerCase().includes(term) ||
          row.itemId.toLowerCase().includes(term)),
    );
  });

  protected key(row: StockRow): string {
    return `${row.itemType}:${row.itemId}`;
  }

  protected detailLink(row: StockRow): string {
    return `/warehouses/inventory/${row.itemType}/${row.itemId}`;
  }

  protected fp(): string | null {
    return fingerprint(this.ledgerReport()?.headHash ?? null);
  }

  protected checkLedger(): void {
    if (this.ledgerBus()) return;
    this.ledgerBus.set(true);
    this.inventoryApi
      .ledgerVerify()
      .then((report) => this.ledgerReport.set(report))
      .catch((err) => this.error.set(lookupError(err)))
      .finally(() => this.ledgerBus.set(false));
  }

  protected exportCsv(): void {
    const scope = this.filter() === 'all' ? 'all' : this.filter();
    downloadCsv(`inventory-${scope}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Item', 'Type', 'CurrentUnits', 'Value'],
      ...this.visible().map((row) => [
        row.label,
        row.itemType === 'variant' ? 'finished' : 'material',
        row.quantity,
        row.value ?? '',
      ]),
    ]);
  }
}
