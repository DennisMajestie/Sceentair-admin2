import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import {
  date as fmtDate,
  initials,
  money as fmtMoney,
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
        <h1 class="head__title">Material purchases</h1>
        <p class="head__lead">
          {{ store.pos().length }} records · {{ money(totalCost()) }} total spent
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/purchasing/materials">Materials</a>
        <a class="btn btn--ghost" routerLink="/purchasing/suppliers">Suppliers</a>
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
            <span>{{ row.quantity }} {{ row.quantity === 1 ? 'unit' : 'units' }} &#64; {{ money(row.cost) }}</span>
            <span class="po-card__value">{{ row.leadTimeDays }} day lead</span>
          </span>
          <span class="po-card__progress-label">
            <span>{{ date(row.purchasedAt) }}</span>
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
            <div><dt>Purchased</dt><dd>{{ date(po.purchasedAt) }}</dd></div>
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
  protected readonly initials = initials;
  protected readonly money = fmtMoney;

  protected readonly query = signal('');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly rows = computed(() =>
    this.store.pos().map((po) => ({
      id: po.id,
      material: this.store.material(po.lines[0]?.materialId ?? '')?.name ?? '—',
      code: this.store.material(po.lines[0]?.materialId ?? '')?.code ?? '',
      quantity: po.lines[0]?.qty ?? 0,
      cost: po.lines[0]?.cost ?? 0,
      supplier: po.supplierId,
      purchasedAt: po.createdAt,
      leadTimeDays: po.leadTimeDays,
      recordedBy: po.recordedBy,
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
    })),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.rows()
      .filter((r) => !q || `${r.material} ${r.supplier}`.toLowerCase().includes(q))
      .sort((a, b) => b.purchasedAt - a.purchasedAt);
  });

  protected readonly totalCost = computed(() =>
    this.rows().reduce((a, r) => a + r.value, 0),
  );
  protected readonly supplierCount = computed(() =>
    new Set(this.rows().map((r) => r.supplier)).size,
  );
  protected readonly avgLeadDays = computed(() => {
    const days = this.rows().map((r) => r.leadTimeDays).filter((d) => d > 0);
    return days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/purchasing/orders', id]);
  }

  protected close(): void {
    this.router.navigate(['/purchasing/orders']);
  }
}
