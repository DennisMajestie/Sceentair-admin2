import { Routes } from '@angular/router';
import { hideFromOwner, requireAuth } from './core/auth.guard';

export const routes: Routes = [
  { path: 'signin', loadComponent: () => import('./sections/login/login').then((m) => m.LoginPage) },
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
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/products/catalog').then((m) => m.ProductsCatalog),
  },
  {
    path: 'products/item/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/products/item').then((m) => m.ProductItem),
  },
  {
    path: 'products/reviews',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/products/reviews').then((m) => m.ProductsReviews),
  },
  {
    path: 'products/batches',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/products/batches').then((m) => m.ProductBatches),
  },
  {
    path: 'products/batches/:id',
    canActivate: [requireAuth],
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
    path: 'orders/board',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/board').then((m) => m.OrdersBoard),
  },
  {
    path: 'orders/returns',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/returns').then((m) => m.OrdersReturns),
  },
  {
    path: 'orders/returns/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/returns').then((m) => m.OrdersReturns),
  },

  {
    path: 'messages',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/messages/inbox').then((m) => m.MessagesInbox),
  },

  {
    path: 'production',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/production/queue').then((m) => m.ProductionQueue),
  },
  {
    path: 'production/tech-packs',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/production/tech-packs').then((m) => m.ProductionTechPacks),
  },
  {
    path: 'production/tech-packs/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/production/tech-packs').then((m) => m.ProductionTechPacks),
  },
  {
    path: 'production/kiosk',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/production/kiosk').then((m) => m.FloorKiosk),
  },
  {
    path: 'production/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/production/queue').then((m) => m.ProductionQueue),
  },
  {
    path: 'orders/custom',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/custom').then((m) => m.OrdersCustom),
  },
  {
    path: 'orders/custom/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/orders/custom').then((m) => m.OrdersCustom),
  },
  {
    path: 'purchasing/orders',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/purchasing/orders').then((m) => m.PurchasingOrders),
  },
  {
    path: 'purchasing/orders/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/purchasing/orders').then((m) => m.PurchasingOrders),
  },
  {
    path: 'purchasing/materials',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/purchasing/materials').then((m) => m.PurchasingMaterials),
  },
  {
    path: 'purchasing/materials/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/purchasing/materials').then((m) => m.PurchasingMaterials),
  },
  {
    path: 'purchasing/suppliers',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/purchasing/suppliers').then((m) => m.PurchasingSuppliers),
  },
  {
    path: 'purchasing/suppliers/:id',
    canActivate: [requireAuth],
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
    canActivate: [requireAuth, hideFromOwner],
    loadComponent: () => import('./sections/approvals/pending').then((m) => m.ApprovalsPending),
  },
  {
    path: 'approvals/:id',
    canActivate: [requireAuth, hideFromOwner],
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
    path: 'coupons/campaigns',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/coupons/campaigns').then((m) => m.CouponsCampaigns),
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
    path: 'warehouses/inventory',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/warehouses/inventory').then((m) => m.WarehouseStock),
  },
  {
    path: 'warehouses/inventory/:itemType/:itemId',
    canActivate: [requireAuth],
    loadComponent: () =>
      import('./sections/warehouses/inventory-detail').then((m) => m.WarehouseStockDetail),
  },
  {
    path: 'warehouses/locations',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/warehouses/locations').then((m) => m.WarehouseLocations),
  },
  {
    path: 'warehouses/locations/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/warehouses/locations').then((m) => m.WarehouseLocations),
  },
  {
    path: 'warehouses/counts',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/warehouses/counts').then((m) => m.WarehouseCounts),
  },
  {
    path: 'warehouses/counts/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/warehouses/counts').then((m) => m.WarehouseCounts),
  },
  {
    path: 'analytics/overview',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/analytics/overview').then((m) => m.AnalyticsOverview),
  },
  {
    path: 'analytics/sales',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/analytics/sales').then((m) => m.AnalyticsSales),
  },
  {
    path: 'analytics/stock',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/analytics/stock').then((m) => m.AnalyticsStock),
  },
  { path: 'analytics', redirectTo: 'analytics/overview' },

  {
    path: 'customers/shoppers',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'customers/stockists',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'customers/stockists/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/customers/stockists').then((m) => m.CustomerStockists),
  },
  {
    path: 'customers/shoppers/:id',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/customers/shoppers').then((m) => m.CustomerShoppers),
  },
  { path: 'customers', redirectTo: 'customers/stockists' },

  {
    path: 'settings/account',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/settings/account').then((m) => m.SettingsAccount),
  },
  {
    path: 'settings/company',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/settings/company').then((m) => m.SettingsCompany),
  },
  {
    path: 'settings/notifications',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/settings/notifications').then((m) => m.SettingsNotifications),
  },
  {
    path: 'settings/team',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/settings/team').then((m) => m.SettingsTeam),
  },
  {
    path: 'settings/security',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/settings/security').then((m) => m.SettingsSecurity),
  },

  {
    path: 'help/center',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/help/center').then((m) => m.HelpCenter),
  },
  {
    path: 'help/tickets',
    canActivate: [requireAuth],
    loadComponent: () => import('./sections/help/tickets').then((m) => m.HelpTickets),
  },
  { path: 'help', redirectTo: 'help/center' },

  { path: '**', redirectTo: 'dashboard/overview' },
];
