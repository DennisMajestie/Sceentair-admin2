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
  CustomersApiService,
} from './customers-api.service';
import { OrdersApiService } from './orders-api.service';
import { CatalogueApiService, type ApiProduct } from './catalogue-api.service';
import { MaterialsApiService } from './materials-api.service';
import { SuppliersApiService } from './suppliers-api.service';
import { InventoryApiService } from './inventory-api.service';
import { HelpApiService } from './help-api.service';
import { UsersApiService } from './users-api.service';
import { NotificationsApiService } from './notifications-api.service';
import { AuditApiService } from './audit-api.service';
import { BusinessApiService } from './business-api.service';
import { AccountingApiService } from './accounting-api.service';
import { ApprovalsApiService } from './approvals-api.service';
import { ProductionApiService } from './production-api.service';
import { ReturnsApiService } from './returns-api.service';
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
const materialsApi = jasmine.createSpyObj('MaterialsApiService', ['list', 'purchases', 'valuation']);
const suppliersApi = jasmine.createSpyObj('SuppliersApiService', ['list']);
const customersApi = jasmine.createSpyObj('CustomersApiService', ['list']);
const ordersApi = jasmine.createSpyObj('OrdersApiService', ['list']);
const inventoryApi = jasmine.createSpyObj('InventoryApiService', ['counts', 'summary']);
const helpApi = jasmine.createSpyObj('HelpApiService', ['tickets']);
const usersApi = jasmine.createSpyObj('UsersApiService', ['list']);
const notificationsApi = jasmine.createSpyObj('NotificationsApiService', ['list', 'getPreferences']);
const auditApi = jasmine.createSpyObj('AuditApiService', ['list']);
const businessApi = jasmine.createSpyObj('BusinessApiService', ['getProfile']);
const accountingApi = jasmine.createSpyObj('AccountingApiService', ['list']);
const approvalsApi = jasmine.createSpyObj('ApprovalsApiService', ['list']);
const productionApi = jasmine.createSpyObj('ProductionApiService', ['list']);
const returnsApi = jasmine.createSpyObj('ReturnsApiService', ['list']);

function primeLoadMocks(): void {
  catalogueApi.list.and.returnValue(Promise.resolve({ data: [TEST_PRODUCT], total: 1 }));
  materialsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  materialsApi.purchases.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  materialsApi.valuation.and.returnValue(Promise.resolve([]));
  suppliersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  customersApi.list.and.returnValue(Promise.resolve({ data: [TEST_CUSTOMER], total: 1 }));
  ordersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  inventoryApi.counts.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  inventoryApi.summary.and.returnValue(Promise.resolve([]));
  helpApi.tickets.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  usersApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  notificationsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  notificationsApi.getPreferences.and.returnValue(Promise.resolve({}));
  auditApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  businessApi.getProfile.and.returnValue(
    Promise.resolve({
      id: 1,
      name: 'Test Co',
      legalName: null,
      address: null,
      phone: null,
      email: null,
      taxId: null,
      currency: 'GBP',
      timezone: 'Europe/London',
      fiscalStart: '04-01',
      factoryName: null,
      factoryCity: null,
      factoryAddress: null,
      factoryCapacity: null,
      factoryHours: null,
      expiryWarnDays: 30,
      lowStockMode: 'threshold',
      defaultLocationId: null,
      weekStart: 'monday',
      revenueGoal: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
  accountingApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  approvalsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  productionApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  returnsApi.list.and.returnValue(Promise.resolve({ data: [], total: 0 }));
}

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
        { provide: UsersApiService, useValue: usersApi },
        { provide: NotificationsApiService, useValue: notificationsApi },
        { provide: AuditApiService, useValue: auditApi },
        { provide: BusinessApiService, useValue: businessApi },
        { provide: AccountingApiService, useValue: accountingApi },
        { provide: ApprovalsApiService, useValue: approvalsApi },
        { provide: ProductionApiService, useValue: productionApi },
        { provide: ReturnsApiService, useValue: returnsApi },
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
    primeLoadMocks();
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
    primeLoadMocks();
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
