import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiProduct,
  ApiProductList,
  CatalogueApiService,
} from '../../core/catalogue-api.service';
import { InventoryApiService } from '../../core/inventory-api.service';
import { ProductsCatalog } from './catalog';
import { ProductItem } from './item';
import { ToastService } from '../../core/toast';

const PRODUCT: ApiProduct = {
  id: 'p-crb15',
  name: 'Calendula Rescue Balm',
  description: 'A pocket tin of the rescue balm for lips, cuticles and dry patches.',
  category: 'Moisturise',
  isBestseller: true,
  basePrice: 14,
  salePercent: null,
  saleEndsAt: null,
  primaryImageUrl: 'balm',
  sizeClass: 'medium',
  variants: [
    {
      id: 'v-crb15-15',
      size: '15 ml',
      colour: null,
      sku: 'MF-CRB-15',
      priceOverride: null,
      imageUrl: null,
      availabilityStatus: 'in_stock',
      storageLocation: 'A-04',
    },
    {
      id: 'v-crb15-50',
      size: '50 ml',
      colour: null,
      sku: 'MF-CRB-50',
      priceOverride: null,
      imageUrl: null,
      availabilityStatus: 'out_of_stock',
      storageLocation: null,
    },
  ],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
  soldCount: 42,
  salePrice: null,
};

const SALE_PRODUCT: ApiProduct = {
  ...PRODUCT,
  id: 'p-sale',
  name: 'Sale Item',
  basePrice: 40,
  salePercent: 25,
  saleEndsAt: '2026-02-15T00:00:00Z',
  salePrice: 30,
};

function makeCatalogueApi(listResult: ApiProductList = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('CatalogueApiService', ['list', 'detail', 'variants', 'categories', 'collections']);
  api.list.and.returnValue(Promise.resolve(listResult));
  api.categories.and.returnValue(Promise.resolve([]));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function createComponent(catalogueApi: ReturnType<typeof makeCatalogueApi>) {
  TestBed.configureTestingModule({
    imports: [ProductsCatalog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CatalogueApiService, useValue: catalogueApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(ProductsCatalog);
}

describe('catalogue response mapping', () => {
  it('maps api product fields verbatim to catalog rows', async () => {
    const catalogueApi = makeCatalogueApi({ data: [PRODUCT], total: 1 });
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('p-crb15');
    expect(rows[0].name).toBe('Calendula Rescue Balm');
    expect(rows[0].category).toBe('Moisturise');
    expect(rows[0].price).toBe(14);
    expect(rows[0].isBestseller).toBeTrue();
    expect(rows[0].soldCount).toBe(42);
    expect(rows[0].variants).toHaveSize(2);
    expect(rows[0].photo).toBe('balm');
  });

  describe('product detail stock alignment', () => {
    function createProductDetail(
      inventoryRows: Array<{
        itemType: string;
        itemId: string;
        currentQuantity: number;
        byMovementType: Record<string, number>;
      }> = [],
      inventoryFailure?: Error,
    ) {
      const catalogueApi = jasmine.createSpyObj('CatalogueApiService', ['list', 'detail']);
      catalogueApi.list.and.returnValue(Promise.resolve({ data: [PRODUCT], total: 1 }));
      catalogueApi.detail.and.returnValue(Promise.resolve(PRODUCT));
      const inventoryApi = jasmine.createSpyObj('InventoryApiService', ['summary']);
      inventoryApi.summary.and.returnValue(
        inventoryFailure ? Promise.reject(inventoryFailure) : Promise.resolve(inventoryRows),
      );

      TestBed.configureTestingModule({
        imports: [ProductItem],
        providers: [
          { provide: CatalogueApiService, useValue: catalogueApi },
          { provide: InventoryApiService, useValue: inventoryApi },
          {
            provide: ActivatedRoute,
            useValue: {
              paramMap: of({ get: () => 'p-crb15' } as unknown as ParamMap),
              snapshot: {
                paramMap: { get: () => 'p-crb15' },
                queryParams: {},
              },
            },
          },
          {
            provide: Router,
            useValue: { navigate: jasmine.createSpy('navigate') },
          },
        ],
      });
      return TestBed.createComponent(ProductItem);
    }

    it('shows ledger quantities and variant stock distribution, not catalogue status as quantity', async () => {
      const fixture = createProductDetail([{
        itemType: 'variant',
        itemId: 'v-crb15-15',
        currentQuantity: 612,
        byMovementType: { production: 700, sale: -88 },
      }]);

      await fixture.whenStable();
      fixture.detectChanges();

      const component = fixture.componentInstance as any;
      expect(component.onHand()).toBe(612);
      expect(component.stockedVariants()).toBe(1);
      expect(component.emptyVariants()).toBe(1);
      expect(fixture.nativeElement.textContent).toContain('612 on hand');
      expect(fixture.nativeElement.textContent).toContain('MF-CRB-50');
      expect(fixture.nativeElement.textContent).not.toContain('A-04');
    });

    it('keeps stock unavailable and reports errors when the inventory ledger fails', async () => {
      const fixture = createProductDetail([], new Error('Inventory unavailable'));
      await fixture.whenStable();
      const component = fixture.componentInstance as any;
      fixture.detectChanges();

      expect(component.onHand()).toBeNull();
      expect(component.inventoryError()).toBe('Inventory unavailable');
    });
  });

  it('uses sale price when a sale is running', async () => {
    const catalogueApi = makeCatalogueApi({ data: [SALE_PRODUCT], total: 1 });
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows[0].price).toBe(30);
  });

  it('falls back to variant image URL when product has no primary image', async () => {
    const productNoImage: ApiProduct = {
      ...PRODUCT,
      primaryImageUrl: '',
      variants: [
        { ...PRODUCT.variants[0], imageUrl: null },
        { ...PRODUCT.variants[1], imageUrl: 'variant-img' },
      ],
    };
    const catalogueApi = makeCatalogueApi({ data: [productNoImage], total: 1 });
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows[0].photo).toBe('variant-img');
  });

  it('filters products by category from the API', async () => {
    const catalogueApi = makeCatalogueApi({ data: [PRODUCT], total: 1 });
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    (component as any).queryState.set({ ...(component as any).queryState(), category: 'Moisturise' });
    const visible = (component as any).visibleRows();
    expect(visible).toHaveSize(1);

    (component as any).queryState.set({ ...(component as any).queryState(), category: 'Body' });
    const visible2 = (component as any).visibleRows();
    expect(visible2).toHaveSize(0);
  });

  it('does not fabricate fields the API lacks (no stock, cost, reorder, bin, barcode)', async () => {
    const catalogueApi = makeCatalogueApi({ data: [PRODUCT], total: 1 });
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).stock).toBeUndefined();
    expect((rows[0] as any).cost).toBeUndefined();
    expect((rows[0] as any).reorderAt).toBeUndefined();
    expect((rows[0] as any).bin).toBeUndefined();
    expect((rows[0] as any).barcode).toBeUndefined();
    expect((rows[0] as any).wholesale).toBeUndefined();
    expect((rows[0] as any).active).toBeUndefined();
    expect((rows[0] as any).bom).toBeUndefined();
    expect((rows[0] as any).blurb).toBeUndefined();
    expect((rows[0] as any).shelfMonths).toBeUndefined();
  });

  it('maps category filters from the API', async () => {
    const catalogueApi = makeCatalogueApi({ data: [], total: 0 });
    catalogueApi.categories.and.returnValue(Promise.resolve([
      { id: 'c-1', name: 'Moisturise' },
      { id: 'c-2', name: 'Cleanse' },
    ]));
    const fixture = createComponent(catalogueApi);
    const component = fixture.componentInstance;

    await (component as any).loadCatalog();
    await fixture.whenStable();

    const categories = (component as any).categories();
    expect(categories).toEqual([
      { id: 'c-1', name: 'Moisturise' },
      { id: 'c-2', name: 'Cleanse' },
    ]);
  });
});
