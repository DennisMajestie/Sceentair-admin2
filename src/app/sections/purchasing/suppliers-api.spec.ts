import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiSupplier,
  SuppliersApiService,
} from '../../core/suppliers-api.service';
import { PurchasingSuppliers } from './suppliers';
import { ToastService } from '../../core/toast';

const SUPPLIER: ApiSupplier = {
  id: 's-tidewater',
  name: 'Tidewater Botanicals',
  category: 'oils',
  location: 'Wilmington, NC',
  certified: true,
  slaScore: 96,
  quotaUnits: 1000,
  complianceNotes: 'Organic certified; quarterly COA on file.',
  createdAt: '2026-01-15T10:00:00Z',
};

const UNCERTIFIED: ApiSupplier = {
  ...SUPPLIER,
  id: 's-pacific',
  name: 'Pacific Glassworks',
  category: 'glass',
  location: 'Tacoma, WA',
  certified: false,
  slaScore: 84,
  quotaUnits: null,
  complianceNotes: null,
};

function makeSuppliersApi(listResult: { data: ApiSupplier[]; total: number } = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('SuppliersApiService', ['list', 'detail']);
  api.list.and.returnValue(Promise.resolve(listResult));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function createComponent(suppliersApi: ReturnType<typeof makeSuppliersApi>) {
  TestBed.configureTestingModule({
    imports: [PurchasingSuppliers],
    providers: [
      { provide: SuppliersApiService, useValue: suppliersApi },
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
  return TestBed.createComponent(PurchasingSuppliers);
}

describe('purchasing suppliers response mapping', () => {
  it('maps api supplier fields verbatim to row fields', async () => {
    const suppliersApi = makeSuppliersApi({ data: [SUPPLIER], total: 1 });
    const fixture = createComponent(suppliersApi);
    const component = fixture.componentInstance;

    await (component as any).loadSuppliers();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('s-tidewater');
    expect(rows[0].name).toBe('Tidewater Botanicals');
    expect(rows[0].category).toBe('oils');
    expect(rows[0].location).toBe('Wilmington, NC');
    expect(rows[0].certified).toBeTrue();
    expect(rows[0].slaScore).toBe(96);
    expect(rows[0].quotaUnits).toBe(1000);
    expect(rows[0].complianceNotes).toBe('Organic certified; quarterly COA on file.');
    expect(rows[0].createdAt).toBe('2026-01-15T10:00:00Z');
  });

  it('maps certified flag and computes preferred count', async () => {
    const suppliersApi = makeSuppliersApi({ data: [SUPPLIER, UNCERTIFIED], total: 2 });
    const fixture = createComponent(suppliersApi);
    const component = fixture.componentInstance;

    await (component as any).loadSuppliers();
    await fixture.whenStable();

    expect((component as any).preferredCount()).toBe(1);
  });

  it('computes average SLA score from API data', async () => {
    const suppliersApi = makeSuppliersApi({ data: [SUPPLIER, UNCERTIFIED], total: 2 });
    const fixture = createComponent(suppliersApi);
    const component = fixture.componentInstance;

    await (component as any).loadSuppliers();
    await fixture.whenStable();

    expect((component as any).avgOnTime()).toBe(90);
    expect((component as any).avgSla()).toBe(90);
  });

  it('filters suppliers by certified flag from the API', async () => {
    const suppliersApi = makeSuppliersApi({ data: [SUPPLIER, UNCERTIFIED], total: 2 });
    const fixture = createComponent(suppliersApi);
    const component = fixture.componentInstance;

    await (component as any).loadSuppliers();
    await fixture.whenStable();

    (component as any).filter.set('certified');
    const visible = (component as any).visible();
    expect(visible).toHaveSize(1);
    expect(visible[0].id).toBe('s-tidewater');
  });

  it('does not fabricate fields the API lacks (no contact, email, phone, leadDays, rating, supplies, tone, since)', async () => {
    const suppliersApi = makeSuppliersApi({ data: [SUPPLIER], total: 1 });
    const fixture = createComponent(suppliersApi);
    const component = fixture.componentInstance;

    await (component as any).loadSuppliers();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).contact).toBeUndefined();
    expect((rows[0] as any).email).toBeUndefined();
    expect((rows[0] as any).phone).toBeUndefined();
    expect((rows[0] as any).leadDays).toBeUndefined();
    expect((rows[0] as any).rating).toBeUndefined();
    expect((rows[0] as any).supplies).toBeUndefined();
    expect((rows[0] as any).tone).toMatch(/^(pine|ocean|ochre|sage|rose|slate)$/);
    expect((rows[0] as any).since).toBeUndefined();
  });
});
