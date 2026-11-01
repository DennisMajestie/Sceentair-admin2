import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import {
  date as fmtDate,
  daysUntil,
  initials,
  money as fmtMoney,
  statusLabel,
  statusTone,
} from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';

@Component({
  selector: 'app-purchasing-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Purchasing</span>
        <h1 class="head__title">Purchase orders</h1>
        <p class="head__lead">
          {{ store.pos().length }} orders placed · {{ store.openPurchaseOrders().length }} still open.
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/purchasing/materials">Materials</a>
        <a class="btn btn--ghost" routerLink="/purchasing/suppliers">Suppliers</a>
      </div>
    </div>

    <div class="stats" aria-label="Purchase order summary">
      <article class="stat">
        <span class="stat__label">Open orders</span>
        <strong class="stat__value">{{ openCount() }}</strong>
        <span class="stat__detail">Draft, sent and partial</span>
      </article>
      <article class="stat">
        <span class="stat__label">Due this week</span>
        <strong class="stat__value">{{ dueThisWeekCount() }}</strong>
        <span class="stat__detail">Open orders · next 7 days</span>
      </article>
      <article class="stat">
        <span class="stat__label">Past due</span>
        <strong class="stat__value">{{ overdueCount() }}</strong>
        <span class="stat__detail">Open orders past ETA</span>
      </article>
      <article class="stat">
        <span class="stat__label">Supplier on-time rate</span>
        <strong class="stat__value">{{ avgOnTime() }}%</strong>
        <span class="stat__detail">Average across suppliers</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="filter.set(f.id)">
            {{ f.label }} <span class="seg__count">{{ filterCount(f.id) }}</span>
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search PO or supplier" aria-label="Search purchase orders" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} orders</span>
    </div>

    <div class="po-grid" aria-label="Purchase orders">
      @for (row of visible(); track row.id) {
        <button type="button" class="po-card" (click)="open(row.id)" [attr.aria-label]="'Open ' + row.number + ' for ' + row.supplier">
          <span class="po-card__top">
            <span class="mono po-card__number">{{ row.number }}</span>
            <span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span>
          </span>
          <span class="po-card__supplier">
            <span class="av av--{{ row.supplierTone }}">{{ row.supplierInitials }}</span>
            <span class="po-card__supplier-name">{{ row.supplier }}</span>
          </span>
          <span class="po-card__line">
            <span>{{ row.lines[0]?.name ?? 'No line items' }}{{ row.lines.length > 1 ? ' +' + (row.lines.length - 1) + ' more' : '' }}</span>
            <span class="po-card__value">{{ money(row.value) }}</span>
          </span>
          <span class="po-card__progress-label">
            <span>{{ row.receivedQty }} of {{ row.orderedQty }} units received</span>
            <span>{{ row.progress }}%</span>
          </span>
          <span class="po-progress" aria-hidden="true"><span [style.width.%]="row.progress"></span></span>
          <span class="po-card__bottom">
            <span>{{ row.lines.length }} {{ row.lines.length === 1 ? 'line' : 'lines' }} · created {{ date(row.createdAt) }}</span>
            <span [class.is-overdue]="row.isOverdue">
              @if (row.eta) { ETA {{ date(row.eta) }} } @else { No ETA }
            </span>
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="po-empty">
          <strong>No purchase orders match.</strong>
          <span>Try another status or search term.</span>
          <a class="btn btn--ghost" routerLink="/purchasing/materials">Browse materials</a>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Purchase order detail">
      <ng-container drawerTitle>
        @if (selected(); as po) {
          <div class="dtitle">
            <strong class="mono">{{ po.number }}</strong>
            <span class="badge" [class]="'badge badge--' + po.tone">{{ po.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as po) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Supplier</span>
              <a class="dlink" [routerLink]="'/purchasing/suppliers/' + po.supplierId">{{ po.supplier }}</a>
              <span class="dmeta">{{ po.supplierCity }}, {{ po.supplierCountry }} · {{ po.supplierLeadDays }} day lead</span>
            </div>
            <div class="dright">
              <span class="stat__label">Order value</span>
              <strong class="dtotal">{{ money(po.value) }}</strong>
            </div>
          </div>

          <div class="dprogress">
            <div class="dprogress__top">
              <strong>Receipt progress</strong>
              <span>{{ po.receivedQty }} / {{ po.orderedQty }} units · {{ po.progress }}%</span>
            </div>
            <div class="po-progress"><span [style.width.%]="po.progress"></span></div>
          </div>

          <ol class="timeline" aria-label="Purchase order status">
            @for (step of po.timeline; track step.label) {
              <li class="timeline__step" [class.is-done]="step.done" [class.is-current]="step.current">
                <span class="timeline__dot" aria-hidden="true"></span>
                <span class="timeline__copy">
                  <strong>{{ step.label }}</strong>
                  <span>{{ step.detail }}</span>
                </span>
              </li>
            }
          </ol>

          <dl class="facts">
            <div><dt>Created</dt><dd>{{ date(po.createdAt) }}</dd></div>
            <div><dt>Sent</dt><dd>{{ po.sentAt ? date(po.sentAt) : '—' }}</dd></div>
            <div><dt>ETA</dt><dd>{{ po.eta ? date(po.eta) : '—' }}</dd></div>
            <div><dt>Received</dt><dd>{{ po.receivedAt ? date(po.receivedAt) : '—' }}</dd></div>
          </dl>

          <h3 class="dlabel">Order lines</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Material</th><th scope="col">Ordered</th><th scope="col">Received</th><th scope="col">Cost</th></tr>
              </thead>
              <tbody>
                @for (line of po.lines; track line.materialId) {
                  <tr>
                    <td>
                      {{ line.name }}
                      <span class="sub mono">{{ line.code }}</span>
                    </td>
                    <td class="num">{{ line.qty }}</td>
                    <td class="num" [class.partial]="line.received > 0 && line.received < line.qty">{{ line.received }}</td>
                    <td class="num">{{ money(line.cost) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (po.note) {
            <h3 class="dlabel">Note</h3>
            <p class="dnote">{{ po.note }}</p>
          }
          <a class="btn btn--ghost dmaterials" routerLink="/purchasing/materials">View materials</a>
        </div>
      }
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
    .po-progress { display: block; height: 6px; overflow: hidden; border-radius: 99px; background: var(--line); }
    .po-progress > span { display: block; height: 100%; border-radius: inherit; background: var(--sage); transition: width 0.2s ease; }
    .po-card__bottom { color: var(--faint); font-size: var(--fs-xs); }
    .po-card__bottom .is-overdue { color: var(--bad); font-weight: 700; }
    .po-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .po-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dprogress { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--sd-r-card); }
    .dprogress__top { display: flex; justify-content: space-between; gap: 10px; font-size: var(--fs-xs); }
    .dprogress__top span { color: var(--muted); text-align: right; }
    .timeline { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
    .timeline__step { position: relative; display: grid; justify-items: center; gap: 8px; color: var(--faint); text-align: center; }
    .timeline__step:not(:last-child)::after { position: absolute; top: 6px; left: calc(50% + 9px); width: calc(100% - 18px); height: 2px; background: var(--line); content: ''; }
    .timeline__step.is-done:not(:last-child)::after { background: var(--sage); }
    .timeline__dot { z-index: 1; width: 12px; height: 12px; border: 2px solid var(--line); border-radius: 50%; background: var(--surface); }
    .timeline__step.is-done .timeline__dot, .timeline__step.is-current .timeline__dot { border-color: var(--sage); background: var(--sage); }
    .timeline__copy { display: grid; gap: 3px; }
    .timeline__step.is-done, .timeline__step.is-current { color: var(--text); }
    .sub { display: block; font-size: var(--fs-2xs); color: var(--faint); }
    .partial { color: var(--warn); font-weight: 700; }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dlink { font-size: var(--fs-lg); font-weight: 700; color: var(--primary); }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dnote { font-size: var(--fs-md); color: var(--muted); }
    .dmaterials { justify-self: start; }
    @media (max-width: 1100px) { .po-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .po-grid { grid-template-columns: 1fr; } }
  `,
})
export class PurchasingOrders {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'sent', label: 'Sent' },
    { id: 'partial', label: 'Partial' },
    { id: 'received', label: 'Received' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly rows = computed(() =>
    this.store.pos().map((po) => ({
      id: po.id,
      number: po.number,
      supplierId: po.supplierId,
      supplier: this.store.supplier(po.supplierId)?.name ?? po.supplierId,
      supplierInitials: initials(this.store.supplier(po.supplierId)?.name ?? po.supplierId),
      supplierTone: this.store.supplier(po.supplierId)?.tone ?? 'sage',
      supplierCity: this.store.supplier(po.supplierId)?.city ?? '',
      supplierCountry: this.store.supplier(po.supplierId)?.country ?? '',
      supplierLeadDays: this.store.supplier(po.supplierId)?.leadDays ?? 0,
      status: po.status,
      tone: statusTone(po.status),
      label: statusLabel(po.status),
      createdAt: po.createdAt,
      sentAt: po.sentAt,
      eta: po.eta,
      receivedAt: po.receivedAt,
      note: po.note,
      value: po.lines.reduce((a, l) => a + l.qty * l.cost, 0),
      lines: po.lines.map((l) => {
        const m = this.store.material(l.materialId);
        return {
          materialId: l.materialId,
          name: m?.name ?? l.materialId,
          code: m?.code ?? '',
          qty: l.qty,
          received: l.received,
          cost: l.cost,
        };
      }),
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
    })),
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.rows()
      .filter((r) => {
        if (f !== 'all' && r.status !== f) return false;
        return !q || `${r.number} ${r.supplier}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
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

  protected filterCount(id: string): number {
    return id === 'all' ? this.rows().length : this.rows().filter((row) => row.status === id).length;
  }

  protected open(id: string): void {
    this.router.navigate(['/purchasing/orders', id]);
  }

  protected close(): void {
    this.router.navigate(['/purchasing/orders']);
  }
}
