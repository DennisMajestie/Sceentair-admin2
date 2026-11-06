import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../ui/icon';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, FormsModule],
  template: `
    <div class="auth-screen" [class.scrolled]="scrolled()">
      <header class="auth-head">
        <div class="auth-head-inner">
          <a class="logo strip-logo" routerLink="/" aria-label="Vessa home">
            <span class="auth-logo">Vessa</span>
          </a>
          <div class="header-actions">
            <button
              class="theme-toggle login-theme-toggle"
              type="button"
              [attr.aria-label]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
              [attr.title]="isDarkMode() ? 'Light mode' : 'Dark mode'"
              (click)="theme.cycleMode()"
            >
              @if (isDarkMode()) {
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.7 17.7l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.7 6.3l1.41-1.41" />
                </svg>
              } @else {
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              }
            </button>
          </div>
        </div>
      </header>

      <div class="auth-split">
        @if (isDesktop()) {
          <aside class="auth-brand" aria-hidden="true">
            <span class="auth-brand__cloud auth-brand__cloud--a"></span>
            <span class="auth-brand__cloud auth-brand__cloud--b"></span>
            <span class="auth-brand__cloud auth-brand__cloud--c"></span>
            <div class="auth-brand__copy">
              <p class="auth-brand__hello">WELCOME</p>
              <p class="auth-brand__name">VESSA</p>
              <p class="auth-brand__lede">Staff access to the admin console.</p>
            </div>
            <span class="auth-brand__photo auth-brand__photo--seam"></span>
            <span class="auth-brand__photo auth-brand__photo--corner"></span>
            <span class="auth-brand__dot"></span>
          </aside>
        }

        <section class="auth-panel">
          @if (challengeToken()) {
            <div class="auth-wrap">
              <form class="auth-card" (ngSubmit)="submitCode()" novalidate>
                <p class="eyebrow">Two-factor check</p>
                <h1>Verify it's you.</h1>
                <p class="subtext">Enter the 6-digit code from your authenticator app.</p>

                <label class="field">
                  <span class="field-label">Code</span>
                  <input
                    [(ngModel)]="code"
                    name="code"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="000000"
                    required
                  />
                </label>

                <button class="cta signin" type="submit">Verify</button>
                <button class="link" type="button" (click)="challengeToken.set(null)">Back</button>
                @if (formError()) {
                  <p class="field-err form-err">{{ formError() }}</p>
                }
              </form>
            </div>
          } @else if (resetMode()) {
            <div class="auth-wrap">
              <form class="auth-card" (ngSubmit)="submitReset()" novalidate>
                <p class="eyebrow">Staff access</p>
                <h1>Reset password.</h1>
                <p class="subtext">
                  {{
                    resetSent()
                      ? 'Enter the token from your email plus a new password.'
                      : 'We will send a reset token to your inbox.'
                  }}
                </p>

                @if (!resetSent()) {
                  <label class="field">
                    <span class="field-label">Email</span>
                    <input
                      type="email"
                      [(ngModel)]="email"
                      name="remail"
                      placeholder="you@vessa.example"
                      autocomplete="email"
                      required
                    />
                    @if (errors().email) {
                      <span class="field-err">{{ errors().email }}</span>
                    }
                  </label>
                } @else {
                  <label class="field">
                    <span class="field-label">Reset token</span>
                    <input
                      class="mono"
                      [(ngModel)]="resetToken"
                      name="rtoken"
                      placeholder="64 hex chars from the email"
                      required
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">New password</span>
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      [(ngModel)]="newPassword"
                      name="rpass"
                      placeholder="at least 8 characters"
                      autocomplete="new-password"
                      required
                    />
                  </label>
                  <label class="field">
                    <span class="field-label">Confirm new password</span>
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      [(ngModel)]="newPassword2"
                      name="rpass2"
                      placeholder="repeat it"
                      autocomplete="new-password"
                      required
                    />
                  </label>
                }

                <button class="cta signin" type="submit" [disabled]="loading()">
                  {{
                    loading() ? 'Working…' : resetSent() ? 'Set new password' : 'Send reset token →'
                  }}
                </button>
                <button class="link" type="button" (click)="backToSignin()">Back to sign in</button>
                @if (formError()) {
                  <p class="field-err form-err">{{ formError() }}</p>
                }
                @if (resetMsg()) {
                  <p class="success">{{ resetMsg() }}</p>
                }
              </form>
            </div>
          } @else {
            <div class="auth-wrap">
              <form class="auth-card" (ngSubmit)="onSubmit()" novalidate>
                <p class="eyebrow">Staff access</p>
                <h1>Welcome back.</h1>
                <p class="subtext">Sign in to run the drop.</p>

                <label class="field">
                  <span class="field-label">Email</span>
                  <input
                    type="email"
                    [(ngModel)]="email"
                    name="email"
                    placeholder="you@vessa.example"
                    autocomplete="email"
                    required
                  />
                  @if (errors().email) {
                    <span class="field-err">{{ errors().email }}</span>
                  }
                </label>

                <label class="field">
                  <span class="field-label">
                    Password
                    <button type="button" class="forgot" (click)="forgot()">Forgot?</button>
                  </span>
                  <span class="pw-wrap">
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      [(ngModel)]="password"
                      name="password"
                      autocomplete="current-password"
                      required
                    />
                    <button type="button" class="pw-toggle" (click)="showPassword.set(!showPassword())">
                      {{ showPassword() ? 'Hide' : 'Show' }}
                    </button>
                  </span>
                  @if (errors().password) {
                    <span class="field-err">{{ errors().password }}</span>
                  }
                </label>

                <label class="check">
                  <input type="checkbox" [(ngModel)]="rememberMe" name="remember" />
                  <span>Keep me signed in</span>
                </label>

                <button
                  class="cta signin"
                  type="submit"
                  [disabled]="loading()"
                  [class.shake]="shake()"
                >
                  @if (loading()) {
                    <span class="spinner" aria-hidden="true"></span>
                    Signing in…
                  } @else if (success()) {
                    ✓ Signed in
                  } @else {
                    Sign in →
                  }
                </button>
                @if (formError()) {
                  <p class="field-err form-err">{{ formError() }}</p>
                }
                <p class="auth-fine">Secured connection. Authorised users only.</p>
              </form>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .auth-screen {
        display: block;
        min-height: 0;
        padding: 0;
        background-image: none;
        background-color: var(--obsidian, #0f1714);
        color: var(--ink, #1b1c19);
      }
      .auth-screen::before {
        display: none;
      }

      .auth-head {
        position: sticky;
        top: 0;
        z-index: 30;
        background: var(--panel, #ffffff);
        border-bottom: 1px solid var(--hairline-2, #e5e5e5);
        transition: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }
      .auth-head.scrolled {
        border-bottom-color: var(--hairline-2);
      }
      .auth-head-inner {
        max-width: 1280px;
        margin-inline: auto;
        padding: 14px clamp(20px, 4vw, 56px);
        padding-top: calc(14px + env(safe-area-inset-top, 0px));
      }

      .auth-split {
        display: grid;
        grid-template-columns: 1fr;
        width: 100%;
        max-width: 1000px;
        margin: 0 auto;
        padding: clamp(1.2rem, 4vw, 2.4rem) clamp(16px, 4vw, 24px) 3rem;
        align-items: stretch;
        overflow: hidden;
        border-radius: 28px;
      }
      .auth-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: var(--surface, #ffffff);
        border-radius: 28px;
        padding: 40px 44px 34px;
        box-shadow:
          0 30px 70px -22px rgb(0 0 0 / 0.24),
          0 8px 24px -14px rgb(0 0 0 / 0.14);
      }

      .auth-brand {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 36px;
        background: linear-gradient(160deg, #1f1a14 0%, #14110e 55%, #100d0b 100%);
        color: #fff;
        border-radius: 28px 0 0 28px;
      }
      .auth-brand__cloud {
        position: absolute;
        border-radius: 50%;
        filter: blur(26px);
        pointer-events: none;
      }
      .auth-brand__cloud--a {
        width: 210px;
        height: 150px;
        top: -46px;
        left: -34px;
        background: rgb(255 255 255 / 0.07);
      }
      .auth-brand__cloud--b {
        width: 180px;
        height: 130px;
        top: 26px;
        right: -56px;
        background: rgb(201 162 75 / 0.12);
      }
      .auth-brand__cloud--c {
        width: 200px;
        height: 140px;
        top: 118px;
        left: 52px;
        background: rgb(255 255 255 / 0.045);
      }
      .auth-brand__copy {
        position: relative;
        z-index: 2;
      }
      .auth-brand__hello {
        margin: 0;
        font-size: clamp(2.4rem, 5.2vw, 3.5rem);
        font-weight: 800;
        line-height: 0.9;
        color: #fff;
        text-shadow: 0 10px 30px rgb(0 0 0 / 0.45);
      }
      .auth-brand__name {
        margin: 0.6rem 0 0;
        font-size: 1.125rem;
        font-weight: 700;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #c9a24b;
      }
      .auth-brand__lede {
        margin: 0.85rem 0 0;
        max-width: 240px;
        font-size: 0.8125rem;
        line-height: 1.5;
        color: rgb(255 255 255 / 0.78);
      }
      .auth-brand__photo {
        position: absolute;
        z-index: 3;
        border-radius: 50%;
        box-shadow: 0 18px 44px -12px rgb(0 0 0 / 0.6);
      }
      .auth-brand__photo--seam {
        width: 152px;
        height: 152px;
        right: -76px;
        top: 40%;
        transform: translateY(-50%);
        border: 3px solid rgb(255 255 255 / 0.85);
        background:
          radial-gradient(circle at 32% 28%, rgb(240 220 174 / 0.9), rgb(201 162 75 / 0.25) 60%),
          linear-gradient(150deg, #2e2718, #14110e);
      }
      .auth-brand__photo--corner {
        width: 198px;
        height: 198px;
        left: -66px;
        bottom: -74px;
        border: 3px solid rgb(255 255 255 / 0.22);
        background:
          radial-gradient(circle at 38% 32%, rgb(255 255 255 / 0.16), transparent 58%),
          linear-gradient(150deg, #2a2419, #14110e);
      }
      .auth-brand__dot {
        position: absolute;
        z-index: 1;
        left: 44%;
        bottom: 28px;
        width: 106px;
        height: 106px;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.12);
      }

      .auth-wrap {
        width: 100%;
        max-width: 360px;
      }
      .auth-card {
        background: none;
        border: 0;
        padding: 0;
        text-align: center;
      }
      .auth-card input {
        height: 48px;
        border-radius: 14px;
        background: var(--surface-2, #f5f5f0);
        border: 1px solid transparent;
        color: var(--text, #1b1c19);
        padding-inline: 44px 16px;
      }
      .auth-card input:focus-visible {
        outline: 2px solid var(--primary, #b9531f);
        outline-offset: 1px;
      }
      .auth-card .pw-wrap input {
        padding-right: 48px;
      }
      .auth-card .pw-toggle {
        min-width: 36px;
        min-height: 36px;
        padding: 0;
        border: 0;
        border-radius: 10px;
        background: none;
        cursor: pointer;
      }
      .auth-card .pw-toggle:focus-visible {
        outline: 2px solid var(--primary, #b9531f);
        outline-offset: 1px;
      }
      .auth-card .cta.signin {
        width: 100%;
        min-height: 48px;
        border-radius: 12px;
        border: 0;
        font-weight: 700;
        background: var(--primary, #b9531f);
        color: var(--on-primary, #ffffff);
      }
      .auth-card .cta.signin:hover:not(:disabled) {
        opacity: 0.95;
      }
      .auth-card .cta.signin:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .field {
        display: grid;
        gap: 5px;
        margin-bottom: 14px;
      }
      .field-label {
        font-size: var(--fs-2xs);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--faint, #6b7280);
        margin-bottom: 5px;
      }
      .field input {
        width: 100%;
        padding: 10px 44px 10px 16px;
        border: 1px solid transparent;
        border-radius: 14px;
        background: var(--surface-2, #f5f5f0);
        color: var(--text, #1b1c19);
        font-size: var(--fs-md);
      }
      .field input:focus-visible {
        outline: 2px solid var(--primary, #b9531f);
        outline-offset: 1px;
      }
      .field-err {
        color: var(--bad, #c0392b);
        font-size: var(--fs-xs);
        margin-top: 5px;
      }
      .pw-wrap {
        position: relative;
      }
      .pw-toggle {
        position: absolute;
        right: 14px;
        top: 50%;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
        border-radius: 10px;
        background: none;
        cursor: pointer;
        color: var(--muted, #6b7280);
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        font-size: var(--fs-sm);
        color: var(--text, #1b1c19);
      }
      .check input {
        width: 16px;
        height: 16px;
        accent-color: var(--primary, #b9531f);
      }
      .cta.signin {
        width: 100%;
        min-height: 48px;
        border-radius: 12px;
        border: 0;
        font-weight: 700;
        background: var(--primary, #b9531f);
        color: var(--on-primary, #ffffff);
        cursor: pointer;
      }
      .cta.signin:hover:not(:disabled) {
        opacity: 0.95;
      }
      .cta.signin:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .link {
        background: none;
        border: 0;
        color: var(--primary, #b9531f);
        cursor: pointer;
        font-size: var(--fs-sm);
        text-decoration: none;
        padding: 0;
      }
      .link:hover {
        text-decoration: underline;
      }
      .shake {
        animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
        20%, 40%, 60%, 80% { transform: translateX(4px); }
      }
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
        display: inline-block;
        vertical-align: middle;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 1100px) {
        .auth-brand {
          padding: 30px;
        }
        .auth-brand__photo--seam {
          width: 124px;
          height: 124px;
          right: -62px;
        }
        .auth-brand__photo--corner {
          width: 160px;
          height: 160px;
          left: -54px;
          bottom: -60px;
        }
        .auth-brand__dot {
          width: 88px;
          height: 88px;
        }
        .auth-panel {
          padding: 34px 30px 28px;
          border-radius: 28px;
        }
      }
      @media (max-width: 899px) {
        .auth-panel {
          padding: 24px;
          border-radius: 28px;
        }
      }
    `,
  ],
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly rememberMe = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly code = signal('');
  protected readonly loading = signal(false);
  protected readonly success = signal(false);
  protected readonly shake = signal(false);
  protected readonly challengeToken = signal<string | null>(null);
  protected readonly resetMode = signal(false);
  protected readonly resetSent = signal(false);
  protected readonly resetMsg = signal<string | null>(null);
  protected readonly resetToken = signal('');
  protected readonly newPassword = signal('');
  protected readonly newPassword2 = signal('');

  protected readonly errors = signal<{ email?: string; password?: string }>({});
  protected readonly formError = signal<string | null>(null);

  protected readonly isDesktop = signal(window.matchMedia('(min-width: 900px)').matches);

  protected readonly scrolled = signal(false);

  protected readonly isDarkMode = computed(() => this.theme.resolved() === 'dark');

  constructor() {
    void this.init();
  }

  async init(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      const mql = window.matchMedia('(min-width: 900px)');
      this.isDesktop.set(mql.matches);
      mql.addEventListener('change', (e) => this.isDesktop.set(e.matches));
    }
    if (this.auth.user()) {
      void this.router.navigate(['/dashboard/overview']);
    }
  }

  private onScroll = () => {
    this.scrolled.set(window.scrollY > 10);
  };

  protected async onSubmit(): Promise<void> {
    this.errors.set({});
    this.formError.set(null);

    const email = this.email().trim();
    const password = this.password();

    const invalid: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) invalid.email = 'Enter a valid email address.';
    if (password.length < 6) invalid.password = 'Password must be at least 6 characters.';

    if (invalid.email || invalid.password) {
      this.errors.set(invalid);
      this.triggerShake();
      return;
    }

    this.loading.set(true);
    this.success.set(false);

    try {
      await this.auth.login(email, password);
      this.loading.set(false);
      this.success.set(true);
      void this.router.navigate(['/dashboard/overview']);
    } catch (err) {
      this.loading.set(false);
      this.formError.set('Sign-in failed: staff accounts only.');
      this.triggerShake();
    }
  }

  protected async submitCode(): Promise<void> {
    const token = this.challengeToken();
    if (!token) return;
    this.formError.set(null);

    try {
      await this.auth.verifyTwoFactor(this.code());
      this.challengeToken.set(null);
      this.code.set('');
      this.success.set(false);
      void this.router.navigate(['/dashboard/overview']);
    } catch (err) {
      this.formError.set('Incorrect or expired code.');
      this.triggerShake();
    }
  }

  protected forgot(): void {
    this.resetMode.set(true);
    this.resetSent.set(false);
    this.resetToken.set('');
    this.newPassword.set('');
    this.newPassword2.set('');
    this.formError.set(null);
    this.errors.set({});
  }

  protected backToSignin(): void {
    this.resetMode.set(false);
    this.resetSent.set(false);
    this.formError.set(null);
    this.resetMsg.set(null);
    this.errors.set({});
  }

  protected async submitReset(): Promise<void> {
    const email = this.email().trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.errors.set({ email: 'Enter a valid email address.' });
      this.triggerShake();
      return;
    }

    this.errors.set({});
    this.loading.set(true);

    try {
      await this.auth.resetPassword(email);
      this.loading.set(false);
      this.resetSent.set(true);
      this.resetMsg.set(
        'If that email exists, a reset token is on its way. Check your inbox (and spam).'
      );
    } catch (err) {
      this.loading.set(false);
      this.resetSent.set(true);
      this.resetMsg.set(
        'If that email exists, a reset token is on its way. Check your inbox (and spam).'
      );
    }
  }

  private triggerShake(): void {
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 450);
  }
}