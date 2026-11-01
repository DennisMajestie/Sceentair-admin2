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
