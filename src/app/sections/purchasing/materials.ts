import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { date as fmtDate, money as fmtMoney } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { ToastService } from '../../core/toast';
import { Store } from '../../core/store';
import {
  ApiMaterial,
  MaterialKind,
  MaterialsApiService,
} from '../../core/materials-api.service';

const KIND_COLOR: Record<string, string> = {
  fabrics: 'var(--sage)',
  trims_hardware: 'var(--ochre)',
  thread: 'var(--ocean)',
  packaging: 'var(--pine)',
  printing: 'var(--rose)',
  labels: 'var(--slate)',
  other: 'var(--muted)',
};

export type MaterialKindFilter = 'all' | MaterialKind;

interface MaterialRow {
  id: string;
  name: string;
  unit: string;
  category: MaterialKind | null;
  storageLocation: string | null;
  reorderThreshold: number;
  createdAt: string;
  currentQuantity: number;
  lowStock: boolean;
  color: string;
  tint: string;
  low: boolean;
  lastUnitCost: number | null;
  currentValue: number;
  lastPurchaseAt: string | null;
  formattedCreatedAt: string;
}

@Component({
  selector: 'app-purchasing-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Icon, Drawer, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Purchasing</span>
        <h1 class="head__title">Materials</h1>
        <p class="head__lead">
          {{ rows().length }} materials · {{ lowCount() }} at or below reorder point.
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/purchasing/suppliers">Suppliers</a>
        <button type="button" class="btn btn--ghost" (click)="openUsage()">
          <app-icon name="package" [size]="15" />
          Record usage
        </button>
        <button type="button" class="btn btn--primary" (click)="openCreate()">
          <app-icon name="plus" [size]="15" />
          New material
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Material summary">
      <article class="stat">
        <span class="stat__label">Materials</span>
        <strong class="stat__value">{{ rows().length }}</strong>
        <span class="stat__detail">Raw materials from the API</span>
      </article>
      <article class="stat">
        <span class="stat__label">At reorder point</span>
        <strong class="stat__value">{{ lowCount() }}</strong>
        <span class="stat__detail">On hand at or below threshold</span>
      </article>
      <article class="stat">
        <span class="stat__label">Units on hand</span>
        <strong class="stat__value">{{ totalUnits() }}</strong>
        <span class="stat__detail">Combined material quantities</span>
      </article>
      <article class="stat">
        <span class="stat__label">Inventory value</span>
        <strong class="stat__value">{{ money(stockValue()) }}</strong>
        <span class="stat__detail">On hand × last unit cost</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Kind filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="kind() === f.id" [attr.aria-pressed]="kind() === f.id" (click)="setKind(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search material" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
    </div>

    @if (loading() && rows().length === 0) {
      <div class="load-center" role="status">
        <app-spinner size="sm" label="Loading materials" />
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Material</th>
                <th scope="col">Kind</th>
                <th scope="col">On hand</th>
                <th scope="col">Reorder at</th>
                <th scope="col">Last unit cost</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visible(); track row.id) {
                <tr class="clickable" (click)="open(row.id)">
                  <td class="mono strong">{{ row.name }}</td>
                  <td>{{ row.name }}</td>
                  <td>
                    <span class="badge" [style.color]="row.color" [style.background]="row.tint">{{ kindLabel(row.category) }}</span>
                  </td>
                  <td class="num" [class.low]="row.low">{{ row.currentQuantity }} {{ row.unit }}</td>
                  <td class="num">{{ row.reorderThreshold }}</td>
                  <td class="num">{{ row.lastUnitCost === null ? '—' : money(row.lastUnitCost) }}</td>
                </tr>
              }
              @if (!loading() && visible().length === 0 && !error()) {
                <tr><td colspan="6" class="empty">No materials match.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Material detail">
      <ng-container drawerTitle>
        @if (selected(); as m) {
          <div class="dtitle">
            <strong>{{ m.name }}</strong>
            <span class="badge" [style.color]="m.color" [style.background]="m.tint">{{ kindLabel(m.category) }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as m) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Unit</dt><dd>{{ m.unit }}</dd></div>
            <div><dt>On hand</dt><dd class="num">{{ m.currentQuantity }}</dd></div>
            <div><dt>Reorder at</dt><dd class="num">{{ m.reorderThreshold }}</dd></div>
            <div><dt>Last unit cost</dt><dd class="num">{{ m.lastUnitCost === null ? '�?"' : money(m.lastUnitCost) }}</dd></div>
            <div><dt>Current value</dt><dd class="num">{{ money(m.currentValue) }}</dd></div>
            <div><dt>Last purchase</dt><dd>{{ m.lastPurchaseAt === null ? '�?"' : m.lastPurchaseAt }}</dd></div>
            <div><dt>Created</dt><dd>{{ m.formattedCreatedAt }}</dd></div>
          </dl>

          <h3 class="dlabel">Supply</h3>
          <dl class="facts">
            <div><dt>Storage location</dt><dd>{{ m.storageLocation ?? 'Not set' }}</dd></div>
          </dl>

          @if (m.lowStock) {
            <div class="notice" role="status">
              <app-icon name="alert" [size]="14" />
              <span>This material is at or below its reorder threshold.</span>
            </div>
          }
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New material">
      <ng-container drawerTitle><div class="dtitle"><strong>New material</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createMaterial()">
        <p class="cnote">Register a raw material so purchasing and production can track it.</p>

        <label class="field"><span class="field__label">Name</span>
          <input type="text" [(ngModel)]="createForm.name" name="materialName" placeholder="e.g. Cotton poplin 4oz" required />
        </label>
        <div class="cgrid">
          <label class="field"><span class="field__label">Unit</span>
            <input type="text" [(ngModel)]="createForm.unit" name="materialUnit" placeholder="e.g. metres" required />
          </label>
          <label class="field"><span class="field__label">Reorder threshold</span>
            <input type="number" min="0" step="1" [(ngModel)]="createForm.reorderThreshold" name="materialReorder" />
          </label>
        </div>
        <label class="field"><span class="field__label">Kind</span>
          <select [(ngModel)]="createForm.category" name="materialCategory">
            <option value="">Uncategorised</option>
            @for (f of filters; track f.id) {
              @if (f.id !== 'all') {
                <option [value]="f.id">{{ f.label }}</option>
              }
            }
          </select>
        </label>
        <label class="field"><span class="field__label">Storage location</span>
          <input type="text" [(ngModel)]="createForm.storageLocation" name="materialLocation" placeholder="e.g. C3-R1" />
        </label>
        @if (createError()) {
          <p class="field-err">{{ createError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="creatingBusy() || !createForm.name.trim() || !createForm.unit.trim()">
          {{ creatingBusy() ? 'Creating…' : 'Create material' }}
        </button>
      </form>
    </app-drawer>

    <app-drawer [open]="usageOpen()" (close)="closeUsage()" label="Record material usage">
      <ng-container drawerTitle><div class="dtitle"><strong>Record usage</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="recordUsage()">
        <p class="cnote">Deducts stock from the material and counts toward the linked production batch.</p>
        <label class="field"><span class="field__label">Material</span>
          <select [(ngModel)]="usageForm.materialId" name="usageMaterial" required>
            <option value="">Select a material</option>
            @for (m of rows(); track m.id) {
              <option [value]="m.id">{{ m.name }} · {{ m.currentQuantity }} {{ m.unit }} on hand</option>
            }
          </select>
        </label>
        <div class="cgrid">
          <label class="field"><span class="field__label">Quantity used</span>
            <input type="number" min="1" step="1" [(ngModel)]="usageForm.quantityUsed" name="usageQuantity" required />
          </label>
          <label class="field"><span class="field__label">Batch (optional)</span>
            <select [(ngModel)]="usageForm.batchId" name="usageBatch">
              <option value="">Not linked</option>
              @for (b of batches(); track b.id) {
                <option [value]="b.id">{{ b.lot }} · {{ b.qty }} units</option>
              }
            </select>
          </label>
        </div>
        @if (usageError()) {
          <p class="field-err">{{ usageError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="usageBusy() || !usageForm.materialId || !usageForm.quantityUsed">
          {{ usageBusy() ? 'Recording…' : 'Record usage' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .clickable { cursor: pointer; }
    .strong { font-weight: 700; }
    .low { color: var(--bad); font-weight: 700; }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dlink { font-weight: 700; color: var(--primary); }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice app-icon { color: var(--primary); }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
    .create-form { display: grid; gap: 12px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .cnote { padding: 12px 14px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); font-size: var(--fs-sm); margin: 0; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 700px) { .cgrid { grid-template-columns: 1fr; } }
  `,
})
export class PurchasingMaterials {
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly materials = signal<ApiMaterial[]>([]);
  protected readonly valuations = signal<Record<string, { lastUnitCost: number | null; currentValue: number; lastPurchaseAt: string | null }>>({});

  protected readonly kind = signal<MaterialKindFilter>('all');
  protected readonly query = signal('');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'fabrics', label: 'Fabrics' },
    { id: 'trims_hardware', label: 'Trims & Hardware' },
    { id: 'thread', label: 'Thread' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'printing', label: 'Printing' },
    { id: 'labels', label: 'Labels' },
    { id: 'other', label: 'Other' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.loadMaterials();
  }

  private async loadMaterials(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [materialsResult, valuationResult] = await Promise.all([
        this.materialsApi.list({ page: 1, limit: 100 }),
        this.materialsApi.valuation(),
      ]);
      this.materials.set(materialsResult.data);
      this.valuations.set(
        valuationResult.reduce((acc, v) => {
          acc[v.id] = { lastUnitCost: v.lastUnitCost, currentValue: v.currentValue, lastPurchaseAt: null };
          return acc;
        }, {} as Record<string, { lastUnitCost: number | null; currentValue: number; lastPurchaseAt: string | null }>),
      );
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load materials.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed<MaterialRow[]>(() =>
    this.materials().map((m) => {
      const color = KIND_COLOR[m.category ?? 'null'] ?? 'var(--muted)';
      const val = this.valuations()[m.id] ?? { lastUnitCost: null, currentValue: 0 };
      return {
        id: m.id,
        name: m.name,
        unit: m.unit,
        category: m.category,
        storageLocation: m.storageLocation,
        reorderThreshold: m.reorderThreshold,
        createdAt: m.createdAt,
        currentQuantity: m.currentQuantity,
        lowStock: m.lowStock,
        color,
        tint: `color-mix(in srgb, ${color} 16%, transparent)`,
        low: m.lowStock,
        lastUnitCost: val.lastUnitCost,
        currentValue: val.currentValue,
        lastPurchaseAt: val.lastPurchaseAt ?? null,
        formattedCreatedAt: fmtDate(Date.parse(m.createdAt)),
      };
    }),
  );

  protected readonly lowCount = computed(
    () => this.rows().filter((m) => m.lowStock).length,
  );
  protected readonly totalUnits = computed(() =>
    this.rows().reduce((total, material) => total + material.currentQuantity, 0),
  );
  protected readonly stockValue = computed(() =>
    this.rows().reduce((total, material) => total + material.currentValue, 0),
  );

  protected readonly visible = computed(() => {
    const k = this.kind();
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (k !== 'all' && r.category !== k) return false;
      if (!q) return true;
      return `${r.name} ${r.id}`.toLowerCase().includes(q);
    });
  });

  protected readonly selected = computed<MaterialRow | null>(() => {
    const found = this.rows().find((m) => m.id === this.routeId());
    return found ?? null;
  });

  protected setKind(id: string): void {
    this.kind.set(id as MaterialKindFilter);
  }

  protected kindLabel(kind: MaterialKind | null): string {
    const labels: Record<string, string> = {
      fabrics: 'Fabrics',
      trims_hardware: 'Trims & Hardware',
      thread: 'Thread',
      packaging: 'Packaging',
      printing: 'Printing',
      labels: 'Labels',
      other: 'Other',
      null: 'Uncategorised',
    };
    return labels[kind ?? 'null'] ?? 'Uncategorised';
  }

  protected open(id: string): void {
    this.router.navigate(['/purchasing/materials', id]);
  }

  protected close(): void {
    this.router.navigate(['/purchasing/materials']);
  }

  protected readonly creating = signal(false);
  protected readonly creatingBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = {
    name: '',
    unit: '',
    category: '',
    storageLocation: '',
    reorderThreshold: 0,
  };

  protected readonly usageOpen = signal(false);
  protected readonly usageBusy = signal(false);
  protected readonly usageError = signal<string | null>(null);
  protected readonly usageForm = {
    materialId: '',
    quantityUsed: 0,
    batchId: '',
  };
  protected readonly batches = this.store.batches;

  protected openUsage(): void {
    this.usageForm.materialId = this.selected()?.id ?? '';
    this.usageForm.quantityUsed = 0;
    this.usageForm.batchId = '';
    this.usageError.set(null);
    this.usageOpen.set(true);
  }

  protected closeUsage(): void {
    this.usageOpen.set(false);
  }

  protected async recordUsage(): Promise<void> {
    const quantityUsed = Math.trunc(Number(this.usageForm.quantityUsed));
    if (!this.usageForm.materialId || !Number.isFinite(quantityUsed) || quantityUsed < 1) {
      this.usageError.set('Choose a material and a whole quantity of at least 1.');
      return;
    }
    this.usageBusy.set(true);
    this.usageError.set(null);
    try {
      await this.materialsApi.usage({
        materialId: this.usageForm.materialId,
        quantityUsed,
        batchId: this.usageForm.batchId || null,
      });
      this.toast.show('Material usage recorded', 'good');
      this.usageOpen.set(false);
      await this.loadMaterials();
      void this.store.load();
    } catch (err) {
      this.usageError.set(err instanceof Error ? err.message : 'Could not record the usage.');
    } finally {
      this.usageBusy.set(false);
    }
  }

  protected openCreate(): void {
    this.createForm.name = '';
    this.createForm.unit = '';
    this.createForm.category = '';
    this.createForm.storageLocation = '';
    this.createForm.reorderThreshold = 0;
    this.createError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async createMaterial(): Promise<void> {
    this.creatingBusy.set(true);
    this.createError.set(null);
    try {
      await this.materialsApi.create({
        name: this.createForm.name.trim(),
        unit: this.createForm.unit.trim(),
        category: this.createForm.category || null,
        storageLocation: this.createForm.storageLocation.trim() || null,
        reorderThreshold: this.createForm.reorderThreshold || 0,
      });
      this.toast.show('Material created', 'good');
      this.creating.set(false);
      await this.loadMaterials();
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Could not create the material.');
    } finally {
      this.creatingBusy.set(false);
    }
  }
}