import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { InventoryApiService } from '../../core/inventory-api.service';
import { CatalogueApiService } from '../../core/catalogue-api.service';
import { MaterialsApiService } from '../../core/materials-api.service';
import { ProductionApiService } from '../../core/production-api.service';
import { ReturnsApiService } from '../../core/returns-api.service';
import { WarehouseStock } from './inventory';

const PRODUCT_VARIANT = {
  id: 'p-tee',
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
      id: 'v-crb15-15',
      size: 'M',
      colour: 'Navy',
      sku: 'CRB15-M-NAVY',
      priceOverride: null,
      imageUrl: null,
      availabilityStatus: 'in_stock' as const,
      storageLocation: null,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const MATERIAL = {
  id: 'm-shea',
  name: 'Shea butter',
  unit: 'kg',
  category: 'other' as const,
  storageLocation: 'Warehouse A',
  reorderThreshold: 10,
  createdAt: '2025-01-01T00:00:00Z',
  currentQuantity: 46,
  lowStock: false,
};

interface Apis {
  inventoryApi: jasmine.SpyObj<InventoryApiService>;
  catalogueApi: jasmine.SpyObj<CatalogueApiService>;
  materialsApi: jasmine.SpyObj<MaterialsApiService>;
  productionApi: jasmine.SpyObj<ProductionApiService>;
  returnsApi: jasmine.SpyObj<ReturnsApiService>;
}

function makeApis(overrides: {
  summary?: unknown;
  ledger?: unknown;
} = {}): Apis {
  const inventoryApi = jasmine.createSpyObj('InventoryApiService', ['summary', 'ledgerVerify']);
  inventoryApi.summary.and.returnValue(
    Promise.resolve(
      (overrides.summary ?? [
        {
          itemType: 'variant',
          itemId: 'v-crb15-15',
          currentQuantity: 612,
          byMovementType: { PURCHASE: 700, SALE: -88 },
        },
        {
          itemType: 'material',
          itemId: 'm-shea',
          currentQuantity: 46,
          byMovementType: { PURCHASE: 60, PRODUCTION: -14 },
        },
      ]) as never,
    ),
  );
  inventoryApi.ledgerVerify.and.returnValue(
    Promise.resolve(
      (overrides.ledger ?? {
        total: 100,
        valid: 100,
        broken: 0,
        headHash: 'abcdef0123456789ffffffffffffffff',
      }) as never,
    ),
  );

  const catalogueApi = jasmine.createSpyObj('CatalogueApiService', ['list']);
  catalogueApi.list.and.returnValue(
    Promise.resolve({ data: [PRODUCT_VARIANT], total: 1 } as never),
  );
  const materialsApi = jasmine.createSpyObj('MaterialsApiService', ['list', 'valuation']);
  materialsApi.list.and.returnValue(
    Promise.resolve({ data: [MATERIAL], total: 1 } as never),
  );
  const productionApi = jasmine.createSpyObj('ProductionApiService', ['list']);
  productionApi.list.and.returnValue(
    Promise.resolve(
      {
        data: [
          { quantity: 30, stage: 'cutting' },
          { quantity: 18, stage: 'qa' },
        ],
        stages: ['cutting', 'qa'],
        total: 2,
      } as never,
    ),
  );
  const returnsApi = jasmine.createSpyObj('ReturnsApiService', ['list']);
  returnsApi.list.and.returnValue(
    Promise.resolve(
      {
        data: [{ status: 'requested' }, { status: 'requested' }, { status: 'refunded' }],
        total: 3,
      } as never,
    ),
  );

  return { inventoryApi, catalogueApi, materialsApi, productionApi, returnsApi };
}

function createComponent(apis: Apis) {
  TestBed.configureTestingModule({
    imports: [WarehouseStock],
    providers: [
      { provide: InventoryApiService, useValue: apis.inventoryApi },
      { provide: CatalogueApiService, useValue: apis.catalogueApi },
      { provide: MaterialsApiService, useValue: apis.materialsApi },
      { provide: ProductionApiService, useValue: apis.productionApi },
      { provide: ReturnsApiService, useValue: apis.returnsApi },
      {
        provide: Router,
        useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') },
      },
    ],
  });
  return TestBed.createComponent(WarehouseStock);
}

describe('warehouses inventory list', () => {
  it('maps summary rows with labels from product and material lookups', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance;

    await (component as never as { load(): Promise<void> }).load();
    await fixture.whenStable();

    const rows = (component as never as { rows(): unknown[] }).rows();
    expect(rows).toHaveSize(2);
    const first = rows[0] as Record<string, unknown>;
    const second = rows[1] as Record<string, unknown>;
    expect(first['itemId']).toBe('v-crb15-15');
    expect(first['label']).toBe('CRB15-M-NAVY');
    expect(first['quantity']).toBe(612);
    expect(first['movements']).toBe('Purchase +700, Sale −88');
    expect(second['label']).toBe('Shea butter');
    expect(second['quantity']).toBe(46);
  });

  it('values variants only and never materials', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance;

    await (component as never as { load(): Promise<void> }).load();
    await fixture.whenStable();

    const rows = (component as never as { rows(): Array<{ value: number | null }> }).rows();
    expect(rows[0]['value']).toBe(612 * 4200);
    expect(rows[1]['value']).toBeNull();
    expect(
      (component as never as { finishedValue(): number }).finishedValue(),
    ).toBe(612 * 4200);
  });

  it('derives WIP and returns-awaiting counters from their services', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance;

    await (component as never as { load(): Promise<void> }).load();
    await fixture.whenStable();

    expect((component as never as { wipUnits(): number }).wipUnits()).toBe(30);
    expect(
      (component as never as { returnsAwaiting(): number }).returnsAwaiting(),
    ).toBe(2);
    expect(
      (component as never as { materialCount(): number }).materialCount(),
    ).toBe(1);
  });

  it('filters by type and search term', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      filter: { set(v: string): void };
      query: { set(v: string): void; (): string };
      visible(): unknown[];
    };

    await component.load();
    await fixture.whenStable();

    component.filter.set('material');
    expect(component.visible()).toHaveSize(1);
    component.filter.set('all');
    component.query.set('CRB15');
    expect(component.visible()).toHaveSize(1);
    expect((component.visible() as Array<Record<string, unknown>>)[0]['label']).toBe('CRB15-M-NAVY');
    component.query.set('does-not-exist');
    expect(component.visible()).toHaveSize(0);
  });

  it('check ledger reveals the integrity report and fingerprint', async () => {
    const apis = makeApis({
      ledger: { total: 120, valid: 118, broken: 2, headHash: 'abcdef0123456789ffffffffffffffff' },
    });
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      checkLedger(): Promise<void>;
      ledgerReport(): { broken: number; total: number } | null;
      fp(): string | null;
    };

    await component.load();
    expect(component.ledgerReport()).toBeNull();
    await component.checkLedger();
    expect(component.ledgerReport()).toEqual(
      jasmine.objectContaining({ total: 120, broken: 2 }),
    );
    expect(component.fp()).toBe('abcdef0123456789');
  });

  it('surfaces a summary failure as an error banner', async () => {
    const apis = makeApis();
    const spy = apis.inventoryApi.summary as jasmine.Spy;
    spy.and.returnValue(Promise.reject({ error: { message: 'No ledger access.' } }));
    const fixture = createComponent(apis);
    const component = fixture.componentInstance as never as {
      load(): Promise<void>;
      error(): string | null;
    };

    await component.load();
    expect(component.error()).toBe('No ledger access.');
  });
});
