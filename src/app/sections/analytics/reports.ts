import { Order, Product } from '../../core/models';

export interface RangeSpec {
  id: string;
  label: string;
  days: number;
}

export const RANGES: RangeSpec[] = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: 'ytd', label: 'Year to date', days: 365 },
];

export interface Window {
  start: number;
  end: number;
  days: number;
}

export interface Totals {
  revenue: number;
  cost: number;
  orders: number;
  units: number;
  aov: number;
}

export interface ChannelRow {
  id: string;
  label: string;
  revenue: number;
  orders: number;
  units: number;
  pct: number;
  color: string;
}

export interface CategoryRow {
  name: string;
  revenue: number;
  pct: number;
}

export const CHANNEL_LABELS: Record<string, string> = {
  wholesale: 'Wholesale',
  online: 'Online store',
  studio: 'Studio shop',
};

export const CHANNEL_COLORS: Record<string, string> = {
  wholesale: 'var(--ocean)',
  online: 'var(--pine)',
  studio: 'var(--ochre)',
};

const STATES: Record<string, string> = {
  GA: 'Georgia',
  VT: 'Vermont',
  TX: 'Texas',
  NC: 'North Carolina',
  NM: 'New Mexico',
  MN: 'Minnesota',
  OR: 'Oregon',
  SC: 'South Carolina',
  CA: 'California',
  NY: 'New York',
  FL: 'Florida',
  WA: 'Washington',
  MA: 'Massachusetts',
  PA: 'Pennsylvania',
  IL: 'Illinois',
  CO: 'Colorado',
  ME: 'Maine',
  TN: 'Tennessee',
  OH: 'Ohio',
  MI: 'Michigan',
};

export function stateName(code: string): string {
  return STATES[code] ?? code;
}

export function orderRevenue(o: Order): number {
  return o.lines.reduce((a, l) => a + l.qty * l.price, 0);
}

export function orderUnits(o: Order): number {
  return o.lines.reduce((a, l) => a + l.qty, 0);
}

export function orderCost(o: Order, costOf: (id: string) => number): number {
  return o.lines.reduce((a, l) => a + l.qty * costOf(l.productId), 0);
}

export function windowFor(range: RangeSpec, now = Date.now(), fiscalStart = 'January'): Window {
  const end = now;
  if (range.id === 'ytd') {
    const d = new Date(now);
    const fiscalMonth = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ].indexOf(fiscalStart.toLowerCase());
    const startMonth = fiscalMonth < 0 ? 0 : fiscalMonth;
    const startYear = d.getMonth() < startMonth ? d.getFullYear() - 1 : d.getFullYear();
    const start = new Date(startYear, startMonth, 1).getTime();
    return { start, end, days: Math.max(1, Math.ceil((end - start) / 86400000)) };
  }
  return { start: end - range.days * 86400000, end, days: range.days };
}

export function previousWindow(w: Window, range?: RangeSpec): Window {
  if (range?.id === 'ytd') {
    const start = new Date(w.start);
    const end = new Date(w.end);
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    return {
      start: start.getTime(),
      end: end.getTime(),
      days: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)),
    };
  }
  return { start: w.start - (w.end - w.start), end: w.start, days: w.days };
}

export function ordersIn(orders: Order[], start: number, end: number): Order[] {
  return orders.filter((o) => o.status !== 'cancelled' && o.createdAt >= start && o.createdAt < end);
}

export function totalsOf(orders: Order[], costOf: (id: string) => number): Totals {
  let revenue = 0;
  let cost = 0;
  let units = 0;
  for (const o of orders) {
    revenue += orderRevenue(o);
    cost += orderCost(o, costOf);
    units += orderUnits(o);
  }
  return {
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    orders: orders.length,
    units,
    aov: orders.length > 0 ? Math.round(revenue / orders.length) : 0,
  };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function marginPct(t: Totals): number {
  if (t.revenue === 0) return 0;
  return ((t.revenue - t.cost) / t.revenue) * 100;
}

export interface Point {
  label: string;
  value: number;
}

export function dailyPoints(orders: Order[], w: Window): Point[] {
  const days = Math.max(1, Math.round((w.end - w.start) / 86400000));
  const buckets = new Map<number, number>();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    buckets.set(key, (buckets.get(key) ?? 0) + orderRevenue(o));
  }
  const points: Point[] = [];
  for (let i = 0; i < days; i++) {
    const t = w.start + i * 86400000;
    const d = new Date(t);
    points.push({
      label: `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`,
      value: Math.round(buckets.get(t) ?? 0),
    });
  }
  return points;
}

export type Granularity = 'day' | 'week' | 'month';

export function granularPoints(
  orders: Order[],
  w: Window,
  mode: Granularity,
  weekStart: 'mon' | 'sun' = 'mon',
): Point[] {
  const first = new Date(w.start);
  first.setHours(0, 0, 0, 0);
  const last = new Date(w.end);
  last.setHours(0, 0, 0, 0);
  const firstOrdinal = dateOrdinal(first);
  const lastOrdinal = dateOrdinal(last);
  const weekOffset = weekStart === 'mon' ? (first.getDay() + 6) % 7 : first.getDay();
  const firstWeekOrdinal = firstOrdinal - weekOffset;
  const buckets = new Map<number, number>();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const ordinal = dateOrdinal(d);
    const key =
      mode === 'week'
        ? firstWeekOrdinal + Math.floor((ordinal - firstWeekOrdinal) / 7) * 7
        : mode === 'month'
          ? d.getFullYear() * 12 + d.getMonth()
          : ordinal;
    buckets.set(key, (buckets.get(key) ?? 0) + orderRevenue(o));
  }
  const points: Point[] = [];
  if (mode === 'month') {
    const month = new Date(first.getFullYear(), first.getMonth(), 1);
    const endMonth = new Date(last.getFullYear(), last.getMonth(), 1);
    while (month <= endMonth) {
      const key = month.getFullYear() * 12 + month.getMonth();
      points.push({
        label: month.toLocaleString('en-US', { month: 'short' }),
        value: Math.round(buckets.get(key) ?? 0),
      });
      month.setMonth(month.getMonth() + 1);
    }
    return points;
  }
  const step = mode === 'week' ? 7 : 1;
  const firstBucketOrdinal = mode === 'week' ? firstWeekOrdinal : firstOrdinal;
  for (let offset = 0; firstBucketOrdinal + offset <= lastOrdinal; offset += step) {
    const ordinal = firstBucketOrdinal + offset;
    const d = dateFromOrdinal(ordinal);
    const key = ordinal;
    points.push({
      label:
        mode === 'week'
          ? `Week of ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`
          : `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`,
      value: Math.round(buckets.get(key) ?? 0),
    });
  }
  return points;
}

function dateOrdinal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function dateFromOrdinal(ordinal: number): Date {
  const utc = new Date(ordinal * 86400000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function bestDay(points: Point[]): Point | null {
  let best: Point | null = null;
  for (const p of points) if (!best || p.value > best.value) best = p;
  return best && best.value > 0 ? best : null;
}

export function channelRows(orders: Order[]): ChannelRow[] {
  const ids = ['wholesale', 'online', 'studio'];
  const total = orders.reduce((a, o) => a + orderRevenue(o), 0) || 1;
  return ids.map((id) => {
    const subset = orders.filter((o) => o.channel === id);
    const revenue = subset.reduce((a, o) => a + orderRevenue(o), 0);
    return {
      id,
      label: CHANNEL_LABELS[id],
      revenue: Math.round(revenue),
      orders: subset.length,
      units: subset.reduce((a, o) => a + orderUnits(o), 0),
      pct: (revenue / total) * 100,
      color: CHANNEL_COLORS[id],
    };
  });
}

export function categoryRows(
  orders: Order[],
  productOf: (id: string) => Product | undefined,
): CategoryRow[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const o of orders) {
    for (const l of o.lines) {
      const p = productOf(l.productId);
      const name = p?.category ?? 'Other';
      totals.set(name, (totals.get(name) ?? 0) + l.qty * l.price);
      grand += l.qty * l.price;
    }
  }
  return [...totals.entries()]
    .map(([name, revenue]) => ({
      name,
      revenue: Math.round(revenue),
      pct: grand > 0 ? (revenue / grand) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function stateRows(
  orders: Order[],
  regionOf: (order: Order) => string,
): { region: string; name: string; revenue: number; orders: number; pct: number }[] {
  const map = new Map<string, { revenue: number; orders: number }>();
  let grand = 0;
  for (const o of orders) {
    const region = regionOf(o);
    const entry = map.get(region) ?? { revenue: 0, orders: 0 };
    entry.revenue += orderRevenue(o);
    entry.orders += 1;
    map.set(region, entry);
    grand += orderRevenue(o);
  }
  return [...map.entries()]
    .map(([region, v]) => ({
      region,
      name: stateName(region),
      revenue: Math.round(v.revenue),
      orders: v.orders,
      pct: grand > 0 ? (v.revenue / grand) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
