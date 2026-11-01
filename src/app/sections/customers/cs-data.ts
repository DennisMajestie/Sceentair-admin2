import { date, dateFull, money as fmtMoney, relative } from '../../core/format';

/** The app renders customer money in Naira through the existing formatter. */
export const NGN = 'NGN';

/**
 * Naira formatting on top of `money()` — minimal-ICU browsers (and the
 * headless test build) print the currency CODE ("NGN 1,250"); force the
 * ₦ glyph so the pages read Naira on every browser.
 */
export const moneyNgn = (value: number): string =>
  fmtMoney(value, NGN).replace(/^NGN\s?/, '₦');

export type SortDir = 'asc' | 'desc';

/**
 * Sort rows by a column key. `dir` is the user-facing direction after the
 * header chevron, NOT a stable asc/desc mapping — each column declares its
 * natural (first-click) direction via `startDesc`.
 */
export function sortRows<T>(
  rows: T[],
  key: string,
  dir: SortDir,
  natural: Record<string, 'asc' | 'desc'>,
  value: (row: T, key: string) => number | string,
): T[] {
  const fallback = natural[key] ?? 'desc';
  const factor = (dir ?? fallback) === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, key);
    const vb = value(b, key);
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * factor;
    }
    return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * factor;
  });
}

export interface LastOrderText {
  /** Primary line — relative within 7 days, short date beyond. */
  primary: string | null;
  /** Secondary line — full date, only shown when an order exists. */
  full: string | null;
}

/**
 * "3d ago / Tue, Oct 21 — 4:12 PM" within seven days; "Oct 14 / Mon, Sep 1 …" beyond.
 */
export function lastOrderLines(ts: number | null, now: number = Date.now()): LastOrderText {
  if (!ts) return { primary: null, full: null };
  const days = (now - ts) / 86400000;
  return { primary: days <= 7 ? relative(ts, now) : date(ts), full: dateFull(ts) };
}
