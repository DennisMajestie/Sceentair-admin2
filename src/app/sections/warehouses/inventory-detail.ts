import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { count as fmtCount, money as fmtMoney, relative as fmtRelative, titleCase } from '../../core/format';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../core/toast';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { CatalogueApiService } from '../../core/catalogue-api.service';
import { MaterialsApiService } from '../../core/materials-api.service';
import {
  ApiInventoryDigest,
  ApiInventoryMovement,
  InventoryApiService,
  type InventoryItemType,
} from '../../core/inventory-api.service';

interface MovementEntry {
  id: string;
  text: string;
  at: number;
  tone: '' | 'good' | 'warn';
}

interface ItemFacts {
  label: string;
  typeLabel: string;
  facts: Array<{ name: string; value: string }>;
  unitPrice: number | null;
}

function errorText(err: unknown, fallback: string): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : fallback;
}

const LOAD_FAILED = 'The server did not respond. Nothing has been changed.';

function movementLabel(movementType: string): string {
  return titleCase(movementType.toLowerCase().replace(/_/g, ' '));
}

function signed(delta: number): string {
  return delta < 0 ? String(delta) : `+${delta}`;
}

function entryText(entry: ApiInventoryMovement): string {
  const reference = entry.referenceId ? ` (${entry.referenceId})` : '';
  const noun = Math.abs(entry.quantityDelta) === 1 ? 'unit' : 'units';
  return `${movementLabel(entry.movementType)}: ${signed(entry.quantityDelta)} ${noun}${reference}`;
}

function stockState(quantity: number): 'out_of_stock' | 'in_stock' {
  return quantity <= 0 ? 'out_of_stock' : 'in_stock';
}

@Component({
  selector: 'app-warehouses-inventory-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Stock ledger</span>
        <h1 class="head__title mono">{{ itemLabel() }}</h1>
        <p class="head__lead">{{ typeLabel() }} · audited movement history. Entries cannot be edited or deleted, only corrected with another movement.</p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--ghost" routerLink="/warehouses/inventory">
          <app-icon name="arrow-left" [size]="14" />
          All inventory
        </button>
        <button type="button" class="btn btn--primary" (click)="runStockCheck()" [disabled]="digestBus()">
          <app-icon name="shield" [size]="15" />
          Run stock check
        </button>
      </div>
    </div>

    @if (loading() && entries().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 54px"></div>
        }
      </div>
    } @else {
      <div class="grid">
        <section class="card feed">
          <h2 class="section-label">Movement history</h2>
          <ol class="feed__list">
            @for (entry of entries(); track entry.id) {
              <li class="feed__item">
                <span class="badge feed__delta" [class]="'badge ' + (entry.tone ? 'badge--' + entry.tone : '')">{{ entry.tone === 'warn' ? 'Out' : 'In' }}</span>
                <span class="feed__text">
                  {{ entry.text }}
                  <span class="sub">{{ fmtRelative(entry.at) }}</span>
                </span>
              </li>
            }
            @if (!loading() && entries().length === 0 && !error()) {
              <li class="feed__item feed__item--empty">No movements recorded yet for this item.</li>
            }
          </ol>
          @if (total() > entries().length) {
            <p class="sub more">Showing the latest {{ entries().length }} of {{ count(total()) }} ledger entries.</p>
          }
        </section>

        <aside class="aside">
          <section class="card panel">
            <h2 class="section-label">Status</h2>
            <dl class="facts">
              <div>
                <dt>In stock now</dt>
                <dd class="num">
                  {{ count(currentQuantity()) }}
                  <span class="badge" [class]="'badge ' + (stockBadge() === 'out_of_stock' ? 'badge--bad' : 'badge--good')">
                    {{ stockBadge() === 'out_of_stock' ? 'Out of stock' : 'In stock' }}
                  </span>
                </dd>
              </div>
              <div><dt>Movements</dt><dd class="num">{{ count(total()) }}</dd></div>
              @for (fact of itemFacts().facts; track fact.name) {
                <div><dt>{{ fact.name }}</dt><dd>{{ fact.value }}</dd></div>
              }
            </dl>
            @if (itemFacts().unitPrice !== null) {
              <dl class="facts">
                <div><dt>Unit price</dt><dd class="num">{{ money(itemFacts().unitPrice ?? 0) }}</dd></div>
                <div><dt>Estimated value</dt><dd class="num">{{ money(estimatedValue()) }}</dd></div>
              </dl>
            }
          </section>

          @if (digest(); as digest) {
            <section class="card panel">
              <h2 class="section-label">Stock check</h2>
              <dl class="facts">
                <div><dt>Entries</dt><dd class="num">{{ count(digest.entryCount) }}</dd></div>
                <div><dt>First entry</dt><dd>{{ digest.firstTimestamp ? shortDate(digest.firstTimestamp) : '—' }}</dd></div>
                <div><dt>Last entry</dt><dd>{{ digest.lastTimestamp ? shortDate(digest.lastTimestamp) : '—' }}</dd></div>
                <div><dt>Ledger head</dt><dd class="mono fp">{{ digest.ledgerHead ? digest.ledgerHead.slice(0, 16) : '—' }}</dd></div>
              </dl>
            </section>
          }
        </aside>
      </div>
    }

    <section class="card move">
      <h2 class="section-label">Record movement</h2>
      <p class="sub move__note">Movements are appended to the hash-chained ledger and cannot be edited or deleted, only corrected with another movement.</p>
      <form class="move__form" (ngSubmit)="submitMovement()">
        <div class="move__fields">
          <label class="field"><span class="field-label">Direction</span>
            <select [(ngModel)]="form.direction" name="direction">
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </label>
          <label class="field"><span class="field-label">Quantity</span><input type="number" [(ngModel)]="form.quantity" name="quantity" min="1" step="1" required /></label>
          <label class="field"><span class="field-label">Reference</span><input type="text" [(ngModel)]="form.reference" name="reference" placeholder="optional note" /></label>
        </div>
        <div class="move__actions">
          <button type="submit" class="btn btn--primary" [disabled]="saving()">{{ submitLabel() }}</button>
        </div>
      </form>
      @if (approvalRequested()) {
        <div class="notice notice--info" role="status">
          Removal approval requested — Management decides in the approvals queue. Resubmit the same movement to post it against the approval.
        </div>
      }
      @if (formError()) {
        <div class="notice notice--error" role="alert">{{ formError() }}</div>
      }
    </section>

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }
  `,
  styles: `
    .mono { font-family: var(--fs-mono, monospace); }
    .fp { font-size: var(--fs-xs); font-family: var(--fs-mono, monospace); color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1.9fr 1.1fr; gap: var(--gap); margin-bottom: var(--gap); align-items: start; }
    @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
    .section-label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); margin: 0 0 12px; }
    .feed__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .feed__item { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); }
    .feed__item--empty { grid-template-columns: 1fr; color: var(--muted); font-size: var(--fs-sm); text-align: center; padding: 18px; }
    .feed__text { display: grid; gap: 2px; font-size: var(--fs-sm); font-weight: 600; }
    .sub { font-size: var(--fs-2xs); color: var(--faint); font-weight: 400; }
    .more { margin: 10px 2px 0; }
    .aside { display: grid; gap: var(--gap); }
    .panel { padding: 14px; }
    .facts { display: grid; gap: 10px 14px; margin: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .facts div { display: grid; gap: 2px; min-width: 0; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .move { padding: 14px; display: grid; gap: 12px; }
    .move__note { margin: 0; }
    .move__form { display: grid; gap: 10px; }
    .move__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; min-width: 0; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { border-color: var(--bad); color: var(--bad); margin-top: 10px; }
    .notice--info { border-color: var(--primary); color: var(--primary); margin-top: 10px; }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 54px; border-radius: 8px; background: var(--well); }
  `,
})
export class WarehouseStockDetail {
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;
  protected readonly fmtRelative = fmtRelative;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly movements = signal<ApiInventoryMovement[]>([]);
  protected readonly total = signal(0);
  protected readonly currentQuantity = signal(0);
  protected readonly digest = signal<ApiInventoryDigest | null>(null);
  protected readonly digestBus = signal(false);
  protected readonly itemFacts = signal<ItemFacts>({
    label: '',
    typeLabel: '',
    facts: [],
    unitPrice: null,
  });

  protected readonly itemType = signal<InventoryItemType>('variant');
  protected readonly itemId = signal('');
  protected readonly saving = signal(false);
  protected readonly approvalId = signal<string | null>(null);
  protected readonly approvalRequested = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly form = {
    direction: 'in' as 'in' | 'out',
    quantity: 1,
    reference: '',
  };

  constructor() {
    const params = toSignal(
      this.route.paramMap.pipe(map((p) => ({ type: p.get('itemType'), id: p.get('itemId') }))),
      { initialValue: { type: null, id: null } },
    );
    effect(() => {
      const { type, id } = params();
      if (!type || !id) return;
      const itemType = type === 'material' ? 'material' : 'variant';
      this.itemType.set(itemType);
      this.itemId.set(id);
      void this.load(itemType, id);
    });
  }

  private async load(itemType: InventoryItemType, itemId: string): Promise<void> {
    this.itemType.set(itemType);
    this.itemId.set(itemId);
    this.loading.set(true);
    this.error.set(null);
    this.digest.set(null);
    this.movements.set([]);
    this.total.set(0);
    this.currentQuantity.set(0);
    this.approvalId.set(null);
    this.approvalRequested.set(false);
    try {
      const ctx = await Promise.allSettled([
        this.inventoryApi.movements(itemType, itemId, { page: 1, limit: 50 }),
        itemType === 'variant'
          ? this.catalogueApi
              .list({ page: 1, limit: 100 })
              .then((list) => {
                for (const product of list.data) {
                  const variant = product.variants.find((v) => v.id === itemId);
                  if (variant) {
                    const facts: ItemFacts = {
                      label: variant.sku || shortId(itemId),
                      typeLabel: 'Finished goods',
                      facts: [
                        { name: 'Product', value: product.name },
                        { name: 'Size', value: variant.size || product.sizeClass || '—' },
                        { name: 'Colour', value: variant.colour || '—' },
                      ],
                      unitPrice: variant.priceOverride ?? product.basePrice,
                    };
                    return facts;
                  }
                }
                return {
                  label: shortId(itemId),
                  typeLabel: 'Finished goods',
                  facts: [],
                  unitPrice: null,
                } satisfies ItemFacts;
              })
              .catch(() => null)
          : this.materialsApi
              .valuation()
              .then((rows) => {
                const material = rows.find((m) => m.id === itemId);
                if (!material) return null;
                return {
                  label: material.name || shortId(itemId),
                  typeLabel: 'Raw materials',
                  facts: [
                    { name: 'Category', value: materialLabel(material.category ?? '') || 'None' },
                    { name: 'Storage location', value: material.storageLocation || '—' },
                  ],
                  unitPrice: null,
                } satisfies ItemFacts;
              })
              .catch(() => null),
      ]);

      const [movementResult, factResult] = ctx;
      if (movementResult.status === 'fulfilled') {
        this.movements.set(movementResult.value.data);
        this.total.set(movementResult.value.total);
        this.currentQuantity.set(movementResult.value.currentQuantity);
      } else {
        this.error.set(errorText(movementResult.reason, LOAD_FAILED));
      }
      if (factResult.status === 'fulfilled' && factResult.value) {
        this.itemFacts.set(factResult.value);
      } else {
        this.itemFacts.set({ label: shortId(this.itemId()), typeLabel: this.typeLabel(), facts: [], unitPrice: null });
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected shortDate(iso: string): string {
    const ts = Date.parse(iso);
    if (!ts) return iso;
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  protected itemLabel(): string {
    return this.itemFacts().label || this.itemId() || 'Item';
  }

  protected typeLabel(): string {
    return this.itemType() === 'material' ? 'Raw materials' : 'Finished goods';
  }

  protected readonly entries = computed<MovementEntry[]>(() =>
    this.movements().map((movement) => ({
      id: movement.id,
      text: entryText(movement),
      at: Date.parse(movement.timestamp) || 0,
      tone: movement.quantityDelta < 0 ? ('warn' as const) : ('good' as const),
    })),
  );

  protected estimatedValue(): number {
    const price = this.itemFacts().unitPrice;
    return price === null ? 0 : price * this.currentQuantity();
  }

  protected stockBadge(): 'in_stock' | 'out_of_stock' {
    return stockState(this.currentQuantity());
  }

  protected submitLabel(): string {
    return this.needsApproval() ? 'Request approval' : 'Record movement';
  }

  private needsApproval(): boolean {
    const delta = this.delta();
    return delta < 0 && this.approvalId() === null;
  }

  private delta(): number {
    const quantity = Number(this.form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return NaN;
    return this.form.direction === 'out' ? -Math.round(quantity) : Math.round(quantity);
  }

  protected async runStockCheck(): Promise<void> {
    if (this.digestBus()) return;
    this.digestBus.set(true);
    try {
      this.digest.set(await this.inventoryApi.digest(this.itemType(), this.itemId()));
    } catch {
      this.toasts.show('The stock check could not run.', 'bad');
    } finally {
      this.digestBus.set(false);
    }
  }

  protected async submitMovement(): Promise<void> {
    const delta = this.delta();
    if (Number.isNaN(delta) || delta === 0) {
      this.formError.set('Enter a whole number other than zero. Movements with decimals are removed from the ledger.');
      return;
    }
    this.formError.set(null);
    const reference = this.form.reference.trim();
    const approvalId = this.approvalId();

    if (this.needsApproval()) {
      try {
        this.saving.set(true);
        const approval = await this.approvalsApi.create({
          actionType: 'stock_disposal',
          payload: { item: this.itemId(), delta, note: reference },
        });
        this.approvalId.set(approval.id);
        this.approvalRequested.set(true);
        this.toasts.show('Removal approval requested — Management decides in the approvals queue.', 'good');
      } catch (err) {
        this.formError.set(errorText(err, 'The approval request was refused. Try again or ask Management for help.'));
      } finally {
        this.saving.set(false);
      }
      return;
    }

    this.saving.set(true);
    try {
      await this.inventoryApi.recordMovement(this.itemType(), this.itemId(), {
        movementType: 'adjustment',
        quantityDelta: delta,
        ...(reference ? { referenceId: reference } : {}),
        ...(approvalId ? { approvalRequestId: approvalId } : {}),
      });
      this.toasts.show('Movement recorded', 'good');
      this.approvalRequested.set(false);
      this.form.direction = 'in';
      this.form.quantity = 1;
      this.form.reference = '';
      const refreshed = await this.inventoryApi.movements(this.itemType(), this.itemId(), { page: 1, limit: 50 });
      this.movements.set(refreshed.data);
      this.total.set(refreshed.total);
      this.currentQuantity.set(refreshed.currentQuantity);
    } catch (err) {
      this.formError.set(errorText(err, 'The movement was refused. Removing stock needs an approved request.'));
    } finally {
      this.saving.set(false);
    }
  }
}

function shortId(itemId: string): string {
  return itemId.slice(0, 8);
}

function materialLabel(category: string): string {
  return category ? titleCase(category.replace(/_/g, ' ')) : '';
}
