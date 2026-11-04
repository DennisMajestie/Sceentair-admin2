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
    ],
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: 'purchasing',
    path: '/purchasing/orders',
    pages: [
      { label: 'Purchase orders', path: '/purchasing/orders', badge: 'pos' },
      { label: 'Materials', path: '/purchasing/materials' },
      { label: 'Suppliers', path: '/purchasing/suppliers' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'dollar',
    path: '/accounting/ledger',
    pages: [
      { label: 'Ledger', path: '/accounting/ledger' },
    ],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: 'check',
    path: '/approvals',
    pages: [
      { label: 'Approval queue', path: '/approvals' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: 'alert',
    path: '/audit/log',
    pages: [
      { label: 'Audit log', path: '/audit/log' },
    ],
  },
  {
    id: 'coupons',
    label: 'Coupons',
    icon: 'ticket',
    path: '/coupons/wallet',
    pages: [
      { label: 'Wallet', path: '/coupons/wallet' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics',
    icon: 'truck',
    path: '/deliveries',
    pages: [
      { label: 'Deliveries', path: '/deliveries' },
    ],
  },
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: 'warehouses',
    path: '/warehouses/locations',
    pages: [
      { label: 'Locations', path: '/warehouses/locations' },
      { label: 'Cycle counts', path: '/warehouses/counts', badge: 'counts' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    path: '/analytics/overview',
    pages: [
      { label: 'Overview', path: '/analytics/overview' },
      { label: 'Sales', path: '/analytics/sales' },
      { label: 'Stock', path: '/analytics/stock' },
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
    ],
  },
  {
    id: 'wholesale',
    label: 'Wholesale',
    icon: 'store',
    path: '/wholesale/accounts',
    pages: [
      { label: 'Accounts', path: '/wholesale/accounts' },
      { label: 'Tiers', path: '/wholesale/tiers' },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    icon: 'card',
    path: '/media',
    pages: [
      { label: 'Library', path: '/media' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'chart',
    path: '/marketing/campaigns',
    pages: [
      { label: 'Campaigns', path: '/marketing/campaigns' },
    ],
  },
  {
    id: 'partners',
    label: 'Partners',
    icon: 'users',
    path: '/partners',
    pages: [
      { label: 'Partners', path: '/partners' },
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
