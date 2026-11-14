import { isPlatformBrowser } from '@angular/common';
import { Spinner } from '../../ui/spinner';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { gsap } from 'gsap';
import { Store } from '../../core/store';
import { AuthService } from '../../core/auth.service';
import { UsersApiService } from '../../core/users-api.service';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';
import { SdSlidingIndicator } from '../../ui/sliding-indicator';
import {
  HIGH_IMPACT_MODULES,
  PERMISSION_GROUPS,
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  PermissionGroupId,
  PermissionModuleConfig,
  PermissionRoleConfig,
  humanizePermissionKey,
} from './staff-permissions.config';
import {
  PermissionChange,
  RolePermissionsSnapshot,
  draftForRole,
  permissionChanges,
  permissionSet,
  roleHasChanges,
} from './staff-permissions.state';

type EditorView = 'edit' | 'compare';
type PermissionGroup = {
  id: PermissionGroupId;
  label: string;
  modules: string[];
};
type RoleChanges = {
  role: RolePermissionsSnapshot;
  label: string;
  changes: PermissionChange[];
};

const STAFF_ROLE_ORDER = [
  'business_owner_admin',
  'management',
  'sales',
  'inventory',
  'production',
  'finance_accounting',
];
const EXTERNAL_ROLE_ORDER = ['partner_investor', 'wholesaler', 'customer'];
const LEVEL_MARKS: Record<string, string> = {
  none: '–',
  own: 'O',
  view: 'V',
  approve: 'A',
  full: 'F',
};
const LEVEL_SHORT: Record<string, string> = {
  none: 'None',
  own: 'Own',
  view: 'View',
  approve: 'Approve',
  full: 'Full',
};
const LEVEL_MEANINGS: Record<string, string> = {
  none: 'cannot see it',
  own: 'only their own records',
  view: 'can look, not change',
  approve: 'view and approve requests',
  full: 'view, create, change, delete',
};

function roleConfig(role: string): PermissionRoleConfig {
  return (
    PERMISSION_ROLES[role] ?? {
      label: humanizePermissionKey(role),
      initials:
        role
          .split('_')
          .map((part) => part[0] ?? '')
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?',
      description: 'Role returned by the permissions API.',
      group: 'external',
      readOnly: true,
    }
  );
}

function moduleConfig(module: string): PermissionModuleConfig | null {
  return PERMISSION_MODULES[module] ?? null;
}

function serverMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const body = (error as { error?: { message?: unknown } }).error;
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message) && body?.message.every((item) => typeof item === 'string')) {
      return (body.message as string[]).join(' ');
    }
  }
  return 'The permission change could not be saved.';
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

@Component({
  selector: 'app-staff-permissions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, SdSlidingIndicator, Spinner],
  template: `
    <section class="sd-permissions" aria-labelledby="sd-permissions-title">
      <header class="sd-head">
        <div class="sd-head__copy">
          <h2 id="sd-permissions-title">What each role can do</h2>
          <p>
            Pick a role to change what it can do. Changes stay in draft until you review and save,
            and apply to everyone in that role.
          </p>
        </div>
        <div class="sd-segment" role="group" aria-label="Permission views" sdSlidingIndicator itemSelector=".sd-segment__btn" activeClass="is-on" bg="var(--ochre)" radius="var(--sd-r-pill)">
          <button type="button" class="sd-segment__btn" [class.is-on]="view() === 'edit'" [attr.aria-pressed]="view() === 'edit'" (click)="setView('edit')">
            Edit a role
          </button>
          <button type="button" class="sd-segment__btn" [class.is-on]="view() === 'compare'" [attr.aria-pressed]="view() === 'compare'" (click)="setView('compare')">
            Compare roles
          </button>
        </div>
      </header>

      @if (!canView()) {
        <div class="sd-banner sd-banner--danger" role="alert">
          <strong>Team access is restricted</strong>
          <span>Your role does not have view access to staff settings.</span>
        </div>
      } @else if (loading()) {
        <div class="sd-loading" aria-busy="true" aria-live="polite">
          <app-spinner size="sm" label="Loading roles" />
        </div>
      } @else if (loadError()) {
        <div class="sd-banner sd-banner--danger" role="alert">
          <strong>Roles could not be loaded</strong>
          <span>{{ loadError() }}</span>
          <button type="button" class="btn btn--ghost sd-banner__action" (click)="loadRoles()">Retry</button>
        </div>
      } @else {
        @if (unknownRoles().length || unknownModules().length) {
          <p class="sd-mapping-note" role="status">
            Unmapped API permissions are shown with humanized names:
            @if (unknownRoles().length) { <span>{{ unknownRoles().join(', ') }}</span> }
            @if (unknownModules().length) { <span>{{ unknownModules().join(', ') }}</span> }
          </p>
        }
        @if (refreshNotice()) {
          <div class="sd-banner sd-banner--info" role="status">
            <span>Roles may have changed. Reload when you are ready.</span>
            <button type="button" class="btn btn--ghost sd-banner__action" (click)="reloadRoles()">Reload roles</button>
          </div>
        }

        <div class="sd-layout" [class.sd-layout--compare]="view() === 'compare'">
          <aside class="sd-role-list" aria-label="Roles">
            <section class="sd-role-group" aria-labelledby="sd-staff-roles-heading">
              <h3 id="sd-staff-roles-heading">Staff roles</h3>
              @for (role of staffRoles(); track role.name) {
                <button
                  type="button"
                  class="sd-role-item"
                  [class.sd-role-item--current]="role.name === selectedRole()"
                  [attr.aria-current]="role.name === selectedRole() ? 'true' : null"
                  (click)="selectRole(role.name)"
                >
                  <span class="sd-avatar" aria-hidden="true">{{ roleConfig(role.name).initials }}</span>
                  <span class="sd-role-item__copy">
                    <strong>{{ roleConfig(role.name).label }}</strong>
                    @if (role.memberCount !== undefined) {
                      <span class="sd-role-item__count">{{ role.memberCount }} {{ role.memberCount === 1 ? 'person' : 'people' }}</span>
                    }
                  </span>
                  @if (roleConfig(role.name).readOnly) {
                    <app-icon name="lock" [size]="14" aria-hidden="true" />
                  }
                  @if (changesForRole(role.name).length > 0) {
                    <span class="sd-dirty-count" [attr.aria-label]="changesForRole(role.name).length + ' unsaved changes'">{{ changesForRole(role.name).length }}</span>
                  }
                </button>
              }
            </section>
            <section class="sd-role-group" aria-labelledby="sd-external-roles-heading">
              <h3 id="sd-external-roles-heading">External roles</h3>
              @for (role of externalRoles(); track role.name) {
                <button
                  type="button"
                  class="sd-role-item"
                  [class.sd-role-item--current]="role.name === selectedRole()"
                  [attr.aria-current]="role.name === selectedRole() ? 'true' : null"
                  (click)="selectRole(role.name)"
                >
                  <span class="sd-avatar" aria-hidden="true">{{ roleConfig(role.name).initials }}</span>
                  <span class="sd-role-item__copy">
                    <strong>{{ roleConfig(role.name).label }}</strong>
                    @if (role.memberCount !== undefined) {
                      <span class="sd-role-item__count">{{ role.memberCount }} {{ role.memberCount === 1 ? 'person' : 'people' }}</span>
                    }
                  </span>
                  <app-icon name="lock" [size]="14" aria-hidden="true" />
                  @if (changesForRole(role.name).length > 0) {
                    <span class="sd-dirty-count" [attr.aria-label]="changesForRole(role.name).length + ' unsaved changes'">{{ changesForRole(role.name).length }}</span>
                  }
                </button>
              }
            </section>
          </aside>

          <div class="sd-panel" #panel>
            @if (view() === 'edit' && selectedRoleRow(); as role) {
              <header class="sd-role-header">
                <span class="sd-avatar sd-avatar--lg" aria-hidden="true">{{ roleConfig(role.name).initials }}</span>
                <div class="sd-role-header__copy">
                  <h3>{{ roleConfig(role.name).label }}</h3>
                  <p class="sd-role-desc">{{ roleConfig(role.name).description }}</p>
                  <div class="sd-role-meta">
                    @if (role.memberCount !== undefined) {
                      <span>{{ role.memberCount }} {{ role.memberCount === 1 ? 'person' : 'people' }}</span>
                    }
                    <span>access to {{ areasWithAccess(role.name) }} of {{ modules().length }} areas</span>
                  </div>
                </div>
              </header>

              @if (isReadOnly(role.name)) {
                <div class="sd-banner sd-banner--warn" role="status">
                  @if (role.name === 'business_owner_admin') {
                    The business owner role cannot be edited, so you can never lock yourself out.
                  } @else if (!canManage()) {
                    You have view-only access to team settings.
                  } @else {
                    This role is managed by the system and is read-only here.
                  }
                </div>
              }

              <label class="search sd-search">
                <span class="sd-sr-only">Search permission areas</span>
                <app-icon name="search" [size]="16" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search areas, for example orders or stock"
                  [value]="query()"
                  (input)="query.set($any($event.target).value)"
                />
              </label>

              <div class="sd-legend" aria-label="Access level legend">
                @for (level of levelsForLegend(); track level) {
                  <span class="sd-legend__item">
                    <span class="sd-level-mark" [attr.data-level]="level" aria-hidden="true">{{ LEVEL_MARKS[level] }}</span>
                    <strong>{{ levelShort(level) }}</strong>
                    <span class="sd-legend__meaning">{{ LEVEL_MEANINGS[level] }}</span>
                  </span>
                }
              </div>

              @for (group of groupedModules(); track group.id) {
                <section class="sd-module-group" [attr.aria-labelledby]="'sd-group-' + group.id">
                  <div class="sd-group-head">
                    <h4 [id]="'sd-group-' + group.id">{{ group.label }}</h4>
                    @if (!isReadOnly(role.name) && group.modules.length > 0) {
                      <label class="sd-set-all">
                        <span class="sd-sr-only">Set all visible {{ group.label }} areas to</span>
                        <select [value]="''" (change)="setGroupAccess(group, $any($event.target).value)">
                          <option value="" disabled selected>Set all to…</option>
                          <option value="none">No access</option>
                          <option value="view">View only</option>
                        </select>
                      </label>
                    }
                  </div>
                  @for (module of group.modules; track module) {
                    @let config = moduleConfig(module);
                    <article
                      class="sd-area"
                      [class.sd-area--changed]="isChanged(role.name, module)"
                      [class.sd-area--high-impact]="isHighImpact(role.name, module)"
                      [attr.data-module]="module"
                    >
                      <div class="sd-area__copy">
                        <h5>{{ moduleLabel(module) }}</h5>
                        <p class="sd-area__desc">{{ config?.description ?? 'Additional permission area returned by the API.' }}</p>
                        <div class="sd-area__tags">
                          @if (isChanged(role.name, module)) {
                            <span class="sd-was">Was {{ levelShort(savedLevel(role.name, module)) }}</span>
                            <button type="button" class="sd-undo" (click)="undoModule(role.name, module)">Undo</button>
                          }
                          @if (isHighImpact(role.name, module)) {
                            <span class="sd-impact">High impact: can change money, people or approvals</span>
                          }
                        </div>
                      </div>
                      <div
                        class="sd-levels"
                        role="radiogroup"
                        [attr.aria-label]="moduleLabel(module) + ' access for ' + roleConfig(role.name).label"
                        (keydown)="onLevelKeydown($event, role.name, module)"
                      >
                        @for (level of levels(); track level) {
                          <button
                            type="button"
                            role="radio"
                            class="sd-level"
                            [class.sd-level--on]="draftLevel(role.name, module) === level"
                            [class.sd-level--off]="!levelSupported(module, level)"
                            [attr.aria-checked]="draftLevel(role.name, module) === level"
                            [attr.aria-disabled]="isReadOnly(role.name) || !levelSupported(module, level)"
                            [attr.title]="levelSupported(module, level) ? null : 'Not used for this area'"
                            [attr.tabindex]="tabIndexFor(role.name, module, level)"
                            (click)="chooseLevel(role.name, module, level)"
                          >
                            {{ levelShort(level) }}
                          </button>
                        }
                      </div>
                    </article>
                  }
                </section>
              }
            } @else if (view() === 'compare') {
              <div class="sd-compare-wrap" aria-label="Role comparison table">
                <table class="sd-compare">
                  <caption class="sd-sr-only">Compare permission levels for every role. Select a role name or a cell to edit.</caption>
                  <thead>
                    <tr>
                      <th scope="col" class="sd-compare__area-head">Area</th>
                      @for (role of orderedRoles(); track role.name) {
                        <th scope="col">
                          <button type="button" class="sd-compare__role" (click)="editRoleAt(role.name)">{{ roleConfig(role.name).label }}</button>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (group of groupedModules(); track group.id) {
                      <tr class="sd-compare__group">
                        <th scope="row" [attr.colspan]="orderedRoles().length + 1">{{ group.label }}</th>
                      </tr>
                      @for (module of group.modules; track module) {
                        <tr [attr.data-module]="module">
                          <th scope="row" class="sd-compare__area-head">{{ moduleLabel(module) }}<span class="sd-compare__sub">{{ moduleConfig(module)?.description }}</span></th>
                          @for (role of orderedRoles(); track role.name) {
                            <td>
                              <button
                                type="button"
                                class="sd-compare-cell"
                                [attr.aria-label]="compareCellLabel(role.name, module)"
                                (click)="editRoleAt(role.name, module)"
                              >
                                <span class="sd-level-mark" [attr.data-level]="draftLevel(role.name, module)" aria-hidden="true">{{ LEVEL_MARKS[draftLevel(role.name, module)] }}</span>
                                <span class="sd-compare-cell__label">{{ levelShort(draftLevel(role.name, module)) }}</span>
                                @if (isChanged(role.name, module)) { <span class="sd-unsaved-dot" aria-label="unsaved change"></span> }
                              </button>
                            </td>
                          }
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }

      @if (totalChanges() > 0) {
        <aside class="sd-save-bar" aria-live="polite" #saveBar>
          @if (discardPrompt()) {
            <span class="sd-save-bar__text">Discard {{ totalChanges() }} unsaved changes?</span>
            <button type="button" class="sd-text-btn" (click)="discardPrompt.set(false)">Keep editing</button>
            <button type="button" class="sd-text-btn" (click)="discardAll()">Discard</button>
          } @else {
            <span class="sd-save-bar__text">{{ totalChanges() }} unsaved changes in {{ dirtyRoleLabels() }}</span>
            <button type="button" class="sd-text-btn" (click)="discard()">Discard</button>
            <button #reviewButton class="sd-save-bar__primary" type="button" [disabled]="!canManage() || saving()" (click)="requestReview()">Review changes</button>
          }
        </aside>
      }

      <dialog #reviewDialog class="sd-review" (click)="onDialogClick($event)" (close)="onReviewClosed()">
        <div class="sd-review__body">
          <h3 id="sd-review-title">Review changes</h3>
          <p class="sd-review__note">These apply to everyone in the role as soon as you save.</p>
          @for (group of reviewChanges(); track group.role.name) {
            <section class="sd-review__role">
              <h4>{{ group.label }}{{ group.role.memberCount === undefined ? ', everyone in this role' : ', affects ' + group.role.memberCount + ' people' }}</h4>
              @for (change of group.changes; track change.module) {
                <div class="sd-review__change" [class.sd-review__change--impact]="isHighImpact(group.role.name, change.module)">
                  <strong>{{ moduleLabel(change.module) }}</strong>
                  <span class="sd-level-mark" [attr.data-level]="change.before" aria-hidden="true">{{ LEVEL_MARKS[change.before] }}</span>
                  <span class="sd-review__level">{{ levelShort(change.before) }}</span>
                  <span aria-hidden="true" class="sd-review__arrow">→</span>
                  <span class="sd-level-mark" [attr.data-level]="change.after" aria-hidden="true">{{ LEVEL_MARKS[change.after] }}</span>
                  <span class="sd-review__level">{{ levelShort(change.after) }}</span>
                </div>
              }
            </section>
          }
          @if (highImpactCount() > 0) {
            <p class="sd-impact-summary">{{ highImpactCount() }} high-impact {{ highImpactCount() === 1 ? 'change affects' : 'changes affect' }} money, people or approvals.</p>
          }
          <label class="sd-reason">
            <span class="sd-reason__label">Reason for the change (kept in the audit log)</span>
            <textarea rows="3" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" required aria-describedby="sd-reason-count"></textarea>
            <span id="sd-reason-count" class="sd-reason__count" aria-live="polite">{{ reason().trim().length }} / 300</span>
          </label>
          @if (saveProgress()) {
            <p class="sd-save-status" role="status">Saving {{ roleLabel(saveProgress()!) }}…</p>
          }
          @for (failure of saveErrors(); track failure.role) {
            <div class="sd-save-error" role="alert">
              <span><strong>{{ roleConfig(failure.role).label }}:</strong> {{ failure.message }}</span>
              @if (failure.conflict) {
                <button type="button" class="sd-text-btn" (click)="reloadRoles()">Reload</button>
              } @else {
                <button type="button" class="sd-text-btn" (click)="retrySave()">Retry</button>
              }
            </div>
          }
        </div>
        <div class="sd-review__actions">
          <button class="btn btn--ghost" type="button" (click)="closeReview()">Keep editing</button>
          <button class="btn btn--primary" type="button" [disabled]="!reasonValid() || saving()" (click)="saveChanges()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </dialog>
    </section>
  `,
  styles: `
    :host { display: block; }

    .sd-permissions { display: grid; gap: 18px; position: relative; container-type: inline-size; }
    .sd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
    .sd-head__copy h2 { font-size: var(--fs-2xl); font-weight: 750; letter-spacing: -0.02em; }
    .sd-head__copy p { margin-top: 4px; color: var(--muted); font-size: var(--fs-md); max-width: 560px; line-height: 1.45; }

    .sd-segment { display: inline-flex; gap: 2px; padding: 3px; background: var(--well); border-radius: 999px; border: 1px solid transparent; }
    .sd-segment__btn { position: relative; z-index: 1; border: 0; background: none; color: var(--muted); font: inherit; font-size: var(--fs-xs); font-weight: 700; padding: 8px 16px; border-radius: 999px; cursor: pointer; transition: color 0.25s var(--ease); white-space: nowrap; }
    .sd-segment__btn.is-on { color: var(--sd-indicator-ink); }

    .sd-banner { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; border-radius: var(--r-tile); font-size: var(--fs-sm); border: 1px solid; }
    .sd-banner strong { font-weight: 700; }
    .sd-banner--danger { background: color-mix(in srgb, var(--bad) 10%, var(--surface)); border-color: color-mix(in srgb, var(--bad) 30%, var(--line)); color: var(--text); }
    .sd-banner--warn { background: color-mix(in srgb, var(--warn) 12%, var(--surface)); border-color: color-mix(in srgb, var(--warn) 32%, var(--line)); }
    .sd-banner--info { background: var(--well); border-color: var(--line); }
    .sd-banner__action { font-size: var(--fs-xs); }

    .sd-loading { display: grid; gap: 10px; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); }
    .sd-skeleton { height: 56px; border-radius: var(--r-tile); background: linear-gradient(90deg, var(--well) 25%, color-mix(in srgb, var(--well) 40%, var(--surface)) 37%, var(--well) 63%); background-size: 400% 100%; animation: sd-shimmer 1.4s infinite; }
    @keyframes sd-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    .sd-mapping-note { font-size: var(--fs-xs); color: var(--faint); }

    .sd-layout { display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: 16px; align-items: start; }
    .sd-layout--compare { grid-template-columns: 1fr; }

    .sd-role-list { position: sticky; top: 76px; display: grid; gap: 16px; padding: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); max-height: calc(100vh - 96px); overflow-y: auto; }
    .sd-role-group { display: grid; gap: 4px; }
    .sd-role-group h3 { font-size: var(--fs-2xs); font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin: 4px 8px 6px; }
    .sd-role-item { display: flex; align-items: center; gap: 12px; width: 100%; border: 1px solid transparent; background: none; padding: 10px 12px; min-height: 52px; border-radius: var(--r-tile); cursor: pointer; color: var(--text); text-align: left; }
    .sd-role-group:not(:last-child) { padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .sd-role-item:hover { background: var(--well); }
    .sd-role-item--current { background: color-mix(in srgb, var(--ochre) 16%, transparent); border-color: color-mix(in srgb, var(--ochre) 40%, var(--line)); }
    .sd-role-item__copy { display: grid; gap: 1px; min-width: 0; flex: 1; }
    .sd-role-item__copy strong { font-size: var(--fs-sm); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sd-role-item__count { font-size: var(--fs-2xs); color: var(--muted); }
    .sd-avatar { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: color-mix(in srgb, var(--ochre) 20%, transparent); color: var(--text); font-size: var(--fs-2xs); font-weight: 800; letter-spacing: 0.06em; }
    .sd-avatar--lg { width: 56px; height: 56px; border-radius: 16px; font-size: var(--fs-md); }
    .sd-dirty-count { flex: none; min-width: 22px; height: 22px; padding: 0 6px; display: grid; place-items: center; border-radius: 999px; background: var(--ochre); color: var(--sd-indicator-ink); font-size: 11px; font-weight: 800; }

    .sd-panel { display: grid; gap: 16px; min-width: 0; }
    .sd-role-header { display: flex; align-items: center; gap: 16px; padding: 20px 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
    .sd-role-header h3 { font-size: var(--fs-xl); font-weight: 750; letter-spacing: -0.015em; }
    .sd-role-desc { color: var(--muted); font-size: var(--fs-sm); margin-top: 2px; }
    .sd-role-meta { display: flex; gap: 14px; margin-top: 8px; color: var(--faint); font-size: var(--fs-2xs); }
    .sd-role-meta span + span { padding-left: 14px; border-left: 1px solid var(--line); }

    .sd-search { max-width: 480px; }
    .sd-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 14px; background: var(--well); border-radius: var(--r-tile); font-size: var(--fs-2xs); color: var(--muted); }
    .sd-legend__item { display: inline-flex; align-items: center; gap: 6px; }
    .sd-legend__meaning { color: var(--faint); }

    .sd-module-group { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 16px 18px; display: grid; gap: 2px; }
    .sd-group-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
    .sd-group-head h4 { font-size: var(--fs-2xs); font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); }
    .sd-set-all select { height: 34px; font-size: var(--fs-xs); border: 1px solid var(--line); border-radius: var(--r-tile); background: var(--surface); color: var(--text); padding: 0 10px; }

    .sd-area { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 14px; align-items: center; padding: 12px 14px 12px 17px; border-radius: var(--r-tile); border-left: 3px solid transparent; }
    .sd-area + .sd-area { border-top: 1px solid var(--line); }
    .sd-area--changed { border-left-color: var(--ochre); background: color-mix(in srgb, var(--ochre) 8%, transparent); }
    .sd-area--high-impact.sd-area--changed { background: color-mix(in srgb, var(--ochre) 13%, transparent); }
    .sd-area h5 { font-size: var(--fs-md); font-weight: 700; letter-spacing: -0.01em; }
    .sd-area__desc { color: var(--muted); font-size: var(--fs-xs); margin-top: 2px; line-height: 1.45; }
    .sd-area__tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .sd-was { font-size: var(--fs-2xs); color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; background: var(--well); }
    .sd-undo { border: 0; background: none; color: var(--primary); font-size: var(--fs-2xs); font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 2px 4px; }
    .sd-impact { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-2xs); font-weight: 700; color: var(--bad); border: 1px solid color-mix(in srgb, var(--bad) 35%, transparent); background: color-mix(in srgb, var(--bad) 10%, transparent); border-radius: 999px; padding: 2px 9px; }

    .sd-levels { display: inline-flex; gap: 2px; padding: 3px; background: var(--well); border-radius: var(--sd-r-pill); justify-self: end; max-width: 100%; }
    .sd-level { border: 0; background: none; color: var(--muted); min-width: 44px; min-height: 40px; padding: 0 10px; border-radius: var(--sd-r-pill); font: inherit; font-size: var(--fs-2xs); font-weight: 700; cursor: pointer; transition: color 0.2s var(--ease), background 0.2s var(--ease); }
    .sd-level:hover { color: var(--text); }
    .sd-level--on { background: var(--ochre); color: var(--sd-indicator-ink); }
    .sd-level--off { color: var(--faint); cursor: not-allowed; }

    @container (max-width: 999px) {
      .sd-area { grid-template-columns: 1fr; gap: 8px; }
      .sd-area__tags { margin-top: 4px; }
      .sd-levels { justify-self: stretch; width: 100%; display: flex; }
      .sd-level { flex: 1; min-width: 0; }
    }

    .sd-compare-wrap { overflow: auto; max-height: calc(100vh - 140px); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: var(--shadow); }
    .sd-compare { width: 100%; min-width: 900px; border-collapse: collapse; font-size: var(--fs-xs); }
    .sd-compare thead th { position: sticky; top: 0; z-index: 2; background: var(--surface); text-align: left; font-size: var(--fs-2xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); padding: 12px 10px; border-bottom: 1px solid var(--line); }
    .sd-compare__area-head { position: sticky; left: 0; z-index: 1; background: var(--surface); text-align: left; padding: 10px; border-bottom: 1px solid var(--line); }
    .sd-compare thead .sd-compare__area-head { z-index: 3; }
    .sd-compare td { padding: 4px 6px; border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent); vertical-align: middle; }
    .sd-compare__role { border: 0; background: none; color: var(--primary); font: inherit; font-weight: 700; cursor: pointer; padding: 4px 2px; }
    .sd-compare__role:hover { text-decoration: underline; }
    .sd-compare__group th { background: var(--well); font-size: var(--fs-2xs); letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
    .sd-compare__sub { display: block; font-weight: 400; color: var(--faint); font-size: var(--fs-2xs); margin-top: 2px; max-width: 320px; }
    .sd-compare-cell { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; border: 1px solid transparent; background: none; border-radius: var(--r-tile); padding: 4px 8px; cursor: pointer; color: var(--text); font: inherit; font-size: var(--fs-2xs); }
    .sd-compare-cell:hover { background: var(--well); border-color: var(--line); }
    .sd-compare-cell__label { font-weight: 650; }
    .sd-unsaved-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ochre); margin-left: auto; flex: none; }

    .sd-level-mark { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--well); color: var(--muted); font-size: 12px; font-weight: 800; flex: none; }
    .sd-level-mark[data-level='none'] { color: var(--faint); }
    .sd-level-mark[data-level='own'] { color: var(--info); background: color-mix(in srgb, var(--info) 12%, transparent); }
    .sd-level-mark[data-level='view'] { color: var(--good); background: color-mix(in srgb, var(--good) 12%, transparent); }
    .sd-level-mark[data-level='approve'] { color: var(--warn); background: color-mix(in srgb, var(--warn) 14%, transparent); }
    .sd-level-mark[data-level='full'] { color: var(--ochre); background: color-mix(in srgb, var(--ochre) 16%, transparent); }

    .sd-save-bar { position: fixed; z-index: 40; left: 50%; transform: translateX(-50%); bottom: 18px; display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 18px; background: var(--sd-card); border: 1px solid var(--line-2); box-shadow: var(--shadow-lg); border-radius: 999px; font-size: var(--fs-sm); max-width: min(92vw, 720px); }
    .sd-save-bar__text { color: var(--text); font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sd-text-btn { border: 0; background: none; color: var(--muted); font: inherit; font-size: var(--fs-xs); font-weight: 700; cursor: pointer; padding: 6px 10px; border-radius: var(--r-tile); }
    .sd-text-btn:hover { color: var(--text); background: var(--well); }
    .sd-save-bar__primary { background: var(--ochre); color: var(--sd-indicator-ink); border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-size: var(--fs-xs); font-weight: 800; cursor: pointer; }
    .sd-save-bar__primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .sd-review { inset: 0; margin: auto; max-width: 720px; width: min(720px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); border: 0; border-radius: var(--r-card); background: var(--surface); box-shadow: var(--shadow-lg); padding: 0; overflow: hidden; }
    .sd-review::backdrop { background: rgb(0 0 0 / 0.45); backdrop-filter: blur(2px); }
    .sd-review__body { display: grid; gap: 14px; padding: 22px 24px; overflow-y: auto; max-height: calc(100dvh - 160px); }
    .sd-review__body h3 { font-size: var(--fs-xl); font-weight: 750; }
    .sd-review__note { color: var(--muted); font-size: var(--fs-sm); }
    .sd-review__role { display: grid; gap: 8px; padding-top: 4px; border-top: 1px solid var(--line); }
    .sd-review__role h4 { font-size: var(--fs-sm); font-weight: 750; margin-top: 10px; }
    .sd-review__change { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-tile); background: var(--well); font-size: var(--fs-xs); flex-wrap: wrap; }
    .sd-review__change strong { min-width: 0; flex: 1 1 auto; }
    .sd-review__change--impact { background: color-mix(in srgb, var(--ochre) 12%, transparent); border: 1px solid color-mix(in srgb, var(--ochre) 30%, transparent); }
    .sd-review__level { color: var(--muted); }
    .sd-review__arrow { color: var(--faint); }
    .sd-impact-summary { font-size: var(--fs-xs); color: var(--bad); font-weight: 650; }
    .sd-reason { display: grid; gap: 6px; }
    .sd-reason__label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .sd-reason textarea { width: 100%; min-height: 72px; resize: vertical; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-tile); background: var(--surface); color: var(--text); }
    .sd-reason textarea:focus-visible { outline: 2px solid var(--primary); }
    .sd-reason__count { font-size: var(--fs-2xs); color: var(--faint); justify-self: end; }
    .sd-save-status { color: var(--muted); font-size: var(--fs-xs); }
    .sd-save-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: var(--r-tile); border: 1px solid color-mix(in srgb, var(--bad) 35%, transparent); background: color-mix(in srgb, var(--bad) 8%, transparent); font-size: var(--fs-xs); }
    .sd-review__actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--line); background: var(--surface); }

    .sd-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 860px) {
      .sd-layout { grid-template-columns: 1fr; }
      .sd-role-list { position: static; display: flex; overflow-x: auto; gap: 8px; max-height: none; padding: 10px; scroll-snap-type: x mandatory; }
      .sd-role-group { border-bottom: 0; padding-bottom: 0; min-width: max-content; scroll-snap-align: start; }
      .sd-role-item { min-width: 180px; }
      .sd-save-bar { bottom: 10px; border-radius: var(--r-tile); padding: 8px 10px 8px 14px; gap: 10px; left: 10px; right: 10px; transform: none; max-width: none; }
      .sd-save-bar__text { white-space: normal; }
      .sd-review__body { padding: 18px; }
      .sd-legend { flex-direction: column; align-items: flex-start; }
      .sd-head { flex-direction: column; align-items: stretch; }
      .sd-segment { width: max-content; }
    }
  `,
})
export class StaffPermissionsComponent {
  private readonly api = inject(UsersApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private animationContext?: gsap.Context;
  private entrancePlayed = false;

  @ViewChild('reviewDialog') private reviewDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('reviewButton') private reviewButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('saveBar') private saveBar?: ElementRef<HTMLElement>;

  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly matrix = signal<RolePermissionsSnapshot[]>([]);
  protected readonly drafts = signal<Record<string, Record<string, string>>>({});
  protected readonly view = signal<EditorView>('edit');
  protected readonly selectedRole = signal('');
  protected readonly query = signal('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly saveProgress = signal('');
  protected readonly refreshNotice = signal(false);
  protected readonly discardPrompt = signal(false);
  protected readonly saveErrors = signal<Array<{ role: string; message: string; conflict: boolean }>>([]);

  protected readonly canView = computed(() => {
    const level = this.auth.user()?.access?.['staff_access'];
    return level === 'view' || level === 'approve' || level === 'full';
  });
  protected readonly canManage = computed(() => this.auth.user()?.access?.['staff_access'] === 'full');

  protected readonly orderedRoles = computed(() => {
    const order = [...STAFF_ROLE_ORDER, ...EXTERNAL_ROLE_ORDER];
    return [...this.matrix()].sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.name.localeCompare(b.name);
    });
  });
  protected readonly staffRoles = computed(() => this.orderedRoles().filter((role) => roleConfig(role.name).group === 'staff'));
  protected readonly externalRoles = computed(() => this.orderedRoles().filter((role) => roleConfig(role.name).group === 'external'));
  protected readonly selectedRoleRow = computed(() => this.matrix().find((role) => role.name === this.selectedRole()));
  protected readonly levels = computed(() => this.selectedRoleRow()?.accessLevels ?? []);
  protected readonly levelsForLegend = computed(() => {
    const levels = this.levels();
    return levels.length ? levels : ['none', 'own', 'view', 'approve', 'full'];
  });
  protected readonly unknownRoles = computed(() => this.matrix().map((role) => role.name).filter((name) => !PERMISSION_ROLES[name]));
  protected readonly modules = computed(() => {
    const names = new Set(this.matrix().flatMap((role) => role.permissions.map((permission) => permission.module)));
    return [...names].sort((a, b) => {
      const aGroup = this.groupId(a);
      const bGroup = this.groupId(b);
      return PERMISSION_GROUPS.findIndex((group) => group.id === aGroup) - PERMISSION_GROUPS.findIndex((group) => group.id === bGroup) || a.localeCompare(b);
    });
  });
  protected readonly unknownModules = computed(() => this.modules().filter((module) => !PERMISSION_MODULES[module]));
  protected readonly groupedModules = computed(() => {
    const query = this.query().trim().toLowerCase();
    const groups: PermissionGroup[] = PERMISSION_GROUPS.map((group) => ({
      ...group,
      modules: this.modules().filter((module) => {
        const config = moduleConfig(module);
        const groupId = config?.group ?? 'other';
        const haystack = `${this.moduleLabel(module)} ${config?.description ?? ''}`.toLowerCase();
        return groupId === group.id && (!query || haystack.includes(query));
      }),
    }));
    const other = this.modules().filter((module) => {
      const config = moduleConfig(module);
      const haystack = `${this.moduleLabel(module)} ${config?.description ?? ''}`.toLowerCase();
      return !config && (!query || haystack.includes(query));
    });
    if (other.length) groups.push({ id: 'other', label: 'Other', modules: other });
    return groups.filter((group) => group.modules.length > 0);
  });
  protected readonly dirtyRoles = computed(() => this.matrix().filter((role) => this.hasChanges(role.name)));
  protected readonly totalChanges = computed(() =>
    this.dirtyRoles().reduce((sum, role) => sum + this.changesForRole(role.name).length, 0),
  );
  protected readonly reviewChanges = computed<RoleChanges[]>(() =>
    this.dirtyRoles().map((role) => ({ role, label: roleConfig(role.name).label, changes: this.changesForRole(role.name) })),
  );
  protected readonly highImpactCount = computed(() =>
    this.reviewChanges().reduce(
      (sum, group) => sum + group.changes.filter((change) => this.isHighImpact(group.role.name, change.module)).length,
      0,
    ),
  );
  protected readonly reasonValid = computed(() => {
    const value = this.reason();
    return value.trim().length >= 5 && value.length <= 300;
  });

  constructor() {
    if (this.canView()) void this.loadRoles();
    else this.loading.set(false);
    afterNextRender(() => this.playEntrance(), { injector: this.injector });
    this.destroyRef.onDestroy(() => this.animationContext?.revert());
  }

  protected async loadRoles(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const rows = await this.api.rolesMatrix();
      const snapshot: RolePermissionsSnapshot[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        permissions: row.permissions.map((permission) => ({ module: permission.module, accessLevel: permission.accessLevel })),
        accessLevels: row.accessLevels ?? ['none', 'own', 'view', 'approve', 'full'],
        version: row.version ?? '',
        memberCount: row.memberCount ?? 0,
      }));
      this.matrix.set(snapshot);
      const previousDrafts = this.drafts();
      const modules = this.modulesFrom(snapshot);
      const drafts: Record<string, Record<string, string>> = {};
      for (const role of snapshot) {
        drafts[role.name] = this.hasChanges(role.name)
          ? (previousDrafts[role.name] ?? draftForRole(role, modules))
          : draftForRole(role, modules);
      }
      this.drafts.set(drafts);
      this.selectedRole.set(
        snapshot.some((role) => role.name === this.selectedRole()) ? this.selectedRole() : snapshot[0]?.name ?? '',
      );
      this.refreshNotice.set(false);
    } catch (error) {
      this.loadError.set(serverMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected setView(view: EditorView): void {
    this.view.set(view);
  }

  protected selectRole(name: string): void {
    this.selectedRole.set(name);
  }

  protected roleLabel(role: string): string {
    return roleConfig(role).label;
  }

  protected moduleLabel(module: string): string {
    return moduleConfig(module)?.label ?? humanizePermissionKey(module);
  }

  protected moduleConfig(module: string) {
    return moduleConfig(module);
  }

  protected LEVEL_MARKS = LEVEL_MARKS;
  protected readonly LEVEL_MEANINGS = LEVEL_MEANINGS;

  protected levelShort(level: string): string {
    const index = this.levels().indexOf(level);
    const fromApi = index >= 0 ? LEVEL_SHORT[level] : undefined;
    return fromApi ?? humanizePermissionKey(level);
  }

  protected roleConfig(role: string) {
    return roleConfig(role);
  }

  protected roleCount(role: string): number | undefined {
    return this.matrix().find((row) => row.name === role)?.memberCount;
  }

  protected isReadOnly(roleName: string): boolean {
    return roleConfig(roleName).readOnly || !this.canManage();
  }

  protected draftLevel(roleName: string, module: string): string {
    return this.drafts()[roleName]?.[module] ?? this.savedLevel(roleName, module);
  }

  protected savedLevel(roleName: string, module: string): string {
    return (
      this.matrix()
        .find((role) => role.name === roleName)
        ?.permissions.find((permission) => permission.module === module)?.accessLevel ?? 'none'
    );
  }

  protected changesForRole(roleName: string): PermissionChange[] {
    const role = this.matrix().find((item) => item.name === roleName);
    const draft = this.drafts()[roleName];
    return role && draft ? permissionChanges(role, draft, this.modules()) : [];
  }

  protected hasChanges(roleName: string): boolean {
    const role = this.matrix().find((item) => item.name === roleName);
    return !!role && roleHasChanges(role, this.drafts()[roleName], this.modules());
  }

  protected areasWithAccess(roleName: string): number {
    return this.modules().filter((module) => this.draftLevel(roleName, module) !== 'none').length;
  }

  protected dirtyRoleLabels(): string {
    return this.dirtyRoles()
      .map((role) => roleConfig(role.name).label)
      .join(', ');
  }

  protected levelSupported(module: string, level: string): boolean {
    const config = moduleConfig(module);
    if (!config) return true;
    if (level === 'own') return config.ownSupported;
    if (level === 'approve') return config.approveSupported;
    return true;
  }

  protected isChanged(roleName: string, module: string): boolean {
    return this.draftLevel(roleName, module) !== this.savedLevel(roleName, module);
  }

  protected isHighImpact(roleName: string, module: string): boolean {
    return HIGH_IMPACT_MODULES.has(module) && ['approve', 'full'].includes(this.draftLevel(roleName, module));
  }

  protected chooseLevel(roleName: string, module: string, level: string): void {
    if (this.saving() || this.isReadOnly(roleName) || !this.levelSupported(module, level)) return;
    if (this.draftLevel(roleName, module) === level) return;
    this.updateDraft(roleName, module, level);
    this.flashRow(module);
  }

  protected onLevelKeydown(event: KeyboardEvent, roleName: string, module: string): void {
    const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!delta) return;
    const levels = this.levels();
    if (!levels.length) return;
    event.preventDefault();
    const currentIndex = Math.max(levels.indexOf(this.draftLevel(roleName, module)), 0);
    for (let offset = 1; offset <= levels.length; offset += 1) {
      const candidate = levels[(currentIndex + delta * offset + levels.length * offset) % levels.length];
      if (candidate && this.levelSupported(module, candidate) && !this.isReadOnly(roleName)) {
        this.chooseLevel(roleName, module, candidate);
        requestAnimationFrame(() => {
          const button = this.panel?.nativeElement.querySelector<HTMLButtonElement>(
            `[data-module="${CSS.escape(module)}"] [role="radio"][aria-checked="true"]`,
          );
          button?.focus();
        });
        return;
      }
    }
  }

  protected tabIndexFor(roleName: string, module: string, level: string): number {
    if (this.isReadOnly(roleName)) return 0;
    const selected = this.draftLevel(roleName, module);
    return level === selected ? 0 : -1;
  }

  protected compareCellLabel(roleName: string, module: string): string {
    const level = this.draftLevel(roleName, module);
    const unsaved = this.isChanged(roleName, module) ? ', unsaved change' : '';
    return `${this.moduleLabel(module)} for ${roleConfig(roleName).label}: ${this.levelShort(level)}${unsaved}`;
  }

  protected editRoleAt(roleName: string, module?: string): void {
    this.view.set('edit');
    this.selectedRole.set(roleName);
    if (!module) return;
    afterNextRender(() => {
      const row = this.panel?.nativeElement.querySelector<HTMLElement>(`[data-module="${CSS.escape(module)}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: this.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      if (!this.reducedMotion()) {
        this.zone.runOutsideAngular(() =>
          gsap.fromTo(row, { outlineColor: 'transparent' }, { outlineColor: 'var(--ochre)', outlineWidth: 2, outlineStyle: 'solid', duration: 0.6, clearProps: 'outline' }),
        );
      }
    });
  }

  protected setGroupAccess(group: PermissionGroup, level: string): void {
    const roleName = this.selectedRole();
    if (!level || this.isReadOnly(roleName) || this.saving()) return;
    const modules = group.modules;
    for (const module of modules) this.updateDraft(roleName, module, level);
  }

  protected undoModule(roleName: string, module: string): void {
    this.updateDraft(roleName, module, this.savedLevel(roleName, module));
  }

  protected discard(): void {
    if (this.totalChanges() >= 5) {
      this.discardPrompt.set(true);
      return;
    }
    this.discardAll();
  }

  protected discardAll(): void {
    const next = { ...this.drafts() };
    for (const role of this.matrix()) next[role.name] = draftForRole(role, this.modules());
    this.drafts.set(next);
    this.discardPrompt.set(false);
  }

  protected requestReview(): void {
    if (!this.canManage() || this.totalChanges() === 0) return;
    this.reason.set('');
    this.saveErrors.set([]);
    this.reviewDialog?.nativeElement.showModal();
  }

  protected closeReview(): void {
    const dialog = this.reviewDialog?.nativeElement;
    if (dialog?.open && !this.saving()) dialog.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.reviewDialog?.nativeElement) this.closeReview();
  }

  protected onReviewClosed(): void {
    if (!this.saving()) this.reviewButton?.nativeElement.focus();
  }

  protected async saveChanges(): Promise<void> {
    if (!this.reasonValid() || !this.canManage() || this.saving()) return;
    this.saving.set(true);
    this.saveErrors.set([]);
    const failures: Array<{ role: string; message: string; conflict: boolean }> = [];
    for (const role of this.dirtyRoles()) {
      const draft = this.drafts()[role.name];
      if (!draft) continue;
      this.saveProgress.set(role.name);
      try {
        const saved = await this.api.updateRolePermissions(
          role.name,
          permissionSet(draft, this.modules()) as Array<{ module: string; accessLevel: string }>,
          { baseVersion: role.version, reason: this.reason().trim() },
        );
        const row: RolePermissionsSnapshot = {
          id: saved.id,
          name: saved.name,
          permissions: saved.permissions.map((permission) => ({ module: permission.module, accessLevel: permission.accessLevel })),
          accessLevels: saved.accessLevels ?? this.levels(),
          version: saved.version ?? '',
          memberCount: saved.memberCount ?? role.memberCount,
        };
        this.matrix.update((current) => current.map((item) => (item.name === role.name ? row : item)));
        this.drafts.update((current) => ({ ...current, [role.name]: draftForRole(row, this.modules()) }));
      } catch (error) {
        failures.push({ role: role.name, message: serverMessage(error), conflict: errorStatus(error) === 409 });
      }
    }
    this.saveProgress.set('');
    this.saving.set(false);
    this.saveErrors.set(failures);
    if (failures.length === 0) {
      this.reviewDialog?.nativeElement.close();
      this.toast.show('Saved. Recorded in the audit log.', 'good');
    } else {
      this.toast.show('Some roles could not be saved. Review the errors below.', 'bad');
    }
  }

  protected retrySave(): void {
    this.saveErrors.set([]);
    void this.saveChanges();
  }

  protected async reloadRoles(): Promise<void> {
    this.saveErrors.set([]);
    await this.loadRoles();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.totalChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    if (this.saving()) return;
    if (this.totalChanges() > 0) {
      this.refreshNotice.set(true);
      return;
    }
    if (this.canView() && !this.loading()) void this.loadRoles();
  }

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    if (this.reviewDialog?.nativeElement?.open) this.closeReview();
  }

  protected reducedMotion(): boolean {
    return !this.isBrowser || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private updateDraft(roleName: string, module: string, level: string): void {
    this.drafts.update((current) => ({ ...current, [roleName]: { ...current[roleName], [module]: level } }));
    this.animateDirtyBar();
  }

  private animateDirtyBar(): void {
    if (this.reducedMotion()) return;
    afterNextRender(() => {
      const bar = this.saveBar?.nativeElement;
      if (!bar) return;
      this.zone.runOutsideAngular(() =>
        gsap.fromTo(bar, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }),
      );
    });
  }

  private groupId(module: string): PermissionGroupId {
    return moduleConfig(module)?.group ?? 'other';
  }

  private modulesFrom(rows: RolePermissionsSnapshot[]): string[] {
    return [...new Set(rows.flatMap((role) => role.permissions.map((permission) => permission.module)))];
  }

  private playEntrance(): void {
    if (!this.isBrowser || this.entrancePlayed || this.reducedMotion()) return;
    this.entrancePlayed = true;
    this.zone.runOutsideAngular(() => {
      const root = this.panel?.nativeElement;
      if (!root) return;
      this.animationContext = gsap.context(() => {
        gsap.from(root.querySelectorAll('.sd-area, .sd-module-group'), { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
      }, root);
    });
  }

  private flashRow(module: string): void {
    if (this.reducedMotion()) return;
    const row = this.panel?.nativeElement.querySelector<HTMLElement>(`[data-module="${CSS.escape(module)}"]`);
    if (!row) return;
    this.zone.runOutsideAngular(() =>
      gsap.fromTo(row, { outline: '2px solid var(--ochre)' }, { outline: '2px solid transparent', duration: 0.6, clearProps: 'outline' }),
    );
  }
}
