import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { PartnersApiService, type Partner, type PartnerList } from '../../core/partners-api.service';
import { UsersApiService, type ApiUser } from '../../core/users-api.service';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { ToastService } from '../../core/toast';
import { moneyNgn } from '../customers/cs-data';

type PartnerDashboard = Awaited<ReturnType<PartnersApiService['getPartnerDashboard']>>;

@Component({
  selector: 'app-partners-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Partners</span>
        <h1 class="head__title">Partners</h1>
        <p class="head__lead">{{ partners().length }} partners.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
        <button type="button" class="btn btn--ghost" (click)="openDistribution()">Record distribution</button>
        <button type="button" class="btn btn--primary" (click)="openAdd()">
          <app-icon name="plus" [size]="15" />
          Add partner
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Partner summary">
      <article class="stat">
        <span class="stat__label">Partners</span>
        <strong class="stat__value">{{ partners().length }}</strong>
        <span class="stat__detail">Partner accounts</span>
      </article>
      <article class="stat">
        <span class="stat__label">Total invested</span>
        <strong class="stat__value">{{ money(totalInvested()) }}</strong>
        <span class="stat__detail">Combined investment</span>
      </article>
      <article class="stat">
        <span class="stat__label">Founder holding</span>
        <strong class="stat__value">600,000</strong>
        <span class="stat__detail">60% of 1,000,000 shares</span>
      </article>
      <article class="stat">
        <span class="stat__label">Partner pool</span>
        <strong class="stat__value">{{ partnerShares().toLocaleString() }}</strong>
        <span class="stat__detail">{{ partnerEquityTotal() }}% of 1,000,000 shares</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search partner name" aria-label="Search partners" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} partners</span>
    </div>

    <div class="partner-grid" aria-label="Partners">
      @for (row of visible(); track row.id) {
        <button type="button" class="partner-card" (click)="open(row.id)" [attr.aria-label]="'Partner ' + row.id">
          <span class="partner-card__top">
            <span class="partner-card__name">{{ row.userName ?? '—' }}</span>
            <span class="partner-card__equity">{{ row.equityPercentage }}% equity</span>
          </span>
          <span class="partner-card__email">{{ row.userEmail ?? '—' }}</span>
          <span class="partner-card__meta">
            <span>{{ money(row.investedAmount) }}</span>
            <span>{{ row.createdAt }}</span>
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="partner-empty">
          <strong>No partners match.</strong>
          <span>Try another search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Partner detail">
      <ng-container drawerTitle>
        @if (selected(); as p) {
          <div class="dtitle">
            <strong>{{ p.userName }}</strong>
          </div>
        }
      </ng-container>
      @if (selected(); as p) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>User</dt><dd>{{ p.userName ?? '—' }}</dd></div>
            <div><dt>Email</dt><dd>{{ p.userEmail ?? '—' }}</dd></div>
            <div><dt>Equity %</dt><dd>{{ p.equityPercentage }}%</dd></div>
            <div><dt>Invested</dt><dd>{{ money(p.investedAmount) }}</dd></div>
            <div><dt>Created</dt><dd>{{ p.createdAt }}</dd></div>
          </dl>

          @if (dashboardLoading()) {
            <div class="load-center" role="status"><app-spinner size="sm" label="Loading partner dashboard" /></div>
          } @else if (dashboardError()) {
            <p class="dnote dnote--bad">{{ dashboardError() }}</p>
          } @else {
            @if (dashboard(); as d) {
              <div class="dsummary">
                <div>
                  <span class="stat__label">Total invested</span>
                  <strong class="dtotal">{{ money(d.totalInvested) }}</strong>
                </div>
                <div class="dright">
                  <span class="stat__label">Total distributed</span>
                  <strong class="dtotal">{{ money(d.totalDistributed) }}</strong>
                </div>
              </div>

              <h3 class="dlabel">Profit distributions ({{ d.partner.userName ?? d.partner.id }})</h3>
              <div class="table-wrap">
                <table aria-label="Profit distributions">
                  <thead>
                    <tr><th scope="col">Period</th><th scope="col">Total profit</th><th scope="col">Partner share</th><th scope="col">Created</th></tr>
                  </thead>
                  <tbody>
                    @for (row of d.distributions; track row.id) {
                      <tr>
                        <td>{{ row.period }}</td>
                        <td>{{ money(row.totalProfit) }}</td>
                        <td>{{ money(row.perPartnerBreakdown[d.partner.id] ?? 0) }}</td>
                        <td>{{ row.createdAt }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="dnote">No profit distributions recorded.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="dnote">Dashboard unavailable.</p>
            }
          }
        </div>
      }
    </app-drawer>

    <app-drawer [open]="adding()" (close)="closeAdd()" label="Add partner">
      <ng-container drawerTitle><div class="dtitle"><strong>Add partner</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="addPartner()">
        <p class="cnote">Partners are staff users with the Partner / investor role. Create the staff account from Team first if the person is missing.</p>
        <label class="field"><span class="field__label">User</span>
          <select [(ngModel)]="partnerForm.userId" name="partnerUser" required>
            <option value="">Select a partner user…</option>
            @for (u of candidateUsers(); track u.id) {
              <option [value]="u.id">{{ u.name }} — {{ u.email }}</option>
            }
          </select>
        </label>
        @if (candidateUsers().length === 0) {
          <p class="cnote">No eligible users yet. Add a staff member with the partner_investor role from Team.</p>
        }
        <div class="cgrid">
          <label class="field"><span class="field__label">Equity %</span>
            <input type="number" min="0.01" max="40" step="0.01" [(ngModel)]="partnerForm.equityPercentage" name="partnerEquity" placeholder="0.01 – 40" required />
          </label>
          <label class="field"><span class="field__label">Invested amount</span>
            <input type="number" min="0.01" step="0.01" [(ngModel)]="partnerForm.investedAmount" name="partnerInvested" required />
          </label>
        </div>
        @if (addError()) {
          <p class="field-err">{{ addError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="addingBusy() || !partnerForm.userId">
          {{ addingBusy() ? 'Adding…' : 'Add partner' }}
        </button>
      </form>
    </app-drawer>

    <app-drawer [open]="distributing()" (close)="closeDistribution()" label="Record distribution">
      <ng-container drawerTitle><div class="dtitle"><strong>Record profit distribution</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="recordDistribution()">
        <p class="cnote">Distributions are approval-gated and split across partners by equity share.</p>
        <label class="field"><span class="field__label">Period</span>
          <input type="text" [(ngModel)]="distributionForm.period" name="distPeriod" placeholder="e.g. 2026-Q3" required />
        </label>
        <label class="field"><span class="field__label">Total profit</span>
          <input type="number" min="0.01" step="0.01" [(ngModel)]="distributionForm.totalProfit" name="distProfit" required />
        </label>
        @if (distributionError()) {
          <p class="field-err">{{ distributionError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="distributionBusy() || !distributionForm.period.trim() || distributionForm.totalProfit <= 0">
          {{ distributionBusy() ? 'Recording…' : 'Record distribution' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .partner-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .partner-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .partner-card:hover { border-color: var(--primary); }
    .partner-card__top, .partner-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .partner-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .partner-card__equity { font-size: var(--fs-sm); font-weight: 700; color: var(--sage); }
    .partner-card__name { font-size: var(--fs-md); font-weight: 700; }
    .partner-card__email { color: var(--muted); font-size: var(--fs-sm); }
    .partner-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .partner-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .partner-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dright { display: grid; justify-items: end; }
    .dnote { margin: 0; color: var(--muted); font-size: var(--fs-sm); }
    .dnote--bad { color: var(--bad); }
    .create-form { display: grid; gap: 12px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .cnote { padding: 12px 14px; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); font-size: var(--fs-sm); margin: 0; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 1100px) { .partner-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .partner-grid { grid-template-columns: 1fr; } .cgrid { grid-template-columns: 1fr; } }
  `,
})
export class PartnersList {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly partnersApi = inject(PartnersApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly toast = inject(ToastService);

  protected readonly partners = signal<Partner[]>([]);
  protected readonly query = signal('');
  protected readonly dashboard = signal<PartnerDashboard | null>(null);
  protected readonly dashboardLoading = signal(false);
  protected readonly dashboardError = signal('');

  protected readonly users = signal<ApiUser[]>([]);

  protected readonly adding = signal(false);
  protected readonly addingBusy = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected readonly partnerForm = { userId: '', equityPercentage: 5, investedAmount: 0 };

  protected readonly distributing = signal(false);
  protected readonly distributionBusy = signal(false);
  protected readonly distributionError = signal<string | null>(null);
  protected readonly distributionForm = { period: '', totalProfit: 0 };

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
    void this.loadUsers();
    effect(() => {
      const id = this.routeId();
      if (id) void this.loadDashboard(id);
      else {
        this.dashboard.set(null);
        this.dashboardError.set('');
      }
    });
  }

  async load(): Promise<void> {
    const result = await this.partnersApi.listPartners({ page: 1, limit: 100 });
    this.partners.set(result.data);
  }

  private async loadDashboard(id: string): Promise<void> {
    this.dashboardLoading.set(true);
    this.dashboardError.set('');
    try {
      const result = await this.partnersApi.getPartnerDashboard(id);
      if (this.routeId() !== id) return;
      this.dashboard.set(result);
    } catch (err) {
      this.dashboardError.set(err instanceof Error ? err.message : 'Could not load the partner dashboard.');
    } finally {
      this.dashboardLoading.set(false);
    }
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.partners()
      .filter((p) => {
        if (!q) return true;
        return `${p.userName ?? ''} ${p.userEmail ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly totalInvested = computed(() =>
    this.partners().reduce((a, p) => a + p.investedAmount, 0),
  );

  protected readonly partnerEquityTotal = computed(() =>
    Math.round(this.partners().reduce((a, p) => a + p.equityPercentage, 0) * 100) / 100,
  );

  protected readonly partnerShares = computed(() =>
    Math.round((this.partnerEquityTotal() / 100) * 1_000_000),
  );

  protected readonly money = moneyNgn;

  protected readonly selected = computed(() => this.partners().find((p) => p.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/partners', id]);
  }

  protected close(): void {
    this.router.navigate(['/partners']);
  }

  private async loadUsers(): Promise<void> {
    try {
      const result = await this.usersApi.list(1, 100);
      this.users.set(result.data);
    } catch {
      this.users.set([]);
    }
  }

  protected readonly candidateUsers = computed(() => {
    const taken = new Set(this.partners().map((p) => p.userId));
    return this.users().filter((u) => u.role?.name === 'partner_investor' && !taken.has(u.id));
  });

  protected openAdd(): void {
    this.partnerForm.userId = '';
    this.partnerForm.equityPercentage = 5;
    this.partnerForm.investedAmount = 0;
    this.addError.set(null);
    this.adding.set(true);
    void this.loadUsers();
  }

  protected closeAdd(): void {
    this.adding.set(false);
  }

  protected async addPartner(): Promise<void> {
    const equity = Number(this.partnerForm.equityPercentage);
    const invested = Number(this.partnerForm.investedAmount);
    if (!this.partnerForm.userId) {
      this.addError.set('Choose a user to link to this partner.');
      return;
    }
    if (!Number.isFinite(equity) || equity < 0.01 || equity > 40) {
      this.addError.set('Equity must be between 0.01% and 40%.');
      return;
    }
    if (!Number.isFinite(invested) || invested < 0.01) {
      this.addError.set('Invested amount must be at least 0.01.');
      return;
    }
    this.addingBusy.set(true);
    this.addError.set(null);
    try {
      await this.partnersApi.createPartner({
        userId: this.partnerForm.userId,
        equityPercentage: equity,
        investedAmount: invested,
      });
      this.toast.show('Partner added', 'good');
      this.adding.set(false);
      await this.load();
    } catch (err) {
      this.addError.set(err instanceof Error ? err.message : 'Could not add the partner.');
    } finally {
      this.addingBusy.set(false);
    }
  }

  protected openDistribution(): void {
    this.distributionForm.period = '';
    this.distributionForm.totalProfit = 0;
    this.distributionError.set(null);
    this.distributing.set(true);
  }

  protected closeDistribution(): void {
    this.distributing.set(false);
  }

  protected async recordDistribution(): Promise<void> {
    const period = this.distributionForm.period.trim();
    const totalProfit = Number(this.distributionForm.totalProfit);
    if (!period || !Number.isFinite(totalProfit) || totalProfit < 0.01) {
      this.distributionError.set('Enter a period and a total profit of at least 0.01.');
      return;
    }
    this.distributionBusy.set(true);
    this.distributionError.set(null);
    try {
      const approval = await this.approvalsApi.create({
        actionType: 'fund_movement',
        payload: { period, totalProfit },
      });
      if (approval.status !== 'approved') {
        this.distributionError.set('Distribution submitted — a manager must approve it in Approvals before it is recorded.');
        return;
      }
      await this.partnersApi.createDistribution({
        period,
        totalProfit,
        approvalRequestId: approval.id,
      });
      this.toast.show('Profit distribution recorded', 'good');
      this.distributing.set(false);
      await this.load();
      const id = this.routeId();
      if (id) void this.loadDashboard(id);
    } catch (err) {
      this.distributionError.set(err instanceof Error ? err.message : 'Could not record the distribution.');
    } finally {
      this.distributionBusy.set(false);
    }
  }
}