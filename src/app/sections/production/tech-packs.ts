import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { CatalogueApiService, type ApiProductVariant } from '../../core/catalogue-api.service';
import {
  TechPacksApiService,
  type ApiTechPack,
  type ApiTechPackRevision,
  type UpsertTechPackInput,
} from '../../core/tech-packs-api.service';
import { date as fmtDate } from '../../core/format';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'XXL'];

@Component({
  selector: 'app-production-tech-packs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule, DatePipe, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Production</span>
        <h1 class="head__title">Tech packs</h1>
        <p class="head__lead">{{ rows().length }} specification packs · {{ drafts().length }} awaiting approval</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/production">Production queue</a>
        <button class="btn btn--primary" type="button" (click)="openCreate()">+ New pack</button>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center" role="status"><app-spinner size="sm" label="Loading tech packs" /></div>
    } @else if (loadError()) {
      <div class="empty"><strong>Couldn't load tech packs.</strong><span>{{ loadError() }}</span><button class="btn btn--ghost" type="button" (click)="load()">Retry</button></div>
    }

    <div class="pack-grid" aria-label="Tech packs">
      @for (row of visible(); track row.id) {
        <button type="button" class="pack-card" (click)="openPack(row.id)" [attr.aria-label]="'Open tech pack for ' + productName(row)">
          <span class="pack-card__top">
            <span class="pack-card__product">{{ productName(row) }}</span>
            <span class="badge" [class.badge--good]="row.status === 'approved'" [class.badge--warn]="row.status !== 'approved'">{{ row.status === 'approved' ? 'Approved' : 'Draft' }}</span>
          </span>
          <span class="pack-card__variant">{{ variantLabel(row) }}</span>
          <span class="pack-card__meta">
            <span>{{ row.silhouette ?? 'No silhouette' }}</span>
            @if (row.targetYieldUnits) { <span>· target {{ row.targetYieldUnits }} units</span> }
          </span>
          <span class="pack-card__foot">
            @if (row.cuttingEfficiencyPct !== null && row.cuttingEfficiencyPct !== undefined) {
              <span class="efficiency" [class.is-low]="(row.cuttingEfficiencyPct ?? 0) < 55">Yield {{ row.cuttingEfficiencyPct }}%</span>
            } @else {
              <span class="sub">Yield not recorded</span>
            }
            <span class="sub">rev {{ row.revisionCount ?? row.revision }}</span>
          </span>
        </button>
      }
      @if (!visible().length && !loading() && !loadError()) {
        <div class="empty"><strong>No tech packs yet.</strong><span>Create the first pack — one per variant — to start production.</span></div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Tech pack detail">
      <ng-container drawerTitle>
        @if (selected(); as pack) {
          <div class="dtitle"><strong>{{ productName(pack) }}</strong><span class="dmeta">{{ variantLabel(pack) }}</span></div>
        }
      </ng-container>
      @if (selected(); as pack) {
        <div class="dbody">
          <div class="dsummary">
            <div><span class="stat__label">Status</span><span class="dmeta">{{ pack.status === 'approved' ? 'Approved' : 'Draft' }}<span class="sub">rev {{ pack.revision }}</span></span></div>
            <div class="dright"><span class="stat__label">Cutting yield</span><strong class="dtotal">{{ pack.cuttingEfficiencyPct ?? '—' }}{{ pack.cuttingEfficiencyPct !== null ? '%' : '' }}</strong></div>
          </div>

          <dl class="facts">
            <div><dt>Silhouette</dt><dd>{{ pack.silhouette ?? '—' }}</dd></div>
            <div><dt>Target yield</dt><dd>{{ pack.targetYieldUnits ?? '—' }}</dd></div>
            <div><dt>DXF</dt><dd>@if (pack.dxfUrl) { <a class="link" [href]="pack.dxfUrl" target="_blank" rel="noopener">Open pattern</a> } @else { '—' }</dd></div>
            <div><dt>Updated</dt><dd>{{ pack.updatedAt | date: 'medium' }}</dd></div>
          </dl>

          <h3 class="dlabel">Graded measurements</h3>
          @if (measurementRows(pack); as rows) {
            <div class="table-wrap">
              <table>
                <thead><tr><th scope="col">Size</th>@for (col of measurementCols(rows); track col) { <th scope="col">{{ col }}</th> }</tr></thead>
                <tbody>
                  @for (row of rows; track row.size) {
                    <tr><td><strong>{{ row.size }}</strong></td>@for (col of measurementCols(rows); track col) { <td>{{ row.measurements[col] ?? '—' }}</td> }</tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="note">No graded measurements recorded.</p>
          }

          <h3 class="dlabel">Stitch protocol</h3>
          <p class="dnote">{{ pack.stitchProtocol ?? 'Not recorded.' }}</p>
          <h3 class="dlabel">Laydown protocol</h3>
          <p class="dnote">{{ pack.laydownProtocol ?? 'Not recorded.' }}</p>

          <h3 class="dlabel">Revision history</h3>
          @if (revisions().length) {
            <ol class="revision-list">
              @for (rev of revisions(); track rev.id) {
                <li><strong>rev {{ rev.revision }}</strong><span class="sub">{{ rev.createdAt | date: 'medium' }}</span></li>
              }
            </ol>
          } @else {
            <p class="note">No revision history loaded.</p>
          }

          <div class="actions-row">
            @if (pack.status !== 'approved') {
              <button class="btn btn--primary" type="button" [disabled]="busy()" (click)="approve()">{{ busy() ? 'Approving…' : 'Approve pack' }}</button>
            }
            <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="editPack()">Edit measurements…</button>
          </div>

          @if (editing()) {
            <form class="create-form" (ngSubmit)="saveEdit()">
              <h3 class="dlabel">Edit pack</h3>
              <div class="cost-grid">
                <label class="field"><span class="field__label">Silhouette</span><input type="text" [(ngModel)]="editForm.silhouette" name="silhouette" placeholder="e.g. relaxed fit crew" /></label>
                <label class="field"><span class="field__label">Target units</span><input type="number" min="0" step="1" [(ngModel)]="editForm.targetYieldUnits" name="targetYieldUnits" /></label>
                <label class="field"><span class="field__label">Cutting yield %</span><input type="number" min="0" max="100" step="0.1" [(ngModel)]="editForm.cuttingEfficiencyPct" name="cuttingEfficiencyPct" /></label>
                <label class="field"><span class="field__label">DXF URL</span><input type="url" [(ngModel)]="editForm.dxfUrl" name="dxfUrl" placeholder="https://…" /></label>
              </div>
              <label class="field"><span class="field__label">Stitch protocol</span><textarea rows="2" [(ngModel)]="editForm.stitchProtocol" name="stitchProtocol"></textarea></label>
              <label class="field"><span class="field__label">Laydown protocol</span><textarea rows="2" [(ngModel)]="editForm.laydownProtocol" name="laydownProtocol"></textarea></label>
              <div class="actions-row">
                <button class="btn btn--primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save changes' }}</button>
                <button class="btn btn--ghost" type="button" (click)="editing.set(false)">Cancel</button>
              </div>
            </form>
          }
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New tech pack">
      <ng-container drawerTitle><div class="dtitle"><strong>New tech pack</strong><span class="dmeta">One pack per variant</span></div></ng-container>
      <form class="create-form" (ngSubmit)="createPack()">
        <label class="field"><span class="field__label">Product</span>
          <select [(ngModel)]="createForm.productId" name="productId" required (ngModelChange)="onProductChange($event)">
            <option value="">Select product…</option>
            @for (p of productOptions(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
          </select>
        </label>
        <label class="field"><span class="field__label">Variant</span>
          <select [(ngModel)]="createForm.variantId" name="variantId" required [disabled]="!createForm.productId">
            <option value="">Select variant…</option>
            @for (v of variantOptions(); track v.id) { <option [value]="v.id">{{ v.sku }}{{ v.size ? ' · ' + v.size : '' }}{{ v.colour ? ' · ' + v.colour : '' }}</option> }
          </select>
        </label>
        <div class="cost-grid">
          <label class="field"><span class="field__label">Silhouette</span><input type="text" [(ngModel)]="createForm.silhouette" name="silhouette" placeholder="e.g. relaxed fit crew" /></label>
          <label class="field"><span class="field__label">Target units</span><input type="number" min="0" step="1" [(ngModel)]="createForm.targetYieldUnits" name="targetYieldUnits" /></label>
          <label class="field"><span class="field__label">Cutting yield %</span><input type="number" min="0" max="100" step="0.1" [(ngModel)]="createForm.cuttingEfficiencyPct" name="cuttingEfficiencyPct" /></label>
          <label class="field"><span class="field__label">DXF URL</span><input type="url" [(ngModel)]="createForm.dxfUrl" name="dxfUrl" placeholder="https://…" /></label>
        </div>
        <label class="field"><span class="field__label">Stitch protocol</span><textarea rows="2" [(ngModel)]="createForm.stitchProtocol" name="stitchProtocol" required></textarea></label>
        <label class="field"><span class="field__label">Laydown protocol</span><textarea rows="2" [(ngModel)]="createForm.laydownProtocol" name="laydownProtocol"></textarea></label>
        <button class="btn btn--primary" type="submit" [disabled]="busy() || !createForm.variantId || !createForm.stitchProtocol.trim()">{{ busy() ? 'Creating…' : 'Create pack' }}</button>
      </form>
    </app-drawer>
  `,
  styles: `
    .note { padding: 14px 16px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); font-size: var(--fs-sm); }
    .pack-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .pack-card { display: grid; gap: 8px; padding: 16px; text-align: left; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); cursor: pointer; color: var(--text); }
    .pack-card:hover { border-color: var(--primary); }
    .pack-card__top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .pack-card__product { font-size: var(--fs-lg); font-weight: 750; }
    .pack-card__variant { color: var(--muted); font-size: var(--fs-sm); }
    .pack-card__meta { display: flex; gap: 6px; color: var(--muted); font-size: var(--fs-sm); }
    .pack-card__foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
    .efficiency { font-weight: 700; color: var(--good); font-size: var(--fs-sm); }
    .efficiency.is-low { color: var(--warn); }
    .dbody { display: grid; gap: 16px; }
    .dtitle strong { display: block; }
    .dmeta { color: var(--faint); font-size: var(--fs-xs); }
    .dsummary { display: flex; justify-content: space-between; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .link { color: var(--primary); }
    .dnote { font-size: var(--fs-md); color: var(--muted); line-height: 1.55; white-space: pre-wrap; }
    .revision-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .revision-list li { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--well); border-radius: 8px; font-size: var(--fs-sm); }
    .sub { color: var(--faint); font-size: var(--fs-xs); }
    .actions-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .create-form { display: grid; gap: 12px; }
    .cost-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input, .field select, .field textarea { padding: 0 12px; min-height: 40px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); font-family: inherit; }
    .field textarea { padding: 10px 12px; resize: vertical; }
    .field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--primary); }
    .empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 1100px) { .pack-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .pack-grid { grid-template-columns: 1fr; } .cost-grid { grid-template-columns: 1fr; } }
  `,
})
export class ProductionTechPacks {
  private readonly store = inject(Store);
  private readonly api = inject(TechPacksApiService);
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly date = fmtDate;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly packs = signal<ApiTechPack[]>([]);
  protected readonly revisions = signal<ApiTechPackRevision[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly creating = signal(false);
  protected readonly editing = signal(false);
  protected readonly variantOptions = signal<ApiProductVariant[]>([]);

  protected readonly createForm = {
    productId: '',
    variantId: '',
    silhouette: '',
    targetYieldUnits: 0,
    cuttingEfficiencyPct: 0,
    stitchProtocol: '',
    laydownProtocol: '',
    dxfUrl: '',
  };

  protected readonly editForm = {
    silhouette: '',
    targetYieldUnits: 0,
    cuttingEfficiencyPct: 0,
    stitchProtocol: '',
    laydownProtocol: '',
    dxfUrl: '',
  };

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.packs.set(await this.api.list());
    } catch {
      this.loadError.set('The tech-packs service is unreachable. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected productName(pack: ApiTechPack): string {
    return pack.variant?.product?.name ?? 'Unknown product';
  }

  protected variantLabel(pack: ApiTechPack): string {
    const v = pack.variant;
    if (!v) return '—';
    return [v.sku, v.size, v.colour].filter(Boolean).join(' · ') || 'Variant';
  }

  protected readonly rows = computed(() => this.packs().slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  protected readonly visible = computed(() => this.rows());
  protected readonly drafts = computed(() => this.rows().filter((p) => p.status !== 'approved'));
  protected readonly selected = computed(() => this.rows().find((p) => p.id === (this.selectedId() ?? this.routeId())) ?? null);
  protected readonly productOptions = computed(() =>
    this.store.products().slice().sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected measurementRows(pack: ApiTechPack): Array<{ size: string; measurements: Record<string, string | number> }> | null {
    const m = pack.gradedMeasurements;
    if (!m || typeof m !== 'object') return null;
    return Object.entries(m)
      .map(([size, measurements]) => ({ size, measurements: (measurements ?? {}) as Record<string, string | number> }))
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  }

  protected measurementCols(rows: Array<{ size: string; measurements: Record<string, string | number> }>): string[] {
    const cols = new Set<string>();
    for (const row of rows) for (const key of Object.keys(row.measurements)) cols.add(key);
    return [...cols];
  }

  protected openPack(id: string): void {
    this.selectedId.set(id);
    this.editing.set(false);
    this.revisions.set([]);
    void this.api.revisions(id).then((r) => this.revisions.set(r)).catch(() => this.revisions.set([]));
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  protected openCreate(): void {
    this.createForm.productId = '';
    this.createForm.variantId = '';
    this.createForm.silhouette = '';
    this.createForm.targetYieldUnits = 0;
    this.createForm.cuttingEfficiencyPct = 0;
    this.createForm.stitchProtocol = '';
    this.createForm.laydownProtocol = '';
    this.createForm.dxfUrl = '';
    this.variantOptions.set([]);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async onProductChange(productId: string): Promise<void> {
    this.createForm.productId = productId;
    this.createForm.variantId = '';
    this.variantOptions.set([]);
    if (!productId) return;
    try {
      this.variantOptions.set(await this.catalogueApi.variants(productId));
    } catch {
      this.toast.show('Could not load variants for this product.', 'bad');
    }
  }

  protected async createPack(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.create({
        variantId: this.createForm.variantId,
        silhouette: this.createForm.silhouette || null,
        targetYieldUnits: this.createForm.targetYieldUnits || null,
        cuttingEfficiencyPct: this.createForm.cuttingEfficiencyPct || null,
        stitchProtocol: this.createForm.stitchProtocol.trim(),
        laydownProtocol: this.createForm.laydownProtocol.trim() || null,
        dxfUrl: this.createForm.dxfUrl.trim() || null,
      });
      this.toast.show('Tech pack created', 'good');
      this.creating.set(false);
      await this.load();
    } catch {
      this.toast.show('Could not create the pack — the variant may already have one.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async approve(): Promise<void> {
    const pack = this.selected();
    if (!pack) return;
    this.busy.set(true);
    try {
      await this.api.approve(pack.id);
      this.toast.show('Tech pack approved', 'good');
      await this.load();
      this.selectedId.set(pack.id);
    } catch {
      this.toast.show('Could not approve the pack.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected editPack(): void {
    const pack = this.selected();
    if (!pack) return;
    this.editForm.silhouette = pack.silhouette ?? '';
    this.editForm.targetYieldUnits = pack.targetYieldUnits ?? 0;
    this.editForm.cuttingEfficiencyPct = pack.cuttingEfficiencyPct ?? 0;
    this.editForm.stitchProtocol = pack.stitchProtocol ?? '';
    this.editForm.laydownProtocol = pack.laydownProtocol ?? '';
    this.editForm.dxfUrl = pack.dxfUrl ?? '';
    this.editing.set(true);
  }

  protected async saveEdit(): Promise<void> {
    const pack = this.selected();
    if (!pack) return;
    this.busy.set(true);
    const payload: UpsertTechPackInput = {
      silhouette: this.editForm.silhouette || null,
      targetYieldUnits: this.editForm.targetYieldUnits || null,
      cuttingEfficiencyPct: this.editForm.cuttingEfficiencyPct || null,
      stitchProtocol: this.editForm.stitchProtocol || null,
      laydownProtocol: this.editForm.laydownProtocol || null,
      dxfUrl: this.editForm.dxfUrl.trim() || null,
    };
    try {
      await this.api.update(pack.id, payload);
      this.toast.show('Tech pack updated', 'good');
      this.editing.set(false);
      await this.load();
      this.selectedId.set(pack.id);
    } catch {
      this.toast.show('Could not save the pack.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }
}
