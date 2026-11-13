export interface NavPage {
  label: string;
  path: string;
  /** Key resolved against the store to produce a live count badge. */
  badge?: 'alerts' | 'orders' | 'lowStock' | 'pos' | 'counts' | 'transfers' | 'returns' | 'batches';
}

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  path: string;
  pages: NavPage[];
}

export const NAV: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'grid',
    path: '/dashboard/overview',
    pages: [
      { label: 'Overview', path: '/dashboard/overview' },
      { label: 'Activity', path: '/dashboard/activity' },
      { label: 'Alerts', path: '/dashboard/alerts', badge: 'alerts' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: 'package',
    path: '/products/catalog',
    pages: [
      { label: 'Catalog', path: '/products/catalog' },
      { label: 'Batches', path: '/products/batches', badge: 'batches' },
      { label: 'Reviews', path: '/products/reviews' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: 'cart',
    path: '/orders/all',
    pages: [
      { label: 'All orders', path: '/orders/all' },
      { label: 'Board', path: '/orders/board' },
      { label: 'Returns', path: '/orders/returns', badge: 'returns' },
      { label: 'Deliveries', path: '/deliveries' },
      { label: 'Custom orders', path: '/orders/custom' },
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'mail',
    path: '/messages',
    pages: [{ label: 'Messages', path: '/messages' }],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: 'purchasing',
    path: '/purchasing/orders',
    pages: [
      { label: 'Material purchases', path: '/purchasing/orders', badge: 'pos' },
      { label: 'Materials', path: '/purchasing/materials' },
      { label: 'Suppliers', path: '/purchasing/suppliers' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    icon: 'cube',
    path: '/production',
    pages: [
      { label: 'Queue', path: '/production' },
      { label: 'Tech packs', path: '/production/tech-packs' },
      { label: 'Floor kiosk', path: '/production/kiosk' },
    ],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: 'warehouses',
    path: '/warehouses/inventory',
    pages: [
      { label: 'Inventory', path: '/warehouses/inventory' },
      { label: 'Stock summary', path: '/warehouses/locations' },
      { label: 'Cycle counts', path: '/warehouses/counts', badge: 'counts' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'customers',
    path: '/customers/shoppers',
    pages: [
      { label: 'Shoppers', path: '/customers/shoppers' },
      { label: 'Stockists', path: '/customers/stockists' },
      { label: 'Wholesale accounts', path: '/wholesale/accounts' },
      { label: 'Wholesale tiers', path: '/wholesale/tiers' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'chart',
    path: '/marketing/campaigns',
    pages: [
      { label: 'Campaigns', path: '/marketing/campaigns' },
      { label: 'Coupon wallet', path: '/coupons/wallet' },
      { label: 'Coupon campaigns', path: '/coupons/campaigns' },
      { label: 'Media library', path: '/media' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'ledger',
    path: '/accounting/ledger',
    pages: [
      { label: 'Accounting ledger', path: '/accounting/ledger' },
      { label: 'Approval queue', path: '/approvals' },
      { label: 'Audit log', path: '/audit/log' },
      { label: 'Partners', path: '/partners' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    path: '/analytics/overview',
    pages: [
      { label: 'Reports', path: '/analytics/overview' },
      { label: 'Sales', path: '/analytics/sales' },
      { label: 'Stock health', path: '/analytics/stock' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/settings/account',
    pages: [
      { label: 'Account', path: '/settings/account' },
      { label: 'Company', path: '/settings/company' },
      { label: 'Team & roles', path: '/settings/team' },
      { label: 'Notifications', path: '/settings/notifications' },
      { label: 'Security', path: '/settings/security' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    icon: 'help',
    path: '/help/center',
    pages: [
      { label: 'Help center', path: '/help/center' },
      { label: 'My tickets', path: '/help/tickets' },
    ],
  },
];

/** Owners have no approval queue: their requests are approved immediately. */
export function navForRole(role?: string | null): NavSection[] {
  if (role !== 'business_owner_admin') return NAV;
  return NAV.map((section) => ({
    ...section,
    pages: section.pages.filter((page) => page.path !== '/approvals'),
  }));
}

/** Resolve the section for a URL: exact id match first, then by page path prefix. Falls back to dashboard. */
export function matchSection(url: string): NavSection {
  const path = (url || '').split('?')[0];
  const segment = path.split('/')[1] ?? 'dashboard';
  const byId = NAV.find((s) => s.id === segment);
  if (byId) return byId;
  const byPage = NAV.find((s) =>
    s.pages.some((p) => path === p.path || path.startsWith(`${p.path}/`)),
  );
  return byPage ?? NAV[0];
}
