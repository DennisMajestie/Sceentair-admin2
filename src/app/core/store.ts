import { Injectable, computed, signal, inject } from '@angular/core';
import { CatalogueApiService, type ApiProduct } from './catalogue-api.service';
import { CustomersApiService, type ApiCustomer } from './customers-api.service';
import { HelpApiService, type ApiTicket } from './help-api.service';
import { InventoryApiService, type ApiCount } from './inventory-api.service';
import { MaterialsApiService, type ApiMaterial } from './materials-api.service';
import { OrdersApiService, type ApiOrder } from './orders-api.service';
import { SuppliersApiService, type ApiSupplier } from './suppliers-api.service';
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
    photo: p.primaryImageUrl ?? '',
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
    customerId: o.customer?.id ?? '',
    channel: 'online',
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

  private readonly state = signal<import('./models').Seed>(emptySeed());

  readonly data = this.state.asReadonly();

  /** Hydrate all entities from the API. Safe to call multiple times; failures leave prior state intact. */
  async load(): Promise<void> {
    const next: import('./models').Seed = { ...emptySeed() };
    await Promise.all([
      this.catalogueApi
        .list({ page: 1, limit: 100 })
        .then((r) => (next.products = r.data.map(mapProduct)))
        .catch(() => {}),
      this.materialsApi
        .list()
        .then((r) => (next.materials = r.data.map(mapMaterial)))
        .catch(() => {}),
      this.suppliersApi
        .list()
        .then((r) => (next.suppliers = r.data.map(mapSupplier)))
        .catch(() => {}),
      this.customersApi
        .list({ page: 1, limit: 100 })
        .then((r) => (next.customers = r.data.map(mapCustomer)))
        .catch(() => {}),
      this.ordersApi
        .list({ page: 1, limit: 100 })
        .then((r) => (next.orders = r.data.map(mapOrder)))
        .catch(() => {}),
      this.inventoryApi
        .counts()
        .then((r) => (next.counts = r.data.map(mapCount)))
        .catch(() => {}),
      this.helpApi.tickets().then((r) => (next.tickets = r.data.map(mapTicket))).catch(() => {}),
    ]);
    this.state.set(next);
  }

  // ---------------------------------------------------------------- entities
  readonly products = computed(() => this.data().products);
  readonly materials = computed(() => this.data().materials);
  readonly suppliers = computed(() => this.data().suppliers);
  readonly locations = computed(() => this.data().locations);
  readonly customers = computed(() => this.data().customers);
  readonly orders = computed(() => this.data().orders);
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
    return this.data()
      .activity.slice()
      .sort((a, b) => b.at - a.at)
      .map((a) => ({
        ...a,
        whoName: a.who === 'web' ? 'Online store' : (people[a.who]?.name ?? a.who),
      }));
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
  }

  markAllNoticesRead(): void {
    this.notices.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  updateMe(patch: Partial<Settings['me']>): void {
    this.state.update((s) => {
      const next = {
        ...s,
        settings: { ...s.settings, me: { ...s.settings.me, ...patch } },
      };
      return next;
    });
  }

  resetDemoData(): void {
    const reset = JSON.parse(JSON.stringify(emptySeed())) as import('./models').Seed;
    this.state.set(reset);
    this.notices.set([]);
  }

  updateCompany(patch: Partial<Settings['company']>): void {
    this.state.update((s) => {
      const next = {
        ...s,
        settings: { ...s.settings, company: { ...s.settings.company, ...patch } },
      };
      return next;
    });
  }

  updatePrefs(patch: Partial<Settings['prefs']>): void {
    this.state.update((s) => {
      const next = {
        ...s,
        settings: { ...s.settings, prefs: { ...s.settings.prefs, ...patch } },
      };
      return next;
    });
  }

  updateNotify(key: string, value: boolean): void {
    this.state.update((s) => {
      const next = {
        ...s,
        settings: { ...s.settings, notify: { ...s.settings.notify, [key]: value } },
      };
      return next;
    });
  }

  setGoal(goal: number): void {
    this.state.update((s) => {
      const next = {
        ...s,
        settings: { ...s.settings, goal },
      };
      return next;
    });
  }

  /** Change a teammate's role from the Settings �?� Team screen. */
  setTeammateRole(id: string, role: Teammate['role']): void {
    this.state.update((s) => {
      const next = {
        ...s,
        team: s.team.map((t) => (t.id === id ? { ...t, role } : t)),
      };
      return next;
    });
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
