import { date, dateFull, money as fmtMoney, relative } from '../../core/format';
import type { ApiCustomer } from '../../core/customers-api.service';
import type { ApiOrder } from '../../core/orders-api.service';

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

/**
 * Synthesizes shopper accounts from storefront orders when the orders were
 * placed as guest checkouts (or when the customer record is missing from /customers).
 * Ensures that unique shoppers appear in the Shoppers list with their orders and spend linked.
 */
export function synthesizeGuestShoppers(
  existingCustomers: ApiCustomer[],
  orders: ApiOrder[],
): { customers: ApiCustomer[]; orders: ApiOrder[] } {
  const customers = [...existingCustomers];
  const linkedOrders: ApiOrder[] = [];

  const idMap = new Map<string, ApiCustomer>();
  const emailMap = new Map<string, ApiCustomer>();
  const nameMap = new Map<string, ApiCustomer>();

  for (const c of customers) {
    if (c.id) idMap.set(c.id, c);
    if (c.email?.trim()) emailMap.set(c.email.trim().toLowerCase(), c);
    if (c.name?.trim()) nameMap.set(c.name.trim().toLowerCase(), c);
  }

  const guestMap = new Map<string, ApiCustomer>();

  for (const o of orders) {
    const orderCopy: ApiOrder = { ...o };
    const orderCustId = orderCopy.customer?.id?.trim();
    const orderEmail = (orderCopy.customer?.email || orderCopy.guestEmail || '').trim().toLowerCase();
    const orderName = (orderCopy.customer?.name || orderCopy.guestName || '').trim();
    const orderNameLower = orderName.toLowerCase();

    // 1. Check if order matches an existing customer
    let matched: ApiCustomer | undefined;
    if (orderCustId && idMap.has(orderCustId)) {
      matched = idMap.get(orderCustId);
    } else if (orderEmail && emailMap.has(orderEmail)) {
      matched = emailMap.get(orderEmail);
    } else if (orderNameLower && nameMap.has(orderNameLower)) {
      matched = nameMap.get(orderNameLower);
    }

    if (matched) {
      orderCopy.customer = {
        id: matched.id,
        name: matched.name,
        email: matched.email || orderEmail,
        phone: matched.phone || orderCopy.customer?.phone || orderCopy.shippingAddress?.phone || null,
      };
      if (orderCopy.createdAt && (!matched.since || Date.parse(orderCopy.createdAt) < Date.parse(matched.since))) {
        matched.since = orderCopy.createdAt;
      }
      if (!matched.city && orderCopy.shippingAddress?.city) {
        matched.city = orderCopy.shippingAddress.city;
        matched.region = orderCopy.shippingAddress.state;
      }
      if (!matched.phone && (orderCopy.customer?.phone || orderCopy.shippingAddress?.phone)) {
        matched.phone = (orderCopy.customer?.phone || orderCopy.shippingAddress?.phone || '');
      }
      linkedOrders.push(orderCopy);
      continue;
    }

    // 2. If no name and no email and no customer id, leave as-is
    if (!orderName && !orderEmail && !orderCustId) {
      linkedOrders.push(orderCopy);
      continue;
    }

    // 3. Find or create a guest shopper
    const dedupKey = orderEmail
      ? `email:${orderEmail}`
      : orderCustId
        ? `id:${orderCustId}`
        : `name:${orderNameLower}`;

    let guestCust = guestMap.get(dedupKey);

    if (!guestCust) {
      const seed = (orderEmail || orderName || 'shopper').toLowerCase();
      const slug = seed.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
      const guestId = orderCustId || `guest-${slug || 'shopper'}`;

      guestCust = {
        id: guestId,
        name: orderName || orderEmail || 'Shopper',
        kind: 'shopper',
        contact: orderName || orderEmail || 'Shopper',
        email: orderEmail,
        phone: orderCopy.customer?.phone || orderCopy.shippingAddress?.phone || '',
        city: orderCopy.shippingAddress?.city || '',
        region: orderCopy.shippingAddress?.state || '',
        since: orderCopy.createdAt || new Date().toISOString(),
        tags: [],
        note: 'Customer derived from storefront orders',
      };

      guestMap.set(dedupKey, guestCust);
      customers.push(guestCust);
      idMap.set(guestCust.id, guestCust);
      if (orderEmail) emailMap.set(orderEmail, guestCust);
      if (orderNameLower) nameMap.set(orderNameLower, guestCust);
    } else {
      if (orderCopy.createdAt && Date.parse(orderCopy.createdAt) < Date.parse(guestCust.since)) {
        guestCust.since = orderCopy.createdAt;
      }
      if (!guestCust.city && orderCopy.shippingAddress?.city) {
        guestCust.city = orderCopy.shippingAddress.city;
        guestCust.region = orderCopy.shippingAddress.state;
      }
      if (!guestCust.phone && (orderCopy.customer?.phone || orderCopy.shippingAddress?.phone)) {
        guestCust.phone = orderCopy.customer?.phone || orderCopy.shippingAddress?.phone || '';
      }
    }

    orderCopy.customer = {
      id: guestCust.id,
      name: guestCust.name,
      email: guestCust.email,
      phone: guestCust.phone || null,
    };
    linkedOrders.push(orderCopy);
  }

  return { customers, orders: linkedOrders };
}
