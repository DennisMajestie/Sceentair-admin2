import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiOrder,
  ApiOrderList,
  ApiOrderStatus,
  ApiPublicConfig,
  ApiTracking,
  OrdersApiService,
} from '../../core/orders-api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast';
import { OrdersAll } from './all';

const PUBLIC_CONFIG: ApiPublicConfig = {
  currencyCode: 'USD',
  currencySymbol: '$',
  locale: 'en-US',
  serverNow: new Date('2026-01-15T12:00:00Z').toISOString(),
};

const ORDER: ApiOrder = {
  id: 'o-1',
  customer: { id: 'c-1', name: 'Juniper & Moss Apothecary', email: 'clara@junipermoss.com', phone: '(896) 555-0129' },
  guestName: null,
  guestEmail: null,
  channel: 'retail',
  source: null,
  status: 'order_received',
  paymentStatus: 'paid',
  totalAmount: 46,
  deliveryFee: 6,
  shippingAddress: { state: 'OR', city: 'Portland', line: '123 Main St', phone: '(896) 555-0129' },
  deliveryMethod: 'freight',
  deliveredAt: null,
  items: [
    {
      id: 'i-1',
      quantity: 2,
      unitPrice: 20,
      variant: {
        id: 'v-1',
        sku: 'MF-CRB-15',
        size: '15 ml',
        colour: null,
        imageUrl: null,
        product: { id: 'crb15', name: 'Calendula Rescue Balm', primaryImageUrl: 'balm' },
      },
    },
    {
      id: 'i-2',
      quantity: 1,
      unitPrice: 6,
      variant: { id: 'v-2', sku: 'MF-CLO-30', size: '30 ml', colour: null, imageUrl: null },
    },
  ],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const TRACKING: ApiTracking = {
  status: 'order_received',
  deliveredAt: null,
  events: [
    { status: 'order_received', note: 'Order confirmed', actor: 'Imani Okafor', createdAt: '2026-01-15T10:00:00Z' },
    { status: 'awaiting_payment', note: null, actor: null, createdAt: '2026-01-14T09:00:00Z' },
  ],
  deliveries: [],
};

function makeApi(listResult: ApiOrderList = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('OrdersApiService', [
    'list',
    'detail',
    'tracking',
    'updateStatus',
    'publicConfig',
  ]);
  api.list.and.returnValue(Promise.resolve(listResult));
  api.publicConfig.and.returnValue(Promise.resolve(PUBLIC_CONFIG));
  return api;
}

function makeAuth(user: { id: string; access: Record<string, string> } | null = null) {
  const auth = jasmine.createSpyObj('AuthService', ['user']);
  auth.user.and.returnValue(user);
  return auth;
}

function createComponent(api: ReturnType<typeof makeApi>, auth: ReturnType<typeof makeAuth>) {
  TestBed.configureTestingModule({
    imports: [OrdersAll],
    providers: [
      { provide: OrdersApiService, useValue: api },
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['show', 'dismiss']) },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(OrdersAll);
}

describe('orders list response mapping', () => {
  it('maps api statuses verbatim and does not equate them to vessa domain statuses', () => {
    const api = makeApi({ data: [ORDER], total: 1 });
    const auth = makeAuth();
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    (component as any).selectedOrder.set(ORDER);
    (component as any).tracking.set(TRACKING);
    (component as any).publicConfig.set(PUBLIC_CONFIG);

    const selected = (component as any).selected();
    expect(selected.status).toBe('order_received');
    expect(selected.label).toBe('Order Received');
    expect(selected.tone).toBe('good');
    expect(selected.paymentStatus).toBe('paid');
  });

  it('falls back from customer to guest to walk-in when customer is absent', () => {
    const api = makeApi();
    const auth = makeAuth();
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    (component as any).selectedOrder.set({ ...ORDER, customer: null, guestName: 'Guest User', guestEmail: 'guest@example.com' });
    (component as any).tracking.set(TRACKING);
    (component as any).publicConfig.set(PUBLIC_CONFIG);

    expect(((component as any).selected() as { customer: string }).customer).toBe('Guest User');

    (component as any).selectedOrder.set({ ...ORDER, customer: null, guestName: null, guestEmail: null });
    expect(((component as any).selected() as { customer: string }).customer).toBe('Walk-in customer');
  });

  it('maps items, units, subtotal and total from the api response', () => {
    const api = makeApi();
    const auth = makeAuth();
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    (component as any).selectedOrder.set(ORDER);
    (component as any).tracking.set(TRACKING);
    (component as any).publicConfig.set(PUBLIC_CONFIG);

    const selected = (component as any).selected();
    expect(selected.units).toBe(3);
    expect(selected.total).toBe(46);
    expect(selected.subtotal).toBe(46);
    expect(selected.lines).toHaveSize(2);
    expect(selected.lines[0]).toEqual(
      jasmine.objectContaining({
        name: 'Calendula Rescue Balm',
        size: '15 ml',
        sku: 'MF-CRB-15',
        qty: 2,
        price: 20,
        lineTotal: 40,
      }),
    );
    expect(selected.lines[1]).toEqual(
      jasmine.objectContaining({ name: 'MF-CLO-30', size: '30 ml', qty: 1, price: 6, lineTotal: 6 }),
    );
  });

  it('maps delivery details and payment summary', () => {
    const api = makeApi();
    const auth = makeAuth();
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    (component as any).selectedOrder.set(ORDER);
    (component as any).tracking.set(TRACKING);
    (component as any).publicConfig.set(PUBLIC_CONFIG);

    const selected = (component as any).selected();
    expect(selected.deliveryFee).toBe(6);
    expect(selected.deliveryMethodLabel).toBe('Freight');
    expect(selected.shippingAddress?.line).toBe('123 Main St');
    expect(selected.paymentStatusLabel).toBe('Paid');
  });

  it('maps tracking events to history with actor attribution', () => {
    const api = makeApi();
    const auth = makeAuth();
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    (component as any).selectedOrder.set(ORDER);
    (component as any).tracking.set(TRACKING);
    (component as any).publicConfig.set(PUBLIC_CONFIG);

    const selected = (component as any).selected();
    expect(selected.history).toHaveSize(2);
    expect(selected.history[0]).toEqual(
      jasmine.objectContaining({
        label: 'Order Received',
        note: 'Order confirmed',
        actor: 'Imani Okafor',
      }),
    );
    expect(selected.history[0].at).toBe(Date.parse('2026-01-15T10:00:00Z'));
    expect(selected.history[1]).toEqual(
      jasmine.objectContaining({ label: 'Awaiting Payment', note: null, actor: null }),
    );
  });
});

describe('order status filters', () => {
  it('keeps every status count visible when one status is selected', () => {
    const orders: ApiOrder[] = [
      ORDER,
      { ...ORDER, id: 'o-2', status: 'delivered' },
      { ...ORDER, id: 'o-3', status: 'awaiting_payment', paymentStatus: 'unpaid' },
    ];
    const api = makeApi({ data: orders, total: orders.length });
    const fixture = createComponent(api, makeAuth());
    const component = fixture.componentInstance as any;

    component.orders.set(orders);

    expect(component.statusCount('all')).toBe(3);
    expect(component.statusCount('order_received')).toBe(1);
    expect(component.statusCount('delivered')).toBe(1);
    expect(component.statusCount('awaiting_payment')).toBe(1);

    component.setStatus('delivered');

    expect(component.visible()).toHaveSize(1);
    expect(component.visible()[0].status).toBe('delivered');
    expect(component.statusCount('all')).toBe(3);
    expect(component.statusCount('order_received')).toBe(1);
    expect(component.statusCount('awaiting_payment')).toBe(1);
  });
});

describe('permitted status actions', () => {
  const baseOrder: { id: string; status: ApiOrderStatus; paymentStatus: string; channel: 'retail' } = {
    id: 'o-1',
    status: 'order_received',
    paymentStatus: 'paid',
    channel: 'retail',
  };

  it('advances only the next flow step when paid and the actor has full access', () => {
    const api = makeApi();
    const auth = makeAuth({ id: 'm-okafor', access: { retail_orders: 'full' } });
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance(baseOrder, 'processing')).toBeTrue();
  });

  it('denies advancement when payment is not paid', () => {
    const api = makeApi();
    const auth = makeAuth({ id: 'm-okafor', access: { retail_orders: 'full' } });
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance({ ...baseOrder, paymentStatus: 'unpaid' }, 'processing')).toBeFalse();
  });

  it('denies skipping or reversing steps', () => {
    const api = makeApi();
    const auth = makeAuth({ id: 'm-okafor', access: { retail_orders: 'full' } });
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance(baseOrder, 'shipped')).toBeFalse();
    expect((component as any).canAdvance({ ...baseOrder, status: 'processing' }, 'order_received')).toBeFalse();
  });

  it('denies advancement without full access', () => {
    const api = makeApi();
    const auth = makeAuth({ id: 'm-demir', access: { retail_orders: 'view' } });
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance(baseOrder, 'processing')).toBeFalse();
  });

  it('denies advancement when there is no signed-in actor', () => {
    const api = makeApi();
    const auth = makeAuth(null);
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance(baseOrder, 'processing')).toBeFalse();
  });

  it('requires the status to be a known api flow status', () => {
    const api = makeApi();
    const auth = makeAuth({ id: 'm-okafor', access: { retail_orders: 'full' } });
    const fixture = createComponent(api, auth);
    const component = fixture.componentInstance;

    expect((component as any).canAdvance({ ...baseOrder, status: 'stock_exception' as ApiOrderStatus }, 'processing')).toBeFalse();
  });
});
