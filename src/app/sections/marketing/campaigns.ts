import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { Spinner } from '../../ui/spinner';
import { ToastService } from '../../core/toast';
import { MarketingApiService, type Campaign, type CampaignList, type CampaignType, type CampaignRoi } from '../../core/marketing-api.service';
import { money as fmtMoney } from '../../core/format';

@Component({
  selector: 'app-marketing-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Drawer, FormsModule, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Marketing</span>
        <h1 class="head__title">Campaigns</h1>
        <p class="head__lead">{{ campaigns().length }} active campaigns.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
        <button type="button" class="btn btn--primary" (click)="openCreate()">
          <app-icon name="plus" [size]="15" />
          New campaign
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Campaign summary">
      <article class="stat">
        <span class="stat__label">Campaigns</span>
        <strong class="stat__value">{{ campaigns().length }}</strong>
        <span class="stat__detail">Active campaigns</span>
      </article>
    </div>

    @if (roi(); as performance) {
      <section class="card roi-panel" aria-label="Campaign performance">
        <h2 class="roi-title">Return on spend</h2>
        <div class="roi-stats">
          <div><span class="stat__label">Attributed revenue</span><strong>{{ money(performance.attributedRevenue) }}</strong></div>
          <div><span class="stat__label">Unattributed revenue</span><strong>{{ money(performance.unattributedRevenue) }}</strong></div>
          <div><span class="stat__label">Campaign spend</span><strong>{{ money(performance.spend) }}</strong></div>
          <div><span class="stat__label">Overall ROI</span><strong>{{ performance.roi === null ? '—' : performance.roi.toFixed(1) + '%' }}</strong></div>
        </div>
        @if (performance.campaigns.length > 0) {
          <div class="table-wrap">
            <table>
              <thead><tr><th scope="col">Campaign</th><th scope="col" class="num">Orders</th><th scope="col" class="num">Revenue</th><th scope="col" class="num">ROI</th></tr></thead>
              <tbody>
                @for (row of performance.campaigns; track row.id) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td class="num">{{ row.orders }}</td>
                    <td class="num">{{ money(row.revenue) }}</td>
                    <td class="num">{{ row.roi === null ? '—' : row.roi.toFixed(1) + '%' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="roi-note">No campaign spend recorded yet — enter spend to see ROI.</p>
        }
      </section>
    } @else if (roiError()) {
      <p class="roi-note roi-note--error" role="alert">{{ roiError() }}</p>
    }

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search campaign name" aria-label="Search campaigns" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} campaigns</span>
    </div>

    @if (loading() && campaigns().length === 0) {
      <div class="load-center" role="status"><app-spinner size="md" label="Loading campaigns" /></div>
    }

    <div class="campaign-grid" aria-label="Marketing campaigns">
      @for (row of visible(); track row.id) {
        <button type="button" class="campaign-card" (click)="open(row.id)" [attr.aria-label]="'Campaign ' + row.name">
          <span class="campaign-card__top">
            <span class="campaign-card__name">{{ row.name }}</span>
            <span class="badge" [class]="'badge badge--' + row.type">{{ row.type }}</span>
          </span>
          <span class="campaign-card__channel">{{ row.channel ?? '—' }}</span>
          <span class="campaign-card__meta">
            <span>{{ row.startDate }}</span>
            <span>{{ row.endDate }}</span>
          </span>
          <span class="campaign-card__discount">{{ row.discountPercent ?? 0 }}% off</span>
        </button>
      }
      @if (!loading() && visible().length === 0) {
        <div class="campaign-empty">
          <strong>No campaigns match.</strong>
          <span>Try another search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Campaign detail">
      <ng-container drawerTitle>
        @if (selected(); as c) {
          <div class="dtitle">
            <strong>{{ c.name }}</strong>
            <span class="badge" [class]="'badge badge--' + c.type">{{ c.type }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as c) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Name</dt><dd>{{ c.name }}</dd></div>
            <div><dt>Type</dt><dd>{{ c.type }}</dd></div>
            <div><dt>Channel</dt><dd>{{ c.channel ?? '—' }}</dd></div>
            <div><dt>Discount</dt><dd>{{ c.discountPercent ?? 0 }}% off</dd></div>
            <div><dt>Start date</dt><dd>{{ c.startDate }}</dd></div>
            <div><dt>End date</dt><dd>{{ c.endDate }}</dd></div>
            <div><dt>Created</dt><dd>{{ c.createdAt }}</dd></div>
          </dl>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New campaign">
      <ng-container drawerTitle><div class="dtitle"><strong>New campaign</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createCampaign()">
        <label class="field"><span class="field__label">Name</span>
          <input type="text" [(ngModel)]="createForm.name" name="campaignName" placeholder="e.g. December gifting push" required />
        </label>
        <div class="cgrid">
          <label class="field"><span class="field__label">Type</span>
            <select [(ngModel)]="createForm.type" name="campaignType">
              @for (t of campaignTypes; track t) {
                <option [value]="t">{{ typeLabel(t) }}</option>
              }
            </select>
          </label>
          <label class="field"><span class="field__label">Channel</span>
            <input type="text" [(ngModel)]="createForm.channel" name="campaignChannel" placeholder="e.g. Instagram" />
          </label>
        </div>
        <div class="cgrid">
          <label class="field"><span class="field__label">Discount %</span>
            <input type="number" min="0" max="100" step="0.01" [(ngModel)]="createForm.discountPercent" name="campaignDiscount" placeholder="optional" />
          </label>
          <label class="field"><span class="field__label">Start date</span>
            <input type="date" [(ngModel)]="createForm.startDate" name="campaignStart" required />
          </label>
        </div>
        <label class="field"><span class="field__label">End date</span>
          <input type="date" [(ngModel)]="createForm.endDate" name="campaignEnd" required />
        </label>
        @if (createError()) {
          <p class="field-err">{{ createError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="creatingBusy() || !createForm.name.trim() || !createForm.startDate || !createForm.endDate">
          {{ creatingBusy() ? 'Creating…' : 'Create campaign' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .roi-panel { margin-bottom: var(--gap); padding: 16px; }
    .roi-title { margin: 0 0 12px; font-size: var(--fs-lg); }
    .roi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .roi-stats div { display: grid; gap: 4px; }
    .roi-stats strong { font-size: var(--fs-lg); font-variant-numeric: tabular-nums; }
    .roi-panel table { width: 100%; border-collapse: collapse; }
    .roi-panel th, .roi-panel td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    .roi-panel th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; }
    .roi-panel .num { text-align: right; font-variant-numeric: tabular-nums; }
    .roi-note { margin: 0; color: var(--muted); font-size: var(--fs-xs); }
    .roi-note--error { color: var(--bad); }
    .campaign-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .campaign-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .campaign-card:hover { border-color: var(--primary); }
    .campaign-card__top, .campaign-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .campaign-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .campaign-card__name { font-size: var(--fs-md); font-weight: 700; }
    .campaign-card__channel { color: var(--muted); font-size: var(--fs-sm); }
    .campaign-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .campaign-card__discount { font-size: var(--fs-sm); font-weight: 700; color: var(--sage); }
    .campaign-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .campaign-empty strong { color: var(--text); }
    .create-form { display: grid; gap: 12px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input, .field select { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible, .field select:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 1100px) { .campaign-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .campaign-grid { grid-template-columns: 1fr; } .cgrid { grid-template-columns: 1fr; } }
  `,
})
export class MarketingCampaigns {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly marketingApi = inject(MarketingApiService);
  private readonly toast = inject(ToastService);

  protected readonly money = fmtMoney;
  protected readonly campaigns = signal<Campaign[]>([]);
  protected readonly loading = signal(false);
  protected readonly query = signal('');
  protected readonly roi = signal<CampaignRoi | null>(null);
  protected readonly roiError = signal<string | null>(null);

  protected readonly creating = signal(false);
  protected readonly creatingBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly campaignTypes: CampaignType[] = ['campaign', 'promotion', 'loyalty', 'visibility_boost'];
  protected readonly createForm = {
    name: '',
    type: 'campaign' as CampaignType,
    channel: '',
    discountPercent: null as number | null,
    startDate: '',
    endDate: '',
  };

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p: ParamMap) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.marketingApi.list({ page: 1, limit: 100 });
      this.campaigns.set(result.data);
      void this.loadRoi();
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadRoi(): Promise<void> {
    this.roiError.set(null);
    try {
      this.roi.set(await this.marketingApi.roi());
    } catch {
      this.roi.set(null);
      this.roiError.set('Campaign ROI could not be loaded.');
    }
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.campaigns()
      .filter((c) => {
        if (!q) return true;
        return c.name.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly selected = computed(() => this.campaigns().find((c) => c.id === this.routeId()));

  protected open(id: string): void {
    this.router.navigate(['/marketing/campaigns', id]);
  }

  protected close(): void {
    this.router.navigate(['/marketing/campaigns']);
  }

  protected typeLabel(type: CampaignType): string {
    switch (type) {
      case 'campaign':
        return 'Campaign';
      case 'promotion':
        return 'Promotion';
      case 'loyalty':
        return 'Loyalty';
      case 'visibility_boost':
        return 'Visibility boost';
    }
  }

  protected openCreate(): void {
    this.createForm.name = '';
    this.createForm.type = 'campaign';
    this.createForm.channel = '';
    this.createForm.discountPercent = null;
    this.createForm.startDate = new Date().toISOString().slice(0, 10);
    this.createForm.endDate = '';
    this.createError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async createCampaign(): Promise<void> {
    if (!this.createForm.name.trim() || !this.createForm.startDate || !this.createForm.endDate) {
      this.createError.set('A name, start date and end date are required.');
      return;
    }
    if (this.createForm.endDate < this.createForm.startDate) {
      this.createError.set('The end date must be on or after the start date.');
      return;
    }
    this.creatingBusy.set(true);
    this.createError.set(null);
    try {
      await this.marketingApi.create({
        name: this.createForm.name.trim(),
        type: this.createForm.type,
        channel: this.createForm.channel.trim() || null,
        discountPercent:
          this.createForm.discountPercent === null || this.createForm.discountPercent === undefined
            ? null
            : Number(this.createForm.discountPercent),
        startDate: this.createForm.startDate,
        endDate: this.createForm.endDate,
      });
      this.toast.show('Campaign created', 'good');
      this.creating.set(false);
      await this.load();
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Could not create the campaign.');
    } finally {
      this.creatingBusy.set(false);
    }
  }
}