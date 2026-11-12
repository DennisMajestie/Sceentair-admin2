import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import {
  CouponsApiService,
  campaignStatus,
  type AdminCoupon,
  type CouponAudience,
  type CouponBundle,
  type CouponCampaign,
  type CouponCampaignClaimKind,
  type CouponCampaignStatus,
  type CouponReportRow,
  type CouponType,
} from '../../core/coupons-api.service';
import { date as fmtDate } from '../../core/format';
import { UsersApiService, type ApiUser } from '../../core/users-api.service';

type Tab = 'campaigns' | 'coupons' | 'bundles';
type CreateKind = 'campaign' | 'coupon' | 'bundle';
type DeactivateKind = 'campaign' | 'coupon';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'bundles', label: 'Bundles' },
];

const COUPON_TYPES: CouponType[] = ['percent_off', 'fixed_off', 'free_delivery'];
const AUDIENCES: CouponAudience[] = ['all', 'new_customers', 'specific'];

const EMPTY_CAMPAIGN = () => ({
  headline: '',
  badgeText: '',
  offerText: '',
  labelText: 'Limited time offer',
  startsAt: '',
  endsAt: '',
  claimKind: 'coupon' as CouponCampaignClaimKind,
  couponId: '',
  bundleId: '',
  reason: '',
});

const EMPTY_COUPON = () => ({
  name: '',
  description: '',
  type: 'percent_off' as CouponType,
  value: 10 as number | null,
  maxDiscount: null as number | null,
  minSpend: null as number | null,
  startsAt: '',
  expiresAt: '',
  usageCap: null as number | null,
  perCustomerCap: 1,
  audience: 'all' as CouponAudience,
  appliesToSaleItems: false,
  reason: '',
});

const EMPTY_BUNDLE = () => ({ name: '', description: '', couponIds: [] as string[], reason: '' });

/** Operator surface for coupons: banners, discount rules and bundles. */
@Component({
  selector: 'app-coupons-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Marketing</span>
        <h1 class="head__title">Coupon campaigns</h1>
        <p class="head__lead">
          {{ campaigns().length }} campaigns · {{ coupons().length }} coupons · {{ bundles().length }} bundles.
        </p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
        <button class="btn btn--primary" type="button" (click)="openCreate(activeTab())">
          + New {{ createLabel() }}
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Coupon programme summary">
      <article class="stat">
        <span class="stat__label">Campaigns</span>
        <strong class="stat__value">{{ campaigns().length }}</strong>
        <span class="stat__detail">Banners configured</span>
      </article>
      <article class="stat">
        <span class="stat__label">Running</span>
        <strong class="stat__value">{{ runningCount() }}</strong>
        <span class="stat__detail">Live right now</span>
      </article>
      <article class="stat">
        <span class="stat__label">Coupons</span>
        <strong class="stat__value">{{ coupons().length }}</strong>
        <span class="stat__detail">{{ activeCouponCount() }} active</span>
      </article>
      <article class="stat">
        <span class="stat__label">Bundles</span>
        <strong class="stat__value">{{ bundles().length }}</strong>
        <span class="stat__detail">Grouped offers</span>
      </article>
    </div>

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }
    @if (message()) {
      <div class="notice" role="status">{{ message() }}</div>
    }

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Coupon area">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            class="seg__btn"
            [class.is-on]="activeTab() === t.id"
            [attr.aria-pressed]="activeTab() === t.id"
            (click)="setTab(t.id)"
          >
            {{ t.label }} <span class="seg__count">{{ tabCount(t.id) }}</span>
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input
          type="search"
          [attr.placeholder]="searchPlaceholder()"
          [attr.aria-label]="searchPlaceholder()"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </label>
    </div>

    @if (activeTab() === 'campaigns') {
      <div class="grid" aria-label="Coupon campaigns">
        @for (c of visibleCampaigns(); track c.id) {
          <article class="tile">
            <span class="tile__top">
              <span class="badge" [class]="'badge badge--' + statusTone(c)">{{ statusText(c) }}</span>
              @if (!c.isActive) {
                <span class="badge badge--bad">Inactive</span>
              }
            </span>
            <span class="tile__name">{{ c.headline }}</span>
            @if (c.offerText) {
              <span class="tile__detail">{{ c.offerText }}</span>
            }
            <span class="tile__meta">
              <span>{{ day(c.startsAt) }} → {{ day(c.endsAt) }}</span>
              <span>{{ c.claimKind === 'bundle' ? 'Bundle claim' : 'Coupon claim' }}</span>
            </span>
            @if (c.badgeText) {
              <span class="tile__tag">{{ c.badgeText }}</span>
            }
            @if (c.isActive) {
              <button type="button" class="btn btn--tiny" (click)="askDeactivate('campaign', c.id, c.headline)">
                Deactivate
              </button>
            }
          </article>
        }
        @if (visibleCampaigns().length === 0) {
          <div class="empty">
            <strong>No campaigns{{ query() ? ' match.' : ' yet.' }}</strong>
            <span>{{ query() ? 'Try another search term.' : 'Create a banner to promote an offer.' }}</span>
          </div>
        }
      </div>
    }

    @if (activeTab() === 'coupons') {
      <div class="grid" aria-label="Coupons">
        @for (c of visibleCoupons(); track c.id) {
          <article class="tile">
            <span class="tile__top">
              <span class="mono tile__code">{{ c.code }}</span>
              <span class="badge" [class]="'badge badge--' + (c.isActive ? 'good' : 'bad')">
                {{ c.isActive ? 'Active' : 'Inactive' }}
              </span>
            </span>
            <span class="tile__name">{{ c.name }}</span>
            <span class="tile__detail">{{ c.description ?? 'No description' }}</span>
            <span class="tile__meta">
              <span>{{ couponValue(c) }}</span>
              <span>{{ c.timesUsed }} used{{ c.usageCap ? ' / ' + c.usageCap : '' }}</span>
            </span>
            @if (c.isActive) {
              <span class="tile__actions">
                <button type="button" class="btn btn--tiny" (click)="askIssue(c)">Issue</button>
                <button type="button" class="btn btn--tiny" (click)="askDeactivate('coupon', c.id, c.name)">
                  Deactivate
                </button>
              </span>
            }
          </article>
        }
        @if (visibleCoupons().length === 0) {
          <div class="empty">
            <strong>No coupons{{ query() ? ' match.' : ' yet.' }}</strong>
            <span>{{ query() ? 'Try another search term.' : 'Create a discount rule to get started.' }}</span>
          </div>
        }
      </div>

      @if (report().length > 0) {
        <h2 class="section-title">Redemption report</h2>
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Coupon redemption by code</caption>
            <thead>
              <tr><th>Code</th><th>Name</th><th class="num">Held</th><th class="num">Used</th><th class="num">Expired</th></tr>
            </thead>
            <tbody>
              @for (row of report(); track row.couponId) {
                <tr>
                  <td class="mono">{{ row.code }}</td>
                  <td>{{ row.name }}</td>
                  <td class="num">{{ row.held }}</td>
                  <td class="num">{{ row.used }}</td>
                  <td class="num">{{ row.expired }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    @if (activeTab() === 'bundles') {
      <div class="grid" aria-label="Coupon bundles">
        @for (b of visibleBundles(); track b.id) {
          <article class="tile">
            <span class="tile__top">
              <span class="tile__name">{{ b.name }}</span>
              <span class="badge" [class]="'badge badge--' + (b.isActive ? 'good' : 'bad')">
                {{ b.isActive ? 'Active' : 'Inactive' }}
              </span>
            </span>
            <span class="tile__detail">{{ b.description ?? 'No description' }}</span>
            <span class="tile__meta"><span>Created {{ day(b.createdAt) }}</span></span>
          </article>
        }
        @if (visibleBundles().length === 0) {
          <div class="empty">
            <strong>No bundles{{ query() ? ' match.' : ' yet.' }}</strong>
            <span>{{ query() ? 'Try another search term.' : 'Group coupons to offer them together.' }}</span>
          </div>
        }
      </div>
    }

    <app-drawer [open]="!!createMode()" (close)="closeCreate()" [label]="'New ' + createLabel()">
      <ng-container drawerTitle>
        <strong>New {{ createLabel() }}</strong>
      </ng-container>

      @if (createMode() === 'campaign') {
        <div class="form">
          <label class="field"><span class="field__label">Headline</span>
            <input type="text" [(ngModel)]="campaignForm.headline" name="cHeadline" placeholder="Mid-season sale" required /></label>
          <label class="field"><span class="field__label">Badge text</span>
            <input type="text" [(ngModel)]="campaignForm.badgeText" name="cBadge" placeholder="Optional, e.g. 20% OFF" /></label>
          <label class="field"><span class="field__label">Offer text</span>
            <input type="text" [(ngModel)]="campaignForm.offerText" name="cOffer" placeholder="Optional supporting line" /></label>
          <label class="field"><span class="field__label">Label text</span>
            <input type="text" [(ngModel)]="campaignForm.labelText" name="cLabel" /></label>
          <div class="form__row">
            <label class="field"><span class="field__label">Starts</span>
              <input type="date" [(ngModel)]="campaignForm.startsAt" name="cStarts" required /></label>
            <label class="field"><span class="field__label">Ends</span>
              <input type="date" [(ngModel)]="campaignForm.endsAt" name="cEnds" required /></label>
          </div>
          <label class="field"><span class="field__label">Claim kind</span>
            <select [(ngModel)]="campaignForm.claimKind" name="cKind">
              <option value="coupon">Coupon</option>
              <option value="bundle">Bundle</option>
            </select></label>
          @if (campaignForm.claimKind === 'coupon') {
            <label class="field"><span class="field__label">Coupon</span>
              <select [(ngModel)]="campaignForm.couponId" name="cCoupon">
                <option value="">Choose a coupon…</option>
                @for (c of coupons(); track c.id) {
                  <option [value]="c.id">{{ c.code }} — {{ c.name }}</option>
                }
              </select></label>
          } @else {
            <label class="field"><span class="field__label">Bundle</span>
              <select [(ngModel)]="campaignForm.bundleId" name="cBundle">
                <option value="">Choose a bundle…</option>
                @for (b of bundles(); track b.id) {
                  <option [value]="b.id">{{ b.name }}</option>
                }
              </select></label>
          }
          <label class="field"><span class="field__label">Reason (audit)</span>
            <input type="text" [(ngModel)]="campaignForm.reason" name="cReason" placeholder="Why this banner is going live" required /></label>
          <div class="form__actions">
            <button type="button" class="btn" (click)="closeCreate()">Cancel</button>
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="submitCampaign()">
              {{ saving() ? 'Saving…' : 'Create campaign' }}
            </button>
          </div>
        </div>
      }

      @if (createMode() === 'coupon') {
        <div class="form">
          <label class="field"><span class="field__label">Name</span>
            <input type="text" [(ngModel)]="couponForm.name" name="kName" placeholder="Spring welcome" required /></label>
          <label class="field"><span class="field__label">Description</span>
            <input type="text" [(ngModel)]="couponForm.description" name="kDesc" placeholder="Optional" /></label>
          <div class="form__row">
            <label class="field"><span class="field__label">Type</span>
              <select [(ngModel)]="couponForm.type" name="kType">
                @for (t of couponTypes; track t) { <option [value]="t">{{ typeLabel(t) }}</option> }
              </select></label>
            <label class="field"><span class="field__label">Value</span>
              <input type="number" min="0" [(ngModel)]="couponForm.value" name="kValue" /></label>
          </div>
          @if (couponForm.type === 'percent_off') {
            <label class="field"><span class="field__label">Maximum discount (required for %)</span>
              <input type="number" min="0" [(ngModel)]="couponForm.maxDiscount" name="kMax" /></label>
          }
          <div class="form__row">
            <label class="field"><span class="field__label">Minimum spend</span>
              <input type="number" min="0" [(ngModel)]="couponForm.minSpend" name="kMin" /></label>
            <label class="field"><span class="field__label">Usage cap</span>
              <input type="number" min="0" [(ngModel)]="couponForm.usageCap" name="kCap" placeholder="Unlimited" /></label>
          </div>
          <div class="form__row">
            <label class="field"><span class="field__label">Starts</span>
              <input type="date" [(ngModel)]="couponForm.startsAt" name="kStarts" /></label>
            <label class="field"><span class="field__label">Expires</span>
              <input type="date" [(ngModel)]="couponForm.expiresAt" name="kExpires" /></label>
          </div>
          <label class="field"><span class="field__label">Audience</span>
            <select [(ngModel)]="couponForm.audience" name="kAudience">
              @for (a of audiences; track a) { <option [value]="a">{{ audienceLabel(a) }}</option> }
            </select></label>
          <label class="field field--check">
            <input type="checkbox" [(ngModel)]="couponForm.appliesToSaleItems" name="kSale" />
            <span>Applies to sale items</span></label>
          <label class="field"><span class="field__label">Reason (audit)</span>
            <input type="text" [(ngModel)]="couponForm.reason" name="kReason" placeholder="Why this coupon is being created" required /></label>
          <div class="form__actions">
            <button type="button" class="btn" (click)="closeCreate()">Cancel</button>
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="submitCoupon()">
              {{ saving() ? 'Saving…' : 'Create coupon' }}
            </button>
          </div>
        </div>
      }

      @if (createMode() === 'bundle') {
        <div class="form">
          <label class="field"><span class="field__label">Name</span>
            <input type="text" [(ngModel)]="bundleForm.name" name="bName" placeholder="Welcome pack" required /></label>
          <label class="field"><span class="field__label">Description</span>
            <input type="text" [(ngModel)]="bundleForm.description" name="bDesc" placeholder="Optional" /></label>
          <fieldset class="field field--group">
            <legend class="field__label">Coupons in this bundle</legend>
            @for (c of coupons(); track c.id) {
              <label class="check">
                <input type="checkbox" [checked]="bundleForm.couponIds.includes(c.id)" (change)="toggleBundleCoupon(c.id)" />
                <span>{{ c.code }} — {{ c.name }}</span>
              </label>
            }
            @if (coupons().length === 0) {
              <p class="hint">Create a coupon first.</p>
            }
          </fieldset>
          <label class="field"><span class="field__label">Reason (audit)</span>
            <input type="text" [(ngModel)]="bundleForm.reason" name="bReason" placeholder="Why this bundle is being created" required /></label>
          <div class="form__actions">
            <button type="button" class="btn" (click)="closeCreate()">Cancel</button>
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="submitBundle()">
              {{ saving() ? 'Saving…' : 'Create bundle' }}
            </button>
          </div>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="!!deactivateTarget()" (close)="cancelDeactivate()" label="Confirm deactivation">
      <ng-container drawerTitle>
        <strong>Deactivate</strong>
      </ng-container>
      @if (deactivateTarget(); as target) {
        <div class="form">
          <p class="hint">
            Deactivating <strong>{{ target.label }}</strong> stops new use but keeps its history. This is recorded in the audit log.
          </p>
          <label class="field"><span class="field__label">Reason (audit)</span>
            <input type="text" [(ngModel)]="deactivateReason" name="dReason" placeholder="Required" /></label>
          <div class="form__actions">
            <button type="button" class="btn" (click)="cancelDeactivate()">Cancel</button>
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="confirmDeactivate()">
              {{ saving() ? 'Working…' : 'Deactivate' }}
            </button>
          </div>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="!!issueTarget()" (close)="cancelIssue()" label="Issue coupon">
      <ng-container drawerTitle>
        <strong>Issue coupon</strong>
      </ng-container>
      @if (issueTarget(); as coupon) {
        <div class="form">
          <p class="hint">
            Issues <strong class="mono">{{ coupon.code }}</strong> — {{ coupon.name }} into each selected customer's wallet.
          </p>
          <label class="field"><span class="field__label">Find customers</span>
            <input type="search" [(ngModel)]="issueSearch" name="issueSearch" placeholder="Search name, email or city" />
          </label>
          <fieldset class="field--group">
            <legend class="field__label">Recipients ({{ issueForm.customerIds.length }} selected)</legend>
            @for (customer of issueMatches(); track customer.id) {
              <label class="check">
                <input type="checkbox" [checked]="issueForm.customerIds.includes(customer.id)" (change)="toggleIssueCustomer(customer.id)" />
                <span>{{ customer.name }} · {{ customer.email }} ({{ customer.role?.name }})</span>
              </label>
            }
            @if (issueMatches().length === 0) {
              <p class="hint">No customers match.</p>
            }
          </fieldset>
          <label class="field"><span class="field__label">Expires at (optional)</span>
            <input type="date" [(ngModel)]="issueForm.expiresAt" name="issueExpires" /></label>
          <label class="field"><span class="field__label">Reason (audit)</span>
            <input type="text" [(ngModel)]="issueForm.reason" name="issueReason" placeholder="Why these customers are receiving it" required /></label>
          <div class="form__actions">
            <button type="button" class="btn" (click)="cancelIssue()">Cancel</button>
            <button type="button" class="btn btn--primary" [disabled]="saving()" (click)="submitIssue()">
              {{ saving() ? 'Issuing…' : 'Issue coupon' }}
            </button>
          </div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .tile { display: grid; gap: 10px; align-content: start; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); box-shadow: var(--shadow); }
    .tile__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tile__code { font-size: var(--fs-sm); font-weight: 750; }
    .tile__name { font-size: var(--fs-md); font-weight: 700; }
    .tile__detail { color: var(--muted); font-size: var(--fs-sm); }
    .tile__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: var(--fs-sm); }
    .tile__tag { justify-self: start; font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
    .empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    .seg__count { font-variant-numeric: tabular-nums; opacity: 0.7; }
    .section-title { margin: 22px 0 10px; font-size: var(--fs-lg); font-weight: 700; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .form { display: grid; gap: 14px; }
    .form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .field--check { display: flex; align-items: center; gap: 8px; }
    .field--group { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: var(--sd-r-card); padding: 12px; margin: 0; }
    .check { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sm); }
    .hint { margin: 0; color: var(--muted); font-size: var(--fs-sm); }
    .notice { display: flex; align-items: center; gap: 8px; margin: 10px 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs); }
    .notice--error { border-color: var(--bad); color: var(--bad); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .btn--tiny { padding: 4px 10px; font-size: var(--fs-xs); border: 1px solid var(--line-2); border-radius: var(--sd-r-pill); background: none; color: var(--muted); cursor: pointer; justify-self: start; }
    .btn--tiny:hover { color: var(--bad); border-color: var(--bad); }
    .tile__actions { display: flex; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .form__row { grid-template-columns: 1fr; } }
  `,
})
export class CouponsCampaigns {
  private readonly couponsApi = inject(CouponsApiService);
  private readonly usersApi = inject(UsersApiService);

  protected readonly tabs = TABS;
  protected readonly couponTypes = COUPON_TYPES;
  protected readonly audiences = AUDIENCES;

  protected readonly activeTab = signal<Tab>('campaigns');
  protected readonly query = signal('');
  protected readonly campaigns = signal<CouponCampaign[]>([]);
  protected readonly coupons = signal<AdminCoupon[]>([]);
  protected readonly bundles = signal<CouponBundle[]>([]);
  protected readonly report = signal<CouponReportRow[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly createMode = signal<CreateKind | null>(null);
  protected readonly deactivateTarget = signal<{ kind: DeactivateKind; id: string; label: string } | null>(null);
  protected readonly issueTarget = signal<AdminCoupon | null>(null);
  protected readonly issuers = signal<ApiUser[]>([]);

  protected campaignForm = EMPTY_CAMPAIGN();
  protected couponForm = EMPTY_COUPON();
  protected bundleForm = EMPTY_BUNDLE();
  protected deactivateReason = '';
  protected issueSearch = '';
  protected issueForm = {
    customerIds: [] as string[],
    expiresAt: '',
    reason: '',
  };

  protected readonly issueMatches = computed(() => {
    const q = this.issueSearch.trim().toLowerCase();
    return this.issuers()
      .filter(
        (c) =>
          !q ||
          `${c.name} ${c.email ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, 60);
  });

  private async loadIssuers(): Promise<void> {
    try {
      const list = await this.usersApi.list(1, 100);
      this.issuers.set(
        list.data.filter((u) => ['customer', 'wholesaler'].includes(u.role?.name ?? '')),
      );
    } catch {
      this.issuers.set([]);
    }
  }

  protected readonly runningCount = computed(() =>
    this.campaigns().filter((c) => c.isActive && campaignStatus(c) === 'running').length,
  );
  protected readonly activeCouponCount = computed(() => this.coupons().filter((c) => c.isActive).length);

  protected readonly visibleCampaigns = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.campaigns().filter(
      (c) => !q || `${c.headline} ${c.offerText ?? ''} ${c.badgeText ?? ''}`.toLowerCase().includes(q),
    );
  });

  protected readonly visibleCoupons = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.coupons().filter(
      (c) => !q || `${c.code} ${c.name} ${c.description ?? ''}`.toLowerCase().includes(q),
    );
  });

  protected readonly visibleBundles = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.bundles().filter((b) => !q || `${b.name} ${b.description ?? ''}`.toLowerCase().includes(q));
  });

  constructor() {
    void this.load();
    void this.loadIssuers();
  }

  protected async load(): Promise<void> {
    this.error.set(null);
    try {
      const [campaigns, coupons, bundles, report] = await Promise.all([
        this.couponsApi.campaigns(),
        this.couponsApi.adminCoupons(),
        this.couponsApi.bundles(),
        this.couponsApi.report(),
      ]);
      this.campaigns.set(campaigns);
      this.coupons.set(coupons);
      this.bundles.set(bundles);
      this.report.set(report);
    } catch (err) {
      this.error.set(this.messageFor(err, 'Could not load coupon data.'));
    }
  }

  protected setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.query.set('');
  }

  protected tabCount(tab: Tab): number {
    if (tab === 'campaigns') return this.campaigns().length;
    if (tab === 'coupons') return this.coupons().length;
    return this.bundles().length;
  }

  protected createLabel(): string {
    const tab = this.activeTab();
    return tab === 'coupons' ? 'coupon' : tab === 'bundles' ? 'bundle' : 'campaign';
  }

  protected searchPlaceholder(): string {
    return `Search ${this.activeTab()}`;
  }

  protected openCreate(tab: Tab): void {
    this.message.set(null);
    this.error.set(null);
    this.campaignForm = EMPTY_CAMPAIGN();
    this.couponForm = EMPTY_COUPON();
    this.bundleForm = EMPTY_BUNDLE();
    this.createMode.set(tab === 'coupons' ? 'coupon' : tab === 'bundles' ? 'bundle' : 'campaign');
  }

  protected closeCreate(): void {
    this.createMode.set(null);
  }

  protected async submitCampaign(): Promise<void> {
    const f = this.campaignForm;
    if (!this.requireFields([
      [f.headline.trim(), 'Give the campaign a headline.'],
      [f.startsAt, 'Choose a start date.'],
      [f.endsAt, 'Choose an end date.'],
      [f.reason.trim(), 'A reason is required for the audit log.'],
    ])) return;
    if (f.endsAt < f.startsAt) return this.fail('The end date must not be before the start date.');
    if (f.claimKind === 'coupon' && !f.couponId) return this.fail('Choose a coupon for this campaign.');
    if (f.claimKind === 'bundle' && !f.bundleId) return this.fail('Choose a bundle for this campaign.');

    await this.save(async () => {
      await this.couponsApi.createCampaign({
        headline: f.headline.trim(),
        badgeText: f.badgeText.trim() || undefined,
        offerText: f.offerText.trim() || undefined,
        labelText: f.labelText.trim() || undefined,
        startsAt: f.startsAt,
        endsAt: f.endsAt,
        claimKind: f.claimKind,
        couponId: f.claimKind === 'coupon' ? f.couponId : undefined,
        bundleId: f.claimKind === 'bundle' ? f.bundleId : undefined,
        reason: f.reason.trim(),
      });
      this.message.set('Campaign created.');
    });
  }

  protected async submitCoupon(): Promise<void> {
    const f = this.couponForm;
    if (!this.requireFields([
      [f.name.trim(), 'Give the coupon a name.'],
      [f.reason.trim(), 'A reason is required for the audit log.'],
    ])) return;
    if (f.type === 'percent_off' && (f.value === null || f.value < 0 || f.value > 100)) {
      return this.fail('A percentage coupon needs a value between 0 and 100.');
    }
    if (f.type === 'percent_off' && !f.maxDiscount) {
      return this.fail('A percentage coupon needs a maximum discount.');
    }

    await this.save(async () => {
      await this.couponsApi.createCoupon({
        name: f.name.trim(),
        description: f.description.trim() || null,
        type: f.type,
        value: f.type === 'free_delivery' ? 0 : f.value ?? 0,
        maxDiscount: f.type === 'percent_off' ? f.maxDiscount : null,
        minSpend: f.minSpend,
        startsAt: f.startsAt || null,
        expiresAt: f.expiresAt || null,
        usageCap: f.usageCap,
        perCustomerCap: f.perCustomerCap,
        audience: f.audience,
        appliesToSaleItems: f.appliesToSaleItems,
        reason: f.reason.trim(),
      });
      this.message.set('Coupon created.');
    });
  }

  protected async submitBundle(): Promise<void> {
    const f = this.bundleForm;
    if (!this.requireFields([
      [f.name.trim(), 'Give the bundle a name.'],
      [f.reason.trim(), 'A reason is required for the audit log.'],
    ])) return;
    if (f.couponIds.length === 0) return this.fail('Select at least one coupon for the bundle.');

    await this.save(async () => {
      await this.couponsApi.createBundle({
        name: f.name.trim(),
        description: f.description.trim() || null,
        couponIds: f.couponIds,
        reason: f.reason.trim(),
      });
      this.message.set('Bundle created.');
    });
  }

  protected toggleBundleCoupon(id: string): void {
    this.bundleForm.couponIds = this.bundleForm.couponIds.includes(id)
      ? this.bundleForm.couponIds.filter((c) => c !== id)
      : [...this.bundleForm.couponIds, id];
  }

  protected askDeactivate(kind: DeactivateKind, id: string, label: string): void {
    this.deactivateReason = '';
    this.deactivateTarget.set({ kind, id, label });
  }

  protected cancelDeactivate(): void {
    this.deactivateTarget.set(null);
  }

  protected async confirmDeactivate(): Promise<void> {
    const target = this.deactivateTarget();
    if (!target) return;
    const reason = this.deactivateReason.trim();
    if (!reason) return this.fail('A reason is required for the audit log.');

    await this.save(async () => {
      if (target.kind === 'campaign') await this.couponsApi.deactivateCampaign(target.id, reason);
      else await this.couponsApi.deactivateCoupon(target.id, reason);
      this.deactivateTarget.set(null);
      this.message.set(`${target.kind === 'campaign' ? 'Campaign' : 'Coupon'} deactivated.`);
    });
  }

  protected askIssue(coupon: AdminCoupon): void {
    this.message.set(null);
    this.error.set(null);
    this.issueSearch = '';
    this.issueForm = { customerIds: [], expiresAt: '', reason: '' };
    this.issueTarget.set(coupon);
  }

  protected cancelIssue(): void {
    this.issueTarget.set(null);
  }

  protected toggleIssueCustomer(id: string): void {
    const ids = this.issueForm.customerIds;
    this.issueForm.customerIds = ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id];
  }

  protected async submitIssue(): Promise<void> {
    const coupon = this.issueTarget();
    if (!coupon) return;
    if (this.issueForm.customerIds.length === 0) return this.fail('Select at least one customer.');
    const reason = this.issueForm.reason.trim();
    if (!reason) return this.fail('A reason is required for the audit log.');

    await this.save(async () => {
      const issued = await this.couponsApi.issue(coupon.id, {
        customerIds: this.issueForm.customerIds,
        expiresAt: this.issueForm.expiresAt || null,
        reason,
      });
      this.issueTarget.set(null);
      this.message.set(`Coupon issued to ${issued} customer${issued === 1 ? '' : 's'}.`);
    });
  }

  protected statusText(c: CouponCampaign): string {
    if (!c.isActive) return 'Inactive';
    const status: CouponCampaignStatus = campaignStatus(c);
    return status === 'running' ? 'Running' : status === 'upcoming' ? 'Upcoming' : 'Ended';
  }

  protected statusTone(c: CouponCampaign): string {
    if (!c.isActive) return 'bad';
    const status = campaignStatus(c);
    return status === 'running' ? 'good' : status === 'upcoming' ? 'info' : 'warn';
  }

  protected couponValue(c: AdminCoupon): string {
    switch (c.type) {
      case 'percent_off':
        return `${c.value}% off${c.maxDiscount ? ` (max ${c.maxDiscount})` : ''}`;
      case 'fixed_off':
        return `${c.value} off`;
      default:
        return 'Free delivery';
    }
  }

  protected typeLabel(type: CouponType): string {
    return type === 'percent_off' ? 'Percent off' : type === 'fixed_off' ? 'Fixed amount off' : 'Free delivery';
  }

  protected audienceLabel(audience: CouponAudience): string {
    return audience === 'all' ? 'Everyone' : audience === 'new_customers' ? 'New customers' : 'Specific customers';
  }

  protected day(iso: string): string {
    const ts = Date.parse(iso);
    return Number.isNaN(ts) ? '—' : fmtDate(ts);
  }

  private async save(work: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.saving.set(true);
    try {
      await work();
      await this.load();
      this.createMode.set(null);
    } catch (err) {
      this.error.set(this.messageFor(err, 'The change could not be saved.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Returns true when every field is present; otherwise surfaces the first message. */
  private requireFields(checks: Array<[unknown, string]>): boolean {
    for (const [value, message] of checks) {
      if (value === null || value === undefined || value === '' || value === false) {
        this.error.set(message);
        return false;
      }
    }
    return true;
  }

  private fail(message: string): void {
    this.error.set(message);
  }

  private messageFor(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    const detail = (error as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(detail)) return detail.join(' ');
    if (typeof detail === 'string') return detail;
    return fallback;
  }
}
