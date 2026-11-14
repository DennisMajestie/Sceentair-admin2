import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { CatalogueApiService, type ApiProductVariant } from '../../core/catalogue-api.service';
import {
  ProductionApiService,
  type ApiProductionBatch,
  type ApiProductionCost,
  type ApiQCRejection,
  type ApiBatchScan,
  type ApiBatchBomRow,
  type QcDisposition,
} from '../../core/production-api.service';
import { money as fmtMoney } from '../../core/format';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { Drawer } from '../../ui/drawer';

interface BatchRow {
  id: string;
  lot: string;
  productName: string;
  variantLabel: string;
  qty: number;
  stage: string;
  createdAt: number;
  plannedDate: string | null;
  completedDate: string | null;
  raw: ApiProductionBatch;
}

@Component({
  selector: 'app-production-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule, ReactiveFormsModule, DatePipe, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Production</span>
        <h1 class="head__title">Production queue</h1>
        <p class="head__lead">
          {{ batches().length }} runs · {{ active().length }} in progress · {{ completed().length }} completed
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/production/tech-packs">Tech packs</a>
        <a class="btn btn--ghost" routerLink="/production/kiosk">Floor kiosk</a>
        <button class="btn btn--primary" type="button" (click)="openCreate()">+ New run</button>
      </div>
    </div>

    <div class="stats" aria-label="Production summary">
      <article class="stat">
        <span class="stat__label">Runs</span>
        <strong class="stat__value">{{ batches().length }}</strong>
        <span class="stat__detail">All production batches</span>
      </article>
      <article class="stat">
        <span class="stat__label">In progress</span>
        <strong class="stat__value">{{ active().length }}</strong>
        <span class="stat__detail">Not yet at the final stage</span>
      </article>
      <article class="stat">
        <span class="stat__label">In QC</span>
        <strong class="stat__value">{{ inQc().length }}</strong>
        <span class="stat__detail">Quality control stage</span>
      </article>
      <article class="stat">
        <span class="stat__label">Completed</span>
        <strong class="stat__value">{{ completed().length }}</strong>
        <span class="stat__detail">Final stage reached</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="stage-tabs" role="tablist" aria-label="Filter by stage">
        <button type="button" class="pill" role="tab" [class.is-on]="stageFilter() === 'all'" (click)="stageFilter.set('all')">All</button>
        @for (stage of stages(); track stage) {
          <button type="button" class="pill" role="tab" [class.is-on]="stageFilter() === stage" (click)="stageFilter.set(stage)">{{ stage }}</button>
        }
      </div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search product, SKU or lot" aria-label="Search production" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} runs</span>
    </div>

    @if (loading()) {
      <div class="load-center" role="status"><app-spinner size="sm" label="Loading production" /></div>
    } @else if (loadError()) {
      <div class="empty"><strong>Couldn't load production.</strong><span>{{ loadError() }}</span><button class="btn btn--ghost" type="button" (click)="load()">Retry</button></div>
    }

    <div class="batch-grid" aria-label="Production batches">
      @for (row of visible(); track row.id) {
        <button type="button" class="batch-card" (click)="openBatch(row.id)" [attr.aria-label]="'Open batch ' + row.lot">
          <span class="batch-card__top">
            <span class="mono batch-card__lot">{{ row.lot }}</span>
            <span class="badge" [class.badge--good]="isFinalStage(row.stage)">{{ row.stage }}</span>
          </span>
          <span class="batch-card__product">{{ row.productName }}</span>
          <span class="batch-card__variant">{{ row.variantLabel }}</span>
          <span class="batch-card__meta">
            <span>{{ row.qty }} units</span>
            @if (row.plannedDate) { <span>· planned {{ row.plannedDate }}</span> }
          </span>
        </button>
      }
      @if (visible().length === 0 && !loading() && !loadError()) {
        <div class="empty"><strong>No batches match.</strong><span>Try another stage or search term.</span></div>
      }
    </div>

    <app-drawer [open]="!!selectedBatch()" (close)="closeBatch()" label="Batch detail">
      <ng-container drawerTitle>
        @if (selectedBatch(); as b) {
          <div class="dtitle">
            <strong class="mono">{{ lotOf(b) }}</strong>
            <span class="dmeta">{{ stageOf(b) }}</span>
          </div>
        }
      </ng-container>
      @if (selectedBatch(); as b) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Variant</span>
              <span class="dmeta">{{ variantLabelOf(b) }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Quantity</span>
              <strong class="dtotal">{{ b.quantity }}</strong>
            </div>
          </div>

          <div class="stage-track" aria-label="Stage progress">
            @for (stage of stages(); track stage; let i = $index) {
              <span class="stage-dot" [class.is-done]="i < stageIndexOf(b)" [class.is-current]="i === stageIndexOf(b)">
                <i></i>{{ stage }}
              </span>
            }
          </div>

          <div class="actions-row">
            @if (!isFinalStage(stageOf(b))) {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="advanceStage()">
                {{ busy() ? 'Working…' : 'Advance to ' + nextStageOf() }}
              </button>
            }
            <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="generateBarcode()">Assign barcode</button>
          </div>

          @if (barcodeInputOpen()) {
            <form class="barcode-row" (ngSubmit)="saveBarcode()">
              <input type="text" [formControl]="barcodeControl" placeholder="Scan barcode value" aria-label="Barcode value" />
              <button class="btn btn--primary" type="submit" [disabled]="barcodeControl.invalid || busy()">Save</button>
            </form>
          }

          <h3 class="dlabel">Bill of materials</h3>
          @if (bom().length) {
            <div class="table-wrap">
              <table>
                <thead><tr><th scope="col">Material</th><th scope="col">Planned</th><th scope="col">Consumed</th><th scope="col">Unit</th></tr></thead>
                <tbody>
                  @for (row of bom(); track row.materialId) {
                    <tr>
                      <td>{{ row.materialName }}</td>
                      <td class="num">{{ row.plannedQuantity }}</td>
                      <td class="num" [class.neg]="row.consumedQuantity > row.plannedQuantity">{{ row.consumedQuantity }}</td>
                      <td>{{ row.unit }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="note">No BOM recorded for this batch.</p>
          }

          <h3 class="dlabel">Cost breakdown</h3>
          @if (cost(); as c) {
            <dl class="facts">
              <div><dt>Material</dt><dd>{{ money(c.materialCost) }}</dd></div>
              <div><dt>Sewing</dt><dd>{{ money(c.sewingCost) }}</dd></div>
              <div><dt>Branding</dt><dd>{{ money(c.brandingCost) }}</dd></div>
              <div><dt>Packaging</dt><dd>{{ money(c.packagingCost) }}</dd></div>
              <div><dt>Total</dt><dd>{{ money(c.totalCost) }}</dd></div>
            </dl>
          } @else {
            <form class="cost-form" (ngSubmit)="saveCost()">
              <p class="note">No cost record yet. Add the four components:</p>
              <div class="cost-grid">
                <label class="field"><span class="field__label">Material</span><input type="number" min="0" step="0.01" [(ngModel)]="costForm.materialCost" name="materialCost" /></label>
                <label class="field"><span class="field__label">Sewing</span><input type="number" min="0" step="0.01" [(ngModel)]="costForm.sewingCost" name="sewingCost" /></label>
                <label class="field"><span class="field__label">Branding</span><input type="number" min="0" step="0.01" [(ngModel)]="costForm.brandingCost" name="brandingCost" /></label>
                <label class="field"><span class="field__label">Packaging</span><input type="number" min="0" step="0.01" [(ngModel)]="costForm.packagingCost" name="packagingCost" /></label>
              </div>
              <button class="btn btn--primary" type="submit" [disabled]="busy()">Save cost record</button>
            </form>
          }

          <h3 class="dlabel">QC rejections</h3>
          @if (rejections().length) {
            <ul class="rejections">
              @for (r of rejections(); track r.id) {
                <li>
                  <strong>{{ r.quantity ?? 1 }} × {{ r.reason }}</strong>
                  <span class="badge" [class.badge--bad]="r.disposition === 'burned'" [class.badge--warn]="r.disposition !== 'burned'">{{ r.disposition === 'burned' ? 'Burned' : 'Repaired & restocked' }}</span>
                  <span class="sub">{{ r.createdAt | date: 'medium' }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="note">No rejections logged.</p>
          }
          <form class="rejection-form" (ngSubmit)="saveRejection()">
            <div class="cost-grid">
              <label class="field"><span class="field__label">Qty</span><input type="number" min="1" step="1" [(ngModel)]="rejectionForm.quantity" name="rqty" /></label>
              <label class="field"><span class="field__label">Reason</span><input type="text" [(ngModel)]="rejectionForm.reason" name="rreason" placeholder="stitch defect" required /></label>
              <label class="field"><span class="field__label">Disposition</span>
                <select [(ngModel)]="rejectionForm.disposition" name="rdisposition">
                  <option value="repaired_restocked">Repaired &amp; restocked</option>
                  <option value="burned">Burned</option>
                </select>
              </label>
            </div>
            <button class="btn btn--ghost" type="submit" [disabled]="busy() || !rejectionForm.reason.trim()">Log rejection</button>
          </form>

          <h3 class="dlabel">Scan history</h3>
          @if (scans().length) {
            <ol class="scan-list">
              @for (s of scans(); track s.id) {
                <li><strong>{{ s.stage }}</strong><span class="sub">{{ s.scannedAt | date: 'medium' }}</span></li>
              }
            </ol>
          } @else {
            <p class="note">No scans recorded.</p>
          }
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New production run">
      <ng-container drawerTitle><div class="dtitle"><strong>New production run</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createBatch()">
        <p class="note">One batch per variant, tied to an approved production request.</p>

        <label class="field"><span class="field__label">Product</span>
          <select [(ngModel)]="createForm.productId" name="productId" required (ngModelChange)="onProductChange($event)">
            <option value="">Select product…</option>
            @for (p of productOptions(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label class="field"><span class="field__label">Variant</span>
          <select [(ngModel)]="createForm.variantId" name="variantId" required [disabled]="!createForm.productId">
            <option value="">Select variant…</option>
            @for (v of variantOptions(); track v.id) {
              <option [value]="v.id">{{ v.sku ?? v.id.slice(0, 8) }}{{ v.size ? ' · ' + v.size : '' }}{{ v.colour ? ' · ' + v.colour : '' }}</option>
            }
          </select>
        </label>
        <div class="cost-grid">
          <label class="field"><span class="field__label">Quantity</span><input type="number" min="1" step="1" [(ngModel)]="createForm.quantity" name="quantity" required /></label>
          <label class="field"><span class="field__label">Planned date</span><input type="date" [(ngModel)]="createForm.plannedDate" name="plannedDate" /></label>
        </div>
        <label class="field"><span class="field__label">Approved request</span>
          <select [(ngModel)]="createForm.approvalRequestId" name="approvalRequestId" required>
            <option value="">Select an approved production request…</option>
            @for (a of approvedRequests(); track a.id) {
              <option [value]="a.id">{{ (a.payload?.['product'] ?? a.payload?.['title'] ?? 'Production request') }} — {{ a.createdAt | date: 'mediumDate' }}</option>
            }
          </select>
          @if (!approvedRequests().length) {
            <span class="field-err">No approved production requests. Approve one in Approvals first.</span>
          }
        </label>
        <button class="btn btn--primary" type="submit" [disabled]="creatingBusy() || !createForm.variantId || !createForm.quantity || !createForm.approvalRequestId">
          {{ creatingBusy() ? 'Creating…' : 'Create batch' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .note { padding: 14px 16px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); font-size: var(--fs-sm); }
    .stage-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { border: 1px solid var(--line); background: var(--surface); color: var(--muted); border-radius: var(--sd-r-pill); padding: 5px 12px; font-size: var(--fs-xs); font-weight: 650; cursor: pointer; }
    .pill.is-on { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
    .batch-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .batch-card { display: grid; gap: 8px; padding: 16px; text-align: left; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); cursor: pointer; color: var(--text); }
    .batch-card:hover { border-color: var(--primary); }
    .batch-card__top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .batch-card__lot { font-size: var(--fs-sm); font-weight: 750; }
    .batch-card__product { font-size: var(--fs-lg); font-weight: 700; }
    .batch-card__variant { color: var(--muted); font-size: var(--fs-sm); }
    .batch-card__meta { color: var(--muted); font-size: var(--fs-xs); display: flex; gap: 6px; }
    .dbody { display: grid; gap: 16px; }
    .dtitle strong { display: block; }
    .dmeta { color: var(--faint); font-size: var(--fs-xs); }
    .dsummary { display: flex; justify-content: space-between; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .stage-track { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 12px; background: var(--well); border-radius: var(--sd-r-card); }
    .stage-dot { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-2xs); color: var(--faint); }
    .stage-dot i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); display: inline-block; }
    .stage-dot.is-done { color: var(--muted); }
    .stage-dot.is-done i { background: var(--good); }
    .stage-dot.is-current { color: var(--text); font-weight: 700; }
    .stage-dot.is-current i { background: var(--primary); }
    .actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .barcode-row { display: flex; gap: 10px; }
    .barcode-row input { flex: 1; }
    .cost-form, .rejection-form, .create-form { display: grid; gap: 12px; }
    .cost-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); }
    .rejections { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .rejections li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--well); border-radius: 10px; font-size: var(--fs-sm); }
    .scan-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .scan-list li { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--well); border-radius: 8px; font-size: var(--fs-sm); }
    .sub { color: var(--faint); font-size: var(--fs-xs); }
    .neg { color: var(--bad); font-weight: 700; }
    .empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 1100px) { .batch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .facts { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .batch-grid { grid-template-columns: 1fr; } .cost-grid { grid-template-columns: 1fr; } .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class ProductionQueue {
  private readonly store = inject(Store);
  private readonly api = inject(ProductionApiService);
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly money = fmtMoney;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly batches = signal<ApiProductionBatch[]>([]);
  protected readonly stages = signal<string[]>([]);
  protected readonly stageFilter = signal('all');
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly creating = signal(false);
  protected readonly creatingBusy = signal(false);
  protected readonly barcodeInputOpen = signal(false);
  protected readonly variantOptions = signal<ApiProductVariant[]>([]);
  protected readonly bom = signal<ApiBatchBomRow[]>([]);
  protected readonly cost = signal<ApiProductionCost | null>(null);
  protected readonly rejections = signal<ApiQCRejection[]>([]);
  protected readonly scans = signal<ApiBatchScan[]>([]);

  protected readonly costForm = { materialCost: 0, sewingCost: 0, brandingCost: 0, packagingCost: 0 };
  protected readonly rejectionForm: { quantity: number; reason: string; disposition: QcDisposition } = { quantity: 1, reason: '', disposition: 'repaired_restocked' };
  protected readonly createForm = { productId: '', variantId: '', quantity: 50, plannedDate: '', approvalRequestId: '' };
  protected readonly barcodeControl = new FormControl<string>('', { nonNullable: true });

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
    const id = this.routeId();
    if (id) void this.selectBatch(id);
  }

  protected productNameOf(b: ApiProductionBatch): string {
    const variantId = b.variant?.id;
    if (!variantId) return '—';
    const products = this.store.products();
    return products.find((p) => (p.variantIds ?? []).includes(variantId))?.name ?? 'Unknown product';
  }

  protected variantLabelOf(b: ApiProductionBatch): string {
    const v = b.variant;
    if (!v) return '—';
    const parts = [v.sku, v.size, v.colour].filter(Boolean);
    return parts.join(' · ') || v.id.slice(0, 8);
  }

  protected lotOf(b: ApiProductionBatch): string {
    return b.barcode ?? b.id.slice(0, 8).toUpperCase();
  }

  protected stageOf(b: ApiProductionBatch): string {
    return b.stage ?? '—';
  }

  protected stageIndexOf(b: ApiProductionBatch): number {
    const idx = this.stages().findIndex((s) => s.toLowerCase() === (b.stage ?? '').toLowerCase());
    return idx === -1 ? (b.completedDate ? this.stages().length : 0) : idx;
  }

  protected isFinalStage(stage: string): boolean {
    const stages = this.stages();
    const last = stages[stages.length - 1];
    return !!last && stage.toLowerCase() === last.toLowerCase();
  }

  protected readonly rows = computed<BatchRow[]>(() =>
    this.batches().map((b) => ({
      id: b.id,
      lot: this.lotOf(b),
      productName: this.productNameOf(b),
      variantLabel: this.variantLabelOf(b),
      qty: b.quantity,
      stage: this.stageOf(b),
      createdAt: Date.parse(b.createdAt) || 0,
      plannedDate: b.plannedDate,
      completedDate: b.completedDate,
      raw: b,
    })).sort((a, b) => b.createdAt - a.createdAt),
  );

  protected readonly visible = computed(() => {
    const filter = this.stageFilter();
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((row) => {
      if (filter !== 'all' && row.stage.toLowerCase() !== filter.toLowerCase()) return false;
      if (!q) return true;
      return `${row.productName} ${row.variantLabel} ${row.lot}`.toLowerCase().includes(q);
    });
  });

  protected readonly active = computed(() => this.rows().filter((row) => !this.isFinalStage(row.raw.stage) && !row.raw.completedDate));
  protected readonly completed = computed(() => this.rows().filter((row) => this.isFinalStage(row.raw.stage) || !!row.raw.completedDate));
  protected readonly inQc = computed(() =>
    this.rows().filter((row) => row.stage.toLowerCase().includes('quality') || row.stage.toLowerCase().includes('qc')),
  );

  protected readonly selectedBatch = computed(() => this.batches().find((b) => b.id === (this.selectedId() ?? this.routeId())) ?? null);

  protected readonly nextStageOf = computed(() => {
    const b = this.selectedBatch();
    if (!b) return '';
    const idx = this.stages().findIndex((s) => s.toLowerCase() === (b.stage ?? '').toLowerCase());
    return this.stages()[idx + 1] ?? '';
  });

  protected readonly productOptions = computed(() =>
    this.store.products().slice().sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected async onProductChange(productId: string): Promise<void> {
    this.createForm.productId = productId;
    this.createForm.variantId = '';
    this.variantOptions.set([]);
    if (!productId) return;
    try {
      this.variantOptions.set(await this.catalogueApi.variants(productId));
    } catch {
      this.variantOptions.set([]);
      this.toast.show('Could not load variants for this product.', 'bad');
    }
  }

  protected readonly approvedRequests = computed(() =>
    this.store.approvals().filter((a) => a.actionType === 'production_start' && a.status === 'approved'),
  );

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const result = await this.api.list(1, 100);
      this.batches.set(result.data);
      this.stages.set(result.stages ?? []);
    } catch {
      this.loadError.set('The production service is unreachable. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected openBatch(id: string): void {
    void this.selectBatch(id);
  }

  protected async selectBatch(id: string): Promise<void> {
    this.selectedId.set(id);
    this.bom.set([]);
    this.cost.set(null);
    this.rejections.set([]);
    this.scans.set([]);
    this.barcodeInputOpen.set(false);
    const [bom, cost, rejections, scans] = await Promise.allSettled([
      this.api.bom(id),
      this.api.cost(id),
      this.api.rejections(id),
      this.api.scans(id),
    ]);
    this.bom.set(bom.status === 'fulfilled' ? bom.value : []);
    this.cost.set(cost.status === 'fulfilled' ? cost.value : null);
    this.rejections.set(rejections.status === 'fulfilled' ? rejections.value : []);
    this.scans.set(scans.status === 'fulfilled' ? scans.value : []);
  }

  protected closeBatch(): void {
    this.selectedId.set(null);
  }

  protected openCreate(): void {
    this.createForm.productId = '';
    this.createForm.variantId = '';
    this.createForm.quantity = 50;
    this.createForm.plannedDate = '';
    this.createForm.approvalRequestId = '';
    this.creating.set(true);
    void this.store.refreshApprovals().catch(() => {});
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async createBatch(): Promise<void> {
    this.creatingBusy.set(true);
    try {
      await this.api.createBatch({
        variantId: this.createForm.variantId,
        quantity: Number(this.createForm.quantity) || 0,
        plannedDate: this.createForm.plannedDate || undefined,
        approvalRequestId: this.createForm.approvalRequestId,
      });
      this.toast.show('Production batch created', 'good');
      this.creating.set(false);
      await this.load();
    } catch {
      this.toast.show('Could not create the batch — check the approved request and variant.', 'bad');
    } finally {
      this.creatingBusy.set(false);
    }
  }

  protected async advanceStage(): Promise<void> {
    const b = this.selectedBatch();
    const next = this.nextStageOf();
    if (!b || !next) return;
    this.busy.set(true);
    try {
      await this.api.updateStage(b.id, next);
      this.toast.show(`Batch moved to ${next}`, 'good');
      await this.load();
      await this.selectBatch(b.id);
    } catch {
      this.toast.show('Could not advance the stage.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected generateBarcode(): void {
    this.barcodeInputOpen.set(true);
    this.barcodeControl.setValue('');
  }

  protected async saveBarcode(): Promise<void> {
    const b = this.selectedBatch();
    const barcode = this.barcodeControl.value.trim();
    if (!b || !barcode) return;
    this.busy.set(true);
    try {
      await this.api.registerBarcode(b.id, barcode);
      this.toast.show('Barcode registered', 'good');
      this.barcodeInputOpen.set(false);
      await this.load();
      await this.selectBatch(b.id);
    } catch {
      this.toast.show('Barcode could not be registered.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveCost(): Promise<void> {
    const b = this.selectedBatch();
    if (!b) return;
    this.busy.set(true);
    try {
      await this.api.recordCost(b.id, { ...this.costForm });
      this.toast.show('Cost record saved', 'good');
      const cost = await this.api.cost(b.id);
      this.cost.set(cost);
    } catch {
      this.toast.show('Could not save the cost record.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveRejection(): Promise<void> {
    const b = this.selectedBatch();
    if (!b) return;
    this.busy.set(true);
    try {
      await this.api.recordQcRejection(b.id, {
        quantity: Number(this.rejectionForm.quantity) || 1,
        reason: this.rejectionForm.reason.trim(),
        disposition: this.rejectionForm.disposition,
      });
      this.toast.show('Rejection logged', 'good');
      this.rejectionForm.quantity = 1;
      this.rejectionForm.reason = '';
      this.rejectionForm.disposition = 'repaired_restocked';
      this.rejections.set(await this.api.rejections(b.id).catch(() => this.rejections()));
    } catch {
      this.toast.show('Could not log the rejection.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }
}
