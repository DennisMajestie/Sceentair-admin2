import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Store } from '../../core/store';

@Component({
  selector: 'app-signin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="signin">
      <div class="signin__card">
        <div class="signin__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3.5h8M9 3.5v3.2c0 .7-.3 1.3-.8 1.8A6.6 6.6 0 0 0 6 13.3v4.2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-4.2a6.6 6.6 0 0 0-2.2-4.8c-.5-.5-.8-1.1-.8-1.8V3.5" />
            <path d="M6.2 13.5c2-1 3.9-1 5.8 0s3.8 1 5.8 0" />
          </svg>
        </div>
        <h1 class="signin__title">Sign in to Vessa</h1>
        <p class="signin__sub">Use your Sentair staff account to access orders.</p>
        <form class="signin__form" (submit)="onSubmit($event)">
          @if (!twoFactor()) {
            <label class="field">
              <span class="field__label">Work email</span>
              <input type="email" name="email" autocomplete="username" [value]="email()" (input)="email.set($any($event.target).value)" required />
            </label>
            <label class="field">
              <span class="field__label">Password</span>
              <input type="password" name="password" autocomplete="current-password" [value]="password()" (input)="password.set($any($event.target).value)" required />
            </label>
          } @else {
            <p class="signin__sub">Enter the code from your authenticator app.</p>
            <label class="field">
              <span class="field__label">Authentication code</span>
              <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" [value]="code()" (input)="code.set($any($event.target).value)" required />
            </label>
          }
          @if (auth.error()) {
            <p class="signin__err" role="alert">{{ auth.error() }}</p>
          }
          <button type="submit" class="btn btn--primary btn--sm signin__go" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : twoFactor() ? 'Verify code' : 'Sign in' }}
          </button>
          @if (twoFactor()) {
            <button type="button" class="signin__back" [disabled]="busy()" (click)="cancelTwoFactor()">Back to sign in</button>
          }
        </form>
      </div>
    </div>
  `,
  styles: `
    .signin {
      display: grid;
      place-items: center;
      min-height: 100vh;
      background: var(--bg);
      padding: var(--gutter);
    }
    .signin__card {
      width: min(420px, 92vw);
      padding: 32px 28px;
      border-radius: var(--r-card);
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }
    .signin__mark {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--primary);
      color: var(--on-primary);
      display: grid;
      place-items: center;
      margin: 0 auto 16px;
    }
    .signin__mark svg { width: 22px; height: 22px; }
    .signin__title { font-size: var(--fs-4xl); font-weight: 700; letter-spacing: -0.03em; margin: 0 0 6px; text-align: center; }
    .signin__sub { text-align: center; color: var(--muted); font-size: var(--fs-md); margin: 0 0 24px; }
    .signin__form { display: grid; gap: 14px; }
    .field { display: grid; gap: 5px; }
    .field__label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
    .field input { width: 100%; padding: 9px 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--raised); font: inherit; }
    .signin__go { width: 100%; }
    .signin__err { margin: 0; font-size: var(--fs-sm); color: var(--bad); text-align: center; }
    .signin__back { border: 0; background: transparent; color: var(--primary); font: inherit; cursor: pointer; }
  `,
})
export class Signin {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly twoFactor = signal(false);
  protected readonly busy = signal(false);

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    try {
      if (this.twoFactor()) {
        await this.auth.verifyTwoFactor(this.code());
      } else {
        const result = await this.auth.login(this.email(), this.password());
        if (result.requires2fa) {
          this.twoFactor.set(true);
          return;
        }
      }
      await this.store.load();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/orders/all');
    } catch {
      // AuthService exposes a user-facing error and keeps the failed request visible.
    } finally {
      this.busy.set(false);
    }
  }

  protected cancelTwoFactor(): void {
    this.twoFactor.set(false);
    this.code.set('');
    this.password.set('');
    this.auth.cancelLogin();
  }
}
