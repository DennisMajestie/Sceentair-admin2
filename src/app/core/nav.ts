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
    id: 'warehouses',
    label: 'Warehouses',
    icon: 'warehouses',
    path: '/warehouses/locations',
    pages: [
      { label: 'Locations', path: '/warehouses/locations' },
      { label: 'Cycle counts', path: '/warehouses/counts', badge: 'counts' },
      { label: 'Transfers', path: '/warehouses/transfers', badge: 'transfers' },
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
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/settings/account',
    pages: [
      { label: 'Account', path: '/settings/account' },
      { label: 'Company', path: '/settings/company' },
      { label: 'Team & roles', path: '/settings/team' },
      { label: 'Billing', path: '/settings/billing' },
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
