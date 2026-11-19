import { Injectable, signal } from '@angular/core';

const KEY = 'seentair.badge.seen.v1';

function read(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(v: Record<string, number>) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

@Injectable({ providedIn: 'root' })
export class BadgeStateService {
  private readonly seen = signal<Record<string, number>>(read());

  /** Pure read: badges are evaluated in templates, so this must never write. */
  unseen(key: string, raw: number): number {
    return Math.max(0, raw - (this.seen()[key] ?? 0));
  }

  /**
   * Counts shrink when items get resolved. Re-anchor the baseline to the lower
   * raw outside template evaluation, so the next rise is measured from reality
   * instead of a stale high-water mark. Callers batch this in one effect.
   */
  reconcile(key: string, raw: number): void {
    if (raw < (this.seen()[key] ?? 0)) this.setSeen(key, raw);
  }

  markSeen(key: string, raw: number): void {
    if (raw <= (this.seen()[key] ?? 0)) return;
    this.setSeen(key, raw);
  }

  /** Mark current raw as fully viewed. */
  view(key: string, raw: number): void {
    this.setSeen(key, raw);
  }

  private setSeen(key: string, value: number): void {
    const next = { ...this.seen(), [key]: value };
    this.seen.set(next);
    write(next);
  }
}
