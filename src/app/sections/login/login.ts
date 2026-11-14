import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme';
import { Store } from '../../core/store';
import { hideAppPreloader, showAppPreloader } from '../../core/app-preloader';
import { OverviewPrefetchService } from '../../core/overview-prefetch';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="auth-screen" [class.scrolled]="scrolled()">
      <header class="auth-head">
        <div class="auth-head-inner">
          <a class="auth-logo-link" routerLink="/" aria-label="Seentair home">
            <img
              class="auth-logo"
              [src]="theme.resolved() === 'dark' ? '/logo-dark.png' : '/logo-light.png'"
              alt="Seentair — Style for Everyone"
            />
          </a>
          <button
            class="theme-toggle"
            type="button"
            [attr.aria-label]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.title]="isDarkMode() ? 'Light mode' : 'Dark mode'"
            (click)="theme.cycleMode()"
          >
            @if (isDarkMode()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.7 17.7l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.7 6.3l1.41-1.41" />
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            }
          </button>
        </div>
      </header>

      <div class="auth-split">
        @if (isDesktop()) {
          <aside class="auth-brand" aria-hidden="true">
            <div class="auth-brand__copy">
              <p class="auth-brand__hello">WELCOME</p>
              <p class="auth-brand__name">Seentair</p>
              <p class="auth-brand__lede">Staff access to the ops terminal.</p>
            </div>
            <span class="auth-brand__orb auth-brand__orb--corner"></span>
            <span class="auth-brand__orb auth-brand__orb--dim"></span>
          </aside>
          <span class="auth-split__seam" aria-hidden="true"></span>
        }

        <section class="auth-panel">
          @if (challengeToken()) {
            <div class="auth-wrap">
              <form class="auth-card" (ngSubmit)="submitCode()" novalidate>
                <p class="eyebrow">Two-factor check</p>
                <h1 class="auth-title">Verify it&rsquo;s you.</h1>
                <p class="subtext">Enter the 6-digit code from your authenticator app.</p>

                <label class="field">
                  <span class="field-label">Code</span>
                  <input class="mono code-input" [(ngModel)]="code" name="code" inputmode="numeric" maxlength="6" placeholder="000000" required />
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
                <h1 class="auth-title">Reset password.</h1>
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
                    <input type="email" [(ngModel)]="email" name="remail" placeholder="you@seentair.ng" autocomplete="email" required />
                    @if (errors().email) {
                      <span class="field-err">{{ errors().email }}</span>
                    }
                  </label>
                } @else {
                  <label class="field">
                    <span class="field-label">Reset token</span>
                    <input class="mono" [(ngModel)]="resetToken" name="rtoken" placeholder="64 hex chars from the email" required />
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
                  {{ loading() ? 'Working…' : resetSent() ? 'Set new password' : 'Send reset token →' }}
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
                <h1 class="auth-title">Welcome back.</h1>
                <p class="subtext">Sign in to run the drop.</p>

                <label class="field">
                  <span class="field-label">Email</span>
                  <input
                    type="email"
                    [(ngModel)]="email"
                    name="email"
                    placeholder="you@seentair.ng"
                    autocomplete="email"
                    required
                  />
                  @if (errors().email) {
                    <span class="field-err">{{ errors().email }}</span>
                  }
                </label>

                <div class="field">
                  <div class="pw-row">
                    <span class="field-label">Password</span>
                    <button type="button" class="forgot" (click)="forgot()">Forgot?</button>
                  </div>
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
                </div>

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
  styles: `
    :host {
      display: block;
    }

    .auth-screen {
      --gold: #c9a24b;
      --gold-strong: #b6923d;
      --on-gold: #241f17;
      --ink: #17130e;
      --muted: #837e71;
      --cream: #f4f1ea;

      display: block;
      min-height: 100vh;
      background: var(--sd-page);
      color: var(--ink);
    }

    .auth-head {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--surface, #ffffff);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .auth-head.scrolled {
      border-bottom-color: var(--line-2);
    }
    .auth-head-inner {
      max-width: 1280px;
      margin-inline: auto;
      padding: 10px clamp(20px, 4vw, 56px);
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .auth-logo-link {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      border-radius: 12px;
    }
    .auth-logo-link:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 3px;
    }
    .auth-logo {
      display: block;
      height: 44px;
      width: auto;
      max-width: min(56vw, 220px);
      object-fit: contain;
    }
    .theme-toggle {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 1.5px solid var(--line-2);
      background: transparent;
      color: var(--text);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: transform 0.2s ease, background 0.2s ease;
    }
    .theme-toggle:hover {
      transform: rotate(15deg);
      background: var(--surface-2, #f5f5f0);
    }
    .theme-toggle:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }
    .theme-toggle svg {
      width: 21px;
      height: 21px;
    }

    .auth-split {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      width: min(1160px, 100%);
      min-height: calc(100vh - 66px);
      margin: 0 auto;
      padding: clamp(12px, 2.4vw, 26px) clamp(14px, 3.4vw, 32px) clamp(20px, 3vw, 34px);
      align-items: stretch;
      overflow: hidden;
      border-radius: 22px;
    }
    .auth-split:has(> .auth-brand) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .auth-brand {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: clamp(1.6rem, 3.2vw, 3.4rem) clamp(1.7rem, 3.6vw, 3.6rem);
      color: #fff;
      border-radius: 22px 0 0 22px;
      background:
        radial-gradient(120% 90% at 50% -12%, rgb(255 236 190 / 0.12), transparent 55%),
        radial-gradient(80% 60% at 10% 110%, rgb(201 162 75 / 0.18), transparent 55%),
        linear-gradient(165deg, #1e1913 0%, #15110d 55%, #100d09 100%);
    }
    .auth-brand__copy {
      position: relative;
      z-index: 2;
    }
    .auth-brand__hello {
      margin: 0;
      font-size: clamp(3.1rem, 5.8vw, 5rem);
      font-weight: 800;
      line-height: 0.95;
      letter-spacing: 0.01em;
      color: #fff;
    }
    .auth-brand__name {
      margin: 1rem 0 0;
      font-size: clamp(0.8rem, 1.05vw, 1rem);
      font-weight: 800;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: var(--gold);
    }
    .auth-brand__lede {
      margin: 1rem 0 0;
      max-width: 250px;
      font-size: 0.875rem;
      line-height: 1.55;
      color: rgb(255 255 255 / 0.72);
    }
    .auth-brand__orb {
      position: absolute;
      z-index: 1;
      border-radius: 50%;
      pointer-events: none;
    }
    .auth-brand__orb--corner {
      width: 235px;
      height: 235px;
      left: -82px;
      bottom: -94px;
      background: radial-gradient(circle at 38% 32%, #4b4234, #26211a 55%, #14110d);
      border: 3px solid rgb(255 255 255 / 0.18);
    }
    .auth-brand__orb--dim {
      width: 118px;
      height: 118px;
      left: 40%;
      bottom: 7%;
      background: radial-gradient(circle at 40% 35%, #3c3730, #221f1b);
    }

    .auth-split__seam {
      position: absolute;
      z-index: 4;
      left: 47%;
      top: 24%;
      width: clamp(120px, 15vw, 180px);
      aspect-ratio: 1;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle at 35% 30%, #f7ecc0 0%, #e2c46e 32%, #c9a24b 52%, #7d5f22 100%);
      box-shadow:
        0 22px 44px rgb(0 0 0 / 0.42),
        inset 0 0 0 6px rgb(255 255 255 / 0.88);
      pointer-events: none;
    }

    .auth-panel {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fdfcf9;
      border-radius: 0 22px 22px 0;
      padding: clamp(1.4rem, 3.4vw, 3rem) clamp(1.3rem, 4vw, 3.6rem);
      box-shadow: 0 42px 90px -42px rgb(0 0 0 / 0.5);
    }
    .auth-split:not(:has(> .auth-brand)) .auth-panel {
      border-radius: 22px;
    }
    .auth-wrap {
      width: 100%;
      max-width: 430px;
    }
    .auth-card {
      text-align: center;
    }

    .eyebrow {
      margin: 0 0 0.85rem;
      color: var(--gold);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.3em;
      text-transform: uppercase;
    }
    .auth-title {
      margin: 0;
      color: var(--ink);
      font-size: clamp(2.1rem, 3.4vw, 3rem);
      font-weight: 800;
      line-height: 1.02;
      letter-spacing: 0.015em;
      text-transform: uppercase;
    }
    .subtext {
      margin: 0.75rem 0 1.5rem;
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.45;
    }

    .field {
      display: grid;
      text-align: left;
      margin-bottom: 1.05rem;
    }
    .field-label {
      display: block;
      margin-bottom: 0.45rem;
      color: #8a857a;
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .field input {
      width: 100%;
      height: 52px;
      border: 0;
      border-radius: 14px;
      background: var(--cream);
      color: var(--ink);
      font-size: 1rem;
      padding: 0 1.1rem;
    }
    .field input::placeholder {
      color: #aba697;
    }
    .field input:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 1px;
    }
    .field input.mono {
      letter-spacing: 0.08em;
    }
    .field input.code-input {
      text-align: center;
      font-size: 1.35rem;
      letter-spacing: 0.35em;
    }
    .field-err {
      color: #b4453a;
      font-size: 0.78rem;
      margin-top: 0.4rem;
    }
    .form-err {
      text-align: center;
    }
    .success {
      color: #47713a;
      font-size: 0.85rem;
      margin-top: 0.75rem;
      text-align: center;
    }

    .pw-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .pw-row .field-label {
      margin-bottom: 0;
    }
    .forgot {
      border: 0;
      background: none;
      padding: 2px 0;
      color: var(--gold);
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .forgot:hover {
      text-decoration: underline;
    }
    .pw-wrap {
      position: relative;
      display: block;
      margin-top: 0.45rem;
    }
    .pw-wrap input {
      margin-top: 0;
      padding-right: 4.2rem;
    }
    .pw-toggle {
      position: absolute;
      right: 0.35rem;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: none;
      color: var(--gold-strong);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0.6rem 0.4rem;
    }
    .pw-toggle:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 1px;
      border-radius: 8px;
    }

    .check {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      margin: 0.25rem 0 1.3rem;
      cursor: pointer;
      user-select: none;
    }
    .check input {
      appearance: none;
      width: 19px;
      height: 19px;
      flex: none;
      border: 1.5px solid #d8d4c9;
      border-radius: 4px;
      background: #fff;
      position: relative;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .check input:checked {
      background: var(--gold);
      border-color: var(--gold);
    }
    .check input:checked::after {
      content: '';
      position: absolute;
      left: 5px;
      top: 1px;
      width: 5px;
      height: 10px;
      border: solid var(--on-gold);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    .check input:focus-visible {
      outline: 2px solid var(--gold);
      outline-offset: 2px;
    }
    .check span {
      font-size: 0.66rem;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .cta.signin {
      width: 100%;
      min-height: 56px;
      border: 0;
      border-radius: 14px;
      background: var(--gold);
      color: var(--on-gold);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      transition: filter 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .cta.signin:hover:not(:disabled) {
      filter: brightness(0.92);
    }
    .cta.signin:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .cta.signin:focus-visible {
      outline: 2px solid var(--on-gold);
      outline-offset: 2px;
    }
    .link {
      margin-top: 0.6rem;
      border: 0;
      background: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.8rem;
    }
    .link:hover {
      color: var(--gold-strong);
    }
    .auth-fine {
      margin: 1.1rem 0 0;
      color: var(--muted);
      font-size: 0.78rem;
      text-align: center;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .shake {
      animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }

    @media (max-width: 1100px) {
      .auth-brand {
        padding: 1.4rem 1.3rem;
      }
      .auth-panel {
        padding: 1.4rem 1.3rem;
      }
    }
    @media (max-width: 899px) {
      .auth-split {
        min-height: calc(100vh - 66px);
        padding: 0.75rem 0.75rem 1.2rem;
      }
      .auth-panel {
        border-radius: 18px;
        align-items: flex-start;
        padding-top: 1.75rem;
      }
    }
  `,
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly overviewPrefetch = inject(OverviewPrefetchService);
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
      showAppPreloader();
      try {
        this.overviewPrefetch.prefetch();
        await this.store.load();
        await this.router.navigateByUrl('/dashboard/overview', { replaceUrl: true });
      } catch {
        hideAppPreloader();
      }
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
      this.success.set(true);
      showAppPreloader();
      this.overviewPrefetch.prefetch();
      await this.store.load();
      const navigated = await this.router.navigateByUrl('/dashboard/overview', { replaceUrl: true });
      if (!navigated) {
        hideAppPreloader();
        this.formError.set('Signed in, but could not open the dashboard. Please try again.');
      }
    } catch (err) {
      hideAppPreloader();
      this.formError.set('Sign-in failed: staff accounts only.');
      this.triggerShake();
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitCode(): Promise<void> {
    const token = this.challengeToken();
    if (!token) return;
    this.formError.set(null);
    this.loading.set(true);

    try {
      await this.auth.verifyTwoFactor(this.code());
      this.challengeToken.set(null);
      this.code.set('');
      this.success.set(true);
      showAppPreloader();
      this.overviewPrefetch.prefetch();
      await this.store.load();
      const navigated = await this.router.navigateByUrl('/dashboard/overview', { replaceUrl: true });
      if (!navigated) {
        hideAppPreloader();
        this.formError.set('Verified, but could not open the dashboard. Please try again.');
      }
    } catch (err) {
      hideAppPreloader();
      this.formError.set('Incorrect or expired code.');
      this.triggerShake();
    } finally {
      this.loading.set(false);
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
    window.setTimeout(() => this.shake.set(false), 450);
  }
}
