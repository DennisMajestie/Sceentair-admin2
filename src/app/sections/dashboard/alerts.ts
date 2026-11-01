import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Icon } from '../../ui/icon';

type Kind = 'stock' | 'expiry' | 'order' | 'po';

const FILTERS: { id: Kind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stock' },
  { id: 'expiry', label: 'Expiry' },
  { id: 'order', label: 'Orders' },
  { id: 'po', label: 'Purchasing' },
];

@Component({
  selector: 'app-dashboard-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Dashboard</span>
        <h1 class="head__title">Alerts</h1>
        <p class="head__lead">Things worth a look before they become a problem.</p>
      </div>
      <div class="head__actions">
        <span class="badge" [class.badge--bad]="alerts().length > 0">{{ alerts().length }} open</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="tablist" aria-label="Filter alerts">
        @for (f of filters; track f.id) {
          <button
            type="button"
            class="seg__btn"
            role="tab"
            [class.is-on]="filter() === f.id"
            [attr.aria-selected]="filter() === f.id"
            (click)="filter.set(f.id)"
          >
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <button type="button" class="btn btn--sm btn--ghost" (click)="store.markAllNoticesRead()">
        Mark all read
      </button>
    </div>

    @if (visible().length === 0) {
      <div class="card">
        <div class="empty">
          <app-icon name="check" [size]="22" />
          <p>Nothing needs attention right now.</p>
        </div>
      </div>
    } @else {
      <ul class="alerts">
        @for (row of visible(); track row.id) {
          <li class="card alert" [attr.data-tone]="row.tone">
            <span class="alert__mark">
              <app-icon [name]="icon(row.kind)" [size]="17" />
            </span>
            <span class="alert__text">
              <strong>{{ row.title }}</strong>
              <span>{{ row.detail }}</span>
            </span>
            <span class="alert__badge badge" [class]="'badge badge--' + row.tone">{{ row.kind }}</span>
            <a class="btn btn--xs" [routerLink]="row.href">Review</a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .alerts {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }
    .alert {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 13px;
      padding: 14px 16px;
      border-radius: var(--r-tile);
    }
    .alert__mark {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--well);
      color: var(--muted);
    }
    .alert[data-tone='bad'] .alert__mark { background: color-mix(in srgb, var(--bad) 15%, transparent); color: var(--bad); }
    .alert[data-tone='warn'] .alert__mark { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
    .alert[data-tone='info'] .alert__mark { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
    .alert__text {
      display: grid;
      line-height: 1.3;
      min-width: 0;
    }
    .alert__text strong {
      font-size: var(--fs-lg);
    }
    .alert__text span {
      font-size: var(--fs-sm);
      color: var(--muted);
    }
    .empty {
      display: grid;
      gap: 8px;
      justify-items: center;
      color: var(--good);
    }
    .empty p {
      color: var(--muted);
    }
  `,
})
export class DashboardAlerts {
  protected readonly store = inject(Store);
  protected readonly filter = signal<Kind | 'all'>('all');
  protected readonly filters = FILTERS;

  protected readonly alerts = computed(() => this.store.alerts());

  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.alerts() : this.alerts().filter((a) => a.kind === f);
  });

  protected icon(kind: string): string {
    switch (kind) {
      case 'stock':
        return 'products';
      case 'expiry':
        return 'alert';
      case 'order':
        return 'orders';
      default:
        return 'truck';
    }
  }
}
