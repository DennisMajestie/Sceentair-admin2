import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { ACCENTS, ThemeMode, ThemeService } from '../../core/theme';

@Component({
  selector: 'app-settings-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Your profile and how you sign in</span>
        <h1 class="head__title">Account</h1>
      </div>
    </div>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Profile</h2>
          <p class="card__sub">How teammates see you on orders, counts and the activity log</p>
        </div>
      </div>
      <div class="card__body">
        <div class="ident">
          <span class="av av--lg av--pine">{{ initials() }}</span>
          <div class="ident__text">
            <strong>{{ draft().name }}</strong>
            <span>{{ draft().title }}</span>
          </div>
        </div>
        <div class="fields">
          <label class="field">
            <span class="field__label">Full name</span>
            <input type="text" [value]="draft().name" (input)="patch('name', $any($event.target).value)" />
          </label>
          <label class="field">
            <span class="field__label">Work email</span>
            <input type="email" [value]="draft().email" (input)="patch('email', $any($event.target).value)" />
          </label>
          <label class="field">
            <span class="field__label">Job title</span>
            <input type="text" [value]="draft().title" (input)="patch('title', $any($event.target).value)" />
          </label>
          <label class="field">
            <span class="field__label">Phone</span>
            <input type="tel" [value]="draft().phone" (input)="patch('phone', $any($event.target).value)" />
          </label>
        </div>
      </div>
      <div class="card__foot">
        @if (dirty()) {
          <span class="badge badge--warn">Unsaved changes</span>
        } @else {
          <span class="hint">Saved to your account.</span>
        }
        <div class="card__foot__actions">
          @if (dirty()) {
            <button type="button" class="btn btn--ghost" (click)="discard()">Discard</button>
          }
          <button type="button" class="btn btn--primary" [disabled]="!dirty()" (click)="save()">Save profile</button>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Sign-in security</h2>
          <p class="card__sub">Two-factor authentication and session management are not available on this screen</p>
        </div>
      </div>
      <div class="card__body">
        <p class="hint">Password changes and active-session controls are handled by the authentication service.</p>
      </div>
    </article>

    <article class="card">
      <div class="card__head">
        <div>
          <h2 class="card__title">Appearance</h2>
          <p class="card__sub">Saved on this device</p>
        </div>
      </div>
      <div class="card__body appearance">
        <div class="field">
          <span class="field__label">Theme</span>
          <div class="seg" role="group" aria-label="Theme">
            @for (m of modes; track m.id) {
              <button type="button" class="seg__btn" [class.is-on]="theme.mode() === m.id" [attr.aria-pressed]="theme.mode() === m.id" (click)="theme.setMode(m.id)">
                {{ m.label }}
              </button>
            }
          </div>
        </div>
        <div class="field">
          <span class="field__label">Accent colour</span>
          <span class="accent__name">{{ accentName() }}</span>
          <div class="swatches">
            @for (a of accents; track a.id) {
              <button
                type="button"
                class="swatch"
                [class.is-on]="theme.accent() === a.id && theme.accent() !== 'custom'"
                [style.background]="a.hex"
                [title]="a.label"
                [attr.aria-label]="a.label"
                (click)="theme.setAccent(a.id)"
              ></button>
            }
            <label
              class="swatch swatch--custom"
              [class.is-on]="theme.accent() === 'custom'"
              [style.background]="theme.customAccent()"
              title="Custom colour"
            >
              <input
                type="color"
                class="swatch__input"
                [value]="theme.customAccent()"
                aria-label="Custom accent colour"
                (input)="setCustom($any($event.target).value)"
              />
            </label>
          </div>
          <p class="field__blurb">
            Buttons, links, the active page and chart highlights. Pick one, or choose any colour — Vessa
            tunes it so text stays readable in light and dark.
          </p>
        </div>
      </div>
    </article>
  `,
  styles: `
    article.card { margin-bottom: var(--gap); }
    .ident { display: flex; align-items: center; gap: 12px; }
    .ident__text { display: grid; line-height: 1.3; }
    .ident__text strong { font-size: var(--fs-lg); letter-spacing: -0.015em; }
    .ident__text span { font-size: var(--fs-xs); color: var(--muted); }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 13px; }
    .fields--3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .field { display: grid; gap: 5px; }
    .field__label { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }
    .field__hint { font-size: var(--fs-2xs); color: var(--faint); }
    .field__blurb { margin: 4px 0 0; font-size: var(--fs-xs); color: var(--muted); max-width: 62ch; }
    .card__foot {display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    gap: 12px; }
    .card__foot__actions { display: flex; gap: 8px; }
    .hint { font-size: var(--fs-xs); color: var(--faint); }
    .devices { list-style: none; margin: 0; padding: 0; }
    .appearance { display: grid; grid-template-columns: minmax(160px, 260px) minmax(0, 1fr); gap: 20px; }
    .accent__name { font-size: var(--fs-md); font-weight: 700; }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
    .swatch.is-on { border-color: var(--text); box-shadow: inset 0 0 0 2px var(--surface); }
    .swatch--custom { position: relative; display: block; padding: 0; }
    .swatch__input { width: 100%; height: 100%; border: none; border-radius: 50%; background: none; cursor: pointer; }
  `,
})
export class SettingsAccount {
  protected readonly store = inject(Store);
  protected readonly theme = inject(ThemeService);

  protected readonly accents = ACCENTS;
  protected readonly modes: { id: ThemeMode; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
  ];

  protected readonly me = computed(() => this.store.settings().me);
  protected readonly draft = signal({ name: '', email: '', title: '', phone: '' });

  protected readonly dirty = computed(() => {
    const me = this.me();
    const d = this.draft();
    return d.name !== me.name || d.email !== me.email || d.title !== me.title || d.phone !== me.phone;
  });

  protected readonly initials = computed(() =>
    this.draft()
      .name.split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  );

  protected readonly accentName = computed(
    () => {
      if (this.theme.accent() === 'custom') return 'Custom';
      return this.accents.find((a) => a.id === this.theme.accent())?.label ?? 'Copper';
    },
  );

  protected setCustom(hex: string): void {
    this.theme.setCustomAccent(hex);
  }

  constructor() {
    const me = this.me();
    this.draft.set({ name: me.name, email: me.email, title: me.title, phone: me.phone });
  }

  protected patch(key: 'name' | 'email' | 'title' | 'phone', value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected discard(): void {
    const me = this.me();
    this.draft.set({ name: me.name, email: me.email, title: me.title, phone: me.phone });
  }

  protected save(): void {
    this.store.updateMe(this.draft());
  }

}
