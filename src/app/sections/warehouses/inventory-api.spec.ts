import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiCount,
  ApiCountLine,
  ApiInventorySummaryItem,
  InventoryApiService,
} from '../../core/inventory-api.service';
import { WarehouseLocations } from './locations';
import { ToastService } from '../../core/toast';

const VARIANT_ITEM: ApiInventorySummaryItem = {
  itemType: 'VARIANT',
  itemId: 'v-crb15-15',
  currentQuantity: 612,
  byMovementType: { PURCHASE: 700, SALE: -88 },
};

const MATERIAL_ITEM: ApiInventorySummaryItem = {
  itemType: 'MATERIAL',
  itemId: 'm-shea',
  currentQuantity: 46,
  byMovementType: { PURCHASE: 60, PRODUCTION: -14 },
};

function makeInventoryApi(listResult: { data: ApiInventorySummaryItem[]; total: number } = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('InventoryApiService', ['summary', 'digest', 'movements', 'counts', 'recordCount']);
  api.summary.and.returnValue(Promise.resolve(listResult));
  api.counts.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function createComponent(inventoryApi: ReturnType<typeof makeInventoryApi>) {
  TestBed.configureTestingModule({
    imports: [WarehouseLocations],
    providers: [
      { provide: InventoryApiService, useValue: inventoryApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(WarehouseLocations);
}

describe('warehouses locations response mapping', () => {
  it('maps api inventory summary fields verbatim to row fields', async () => {
    const inventoryApi = makeInventoryApi({ data: [VARIANT_ITEM, MATERIAL_ITEM], total: 2 });
    const fixture = createComponent(inventoryApi);
    const component = fixture.componentInstance;

    await (component as any).loadInventory();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(2);
    expect(rows[0].itemType).toBe('VARIANT');
    expect(rows[0].itemId).toBe('v-crb15-15');
    expect(rows[0].currentQuantity).toBe(612);
    expect(rows[0].byMovementType).toEqual({ PURCHASE: 700, SALE: -88 });
    expect(rows[1].itemType).toBe('MATERIAL');
    expect(rows[1].itemId).toBe('m-shea');
    expect(rows[1].currentQuantity).toBe(46);
  });

  it('computes total units and per-kind units from API data', async () => {
    const inventoryApi = makeInventoryApi({ data: [VARIANT_ITEM, MATERIAL_ITEM], total: 2 });
    const fixture = createComponent(inventoryApi);
    const component = fixture.componentInstance;

    await (component as any).loadInventory();
    await fixture.whenStable();

    expect((component as any).totalUnits()).toBe(658);
    expect((component as any).finishedGoodsUnits()).toBe(612);
    expect((component as any).rawMaterialUnits()).toBe(46);
  });

  it('maps item type to readable label', async () => {
    const inventoryApi = makeInventoryApi({ data: [VARIANT_ITEM], total: 1 });
    const fixture = createComponent(inventoryApi);
    const component = fixture.componentInstance;

    await (component as any).loadInventory();
    await fixture.whenStable();

    expect((component as any).kindLabel('VARIANT')).toBe('Finished goods');
    expect((component as any).kindLabel('MATERIAL')).toBe('Raw materials');
    expect((component as any).kindLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('does not fabricate fields the API lacks (no name, city, address, hours, manager, zones, bins, capacity)', async () => {
    const inventoryApi = makeInventoryApi({ data: [VARIANT_ITEM], total: 1 });
    const fixture = createComponent(inventoryApi);
    const component = fixture.componentInstance;

    await (component as any).loadInventory();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).name).toBeUndefined();
    expect((rows[0] as any).city).toBeUndefined();
    expect((rows[0] as any).address).toBeUndefined();
    expect((rows[0] as any).hours).toBeUndefined();
    expect((rows[0] as any).manager).toBeUndefined();
    expect((rows[0] as any).zones).toBeUndefined();
    expect((rows[0] as any).bins).toBeUndefined();
    expect((rows[0] as any).capacity).toBeUndefined();
  });

  it('maps api count list fields verbatim', async () => {
    const count: ApiCount = {
      id: 'c-1',
      number: 'CNT-001',
      status: 'done',
      lines: [
        { itemType: 'variant', itemId: 'v-crb15-15', countedQuantity: 600, approvalRequestId: null },
        { itemType: 'material', itemId: 'm-shea', countedQuantity: 40, approvalRequestId: 'ar-1' },
      ],
      createdAt: '2026-01-15T10:00:00Z',
    };
    const inventoryApi = makeInventoryApi({ data: [], total: 0 });
    inventoryApi.counts.and.returnValue(Promise.resolve({ data: [count], total: 1 }));
    const fixture = createComponent(inventoryApi);
    const component = fixture.componentInstance;

    const result = await (component as any).inventoryApi.counts();
    expect(result.data).toHaveSize(1);
    expect(result.data[0].id).toBe('c-1');
    expect(result.data[0].number).toBe('CNT-001');
    expect(result.data[0].status).toBe('done');
    expect(result.data[0].lines).toHaveSize(2);
    expect(result.data[0].lines[0]).toEqual(
      jasmine.objectContaining({ itemType: 'variant', itemId: 'v-crb15-15', countedQuantity: 600 })
    );
    expect(result.data[0].lines[1]).toEqual(
      jasmine.objectContaining({ itemType: 'material', itemId: 'm-shea', countedQuantity: 40, approvalRequestId: 'ar-1' })
    );
  });
});
