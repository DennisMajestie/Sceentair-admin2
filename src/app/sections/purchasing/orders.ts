import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { MaterialsApiService } from '../../core/materials-api.service';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { ToastService } from '../../core/toast';
import {
  date as fmtDate,
  initials,
  money as fmtMoney,
  daysUntil,
} from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';

@Component({
  selector: 'app-purchasing-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Purchasing</span>
        <h1 class="head__title">Material purchases</h1>
        <p class="head__lead">
          {{ store.pos().length }} records · {{ money(totalCost()) }} total spent
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/purchasing/materials">Materials</a>
        <a class="btn btn--ghost" routerLink="/purchasing/suppliers">Suppliers</a>
        <button type="button" class="btn btn--primary" (click)="openCreate()">
          <app-icon name="plus" [size]="15" />
          New purchase
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Material purchase summary">
      <article class="stat">
        <span class="stat__label">Total spent</span>
        <strong class="stat__value">{{ money(totalCost()) }}</strong>
        <span class="stat__detail">Across all material purchases</span>
      </article>
      <article class="stat">
        <span class="stat__label">Records</span>
        <strong class="stat__value">{{ store.pos().length }}</strong>
        <span class="stat__detail">Material purchase records</span>
      </article>
      <article class="stat">
        <span class="stat__label">Suppliers</span>
        <strong class="stat__value">{{ supplierCount() }}</strong>
        <span class="stat__detail">Unique suppliers</span>
      </article>
      <article class="stat">
        <span class="stat__label">Avg lead time</span>
        <strong class="stat__value">{{ avgLeadDays() }} days</strong>
        <span class="stat__detail">Average supplier lead time</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search material or supplier" aria-label="Search material purchases" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} records</span>
    </div>

    <div class="po-grid" aria-label="Material purchases">
      @for (row of visible(); track row.id) {
        <button type="button" class="po-card" (click)="open(row.id)" [attr.aria-label]="'Open ' + row.material + ' from ' + row.supplier">
          <span class="po-card__top">
            <span class="mono po-card__number">{{ row.material }}</span>
            <span class="badge">{{ money(row.quantity * row.cost) }}</span>
          </span>
          <span class="po-card__supplier">
            <span class="av av--sage">{{ initials(row.supplier) }}</span>
            <span class="po-card__supplier-name">{{ row.supplier }}</span>
          </span>
          <span class="po-card__line">
            <span>{{ row.quantity }} {{ row.quantity === 1 ? 'unit' : 'units' }} @ {{ money(row.cost) }}</span>
            <span class="po-card__value">{{ row.leadTimeDays }} day lead</span>
          </span>
          <span class="po-card__progress-label">
            <span>{{ fmtDate(row.purchasedAt) }}</span>
          </span>
          <span class="po-card__bottom">
            {{ row.note ? row.note : 'No note' }}
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="po-empty">
          <strong>No material purchases match.</strong>
          <span>Try another search term.</span>
          <a class="btn btn--ghost" routerLink="/purchasing/materials">Browse materials</a>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Material purchase detail">
      <ng-container drawerTitle>
        @if (selected(); as po) {
          <div class="dtitle">
            <strong class="mono">{{ po.material }}</strong>
            <span class="po-card__supplier-name">{{ po.supplier }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as po) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Supplier</span>
              <span class="dmeta">{{ po.supplier }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Total</span>
              <strong class="dtotal">{{ money(po.value) }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Purchased</dt><dd>{{ fmtDate(po.purchasedAt) }}</dd></div>
            <div><dt>Recorded by</dt><dd>{{ po.recordedBy }}</dd></div>
            <div><dt>Lead time</dt><dd>{{ po.leadTimeDays }} days</dd></div>
            <div><dt>Material</dt><dd>{{ store.material(po.lines[0]?.materialId ?? '')?.name ?? '—' }}</dd></div>
          </dl>

          <h3 class="dlabel">Purchase lines</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Material</th><th scope="col">Quantity</th><th scope="col">Cost</th></tr>
              </thead>
              <tbody>
                @for (line of po.lines; track line.materialId) {
                  <tr>
                    <td>
                      {{ store.material(line.materialId)?.name ?? line.materialId }}
                      <span class="sub mono">{{ store.material(line.materialId)?.code ?? '' }}</span>
                    </td>
                    <td class="num">{{ line.qty }}</td>
                    <td class="num">{{ money(line.cost) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <h3 class="dlabel">Note</h3>
          <p class="dnote">{{ po.note }}</p>
          <a class="btn btn--ghost dmaterials" routerLink="/purchasing/materials">View materials</a>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New purchase">
      <ng-container drawerTitle><div class="dtitle"><strong>New purchase</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createPurchase()">
        <p class="cnote">Purchases are approval-gated — the owner's request is approved instantly; staff requests wait for a manager.</p>

        <label class="field"><span class="field__label">Material</span>
          <select [(ngModel)]="createForm.materialId" name="poMaterial" required>
            <option value="">Select material…</option>
            @for (m of store.materials(); track m.id) {
              <option [value]="m.id">{{ m.name }} — {{ m.onHand }} {{ m.unit }} on hand</option>
            }
          </select>
        </label>
        <div class="cgrid">
          <label class="field"><span class="field__label">Quantity</span>
            <input type="number" min="1" step="1" [(ngModel)]="createForm.quantity" name="poQuantity" required />
          </label>
          <label class="field"><span class="field__label">Unit cost</span>
            <input type="number" min="0" step="0.01" [(ngModel)]="createForm.cost" name="poCost" required />
          </label>
        </div>
        <div class="cgrid">
          <label class="field"><span class="field__label">Supplier</span>
            <input type="text" [(ngModel)]="createForm.supplierName" name="poSupplier" placeholder="e.g. Aba Textile Mills" />
          </label>
          <label class="field"><span class="field__label">Lead time (days)</span>
            <input type="number" min="0" step="1" [(ngModel)]="createForm.leadTimeDays" name="poLead" />
          </label>
        </div>
        <label class="field"><span class="field__label">Note</span>
          <input type="text" [(ngModel)]="createForm.note" name="poNote" placeholder="optional" />
        </label>
        <p class="ctotal">Total <strong>{{ money(createTotal()) }}</strong></p>
        @if (createError()) {
          <p class="field-err">{{ createError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="creatingBusy() || !createForm.materialId || createForm.quantity < 1">
          {{ creatingBusy() ? 'Recording…' : 'Record purchase' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .po-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .po-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .po-card:hover { border-color: var(--primary); }
    .po-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .po-card__top, .po-card__line, .po-card__progress-label, .po-card__bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .po-card__number { font-size: var(--fs-sm); font-weight: 750; }
    .po-card__supplier { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .po-card__supplier-name { overflow: hidden; font-size: var(--fs-md); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .po-card__line { padding-top: 13px; border-top: 1px solid var(--line); color: var(--muted); font-size: var(--fs-sm); }
    .po-card__value { color: var(--text); font-size: var(--fs-md); font-weight: 700; white-space: nowrap; }
    .po-card__progress-label { color: var(--muted); font-size: var(--fs-xs); }
    .po-card__bottom { color: var(--faint); font-size: var(--fs-xs); }
    .po-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .po-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dnote { font-size: var(--fs-md); color: var(--muted); }
    .dmaterials { justify-self: start; }
    .create-form { display: grid; gap: 12px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .cnote { padding: 12px 14px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); font-size: var(--fs-sm); margin: 0; }
    .ctotal { margin: 0; font-size: var(--fs-sm); color: var(--muted); }
    .ctotal strong { color: var(--text); font-size: var(--fs-lg); }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 1100px) { .po-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .po-grid { grid-template-columns: 1fr; } .cgrid { grid-template-columns: 1fr; } }
  `,
})
export class PurchasingOrders {
  protected readonly store = inject(Store);
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly fmtDate = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly initials = initials;

  protected readonly query = signal('');
  protected readonly filter = signal('all');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.store.load();
  }

  protected readonly rows = computed(() =>
    this.store.pos().map((po) => {
      const first = po.lines[0];
      const firstMaterial = first ? this.store.material(first.materialId) : undefined;
      return {
        id: po.id,
        material: firstMaterial?.name ?? '—',
        code: firstMaterial?.code ?? '',
        quantity: first?.qty ?? 0,
        cost: first?.cost ?? 0,
        supplier: po.supplierId,
        purchasedAt: po.createdAt,
        leadTimeDays: po.leadTimeDays,
        recordedBy: po.recordedBy,
        status: po.status,
        eta: po.eta,
        note: po.note,
        value: po.lines.reduce((a, l) => a + l.qty * l.cost, 0),
        lines: po.lines,
        orderedQty: po.lines.reduce((total, line) => total + line.qty, 0),
        receivedQty: po.lines.reduce((total, line) => total + line.received, 0),
        progress: po.lines.reduce((total, line) => total + line.qty, 0)
          ? Math.round((po.lines.reduce((total, line) => total + line.received, 0) / po.lines.reduce((total, line) => total + line.qty, 0)) * 100)
          : 0,
        isOverdue: po.status !== 'received' && !!po.eta && po.eta < Date.now(),
        timeline: [
          { label: 'Draft', done: true, current: po.status === 'draft', detail: fmtDate(po.createdAt) },
          { label: 'Sent', done: !!po.sentAt, current: po.status === 'sent', detail: po.sentAt ? fmtDate(po.sentAt) : 'Not sent' },
          { label: 'Partial', done: po.status === 'partial' || po.status === 'received', current: po.status === 'partial', detail: po.status === 'partial' ? 'Receipt in progress' : 'Pending' },
          { label: 'Received', done: po.status === 'received', current: po.status === 'received', detail: po.receivedAt ? fmtDate(po.receivedAt) : 'Pending' },
        ],
      };
    }),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.rows()
      .filter((r) => {
        if (f !== 'all' && r.status !== f) return false;
        return !q || `${r.material} ${r.supplier}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.purchasedAt - a.purchasedAt);
  });

  protected readonly totalCost = computed(() =>
    this.rows().reduce((total, row) => total + row.value, 0),
  );

  protected readonly supplierCount = computed(
    () => new Set(this.rows().map((row) => row.supplier).filter(Boolean)).size,
  );

  protected readonly avgLeadDays = computed(() => {
    const rows = this.rows().filter((row) => row.leadTimeDays != null);
    return rows.length
      ? Math.round(rows.reduce((total, row) => total + (row.leadTimeDays ?? 0), 0) / rows.length)
      : 0;
  });

  protected readonly openCount = computed(() => this.rows().filter((r) => r.status !== 'received').length);
  protected readonly dueThisWeekCount = computed(() =>
    this.rows().filter((row) => {
      const days = row.eta ? daysUntil(row.eta) : -1;
      return row.status !== 'received' && days >= 0 && days <= 7;
    }).length,
  );
  protected readonly overdueCount = computed(() => this.rows().filter((row) => row.isOverdue).length);
  protected readonly avgOnTime = computed(() => {
    const suppliers = this.store.suppliers();
    return suppliers.length
      ? Math.round((suppliers.reduce((total, supplier) => total + supplier.onTime, 0) / suppliers.length) * 100)
      : 0;
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/purchasing/orders', id]);
  }

  protected close(): void {
    this.router.navigate(['/purchasing/orders']);
  }

  protected readonly creating = signal(false);
  protected readonly creatingBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = {
    materialId: '',
    quantity: 0,
    cost: 0,
    supplierName: '',
    leadTimeDays: 0,
    note: '',
  };

  protected openCreate(): void {
    this.createForm.materialId = '';
    this.createForm.quantity = 1;
    this.createForm.cost = 0;
    this.createForm.supplierName = '';
    this.createForm.leadTimeDays = 0;
    this.createForm.note = '';
    this.createError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected createTotal(): number {
    return (Number(this.createForm.quantity) || 0) * (Number(this.createForm.cost) || 0);
  }

  protected async createPurchase(): Promise<void> {
    const quantity = Math.round(Number(this.createForm.quantity));
    const cost = Number(this.createForm.cost);
    if (!this.createForm.materialId || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(cost) || cost < 0) {
      this.createError.set('Choose a material and enter a quantity of at least 1 and a cost of 0 or more.');
      return;
    }
    this.creatingBusy.set(true);
    this.createError.set(null);
    try {
      const approval = await this.approvalsApi.create({
        actionType: 'purchasing',
        payload: {
          materialId: this.createForm.materialId,
          quantity,
          cost,
          note: this.createForm.note.trim() || null,
        },
      });
      if (approval.status !== 'approved') {
        this.createError.set('Purchase request submitted — a manager must approve it in Approvals before the purchase is recorded.');
        await this.store.load();
        return;
      }
      await this.materialsApi.purchase({
        materialId: this.createForm.materialId,
        quantity,
        cost,
        supplierName: this.createForm.supplierName.trim() || null,
        leadTimeDays: this.createForm.leadTimeDays ? Math.round(Number(this.createForm.leadTimeDays)) : null,
        note: this.createForm.note.trim() || null,
        approvalRequestId: approval.id,
      });
      this.toast.show('Purchase recorded', 'good');
      this.creating.set(false);
      await this.store.load();
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Could not record the purchase.');
    } finally {
      this.creatingBusy.set(false);
    }
  }
}