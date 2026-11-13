import { Injectable, computed, signal, inject } from '@angular/core';
import { CatalogueApiService, primaryProductImage, type ApiProduct } from './catalogue-api.service';
import { CustomersApiService, type ApiCustomer } from './customers-api.service';
import { HelpApiService, type ApiTicket } from './help-api.service';
import { InventoryApiService, type ApiCount } from './inventory-api.service';
import { MaterialsApiService, type ApiMaterial, type ApiPurchase } from './materials-api.service';
import { OrdersApiService, type ApiOrder } from './orders-api.service';
import { SuppliersApiService, type ApiSupplier } from './suppliers-api.service';
import { ProductionApiService } from './production-api.service';
import { ReturnsApiService } from './returns-api.service';
import { UsersApiService } from './users-api.service';
import { NotificationsApiService } from './notifications-api.service';
import { AccountingApiService, type ApiLedgerEntry, type ApiLedgerList } from './accounting-api.service';
import { ApprovalsApiService } from './approvals-api.service';
import { AuditApiService } from './audit-api.service';
import { AuthService } from './auth.service';
import { BusinessApiService } from './business-api.service';
import { synthesizeGuestShoppers } from '../sections/customers/cs-data';
import {
  Batch,
  CountStatus,
  Customer,
  CycleCount,
  Location,
  Material,
  Move,
  Notice,
  Order,
  Product,
  PurchaseOrder,
  Return,
  SeriesPoint,
  Settings,
  Supplier,
  Teammate,
  Ticket,
  TicketStatus,
  Transfer,
  LedgerEntry,
  Approval,
} from './models';
import { canAdvanceOrder } from './order-flow';

function emptySeed(): import('./models').Seed {
  return {
    version: 1,
    team: [],
    locations: [],
    products: [],
    batches: [],
    materials: [],
    suppliers: [],
    pos: [],
    customers: [],
    orders: [],
    returns: [],
    transfers: [],
    counts: [],
    moves: [],
    activity: [],
    notices: [],
    tickets: [],
    months: [],
    weeks: [],
    ledgerEntries: [],
    approvals: [],
    settings: {
      me: { id: '', name: '', email: '', title: '', phone: '' },
      company: {
        name: '',
        legal: '',
        address: '',
        phone: '',
        email: '',
        taxId: '',
        currency: '',
        timezone: '',
        fiscalStart: '',
      },
      billing: {
        plan: '',
        seats: 0,
        cycle: '',
        card: { brand: '', last4: '', exp: '', name: '' },
        invoices: [],
      },
      notify: {},
      prefs: {
        expiryWarnDays: 0,
        lowStockMode: '',
        defaultLoc: '',
        weekStart: '',
      },
      goal: 0,
    },
  };
}

function mapProduct(p: ApiProduct): Product {
  const variant = p.variants?.[0];
  return {
    id: p.id,
    sku: variant?.sku ?? p.id,
    name: p.name,
    line: p.category ?? '',
    size: p.sizeClass ?? '',
    category: p.category ?? '',
    photo: primaryProductImage(p) ?? '',
    price: p.salePrice ?? p.basePrice,
    wholesale: p.salePrice ?? p.basePrice,
    cost: p.basePrice,
    reorderAt: 0,
    reorderQty: 0,
    bin: variant?.storageLocation ?? '',
    shelfMonths: 0,
    active: true,
    barcode: '',
    bom: [],
    blurb: p.description ?? '',
    stock: {},
    variantIds: p.variants.map((item) => item.id),
  };
}

function mapMaterial(m: ApiMaterial): Material {
  return {
    id: m.id,
    code: m.id,
    name: m.name,
    kind: 'Ingredient',
    unit: m.unit,
    reorderAt: m.reorderThreshold,
    reorderQty: 0,
    cost: 0,
    supplierId: '',
    locId: m.storageLocation ?? '',
    onHand: m.currentQuantity,
  };
}

function mapSupplier(s: ApiSupplier): Supplier {
  return {
    id: s.id,
    name: s.name,
    country: s.location ?? '',
    city: '',
    contact: '',
    email: '',
    phone: '',
    leadDays: 0,
    onTime: s.slaScore ?? 0,
    rating: s.slaScore ?? 0,
    supplies: s.category ?? '',
    tone: '',
    since: 0,
    favorite: false,
  };
}

function mapCustomer(c: ApiCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    contact: c.contact,
    email: c.email,
    phone: c.phone,
    city: c.city,
    region: c.region,
    since: Date.parse(c.since) || 0,
    tags: c.tags,
    note: c.note,
  };
}

function mapOrder(o: ApiOrder): Order {
  return {
    id: o.id,
    number: o.id,
    orderNumber: o.orderNumber == null ? undefined : String(o.orderNumber),
    customerId: o.customer?.id ?? '',
    customerName: o.customer?.name ?? o.guestName ?? '',
    channel:
      o.channel === 'wholesale' ? 'wholesale' : o.channel === 'custom' ? 'studio' : 'online',
    status: o.status as Order['status'],
    createdAt: Date.parse(o.createdAt) || 0,
    shipBy: Date.parse(o.updatedAt) || 0,
    locId: '',
    lines: (o.items ?? []).map((i) => ({
      productId: i.variant.product?.id ?? i.variant.id,
      qty: i.quantity,
      price: i.unitPrice,
    })),
    carrier: o.deliveryMethod ?? '',
    paid: o.paymentStatus === 'paid',
    history: [],
  };
}

function mapCount(c: ApiCount): CycleCount {
  return {
    id: c.id,
    number: c.id,
    locId: '',
    zone: '',
    status: c.status as CountStatus,
    at: Date.parse(c.createdAt) || 0,
    byId: '',
    lines: (c.lines ?? []).map((l) => ({
      productId: l.itemId,
      expected: 0,
      counted: l.countedQuantity,
    })),
  };
}

function mapPurchase(p: ApiPurchase): PurchaseOrder {
  const purchasedAt = Date.parse(p.purchasedAt) || 0;
  return {
    id: p.id,
    number: p.id.slice(0, 8).toUpperCase(),
    supplierId: p.supplierName ?? '',
    status: 'received',
    createdAt: purchasedAt,
    sentAt: null,
    eta: null,
    receivedAt: purchasedAt,
    leadTimeDays: p.leadTimeDays,
    recordedBy: p.recordedBy,
    readAt: null,
    lines: [
      {
        materialId: p.material.id,
        qty: p.quantity,
        cost: p.cost,
        received: p.quantity,
      },
    ],
    note: p.note ?? '',
  };
}

function mapBatch(
  b: import('./production-api.service').ApiProductionBatch,
  products: Product[],
): Batch {
  const stage = b.stage.toLowerCase();
  const status: Batch['status'] =
    b.completedDate || stage === 'completed'
      ? 'released'
      : stage.includes('quality')
        ? 'quarantine'
        : 'hold';
  const product = products.find((p) => (p.variantIds ?? []).includes(b.variant.id));
  return {
    id: b.id,
    lot: b.barcode ?? b.id.slice(0, 8).toUpperCase(),
    productId: product?.id ?? b.variant.id,
    madeAt: Date.parse(b.createdAt) || 0,
    expiresAt: 0,
    qty: b.quantity,
    left: b.quantity,
    locId: b.variant.storageLocation ?? '',
    status,
    chemistId: b.createdBy ?? '',
  };
}

function mapReturn(
  r: import('./returns-api.service').ApiReturn,
  products: Product[],
): Return {
  const status: Return['status'] =
    r.status === 'requested'
      ? 'requested'
      : r.status === 'rejected'
        ? 'rejected'
        : r.restocked
          ? 'restocked'
          : 'refunded';
  const product = products.find((p) => (p.variantIds ?? []).includes(r.variant.id));
  return {
    id: r.id,
    number: r.id.slice(0, 8).toUpperCase(),
    orderId: r.order.id,
    productId: product?.id ?? r.variant.id,
    qty: r.quantity,
    reason: r.reason,
    status,
    createdAt: Date.parse(r.requestedAt) || 0,
    refund: r.refundAmount ?? 0,
    trackingNumber: r.trackingNumber ?? null,
    bayTag: r.bayTag ?? null,
    damaged: r.damaged,
    restocked: r.restocked,
    resolution: r.resolution ?? null,
    resolvedAt: Date.parse(r.resolvedAt ?? '') || null,
    resolvedBy: r.resolvedBy ?? null,
    photoUrls: r.photoUrls ?? [],
  };
}

const ROLE_MAP: Record<string, Teammate['role']> = {
  business_owner_admin: 'admin',
  management: 'manager',
  sales: 'staff',
  inventory: 'staff',
  production: 'staff',
  finance_accounting: 'staff',
  partner_investor: 'viewer',
  wholesaler: 'viewer',
  customer: 'viewer',
};

const ROLE_DEPT: Record<string, Teammate['team']> = {
  business_owner_admin: 'Operations',
  management: 'Operations',
  sales: 'Sales',
  inventory: 'Warehouse',
  production: 'Lab',
  finance_accounting: 'Finance',
  partner_investor: 'Finance',
  wholesaler: 'Support',
  customer: 'Support',
};

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapTeammate(u: import('./users-api.service').ApiUser): Teammate {
  const roleName = u.role?.name ?? '';
  return {
    id: u.id,
    name: u.name,
    title: titleCase(roleName),
    team: ROLE_DEPT[roleName] ?? 'Operations',
    role: ROLE_MAP[roleName] ?? 'viewer',
    apiRoleName: roleName,
    email: u.email,
    phone: u.phone ?? '',
    locId: '',
    tone: 'sage',
    status: u.status,
    since: Date.parse(u.createdAt) || 0,
    permissions: u.role.permissions ?? [],
  };
}

function mapNotice(n: import('./notifications-api.service').ApiNotification): Notice {
  return {
    id: n.id,
    at: Date.parse(n.sentAt) || 0,
    text: n.message,
    href: n.relatedOrderId ? `/orders/all/${n.relatedOrderId}` : '/dashboard',
    read: !!n.readAt,
    kind: n.type,
  };
}

function mapLedgerEntry(e: ApiLedgerEntry): LedgerEntry {
  return {
    id: e.id,
    type: e.type,
    amount: e.amount,
    category: e.category,
    referenceId: e.referenceId,
    recordedBy: e.recordedBy,
    entryAt: Date.parse(e.entryAt) || 0,
  };
}

function mapApproval(a: import('./approvals-api.service').ApiApproval): Approval {
  const actorName = (
    actor: import('./approvals-api.service').ApiApproval['requestedBy'],
  ): string | null => {
    if (!actor) return null;
    if (typeof actor === 'string') return actor;
    return actor.name ?? actor.email ?? actor.id ?? null;
  };
  return {
    id: a.id,
    actionType: a.actionType,
    payload: a.payload,
    requestedBy: actorName(a.requestedBy),
    status: a.status,
    approvedBy: actorName(a.approvedBy),
    justification: a.justification,
    decidedAt: Date.parse(a.decidedAt ?? '') || null,
    createdAt: Date.parse(a.createdAt) || 0,
  };
}

function readableActivityTitle(action: string): string {
  const httpMatch = action.match(/^([A-Z]+)\s+\/api\/v\d+\/(.*)$/);
  if (httpMatch) {
    const path = httpMatch[2].split('?')[0];
    return `${httpMatch[1]} ${path}`;
  }
  return action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safeActivityText(afterState: unknown): string {
  if (!afterState || typeof afterState !== 'object' || Array.isArray(afterState)) return '';
  const fragments: string[] = [];
  for (const [key, value] of Object.entries(afterState)) {
    if (/token|password|secret|email|id$/i.test(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    const text = String(value);
    fragments.push(`${key}: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`);
    if (fragments.length >= 3) break;
  }
  return fragments.join(' · ');
}

function activityKind(action: string): string {
  const http = action.match(/^[A-Z]+\s+\/api\/v\d+\/?(.*)$/i);
  if (http) {
    const path = http[1].split(/[?#]/)[0].toLowerCase();
    const head = path.split('/')[0] ?? '';
    if (head === 'returns') return 'return';
    if (
      head === 'purchase-orders' ||
      head === 'purchases' ||
      head === 'suppliers' ||
      path.startsWith('materials/purchases') ||
      path.startsWith('materials/suppliers')
    ) {
      return 'po';
    }
    if (head === 'orders' || head === 'change-requests') return 'order';
    if (
      head === 'inventory' ||
      head === 'stock' ||
      head === 'warehouses' ||
      head === 'materials' ||
      head === 'production-batches' ||
      head === 'production' ||
      head === 'batches' ||
      head === 'counts'
    ) {
      return 'stock';
    }
    if (head === 'cart' || head === 'checkout' || head === 'storefront' || head === 'shop' || head === 'catalog') {
      return 'web';
    }
    if (head === 'auth' || head === 'health' || head === 'metrics') return 'security';
    return 'audit';
  }
  const key = (action.split(/[.:]/)[0] ?? '').toLowerCase();
  if (key.includes('return')) return 'return';
  if (key.includes('order')) return 'order';
  if (key.includes('purchas') || key.includes('supplier') || key === 'po' || key.includes('receipt')) return 'po';
  if (['stock', 'inventory', 'batch', 'count', 'move', 'adjust'].some((part) => key.includes(part))) return 'stock';
  if (['web', 'shop', 'storefront', 'checkout', 'cart'].some((part) => key.includes(part))) return 'web';
  return key || 'audit';
}

const MOVE_KIND: Record<string, Move['kind']> = {
  purchase: 'receipt',
  production: 'production',
  sale: 'sale',
  return: 'return',
  damage: 'adjust',
  dispatch: 'transfer',
  adjustment: 'adjust',
};

function mapInventoryMovement(
  itemType: 'variant' | 'material',
  itemId: string,
  m: import('./inventory-api.service').ApiInventoryMovement,
): Move {
  return {
    id: m.id,
    at: Date.parse(m.timestamp) || 0,
    itemId,
    locId: '',
    qty: m.quantityDelta,
    kind: MOVE_KIND[m.movementType] ?? 'adjust',
    ref: m.referenceId ?? itemType,
    byId: 'system',
    value: 0,
  };
}

function mapActivity(a: import('./audit-api.service').ApiAuditEntry): import('./models').ActivityEntry {
  return {
    id: a.id,
    at: Date.parse(a.timestamp) || 0,
    who: a.actorId ?? 'system',
    kind: activityKind(a.action),
    title: readableActivityTitle(a.action),
    text: safeActivityText(a.afterState),
    href: '',
  };
}

function mapTicket(t: ApiTicket): Ticket {
  return {
    id: t.id,
    number: t.id,
    subject: t.subject,
    body: t.body ?? '',
    topic: '',
    status: t.status as TicketStatus,
    at: Date.parse(t.createdAt) || 0,
    reply: t.reply ?? '',
  };
}

export interface LowStockRow {
  id: string;
  name: string;
  kind: 'product' | 'material';
  onHand: number;
  reorderAt: number;
  sku: string;
}

export interface AlertRow {
  id: string;
  kind: string;
  title: string;
  detail: string;
  tone: 'bad' | 'warn' | 'info';
  href: string;
}

export interface ActivityRow {
  id: string;
  at: number;
  who: string;
  whoName: string;
  kind: string;
  title: string;
  text: string;
  href: string;
}

export interface TopSeller {
  id: string;
  name: string;
  size: string;
  units: number;
  revenue: number;
  photo: string;
}

export interface ShipRow {
  id: string;
  number: string;
  customer: string;
  units: number;
  value: number;
  shipBy: number;
  status: string;
  carrier: string;
}

export interface LocationBar {
  id: string;
  name: string;
  units: number;
  pct: number;
  value: number;
}

@Injectable({ providedIn: 'root' })
export class Store {
  private readonly catalogueApi = inject(CatalogueApiService);
  private readonly materialsApi = inject(MaterialsApiService);
  private readonly suppliersApi = inject(SuppliersApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly helpApi = inject(HelpApiService);
  private readonly productionApi = inject(ProductionApiService);
  private readonly returnsApi = inject(ReturnsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly auditApi = inject(AuditApiService);
  private readonly auth = inject(AuthService);
  private readonly businessApi = inject(BusinessApiService);

  private readonly state = signal<import('./models').Seed>(emptySeed());

  readonly data = this.state.asReadonly();

  /** Hydrate all entities from the API. Safe to call multiple times; failures leave prior state intact. */
  async resolveReturn(
    id: string,
    input: { decision: 'resolved' | 'rejected'; resolution: string; restocked?: boolean; damaged?: boolean; trackingNumber?: string; photoUrls?: string[]; bayTag?: string },
  ): Promise<void> {
    await this.returnsApi.resolve(id, input);
    await this.load();
  }

  async updateBatchStage(id: string, stage: string): Promise<void> {
    await this.productionApi.updateStage(id, stage);
    await this.load();
  }

  async load(): Promise<void> {
    const next: import('./models').Seed = { ...emptySeed() };
    const me = this.auth.user();
    if (me) {
      next.settings = {
        ...next.settings,
        me: {
          id: me.id,
          name: me.name ?? me.email,
          email: me.email,
          title: me.title ?? titleCase(me.role),
          phone: me.phone ?? '',
        },
      };
    }
    await Promise.all([
      this.catalogueApi
        .list({ page: 1, limit: 100 })
        .then((r) => (next.products = r.data.map(mapProduct)))
        .catch(() => { }),
      this.materialsApi
        .list()
        .then((r) => (next.materials = r.data.map(mapMaterial)))
        .catch(() => { }),
      this.suppliersApi
        .list()
        .then((r) => (next.suppliers = r.data.map(mapSupplier)))
        .catch(() => { }),
      Promise.all([
        this.customersApi.list({ page: 1, limit: 100 }).catch(() => ({ data: [] as ApiCustomer[], total: 0 })),
        this.ordersApi.list({ page: 1, limit: 100 }).catch(() => ({ data: [] as ApiOrder[], total: 0 })),
      ]).then(([cRes, oRes]) => {
        const unified = synthesizeGuestShoppers(cRes.data, oRes.data);
        next.customers = unified.customers.map(mapCustomer);
        next.orders = unified.orders.map(mapOrder);
      }),
      this.inventoryApi
        .counts()
        .then((r) => (next.counts = r.data.map(mapCount)))
        .catch(() => { }),
      this.helpApi.tickets().then((r) => (next.tickets = r.data.map(mapTicket))).catch(() => { }),
      this.materialsApi
        .purchases(1, 100)
        .then((r) => (next.pos = r.data.map(mapPurchase)))
        .catch(() => { }),
      this.usersApi
        .list(1, 100)
        .then((r) => (next.team = r.data.map(mapTeammate)))
        .catch(() => { }),
      this.notificationsApi
        .list(1, 50)
        .then((r) => {
          const notices = r.data.map(mapNotice);
          this.notices.set(notices);
        })
        .catch(() => { }),
      this.auditApi
        .list(1, 50)
        .then((r) => (next.activity = r.data.map(mapActivity)))
        .catch(() => { }),
      this.businessApi
        .getProfile()
        .then((profile) => {
          next.settings = {
            ...next.settings,
            company: {
              name: profile.name,
              legal: profile.legalName ?? '',
              address: profile.address ?? '',
              phone: profile.phone ?? '',
              email: profile.email ?? '',
              taxId: profile.taxId ?? '',
              currency: profile.currency,
              timezone: profile.timezone,
              fiscalStart: profile.fiscalStart,
            },
            prefs: {
              expiryWarnDays: profile.expiryWarnDays,
              lowStockMode: profile.lowStockMode,
              defaultLoc: profile.defaultLocationId ?? '',
              weekStart: profile.weekStart,
            },
            goal: profile.revenueGoal,
          };
          next.locations = [
            {
              id: 'factory',
              name: profile.factoryName ?? 'Factory',
              kind: 'dc',
              city: profile.factoryCity ?? '',
              address: profile.factoryAddress ?? '',
              capacity: profile.factoryCapacity ?? 0,
              managerId: '',
              hours: profile.factoryHours ?? '',
              zones: [],
            },
          ];
        })
        .catch(() => { }),
      this.notificationsApi
        .getPreferences()
        .then((prefs) => {
          next.settings = { ...next.settings, notify: prefs };
        })
        .catch(() => { }),
      this.accountingApi
        .list({ page: 1, limit: 100 })
        .then((r: ApiLedgerList) => (next.ledgerEntries = r.data.map(mapLedgerEntry)))
        .catch(() => { }),
      this.approvalsApi
        .list({ page: 1, limit: 100 })
        .then((r) => {
          next.approvals = r.data.map(mapApproval);
        })
        .catch(() => { }),
    ]);

    await Promise.all([
      this.productionApi
        .list(1, 100)
        .then((r) => (next.batches = r.data.map((batch) => mapBatch(batch, next.products))))
        .catch(() => { }),
      this.returnsApi
        .list(1, 100)
        .then((r) => (next.returns = r.data.map((item) => mapReturn(item, next.products))))
        .catch(() => { }),
      this.inventoryApi
        .summary()
        .then((items) => {
          const byVariant = new Map(
            items
              .filter((i) => i.itemType === 'variant')
              .map((i) => [i.itemId, i.currentQuantity]),
          );
          next.products = next.products.map((product) => ({
            ...product,
            stock: {
              factory: (product.variantIds ?? []).reduce(
                (total, variantId) => total + (byVariant.get(variantId) ?? 0),
                0,
              ),
            },
          }));
        })
        .catch(() => { }),
      this.materialsApi
        .valuation()
        .then((rows) => {
          const byId = new Map(rows.map((row) => [row.id, row]));
          next.materials = next.materials.map((material) => {
            const row = byId.get(material.id);
            return row
              ? { ...material, onHand: row.currentQuantity, cost: row.lastUnitCost ?? 0 }
              : material;
          });
        })
        .catch(() => { }),
    ]);
    await this.hydrateMoves(next);
    this.state.set(next);
  }

  private async hydrateMoves(next: import('./models').Seed): Promise<void> {
    try {
      const items = await this.inventoryApi.summary();
      const moves: Move[] = [];
      const targets = items.slice(0, 60);
      for (const item of targets) {
        const itemType = item.itemType === 'material' ? 'material' : 'variant';
        try {
          const r = await this.inventoryApi.movements(itemType, item.itemId, { page: 1, limit: 10 });
          for (const m of r.data ?? []) {
            moves.push(mapInventoryMovement(itemType, item.itemId, m));
          }
        } catch {
          // keep going; a missing item ledger is not fatal
        }
      }
      next.moves = moves.sort((a, b) => b.at - a.at);
    } catch {
      // inventory summary unavailable; moves stay empty
    }
  }

  // ---------------------------------------------------------------- entities
  readonly products = computed(() => this.data().products);
  readonly materials = computed(() => this.data().materials);
  readonly suppliers = computed(() => this.data().suppliers);
  readonly locations = computed(() => this.data().locations);
  readonly customers = computed(() => this.data().customers);
  readonly orders = computed(() => this.data().orders);
  readonly ledgerEntries = computed(() => this.data().ledgerEntries);
  readonly approvals = computed(() => this.data().approvals);
  readonly batches = computed(() => this.data().batches);
  readonly pos = computed(() => this.data().pos);
  readonly returns = computed(() => this.data().returns);
  readonly transfers = computed(() => this.data().transfers);
  readonly counts = computed(() => this.data().counts);
  readonly moves = computed(() => this.data().moves);
  readonly team = computed(() => this.data().team);
  readonly tickets = computed(() => this.data().tickets);
  readonly months = computed(() => this.data().months);
  readonly weeks = computed(() => this.data().weeks);
  readonly settings = computed(() => this.data().settings);

  readonly productById = computed(() => index(this.products()));
  readonly materialById = computed(() => index(this.materials()));
  readonly supplierById = computed(() => index(this.suppliers()));
  readonly locationById = computed(() => index(this.locations()));
  readonly customerById = computed(() => index(this.customers()));
  readonly teammateById = computed(() => index(this.team()));
  readonly orderById = computed(() => index(this.orders()));
  readonly batchById = computed(() => index(this.batches()));
  readonly poById = computed(() => index(this.pos()));
  readonly returnById = computed(() => index(this.returns()));
  readonly transferById = computed(() => index(this.transfers()));
  readonly countById = computed(() => index(this.counts()));

  // ----------------------------------------------------------------- metrics
  readonly unitsOnHand = computed(() =>
    this.products().reduce(
      (total, p) => total + Object.values(p.stock).reduce((a, b) => a + b, 0),
      0,
    ),
  );

  readonly stockValue = computed(() =>
    this.products().reduce(
      (total, p) =>
        total + Object.values(p.stock).reduce((a, b) => a + b, 0) * p.cost,
      0,
    ),
  );

  readonly retailValue = computed(() =>
    this.products().reduce(
      (total, p) => total + Object.values(p.stock).reduce((a, b) => a + b, 0) * p.price,
      0,
    ),
  );

  readonly activeSkus = computed(() => this.products().filter((p) => p.active).length);

  /** Products at or below their reorder point, plus materials below theirs. */
  readonly lowStock = computed<LowStockRow[]>(() => {
    const rows: LowStockRow[] = [];
    for (const p of this.products()) {
      const onHand = Object.values(p.stock).reduce((a, b) => a + b, 0);
      if (onHand <= p.reorderAt) {
        rows.push({
          id: p.id,
          name: `${p.name} ${p.size}`,
          kind: 'product',
          onHand,
          reorderAt: p.reorderAt,
          sku: p.sku,
        });
      }
    }
    for (const m of this.materials()) {
      if (m.onHand <= m.reorderAt) {
        rows.push({
          id: m.id,
          name: m.name,
          kind: 'material',
          onHand: m.onHand,
          reorderAt: m.reorderAt,
          sku: m.code,
        });
      }
    }
    return rows.sort((a, b) => a.onHand / (a.reorderAt || 1) - b.onHand / (b.reorderAt || 1));
  });

  readonly lowStockProducts = computed(() => this.lowStock().filter((r) => r.kind === 'product'));
  readonly lowStockMaterials = computed(() => this.lowStock().filter((r) => r.kind === 'material'));
  readonly outOfStock = computed(() => this.lowStock().filter((r) => r.onHand === 0));

  readonly openOrders = computed(() =>
    this.orders().filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
  );

  readonly ordersToShip = computed(() =>
    this.openOrders().filter((o) => o.status === 'new' || o.status === 'picking' || o.status === 'packed'),
  );

  readonly unpaidOrders = computed(() => this.openOrders().filter((o) => !o.paid));

  readonly lateOrders = computed(() => {
    const now = Date.now();
    return this.openOrders().filter((o) => o.shipBy < now);
  });

  readonly shippedToday = computed(() => {
    const day = startOfDay(Date.now());
    return this.moves().filter((m) => m.kind === 'sale' && m.at >= day).length;
  });

  /** Top sellers by units moved in the sales ledger. */
  readonly topSellers = computed<TopSeller[]>(() => {
    const units = new Map<string, number>();
    for (const m of this.moves()) {
      if (m.kind !== 'sale') continue;
      units.set(m.itemId, (units.get(m.itemId) ?? 0) + Math.abs(m.qty));
    }
    return [...units.entries()]
      .map(([id, q]) => {
        const p = this.productById()[id];
        return {
          id,
          name: p?.name ?? id,
          size: p?.size ?? '',
          units: q,
          revenue: q * (p?.price ?? 0),
          photo: p?.photo ?? 'serum',
        };
      })
      .filter((r) => r.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 6);
  });

  readonly shippingQueue = computed<ShipRow[]>(() => {
    const rows: ShipRow[] = [];
    for (const o of this.openOrders()) {
      if (o.status === 'delivered' || o.status === 'cancelled') continue;
      const customer = this.customerById()[o.customerId];
      rows.push({
        id: o.id,
        number: o.number,
        customer: customer?.name ?? o.customerId,
        units: o.lines.reduce((a, l) => a + l.qty, 0),
        value: o.lines.reduce((a, l) => a + l.qty * l.price, 0),
        shipBy: o.shipBy,
        status: o.status,
        carrier: o.carrier,
      });
    }
    return rows.sort((a, b) => a.shipBy - b.shipBy).slice(0, 8);
  });

  readonly stockByLocation = computed<LocationBar[]>(() => {
    const units = new Map<string, number>();
    const value = new Map<string, number>();
    for (const p of this.products()) {
      for (const [locId, qty] of Object.entries(p.stock)) {
        units.set(locId, (units.get(locId) ?? 0) + qty);
        value.set(locId, (value.get(locId) ?? 0) + qty * p.cost);
      }
    }
    const total = [...units.values()].reduce((a, b) => a + b, 0) || 1;
    return this.locations().map((l) => ({
      id: l.id,
      name: l.name,
      units: units.get(l.id) ?? 0,
      pct: ((units.get(l.id) ?? 0) / total) * 100,
      value: value.get(l.id) ?? 0,
    }));
  });

  readonly activityFeed = computed<ActivityRow[]>(() => {
    const people = this.teammateById();
    const customers = this.customerById();
    const products = this.productById();
    const orders = this.orders();
    const rows: ActivityRow[] = [];

    for (const a of this.data().activity) {
      if (a.kind === 'security' || /^(GET|POST|PATCH|PUT|DELETE)\s/i.test(a.title)) continue;
      rows.push({
        ...a,
        whoName:
          a.who === 'web'
            ? 'Online store'
            : (people[a.who]?.name ?? customers[a.who]?.name ?? a.who),
      });
    }

    for (const o of orders) {
      const customer = customers[o.customerId]?.name ?? 'Customer';
      const kind = o.channel === 'online' ? 'web' : 'order';
      const label =
        o.channel === 'online' ? 'Online store' : o.channel === 'wholesale' ? 'Wholesale' : 'Studio';
      const ref = o.number.slice(0, 8).toUpperCase();
      rows.push({
        id: `order-${o.id}`,
        at: o.createdAt,
        who: o.customerId || 'web',
        whoName: customer,
        kind,
        title: `${label} order placed`,
        text: `${ref} · ${o.lines.length} line${o.lines.length === 1 ? '' : 's'}`,
        href: `/orders/all/${o.id}`,
      });
      if (o.shipBy && o.shipBy !== o.createdAt) {
        rows.push({
          id: `order-${o.id}-status`,
          at: o.shipBy,
          who: 'system',
          whoName: 'Operations',
          kind,
          title: `Order ${o.status}`,
          text: `${ref} · ${o.paid ? 'paid' : 'unpaid'}`,
          href: `/orders/all/${o.id}`,
        });
      }
    }

    for (const m of this.moves()) {
      const item = products[m.itemId] ?? this.materialById()[m.itemId];
      rows.push({
        id: `move-${m.id}`,
        at: m.at,
        who: m.byId,
        whoName: people[m.byId]?.name ?? 'Warehouse',
        kind: 'stock',
        title: m.qty >= 0 ? 'Stock in' : 'Stock out',
        text: `${item?.name ?? m.itemId} · ${m.qty > 0 ? '+' : ''}${m.qty}${m.ref ? ` · ${m.ref}` : ''}`,
        href:
          m.kind === 'receipt'
            ? '/purchasing/materials'
            : '/warehouses/inventory',
      });
    }

    for (const b of this.batches()) {
      rows.push({
        id: `batch-${b.id}`,
        at: b.madeAt,
        who: b.chemistId || 'system',
        whoName: people[b.chemistId]?.name ?? 'Production',
        kind: 'stock',
        title: 'Batch produced',
        text: `${b.lot} · ${products[b.productId]?.name ?? b.productId} · ${b.qty} units`,
        href: '/production',
      });
    }

    for (const c of this.counts()) {
      rows.push({
        id: `count-${c.id}`,
        at: c.at,
        who: c.byId || 'system',
        whoName: people[c.byId]?.name ?? 'Warehouse',
        kind: 'stock',
        title: c.status === 'done' ? 'Cycle count completed' : 'Cycle count started',
        text: `${c.number.slice(0, 8).toUpperCase()} · ${c.zone || 'all zones'}`,
        href: '/warehouses/counts',
      });
    }

    for (const p of this.pos()) {
      rows.push({
        id: `po-${p.id}`,
        at: p.createdAt,
        who: p.recordedBy ?? 'system',
        whoName: people[p.recordedBy ?? '']?.name ?? 'Purchasing',
        kind: 'po',
        title: 'Material purchase recorded',
        text: `${p.number} · ${p.supplierId || 'Supplier'} · ${p.lines.length} line${p.lines.length === 1 ? '' : 's'}`,
        href: `/purchasing/orders/${p.id}`,
      });
    }

    for (const r of this.returns()) {
      const order = orders.find((o) => o.id === r.orderId);
      rows.push({
        id: `return-${r.id}`,
        at: r.createdAt,
        who: 'web',
        whoName: customers[order?.customerId ?? '']?.name ?? 'Customer',
        kind: 'return',
        title: 'Return requested',
        text: `${r.number} · ${products[r.productId]?.name ?? r.productId} · ${r.qty} unit${r.qty === 1 ? '' : 's'}`,
        href: `/orders/returns/${r.id}`,
      });
      if (r.resolvedAt) {
        rows.push({
          id: `return-${r.id}-resolved`,
          at: r.resolvedAt,
          who: r.resolvedBy ?? 'system',
          whoName: people[r.resolvedBy ?? '']?.name ?? 'Support',
          kind: 'return',
          title: `Return ${r.status}`,
          text: `${r.number} · ${r.resolution ?? r.reason}`,
          href: `/orders/returns/${r.id}`,
        });
      }
    }

    return rows.filter((r) => r.at > 0).sort((a, b) => b.at - a.at).slice(0, 300);
  });

  readonly alerts = computed<AlertRow[]>(() => {
    const out: AlertRow[] = [];
    for (const row of this.lowStockProducts().slice(0, 5)) {
      out.push({
        id: `low-${row.id}`,
        kind: 'stock',
        title: row.onHand === 0 ? 'Out of stock' : 'Low stock',
        detail: `${row.name} A� ${row.onHand} of ${row.reorderAt}`,
        tone: row.onHand === 0 ? 'bad' : 'warn',
        href: `/products/item/${row.id}`,
      });
    }
    const expiring = this.batches()
      .filter((b) => b.status === 'released' && b.left > 0)
      .filter((b) => b.expiresAt - Date.now() < 120 * 86400000)
      .sort((a, b) => a.expiresAt - b.expiresAt)
      .slice(0, 3);
    for (const b of expiring) {
      const p = this.productById()[b.productId];
      out.push({
        id: `exp-${b.id}`,
        kind: 'expiry',
        title: 'Lot expiring',
        detail: `${b.lot} A� ${p?.name ?? b.productId}`,
        tone: 'warn',
        href: `/products/batches/${b.id}`,
      });
    }
    for (const o of this.unpaidOrders().slice(0, 2)) {
      out.push({
        id: `unpaid-${o.id}`,
        kind: 'order',
        title: 'Awaiting payment',
        detail: `${o.number} A� ${this.customerById()[o.customerId]?.name ?? ''}`,
        tone: 'info',
        href: `/orders/all/${o.id}`,
      });
    }
    for (const po of this.pos().filter((p) => p.status === 'partial').slice(0, 2)) {
      out.push({
        id: `po-${po.id}`,
        kind: 'po',
        title: 'Part-received PO',
        detail: `${po.number} A� ${this.supplierById()[po.supplierId]?.name ?? ''}`,
        tone: 'info',
        href: `/purchasing/orders/${po.id}`,
      });
    }
    return out;
  });

  readonly unreadNotices = computed(() => this.data().notices.filter((n) => !n.read).length);

  /** Rolling monthly series used by the dashboard sales chart. */
  readonly salesSeries = computed<SeriesPoint[]>(() => this.months());

  readonly weeklySeries = computed<SeriesPoint[]>(() => this.weeks());

  readonly openPurchaseOrders = computed(() =>
    this.pos().filter((p) => p.status === 'sent' || p.status === 'partial'),
  );

  readonly batchStats = computed(() => {
    const batches = this.batches();
    return {
      total: batches.length,
      onHold: batches.filter((b) => b.status === 'hold').length,
      inQa: batches.filter((b) => b.status === 'quarantine').length,
      expiringSoon: batches.filter(
        (b) => b.status === 'released' && b.left > 0 && b.expiresAt - Date.now() < 90 * 86400000,
      ).length,
    };
  });

  readonly countStats = computed(() => {
    const counts = this.counts();
    return {
      open: counts.filter((c) => c.status !== 'done').length,
      done: counts.filter((c) => c.status === 'done').length,
      variance: counts.reduce(
        (acc, c) =>
          acc +
          c.lines.reduce(
            (a, l) => a + (l.counted === null ? 0 : Math.abs(l.counted - l.expected)),
            0,
          ),
        0,
      ),
    };
  });

  // ------------------------------------------------------------- mutability
  readonly notices = signal<Notice[]>([]);

  markNoticeRead(id: string): void {
    this.notices.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void this.notificationsApi.markRead(id).catch(() => this.load());
  }

  markAllNoticesRead(): void {
    this.notices.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  updateMe(patch: Partial<Settings['me']>): void {
    this.state.update((s) => ({
      ...s,
      settings: { ...s.settings, me: { ...s.settings.me, ...patch } },
    }));
    void this.usersApi
      .updateMe({
        name: patch.name,
        email: patch.email,
        phone: patch.phone,
        title: patch.title,
      })
      .then((user) => {
        const me = {
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          title: user.title ?? titleCase(user.role.name),
        };
        this.state.update((s) => ({
          ...s,
          settings: { ...s.settings, me: { ...s.settings.me, ...me } },
        }));
        this.auth.user.update((current) => (current ? { ...current, ...me } : current));
      })
      .catch(() => this.load());
  }

  updateCompany(patch: Partial<Settings['company']>): void {
    this.state.update((s) => ({
      ...s,
      settings: { ...s.settings, company: { ...s.settings.company, ...patch } },
    }));
    void this.businessApi
      .updateProfile({
        name: patch.name,
        legalName: patch.legal,
        address: patch.address,
        phone: patch.phone,
        email: patch.email,
        taxId: patch.taxId,
        currency: patch.currency,
        timezone: patch.timezone,
        fiscalStart: patch.fiscalStart,
      })
      .catch(() => this.load());
  }

  updatePrefs(patch: Partial<Settings['prefs']>): void {
    this.state.update((s) => ({
      ...s,
      settings: { ...s.settings, prefs: { ...s.settings.prefs, ...patch } },
    }));
    void this.businessApi
      .updateProfile({
        expiryWarnDays: patch.expiryWarnDays,
        lowStockMode: patch.lowStockMode,
        defaultLocationId: patch.defaultLoc,
        weekStart: patch.weekStart,
      })
      .catch(() => this.load());
  }

  updateNotify(key: string, value: boolean): void {
    this.state.update((s) => ({
      ...s,
      settings: { ...s.settings, notify: { ...s.settings.notify, [key]: value } },
    }));
    void this.notificationsApi
      .updatePreferences({ [key]: value })
      .catch(() => this.load());
  }

  setGoal(goal: number): void {
    this.state.update((s) => ({
      ...s,
      settings: { ...s.settings, goal },
    }));
    void this.businessApi.updateProfile({ revenueGoal: goal }).catch(() => this.load());
  }

  /** Change a teammate's role from the Settings �?� Team screen. */
  setTeammateRole(id: string, role: Teammate['role']): void {
    const apiRole =
      role === 'admin'
        ? 'business_owner_admin'
        : role === 'manager'
          ? 'management'
          : role === 'staff'
            ? 'sales'
            : 'wholesaler';
    this.state.update((s) => ({
      ...s,
      team: s.team.map((t) => (t.id === id ? { ...t, role } : t)),
    }));
    void this.usersApi
      .updateRole(id, apiRole)
      .then((user) =>
        this.state.update((s) => ({
          ...s,
          team: s.team.map((t) => (t.id === id ? mapTeammate(user) : t)),
        })),
      )
      .catch(() => this.load());
  }

  /** Add a teammate row after the API creates a staff account. */
  addTeammate(user: import('./users-api.service').ApiUser): void {
    this.state.update((s) => ({
      ...s,
      team: [...s.team, mapTeammate(user)],
    }));
  }

  /** Reflect a deactivated staff account after the API disables it. */
  deactivateTeammate(user: import('./users-api.service').ApiUser): void {
    this.state.update((s) => ({
      ...s,
      team: s.team.map((t) => (t.id === user.id ? mapTeammate(user) : t)),
    }));
  }

  /** Move a transfer along: planned �+' in transit �+' received. */
  advanceTransfer(id: string): Transfer['status'] {
    const current = this.transfer(id)?.status ?? 'planned';
    const next: Transfer['status'] =
      current === 'planned' ? 'in-transit' : 'received';
    this.state.update((s) => {
      const updated = {
        ...s,
        transfers: s.transfers.map((t) =>
          t.id === id
            ? { ...t, status: next, eta: next === 'received' ? Date.now() : t.eta }
            : t,
        ),
      };
      return updated;
    });
    return next;
  }

  advanceOrder(orderId: string, status: Order['status']): boolean {
    let advanced = false;
    this.state.update((s) => {
      const order = s.orders.find((o) => o.id === orderId);
      if (!order || !canAdvanceOrder(order.status, status)) return s;

      advanced = true;
      const next = {
        ...s,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? {
              ...o,
              status,
              history: [...o.history, { at: Date.now(), to: status, by: s.settings.me.id }],
            }
            : o,
        ),
      };
      return next;
    });
    if (advanced) {
      void this.ordersApi.updateStatus(orderId, status as any).catch(() => {
        // optimistic update already applied; ignore sync failures
      });
    }
    return advanced;
  }

  adjustStock(productId: string, locationId: string, delta: number): void {
    this.state.update((s) => {
      const next = {
        ...s,
        products: s.products.map((p) =>
          p.id === productId
            ? { ...p, stock: { ...p.stock, [locationId]: (p.stock[locationId] ?? 0) + delta } }
            : p,
        ),
      };
      return next;
    });
  }

  /** Lookups ------------------------------------------------------------- */

  product(id: string): Product | undefined {
    return this.productById()[id];
  }

  material(id: string): Material | undefined {
    return this.materialById()[id];
  }

  supplier(id: string): Supplier | undefined {
    return this.supplierById()[id];
  }

  customer(id: string): Customer | undefined {
    return this.customerById()[id];
  }

  location(id: string): Location | undefined {
    return this.locationById()[id];
  }

  teammate(id: string): Teammate | undefined {
    return this.teammateById()[id];
  }

  order(id: string): Order | undefined {
    return this.orderById()[id];
  }

  batch(id: string): Batch | undefined {
    return this.batchById()[id];
  }

  po(id: string): PurchaseOrder | undefined {
    return this.poById()[id];
  }

  return_(id: string): Return | undefined {
    return this.returnById()[id];
  }

  transfer(id: string): Transfer | undefined {
    return this.transferById()[id];
  }

  count(id: string): CycleCount | undefined {
    return this.countById()[id];
  }

  movesFor(itemId: string): Move[] {
    return this.moves().filter((m) => m.itemId === itemId).sort((a, b) => b.at - a.at);
  }
}

function index<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const row of rows) map[row.id] = row;
  return map;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
