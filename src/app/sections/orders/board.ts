import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { money as fmtMoney, until } from '../../core/format';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import type { OrderStatus } from '../../core/models';
import { nextOrderStatus } from '../../core/order-flow';

const COLUMNS: { id: OrderStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'picking', label: 'Picking' },
  { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' },
];

@Component({
  selector: 'app-orders-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Orders</span>
        <h1 class="head__title">Board</h1>
        <p class="head__lead">Move orders through picking, packing and dispatch.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/orders/all">List view</a>
      </div>
    </div>

    <div class="board">
      @for (col of columns; track col.id) {
        <section class="col">
          <header class="col__head">
            <span class="col__title">{{ col.label }}</span>
            <span class="col__count">{{ byStatus(col.id).length }}</span>
          </header>
          <div class="col__body">
            @for (row of byStatus(col.id); track row.id) {
              <article class="ocard">
                <a class="ocard__top" [routerLink]="'/orders/all/' + row.id">
                  <span class="mono ocard__num">{{ row.number }}</span>
                  <span class="badge badge--info">{{ row.channel }}</span>
                </a>
                <p class="ocard__customer">{{ row.customer }}</p>
                <div class="ocard__meta">
                  <span>{{ row.units }} items</span>
                  <span class="num">{{ money(row.total) }}</span>
                </div>
                <div class="ocard__foot">
                  <span class="ocard__due" [class.is-late]="row.late">{{ row.due }}</span>
                  @if (row.next) {
                    <button type="button" class="btn btn--xs" [attr.aria-label]="'Move ' + row.number + ' to ' + row.nextLabel" (click)="advance(row.id, row.next!)">
                      <app-icon name="chevron" [size]="12" />
                      {{ row.nextLabel }}
                    </button>
                  }
                </div>
              </article>
            }
            @if (byStatus(col.id).length === 0) {
              <div class="col__empty">Nothing here</div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 12px;
      align-items: start;
    }
    .col {
      background: var(--surface-2);
      border: 1px solid var(--line);
      border-radius: var(--r-card);
      padding: 12px;
      min-height: 180px;
    }
    .col__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 0 4px;
    }
    .col__title {
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .col__count {
      min-width: 20px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--raised);
      font-size: var(--fs-2xs);
      font-weight: 700;
      text-align: center;
    }
    .col__body {
      display: grid;
      gap: 8px;
    }
    .col__empty {
      padding: 26px 0;
      text-align: center;
      font-size: var(--fs-xs);
      color: var(--faint);
    }
    .ocard {
      display: grid;
      gap: 7px;
      padding: 12px;
      border-radius: var(--r-tile);
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: 0 1px 2px #14241c0a;
    }
    .ocard__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .ocard__num {
      font-size: var(--fs-sm);
      font-weight: 700;
    }
    .ocard__customer {
      font-size: var(--fs-md);
      font-weight: 600;
    }
    .ocard__meta {
      display: flex;
      justify-content: space-between;
      font-size: var(--fs-xs);
      color: var(--muted);
    }
    .ocard__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
      border-top: 1px solid var(--line);
    }
    .ocard__due {
      font-size: var(--fs-2xs);
      font-weight: 700;
      color: var(--muted);
    }
    .ocard__due.is-late {
      color: var(--bad);
    }
  `,
})
export class OrdersBoard {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly columns = COLUMNS;
  protected readonly now = Date.now();
  protected readonly money = fmtMoney;

  protected readonly cards = computed(() =>
    this.store.orders().map((o) => {
      const next = nextOrderStatus(o.status);
      return {
        id: o.id,
        number: o.number,
        customer: this.store.customer(o.customerId)?.name ?? o.customerId,
        channel: o.channel,
        status: o.status,
        units: o.lines.reduce((a, l) => a + l.qty, 0),
        total: o.lines.reduce((a, l) => a + l.qty * l.price, 0),
        due: until(o.shipBy, this.now),
        late: o.shipBy < this.now && o.status !== 'delivered' && o.status !== 'cancelled',
        next,
        nextLabel: next ? next[0].toUpperCase() + next.slice(1) : '',
      };
    }),
  );

  protected byStatus(status: OrderStatus) {
    return this.cards()
      .filter((c) => c.status === status)
      .sort((a, b) => a.due.localeCompare(b.due));
  }

  protected advance(id: string, status: OrderStatus): void {
    if (this.store.advanceOrder(id, status)) {
      this.toasts.show(`Moved to ${status}`, 'good');
    }
  }
}
