import { Routes } from '@angular/router';
import { requireAuth } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard/overview' },

  {
    path: 'dashboard/overview',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/dashboard/overview').then((m) => m.DashboardOverview),
  },
  {
    path: 'dashboard/activity',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/dashboard/activity').then((m) => m.DashboardActivity),
  },
  {
    path: 'dashboard/alerts',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/dashboard/alerts').then((m) => m.DashboardAlerts),
  },

  {
    path: 'products/catalog',
    loadComponent: () => import('./sections/products/catalog').then((m) => m.ProductsCatalog),
  },
  {
    path: 'products/item/:id',
    loadComponent: () => import('./sections/products/item').then((m) => m.ProductItem),
  },
  {
    path: 'products/batches',
    loadComponent: () => import('./sections/products/batches').then((m) => m.ProductBatches),
  },
  {
    path: 'products/batches/:id',
    loadComponent: () => import('./sections/products/batches').then((m) => m.ProductBatches),
  },

  {
    path: 'orders/all',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/all').then((m) => m.OrdersAll),
  },
  {
    path: 'orders/all/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/all').then((m) => m.OrdersAll),
  },
  {
    path: 'signin',
    loadComponent: () => import('./sections/signin/signin').then((m) => m.Signin),
  },
  {
    path: 'orders/board',
    loadComponent: () => import('./sections/orders/board').then((m) => m.OrdersBoard),
  },
  {
    path: 'orders/returns',
    loadComponent: () => import('./sections/orders/returns').then((m) => m.OrdersReturns),
  },
  {
    path: 'orders/returns/:id',
    loadComponent: () => import('./sections/orders/returns').then((m) => m.OrdersReturns),
  },

  {
    path: 'purchasing/orders',
    loadComponent: () => import('./sections/purchasing/orders').then((m) => m.PurchasingOrders),
  },
  {
    path: 'purchasing/orders/:id',
    loadComponent: () => import('./sections/purchasing/orders').then((m) => m.PurchasingOrders),
  },
  {
    path: 'purchasing/materials',
    loadComponent: () => import('./sections/purchasing/materials').then((m) => m.PurchasingMaterials),
  },
  {
    path: 'purchasing/materials/:id',
    loadComponent: () => import('./sections/purchasing/materials').then((m) => m.PurchasingMaterials),
  },
  {
    path: 'purchasing/suppliers',
    loadComponent: () => import('./sections/purchasing/suppliers').then((m) => m.PurchasingSuppliers),
  },
  {
    path: 'purchasing/suppliers/:id',
    loadComponent: () => import('./sections/purchasing/suppliers').then((m) => m.PurchasingSuppliers),
  },
  {
    path: 'accounting/ledger',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/accounting/ledger').then((m) => m.AccountingLedger),
  },
  {
    path: 'accounting/ledger/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/accounting/ledger').then((m) => m.AccountingLedger),
  },
  {
    path: 'approvals',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/approvals/pending').then((m) => m.ApprovalsPending),
  },
  {
    path: 'approvals/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/approvals/pending').then((m) => m.ApprovalsPending),
  },
  {
    path: 'audit/log',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/audit/log').then((m) => m.AuditLog),
  },
  {
    path: 'audit/log/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/audit/log').then((m) => m.AuditLog),
  },
  {
    path: 'coupons/wallet',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/coupons/wallet').then((m) => m.CouponsWallet),
  },
  {
    path: 'deliveries',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/deliveries/list').then((m) => m.DeliveriesList),
  },
  {
    path: 'deliveries/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/deliveries/list').then((m) => m.DeliveriesList),
  },
  {
    path: 'media',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/media/library').then((m) => m.MediaLibrary),
  },
  {
    path: 'media/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/media/library').then((m) => m.MediaLibrary),
  },
  {
    path: 'marketing/campaigns',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/marketing/campaigns').then((m) => m.MarketingCampaigns),
  },
  {
    path: 'marketing/campaigns/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/marketing/campaigns').then((m) => m.MarketingCampaigns),
  },
  {
    path: 'partners',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/partners/list').then((m) => m.PartnersList),
  },
  {
    path: 'partners/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/partners/list').then((m) => m.PartnersList),
  },
  {
    path: 'wholesale/accounts',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/wholesale/accounts').then((m) => m.WholesaleAccounts),
  },
  {
    path: 'wholesale/accounts/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/wholesale/accounts').then((m) => m.WholesaleAccounts),
  },
  {
    path: 'wholesale/tiers',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/wholesale/tiers').then((m) => m.WholesaleTiers),
  },
  {
    path: 'wholesale/tiers/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/wholesale/tiers').then((m) => m.WholesaleTiers),
  },

  {
    path: 'warehouses/locations',
    loadComponent: () => import('./sections/warehouses/locations').then((m) => m.WarehouseLocations),
  },
  {
    path: 'warehouses/locations/:id',
    loadComponent: () => import('./sections/warehouses/locations').then((m) => m.WarehouseLocations),
  },
  {
    path: 'warehouses/counts',
    loadComponent: () => import('./sections/warehouses/counts').then((m) => m.WarehouseCounts),
  },
  {
    path: 'warehouses/counts/:id',
    loadComponent: () => import('./sections/warehouses/counts').then((m) => m.WarehouseCounts),
  },
  {
    path: 'analytics/overview',
    loadComponent: () => import('./sections/analytics/overview').then((m) => m.AnalyticsOverview),
  },
  {
    path: 'analytics/sales',
    loadComponent: () => import('./sections/analytics/sales').then((m) => m.AnalyticsSales),
  },
  {
    path: 'analytics/stock',
    loadComponent: () => import('./sections/analytics/stock').then((m) => m.AnalyticsStock),
  },
  { path: 'analytics', redirectTo: 'analytics/overview' },

  {
    path: 'customers/shoppers',
    loadComponent: () => import('./sections/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'customers/stockists',
    loadComponent: () => import('./sections/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'customers/stockists/:id',
    loadComponent: () => import('./sections/customers/stockists').then((m) => m.CustomerStockists),
  },
  {
    path: 'customers/shoppers/:id',
    loadComponent: () => import('./sections/customers/shoppers').then((m) => m.CustomerShoppers),
  },
  { path: 'customers', redirectTo: 'customers/stockists' },

  {
    path: 'settings/account',
    loadComponent: () => import('./sections/settings/account').then((m) => m.SettingsAccount),
  },
  {
    path: 'settings/company',
    loadComponent: () => import('./sections/settings/company').then((m) => m.SettingsCompany),
  },
  {
    path: 'settings/notifications',
    loadComponent: () => import('./sections/settings/notifications').then((m) => m.SettingsNotifications),
  },
  {
    path: 'settings/team',
    loadComponent: () => import('./sections/settings/team').then((m) => m.SettingsTeam),
  },

  {
    path: 'help/center',
    loadComponent: () => import('./sections/help/center').then((m) => m.HelpCenter),
  },
  {
    path: 'help/tickets',
    loadComponent: () => import('./sections/help/tickets').then((m) => m.HelpTickets),
  },
  { path: 'help', redirectTo: 'help/center' },

  { path: '**', redirectTo: 'dashboard/overview' },
];
