import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiCustomer,
  ApiCustomerKind,
  ApiCustomerList,
  CustomersApiService,
} from '../../core/customers-api.service';
import {
  ApiOrder,
  ApiOrderStatus,
  OrdersApiService,
} from '../../core/orders-api.service';
import { ToastService } from '../../core/toast';
import { Customers } from './customers';

const CUSTOMER: ApiCustomer = {
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
  note: 'Reorders the balm every 4–5 weeks. Prefers UPS.',
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

const ORDER_FOR_CUSTOMER: ApiOrder = {
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

function createComponent(customersApi: ReturnType<typeof makeCustomersApi>, ordersApi: ReturnType<typeof makeOrdersApi>) {
  TestBed.configureTestingModule({
    imports: [Customers],
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

describe('customers response mapping', () => {
  it('maps api customer fields verbatim to row fields', async () => {
    const customersApi = makeCustomersApi({ data: [CUSTOMER], total: 1 });
    const ordersApi = makeOrdersApi({ data: [], total: 0 });
    const fixture = createComponent(customersApi, ordersApi);
    const component = fixture.componentInstance;

    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('c-juniper-moss-apothecary');
    expect(rows[0].name).toBe('Juniper & Moss Apothecary');
    expect(rows[0].contact).toBe('Clara Lindqvist');
    expect(rows[0].email).toBe('clara@junipermoss.com');
    expect(rows[0].phone).toBe('(896) 555-0129');
    expect(rows[0].city).toBe('Portland');
    expect(rows[0].region).toBe('OR');
    expect(rows[0].since).toBe(Date.parse('2026-07-19T00:00:00Z'));
    expect(rows[0].tags).toEqual(['vip', 'net30']);
    expect(rows[0].note).toBe("Reorders the balm every 4–5 weeks. Prefers UPS.");
  });

  it('filters stockists vs shoppers by kind from the API', async () => {
    const customersApi = makeCustomersApi({ data: [CUSTOMER, SHOPPER], total: 2 });
    const ordersApi = makeOrdersApi({ data: [], total: 0 });
    const fixture = createComponent(customersApi, ordersApi);
    const component = fixture.componentInstance;

    (component as any).view.set('stockists');
    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('c-juniper-moss-apothecary');

    (component as any).view.set('shoppers');
    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const shopperRows = (component as any).rows();
    expect(shopperRows).toHaveSize(1);
    expect(shopperRows[0].id).toBe('c-amara-nwosu');
  });

  it('computes order aggregates (spend, order count, last order) from API orders', async () => {
    const customersApi = makeCustomersApi({ data: [CUSTOMER], total: 1 });
    const ordersApi = makeOrdersApi({ data: [ORDER_FOR_CUSTOMER, { ...ORDER_FOR_CUSTOMER, id: 'o-2', totalAmount: 50, createdAt: '2026-01-10T00:00:00Z' }], total: 2 });
    const fixture = createComponent(customersApi, ordersApi);
    const component = fixture.componentInstance;

    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].orders).toBe(2);
    expect(rows[0].spend).toBe(150);
    expect(rows[0].lastOrder).toBe(Date.parse('2026-01-15T10:00:00Z'));
  });

  it('computes monthly spend series from API orders', async () => {
    const customersApi = makeCustomersApi({ data: [CUSTOMER], total: 1 });
    const ordersApi = makeOrdersApi({ data: [ORDER_FOR_CUSTOMER], total: 1 });
    const fixture = createComponent(customersApi, ordersApi);
    const component = fixture.componentInstance;

    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows[0].monthly).toHaveSize(6);
    expect(rows[0].monthly.every((m: number) => typeof m === 'number')).toBeTrue();
  });

  it('does not fabricate fields the API lacks (no shipBy, no locId on customer rows)', async () => {
    const customersApi = makeCustomersApi({ data: [CUSTOMER], total: 1 });
    const ordersApi = makeOrdersApi({ data: [], total: 0 });
    const fixture = createComponent(customersApi, ordersApi);
    const component = fixture.componentInstance;

    await (component as any).loadCustomers(true);
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).shipBy).toBeUndefined();
    expect((rows[0] as any).locId).toBeUndefined();
    expect((rows[0] as any).carrier).toBeUndefined();
  });
});
