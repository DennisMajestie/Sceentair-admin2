/** Formatting helpers shared across views. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Money renders in Naira app-wide; minimal-ICU browsers (and the headless
 * test build) print the currency CODE ("NGN 1,250"), so force the ₦ glyph.
 */
export function money(value: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
    .format(value)
    .replace(/^NGN\s?/, '₦');
}

export function moneyCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'NGN',
      notation: 'compact',
      maximumFractionDigits: 1,
    })
      .format(value)
      .replace(/^NGN\s?/, '₦');
  }
  return money(value);
}

export function count(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function compact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function date(ts: number): string {
  return `${MONTHS[new Date(ts).getMonth()]} ${new Date(ts).getDate()}`;
}

export function dateFull(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} — ${clockTime(ts)}`;
}

export function clockTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function monthYear(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function until(ts: number, now = Date.now()): string {
  const diff = ts - now;
  if (diff <= 0) return 'overdue';
  const hours = Math.round(diff / 3600000);
  if (hours < 1) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function daysUntil(ts: number, now = Date.now()): number {
  return Math.ceil((ts - now) / 86400000);
}

export function initials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value.replace(/(^|[\s-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function statusTone(status: string): string {
  switch (status) {
    case 'released':
    case 'delivered':
    case 'order_received':
    case 'received':
    case 'restocked':
    case 'refunded':
    case 'done':
    case 'paid':
    case 'good':
      return 'good';
    case 'hold':
    case 'quarantine':
    case 'partial':
    case 'requested':
    case 'scheduled':
    case 'in-transit':
    case 'counting':
    case 'sent':
    case 'draft':
    case 'awaiting_payment':
      return 'warn';
    case 'cancelled':
    case 'rejected':
    case 'returned':
    case 'stock_exception':
      return 'bad';
    case 'new':
    case 'picking':
    case 'packed':
    case 'shipped':
    case 'processing':
    case 'planned':
      return 'info';
    default:
      return '';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'in-transit':
      return 'In transit';
    case 'qa':
      return 'QA hold';
    default:
      return titleCase(status);
  }
}
