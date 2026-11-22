import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductionApiService, type ApiPlanning } from '../../core/production-api.service';
import { ProductionPlanning } from './planning';

const plan: ApiPlanning = {
  windowDays: 30,
  variants: [
    {
      variantId: 'v-1',
      sku: 'CRB15-M-NAVY',
      productName: 'Crab Tee',
      soldLastWindow: 18,
      openOrderUnits: 6,
      stockOnHand: 4,
      inProduction: 10,
      suggested: 10,
    },
  ],
};

describe('ProductionPlanning', () => {
  let fixture: ComponentFixture<ProductionPlanning>;
  let api: jasmine.SpyObj<ProductionApiService>;

  async function setUp(result: ApiPlanning | HttpErrorResponse = plan): Promise<void> {
    api = jasmine.createSpyObj<ProductionApiService>('ProductionApiService', ['planning']);
    if (result instanceof HttpErrorResponse) api.planning.and.rejectWith(result);
    else api.planning.and.resolveTo(result);
    await TestBed.configureTestingModule({
      imports: [ProductionPlanning],
      providers: [provideRouter([]), { provide: ProductionApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductionPlanning);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the planning window, suggestions and totals', async () => {
    await setUp();
    expect(api.planning).toHaveBeenCalled();
    expect(text()).toContain('30');
    expect(text()).toContain('CRB15-M-NAVY');
    expect(text()).toContain('Crab Tee');
    expect(text()).toContain('10');
  });

  it('shows an empty state when no variants need planning', async () => {
    await setUp({ windowDays: 30, variants: [] });
    expect(text()).toContain('No variants need planning.');
  });

  it('shows an error with retry when the planning call fails', async () => {
    await setUp(new HttpErrorResponse({ status: 500, error: { message: 'Planner offline' } }));
    expect(text()).toContain("Couldn't load planning suggestions.");
    expect(text()).toContain('Planner offline');

    api.planning.and.resolveTo(plan);
    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Retry',
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('CRB15-M-NAVY');
  });
});
