import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, ParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { MarketingApiService, type Campaign, type CampaignList } from '../../core/marketing-api.service';

@Component({
  selector: 'app-marketing-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Marketing</span>
        <h1 class="head__title">Campaigns</h1>
        <p class="head__lead">{{ campaigns().length }} active campaigns.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Campaign summary">
      <article class="stat">
        <span class="stat__label">Campaigns</span>
        <strong class="stat__value">{{ campaigns().length }}</strong>
        <span class="stat__detail">Active campaigns</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search campaign name" aria-label="Search campaigns" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} campaigns</span>
    </div>

    <div class="campaign-grid" aria-label="Marketing campaigns">
      @for (row of visible(); track row.id) {
        <button type="button" class="campaign-card" (click)="open(row.id)" [attr.aria-label]="'Campaign ' + row.id">
          <span class="campaign-card__top">
            <span class="mono campaign-card__id">{{ row.id }}</span>
            <span class="badge" [class]="'badge badge--' + row.type">{{ row.type }}</span>
          </span>
          <span class="campaign-card__name">{{ row.name }}</span>
          <span class="campaign-card__channel">{{ row.channel ?? '—' }}</span>
          <span class="campaign-card__meta">
            <span>{{ row.startDate }}</span>
            <span>{{ row.endDate }}</span>
          </span>
          <span class="campaign-card__discount">{{ row.discountPercent ?? 0 }}% off</span>
        </button>
      }
      @if (visible().length === 0) {
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
            <strong class="mono">{{ c.id }}</strong>
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
  `,
  styles: `
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
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    @media (max-width: 1100px) { .campaign-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .campaign-grid { grid-template-columns: 1fr; } }
  `,
})
export class MarketingCampaigns {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly marketingApi = inject(MarketingApiService);

  protected readonly campaigns = signal<Campaign[]>([]);
  protected readonly query = signal('');

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p: ParamMap) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const result = await this.marketingApi.list({ page: 1, limit: 100 });
    this.campaigns.set(result.data);
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
}