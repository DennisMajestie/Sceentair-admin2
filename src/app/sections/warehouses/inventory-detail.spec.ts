import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { InventoryApiService } from '../../core/inventory-api.service';
import { CatalogueApiService } from '../../core/catalogue-api.service';
import { MaterialsApiService } from '../../core/materials-api.service';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { ToastService } from '../../core/toast';
import { WarehouseStockDetail } from './inventory-detail';

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
      priceOverride: 4400,
      imageUrl: null,
      availabilityStatus: 'in_stock' as const,
      storageLocation: null,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const MOVEMENTS = {
  data: [
    {
      id: 'mv-1',
      movementType: 'production' as const,
      quantityDelta: 700,
      timestamp: '2026-03-01T09:00:00Z',
      referenceId: 'REQ-PO-9',
    },
    {
      id: 'mv-2',
      movementType: 'sale' as const,
      quantityDelta: -88,
      timestamp: '2026-03-02T10:30:00Z',
      referenceId: 'ORD-77',
    },
  ],
  total: 650,
  currentQuantity: 612,
};

interface DetailApis {
  inventoryApi: jasmine.SpyObj<InventoryApiService>;
  catalogueApi: jasmine.SpyObj<CatalogueApiService>;
  materialsApi: jasmine.SpyObj<MaterialsApiService>;
  approvalsApi: jasmine.SpyObj<ApprovalsApiService>;
  toasts: jasmine.SpyObj<ToastService>;
}

function makeApis(movements = MOVEMENTS): DetailApis {
  const inventoryApi = jasmine.createSpyObj('InventoryApiService', [
    'movements',
    'digest',
    'recordMovement',
  ]);
  inventoryApi.movements.and.returnValue(Promise.resolve(movements as never));
  inventoryApi.recordMovement.and.returnValue(
    Promise.resolve({
      id: 'mv-new',
      movementType: 'adjustment',
      quantityDelta: 10,
      timestamp: '2026-03-03T08:00:00Z',
      referenceId: null,
    } as never),
  );
  const catalogueApi = jasmine.createSpyObj('CatalogueApiService', ['list']);
  catalogueApi.list.and.returnValue(
    Promise.resolve({ data: [PRODUCT_VARIANT], total: 1 } as never),
  );
  const materialsApi = jasmine.createSpyObj('MaterialsApiService', ['list', 'valuation']);
  materialsApi.valuation.and.returnValue(Promise.resolve([] as never));
  const approvalsApi = jasmine.createSpyObj('ApprovalsApiService', ['create']);
  approvalsApi.create.and.returnValue(
    Promise.resolve({
      id: 'apr-1',
      actionType: 'stock_disposal',
      payload: null,
      requestedBy: null,
      status: 'pending',
      approvedBy: null,
      justification: null,
      decidedAt: null,
      createdAt: '2026-03-03T00:00:00Z',
    } as never),
  );
  const toasts = jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
  return { inventoryApi, catalogueApi, materialsApi, approvalsApi, toasts };
}

function createComponent(apis: DetailApis, itemType: string, itemId: string) {
  TestBed.configureTestingModule({
    imports: [WarehouseStockDetail],
    providers: [
      { provide: InventoryApiService, useValue: apis.inventoryApi },
      { provide: CatalogueApiService, useValue: apis.catalogueApi },
      { provide: MaterialsApiService, useValue: apis.materialsApi },
      { provide: ApprovalsApiService, useValue: apis.approvalsApi },
      { provide: ToastService, useValue: apis.toasts },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ itemType, itemId })),
        },
      },
      {
        provide: Router,
        useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') },
      },
    ],
  });
  return TestBed.createComponent(WarehouseStockDetail);
}

describe('warehouses inventory detail', () => {
  it('maps the movement ledger verbatim and derives activity entries', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis, 'variant', 'v-crb15-15');
    const component = fixture.componentInstance as never as {
      load(t: 'variant', id: string): Promise<void>;
      entries(): Array<{ text: string; tone: string }>;
      currentQuantity(): number;
      total(): number;
      itemFacts(): { label: string; typeLabel: string };
    };

    await component.load('variant', 'v-crb15-15');
    await fixture.whenStable();

    const entries = component.entries();
    expect(entries).toHaveSize(2);
    expect(entries[0]['text']).toBe('Production: +700 units (REQ-PO-9)');
    expect(entries[1]['text']).toBe('Sale: -88 units (ORD-77)');
    expect(entries[1]['tone']).toBe('warn');
    expect(component.currentQuantity()).toBe(612);
    expect(component.itemFacts()).toEqual(
      jasmine.objectContaining({ label: 'CRB15-M-NAVY', typeLabel: 'Finished goods' }),
    );
  });

  it('fetches an item digest on stock check', async () => {
    const apis = makeApis();
    (apis.inventoryApi.digest as jasmine.Spy).and.returnValue(
      Promise.resolve({
        itemType: 'variant',
        itemId: 'v-crb15-15',
        currentQuantity: 612,
        entryCount: 9,
        firstTimestamp: '2025-06-01T00:00:00Z',
        lastTimestamp: '2026-03-02T10:30:00Z',
        ledgerHead: '0123456789abcdef0123456789abcdef',
      } as never),
    );
    const fixture = createComponent(apis, 'variant', 'v-crb15-15');
    const component = fixture.componentInstance as never as {
      load(t: 'variant', id: string): Promise<void>;
      runStockCheck(): Promise<void>;
      digest(): Record<string, unknown> | null;
    };

    await component.load('variant', 'v-crb15-15');
    expect(component.digest()).toBeNull();
    await component.runStockCheck();
    expect(apis.inventoryApi.digest).toHaveBeenCalledWith('variant', 'v-crb15-15');
    expect(component.digest()).toEqual(jasmine.objectContaining({ entryCount: 9 }));
  });

  it('records a positive movement directly with the ledger contract shape', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis, 'variant', 'v-crb15-15');
    const component = fixture.componentInstance as never as {
      load(t: 'variant', id: string): Promise<void>;
      form: { direction: string; quantity: number; reference: string };
      formError(): string | null;
      submitMovement(): Promise<void>;
      movementCalls(): unknown[][];
    };

    await component.load('variant', 'v-crb15-15');
    component.form.direction = 'in';
    component.form.quantity = 10;
    component.form.reference = 'cycle count fix';
    await component.submitMovement();

    expect(apis.approvalsApi.create).not.toHaveBeenCalled();
    const recordCalls = (apis.inventoryApi.recordMovement as jasmine.Spy).calls.allArgs();
    expect(recordCalls[0][0]).toBe('variant');
    expect(recordCalls[0][1]).toBe('v-crb15-15');
    expect(recordCalls[0][2]).toEqual(
      jasmine.objectContaining({ movementType: 'adjustment', quantityDelta: 10, referenceId: 'cycle count fix' }),
    );
    expect(component.formError()).toBeNull();
    expect((apis.inventoryApi.movements as jasmine.Spy).calls.count()).toBeGreaterThan(1);
  });

  it('sends negative movements through the stock_disposal approval flow', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis, 'variant', 'v-crb15-15');
    const component = fixture.componentInstance as never as {
      load(t: 'variant', id: string): Promise<void>;
      form: { direction: string; quantity: number; reference: string };
      submitLabel(): string;
      approvalRequested(): boolean;
      submitMovement(): Promise<void>;
    };

    await component.load('variant', 'v-crb15-15');
    component.form.direction = 'out';
    component.form.quantity = 3;
    expect(component.submitLabel()).toBe('Request approval');

    await component.submitMovement();
    expect(apis.approvalsApi.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        actionType: 'stock_disposal',
        payload: jasmine.objectContaining({ item: 'v-crb15-15', delta: -3 }),
      }),
    );
    expect(apis.inventoryApi.recordMovement).not.toHaveBeenCalled();
    expect(component.approvalRequested()).toBe(true);

    await component.submitMovement();
    const recordCalls = (apis.inventoryApi.recordMovement as jasmine.Spy).calls.allArgs();
    expect(recordCalls[0][2]).toEqual(
      jasmine.objectContaining({ movementType: 'adjustment', quantityDelta: -3, approvalRequestId: 'apr-1' }),
    );
  });

  it('rejects zero and non-integer quantities before any request', async () => {
    const apis = makeApis();
    const fixture = createComponent(apis, 'variant', 'v-crb15-15');
    const component = fixture.componentInstance as never as {
      load(t: 'variant', id: string): Promise<void>;
      form: { direction: string; quantity: number };
      formError(): string | null;
      submitMovement(): Promise<void>;
    };

    await component.load('variant', 'v-crb15-15');
    component.form.direction = 'in';
    component.form.quantity = 0;
    await component.submitMovement();
    expect(component.formError()).toContain('whole number other than zero');
    expect(apis.inventoryApi.recordMovement).not.toHaveBeenCalled();
  });
});
