import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '../../core/store';

interface NotifyItem {
  key: string;
  title: string;
  detail: string;
  group: string;
}

const ITEMS: NotifyItem[] = [
  { key: 'lowStock', title: 'Low stock alerts', detail: 'When a product reaches its reorder point', group: 'Stock' },
  { key: 'outOfStock', title: 'Out of stock', detail: 'When a SKU hits zero on hand', group: 'Stock' },
  { key: 'expiry', title: 'Lot expiry', detail: 'Ahead of the expiry warning window', group: 'Stock' },
  { key: 'cycleCount', title: 'Cycle count variance', detail: 'When a count differs from the expected figure', group: 'Stock' },
  { key: 'newOrder', title: 'New order', detail: 'Each time an order is placed', group: 'Orders' },
  { key: 'orderShipped', title: 'Order shipped', detail: 'When an order leaves the warehouse', group: 'Orders' },
  { key: 'payment', title: 'Payment received', detail: 'When an invoice is settled', group: 'Orders' },
  { key: 'returnRequest', title: 'Return requested', detail: 'When a customer opens a return', group: 'Orders' },
  { key: 'poSent', title: 'Purchase order sent', detail: 'When a PO is issued to a supplier', group: 'Purchasing' },
  { key: 'poReceived', title: 'Purchase order received', detail: 'When a delivery lands at the DC', group: 'Purchasing' },
  { key: 'supplierDelay', title: 'Supplier delay', detail: 'When an ETA slips', group: 'Purchasing' },
  { key: 'ticketReply', title: 'Support reply', detail: 'When the help desk answers a ticket', group: 'Team' },
  { key: 'weeklyDigest', title: 'Weekly digest', detail: 'Monday summary of stock and sales', group: 'Team' },
  { key: 'stocktake', title: 'Stocktake reminder', detail: 'Scheduled cycle count reminder', group: 'Team' },
];

@Component({
  selector: 'app-settings-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">What reaches you, and how</span>
        <h1 class="head__title">Notifications</h1>
        <p class="head__lead">Choose which notifications reach you.</p>
      </div>
    </div>

    <div class="grid grid--2">
      @for (group of groups(); track group.name) {
        <article class="card">
          <div class="card__head">
            <div>
              <h2 class="card__title">{{ group.name }}</h2>
              <p class="card__sub">{{ group.items.length }} preferences</p>
            </div>
          </div>
          <ul class="rows notify">
            @for (item of group.items; track item.key) {
              <li class="row notify__row">
                <span class="notify__text">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.detail }}</span>
                </span>
                <button
                  type="button"
                  class="switch"
                  [class.is-on]="isOn(item.key)"
                  [attr.aria-pressed]="isOn(item.key)"
                  [attr.aria-label]="item.title"
                  (click)="toggle(item.key)"
                ></button>
              </li>
            }
          </ul>
        </article>
      }
    </div>
  `,
  styles: `
    .grid { margin-bottom: var(--gap); }
    .notify { padding: 0; margin: 0; }
    .notify__row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .notify__text { display: grid; gap: 2px; min-width: 0; }
    .notify__text strong { font-size: var(--fs-md); font-weight: 600; }
    .notify__text span { font-size: var(--fs-2xs); color: var(--faint); }
    .switch { flex: none; border: none; padding: 0; }
  `,
})
export class SettingsNotifications {
  protected readonly store = inject(Store);

  protected readonly groups = computed(() => {
    const map = new Map<string, NotifyItem[]>();
    for (const item of ITEMS) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  protected isOn(key: string): boolean {
    return this.store.settings().notify[key] ?? false;
  }

  protected toggle(key: string): void {
    this.store.updateNotify(key, !this.isOn(key));
  }
}
