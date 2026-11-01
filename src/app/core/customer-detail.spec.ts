import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CustomerDetailData, buildCustomerDetail, monthlySpendBars, orderStatusTone, relativeDateText } from './customer-detail';
import { Store } from './store';
import { CustomerDetailDrawerComponent } from '../sections/customers/customer-detail-drawer';
import { CustomerShoppers } from '../sections/customers/shoppers';
import {
  ApiCustomer,
  ApiCustomerList,
  CustomersApiService,
} from './customers-api.service';
import {
  ApiOrder,
  OrdersApiService,
} from './orders-api.service';
import { CatalogueApiService, type ApiProduct } from './catalogue-api.service';
import { MaterialsApiService, type ApiMaterial } from './materials-api.service';
import { SuppliersApiService, type ApiSupplier } from './suppliers-api.service';
import { InventoryApiService, type ApiCount } from './inventory-api.service';
import { HelpApiService, type ApiTicket } from './help-api.service';
import { ToastService } from './toast';

const TEST_PRODUCT: ApiProduct = {
  id: 'product-1',
  name: 'Test Product',
  description: '',
  category: 'cat',
  isBestseller: false,
  basePrice: 10,
  salePercent: null,
  saleEndsAt: null,
  primaryImageUrl: null,
  sizeClass: 'M',
  variants: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const TEST_CUSTOMER: ApiCustomer = {
  id: 'customer-1',
  name: 'Test Customer',
  kind: 'stockist',
  contact: '',
  email: '',
  phone: '',
  city: '',
  region: '',
  since: '2026-01-01',
  tags: [],
  note: '',
};

const catalogueApi = jasmine.createSpyObj('CatalogueApiService', ['list']);
const materialsApi = jasmine.createSpyObj('MaterialsApiService', ['list']);
const suppliersApi = jasmine.createSpyObj('SuppliersApiService', ['list']);
const customersApi = jasmine.createSpyObj('CustomersApiService', ['list']);
const ordersApi = jasmine.createSpyObj('OrdersApiService', ['list']);
const inventoryApi = jasmine.createSpyObj('InventoryApiService', ['counts']);
const helpApi = jasmine.createSpyObj('HelpApiService', ['tickets']);

describe('customer detail data', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        { provide: CatalogueApiService, useValue: catalogueApi },
        { provide: MaterialsApiService, useValue: materialsApi },
        { provide: SuppliersApiService, useValue: suppliersApi },
        { provide: CustomersApiService, useValue: customersApi },
        { provide: OrdersApiService, useValue: ordersApi },
        { provide: InventoryApiService, useValue: inventoryApi },
        { provide: HelpApiService, useValue: helpApi },
      ],
    }),
  );

  it('calculates six monthly bars proportionally and keeps zero months visible', () => {
    const now = Date.UTC(2026, 5, 15);
    const order = (id: string, createdAt: number, qty: number, price: number, status = 'delivered') => ({
      id,
      number: id,
      customerId: 'customer-1',
      channel: 'online' as const,
      status: status as 'delivered' | 'cancelled',
      createdAt,
      shipBy: createdAt,
      locId: 'location-1',
      lines: [{ productId: 'product-1', qty, price }],
      carrier: '',
      paid: true,
      history: [],
    });
    const bars = monthlySpendBars(
      [
        order('may', Date.UTC(2026, 4, 4), 1, 100),
        order('june', Date.UTC(2026, 5, 4), 1, 50),
        order('cancelled', Date.UTC(2026, 5, 5), 1, 500, 'cancelled'),
      ],
      now,
    );

    expect(bars.map((bar) => bar.value)).toEqual([0, 0, 0, 0, 100, 50]);
    expect(bars.map((bar) => bar.percent)).toEqual([4, 4, 4, 4, 100, 50]);
    expect(monthlySpendBars([], now).every((bar) => bar.percent === 4)).toBeTrue();
    expect(monthlySpendBars([order('one', Date.UTC(2026, 5, 4), 1, 50)], now)[5].percent).toBe(100);
  });

  it('maps real order states to readable tones and unknown states to neutral', () => {
    expect(orderStatusTone('new')).toBe('info');
    expect(orderStatusTone('delivered')).toBe('good');
    expect(orderStatusTone('cancelled')).toBe('bad');
    expect(orderStatusTone('unmapped')).toBe('quiet');
  });

  it('formats recent dates relatively, older dates fully, and absent dates as omitted', () => {
    const now = Date.UTC(2026, 9, 20, 12);
    expect(relativeDateText(null, now)).toBeNull();
    expect(relativeDateText(now - 6 * 86400000, now)?.primary).toMatch(/d ago$/);
    expect(relativeDateText(now - 8 * 86400000, now)?.primary).toBe('Oct 12');
    expect(relativeDateText(now - 8 * 86400000, now)?.full).toContain('Oct 12');
  });

  it('returns no customer detail for unknown ids and derives the drawer from the store', async () => {
    catalogueApi.list.and.returnValue(Promise.resolve({ data: [TEST_PRODUCT], total: 1 }));
    customersApi.list.and.returnValue(Promise.resolve({ data: [TEST_CUSTOMER], total: 1 }));
    materialsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    suppliersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    ordersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    inventoryApi.counts.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    helpApi.tickets.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    const store = TestBed.inject(Store);
    await store.load();
    expect(buildCustomerDetail(store, 'unknown-customer')).toBeNull();

    const customer = store.customers()[0];
    const detail = buildCustomerDetail(store, customer.id);
    expect(detail?.customer.id).toBe(customer.id);
    expect(detail?.monthly.length).toBe(6);
    expect(detail?.recentOrders.length).toBeLessThanOrEqual(6);
    expect(detail?.mostBought.length).toBeLessThanOrEqual(4);
    expect(detail?.mostBought.every((product) => !!store.productById()[product.id])).toBeTrue();
  });

  it('omits contact, spend, and footer content when their fields have no data', async () => {
    catalogueApi.list.and.returnValue(Promise.resolve({ data: [TEST_PRODUCT], total: 1 }));
    customersApi.list.and.returnValue(Promise.resolve({ data: [TEST_CUSTOMER], total: 1 }));
    materialsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    suppliersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    ordersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    inventoryApi.counts.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    helpApi.tickets.and.returnValue(Promise.resolve({ data: [], total: 0 }));
    const store = TestBed.inject(Store);
    await store.load();
    const customer = store.customers()[0];
    const base = buildCustomerDetail(store, customer.id)!;
    const noData: CustomerDetailData = {
      ...base,
      customer: {
        ...base.customer,
        email: '',
        phone: '',
        city: '',
        region: '',
        tags: [],
        since: 0,
      },
      contactLine: '',
      location: '',
      orderCount: 0,
      cancelledCount: 0,
      averageOrder: null,
      lastOrder: null,
      recentOrders: [],
      mostBought: [],
    };
    const fixture = TestBed.createComponent(CustomerDetailDrawerComponent);
    fixture.componentRef.setInput('account', noData);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('Email');
    expect(text).not.toContain('Phone');
    expect(text).not.toContain('Ships to');
    expect(text).not.toContain('Monthly spend');
    expect(text).not.toContain('Buys most');
    expect(fixture.nativeElement.querySelector('.sd-detail-footer')).toBeNull();
    fixture.destroy();
  });
});

describe('customer detail URL state', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([
          { path: 'customers/shoppers', component: CustomerShoppers },
          { path: 'customers/shoppers/:id', component: CustomerShoppers },
        ]),
        { provide: CustomersApiService, useValue: jasmine.createSpyObj('CustomersApiService', ['list', 'detail']) },
        { provide: OrdersApiService, useValue: jasmine.createSpyObj('OrdersApiService', ['list', 'detail', 'tracking', 'updateStatus', 'publicConfig']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['show', 'dismiss']) },
      ],
    });
    spyOn(window, 'matchMedia').and.callFake(
      (media: string) =>
        ({
          matches: true,
          media,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  });

  it('opens a direct detail path, shows unknown ids, and closes back to the shopper list', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/customers/shoppers/unknown-customer', CustomerShoppers);
    await harness.fixture.whenStable();

    const dialog = harness.routeNativeElement?.querySelector('dialog');
    expect(dialog?.open).toBeTrue();
    expect(harness.routeNativeElement?.textContent).toContain('This customer could not be found.');

    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.sd-detail-close')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/customers/shoppers');
  });
});
