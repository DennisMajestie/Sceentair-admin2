import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalyticsApiService, type ProductProfitability } from '../../core/analytics-api.service';
import { AnalyticsProfitability } from './profitability';

const report: ProductProfitability = {
  withRecordedCost: true,
  products: [
    {
      productId: 'p-1',
      productName: 'Crab Tee',
      unitsSold: 12,
      revenue: 50400,
      costOfUnitsSold: 21000,
      margin: 29400,
      marginPct: 58.3,
      costBasis: 'recorded',
    },
  ],
};

describe('AnalyticsProfitability', () => {
  let fixture: ComponentFixture<AnalyticsProfitability>;
  let api: jasmine.SpyObj<AnalyticsApiService>;

  async function setUp(result: ProductProfitability | HttpErrorResponse = report): Promise<void> {
    api = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['productProfitability']);
    if (result instanceof HttpErrorResponse) api.productProfitability.and.rejectWith(result);
    else api.productProfitability.and.resolveTo(result);
    await TestBed.configureTestingModule({
      imports: [AnalyticsProfitability],
      providers: [{ provide: AnalyticsApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnalyticsProfitability);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows revenue, margin and the cost basis per product', async () => {
    await setUp();
    expect(api.productProfitability).toHaveBeenCalledWith(8);
    expect(text()).toContain('Crab Tee');
    expect(text()).toContain('Recorded');
    expect(text()).toContain('58.3%');
  });

  it('shows an empty state when nothing has sold', async () => {
    await setUp({ withRecordedCost: false, products: [] });
    expect(text()).toContain('No sold products in this view.');
  });

  it('warns when costs are estimated rather than recorded', async () => {
    await setUp({ withRecordedCost: false, products: report.products });
    expect(text()).toContain('estimated from the catalogue');
  });
});
