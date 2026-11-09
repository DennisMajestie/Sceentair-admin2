import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, type ApiAuthSession } from '../../core/auth.service';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-settings-security',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Settings</span>
        <h1 class="head__title">Security</h1>
        <p class="head__lead">Two-factor authentication and active sessions on your account</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/settings/account">Account</a>
      </div>
    </div>

    <section class="card security-card" aria-labelledby="2fa-heading">
      <div class="card__head">
        <div>
          <h2 class="card__title" id="2fa-heading">Two-factor authentication</h2>
          <p class="card__sub">
            @if (enabled()) {
              Enabled — every sign-in needs your password and the 6-digit code from your authenticator app.
            } @else {
              Not enabled — your account is protected by your password alone.
            }
          </p>
        </div>
        <span class="badge" [class.badge--good]="enabled()">{{ enabled() ? 'Enabled' : 'Disabled' }}</span>
      </div>

      @switch (phase()) {
        @case ('idle') {
          <div class="security-actions">
            @if (!enabled()) {
              <button class="btn btn--primary" type="button" (click)="startSetup()" [disabled]="busy()">{{ busy() ? 'Preparing…' : 'Enable 2FA' }}</button>
            } @else {
              <button class="btn btn--ghost" type="button" (click)="phase.set('disabling')">Disable 2FA</button>
            }
          </div>
        }
        @case ('enrolling') {
          <div class="enroll">
            <p class="enroll__lead">Scan this secret with your authenticator app (Google Authenticator, Aegis, 1Password…), then enter the 6-digit code it shows:</p>
            <div class="secret-box">
              <span class="stat__label">Manual entry secret</span>
              <code class="secret mono">{{ setup()?.secret }}</code>
              <button class="btn btn--ghost" type="button" (click)="copySecret()">Copy secret</button>
            </div>
            <label class="field"><span class="field__label">6-digit code</span>
              <input class="code-input mono" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="code" name="code" placeholder="000000" />
            </label>
            <div class="security-actions">
              <button class="btn btn--primary" type="button" (click)="confirmEnable()" [disabled]="busy() || code.trim().length !== 6">{{ busy() ? 'Verifying…' : 'Turn on 2FA' }}</button>
              <button class="btn btn--ghost" type="button" (click)="cancelEnroll()">Cancel</button>
            </div>
          </div>
        }
        @case ('disabling') {
          <div class="enroll">
            <p class="enroll__lead">Turning 2FA off will sign out every session, including this one. Enter a current 6-digit code to confirm:</p>
            <label class="field"><span class="field__label">6-digit code</span>
              <input class="code-input mono" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="code" name="code" placeholder="000000" />
            </label>
            <div class="security-actions">
              <button class="btn btn--primary" type="button" (click)="confirmDisable()" [disabled]="busy() || code.trim().length !== 6">{{ busy() ? 'Disabling…' : 'Disable 2FA' }}</button>
              <button class="btn btn--ghost" type="button" (click)="cancelEnroll()">Cancel</button>
            </div>
          </div>
        }
      }
      @if (notice()) {
        <p class="notice" role="status">{{ notice() }}</p>
      }
    </section>

    <section class="card" aria-labelledby="sessions-heading">
      <div class="card__head">
        <div>
          <h2 class="card__title" id="sessions-heading">Active sessions</h2>
          <p class="card__sub">{{ sessions().length }} signed-in devices. Revoke any session you don't recognise.</p>
        </div>
        <button class="btn btn--ghost" type="button" (click)="loadSessions()" [disabled]="sessionsLoading()">{{ sessionsLoading() ? 'Refreshing…' : 'Refresh' }}</button>
      </div>
      @if (sessionsError()) {
        <p class="notice notice--error" role="alert">{{ sessionsError() }}</p>
      }
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Device</th><th scope="col">Started</th><th scope="col"></th></tr></thead>
          <tbody>
            @for (session of sessions(); track session.id) {
              <tr>
                <td>
                  <span class="session-name">{{ deviceLabel(session) }}<span class="sub">{{ session.ip ?? 'unknown IP' }}</span></span>
                </td>
                <td>{{ session.createdAt | date: 'medium' }}</td>
                <td class="num">
                  <button class="btn btn--ghost" type="button" [disabled]="busySessionId() === session.id" (click)="revoke(session.id)">{{ busySessionId() === session.id ? 'Revoking…' : 'Revoke' }}</button>
                </td>
              </tr>
            }
            @if (!sessions().length && !sessionsLoading()) {
              <tr><td colspan="3" class="table-empty">No active sessions found (or the sessions list is unavailable on this server).</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .security-card, .card { max-width: 860px; }
    .security-card { margin-bottom: 16px; }
    .card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 20px 22px 0; }
    .card__title { font-size: var(--fs-lg); font-weight: 750; }
    .card__sub { color: var(--muted); font-size: var(--fs-sm); margin-top: 4px; }
    .security-actions { display: flex; gap: 10px; padding: 18px 22px 22px; flex-wrap: wrap; }
    .enroll { display: grid; gap: 14px; padding: 18px 22px 22px; }
    .enroll__lead { color: var(--muted); font-size: var(--fs-sm); line-height: 1.5; }
    .secret-box { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); background: var(--well); }
    .secret { font-size: var(--fs-md); letter-spacing: 0.08em; word-break: break-all; }
    .field { display: grid; gap: 6px; max-width: 320px; }
    .code-input { height: 52px; font-size: 1.25rem; letter-spacing: 0.3em; text-align: center; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--text); }
    .code-input:focus-visible { outline: 2px solid var(--primary); }
    .notice { margin: 0 22px 18px; padding: 10px 14px; border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-sm); }
    .notice--error { color: var(--bad); }
    .session-name { font-weight: 650; font-size: var(--fs-sm); }
    .sub { display: block; color: var(--faint); font-size: var(--fs-xs); }
    .table-empty { text-align: center; color: var(--muted); padding: 24px 12px; }
    .num { text-align: right; }
  `,
})
export class SettingsSecurity {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly enabled = signal(false);
  protected readonly phase = signal<'idle' | 'enrolling' | 'disabling'>('idle');
  protected readonly busy = signal(false);
  protected readonly setup = signal<{ secret: string; otpauthUrl: string } | null>(null);
  protected code = '';
  protected readonly notice = signal<string | null>(null);

  protected readonly sessions = signal<ApiAuthSession[]>([]);
  protected readonly sessionsLoading = signal(false);
  protected readonly sessionsError = signal<string | null>(null);
  protected readonly busySessionId = signal<string | null>(null);

  constructor() {
    this.enabled.set(!!this.auth.user()?.totpEnabled);
    void this.loadSessions();
  }

  protected deviceLabel(session: ApiAuthSession): string {
    const ua = session.userAgent ?? '';
    if (/mobile|iphone|android/i.test(ua)) return 'Mobile device';
    if (/ipad|tablet/i.test(ua)) return 'Tablet';
    if (/macintosh|mac os/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/linux/i.test(ua)) return 'Linux device';
    return 'This device';
  }

  protected async startSetup(): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      this.setup.set(await this.auth.setup2fa());
      this.phase.set('enrolling');
      this.code = '';
    } catch {
      this.notice.set('Could not start 2FA enrolment. Try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmEnable(): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      await this.auth.enable2fa(this.code.trim());
      this.enabled.set(true);
      this.phase.set('idle');
      this.code = '';
      this.notice.set('Two-factor authentication is on.');
      this.toast.show('2FA enabled', 'good');
    } catch {
      this.notice.set('That code was not accepted. Check your authenticator app and try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmDisable(): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      await this.auth.disable2fa(this.code.trim());
      this.enabled.set(false);
      this.phase.set('idle');
      this.code = '';
      this.notice.set('Two-factor authentication is off. Every session was signed out — including this one.');
      this.toast.show('2FA disabled', 'info');
    } catch {
      this.notice.set('That code was not accepted. 2FA is still on.');
    } finally {
      this.busy.set(false);
    }
  }

  protected cancelEnroll(): void {
    this.phase.set('idle');
    this.code = '';
    this.setup.set(null);
    this.notice.set(null);
  }

  protected async copySecret(): Promise<void> {
    const secret = this.setup()?.secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.toast.show('Secret copied to clipboard', 'good');
    } catch {
      this.toast.show('Clipboard unavailable — copy the secret manually.', 'info');
    }
  }

  protected async loadSessions(): Promise<void> {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    try {
      this.sessions.set(await this.auth.listSessions());
    } catch {
      this.sessionsError.set('Sessions are unavailable on this server right now.');
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  protected async revoke(id: string): Promise<void> {
    this.busySessionId.set(id);
    try {
      await this.auth.revokeSession(id);
      this.sessions.update((list) => list.filter((s) => s.id !== id));
      this.toast.show('Session revoked', 'good');
    } catch {
      this.toast.show('Could not revoke this session.', 'bad');
    } finally {
      this.busySessionId.set(null);
    }
  }
}
