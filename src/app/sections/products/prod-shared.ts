/** Pure helpers for the product item page (unit-tested in prod-cs.spec.ts). */

export interface MoveLike {
  readonly at: number;
  readonly itemId: string;
  readonly qty: number;
  readonly kind: string;
}

export interface SaleDay {
  readonly ts: number;
  readonly units: number;
}

export interface SalesSeries {
  readonly days: SaleDay[];
  readonly totalUnits: number;
  readonly ratePerDay: number;
}

/** Same UTC-day bucket convention as store.startOfDay(). */
export function dayStart(ts: number): number {
  return Math.floor(ts / 86400000) * 86400000;
}

/** Units sold per day over the last `days` days (using the sale ledger). */
export function dailySales(
  moves: readonly MoveLike[],
  productId: string,
  days: number,
  now: number,
): SalesSeries {
  const today = dayStart(now);
  const first = today - (days - 1) * 86400000;
  const buckets = new Map<number, number>();
  let total = 0;
  for (const m of moves) {
    if (m.kind !== 'sale' || m.itemId !== productId) continue;
    const day = dayStart(m.at);
    if (day < first || day > today) continue;
    const units = Math.abs(m.qty);
    buckets.set(day, (buckets.get(day) ?? 0) + units);
    total += units;
  }
  const daysOut: SaleDay[] = [];
  for (let i = 0; i < days; i++) {
    const ts = first + i * 86400000;
    daysOut.push({ ts, units: buckets.get(ts) ?? 0 });
  }
  return { days: daysOut, totalUnits: total, ratePerDay: total / days };
}

/** Rolling average that uses the available window before it is full. */
export function trailingAvg(values: readonly number[], window: number): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < values.length; i++) {
    run += values[i];
    if (i >= window) run -= values[i - window];
    const size = i >= window ? window : i + 1;
    out.push(run / size);
  }
  return out;
}

/** Units of the product sitting on open orders. */
export function reservedUnits(
  openOrders: readonly { lines: readonly { productId: string; qty: number }[] }[],
  productId: string,
): number {
  let units = 0;
  for (const o of openOrders) {
    for (const l of o.lines) {
      if (l.productId === productId) units += l.qty;
    }
  }
  return units;
}

/** Cover days at the given sales rate; null when there is no recent pace. */
export function coverDays(available: number, ratePerDay: number): number | null {
  if (ratePerDay <= 0) return null;
  return Math.round((available / ratePerDay) * 10) / 10;
}

/** Margin percent; null when it cannot be real. */
export function marginPct(sell: number, cost: number): number | null {
  if (sell <= 0 || cost < 0) return null;
  return Math.round(((sell - cost) / sell) * 100);
}

/** Image status chip from the real stock thresholds; null = no chip. */
export function stockChip(available: number, reorderAt: number): { text: string; tone: 'bad' | 'warn' } | null {
  if (available <= 0) return { text: 'Out of stock', tone: 'bad' };
  if (available <= reorderAt) return { text: 'Low stock', tone: 'warn' };
  return null;
}

/** Each row's share of on-hand stock across rows (sums to 1). */
export function rowShares(units: readonly number[]): number[] {
  const total = units.reduce((a, b) => a + b, 0);
  if (total <= 0) return units.map(() => 0);
  return units.map((u) => u / total);
}

/** Nice rounded y-axis maxima from {1, 2, 4, 5} × 10^k. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const lead = max / base;
  const candidates = [1, 2, 4, 5];
  for (const c of candidates) {
    if (lead <= c) return c * base;
  }
  return 10 * base;
}

/** Ticks [0, half, max] labels for a series. */
export function tickLabels(max: number): { value: number; label: string }[] {
  const m = niceMax(max);
  const fmt = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(v % 1000 >= 500 ? 1 : 0)}k` : `${+v.toFixed(v >= 10 ? 0 : 2)}`);
  return [
    { value: 0, label: '0' },
    { value: m / 2, label: fmt(m / 2) },
    { value: m, label: fmt(m) },
  ];
}

/** Day-indices to label so they don't overlap; always includes the last. */
export function thinLabels(n: number): number[] {
  if (n <= 1) return [0];
  const stride = n > 45 ? 15 : 6;
  const out: number[] = [];
  for (let i = 0; i < n; i += stride) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

/** Sorting order/filter context shared between the catalog list and the item pager. */
export interface CatalogCtx {
  readonly ids: readonly string[];
}

const CTX_KEY = 'sd-catalog-ctx';

export function saveCatalogCtx(ids: readonly string[]): void {
  try {
    sessionStorage.setItem(CTX_KEY, JSON.stringify({ ids: [...ids] }));
  } catch {}
}

export function loadCatalogCtx(): CatalogCtx | undefined {
  try {
    const raw = sessionStorage.getItem(CTX_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { ids?: unknown };
    if (!Array.isArray(parsed.ids)) return undefined;
    const ids = parsed.ids.filter((v): v is string => typeof v === 'string');
    return ids.length > 0 ? { ids } : undefined;
  } catch {
    return undefined;
  }
}

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Monotone cubic (Fritsch–Carlson) bezier segments — never overshoots knots. */
export function monotoneSegments(pts: readonly Pt[]): { c1: Pt; c2: Pt; to: Pt }[] {
  const n = pts.length;
  if (n < 2) return [];
  const dx: number[] = [];
  const dy: number[] = [];
  const tan: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    tan.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const s: number[] = [tan[0]];
  for (let i = 1; i < n - 1; i++) {
    if (tan[i - 1] * tan[i] <= 0) s.push(0);
    else s.push((tan[i - 1] + tan[i]) / 2);
  }
  s.push(tan[n - 2]);
  // Fritsch–Carlson limiter.
  for (let i = 0; i < n - 1; i++) {
    if (tan[i] === 0) {
      s[i] = 0;
      s[i + 1] = 0;
    } else {
      const a = s[i] / tan[i];
      const b = s[i + 1] / tan[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        s[i] = (3 / h) * a * tan[i];
        s[i + 1] = (3 / h) * b * tan[i];
      }
    }
  }
  const segs: { c1: Pt; c2: Pt; to: Pt }[] = [];
  for (let i = 0; i < n - 1; i++) {
    segs.push({
      c1: { x: pts[i].x + dx[i] / 3, y: pts[i].y + (s[i] * dx[i]) / 3 },
      c2: { x: pts[i + 1].x - dx[i] / 3, y: pts[i + 1].y - (s[i + 1] * dx[i]) / 3 },
      to: pts[i + 1],
    });
  }
  return segs;
}

export function monotonePath(pts: readonly Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (const seg of monotoneSegments(pts)) {
    d += ` C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.to.x} ${seg.to.y}`;
  }
  return d;
}
