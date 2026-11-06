import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '../core/store';
import { ThemeService } from '../core/theme';
import { matchSection } from '../core/nav';
import { relative as relativeTime } from '../core/format';
import { Icon } from './icon';
import { SdSlidingIndicator } from './sliding-indicator';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, RouterLinkActive, SdSlidingIndicator],
  template: `
    <header class="top">
      <a class="brand" routerLink="/dashboard/overview">
        <img
          class="brand__logo"
          [src]="theme.resolved() === 'dark' ? '/logo-dark.png' : '/logo-light.png'"
          alt="Seentair — Style for Everyone"
        />
      </a>

      <nav class="tabs" aria-label="Pages in this section" sdSlidingIndicator itemSelector=".tab">
        @for (page of section().pages; track page.path) {
          <a class="tab" [routerLink]="page.path" routerLinkActive="is-on" ariaCurrentWhenActive="page">
            {{ page.label }}
            @if (page.badge && badgeValue(page.badge) > 0) {
              <em>{{ badgeValue(page.badge) }}</em>
            }
          </a>
        }
      </nav>

      <button type="button" class="search" (click)="paletteOpen.emit()" aria-label="Open command palette">
        <app-icon name="search" [size]="15" />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <button type="button" class="circ" aria-label="Settings" (click)="navigate(['/settings/account'])">
        <app-icon name="settings" [size]="17" />
      </button>

      <div class="menu">
        <button
          type="button"
          class="circ"
          [attr.aria-label]="'Notifications, ' + unread() + ' unread'"
          [attr.aria-expanded]="noticesOpen()"
          (click)="toggleNotices()"
        >
          <app-icon name="bell" [size]="17" />
          @if (unread() > 0) {
            <i class="circ__badge">{{ unread() }}</i>
          }
        </button>
        @if (noticesOpen()) {
          <div class="menu__panel menu__panel--wide">
            <div class="menu__head">
              <strong>Notifications</strong>
              <button type="button" class="btn btn--xs btn--ghost" (click)="store.markAllNoticesRead()">Mark all read</button>
            </div>
            @if (store.notices().length === 0) {
              <div class="empty">Nothing new</div>
            }
            @for (n of store.notices(); track n.id) {
              <button type="button" class="notice" [class.is-read]="n.read" (click)="openNotice(n.id, n.href)">
                <span class="notice__dot" [attr.data-kind]="n.kind"></span>
                <span class="notice__text">{{ n.text }}</span>
                <span class="notice__time">{{ ago(n.at) }}</span>
              </button>
            }
          </div>
        }
      </div>

      <div class="menu">
        <button type="button" class="newbtn" (click)="toggleCreate()">
          <app-icon name="plus" [size]="15" />
          New
        </button>
        @if (createOpen()) {
          <div class="menu__panel">
            <button type="button" class="menu__item" (click)="navigate(['/orders/all'])">Order</button>
            <button type="button" class="menu__item" (click)="navigate(['/purchasing/orders'])">Purchase order</button>
            <button type="button" class="menu__item" (click)="navigate(['/products/batches'])">Batch</button>
            <button type="button" class="menu__item" (click)="navigate(['/warehouses/counts'])">Cycle count</button>
          </div>
        }
      </div>

      <div class="menu">
        <button type="button" class="user" (click)="toggleAccount()" aria-label="Account menu">
          <span class="av av--md av--pine">{{ initials(me().name) }}</span>
          <span class="user__text">
            <small>{{ greeting() }}</small>
            <span>{{ me().name }}</span>
          </span>
          <app-icon name="chevronDown" [size]="13" />
        </button>
        @if (accountOpen()) {
          <div class="menu__panel menu__panel--left">
            <div class="menu__profile">
              <span class="av av--md av--pine">{{ initials(me().name) }}</span>
              <span class="user__text">
                <strong>{{ me().name }}</strong>
                <span class="menu__mail">{{ me().email }}</span>
              </span>
            </div>
            <button type="button" class="menu__item" (click)="navigate(['/settings/account'])">Account</button>
            <button type="button" class="menu__item" (click)="navigate(['/settings/team'])">Team</button>
            <button type="button" class="menu__item" (click)="navigate(['/help/center'])">Help center</button>
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    .top {
      position: sticky;
      top: 10px;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--sd-card);
      border-bottom: 1px solid var(--line-2);
      border-radius: 30px;
      padding: 4px 8px;
      min-height: 60px;
      flex-wrap: nowrap;
    }
    .brand {
      display: flex;
      align-items: center;
      margin-right: auto;
      min-width: 0;
    }
    .brand__logo {
      display: block;
      width: clamp(128px, 13vw, 172px);
      max-height: 46px;
      object-fit: contain;
      object-position: left center;
    }
    .tabs {
      position: absolute;
      left: 32%;
      top: 50%;
      translate: -50% -50%;
      display: flex;
      gap: 2px;
      border: 1px solid var(--line-2);
      border-radius: var(--sd-r-pill);
      padding: 4px;
      background: var(--sd-card);
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: var(--sd-r-pill);
      font-size: var(--fs-md);
      font-weight: 500;
      color: var(--muted);
      transition: color 0.25s var(--ease);
      white-space: nowrap;
      position: relative;
      z-index: 1;
    }
    .tab:hover {
      color: var(--text);
    }
    .tab:focus {
      outline: none;
    }
    .tab:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: -2px;
      border-radius: var(--sd-r-pill);
    }
    .tab.is-on {
      background: none;
      color: var(--sd-darkink);
    }
    .tab em {
      font-style: normal;
      min-width: 17px;
      padding: 1px 5px;
      display: grid;
      place-items: center;
      border-radius: var(--sd-r-pill);
      background: var(--bad);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
    }
    .tab.is-on em {
      background: var(--bad);
      color: #fff;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line-2);
      border-radius: var(--sd-r-pill);
      padding: 0 8px 0 16px;
      height: 42px;
      min-width: 130px;
      flex: 1 0 210px;
      max-width: 148px;
      background: var(--glow-b);
      color: var(--muted);
      font-size: var(--fs-md);
      cursor: pointer;
      text-align: left;
    }
    .search span {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    kbd {
      margin-left: auto;
      font: 500 11px var(--font);
      border: 1px solid var(--line-2);
      border-radius: 8px;
      padding: 3px 7px;
      color: var(--muted);
      background: none;
    }
    .circ {
      position: relative;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--line-2);
      background: var(--sd-card);
      color: var(--muted);
      display: grid;
      place-items: center;
      cursor: pointer;
      flex: none;
    }
    .circ:hover {
      color: var(--text);
    }
    .circ__badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--bad);
      color: #fff;
      font: 600 10px var(--font);
      border-radius: var(--sd-r-pill);
      padding: 2px 6px;
      font-style: normal;
    }
    .newbtn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 42px;
      border: 0;
      border-radius: var(--sd-r-pill);
      background: var(--primary);
      color: var(--on-primary);
      font-weight: 600;
      padding: 0 20px;
      font-size: var(--fs-base);
      cursor: pointer;
      flex: none;
    }
    .user {
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--line-2);
      border-radius: var(--sd-r-pill);
      padding: 4px 14px 4px 5px;
      background: none;
      cursor: pointer;
      color: inherit;
    }
    .user__text {
      display: grid;
      text-align: left;
      line-height: 1.25;
    }
    .user__text small {
      display: block;
      font-size: 10px;
      color: var(--muted);
    }
    .user__text span {
      font-size: var(--fs-md);
      font-weight: 500;
    }
    .menu {
      position: relative;
    }
    .menu__panel {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      min-width: 220px;
      padding: 6px;
      background: var(--sd-card);
      border: 1px solid var(--line-2);
      border-radius: 14px;
      box-shadow: var(--sd-shadow);
      z-index: 50;
      animation: pop 0.14s var(--ease);
    }
    .menu__panel--left {
      right: auto;
      left: 0;
    }
    .menu__panel--wide {
      min-width: 380px;
      max-height: 60vh;
      overflow-y: auto;
    }
    .menu__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px 10px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 4px;
    }
    .menu__profile {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px 10px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 4px;
    }
    .menu__mail {
      font-size: var(--fs-2xs);
      color: var(--faint);
    }
    .menu__item {
      display: block;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 9px;
      background: none;
      text-align: left;
      font-size: var(--fs-md);
      color: var(--text);
      cursor: pointer;
    }
    .menu__item:hover {
      background: var(--well);
    }
    .notice {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: baseline;
      gap: 9px;
      width: 100%;
      padding: 9px 10px;
      border: none;
      border-radius: 10px;
      background: none;
      text-align: left;
      cursor: pointer;
      font-size: var(--fs-md);
      color: var(--text);
    }
    .notice:hover {
      background: var(--well);
    }
    .notice.is-read {
      opacity: 0.55;
    }
    .notice__dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--info);
      align-self: center;
    }
    .notice__dot[data-kind='stock'] { background: var(--bad); }
    .notice__dot[data-kind='expiry'] { background: var(--warn); }
    .notice__dot[data-kind='po'] { background: var(--ocean); }
    .notice__time {
      font-size: var(--fs-2xs);
      color: var(--faint);
      white-space: nowrap;
    }
    @keyframes pop {
      from { opacity: 0; transform: translateY(-4px); }
    }
    @media (max-width: 860px) {
      .top {
        gap: 8px;
        flex-wrap: wrap;
      }
      .tabs,
      .search {
        display: none;
      }
    }
  `,
})
export class Topbar {
  protected readonly store = inject(Store);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly paletteOpen = output<void>();
  protected readonly noticesOpen = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly accountOpen = signal(false);

  protected readonly section = signal(matchSection(this.router.url));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd) this.section.set(matchSection(e.urlAfterRedirects));
    });
  }
  protected readonly me = computed(() => this.store.settings().me);
  protected readonly unread = computed(() => this.store.notices().filter((n) => !n.read).length);

  protected greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  protected initials(name: string): string {
    return (name ?? '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected badgeValue(key: string | undefined): number {
    if (!key) return 0;
    switch (key) {
      case 'alerts':
        return this.store.alerts().length;
      case 'orders':
        return this.store.openOrders().length;
      case 'lowStock':
        return this.store.lowStock().length;
      case 'pos':
        return this.store.openPurchaseOrders().length;
      case 'counts':
        return this.store.countStats().open;
      case 'returns':
        return this.store.returns().filter((r) => r.status === 'requested').length;
      case 'batches':
        return this.store.batchStats().onHold + this.store.batchStats().inQa;
      default:
        return 0;
    }
  }

  protected toggleNotices(): void {
    this.noticesOpen.update((v) => !v);
    this.createOpen.set(false);
    this.accountOpen.set(false);
  }

  protected toggleCreate(): void {
    this.createOpen.update((v) => !v);
    this.noticesOpen.set(false);
    this.accountOpen.set(false);
  }

  protected toggleAccount(): void {
    this.accountOpen.update((v) => !v);
    this.noticesOpen.set(false);
    this.createOpen.set(false);
  }

  protected ago(ts: number): string {
    return relativeTime(ts);
  }

  protected openNotice(id: string, href: string): void {
    this.store.markNoticeRead(id);
    this.noticesOpen.set(false);
    this.router.navigateByUrl(href);
  }

  protected navigate(commands: string[]): void {
    this.createOpen.set(false);
    this.accountOpen.set(false);
    this.router.navigate(commands);
  }
}
