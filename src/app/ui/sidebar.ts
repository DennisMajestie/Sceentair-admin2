import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NAV, matchSection, navForRole } from '../core/nav';
import { Store } from '../core/store';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme';
import { ToastService } from '../core/toast';
import { SdShellStateService } from '../core/sd-shell-state.service';
import { BadgeStateService } from '../core/badge-state';
import { AlertService } from '../core/alert.service';
import { SdSlidingIndicator } from './sliding-indicator';
import { Icon } from './icon';

const BADGE_KEYS = [
  ...new Set(NAV.flatMap((section) => section.pages.map((page) => page.badge).filter(Boolean) as string[])),
];

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, SdSlidingIndicator],
  template: `
    <aside class="rail" [class.sd-collapsed]="state.collapsed()" aria-label="Main navigation">

      <!-- Theme island: sun / moon, side by side when expanded -->
      <div class="railbox railbox--theme" role="group" aria-label="Theme"
           [class.railbox--row]="!state.collapsed()"
           sdSlidingIndicator itemSelector=".ri--theme" activeClass="is-lit" bg="var(--sd-dark)" radius="var(--sd-r-active-rail)">
        <button
          type="button"
          class="ri ri--theme"
          [class.is-lit]="theme.resolved() === 'light'"
          [attr.aria-pressed]="theme.resolved() === 'light'"
          aria-label="Light mode"
          (click)="theme.setModeAnimated('light', $event)"
          [attr.data-tip]="state.collapsed() ? 'Light mode' : null"
        >
          <app-icon name="sun" [size]="20" />
          @if (!state.collapsed()) { <span class="ri__label">Light mode</span> }
        </button>
        <button
          type="button"
          class="ri ri--theme"
          [class.is-lit]="theme.resolved() === 'dark'"
          [attr.aria-pressed]="theme.resolved() === 'dark'"
          aria-label="Dark mode"
          (click)="theme.setModeAnimated('dark', $event)"
          [attr.data-tip]="state.collapsed() ? 'Dark mode' : null"
        >
          <app-icon name="moon" [size]="20" />
          @if (!state.collapsed()) { <span class="ri__label">Dark mode</span> }
        </button>
      </div>

      <!-- Navigation island: one parent link per section -->
      <nav class="railbox railbox--nav" aria-label="Main"
           sdSlidingIndicator itemSelector=".ri-group" activeClass="is-on" bg="var(--ochre)" radius="var(--sd-r-active-rail)">
        <ul class="nav-list">
          @for (section of nav(); track section.id) {
            <li class="nav-group">
              <button class="ri ri-group"
                [routerLink]="section.path"
                routerLinkActive="is-on"
                [attr.aria-current]="activeSectionId() === section.id ? 'page' : null"
                [attr.data-tip]="state.collapsed() ? section.label : null">
                <app-icon [name]="section.icon" [size]="22" />
                @if (!state.collapsed()) { <span class="ri__label">{{ section.label }}</span> }
                @if (groupBadge(section) > 0) { <i class="ri__count">{{ groupBadge(section) }}</i> }
              </button>
            </li>
          }
        </ul>
      </nav>

      <!-- Utility island: Sign out, Collapse -->
      <div class="railbox railbox--util" role="group" aria-label="Utilities">
        <button
          type="button"
          class="ri ri--util"
          [attr.data-tip]="state.collapsed() ? 'Sign out' : null"
          (click)="promptLogout()"
        >
          <app-icon name="logout" [size]="20" />
          @if (!state.collapsed()) { <span class="ri__label">Sign out</span> }
        </button>
        <button
          type="button"
          class="ri ri--collapse"
          (click)="state.toggle()"
          [attr.aria-expanded]="!state.collapsed()"
          [attr.aria-label]="state.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          [attr.data-tip]="state.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <app-icon name="panel" [size]="20" />
          @if (!state.collapsed()) { <span class="ri__label">{{ state.collapsed() ? 'Expand' : 'Collapse' }}</span> }
        </button>
      </div>

    </aside>
  `,
  styles: `
    :host {
      display: block;
      align-self: stretch;
      min-height: 0;
    }
    .rail {
      display: flex;
      flex-direction: column;
      gap: var(--sd-rail-gap);
      width: 100%;
      min-width: 0;
      padding-bottom: 8px;
    }
    .railbox {
      background: var(--sd-card);
      border-radius: var(--sd-r-rail);
      padding: var(--sd-rail-pad);
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: var(--sd-shadow);
      width: 100%;
    }
    .railbox--row {
      flex-direction: row;
    }
    .ri {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 0;
      background: none;
      color: var(--faint);
      cursor: pointer;
      transition: color 0.25s var(--ease), background 0.25s var(--ease);
      z-index: 1;
    }
    /* Collapsed: icon-only 60px circles */
    .rail.sd-collapsed .ri {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      margin: 0 auto;
      justify-content: center;
      text-align: center;
      overflow: hidden;
    }
    .rail.sd-collapsed .railbox .ri__label {
      display: none;
    }
    /* Expanded: 60px-tall rows, 22px radius */
    .rail:not(.sd-collapsed) .ri {
      width: 100%;
      height: 60px;
      border-radius: var(--sd-r-active-rail);
      text-align: left;
      padding-left: 10px;
    }
    .ri:hover:not(.is-on):not(.is-lit) {
      background: var(--well);
      color: var(--text);
    }
    .ri.is-on {
      color: var(--sd-indicator-ink);
    }
    .ri--theme.is-lit {
      color: var(--sd-darkink);
    }
    .ri__label {
      font-size: var(--fs-xs);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 1;
      text-align: left;
    }
    .rail:not(.sd-collapsed) .ri.is-on .ri__label {
      font-weight: 600;
    }
    .ri__count {
      position: absolute;
      top: 20px;
      right: 10px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--bad);
      color: #fff;
      font: 600 11px var(--font);
      border-radius: var(--sd-r-pill);
      font-style: normal;
      display: grid;
      place-items: center;
    }
    .ri.is-on .ri__count {
      color: var(--raised);
    }
    /* Navigation list */
    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      width: 100%;
    }
    .nav-group {
      width: 100%;
    }
    /* Collapsed tooltips: dark pill to the right, never clipped, above content */
    .rail.sd-collapsed .ri[data-tip]::after {
      content: attr(data-tip);
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: 8px;
      padding: 8px 14px;
      background: var(--sd-dark);
      color: var(--sd-darkink);
      font-size: 13px;
      font-weight: 600;
      border-radius: 12px;
      white-space: nowrap;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
    }
    .rail.sd-collapsed .ri[data-tip]:hover::after,
    .rail.sd-collapsed .ri[data-tip]:focus-visible::after {
      opacity: 1;
    }
    @media (max-width: 860px) {
      .rail {
        flex-direction: row;
        overflow-x: auto;
        overflow-y: visible;
        width: auto;
        min-width: auto;
        position: static;
      }
      .rail::-webkit-scrollbar {
        display: none;
      }
      .railbox {
        flex-direction: row;
        border-radius: 30px;
        padding: 6px;
        width: max-content;
      }
      .ri {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        margin: 0;
        flex: none;
        justify-content: center;
        text-align: center;
      }
      .railbox .ri__label {
        display: none;
      }
      .ri__count {
        top: 2px;
        right: 2px;
      }
      .ri--collapse {
        display: none;
      }
      .rail.sd-collapsed .ri[data-tip]::after {
        display: none;
      }
    }

  `,
})
export class Sidebar {
  protected readonly store = inject(Store);
  protected readonly theme = inject(ThemeService);
  protected readonly state = inject(SdShellStateService);
  private readonly badgeState = inject(BadgeStateService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nav = computed(() => navForRole(this.auth.user()?.access));
  protected readonly activeSectionId = signal<string | null>(null);

  constructor() {
    // One batched reconciliation pass outside change detection: writing from a
    // template read made every badge flash as the baseline shifted mid-render.
    effect(() => {
      const values = BADGE_KEYS.map((key) => [key, this.rawBadgeValue(key)] as const);
      untracked(() => {
        for (const [key, raw] of values) this.badgeState.reconcile(key, raw);
      });
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      const url = e.urlAfterRedirects || '';
      const active = matchSection(url);
      this.activeSectionId.set(active?.id ?? null);
      for (const section of NAV) {
        for (const page of section.pages) {
          if (page.badge && url.startsWith(page.path)) {
            this.badgeState.view(page.badge, this.rawBadgeValue(page.badge));
          }
        }
      }
    });

    this.destroyRef.onDestroy(() => { });
  }

  protected groupBadge(section: (typeof NAV)[number]): number {
    const total = section.pages.reduce(
      (a, p) => a + (p.badge ? this.badgeValue(p.badge) : 0),
      0,
    );
    return total > 0 ? total : 0;
  }

  protected badgeValue(key: string): number {
    return this.badgeState.unseen(key, this.rawBadgeValue(key));
  }

  private rawBadgeValue(key: string): number {
    switch (key) {
      case 'alerts':
        return this.store.alerts().length;
      case 'activity':
        return this.store.activityAttentionCount();
      case 'catalog':
        return this.store.catalogAttentionCount();
      case 'batches':
        return this.store.batchStats().onHold + this.store.batchStats().inQa;
      case 'reviews':
        return this.store.pendingReviewsCount();
      case 'allOrders':
        return this.store.allOrdersAttentionCount();
      case 'board':
        return this.store.boardAttentionCount();
      case 'returns':
        return this.store.returns().filter((r) => r.status === 'requested').length;
      case 'deliveries':
        return this.store.activeDeliveriesCount();
      case 'customOrders':
        return this.store.attentionCustomOrdersCount();
      case 'messages':
        return this.store.messagesAttentionCount();
      case 'pos':
        return this.store.openPurchaseOrders().length;
      case 'materials':
        return this.store.materialsAttentionCount();
      case 'suppliers':
        return this.store.suppliersAttentionCount();
      case 'productionQueue':
        return this.store.productionQueueAttentionCount();
      case 'techPacks':
        return this.store.techPacksAttentionCount();
      case 'kiosk':
        return this.store.kioskAttentionCount();
      case 'inventory':
        return this.store.inventoryAttentionCount();
      case 'locations':
        return this.store.locationsAttentionCount();
      case 'counts':
        return this.store.countStats().open;
      case 'shoppers':
        return this.store.shopperAttentionCount();
      case 'stockists':
        return this.store.stockistAttentionCount();
      case 'wholesaleAccounts':
        return this.store.pendingWholesaleAccountsCount();
      case 'wholesaleTiers':
        return this.store.wholesaleTierAttentionCount();
      case 'campaigns':
        return this.store.campaignsAttentionCount();
      case 'couponWallet':
        return this.store.couponWalletAttentionCount();
      case 'couponCampaigns':
        return this.store.couponCampaignsAttentionCount();
      case 'media':
        return this.store.mediaAttentionCount();
      case 'ledger':
        return this.store.ledgerAttentionCount();
      case 'approvals':
        return this.store.pendingApprovalsCount();
      case 'audit':
        return this.store.auditAttentionCount();
      case 'partners':
        return this.store.partnersAttentionCount();
      case 'reports':
        return this.store.reportsAttentionCount();
      case 'sales':
        return this.store.salesAttentionCount();
      case 'stockHealth':
        return this.store.stockHealthAttentionCount();
      case 'account':
        return this.store.accountAttentionCount();
      case 'company':
        return this.store.companyAttentionCount();
      case 'team':
        return this.store.teamAttentionCount();
      case 'notifications':
        return this.store.notificationsAttentionCount();
      case 'security':
        return this.store.securityAttentionCount();
      case 'helpCenter':
        return this.store.helpCenterAttentionCount();
      case 'tickets':
        return this.store.openTicketsCount();
      case 'orders':
        return this.store.openOrders().length;
      case 'lowStock':
        return this.store.lowStock().length;
      default:
        return 0;
    }
  }

  protected signingOut = signal(false);

  /** Confirm through the shared alert card before ending the session. */
  protected async promptLogout(): Promise<void> {
    const confirmed = await this.alerts.show({
      title: 'Sign out?',
      message: "You'll need to sign back in to access the dashboard.",
      tone: 'neutral',
      showCancel: true,
      cancelLabel: 'Cancel',
      confirmLabel: 'Sign out',
    });
    if (!confirmed || this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      this.toast.show('Signed out.', 'good');
      await this.router.navigateByUrl('/signin');
    } finally {
      this.signingOut.set(false);
    }
  }
}

