import { dateFull, initials as formatInitials, relative, date, titleCase } from './format';
import type { Customer, Order, Product } from './models';
import type { Store } from './store';

export interface CustomerMonthSpend {
  label: string;
  value: number;
  percent: number;
}

export interface CustomerOrderPreview {
  id: string;
  number: string;
  createdAt: number;
  units: number;
  total: number;
  status: string;
  statusLabel: string;
  statusTone: string;
}

export interface CustomerProductPreview {
  id: string;
  name: string;
  photo: string;
  quantity: number;
}

export interface CustomerDetailData {
  customer: Customer;
  initials: string;
  tone: string;
  location: string;
  contactLine: string;
  firstName: string;
  orderCount: number;
  cancelledCount: number;
  revenue: number;
  unpaid: number;
  averageOrder: number | null;
  hasWholesalePricing: boolean;
  lastOrder: { primary: string; full: string } | null;
  monthly: CustomerMonthSpend[];
  recentOrders: CustomerOrderPreview[];
  mostBought: CustomerProductPreview[];
}

export function orderStatusTone(status: string): string {
  switch (status) {
    case 'delivered':
      return 'good';
    case 'cancelled':
      return 'bad';
    case 'new':
    case 'picking':
    case 'packed':
    case 'shipped':
      return 'info';
    default:
      return 'quiet';
  }
}

export function relativeDateText(ts: number | null, now = Date.now()): { primary: string; full: string } | null {
  if (!ts) return null;
  return {
    primary: (now - ts) / 86400000 <= 7 ? relative(ts, now) : date(ts),
    full: dateFull(ts),
  };
}

export function monthlySpendBars(orders: readonly Order[], now = Date.now()): CustomerMonthSpend[] {
  const current = new Date(now);
  const periods = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(current.getFullYear(), current.getMonth() - 5 + index, 1);
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const value = orders
      .filter(
        (order) =>
          order.status !== 'cancelled' &&
          order.createdAt >= month.getTime() &&
          order.createdAt < nextMonth.getTime(),
      )
      .reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.qty * line.price, 0), 0);
    return {
      label: month.toLocaleString('en-US', { month: 'short' }),
      value: Math.round(value),
    };
  });
  const max = Math.max(...periods.map((period) => period.value), 0);
  return periods.map((period) => ({
    ...period,
    percent: max === 0 ? 4 : Math.max(4, (period.value / max) * 100),
  }));
}

export function buildCustomerDetail(
  store: Store,
  id: string | null,
  expectedKind?: Customer['kind'],
  fallbackCustomer?: Customer | null,
): CustomerDetailData | null {
  if (!id) return null;
  const customer = store.customerById()[id] ?? fallbackCustomer;
  if (
    !customer ||
    (customer.kind !== 'stockist' && customer.kind !== 'shopper') ||
    (expectedKind && customer.kind !== expectedKind)
  ) return null;

  let orders = store.orders().filter((order) => order.customerId === customer.id);
  if (orders.length === 0 && customer) {
    const custEmail = customer.email?.trim().toLowerCase();
    const custName = customer.name?.trim().toLowerCase();
    orders = store.orders().filter((order) => {
      if (order.customerId && order.customerId === customer.id) return true;
      const orderContact = ((order as any).customerContact || '').toLowerCase();
      if (custEmail && orderContact.includes(custEmail)) return true;
      const orderCust = ((order as any).customer || '').toLowerCase();
      return Boolean(custName && orderCust === custName);
    });
  }
  const sortedOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt);
  const completedOrders = orders.filter((order) => order.status !== 'cancelled');
  const revenue = completedOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const unpaid = completedOrders
    .filter((order) => !order.paid)
    .reduce((sum, order) => sum + orderTotal(order), 0);
  const monthly = monthlySpendBars(orders);
  const productQuantities = new Map<string, number>();
  for (const order of completedOrders) {
    for (const line of order.lines) {
      productQuantities.set(line.productId, (productQuantities.get(line.productId) ?? 0) + line.qty);
    }
  }

  const products = store.productById();
  const mostBought = [...productQuantities.entries()]
    .map(([productId, quantity]) => ({ product: products[productId], quantity }))
    .filter((entry): entry is { product: Product; quantity: number } => !!entry.product)
    .sort((a, b) => b.quantity - a.quantity || a.product.name.localeCompare(b.product.name))
    .slice(0, 4)
    .map(({ product, quantity }) => ({
      id: product.id,
      name: product.name,
      photo: product.photo,
      quantity,
    }));

  const lastOrder = relativeDateText(sortedOrders[0]?.createdAt ?? null);
  const location = [customer.city, customer.region].map((part) => part.trim()).filter(Boolean).join(', ');
  const contactLine = [customer.contact, customer.kind === 'stockist' ? 'Stockist' : 'Shopper', location]
    .filter(Boolean)
    .join(' · ');
  const tones = ['pine', 'ocean', 'ochre', 'sage', 'rose', 'slate'];
  const hash = [...customer.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    customer,
    initials: formatInitials(customer.name),
    tone: tones[hash % tones.length],
    location,
    contactLine,
    firstName: customer.contact.trim().split(/\s+/)[0] ?? '',
    orderCount: orders.length,
    cancelledCount: orders.filter((order) => order.status === 'cancelled').length,
    revenue: Math.round(revenue),
    unpaid: Math.round(unpaid),
    averageOrder: completedOrders.length ? Math.round(revenue / completedOrders.length) : null,
    hasWholesalePricing: orders.some((order) => order.channel === 'wholesale'),
    lastOrder,
    monthly,
    recentOrders: sortedOrders.slice(0, 6).map((order) => ({
      id: order.id,
      number: order.number,
      createdAt: order.createdAt,
      units: order.lines.reduce((sum, line) => sum + line.qty, 0),
      total: orderTotal(order),
      status: order.status,
      statusLabel: titleCase(order.status),
      statusTone: orderStatusTone(order.status),
    })),
    mostBought,
  };
}

function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.qty * line.price, 0);
}

let customerOpener: { kind: 'stockist' | 'shopper'; id: string } | null = null;

export function rememberCustomerOpener(kind: 'stockist' | 'shopper', id: string): void {
  customerOpener = { kind, id };
}

export function restoreCustomerOpener(kind: 'stockist' | 'shopper'): void {
  if (typeof document === 'undefined' || !customerOpener || customerOpener.kind !== kind) return;
  const { id } = customerOpener;
  customerOpener = null;
  requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-customer-opener]')).find(
      (element) => element.dataset['customerOpener'] === `${kind}:${id}`,
    );
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  });
}
