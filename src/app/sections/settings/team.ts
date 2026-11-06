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
import { gsap } from 'gsap';
import { AuthService } from '../../core/auth.service';
import { Store } from '../../core/store';
import { count as fmtCount } from '../../core/format';
import { TeamRole } from '../../core/models';
import { ToastService } from '../../core/toast';
import { ApiRoleMatrixRow, ApiRolePermission, UsersApiService } from '../../core/users-api.service';
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
  permissions?: Array<{ module: string; accessLevel: string }>;
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
const ACCESS_LEVELS = ['none', 'own', 'view', 'approve', 'full'] as const;
type AccessLevel = (typeof ACCESS_LEVELS)[number];
const PERMISSION_MODULE_ORDER = [
  'manufacturing', 'raw_materials', 'catalogue', 'inventory', 'retail_orders',
  'wholesale_orders', 'custom_orders', 'payments', 'returns', 'accounting',
  'logistics', 'marketing', 'analytics', 'partners', 'staff_access',
  'approvals_audit', 'communication',
];
const PERMISSION_ROLE_LABELS: Record<string, string> = {
  business_owner_admin: 'Owner',
  management: 'Manager',
  sales: 'Sales',
  inventory: 'Inventory',
  production: 'Production',
  finance_accounting: 'Finance',
  logistics: 'Logistics',
  marketing: 'Marketing',
  partner_investor: 'Partner',
  wholesaler: 'Wholesale',
  customer: 'Customer',
};
const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'No access',
  own: 'Own records',
  view: 'View only',
  approve: 'Can approve',
  full: 'Full access',
};

function permissionRoleLabel(role: string): string {
  return PERMISSION_ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
}

function permissionErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const message = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

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

export function teamStatusCounts(rows: readonly TeamMemberRow[]): { active: number; pending: number } {
  return {
    active: rows.filter((member) => member.status.toLowerCase() === 'active').length,
    pending: rows.filter((member) => ['invited', 'pending'].includes(member.status.toLowerCase())).length,
  };
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
  imports: [Icon],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Team access and membership</span>
        <h1 class="head__title">Team &amp; roles</h1>
        <p class="head__sub">Who works in Vessa and what they can do</p>
      </div>
    </div>

    <section class="kpis" aria-label="Team summary">
      <article class="card kpi">
        <span class="kpi__icon"><app-icon name="users" [size]="18" /></span>
        <span class="stat__label">Members</span>
        <span class="kpi__value">{{ count(rows().length) }}</span>
      </article>
      <article class="card kpi">
        <span class="kpi__icon kpi__icon--good"><app-icon name="check" [size]="18" /></span>
        <span class="stat__label">Active members</span>
        <span class="kpi__value">{{ count(statusCounts().active) }}</span>
      </article>
      <article class="card kpi">
        <span class="kpi__icon kpi__icon--info"><app-icon name="mail" [size]="18" /></span>
        <span class="stat__label">Pending invites</span>
        <span class="kpi__value">{{ count(statusCounts().pending) }}</span>
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
                <td data-label="Role">
                  <select
                    class="role-select"
                    [value]="member.role"
                    [attr.aria-label]="'Change role for ' + member.name"
                    (change)="setMemberRole(member.id, $any($event.target).value)"
                  >
                    @for (item of teamRoleOptions; track item.id) {
                      <option [value]="item.id">{{ item.label }}</option>
                    }
                  </select>
                </td>
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

    <div class="team-details team-details--permissions">
      <article class="card permissions-card" aria-labelledby="permissions-heading">
        <div class="card__head">
          <div>
            <h2 class="card__title" id="permissions-heading">What each role can do</h2>
            <p class="card__sub">Role access levels from the API · changes stay in draft until saved</p>
          </div>
        </div>
        @if (permissionMatrixError()) {
          <div class="permission-error" role="alert">
            <span>{{ permissionMatrixError() }}</span>
            <button type="button" class="btn btn--ghost" (click)="loadPermissionMatrix()">Retry</button>
          </div>
        } @else if (permissionMatrixLoading()) {
          <p class="permission-loading" aria-busy="true">Loading role permissions…</p>
        } @else if (permissionMatrix().length === 0) {
          <p class="permission-loading">No role permissions were returned by the API.</p>
        } @else {
          <form class="permission-form" (submit)="requestPermissionSave($event)">
            <div class="permission-table-wrap">
              <table class="permission-table">
                <caption>Access levels by module and role</caption>
                <thead>
                  <tr>
                    <th scope="col">Permission</th>
                    @for (role of permissionMatrix(); track role.id) {
                      <th scope="col">
                        {{ permissionRoleLabel(role.name) }}
                        <small>{{ count(permissionRoleCount(role.name)) }}</small>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (module of permissionModules(); track module) {
                    <tr>
                      <th scope="row" [id]="'permission-module-' + module">
                        {{ permissionRoleLabel(module) }}
                      </th>
                      @for (role of permissionMatrix(); track role.id) {
                        <td>
                          <div class="permission-cell">
                            <input
                              class="permission-toggle"
                              type="checkbox"
                              [name]="'access-' + role.name + '-' + module"
                              [attr.aria-label]="permissionRoleLabel(module) + ' access for ' + permissionRoleLabel(role.name)"
                              [attr.aria-describedby]="module === 'staff_access' ? 'staff-access-hint' : null"
                              [checked]="permissionLevel(role.name, module) !== 'none'"
                              [disabled]="!canManagePermissions() || module === 'staff_access' || savingPermissions()"
                              (change)="setAccess(module, role.name, $any($event.target).checked)"
                            />
                            <select
                              class="permission-level"
                              [name]="'level-' + role.name + '-' + module"
                              [attr.aria-label]="permissionRoleLabel(module) + ' access level for ' + permissionRoleLabel(role.name)"
                              [disabled]="!canManagePermissions() || permissionLevel(role.name, module) === 'none' || savingPermissions()"
                              [value]="permissionLevel(role.name, module)"
                              (change)="setLevel(module, role.name, $any($event.target).value)"
                            >
                              @for (level of accessLevels; track level) {
                                <option [value]="level" [disabled]="module === 'staff_access' && level === 'none'">
                                  {{ accessLevelLabels[level] }}
                                </option>
                              }
                            </select>
                          </div>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="hint" id="staff-access-hint">
              Staff access stays enabled to prevent locking administrators out.
            </p>
            @if (canManagePermissions()) {
              <div class="permission-actions">
                <button
                  type="submit"
                  class="btn btn--primary"
                  [disabled]="!permissionDraftDirty() || savingPermissions()"
                >
                  {{ savingPermissions() ? 'Saving…' : 'Save permissions' }}
                </button>
              </div>
            } @else {
              <p class="hint">You need full staff-access permission to change role access.</p>
            }
          </form>
        }
      </article>

      @if (seatUsage(); as seats) {
        <article class="card seats-card" aria-labelledby="seats-heading">
          <div class="card__head">
            <div>
              <h2 class="card__title" id="seats-heading">Seats</h2>
              <p class="card__sub">{{ billing().plan }} plan · up to {{ count(seats.limit) }} seats</p>
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
            <p class="hint">Seat use is based on the team members returned by the API.</p>
          </div>
        </article>
      }
    </div>

    @if (permissionConfirmationOpen()) {
      <div class="permission-confirmation-backdrop" (click)="cancelPermissionSave()">
        <section
          class="permission-confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="permission-confirm-title"
          (click)="$event.stopPropagation()"
        >
          <h2 id="permission-confirm-title">Save role permission changes?</h2>
          <p>
            These access levels apply to everyone assigned to the changed roles on their next
            request. The updates are written to the audit log.
          </p>
          <ul class="permission-confirmation__roles">
            @for (role of dirtyPermissionRoles(); track role.id) {
              <li>{{ permissionRoleLabel(role.name) }}</li>
            }
          </ul>
          <div class="permission-confirmation__actions">
            <button type="button" class="btn btn--ghost" (click)="cancelPermissionSave()">Cancel</button>
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="savingPermissions()"
              (click)="confirmPermissionSave()"
            >
              {{ savingPermissions() ? 'Saving…' : 'Save permissions' }}
            </button>
          </div>
        </section>
      </div>
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
  private readonly usersApi = inject(UsersApiService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly permissionMatrix = signal<ApiRoleMatrixRow[]>([]);
  protected readonly permissionMatrixLoading = signal(true);
  protected readonly permissionMatrixError = signal('');
  protected readonly edit = signal<Record<string, Record<string, AccessLevel>>>({});
  protected readonly lastEnabledLevel = signal<Record<string, Record<string, AccessLevel>>>({});
  protected readonly savingPermissions = signal(false);
  protected readonly permissionConfirmationOpen = signal(false);
  protected readonly accessLevels = ACCESS_LEVELS;
  protected readonly accessLevelLabels = ACCESS_LEVEL_LABELS;
  protected readonly permissionRoleLabel = permissionRoleLabel;

  protected readonly count = fmtCount;
  protected readonly teamRoleOptions = ROLE_ORDER.map((id) => ({ id, label: ROLE_LABELS[id] }));
  protected readonly role = signal<RoleFilter>('all');
  protected readonly searchInput = signal('');
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private entranceContext?: gsap.Context;
  private filterContext?: gsap.Context;
  private entrancePlayed = false;

  protected readonly canManagePermissions = computed(
    () => this.auth.user()?.access['staff_access'] === 'full',
  );
  protected readonly billing = computed(() => this.store.settings().billing);
  protected readonly meId = computed(() => this.store.settings().me.id);

  protected readonly rows = computed(() =>
    this.store.team().map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      title: member.title,
      role: member.role,
      apiRoleName: member.apiRoleName,
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
      permissions: member.permissions,
    })),
  );

  protected readonly roleFilters = computed(() => teamRoleCounts(this.rows()));
  protected readonly statusCounts = computed(() => teamStatusCounts(this.rows()));
  protected readonly permissionModules = computed(() => {
    const modules = new Set(
      this.permissionMatrix().flatMap((role) => role.permissions.map((permission) => permission.module)),
    );
    modules.add('staff_access');
    const ordered = PERMISSION_MODULE_ORDER.filter((module) => modules.delete(module));
    return [...ordered, ...[...modules].sort((a, b) => a.localeCompare(b))];
  });
  protected readonly dirtyPermissionRoles = computed(() =>
    this.permissionMatrix().filter((role) => {
      const saved = new Map(role.permissions.map((permission) => [permission.module, permission.accessLevel]));
      if (!saved.has('staff_access')) saved.set('staff_access', 'view');
      const draft = this.edit()[role.name] ?? {};
      const modules = new Set([...saved.keys(), ...Object.keys(draft)]);
      return [...modules].some((module) => (draft[module] ?? 'none') !== (saved.get(module) ?? 'none'));
    }),
  );
  protected readonly permissionDraftDirty = computed(() => this.dirtyPermissionRoles().length > 0);
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
    void this.loadPermissionMatrix();
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

  protected async loadPermissionMatrix(): Promise<void> {
    this.permissionMatrixLoading.set(true);
    this.permissionMatrixError.set('');
    try {
      const roles = await this.usersApi.rolesMatrix();
      this.permissionMatrix.set(roles);
      this.permissionMatrixLoading.set(false);
      const drafts: Record<string, Record<string, AccessLevel>> = {};
      const previousLevels: Record<string, Record<string, AccessLevel>> = {};
      for (const role of roles) {
        const levels: Record<string, AccessLevel> = {};
        for (const permission of role.permissions) {
          levels[permission.module] = ACCESS_LEVELS.includes(permission.accessLevel as AccessLevel)
            ? (permission.accessLevel as AccessLevel)
            : 'none';
        }
        if (!levels['staff_access']) levels['staff_access'] = 'view';
        drafts[role.name] = levels;
        previousLevels[role.name] = Object.fromEntries(
          Object.entries(levels).filter(([, level]) => level !== 'none'),
        );
      }
      this.edit.set(drafts);
      this.lastEnabledLevel.set(previousLevels);
    } catch (error) {
      this.permissionMatrixLoading.set(false);
      this.permissionMatrixError.set(
        permissionErrorMessage(error, 'Role permissions could not be loaded.'),
      );
    }
  }

  protected permissionLevel(roleName: string, module: string): AccessLevel {
    return this.edit()[roleName]?.[module] ?? 'none';
  }

  protected permissionRoleCount(roleName: string): number {
    return this.rows().filter((member) => member.apiRoleName === roleName).length;
  }

  protected setLevel(module: string, roleName: string, level: string): void {
    if (!ACCESS_LEVELS.includes(level as AccessLevel)) return;
    if (module === 'staff_access' && level === 'none') return;
    this.edit.update((draft) => ({
      ...draft,
      [roleName]: { ...draft[roleName], [module]: level as AccessLevel },
    }));
    if (level !== 'none') {
      this.lastEnabledLevel.update((roles) => ({
        ...roles,
        [roleName]: { ...roles[roleName], [module]: level as AccessLevel },
      }));
    }
  }

  protected setAccess(module: string, roleName: string, enabled: boolean): void {
    if (module === 'staff_access' && !enabled) return;
    const current = this.permissionLevel(roleName, module);
    if (!enabled) {
      if (current !== 'none') {
        this.lastEnabledLevel.update((roles) => ({
          ...roles,
          [roleName]: { ...roles[roleName], [module]: current },
        }));
      }
      this.edit.update((draft) => ({
        ...draft,
        [roleName]: { ...draft[roleName], [module]: 'none' },
      }));
      return;
    }
    const previous = this.lastEnabledLevel()[roleName]?.[module];
    this.edit.update((draft) => ({
      ...draft,
      [roleName]: { ...draft[roleName], [module]: current !== 'none' ? current : previous ?? 'view' },
    }));
  }

  protected requestPermissionSave(event: Event): void {
    event.preventDefault();
    if (!this.canManagePermissions() || !this.permissionDraftDirty() || this.savingPermissions()) return;
    this.permissionConfirmationOpen.set(true);
  }

  protected cancelPermissionSave(): void {
    if (!this.savingPermissions()) this.permissionConfirmationOpen.set(false);
  }

  protected async confirmPermissionSave(): Promise<void> {
    const roles = this.dirtyPermissionRoles();
    if (!roles.length || !this.canManagePermissions() || this.savingPermissions()) return;
    this.permissionConfirmationOpen.set(false);
    this.savingPermissions.set(true);
    try {
      for (const role of roles) {
        const permissions: ApiRolePermission[] = Object.entries(this.edit()[role.name] ?? {}).map(
          ([module, accessLevel]) => ({ module, accessLevel }),
        );
        await this.usersApi.updateRolePermissions(role.name, permissions);
        this.permissionMatrix.update((current) =>
          current.map((item) => (item.name === role.name ? { ...item, permissions } : item)),
        );
      }
      this.toasts.show(
        `Permissions saved for ${roles.map((role) => permissionRoleLabel(role.name).toLowerCase()).join(', ')}`,
        'good',
      );
    } catch (error) {
      this.toasts.show(permissionErrorMessage(error, 'Permissions could not be saved.'), 'bad');
    } finally {
      this.savingPermissions.set(false);
    }
  }

  protected setMemberRole(id: string, value: string): void {
    if (ROLE_ORDER.includes(value as TeamRole)) {
      this.store.setTeammateRole(id, value as TeamRole);
    }
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
