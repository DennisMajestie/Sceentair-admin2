import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { date as fmtDate, statusLabel, statusTone } from '../../core/format';
import { Drawer } from '../../ui/drawer';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../core/toast';
import {
  ApiCount,
  ApiCountLine,
  InventoryApiService,
  type InventoryItemType,
} from '../../core/inventory-api.service';
import { MaterialsApiService } from '../../core/materials-api.service';
import { CatalogueApiService } from '../../core/catalogue-api.service';
import { ApprovalsApiService } from '../../core/approvals-api.service';

interface CountItem {
  itemType: InventoryItemType;
  itemId: string;
  label: string;
  currentQuantity: number;
}

interface CountLineDraft extends CountItem {
  countedQuantity: number;
}

function errorText(err: unknown): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  if (Array.isArray(text)) return text.filter((t) => typeof t === 'string').join(' · ');
  return typeof text === 'string' && text ? text : String(err);
}

@Component({
  selector: 'app-warehouses-counts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Drawer, Icon, RouterLink, FormsModule, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Inventory counts</span>
        <h1 class="head__title">Cycle counts</h1>
        <p class="head__lead">{{ rows().length }} counts on the books, {{ stats().done }} finished.</p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--primary" (click)="openNewCount()">
          <app-icon name="plus" [size]="15" />
          New count
        </button>
        <a class="btn btn--ghost" routerLink="/warehouses/locations">View locations</a>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Scheduled</span>
        <span class="kpi__value">{{ countsBy('scheduled') }}</span>
        <span class="kpi__meta">waiting to start</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">In progress</span>
        <span class="kpi__value">{{ countsBy('counting') }}</span>
        <span class="kpi__meta">on the floor now</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Lines matched, 60 days</span>
        <span class="kpi__value">{{ matchedPct().toFixed(0) }}<span class="kpi__suffix">%</span></span>
        <span class="kpi__meta">{{ matchedLines().total }} lines counted</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Units corrected</span>
        <span class="kpi__value">{{ corrected() }}</span>
        <span class="kpi__meta">adjusted to the shelf</span>
      </article>
    </section>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
          All {{ rows().length }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'scheduled'" [attr.aria-pressed]="filter() === 'scheduled'" (click)="filter.set('scheduled')">
          Scheduled {{ countsBy('scheduled') }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'counting'" [attr.aria-pressed]="filter() === 'counting'" (click)="filter.set('counting')">
          Counting {{ countsBy('counting') }}
        </button>
        <button type="button" class="seg__btn" [class.is-on]="filter() === 'done'" [attr.aria-pressed]="filter() === 'done'" (click)="filter.set('done')">
          Done {{ countsBy('done') }}
        </button>
      </div>
      <div class="toolbar__spacer"></div>
      <span class="badge">{{ visible().length }} counts</span>
    </div>

    @if (loading() && rows().length === 0) {
      <div class="load-center" role="status">
        <app-spinner size="sm" label="Loading cycle counts" />
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Count</th>
                <th scope="col">Counter</th>
                <th scope="col">When</th>
                <th scope="col">Lines</th>
                <th scope="col">Counted</th>
                <th scope="col">Status</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              @for (row of visible(); track row.id) {
                <tr>
                  <td>
                    <a class="cnt-link" [routerLink]="'/warehouses/counts/' + row.id">{{ row.number }}</a>
                    <span class="sub">{{ row.ago }}</span>
                  </td>
                  <td>
                    <span class="counter">
                      <span class="av av--sm av--{{ row.tone }}">{{ row.initials }}</span>
                      <span>
                        {{ row.by }}
                        <span class="sub">{{ row.time }}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    {{ fmtDate(row.at) }}
                  </td>
                  <td class="num">{{ row.lines.length }} lines</td>
                  <td class="num">{{ row.countedLines }}</td>
                  <td><span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span></td>
                  <td>
                    <a class="btn btn--ghost btn--xs" [routerLink]="'/warehouses/counts/' + row.id">{{ row.action }}</a>
                  </td>
                </tr>
              }
              @if (!loading() && visible().length === 0 && !error()) {
                <tr><td colspan="7" class="empty">No cycle counts match.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Cycle count detail">
      <ng-container drawerTitle>
        @if (selected(); as c) {
          <div class="dtitle">
            <strong class="mono">{{ c.number }}</strong>
            <span class="badge" [class]="'badge badge--' + c.tone">{{ c.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as c) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Status</dt><dd>{{ c.label }}</dd></div>
            <div><dt>Counted lines</dt><dd class="num">{{ c.countedLines }} of {{ c.lines.length }}</dd></div>
            <div><dt>Unit corrections</dt><dd class="num">{{ c.unitCorrections }}</dd></div>
          </dl>

          <h3 class="dlabel">Lines</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Item</th><th scope="col">Type</th><th scope="col">Counted</th><th scope="col">Movement</th></tr>
              </thead>
              <tbody>
                @for (line of c.lines; track line.itemId) {
                  <tr>
                    <td>
                      {{ line.itemId }}
                      <span class="sub">{{ line.approvalRequestId ? 'approval: ' + line.approvalRequestId : '' }}</span>
                    </td>
                    <td class="num">{{ line.itemType }}</td>
                    <td class="num">{{ line.countedQuantity === null ? '—' : line.countedQuantity }}</td>
                    <td>
                      <button type="button" class="btn btn--ghost btn--xs" (click)="openMovement(line)">Record movement</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (movementLine(); as line) {
            <form class="move-form" (ngSubmit)="submitMovement()">
              <p class="mono move-form__target">{{ line.itemId }}</p>
              <div class="move-form__fields">
                <label class="field"><span class="field__label">Direction</span>
                  <select [(ngModel)]="movementForm.direction" name="moveDirection">
                    <option value="in">In</option>
                    <option value="out">Out</option>
                  </select>
                </label>
                <label class="field"><span class="field__label">Quantity</span><input type="number" min="1" step="1" [(ngModel)]="movementForm.quantity" name="moveQuantity" required /></label>
                <label class="field"><span class="field__label">Note</span><input type="text" [(ngModel)]="movementForm.note" name="moveNote" placeholder="optional" /></label>
              </div>
              <div class="move-form__actions">
                <button type="submit" class="btn btn--primary btn--xs" [disabled]="saving()">Record</button>
                <button type="button" class="btn btn--ghost btn--xs" (click)="closeMovement()">Cancel</button>
              </div>
            </form>
          }
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeNewCount()" label="New cycle count">
      <ng-container drawerTitle><div class="dtitle"><strong>New cycle count</strong></div></ng-container>
      <div class="dbody">
        <p class="cnote">Pick the items counted on the floor and enter the counted quantity. Any line below stock needs a stock-disposal approval.</p>

        <div class="addline">
          <label class="field"><span class="field__label">Item</span>
            <select [(ngModel)]="draft.key" name="countItem">
              <option value="">Select an item…</option>
              @for (item of countItems(); track item.itemType + ':' + item.itemId) {
                <option [value]="item.itemType + ':' + item.itemId">{{ item.label }} — {{ item.currentQuantity }} on hand</option>
              }
            </select>
          </label>
          <label class="field field--qty"><span class="field__label">Counted</span>
            <input type="number" min="0" step="1" [(ngModel)]="draft.countedQuantity" name="countQty" />
          </label>
          <button type="button" class="btn btn--ghost" (click)="addLine()">Add line</button>
        </div>

        @if (countLines().length > 0) {
          <div class="table-wrap">
            <table aria-label="Count lines">
              <thead>
                <tr><th scope="col">Item</th><th scope="col">On hand</th><th scope="col">Counted</th><th scope="col"></th></tr>
              </thead>
              <tbody>
                @for (line of countLines(); track line.itemType + ':' + line.itemId; let i = $index) {
                  <tr>
                    <td>{{ line.label }}</td>
                    <td class="num">{{ line.currentQuantity }}</td>
                    <td class="num">{{ line.countedQuantity }}</td>
                    <td><button type="button" class="btn btn--ghost btn--xs" (click)="removeLine(i)">Remove</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="cnote">No lines yet — add at least one item.</p>
        }

        @if (createError()) {
          <p class="edit-error">{{ createError() }}</p>
        }
        <button type="button" class="btn btn--primary" [disabled]="createBusy() || countLines().length === 0" (click)="submitCount()">
          {{ createBusy() ? 'Recording…' : 'Record count' }}
        </button>
      </div>
    </app-drawer>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .kpi__suffix { font-size: var(--fs-xl); color: var(--muted); margin-left: 3px; }
    .kpi__meta { font-size: var(--fs-xs); color: var(--muted); }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .cnt-link { font-weight: 700; color: var(--text); }
    .counter { display: inline-flex; align-items: center; gap: 8px; }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .move-form { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); }
    .move-form__target { margin: 0; font-size: var(--fs-xs); font-weight: 700; }
    .move-form__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .move-form__actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .addline { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto; gap: 10px; align-items: end; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); }
    .field--qty input { width: 100%; }
    .cnote { margin: 0; padding: 12px 14px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); font-size: var(--fs-sm); }
    .edit-error { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 700px) { .addline { grid-template-columns: 1fr; } }
    .field { display: grid; gap: 5px; min-width: 0; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
  `,
})
export class WarehouseCounts {
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly fmtDate = fmtDate;
  protected readonly filter = signal('all');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly counts = signal<ApiCount[]>([]);
  protected readonly movementLine = signal<ApiCountLine | null>(null);
  protected readonly saving = signal(false);
  protected readonly movementForm = {
    direction: 'out' as 'in' | 'out',
    quantity: 0,
    note: '',
  };

  protected readonly creating = signal(false);
  protected readonly createBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly countItems = signal<CountItem[]>([]);
  protected readonly countLines = signal<CountLineDraft[]>([]);
  protected readonly draft = { key: '', countedQuantity: 0 };

  constructor() {
    void this.loadCounts();
  }

  private async loadCounts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.inventoryApi.counts({ page: 1, limit: 50 });
      this.counts.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load counts.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed(() =>
    this.counts().map((c) => {
      const countedLines = c.lines.filter((l) => l.countedQuantity !== null).length;
      const unitCorrections = c.lines.reduce(
        (a, l) => a + (l.countedQuantity === null ? 0 : Math.abs(l.countedQuantity)),
        0,
      );
      const status = typeof c.status === 'string' && c.status ? c.status : 'done';
      return {
        id: c.id,
        number: c.number ?? `CNT-${c.id.slice(0, 8).toUpperCase()}`,
        status,
        tone: statusTone(status),
        label: statusLabel(status),
        at: Date.parse(c.createdAt),
        time: new Date(c.createdAt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
        by: 'System',
        initials: 'SY',
        ago: this.ago(Date.parse(c.createdAt)),
        countedLines,
        unitCorrections,
        action: 'View details',
        lines: c.lines,
      };
    }),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.rows()
      .filter((r) => f === 'all' || r.status === f)
      .sort((a, b) => b.at - a.at);
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()) ?? null);

  protected countsBy(status: string): number {
    return this.rows().filter((r) => r.status === status).length;
  }

  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      scheduled: rows.filter((r) => r.status === 'scheduled').length,
      counting: rows.filter((r) => r.status === 'counting').length,
      done: rows.filter((r) => r.status === 'done').length,
    };
  });

  protected readonly matchedLines = computed(() => {
    const cutoff = Date.now() - 60 * 86400000;
    let total = 0;
    let exact = 0;
    for (const c of this.counts()) {
      if (Date.parse(c.createdAt) < cutoff) continue;
      for (const l of c.lines) {
        if (l.countedQuantity === null) continue;
        total += 1;
        exact += 1;
      }
    }
    return { total, exact };
  });

  protected readonly matchedPct = computed(() => {
    const { total, exact } = this.matchedLines();
    return total > 0 ? (exact / total) * 100 : 0;
  });

  protected readonly corrected = computed(() => {
    let units = 0;
    for (const c of this.counts()) {
      if ((c.status ?? 'done') !== 'done') continue;
      for (const l of c.lines) {
        if (l.countedQuantity === null) continue;
        units += Math.abs(l.countedQuantity);
      }
    }
    return units;
  });

  protected openNewCount(): void {
    this.draft.key = '';
    this.draft.countedQuantity = 0;
    this.countLines.set([]);
    this.createError.set(null);
    this.creating.set(true);
    void this.loadCountItems();
  }

  protected closeNewCount(): void {
    this.creating.set(false);
  }

  protected addLine(): void {
    const item = this.countItems().find((i) => `${i.itemType}:${i.itemId}` === this.draft.key);
    if (!item) {
      this.createError.set('Choose an item to count.');
      return;
    }
    if (this.countLines().some((l) => l.itemType === item.itemType && l.itemId === item.itemId)) {
      this.createError.set('That item is already on this count.');
      return;
    }
    const qty = Number(this.draft.countedQuantity);
    if (!Number.isFinite(qty) || qty < 0) {
      this.createError.set('Counted quantity must be zero or more.');
      return;
    }
    this.countLines.update((lines) => [
      ...lines,
      { ...item, countedQuantity: Math.round(qty) },
    ]);
    this.draft.key = '';
    this.draft.countedQuantity = 0;
    this.createError.set(null);
  }

  protected removeLine(index: number): void {
    this.countLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected async submitCount(): Promise<void> {
    const lines = this.countLines();
    if (lines.length === 0) return;
    this.createBusy.set(true);
    this.createError.set(null);
    try {
      const items: ApiCountLine[] = [];
      for (const line of lines) {
        let approvalRequestId: string | null = null;
        if (line.countedQuantity < line.currentQuantity) {
          const approval = await this.approvalsApi.create({
            actionType: 'stock_disposal',
            payload: {
              itemType: line.itemType,
              itemId: line.itemId,
              countedQuantity: line.countedQuantity,
              currentQuantity: line.currentQuantity,
            },
          });
          if (approval.status !== 'approved') {
            this.createError.set(
              'A decrease needs a stock-disposal approval — it has been submitted for a manager to approve in Approvals. Try again once approved.',
            );
            return;
          }
          approvalRequestId = approval.id;
        }
        items.push({
          itemType: line.itemType,
          itemId: line.itemId,
          countedQuantity: line.countedQuantity,
          approvalRequestId,
        });
      }
      await this.inventoryApi.recordCount({ items });
      this.toasts.show('Cycle count recorded', 'good');
      this.creating.set(false);
      await this.loadCounts();
    } catch (err) {
      this.createError.set(errorText(err));
    } finally {
      this.createBusy.set(false);
    }
  }

  private async loadCountItems(): Promise<void> {
    try {
      const [summary, materials, products] = await Promise.all([
        this.inventoryApi.summary(),
        this.materialsApi.list({ page: 1, limit: 100 }),
        this.catalogueApi.list({ page: 1, limit: 100 }),
      ]);
      const materialNames = new Map(materials.data.map((m) => [m.id, `${m.name} (${m.unit})`]));
      const variantNames = new Map<string, string>();
      for (const product of products.data) {
        for (const variant of product.variants) {
          variantNames.set(variant.id, `${product.name} · ${variant.sku}`);
        }
      }
      const items: CountItem[] = summary
        .map((s) => {
          const itemType: InventoryItemType = s.itemType === 'material' ? 'material' : 'variant';
          const label =
            itemType === 'material'
              ? materialNames.get(s.itemId) ?? 'Material'
              : variantNames.get(s.itemId) ?? 'Variant';
          return { itemType, itemId: s.itemId, label, currentQuantity: s.currentQuantity };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      this.countItems.set(items);
    } catch (err) {
      this.createError.set(errorText(err));
    }
  }

  protected openMovement(line: ApiCountLine): void {
    this.movementLine.set(line);
    this.movementForm.direction = 'out';
    this.movementForm.quantity = 0;
    this.movementForm.note = '';
  }

  protected closeMovement(): void {
    this.movementLine.set(null);
  }

  protected async submitMovement(): Promise<void> {
    const line = this.movementLine();
    if (!line) return;
    const quantity = Number(this.movementForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.toasts.show('Quantity must be greater than zero.', 'bad');
      return;
    }
    this.saving.set(true);
    try {
      const delta = this.movementForm.direction === 'out' ? -quantity : quantity;
      const note = this.movementForm.note.trim();
      await this.inventoryApi.recordMovement(line.itemType as InventoryItemType, line.itemId, {
        movementType: 'adjustment',
        quantityDelta: delta,
        ...(note ? { referenceId: note } : {}),
      });
      this.toasts.show('Movement recorded', 'good');
      this.closeMovement();
    } catch (err) {
      this.toasts.show(errorText(err), 'bad');
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.router.navigate(['/warehouses/counts']);
  }

  private ago(at: number): string {
    const days = Math.round((Date.now() - at) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 d ago';
    return `${days} d ago`;
  }
}
