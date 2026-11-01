import { inject, Injectable, PLATFORM_ID, effect, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'sd-rail';
// Collapsed by default at or below 1100px (i.e. below 1101px); expanded above.
const COLLAPSE_BREAKPOINT = 1100;

@Injectable({ providedIn: 'root' })
export class SdShellStateService {
  private readonly platform = inject(PLATFORM_ID);

  readonly collapsed = signal<boolean>(this.readDefault());

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platform)) return;
      try {
        localStorage.setItem(STORAGE_KEY, this.collapsed() ? 'collapsed' : 'expanded');
      } catch {
        // storage quota/unavailable: state lives in memory only
      }
    });
  }

  toggle(): void {
    this.collapsed.update((v) => !v);
  }

  private readDefault(): boolean {
    if (!isPlatformBrowser(this.platform)) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'collapsed' || raw === 'expanded') {
        return raw === 'collapsed';
    }
    } catch {
      // storage unavailable: fall through to width-based default
    }
    return typeof window !== 'undefined' && window.innerWidth <= COLLAPSE_BREAKPOINT;
  }
}
