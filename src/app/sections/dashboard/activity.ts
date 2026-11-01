import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { dateFull as fmtDateFull, relative } from '../../core/format';
import { Icon } from '../../ui/icon';

const KINDS = [
  { id: 'all', label: 'Everything' },
  { id: 'order', label: 'Orders' },
  { id: 'stock', label: 'Stock' },
  { id: 'po', label: 'Purchasing' },
  { id: 'return', label: 'Returns' },
  { id: 'web', label: 'Online store' },
];

@Component({
  selector: 'app-dashboard-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Dashboard</span>
        <h1 class="head__title">Activity</h1>
        <p class="head__lead">Every movement, order and adjustment across {{ store.settings().company.name }}.</p>
      </div>
      <div class="head__actions">
        <span class="badge">{{ feed().length }} events</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="tablist" aria-label="Filter activity">
        @for (kind of kinds; track kind.id) {
          <button
            type="button"
            class="seg__btn"
            role="tab"
            [class.is-on]="filter() === kind.id"
            [attr.aria-selected]="filter() === kind.id"
            (click)="filter.set(kind.id)"
          >
            {{ kind.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search activity" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
    </div>

    <div class="card">
      @if (visible().length === 0) {
        <div class="empty">Nothing matches that filter.</div>
      }
      <ol class="log">
        @for (row of visible(); track row.id) {
          <li class="log__row">
            <span class="log__mark" [attr.data-kind]="row.kind">
              <app-icon [name]="icon(row.kind)" [size]="15" />
            </span>
            <div class="log__body">
              <div class="log__top">
                <strong>{{ row.title }}</strong>
                <span class="badge">{{ row.whoName }}</span>
              </div>
              <p class="log__text">{{ row.text }}</p>
              <span class="log__meta">{{ dateFull(row.at) }}</span>
            </div>
            <div class="log__end">
              <a class="btn btn--xs btn--ghost" [routerLink]="row.href">Open</a>
              <span class="log__ago">{{ ago(row.at) }}</span>
            </div>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .log {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .log__row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 13px;
      padding: 14px 4px;
      border-bottom: 1px solid var(--line);
      align-items: start;
    }
    .log__row:last-child {
      border-bottom: none;
    }
    .log__mark {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: var(--well);
      color: var(--muted);
    }
    .log__mark[data-kind='order'] { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
    .log__mark[data-kind='stock'] { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
    .log__mark[data-kind='po'] { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--teal); }
    .log__mark[data-kind='return'] { background: color-mix(in srgb, var(--rose) 15%, transparent); color: var(--rose); }
    .log__body {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .log__top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .log__top strong {
      font-size: var(--fs-lg);
    }
    .log__text {
      color: var(--muted);
      font-size: var(--fs-md);
    }
    .log__meta {
      font-size: var(--fs-2xs);
      color: var(--faint);
    }
    .log__end {
      display: grid;
      justify-items: end;
      gap: 6px;
    }
    .log__ago {
      font-size: var(--fs-2xs);
      color: var(--faint);
    }
  `,
})
export class DashboardActivity {
  protected readonly store = inject(Store);
  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly kinds = KINDS;
  protected readonly now = Date.now();
  protected readonly dateFull = fmtDateFull;

  protected readonly feed = computed(() => this.store.activityFeed());

  protected readonly visible = computed(() => {
    const kind = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.feed().filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false;
      if (!q) return true;
      return `${row.title} ${row.text} ${row.whoName}`.toLowerCase().includes(q);
    });
  });

  protected ago(ts: number): string {
    return relative(ts, this.now);
  }

  protected icon(kind: string): string {
    switch (kind) {
      case 'order':
        return 'orders';
      case 'stock':
        return 'products';
      case 'po':
        return 'truck';
      case 'return':
        return 'layers';
      case 'web':
        return 'customers';
      default:
        return 'bell';
    }
  }
}
