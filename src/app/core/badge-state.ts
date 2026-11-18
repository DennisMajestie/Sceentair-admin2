import { Injectable, signal } from '@angular/core';

const KEY = 'seentair.badge.seen.v1';

function read(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(v: Record<string, number>) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

@Injectable({ providedIn: 'root' })
export class BadgeStateService {
  private readonly seen = signal<Record<string, number>>(read());
  private readonly pending = new Set<string>();

  unseen(key: string, raw: number): number {
    const s = this.seen()[key] ?? 0;
    // Counts shrink when items get resolved. Re-anchor the baseline to the new
    // (lower) raw so the next rise is measured from reality, not from a stale
    // high-water mark that would resurrect old "notifications". Badges are read
    // in templates (a reactive context), so defer the write until after render
    // instead of throwing NG0600 here.
    if (raw < s) {
      if (!this.pending.has(key)) {
        this.pending.add(key);
        queueMicrotask(() => {
          this.pending.delete(key);
          this.setSeen(key, raw);
        });
      }
      return 0;
    }
    return raw - s;
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
