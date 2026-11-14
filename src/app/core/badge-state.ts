import { Injectable, signal } from '@angular/core';

const KEY = 'seentair.badge.seen.v1';

function read(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function write(v: Record<string, number>) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

@Injectable({ providedIn: 'root' })
export class BadgeStateService {
  private readonly seen = signal<Record<string, number>>(read());

  unseen(key: string, raw: number): number {
    const s = this.seen()[key] ?? 0;
    // if raw decreased (items resolved), reset baseline to raw so badge stays 0
    if (raw < s) { this.markSeen(key, raw); return 0; }
    return Math.max(0, raw - s);
  }

  markSeen(key: string, raw: number): void {
    const cur = this.seen()[key] ?? 0;
    if (raw <= cur) return;
    const next = { ...this.seen(), [key]: raw };
    this.seen.set(next);
    write(next);
  }

  /** Mark current raw as fully viewed. */
  view(key: string, raw: number): void {
    const next = { ...this.seen(), [key]: raw };
    this.seen.set(next);
    write(next);
  }
}
