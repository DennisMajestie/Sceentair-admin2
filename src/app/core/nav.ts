export interface NavPage {
  label: string;
  path: string;
  /** Key resolved against the store to produce a live count badge. */
  badge?: 'alerts' | 'activity' | 'catalog' | 'batches' | 'reviews' | 'allOrders' | 'board' | 'returns' | 'deliveries' | 'customOrders' | 'messages' | 'pos' | 'materials' | 'suppliers' | 'productionQueue' | 'techPacks' | 'kiosk' | 'inventory' | 'locations' | 'counts' | 'shoppers' | 'stockists' | 'wholesaleAccounts' | 'wholesaleTiers' | 'campaigns' | 'couponWallet' | 'couponCampaigns' | 'media' | 'ledger' | 'approvals' | 'audit' | 'partners' | 'reports' | 'sales' | 'stockHealth' | 'account' | 'company' | 'team' | 'notifications' | 'security' | 'helpCenter' | 'tickets';
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
      { label: 'Activity', path: '/dashboard/activity', badge: 'activity' },
      { label: 'Alerts', path: '/dashboard/alerts', badge: 'alerts' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    icon: 'package',
    path: '/products/catalog',
    pages: [
      { label: 'Catalog', path: '/products/catalog', badge: 'catalog' },
      { label: 'Batches', path: '/products/batches', badge: 'batches' },
      { label: 'Reviews', path: '/products/reviews', badge: 'reviews' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: 'cart',
    path: '/orders/all',
    pages: [
      { label: 'All orders', path: '/orders/all', badge: 'allOrders' },
      { label: 'In-store sale', path: '/orders/in-store' },
      { label: 'Board', path: '/orders/board', badge: 'board' },
      { label: 'Returns', path: '/orders/returns', badge: 'returns' },
      { label: 'Deliveries', path: '/deliveries', badge: 'deliveries' },
      { label: 'Custom orders', path: '/orders/custom', badge: 'customOrders' },
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'mail',
    path: '/messages',
    pages: [
      { label: 'Conversations', path: '/messages/inbox' },
      { label: 'Order updates', path: '/messages', badge: 'messages' },
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: 'purchasing',
    path: '/purchasing/orders',
    pages: [
      { label: 'Material purchases', path: '/purchasing/orders', badge: 'pos' },
      { label: 'Materials', path: '/purchasing/materials', badge: 'materials' },

    ],
  },
  {
    id: 'production',
    label: 'Production',
    icon: 'factory',
    path: '/production',
    pages: [
      { label: 'Queue', path: '/production', badge: 'productionQueue' },
      { label: 'Planning', path: '/production/planning' },
      { label: 'WIP', path: '/production/wip' },
      { label: 'Tech packs', path: '/production/tech-packs', badge: 'techPacks' },
      { label: 'Floor kiosk', path: '/production/kiosk', badge: 'kiosk' },
    ],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: 'warehouses',
    path: '/warehouses/inventory',
    pages: [
      { label: 'Inventory', path: '/warehouses/inventory', badge: 'inventory' },
      { label: 'Stock summary', path: '/warehouses/locations', badge: 'locations' },
      { label: 'Cycle counts', path: '/warehouses/counts', badge: 'counts' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'customers',
    path: '/customers/shoppers',
    pages: [
      { label: 'Shoppers', path: '/customers/shoppers', badge: 'shoppers' },
      { label: 'Stockists', path: '/customers/stockists', badge: 'stockists' },
      { label: 'Wholesale accounts', path: '/wholesale/accounts', badge: 'wholesaleAccounts' },
      { label: 'Wholesale tiers', path: '/wholesale/tiers', badge: 'wholesaleTiers' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'chart',
    path: '/marketing/campaigns',
    pages: [
      { label: 'Campaigns', path: '/marketing/campaigns', badge: 'campaigns' },
      { label: 'Loyalty', path: '/marketing/loyalty' },
      { label: 'Coupon wallet', path: '/coupons/wallet', badge: 'couponWallet' },
      { label: 'Coupon campaigns', path: '/coupons/campaigns', badge: 'couponCampaigns' },
      { label: 'Media library', path: '/media', badge: 'media' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'ledger',
    path: '/accounting/ledger',
    pages: [
      { label: 'Accounting ledger', path: '/accounting/ledger', badge: 'ledger' },
      { label: 'Payroll', path: '/accounting/payroll' },
      { label: 'Approval queue', path: '/approvals', badge: 'approvals' },
      { label: 'Audit log', path: '/audit/log', badge: 'audit' },
      { label: 'Partners', path: '/partners', badge: 'partners' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    path: '/analytics/overview',
    pages: [
      { label: 'Reports', path: '/analytics/overview', badge: 'reports' },
      { label: 'Sales', path: '/analytics/sales', badge: 'sales' },
      { label: 'Profitability', path: '/analytics/profitability' },
      { label: 'Stock health', path: '/analytics/stock', badge: 'stockHealth' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/settings/account',
    pages: [
      { label: 'Account', path: '/settings/account', badge: 'account' },
      { label: 'Company', path: '/settings/company', badge: 'company' },
      { label: 'Team & roles', path: '/settings/team', badge: 'team' },
      { label: 'Notifications', path: '/settings/notifications', badge: 'notifications' },
      { label: 'Security', path: '/settings/security', badge: 'security' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    icon: 'help',
    path: '/help/center',
    pages: [
      { label: 'Help center', path: '/help/center', badge: 'helpCenter' },
      { label: 'My tickets', path: '/help/tickets', badge: 'tickets' },
    ],
  },
];

/** Dashboard sections map to the backend module that gates them. */
const SECTION_MODULE: Record<string, string> = {
  products: 'catalogue',
  orders: 'retail_orders',
  messages: 'communication',
  purchasing: 'raw_materials',
  production: 'manufacturing',
  warehouses: 'inventory',
  customers: 'customers',
  marketing: 'marketing',
  finance: 'accounting',
  analytics: 'analytics',
};

/**
 * Hide sections the signed-in user cannot access. An empty access map means
 * no restriction was supplied (owner-like sessions); an explicit `none` on a
 * module removes its section. The API remains authoritative — this is only
 * navigation hygiene, never a security boundary.
 */
export function navForRole(access?: Record<string, string> | null): NavSection[] {
  if (!access || Object.keys(access).length === 0) return NAV;
  return NAV.filter((section) => {
    const module = SECTION_MODULE[section.id];
    return !module || access[module] !== 'none';
  });
}

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
