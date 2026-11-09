import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotificationsApiService } from '../../core/notifications-api.service';
import { OrdersApiService, type ApiOrder } from '../../core/orders-api.service';
import { ReturnsApiService } from '../../core/returns-api.service';
import { ToastService } from '../../core/toast';
import { MessagesInbox, threadsFrom } from './inbox';

function makeOrder(over: Partial<ApiOrder> = {}): ApiOrder {
  return {
    id: '8626acab-28dd-473f-b587-42ff7ab8865d',
    customer: { id: 'c1', name: 'Adaeze O.', email: 'adaeze@example.ng', phone: null },
    guestName: null,
    guestEmail: null,
    channel: 'retail',
    source: null,
    status: 'order_received',
    paymentStatus: 'paid',
    totalAmount: 9000,
    deliveryFee: null,
    shippingAddress: null,
    deliveryMethod: null,
    deliveredAt: null,
    items: [],
    createdAt: '2026-09-15T15:27:00',
    updatedAt: '2026-09-15T15:27:00',
    ...over,
  };
}

type AuthUser = { id: string; email: string; role: string; access: Record<string, string> };

interface Apis {
  ordersApi: jasmine.SpyObj<OrdersApiService>;
  returnsApi: jasmine.SpyObj<ReturnsApiService>;
  notificationsApi: jasmine.SpyObj<NotificationsApiService>;
  toasts: jasmine.SpyObj<ToastService>;
  user: ReturnType<typeof signal<AuthUser>>;
}

function makeApis(orders: ApiOrder[] = [makeOrder()], level = 'full'): Apis {
  const ordersApi = jasmine.createSpyObj<OrdersApiService>('OrdersApiService', ['list']);
  ordersApi.list.and.returnValue(Promise.resolve({ data: orders, total: orders.length }));
  const returnsApi = jasmine.createSpyObj<ReturnsApiService>('ReturnsApiService', ['list', 'resolve']);
  returnsApi.list.and.returnValue(
    Promise.resolve({
      data: [{ status: 'requested' }, { status: 'refunded' }] as never,
      total: 2,
    }),
  );
  const notificationsApi = jasmine.createSpyObj<NotificationsApiService>('NotificationsApiService', ['send']);
  notificationsApi.send.and.returnValue(Promise.resolve({}));
  const toasts = jasmine.createSpyObj<ToastService>('ToastService', ['show', 'dismiss']);
  const user = signal<AuthUser>({
    id: 'u-1',
    email: 'admin@vessa.test',
    role: 'sales',
    access: { communication: level },
  });
  return { ordersApi, returnsApi, notificationsApi, toasts, user };
}

function createComponent(apis: Apis) {
  TestBed.configureTestingModule({
    imports: [MessagesInbox],
    providers: [
      provideRouter([]),
      { provide: OrdersApiService, useValue: apis.ordersApi },
      { provide: ReturnsApiService, useValue: apis.returnsApi },
      { provide: NotificationsApiService, useValue: apis.notificationsApi },
      { provide: ToastService, useValue: apis.toasts },
      { provide: AuthService, useValue: { user: apis.user } },
    ],
  });
  return TestBed.createComponent(MessagesInbox);
}

describe('threadsFrom', () => {
  it('groups orders by customer, newest first, and skips guest orders', () => {
    const threads = threadsFrom([
      makeOrder(),
      makeOrder({ id: 'b', createdAt: '2026-10-01T10:00:00', totalAmount: 4000 }),
      makeOrder({
        id: 'c',
        customer: { id: 'c2', name: 'Ngozi A.', email: 'n@x.ng', phone: null },
        createdAt: '2026-09-20T10:00:00',
      }),
      makeOrder({ id: 'd', customer: null, guestName: 'Guest', guestEmail: 'g@x.ng' }),
    ]);
    expect(threads.map((t) => t.name)).toEqual(['Adaeze O.', 'Ngozi A.']);
    expect(threads[0].orders.map((o) => o.id)).toEqual([
      'b',
      '8626acab-28dd-473f-b587-42ff7ab8865d',
    ]);
    expect(threads[0].lifetimeValue).toBe(13000);
    expect(threads[0].lastOrderAt).toBe('2026-10-01T10:00:00');
  });

  it('sums lifetime value and keeps the latest order first per thread', () => {
    const threads = threadsFrom([
      makeOrder({ id: 'a', totalAmount: 5000, createdAt: '2026-09-01T00:00:00' }),
      makeOrder({ id: 'b', totalAmount: 2500, createdAt: '2026-09-09T00:00:00' }),
    ]);
    expect(threads).toHaveSize(1);
    expect(threads[0].lifetimeValue).toBe(7500);
    expect(threads[0].orders[0].id).toBe('b');
  });
});

describe('MessagesInbox', () => {
  it('lists customer threads with lifetime value and latest status', async () => {
    const apis = makeApis([
      makeOrder(),
      makeOrder({ id: 'b', status: 'shipped', paymentStatus: 'unpaid' }),
    ]);
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      rows(): Array<{ name: string; lifetimeValue: number }>;
      unpaidOrders(): number;
      returnsPending(): number;
    };

    await component.load();
    await fixture.whenStable();

    const rows = component.rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].name).toBe('Adaeze O.');
    expect(rows[0].lifetimeValue).toBe(18000);
    expect(component.unpaidOrders()).toBe(1);
    expect(component.returnsPending()).toBe(1);
  });

  it('surfaces a failed load as an error, never as an empty list', async () => {
    const apis = makeApis();
    (apis.ordersApi.list as jasmine.Spy).and.returnValue(
      Promise.reject({ error: { message: 'Database is unreachable.' } }),
    );
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      error(): string | null;
    };

    await component.load();
    expect(component.error()).toBe('Database is unreachable.');
  });

  it('requires a draft message before sending', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      threads(): Array<{ id: string }>;
      open(t: unknown): void;
      send(t: unknown): Promise<void>;
      draftError(): string | null;
    };

    await component.load();
    const thread = component.threads()[0];
    component.open(thread);
    await component.send(thread);

    expect(component.draftError()).toContain('Write the update first');
    expect(apis.notificationsApi.send).not.toHaveBeenCalled();
  });

  it('sends the update as an in-platform notification on the chosen order', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      threads(): Array<{ id: string }>;
      open(t: unknown): void;
      applyMacro(text: string): void;
      send(t: unknown): Promise<void>;
      selected(): unknown;
    };

    await component.load();
    const thread = component.threads()[0];
    component.open(thread);
    component.applyMacro('Your order is on its way.');
    await component.send(thread);

    expect(apis.notificationsApi.send).toHaveBeenCalledWith({
      recipientId: 'c1',
      channel: 'in_platform',
      type: 'order_update',
      message: 'Your order is on its way.',
      relatedOrderId: '8626acab-28dd-473f-b587-42ff7ab8865d',
    });
    expect(component.selected()).toBeNull();
    expect(apis.toasts.show).toHaveBeenCalledWith('Update sent to Adaeze O.', 'good');
  });

  it('lets a view-only role read but not send', () => {
    const apis = makeApis([makeOrder()], 'view');
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as { canSend(): boolean };

    expect(component.canSend()).toBe(false);
  });
});
