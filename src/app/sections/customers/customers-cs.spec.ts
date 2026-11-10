import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { lastOrderLines, moneyNgn, sortRows, synthesizeGuestShoppers } from './cs-data';
import {
  ApiCustomer,
  ApiCustomerList,
  CustomersApiService,
} from '../../core/customers-api.service';
import {
  ApiOrder,
  OrdersApiService,
} from '../../core/orders-api.service';
import { Customers } from './customers';
import { ToastService } from '../../core/toast';

const STOCKIST: ApiCustomer = {
  id: 'c-juniper-moss-apothecary',
  name: 'Juniper & Moss Apothecary',
  kind: 'stockist',
  contact: 'Clara Lindqvist',
  email: 'clara@junipermoss.com',
  phone: '(896) 555-0129',
  city: 'Portland',
  region: 'OR',
  since: '2026-07-19T00:00:00Z',
  tags: ['vip', 'net30'],
  note: 'Reorders the balm every 4–5 weeks.',
};

const SHOPPER: ApiCustomer = {
  id: 'c-amara-nwosu',
  name: 'Amara Nwosu',
  kind: 'shopper',
  contact: 'Amara Nwosu',
  email: 'amara.nwosu@mail.com',
  phone: '(289) 555-0184',
  city: 'Raleigh',
  region: 'NC',
  since: '2026-08-01T00:00:00Z',
  tags: ['subscriber'],
  note: '',
};

const ORDER_FOR_STOCKIST: ApiOrder = {
  id: 'o-1',
  customer: { id: 'c-juniper-moss-apothecary', name: 'Juniper & Moss Apothecary', email: 'clara@junipermoss.com', phone: '(896) 555-0129' },
  guestName: null,
  guestEmail: null,
  channel: 'wholesale',
  source: null,
  status: 'delivered',
  paymentStatus: 'paid',
  totalAmount: 100,
  deliveryFee: 0,
  shippingAddress: { state: 'OR', city: 'Portland', line: '123 Main St', phone: '(896) 555-0129' },
  deliveryMethod: 'freight',
  deliveredAt: '2026-01-15T10:00:00Z',
  items: [{ id: 'i-1', quantity: 5, unitPrice: 20, variant: { id: 'v-1', sku: 'MF-CRB-15', size: '15 ml', colour: null, imageUrl: null, product: { id: 'crb15', name: 'Calendula Rescue Balm', primaryImageUrl: 'balm' } } }],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

function makeCustomersApi(listResult: ApiCustomerList = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('CustomersApiService', ['list', 'detail']);
  api.list.and.returnValue(Promise.resolve(listResult));
  return api;
}

function makeOrdersApi(listResult: { data: ApiOrder[]; total: number } = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('OrdersApiService', ['list', 'detail', 'tracking', 'updateStatus', 'publicConfig']);
  api.list.and.returnValue(Promise.resolve(listResult));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function setup(customersApi: ReturnType<typeof makeCustomersApi>, ordersApi: ReturnType<typeof makeOrdersApi>) {
  TestBed.configureTestingModule({
    imports: [Customers, HttpClientTestingModule],
    providers: [
      { provide: CustomersApiService, useValue: customersApi },
      { provide: OrdersApiService, useValue: ordersApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(Customers);
}

describe('customers section — shared helpers', () => {
  it('formats amounts in the app currency through the existing formatter', () => {
    const out = moneyNgn(1250);
    expect(out).toContain('₦');
    expect(out).not.toContain('$');
    expect(out).not.toMatch(/^NGN/);
    expect(out).toContain('1,250');
  });

  it('sortRows sorts numerically and lexically, honoring the asked direction', () => {
    const rows: Array<{ name: string; spend: number }> = [
      { name: 'Copper Kettle', spend: 100 },
      { name: 'Amara', spend: 400 },
      { name: 'Fern Room', spend: 250 },
    ];
    const natural = { spend: 'desc' as const, name: 'asc' as const };
    const val = (r: { name: string; spend: number }, k: string): number | string =>
      k === 'name' ? r.name : r.spend;
    const numeric = sortRows(rows, 'spend', 'desc', natural, val);
    expect(numeric.map((r) => r.spend)).toEqual([400, 250, 100]);
    expect(sortRows(rows, 'spend', 'asc', natural, val).map((r) => r.spend)).toEqual(
      [100, 250, 400],
    );
    const lexical = sortRows(rows, 'name', 'asc', natural, val);
    expect(lexical.map((r) => r.name)).toEqual(['Amara', 'Copper Kettle', 'Fern Room']);
  });

  it('lastOrderLines is relative within seven days and dated beyond', () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    const sixDays = now - 6 * 86400000;
    const eightDays = now - 8 * 86400000;
    expect(lastOrderLines(null, now)).toEqual({ primary: null, full: null });
    const within = lastOrderLines(sixDays, now);
    expect(within.primary).toMatch(/d ago$/);
    expect(within.full).toMatch(/Oct 14/);
    const beyond = lastOrderLines(eightDays, now);
    expect(beyond.primary).not.toMatch(/ago$/);
    expect(beyond.primary).toMatch(/Oct 12/);
    expect(beyond.full).toMatch(/Oct 12/);
  });

  it('synthesizeGuestShoppers merges guest storefront orders into shopper accounts', () => {
    const existingShopper: ApiCustomer = {
      id: 'c-amara',
      name: 'Amara Nwosu',
      kind: 'shopper',
      contact: 'Amara Nwosu',
      email: 'amara@example.com',
      phone: '08011111111',
      city: 'Raleigh',
      region: 'NC',
      since: '2026-08-01T00:00:00Z',
      tags: ['subscriber'],
      note: '',
    };

    const guestOrder1: ApiOrder = {
      id: 'ord-1',
      customer: null,
      guestName: 'Dennis Majesty',
      guestEmail: 'dennis@example.com',
      channel: 'retail',
      source: null,
      status: 'delivered',
      paymentStatus: 'paid',
      totalAmount: 78000,
      shippingAddress: { line: '10 St', city: 'Lagos', state: 'Lagos', phone: '08022222222' },
      deliveryMethod: 'freight',
      deliveredAt: '2026-11-07T12:00:00Z',
      items: [],
      createdAt: '2026-11-07T10:00:00Z',
      updatedAt: '2026-11-07T10:00:00Z',
    };

    const guestOrder2: ApiOrder = {
      ...guestOrder1,
      id: 'ord-2',
      totalAmount: 11000,
      createdAt: '2026-11-06T10:00:00Z',
    };

    const guestOrder3: ApiOrder = {
      id: 'ord-3',
      customer: null,
      guestName: 'Majesty Sochima',
      guestEmail: 'majesty@example.com',
      channel: 'retail',
      source: null,
      status: 'cancelled',
      paymentStatus: 'refunded',
      totalAmount: 191000,
      shippingAddress: { line: '12 St', city: 'Abuja', state: 'FCT', phone: '08033333333' },
      deliveryMethod: 'freight',
      deliveredAt: null,
      items: [],
      createdAt: '2026-11-07T08:00:00Z',
      updatedAt: '2026-11-07T08:00:00Z',
    };

    const { customers, orders } = synthesizeGuestShoppers([existingShopper], [guestOrder1, guestOrder2, guestOrder3]);

    expect(customers.length).toBe(3);
    const dennis = customers.find((c) => c.name === 'Dennis Majesty');
    expect(dennis).toBeDefined();
    expect(dennis?.city).toBe('Lagos');
    expect(dennis?.region).toBe('Lagos');
    expect(dennis?.since).toBe('2026-11-06T10:00:00Z');

    const sochima = customers.find((c) => c.name === 'Majesty Sochima');
    expect(sochima).toBeDefined();
    expect(sochima?.city).toBe('Abuja');

    const dennisOrders = orders.filter((o) => o.customer?.id === dennis?.id);
    expect(dennisOrders.length).toBe(2);
  });
});

describe('Customers page (combined stockists/shoppers)', () => {
  it('builds stockist rows and counts chips from API data', async () => {
    const customersApi = makeCustomersApi({ data: [STOCKIST], total: 1 });
    const ordersApi = makeOrdersApi({ data: [ORDER_FOR_STOCKIST], total: 1 });
    const fixture = setup(customersApi, ordersApi);
    const comp = fixture.componentInstance;

    await (comp as any).loadCustomers(true);
    await fixture.whenStable();

    expect((comp as any).rows().length).toBeGreaterThan(0);
    expect((comp as any).view()).toBe('stockists');
    expect((comp as any).tagged('vip')).toBe(1);
    expect((comp as any).tagged('net30')).toBe(1);
    expect((comp as any).tagged('new')).toBe(0);
  });

  it('default sort is lifetime revenue descending and header flips direction', async () => {
    const customersApi = makeCustomersApi({ data: [STOCKIST], total: 1 });
    const ordersApi = makeOrdersApi({ data: [ORDER_FOR_STOCKIST], total: 1 });
    const fixture = setup(customersApi, ordersApi);
    const comp = fixture.componentInstance;

    await (comp as any).loadCustomers(true);
    await fixture.whenStable();

    const firstSorted = (comp as any).sorted() as Array<{ spend: number }>;
    const spends = firstSorted.map((r) => r.spend);
    expect([...spends].sort((a: number, b: number) => b - a)).toEqual(spends);
    (comp as any).setSort('spend');
    expect((comp as any).dir()).toBe('asc');
    (comp as any).setSort('name');
    expect((comp as any).sortBy()).toBe('name');
    expect((comp as any).dir()).toBe('asc');
    expect((comp as any).ariaSort('name')).toBe('ascending');
  });

  it('stockist rows carry monthly series and this-month footer data from API orders', async () => {
    const customersApi = makeCustomersApi({ data: [STOCKIST], total: 1 });
    const ordersApi = makeOrdersApi({ data: [ORDER_FOR_STOCKIST], total: 1 });
    const fixture = setup(customersApi, ordersApi);
    const comp = fixture.componentInstance;

    await (comp as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (comp as any).rows() as { monthly?: number[]; monthSpend?: number }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Array.isArray(r.monthly) && r.monthly.length === 6)).toBeTrue();
    expect(rows.every((r) => typeof r.monthSpend === 'number')).toBeTrue();
  });

  it('includes synthesized guest shoppers when view is shoppers', async () => {
    const customersApi = makeCustomersApi({ data: [SHOPPER], total: 1 });
    const guestOrder: ApiOrder = {
      id: 'ord-dennis',
      customer: null,
      guestName: 'Dennis Majesty',
      guestEmail: 'dennis@example.com',
      channel: 'retail',
      source: null,
      status: 'delivered',
      paymentStatus: 'paid',
      totalAmount: 78000,
      shippingAddress: { line: '10 St', city: 'Lagos', state: 'Lagos', phone: '08022222222' },
      deliveryMethod: 'freight',
      deliveredAt: '2026-11-07T12:00:00Z',
      items: [],
      createdAt: '2026-11-07T10:00:00Z',
      updatedAt: '2026-11-07T10:00:00Z',
    };
    const ordersApi = makeOrdersApi({ data: [guestOrder], total: 1 });
    const fixture = setup(customersApi, ordersApi);
    const comp = fixture.componentInstance;

    (comp as any).view.set('shoppers');
    await (comp as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (comp as any).rows();
    expect(rows.some((r: any) => r.name === 'Dennis Majesty')).toBeTrue();
    const dennisRow = rows.find((r: any) => r.name === 'Dennis Majesty');
    expect(dennisRow.orders).toBe(1);
    expect(dennisRow.spend).toBe(78000);
  });
});
