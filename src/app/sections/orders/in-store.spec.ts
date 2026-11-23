import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  CatalogueApiService,
  type ApiProduct,
} from '../../core/catalogue-api.service';
import { OrdersApiService, type ApiOrder } from '../../core/orders-api.service';
import { ToastService } from '../../core/toast';
import { OrdersInStore } from './in-store';

const PRODUCT: ApiProduct = {
  id: 'p-1',
  name: 'Crab Tee',
  description: null,
  category: 'Tops',
  isBestseller: false,
  basePrice: 4200,
  salePercent: null,
  saleEndsAt: null,
  primaryImageUrl: null,
  sizeClass: 'S',
  variants: [
    {
      id: 'v-1',
      size: 'M',
      colour: 'Navy',
      sku: 'CRB15-M-NAVY',
      priceOverride: null,
      imageUrl: null,
      availabilityStatus: 'in_stock',
      storageLocation: null,
    },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const ORDER = {
  id: 'o-1',
  orderNumber: '1001',
  guestName: 'Ada Obi',
  guestEmail: null,
  guestPhone: '08012345678',
  totalAmount: 8400,
  paymentStatus: 'paid',
} as unknown as ApiOrder;

describe('OrdersInStore', () => {
  let fixture: ComponentFixture<OrdersInStore>;
  let catalogue: jasmine.SpyObj<CatalogueApiService>;
  let orders: jasmine.SpyObj<OrdersApiService>;

  beforeEach(async () => {
    catalogue = jasmine.createSpyObj<CatalogueApiService>('CatalogueApiService', ['list']);
    catalogue.list.and.resolveTo({ data: [PRODUCT], total: 1 });
    orders = jasmine.createSpyObj<OrdersApiService>('OrdersApiService', ['create', 'recordPayment']);
    orders.create.and.resolveTo(ORDER);
    orders.recordPayment.and.resolveTo({});

    await TestBed.configureTestingModule({
      imports: [OrdersInStore],
      providers: [
        provideRouter([]),
        { provide: CatalogueApiService, useValue: catalogue },
        { provide: OrdersApiService, useValue: orders },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersInStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates an in-store order with the named buyer and captures exact payment', async () => {
    const page = fixture.componentInstance as unknown as {
      form: { productId: string; variantId: string; quantity: number; buyerName: string; buyerPhone: string; method: string };
      submit: () => Promise<void>;
    };
    page.form = {
      productId: 'p-1',
      variantId: 'v-1',
      quantity: 2,
      buyerName: 'Ada Obi',
      buyerPhone: '08012345678',
      method: 'cash',
    };

    await page.submit();
    fixture.detectChanges();

    expect(orders.create).toHaveBeenCalledWith({
      channel: 'in_store',
      source: 'in_store',
      items: [{ variantId: 'v-1', quantity: 2 }],
      walkIn: { name: 'Ada Obi', phone: '08012345678' },
    });
    expect(orders.recordPayment).toHaveBeenCalledWith('o-1', { method: 'cash', amount: 8400 });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sale recorded');
  });
});
