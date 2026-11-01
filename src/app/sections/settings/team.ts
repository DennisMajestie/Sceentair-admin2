import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  NgZone,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { Store } from '../../core/store';
import { count as fmtCount } from '../../core/format';
import { TeamRole } from '../../core/models';
import { Icon } from '../../ui/icon';

export type RoleFilter = 'all' | TeamRole;

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  title: string;
  role: TeamRole;
  roleLabel: string;
  status: string;
  statusTone: 'good' | 'warn' | 'info' | 'neutral';
  location?: string;
  isMe: boolean;
  initials: string;
  avatarTone: string;
}

export interface SeatUsage {
  used: number;
  limit: number;
  left: number;
  percent: number;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer',
};

const ROLE_ORDER: TeamRole[] = ['admin', 'manager', 'staff', 'viewer'];
const AVATAR_TONES = ['pine', 'ochre', 'teal', 'ocean', 'sky', 'rose', 'sage', 'slate'];

export function filterTeamMembers(
  rows: readonly TeamMemberRow[],
  role: RoleFilter,
  query: string,
): TeamMemberRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return rows.filter((member) => {
    const matchesRole = role === 'all' || member.role === role;
    const searchable = `${member.name} ${member.email} ${member.title}`.toLocaleLowerCase();
    return matchesRole && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

export function teamRoleCounts(
  rows: readonly TeamMemberRow[],
): { id: TeamRole; label: string; count: number }[] {
  const presentRoles = new Set(rows.map((member) => member.role));
  return ROLE_ORDER.filter((role) => presentRoles.has(role)).map((role) => ({
    id: role,
    label: ROLE_LABELS[role],
    count: rows.filter((member) => member.role === role).length,
  }));
}

export function teamStatusTone(status: string): TeamMemberRow['statusTone'] {
  switch (status.toLowerCase()) {
    case 'active':
      return 'good';
    case 'away':
      return 'warn';
    case 'invited':
    case 'pending':
      return 'info';
    default:
      return 'neutral';
  }
}

export function calculateSeatUsage(memberCount: number, seatLimit: number): SeatUsage | null {
  if (!Number.isFinite(memberCount) || !Number.isFinite(seatLimit) || seatLimit <= 0) {
    return null;
  }

  const used = Math.max(0, memberCount);
  return {
    used,
    limit: seatLimit,
    left: Math.max(0, seatLimit - used),
    percent: Math.min(100, (used / seatLimit) * 100),
  };
}

function avatarToneForId(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

@Component({
  selector: 'app-settings-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Team access and membership</span>
        <h1 class="head__title">Team &amp; roles</h1>
      </div>
    </div>

    <section class="kpis" aria-label="Team summary">
      <article class="card kpi">
        <span class="kpi__icon"><app-icon name="users" [size]="18" /></span>
        <span class="stat__label">Members</span>
        <span class="kpi__value">{{ count(rows().length) }}</span>
        @if (sites() > 0) {
          <span class="kpi__meta">across {{ count(sites()) }} sites</span>
        }
      </article>
      @if (seatUsage(); as seats) {
        <article class="card kpi">
          <span class="kpi__icon"><app-icon name="card" [size]="18" /></span>
          <span class="stat__label">Seats left</span>
          <span class="kpi__value">{{ count(seats.left) }} of {{ count(seats.limit) }}</span>
          <span class="kpi__meta">{{ billing().plan }} plan</span>
        </article>
      }
    </section>

    <article class="card members-card" aria-labelledby="members-heading">
      <div class="card__head members-head">
        <div>
          <h2 class="card__title" id="members-heading">Members</h2>
          <p class="card__sub">
            {{ count(rows().length) }} people
            @if (sites() > 0) {
              <span>across {{ count(sites()) }} sites</span>
            }
          </p>
        </div>
        <label class="search member-search">
          <app-icon name="search" [size]="16" />
          <span class="sr">Search people</span>
          <input
            type="search"
            aria-label="Search people by name, email, or job title"
            placeholder="Search people..."
            [value]="searchInput()"
            (input)="setSearch($any($event.target).value)"
          />
        </label>
      </div>

      <div class="role-filters" role="toolbar" aria-label="Filter members by role">
        <button
          type="button"
          class="role-filter"
          [class.is-active]="role() === 'all'"
          [attr.aria-pressed]="role() === 'all'"
          (click)="setRole('all')"
        >
          Everyone <span>{{ count(rows().length) }}</span>
        </button>
        @for (item of roleFilters(); track item.id) {
          <button
            type="button"
            class="role-filter"
            [class.is-active]="role() === item.id"
            [attr.aria-pressed]="role() === item.id"
            (click)="setRole(item.id)"
          >
            {{ item.label }} <span>{{ count(item.count) }}</span>
          </button>
        }
      </div>

      <div class="table-wrap">
        <table class="members-table">
          <caption class="sr">Team members, their locations, roles, and statuses</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              @if (hasLocations()) {
                <th scope="col">Works at</th>
              }
              <th scope="col">Role</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (member of visible(); track member.id) {
              <tr class="member-row">
                <td data-label="Person">
                  <div class="who">
                    <span [class]="'av av--md av--' + member.avatarTone">
                      {{ member.initials }}
                    </span>
                    <span class="who__text">
                      <strong>
                        {{ member.name }}
                        @if (member.isMe) {
                          <span class="who__you">You</span>
                        }
                      </strong>
                      <span class="who__meta">{{ member.title }} · {{ member.email }}</span>
                    </span>
                  </div>
                </td>
                @if (hasLocations()) {
                  <td data-label="Works at">{{ member.location }}</td>
                }
                <td data-label="Role"><span class="badge">{{ member.roleLabel }}</span></td>
                <td data-label="Status">
                  <span class="badge" [class]="'badge badge--' + member.statusTone">
                    <span [class]="'status-dot status--' + member.statusTone" aria-hidden="true"></span>
                    {{ member.status }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td class="empty-cell" [attr.colspan]="hasLocations() ? 4 : 3">
                  <span>No people match</span>
                  <button
                    type="button"
                    class="btn btn--xs btn--ghost clear-button"
                    (click)="clearFilters()"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </article>

    @if (seatUsage(); as seats) {
      <article class="card seats-card" aria-labelledby="seats-heading">
        <div class="card__head">
          <div>
            <h2 class="card__title" id="seats-heading">Seats</h2>
            <p class="card__sub">{{ billing().plan }} plan · {{ count(seats.limit) }}-seat limit</p>
          </div>
        </div>
        <div class="seats-content">
          <p class="seats__line">
            <strong>{{ count(seats.used) }}</strong>
            <span>of {{ count(seats.limit) }} seats in use</span>
          </p>
          <div
            class="seat-meter"
            role="progressbar"
            aria-label="Seats in use"
            aria-valuemin="0"
            [attr.aria-valuemax]="seats.limit"
            [attr.aria-valuenow]="seats.used"
          >
            <span class="seat-meter__fill" [attr.data-progress]="seats.percent / 100"></span>
          </div>
          <p class="hint">
            Seat totals reflect the workspace settings saved in this browser.
          </p>
          <a class="btn btn--ghost billing-link" routerLink="/settings/billing">Manage billing</a>
        </div>
      </article>
    }
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .kpi {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      grid-template-rows: auto auto auto;
      align-items: center;
      column-gap: 10px;
      row-gap: 3px;
      padding: 20px;
      border-radius: 26px;
    }
    .kpi__icon {
      grid-row: 1 / 4;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--sd-tint);
      color: var(--primary);
    }
    .kpi__value {
      font-size: 24px;
      font-weight: 500;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .kpi__meta {
      font-size: 12px;
      color: var(--muted);
    }
    .members-card,
    .seats-card {
      margin-bottom: 16px;
      padding: 20px;
      border-radius: 26px;
    }
    .members-head {
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .member-search {
      width: min(260px, 100%);
      min-width: 0;
      height: 40px;
    }
    .member-search:focus-within {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .role-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0 6px;
    }
    .role-filter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--line-2);
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .role-filter.is-active {
      border-color: var(--sd-dark);
      background: var(--sd-dark);
      color: var(--sd-darkink);
    }
    .members-card .table-wrap {
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .members-table th {
      padding: 12px 14px;
      font-weight: 600;
      background: transparent;
      position: static;
      z-index: auto;
    }
    .members-table td {
      height: 66px;
      padding: 10px 14px;
      font-size: 13px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .who__text {
      display: grid;
      min-width: 0;
      gap: 3px;
      line-height: 1.2;
    }
    .who__text strong {
      overflow: hidden;
      font-size: 13px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .who__meta {
      display: block;
      overflow: hidden;
      max-width: 360px;
      color: var(--muted);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .who__you {
      margin-left: 6px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--well);
      color: var(--muted);
      font-size: 10px;
      font-weight: 500;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .status--good { color: var(--good); }
    .status--warn { color: var(--warn); }
    .status--info { color: var(--info); }
    .status--neutral { color: var(--muted); }
    .members-table td .badge { color: var(--text); }
    .empty-cell {
      height: auto !important;
      padding: 30px 16px !important;
      color: var(--muted) !important;
      text-align: center;
    }
    .seats-content {
      display: grid;
      justify-items: start;
      gap: 12px;
    }
    .seats__line {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin: 0;
    }
    .seats__line strong {
      color: var(--text);
      font-size: 22px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .seats__line span {
      color: var(--muted);
      font-size: 13px;
    }
    .seat-meter {
      width: min(100%, 420px);
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--well);
    }
    .seat-meter__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary);
      transform: scaleX(0);
      transform-origin: left center;
    }
    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }
    @container main (max-width: 900px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @container main (max-width: 640px) {
      .kpis {
        grid-template-columns: minmax(0, 1fr);
      }
      .members-card,
      .seats-card {
        padding: 16px;
      }
    }
    @media (max-width: 860px) {
      .members-head {
        align-items: stretch;
      }
      .member-search {
        width: 100%;
      }
      .table-wrap {
        overflow: visible;
      }
      .members-table thead {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .members-table tr.member-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 14px;
        padding: 14px 0;
        border-bottom: 1px solid var(--line);
      }
      .members-table tr.member-row td {
        display: block;
        height: auto;
        min-width: 0;
        padding: 0;
        border: 0;
      }
      .members-table tr.member-row td[data-label='Person'] {
        grid-column: 1 / -1;
      }
      .members-table tr.member-row td::before {
        display: block;
        margin-bottom: 5px;
        color: var(--muted);
        content: attr(data-label);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .members-table tr.member-row td[data-label='Person']::before {
        display: none;
      }
      .members-table tbody {
        display: block;
      }
    }
  `,
})
export class SettingsTeam {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly store = inject(Store);

  protected readonly count = fmtCount;
  protected readonly role = signal<RoleFilter>('all');
  protected readonly searchInput = signal('');
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private entranceContext?: gsap.Context;
  private filterContext?: gsap.Context;
  private entrancePlayed = false;

  protected readonly billing = computed(() => this.store.settings().billing);
  protected readonly meId = computed(() => this.store.settings().me.id);

  protected readonly rows = computed(() =>
    this.store.team().map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      title: member.title,
      role: member.role,
      roleLabel: ROLE_LABELS[member.role],
      status: member.status.charAt(0).toUpperCase() + member.status.slice(1),
      statusTone: teamStatusTone(member.status),
      location: member.locId ? this.store.location(member.locId)?.name : undefined,
      isMe: member.id === this.meId(),
      initials: member.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join(''),
      avatarTone: avatarToneForId(member.id),
    })),
  );

  protected readonly roleFilters = computed(() => teamRoleCounts(this.rows()));
  protected readonly visible = computed(() =>
    filterTeamMembers(this.rows(), this.role(), this.searchQuery()),
  );
  protected readonly sites = computed(
    () => new Set(this.rows().flatMap((member) => (member.location ? [member.location] : []))).size,
  );
  protected readonly hasLocations = computed(() => this.rows().some((member) => !!member.location));
  protected readonly seatUsage = computed(() =>
    calculateSeatUsage(this.rows().length, this.billing().seats),
  );

  constructor() {
    afterNextRender(() => this.playEntrance(), { injector: this.injector });
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.entranceContext?.revert();
      this.filterContext?.revert();
    });
  }

  protected roleCount(role: TeamRole): number {
    return this.rows().filter((member) => member.role === role).length;
  }

  protected setRole(role: RoleFilter): void {
    if (this.role() === role) return;
    this.role.set(role);
    this.fadeFilteredRows();
  }

  protected setSearch(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchQuery.set(value);
      this.fadeFilteredRows();
    }, 180);
  }

  protected clearFilters(): void {
    this.searchInput.set('');
    this.searchQuery.set('');
    this.role.set('all');
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    this.fadeFilteredRows();
  }

  private playEntrance(): void {
    if (!this.isBrowser || this.entrancePlayed) return;
    this.entrancePlayed = true;

    this.zone.runOutsideAngular(() => {
      const root = this.host.nativeElement;
      this.entranceContext = gsap.context(() => {
        const select = gsap.utils.selector(root);
        const meter = root.querySelector<HTMLElement>('.seat-meter__fill');
        const progress = Number(meter?.dataset['progress'] ?? 0);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          gsap.set(select('.seat-meter__fill'), { scaleX: progress });
          return;
        }

        const rows = Array.from(root.querySelectorAll('.member-row')).slice(0, 20);
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        timeline
          .from(select('.head'), { y: 12, opacity: 0, duration: 0.45 })
          .from(select('.kpi'), { y: 12, opacity: 0, duration: 0.42, stagger: 0.05 }, '-=0.2')
          .from(select('.members-card'), { y: 12, opacity: 0, duration: 0.45 }, '-=0.16')
          .from(rows, { y: 12, opacity: 0, duration: 0.35, stagger: 0.03 }, '-=0.18')
          .from(select('.seats-card'), { y: 12, opacity: 0, duration: 0.42 }, '-=0.12')
          .to(select('.seat-meter__fill'), { scaleX: progress, duration: 0.45 }, '-=0.16');
      }, root);
    });
  }

  private fadeFilteredRows(): void {
    if (!this.isBrowser || !this.entrancePlayed) return;

    this.zone.runOutsideAngular(() => {
      afterNextRender(
        () => {
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          const rows = Array.from(this.host.nativeElement.querySelectorAll('.member-row'));
          if (!rows.length) return;
          this.filterContext?.revert();
          this.filterContext = gsap.context(() => {
            gsap.fromTo(
              rows,
              { opacity: 0 },
              { opacity: 1, duration: 0.15, stagger: 0.008, clearProps: 'opacity' },
            );
          }, this.host.nativeElement);
        },
        { injector: this.injector },
      );
    });
  }
}
