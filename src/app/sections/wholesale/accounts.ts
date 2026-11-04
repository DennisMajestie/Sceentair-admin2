import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { date as fmtDate, money as fmtMoney } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import {
  WholesaleApiService,
  type WholesaleAccount,
  type WholesaleAccountStatus,
  type WholesaleAccountList,
} from '../../core/wholesale-api.service';

const STATUS_LABELS: Record<WholesaleAccountStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<WholesaleAccountStatus, string> = {
  pending: 'warn',
  approved: 'sage',
  rejected: 'bad',
};

@Component({
  selector: 'app-wholesale-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Wholesale</span>
        <h1 class="head__title">Wholesale accounts</h1>
        <p class="head__lead">{{ accounts().length }} accounts · {{ pendingCount() }} awaiting review.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Wholesale summary">
      <article class="stat">
        <span class="stat__label">Total accounts</span>
        <strong class="stat__value">{{ accounts().length }}</strong>
        <span class="stat__detail">All wholesale accounts</span>
      </article>
      <article class="stat">
        <span class="stat__label">Pending</span>
        <strong class="stat__value">{{ pendingCount() }}</strong>
        <span class="stat__detail">Awaiting review</span>
      </article>
      <article class="stat">
        <span class="stat__label">Approved</span>
        <strong class="stat__value">{{ approvedCount() }}</strong>
        <span class="stat__detail">Active stockists</span>
      </article>
      <article class="stat">
        <span class="stat__label">Rejected</span>
        <strong class="stat__value">{{ rejectedCount() }}</strong>
        <span class="stat__detail">Declined applications</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        @for (f of statuses; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="status() === f.id" [attr.aria-pressed]="status() === f.id" (click)="status.set(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search business name" aria-label="Search wholesale accounts" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} accounts</span>
    </div>

    <div class="account-grid" aria-label="Wholesale accounts">
      @for (row of visible(); track row.id) {
        <button type="button" class="account-card" (click)="open(row.id)" [attr.aria-label]="'Account ' + row.id">
          <span class="account-card__top">
            <span class="mono account-card__id">{{ row.id }}</span>
            <span class="badge" [class]="'badge badge--' + tone(row.status)">{{ row.status }}</span>
          </span>
          <span class="account-card__name">{{ row.businessName ?? 'Unnamed account' }}</span>
          <span class="account-card__meta">
            <span>{{ row.buyerType ?? '—' }}</span>
            <span>{{ row.createdAt }}</span>
          </span>
          <span class="account-card__tier">{{ row.tierName ?? 'No tier' }}</span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="account-empty">
          <strong>No wholesale accounts match.</strong>
          <span>Try another status or search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Wholesale account detail">
      <ng-container drawerTitle>
        @if (selected(); as a) {
          <div class="dtitle">
            <strong class="mono">{{ a.id }}</strong>
            <span class="badge" [class]="'badge badge--' + tone(a.status)">{{ a.status }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as a) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Business name</span>
              <span class="dmeta">{{ a.businessName ?? '—' }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Status</span>
              <strong class="dtotal">{{ a.status }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Buyer type</dt><dd>{{ a.buyerType ?? '—' }}</dd></div>
            <div><dt>Business phone</dt><dd>{{ a.businessPhone ?? '—' }}</dd></div>
            <div><dt>City / state</dt><dd>{{ a.city ?? '—' }}, {{ a.state ?? '—' }}</dd></div>
            <div><dt>Opening volume</dt><dd>{{ a.openingVolume ?? '—' }}</dd></div>
            <div><dt>Tier</dt><dd>{{ a.tierName ?? 'No tier assigned' }}</dd></div>
            <div><dt>Created</dt><dd>{{ fmtDateString(a.createdAt) }}</dd></div>
            <div><dt>Reviewed by</dt><dd>{{ a.reviewedBy ?? '—' }}</dd></div>
          </dl>

          @if (a.status === 'pending') {
            <h3 class="dlabel">Review application</h3>
            <div class="ddecide">
              <label class="resolve-label">
                <span>Decision</span>
                <select class="resolve-select" [(ngModel)]="reviewDecision">
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </label>
                <button type="button" class="btn" [disabled]="!reviewDecision()" (click)="reviewAccount(a.id)">Submit decision</button>
            </div>
          }
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .account-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .account-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .account-card:hover { border-color: var(--primary); }
    .account-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .account-card__top, .account-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .account-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .account-card__name { font-size: var(--fs-md); font-weight: 700; }
    .account-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .account-card__tier { color: var(--faint); font-size: var(--fs-xs); }
    .account-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .account-empty strong { color: var(--text); }
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
    .ddecide { display: grid; gap: 10px; margin-top: 12px; }
    .resolve-label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-xs); color: var(--faint); font-weight: 600; }
    .resolve-select { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); color: var(--text); font-size: var(--fs-sm); }
    @media (max-width: 1100px) { .account-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .account-grid { grid-template-columns: 1fr; } }
  `,
})
export class WholesaleAccounts {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly wholesaleApi = inject(WholesaleApiService);

  protected readonly fmtDate = fmtDate;
  protected readonly fmtMoney = fmtMoney;

  protected fmtDateString(value: string): string {
    return fmtDate(Date.parse(value));
  }

  protected readonly query = signal('');
  protected readonly status = signal<WholesaleAccountStatus | 'all'>('all');
  protected readonly accounts = signal<WholesaleAccount[]>([]);
  protected readonly reviewDecision = signal<string>('');

  protected readonly statuses: { id: WholesaleAccountStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const result = await this.wholesaleApi.listAccounts({ page: 1, limit: 100 });
    this.accounts.set(result.data);
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.accounts()
      .filter((a) => {
        if (this.status() !== 'all' && a.status !== this.status()) return false;
        if (!q) return true;
        const haystack = `${a.businessName ?? ''} ${a.id}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });

  protected readonly pendingCount = computed(() =>
    this.accounts().filter((a) => a.status === 'pending').length,
  );
  protected readonly approvedCount = computed(() =>
    this.accounts().filter((a) => a.status === 'approved').length,
  );
  protected readonly rejectedCount = computed(() =>
    this.accounts().filter((a) => a.status === 'rejected').length,
  );

  protected readonly tone = (status: WholesaleAccountStatus): string => STATUS_TONE[status] ?? 'muted';

  protected readonly selected = computed(() => this.accounts().find((a) => a.id === this.routeId()));

  protected async reviewAccount(id: string): Promise<void> {
    try {
      await this.wholesaleApi.reviewAccount(id, { status: this.reviewDecision() as WholesaleAccountStatus, reviewedBy: '' });
      await this.load();
      this.close();
    } catch (err) {
      // Surface error silently - reload to reflect server state
      await this.load();
    }
  }

  protected open(id: string): void {
    this.router.navigate(['/wholesale/accounts', id]);
  }

  protected close(): void {
    this.router.navigate(['/wholesale/accounts']);
  }
}