/** Domain model for the Vessa stock & supply app. */

export type OrderStatus = 'new' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export type OrderChannel = 'online' | 'wholesale' | 'studio';
export type BatchStatus = 'released' | 'hold' | 'quarantine';
export type PoStatus = 'draft' | 'sent' | 'partial' | 'received';
export type ReturnStatus = 'requested' | 'received' | 'restocked' | 'refunded' | 'rejected';
export type TransferStatus = 'planned' | 'in-transit' | 'received';
export type CountStatus = 'scheduled' | 'counting' | 'done';
export type MoveKind = 'sale' | 'receipt' | 'production' | 'transfer' | 'count' | 'adjust' | 'return';
export type MaterialKind = 'Ingredient' | 'Packaging' | 'Shipping';
export type CustomerKind = 'stockist' | 'shopper';
export type LocationKind = 'dc' | 'lab' | 'shop';
export type ZoneKind = 'ambient' | 'cool' | 'quarantine' | 'dispatch' | 'raw' | 'packaging' | 'qa' | 'floor' | 'back';
export type TeamDept = 'Operations' | 'Warehouse' | 'Lab' | 'Sales' | 'Finance' | 'Support';
export type TeamRole = 'admin' | 'manager' | 'staff' | 'viewer';
export type TicketStatus = 'answered' | 'closed' | 'open';

export interface BomLine {
  materialId: string;
  per: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  line: string;
  size: string;
  category: string;
  photo: string;
  price: number;
  wholesale: number;
  cost: number;
  reorderAt: number;
  reorderQty: number;
  bin: string;
  shelfMonths: number;
  active: boolean;
  barcode: string;
  bom: BomLine[];
  blurb: string;
  stock: Record<string, number>;
  variantIds?: string[];
}

export interface Material {
  id: string;
  code: string;
  name: string;
  kind: MaterialKind;
  unit: string;
  reorderAt: number;
  reorderQty: number;
  cost: number;
  supplierId: string;
  locId: string;
  onHand: number;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  city: string;
  contact: string;
  email: string;
  phone: string;
  leadDays: number;
  onTime: number;
  rating: number;
  supplies: string;
  tone: string;
  since: number;
  favorite: boolean;
}

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  bins: number;
}

export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  city: string;
  address: string;
  capacity: number;
  managerId: string;
  hours: string;
  zones: Zone[];
}

export interface Batch {
  id: string;
  lot: string;
  productId: string;
  madeAt: number;
  expiresAt: number;
  qty: number;
  left: number;
  locId: string;
  status: BatchStatus;
  chemistId: string;
}

export interface OrderLine {
  productId: string;
  qty: number;
  price: number;
}

export interface OrderEvent {
  at: number;
  to: string;
  by: string;
}

export interface Order {
  id: string;
  number: string;
  orderNumber?: string;
  customerId: string;
  customerName?: string;
  channel: OrderChannel;
  status: OrderStatus;
  createdAt: number;
  shipBy: number;
  locId: string;
  lines: OrderLine[];
  carrier: string;
  paid: boolean;
  history: OrderEvent[];
}

export interface Customer {
  id: string;
  name: string;
  kind: CustomerKind;
  contact: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  since: number;
  tags: string[];
  note: string;
}

export interface PoLine {
  materialId: string;
  qty: number;
  received: number;
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  status: PoStatus;
  createdAt: number;
  sentAt: number | null;
  eta: number | null;
  receivedAt: number | null;
  leadTimeDays: number | null;
  recordedBy: string | null;
  readAt: number | null;
  lines: PoLine[];
  note: string;
}

export interface LedgerEntry {
  id: string;
  type: 'sale' | 'investment' | 'expense' | 'purchase' | 'payroll' | 'tax';
  amount: number;
  category: string | null;
  referenceId: string | null;
  recordedBy: string | null;
  entryAt: number;
}

export interface Approval {
  id: string;
  actionType: 'purchasing' | 'production_start' | 'price_change' | 'fund_movement' | 'stock_disposal';
  payload: Record<string, unknown> | null;
  requestedBy: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  justification: string | null;
  decidedAt: number | null;
  createdAt: number;
}

export interface Return {
  id: string;
  number: string;
  orderId: string;
  productId: string;
  qty: number;
  reason: string;
  status: ReturnStatus;
  createdAt: number;
  refund: number;
  trackingNumber: string | null;
  bayTag: string | null;
  damaged: boolean;
  restocked: boolean;
  resolution: string | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  photoUrls: string[];
}

export interface TransferLine {
  productId: string;
  qty: number;
}

export interface Transfer {
  id: string;
  number: string;
  from: string;
  to: string;
  lines: TransferLine[];
  status: TransferStatus;
  createdAt: number;
  eta: number;
  byId: string;
}

export interface CountLine {
  productId: string;
  expected: number;
  counted: number | null;
}

export interface CycleCount {
  id: string;
  number: string;
  locId: string;
  zone: string;
  status: CountStatus;
  at: number;
  byId: string;
  lines: CountLine[];
}

export interface Move {
  id: string;
  at: number;
  itemId: string;
  locId: string;
  qty: number;
  kind: MoveKind;
  ref: string;
  byId: string;
  value: number;
}

export interface Teammate {
  id: string;
  name: string;
  title: string;
  team: TeamDept;
  role: TeamRole;
  apiRoleName?: string;
  email: string;
  phone: string;
  locId: string;
  tone: string;
  status: string;
  since: number;
  permissions?: Array<{ module: string; accessLevel: string }>;
}

export interface ActivityEntry {
  id: string;
  at: number;
  who: string;
  kind: string;
  title: string;
  text: string;
  href: string;
}

export interface Notice {
  id: string;
  at: number;
  text: string;
  href: string;
  read: boolean;
  kind: string;
}

export interface Ticket {
  id: string;
  number: string;
  subject: string;
  body: string;
  topic: string;
  status: TicketStatus;
  at: number;
  reply: string;
}

export interface SeriesPoint {
  label: string;
  start: number;
  stockIn: number;
  stockOut: number;
  value: number;
}

export interface Settings {
  me: { id: string; name: string; email: string; title: string; phone: string };
  company: {
    name: string;
    legal: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    currency: string;
    timezone: string;
    fiscalStart: string;
  };
  billing: {
    plan: string;
    seats: number;
    cycle: string;
    card: { brand: string; last4: string; exp: string; name: string };
    invoices: { id: string; at: number; amount: number; status: string }[];
  };
  notify: Record<string, boolean>;
  prefs: {
    expiryWarnDays: number;
    lowStockMode: string;
    defaultLoc: string;
    weekStart: string;
  };
  goal: number;
}

export interface Seed {
  version: number;
  team: Teammate[];
  locations: Location[];
  products: Product[];
  batches: Batch[];
  materials: Material[];
  suppliers: Supplier[];
  pos: PurchaseOrder[];
  customers: Customer[];
  orders: Order[];
  returns: Return[];
  transfers: Transfer[];
  counts: CycleCount[];
  moves: Move[];
  activity: ActivityEntry[];
  notices: Notice[];
  tickets: Ticket[];
  months: SeriesPoint[];
  weeks: SeriesPoint[];
  ledgerEntries: LedgerEntry[];
  approvals: Approval[];
  settings: Settings;
}
