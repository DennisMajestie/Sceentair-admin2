import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiWipSummary, ProductionApiService } from '../../core/production-api.service';
import { ProductionWip } from './wip';

const summary: ApiWipSummary = {
  stages: [
    { stage: 'Cutting', batches: 2, units: 60 },
    { stage: 'Sewing', batches: 1, units: 40 },
  ],
  totalUnits: 100,
  activeBatches: 3,
  materials: [{ materialId: 'm1', materialName: 'Cotton jersey', unit: 'metres', quantity: 12 }],
};

const empty: ApiWipSummary = { stages: [], totalUnits: 0, activeBatches: 0, materials: [] };

function makeApi(): jasmine.SpyObj<ProductionApiService> {
  const api = jasmine.createSpyObj<ProductionApiService>('ProductionApiService', ['wip']);
  api.wip.and.resolveTo(summary);
  return api;
}

describe('ProductionWip', () => {
  let fixture: ComponentFixture<ProductionWip>;
  let api: jasmine.SpyObj<ProductionApiService>;

  async function setUp(apiUnderTest: jasmine.SpyObj<ProductionApiService> = makeApi()): Promise<void> {
    api = apiUnderTest;
    await TestBed.configureTestingModule({
      imports: [ProductionWip],
      providers: [provideRouter([]), { provide: ProductionApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductionWip);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads the WIP snapshot and shows metrics, stage shares and material rows', async () => {
    await setUp();
    expect(api.wip).toHaveBeenCalled();
    expect(text()).toContain('Units in production');
    expect(text()).toContain('100');
    expect(text()).toContain('Cutting');
    expect(text()).toContain('60%');
    expect(text()).toContain('Cotton jersey');
    expect(text()).toContain('12');
  });

  it('shows an error with a working retry when the snapshot fails', async () => {
    const failing = makeApi();
    failing.wip.and.rejectWith(
      new HttpErrorResponse({ status: 500, error: { message: 'Backend offline' } }),
    );
    await setUp(failing);

    expect(text()).toContain("Couldn't load work in progress.");
    expect(text()).toContain('Backend offline');

    api.wip.and.resolveTo(summary);
    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Retry',
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.wip).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Cutting');
  });

  it('shows an empty state when there is nothing on the factory floor', async () => {
    const blank = makeApi();
    blank.wip.and.resolveTo(empty);
    await setUp(blank);

    expect(text()).toContain('Nothing on the factory floor.');
  });
});
