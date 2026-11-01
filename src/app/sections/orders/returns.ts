import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Store } from '../../core/store';
import { date as fmtDate, money as fmtMoney, statusLabel, statusTone } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { ProductShot } from '../../ui/product-shot';

@Component({
  selector: 'app-orders-returns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Drawer, ProductShot, RouterLink],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">Returns</h1>
        <p class="head__lead">{{ store.returns().length }} returns logged · {{ pending() }} awaiting a decision.</p>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Return status filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="filter.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">RMA</th>
              <th scope="col">Order</th>
              <th scope="col">Product</th>
              <th scope="col">Qty</th>
              <th scope="col">Reason</th>
              <th scope="col">Refund</th>
              <th scope="col">Raised</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr>
                <td class="mono strong"><a class="return-link" [routerLink]="'/orders/returns/' + row.id">{{ row.number }}</a></td>
                <td class="mono">{{ row.orderNumber }}</td>
                <td>{{ row.product }}</td>
                <td class="num">{{ row.qty }}</td>
                <td>{{ row.reason }}</td>
                <td class="num">{{ money(row.refund) }}</td>
                <td>{{ date(row.createdAt) }}</td>
                <td><span class="badge" [class]="'badge badge--' + row.tone">{{ row.label }}</span></td>
              </tr>
            }
            @if (visible().length === 0) {
              <tr><td colspan="8" class="empty">No returns match.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Return detail">
      <ng-container drawerTitle>
        @if (selected(); as r) {
          <div class="dtitle">
            <strong class="mono">{{ r.number }}</strong>
            <span class="badge" [class]="'badge badge--' + r.tone">{{ r.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as r) {
        <div class="dbody">
          <div class="row dgap">
            <span class="thumb thumb--lg"><app-product-shot [photo]="r.photo" [label]="r.product" /></span>
            <div>
              <h3 class="dproduct">{{ r.product }}</h3>
              <p class="dsub">{{ r.size }} · {{ r.sku }}</p>
              <p class="dsub">Order <span class="mono">{{ r.orderNumber }}</span></p>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Quantity</dt><dd class="num">{{ r.qty }}</dd></div>
            <div><dt>Refund</dt><dd class="num">{{ money(r.refund) }}</dd></div>
            <div><dt>Raised</dt><dd>{{ date(r.createdAt) }}</dd></div>
            <div><dt>Reason</dt><dd>{{ r.reason }}</dd></div>
          </dl>

          <div class="dmeta">{{ r.customer }}</div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .return-link { color: inherit; text-decoration: none; }
    .return-link:hover { color: var(--primary); text-decoration: underline; }
    .strong { font-weight: 700; }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dproduct { font-size: var(--fs-xl); font-weight: 700; }
    .dsub { font-size: var(--fs-sm); color: var(--muted); }
    .dgap { align-items: flex-start; gap: 14px; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dmeta { font-size: var(--fs-sm); color: var(--muted); }
  `,
})
export class OrdersReturns {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;
  protected readonly filter = signal('all');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'requested', label: 'Requested' },
    { id: 'received', label: 'Received' },
    { id: 'restocked', label: 'Restocked' },
    { id: 'refunded', label: 'Refunded' },
    { id: 'rejected', label: 'Rejected' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  private readonly rows = computed(() =>
    this.store.returns().map((r) => {
      const p = this.store.product(r.productId);
      const o = this.store.order(r.orderId);
      return {
        id: r.id,
        number: r.number,
        orderNumber: o?.number ?? r.orderId,
        product: p?.name ?? r.productId,
        size: p?.size ?? '',
        sku: p?.sku ?? '',
        photo: (p?.photo ?? 'serum') as 'balm' | 'oil' | 'serum' | 'fluid' | 'gel' | 'duo',
        qty: r.qty,
        reason: r.reason,
        status: r.status,
        tone: statusTone(r.status),
        label: statusLabel(r.status),
        refund: r.refund,
        createdAt: r.createdAt,
        customer: this.store.customer(o?.customerId ?? '')?.name ?? '',
      };
    }),
  );

  protected readonly pending = computed(
    () => this.store.returns().filter((r) => r.status === 'requested').length,
  );

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.rows()
      .filter((r) => f === 'all' || r.status === f)
      .sort((a, b) => b.createdAt - a.createdAt);
  });

  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.routeId()));

  protected close(): void {
    this.router.navigate(['/orders/returns']);
  }
}
