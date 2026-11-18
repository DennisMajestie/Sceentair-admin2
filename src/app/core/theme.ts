import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'pine' | 'ocean' | 'sky' | 'teal' | 'sage' | 'ochre' | 'rose' | 'slate' | 'custom';

export const ACCENTS: { id: Accent; label: string; hex: string }[] = [
  { id: 'pine', label: 'Pine', hex: '#b9531f' },
  { id: 'ocean', label: 'Ocean', hex: '#1f7f99' },
  { id: 'sky', label: 'Cobalt', hex: '#3a72c8' },
  { id: 'teal', label: 'Teal', hex: '#1d8a7b' },
  { id: 'sage', label: 'Sage', hex: '#6d9a2c' },
  { id: 'ochre', label: 'Ochre', hex: '#c88a12' },
  { id: 'rose', label: 'Rose', hex: '#cf4a5c' },
  { id: 'slate', label: 'Graphite', hex: '#6b7380' },
];

interface ViewTransitionLike {
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  readonly finished: Promise<void>;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

const THEME_KEY = 'vessa:theme';
const ACCENT_KEY = 'vessa:accent';
const ACCENT_CUSTOM_KEY = 'vessa:accent-custom';
const SIDE_KEY = 'vessa:side';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readTheme());
  readonly accent = signal<Accent>(readAccent());
  readonly customAccent = signal<string>(readCustomAccent());
  readonly railCollapsed = signal<boolean>(localStorage.getItem(SIDE_KEY) === 'collapsed');

  readonly resolved = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    if (mode !== 'system') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  constructor() {
    effect(() => {
      const root = document.documentElement;
      root.dataset['theme'] = this.resolved();
      root.dataset['accent'] = this.accent();
      root.style.colorScheme = this.resolved();
      if (this.accent() === 'custom') {
        root.style.setProperty('--primary', this.customAccent());
        root.style.setProperty('--on-primary', readableOnPrimary(this.customAccent()));
      }
    });
    effect(() => localStorage.setItem(THEME_KEY, this.mode()));
    effect(() => localStorage.setItem(ACCENT_KEY, this.accent()));
    effect(() => {
      if (this.accent() === 'custom') {
        localStorage.setItem(ACCENT_CUSTOM_KEY, this.customAccent());
      }
    });
    effect(() => localStorage.setItem(SIDE_KEY, this.railCollapsed() ? 'collapsed' : 'expanded'));
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /**
   * Switch theme with a circular reveal that grows from the control the person
   * clicked. Browsers without View Transitions (and reduced-motion users) get
   * an instant switch instead.
   */
  async setModeAnimated(mode: ThemeMode, event?: MouseEvent): Promise<void> {
    if (mode === this.mode()) return;
    const doc = document as ViewTransitionDocument;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduced) {
      this.setMode(mode);
      return;
    }

    const { x, y } = revealOrigin(event);
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const root = document.documentElement;
    root.classList.add('theme-reveal');
    try {
      const transition = doc.startViewTransition(async () => {
        this.mode.set(mode);
        // Let Angular flush the signal update into the DOM before the new
        // snapshot is taken (calling tick() here would re-enter change detection).
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      if (await settle(transition.ready, 900)) {
        try {
          await root.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
            },
            {
              duration: 720,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            } as KeyframeAnimationOptions,
          ).finished;
        } catch {
          // The reveal is decorative; the theme itself is already switched.
        }
      }
      await settle(transition.finished, 900);
    } catch {
      // A cancelled or unsupported transition must never strand the old theme.
      if (mode !== this.mode()) this.setMode(mode);
    } finally {
      root.classList.remove('theme-reveal');
    }
  }

  cycleMode(): void {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this.mode()) + 1) % order.length];
    this.mode.set(next);
  }

  setAccent(accent: Accent): void {
    this.accent.set(accent);
  }

  setCustomAccent(hex: string): void {
    this.customAccent.set(hex);
    this.accent.set('custom');
  }

  toggleRail(): void {
    this.railCollapsed.update((v) => !v);
  }
}

function settle(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true, () => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

function revealOrigin(event?: MouseEvent): { x: number; y: number } {
  if (!event) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  // Keyboard activation reports no coordinates; use the button's centre.
  if (event.detail === 0 || (event.clientX === 0 && event.clientY === 0)) {
    const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect?.();
    if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: event.clientX, y: event.clientY };
}

function readTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function readAccent(): Accent {
  const value = localStorage.getItem(ACCENT_KEY) as Accent | null;
  return ACCENTS.some((a) => a.id === value) || value === 'custom' ? (value as Accent) : 'pine';
}

function readCustomAccent(): string {
  return localStorage.getItem(ACCENT_CUSTOM_KEY) ?? '#b9531f';
}

function readableOnPrimary(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#1a1a1a' : '#ffffff';
}
