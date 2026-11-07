import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { PartnersApiService, type Partner, type PartnerList } from '../../core/partners-api.service';
import { moneyNgn } from '../customers/cs-data';

type PartnerDashboard = Awaited<ReturnType<PartnersApiService['getPartnerDashboard']>>;

@Component({
  selector: 'app-partners-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Partners</span>
        <h1 class="head__title">Partners</h1>
        <p class="head__lead">{{ partners().length }} partners.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
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
            <span class="mono partner-card__id">{{ row.id }}</span>
            <span class="partner-card__equity">{{ row.equityPercentage }}% equity</span>
          </span>
          <span class="partner-card__name">{{ row.userName ?? '—' }}</span>
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
            <strong class="mono">{{ p.id }}</strong>
            <span>{{ p.userName }}</span>
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
            <p class="dnote">Loading dashboard…</p>
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
    @media (max-width: 1100px) { .partner-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .partner-grid { grid-template-columns: 1fr; } }
  `,
})
export class PartnersList {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly partnersApi = inject(PartnersApiService);

  protected readonly partners = signal<Partner[]>([]);
  protected readonly query = signal('');
  protected readonly dashboard = signal<PartnerDashboard | null>(null);
  protected readonly dashboardLoading = signal(false);
  protected readonly dashboardError = signal('');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
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

  protected readonly money = moneyNgn;

  protected readonly selected = computed(() => this.partners().find((p) => p.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/partners', id]);
  }

  protected close(): void {
    this.router.navigate(['/partners']);
  }
}