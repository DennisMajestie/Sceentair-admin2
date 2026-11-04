import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { CouponsApiService, type ClaimCouponInput, type Coupon } from '../../core/coupons-api.service';

@Component({
  selector: 'app-coupons-wallet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Coupons</span>
        <h1 class="head__title">Coupon wallet</h1>
        <p class="head__lead">{{ coupons().length }} claimed coupons.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Coupon summary">
      <article class="stat">
        <span class="stat__label">Claimed</span>
        <strong class="stat__value">{{ coupons().length }}</strong>
        <span class="stat__detail">Coupons in wallet</span>
      </article>
      <article class="stat">
        <span class="stat__label">Unused</span>
        <strong class="stat__value">{{ unusedCount() }}</strong>
        <span class="stat__detail">Not yet applied to an order</span>
      </article>
      <article class="stat">
        <span class="stat__label">Expired</span>
        <strong class="stat__value">{{ expiredCount() }}</strong>
        <span class="stat__detail">Past expiry date</span>
      </article>
      <article class="stat">
        <span class="stat__label">Total value</span>
        <strong class="stat__value">{{ totalValue() }}</strong>
        <span class="stat__detail">Combined coupon value</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search code or name" aria-label="Search coupons" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} coupons</span>
    </div>

    <div class="coupon-grid" aria-label="Coupon wallet">
      @for (row of visible(); track row.id) {
        <button type="button" class="coupon-card" (click)="open(row.id)" [attr.aria-label]="'Coupon ' + row.code">
          <span class="coupon-card__top">
            <span class="mono coupon-card__code">{{ row.code }}</span>
            <span class="badge" [class]="'badge badge--' + tone(row.type)">{{ row.type }}</span>
          </span>
          <span class="coupon-card__name">{{ row.name }}</span>
          <span class="coupon-card__detail">{{ row.description ?? 'No description' }}</span>
          <span class="coupon-card__value">{{ row.value }} {{ row.type === 'percent_off' ? '%' : 'off' }}</span>
          <span class="coupon-card__meta">
            <span>{{ row.createdAt }}</span>
            <span>{{ row.expiresAt ? row.expiresAt : 'No expiry' }}</span>
          </span>
          <span class="coupon-card__usage">
            {{ row.timesUsed }} of {{ row.usageCap ?? '∞' }} used
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="coupon-empty">
          <strong>No coupons in wallet.</strong>
          <span>Claim a coupon to add it here.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Coupon detail">
      <ng-container drawerTitle>
        @if (selected(); as c) {
          <div class="dtitle">
            <strong class="mono">{{ c.code }}</strong>
            <span class="badge" [class]="'badge badge--' + c.type">{{ c.type }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as c) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Name</span>
              <span class="dmeta">{{ c.name }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Value</span>
              <strong class="dtotal">{{ c.value }}</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Type</dt><dd>{{ c.type }}</dd></div>
            <div><dt>Code</dt><dd class="mono">{{ c.code }}</dd></div>
            <div><dt>Description</dt><dd>{{ c.description ?? '—' }}</dd></div>
            <div><dt>Min spend</dt><dd>{{ c.minSpend ?? '—' }}</dd></div>
            <div><dt>Max discount</dt><dd>{{ c.maxDiscount ?? '—' }}</dd></div>
            <div><dt>Per customer cap</dt><dd>{{ c.perCustomerCap }}</dd></div>
            <div><dt>Usage cap</dt><dd>{{ c.usageCap ?? 'Unlimited' }}</dd></div>
            <div><dt>Times used</dt><dd>{{ c.timesUsed }}</dd></div>
            <div><dt>Created</dt><dd>{{ c.createdAt }}</dd></div>
            <div><dt>Expires</dt><dd>{{ c.expiresAt ?? 'No expiry' }}</dd></div>
          </dl>

          <h3 class="dlabel">Claim coupon</h3>
          <div class="dclaim">
            <input type="text" class="claim-input" [(ngModel)]="claimCouponId" placeholder="Enter coupon code" />
            <button type="button" class="btn" [disabled]="claimCouponId() === '' || claimLoading()" (click)="submitClaim()">Claim</button>
            @if (claimError()) {
              <p class="claim-error">{{ claimError() }}</p>
            }
            @if (claimSuccess()) {
              <p class="claim-success">{{ claimSuccess() }}</p>
            }
          </div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .coupon-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .coupon-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .coupon-card:hover { border-color: var(--primary); }
    .coupon-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .coupon-card__top, .coupon-card__meta, .coupon-card__usage { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .coupon-card__code { font-size: var(--fs-sm); font-weight: 750; }
    .coupon-card__name { font-size: var(--fs-md); font-weight: 700; }
    .coupon-card__detail { color: var(--muted); font-size: var(--fs-sm); }
    .coupon-card__value { color: var(--text); font-size: var(--fs-md); font-weight: 700; white-space: nowrap; }
    .coupon-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .coupon-card__usage { color: var(--faint); font-size: var(--fs-xs); }
    .coupon-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .coupon-empty strong { color: var(--text); }
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
    .dclaim { display: grid; gap: 10px; margin-top: 12px; }
    .claim-input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); color: var(--text); font-size: var(--fs-sm); }
    .claim-error { color: var(--bad); font-size: var(--fs-xs); margin-top: 4px; }
    .claim-success { color: var(--sage); font-size: var(--fs-xs); margin-top: 4px; }
    @media (max-width: 1100px) { .coupon-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .coupon-grid { grid-template-columns: 1fr; } }
  `,
})
export class CouponsWallet {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly couponsApi = inject(CouponsApiService);

  protected readonly query = signal('');
  protected readonly claimCouponId = signal('');
  protected readonly claimLoading = signal(false);
  protected readonly claimError = signal<string | null>(null);
  protected readonly claimSuccess = signal<string | null>(null);
  protected readonly coupons = signal<Coupon[]>([]);

  protected readonly unusedCount = computed(() =>
    this.coupons().filter((c) => c.timesUsed < (c.usageCap ?? Infinity)).length,
  );
  protected readonly expiredCount = computed(() =>
    this.coupons().filter((c) => c.expiresAt && Date.parse(c.expiresAt) < Date.now()).length,
  );
  protected readonly totalValue = computed(() =>
    this.coupons().reduce((a, c) => a + c.value, 0),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.coupons()
      .filter((c) => {
        if (!q) return true;
        const haystack = `${c.code} ${c.name} ${c.description ?? ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });

  protected readonly tone = (type: string): string => {
    switch (type) {
      case 'percent_off': return 'sage';
      case 'fixed_off': return 'ocean';
      case 'free_delivery': return 'ochre';
      default: return 'muted';
    }
  };

  protected readonly selected = computed(() => this.coupons().find((c) => c.id === this.routeId()));

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  public async load(): Promise<void> {
    const result = await this.couponsApi.mine(1, 100);
    this.coupons.set(result);
  }

  protected close(): void {
    this.router.navigate(['/coupons/wallet']);
  }

  protected open(id: string): void {
    this.router.navigate(['/coupons/wallet', id]);
  }

  protected async submitClaim(): Promise<void> {
    this.claimError.set(null);
    this.claimSuccess.set(null);
    this.claimLoading.set(true);
    try {
      const input: ClaimCouponInput = { coupon_id: this.claimCouponId() };
      const result = await this.couponsApi.claim(input);
      this.claimSuccess.set(result.message);
      this.claimCouponId.set('');
      await this.load();
    } catch (err) {
      this.claimError.set(err instanceof Error ? err.message : 'Claim failed. Please try again.');
    } finally {
      this.claimLoading.set(false);
    }
  }
}