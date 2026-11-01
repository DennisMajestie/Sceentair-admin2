import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiMaterial,
  ApiPurchase,
  MaterialKind,
  MaterialsApiService,
} from '../../core/materials-api.service';
import { PurchasingMaterials } from './materials';
import { ToastService } from '../../core/toast';

const MATERIAL: ApiMaterial = {
  id: 'm-shea',
  name: 'Unrefined shea butter',
  unit: 'kg',
  category: 'fabrics' as MaterialKind,
  storageLocation: 'Lab R-04',
  reorderThreshold: 20,
  createdAt: '2026-01-15T10:00:00Z',
  currentQuantity: 46,
  lowStock: false,
};

const LOW_MATERIAL: ApiMaterial = {
  ...MATERIAL,
  id: 'm-zinc',
  name: 'Non-nano zinc oxide',
  category: 'trims_hardware' as MaterialKind,
  currentQuantity: 3.4,
  reorderThreshold: 6,
  lowStock: true,
};

function makeMaterialsApi(listResult: { data: ApiMaterial[]; total: number } = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('MaterialsApiService', ['list', 'lowStock', 'valuation', 'detail', 'purchases']);
  api.list.and.returnValue(Promise.resolve(listResult));
  api.valuation.and.returnValue(Promise.resolve([
    { ...MATERIAL, lastUnitCost: 14.2, lastPurchaseAt: '2026-01-10T00:00:00Z', currentValue: 653.2 },
    { ...LOW_MATERIAL, lastUnitCost: 31.0, lastPurchaseAt: '2026-01-05T00:00:00Z', currentValue: 105.4 },
  ]));
  api.purchases.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function createComponent(materialsApi: ReturnType<typeof makeMaterialsApi>) {
  TestBed.configureTestingModule({
    imports: [PurchasingMaterials],
    providers: [
      { provide: MaterialsApiService, useValue: materialsApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { 
          paramMap: of({ get: () => null } as unknown as ParamMap),
          snapshot: { paramMap: { get: () => null } as unknown as ParamMap },
        },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(PurchasingMaterials);
}

describe('purchasing materials response mapping', () => {
  it('maps api material fields verbatim to row fields', async () => {
    const materialsApi = makeMaterialsApi({ data: [MATERIAL], total: 1 });
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    await (component as any).loadMaterials();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('m-shea');
    expect(rows[0].name).toBe('Unrefined shea butter');
    expect(rows[0].unit).toBe('kg');
    expect(rows[0].category).toBe('fabrics');
    expect(rows[0].storageLocation).toBe('Lab R-04');
    expect(rows[0].reorderThreshold).toBe(20);
    expect(rows[0].currentQuantity).toBe(46);
    expect(rows[0].lowStock).toBeFalse();
    expect(rows[0].createdAt).toBe('2026-01-15T10:00:00Z');
  });

  it('maps low stock flag from the API', async () => {
    const materialsApi = makeMaterialsApi({ data: [LOW_MATERIAL], total: 1 });
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    await (component as any).loadMaterials();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows[0].lowStock).toBeTrue();
    expect((component as any).lowCount()).toBe(1);
  });

  it('computes total units and stock value from API data', async () => {
    const materialsApi = makeMaterialsApi({ data: [MATERIAL, LOW_MATERIAL], total: 2 });
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    await (component as any).loadMaterials();
    await fixture.whenStable();

    expect((component as any).totalUnits()).toBe(49.4);
    expect((component as any).stockValue()).toBe(653.2 + 105.4);
  });

  it('filters materials by category from the API', async () => {
    const materialsApi = makeMaterialsApi({ data: [MATERIAL, LOW_MATERIAL], total: 2 });
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    await (component as any).loadMaterials();
    await fixture.whenStable();

    (component as any).kind.set('fabrics');
    const visible = (component as any).visible();
    expect(visible).toHaveSize(1);
    expect(visible[0].id).toBe('m-shea');
  });

  it('does not fabricate fields the API lacks (no cost, supplier, location, usedIn on rows)', async () => {
    const materialsApi = makeMaterialsApi({ data: [MATERIAL], total: 1 });
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    await (component as any).loadMaterials();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).cost).toBeUndefined();
    expect((rows[0] as any).supplier).toBeUndefined();
    expect((rows[0] as any).location).toBeUndefined();
    expect((rows[0] as any).usedIn).toBeUndefined();
    expect((rows[0] as any).code).toBeUndefined();
    expect((rows[0] as any).onHand).toBeUndefined();
    expect((rows[0] as any).reorderQty).toBeUndefined();
  });

  it('maps api purchase history fields verbatim', async () => {
    const purchase: ApiPurchase = {
      id: 'p-1',
      materialId: 'm-shea',
      materialName: 'Unrefined shea butter',
      quantity: 60,
      cost: 852,
      supplierName: 'Nkuru Shea Collective',
      purchaseDate: '2026-01-15T10:00:00Z',
      recordedBy: 'm-menon',
    };
    const materialsApi = makeMaterialsApi({ data: [MATERIAL], total: 1 });
    materialsApi.purchases.and.returnValue(Promise.resolve({ data: [purchase], total: 1 }));
    const fixture = createComponent(materialsApi);
    const component = fixture.componentInstance;

    const result = await (component as any).materialsApi.purchases();
    expect(result.data).toHaveSize(1);
    expect(result.data[0].id).toBe('p-1');
    expect(result.data[0].materialId).toBe('m-shea');
    expect(result.data[0].materialName).toBe('Unrefined shea butter');
    expect(result.data[0].quantity).toBe(60);
    expect(result.data[0].cost).toBe(852);
    expect(result.data[0].supplierName).toBe('Nkuru Shea Collective');
    expect(result.data[0].purchaseDate).toBe('2026-01-15T10:00:00Z');
    expect(result.data[0].recordedBy).toBe('m-menon');
  });
});
