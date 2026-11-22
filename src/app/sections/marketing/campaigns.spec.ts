import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { MarketingApiService } from '../../core/marketing-api.service';
import { ToastService } from '../../core/toast';
import { MarketingCampaigns } from './campaigns';

const CAMPAIGN = {
  id: 'c-1',
  name: 'September drop',
  type: 'campaign' as const,
  channel: 'instagram',
  discountPercent: 10,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  createdAt: '2026-09-01T00:00:00Z',
};

describe('MarketingCampaigns ROI', () => {
  let fixture: ComponentFixture<MarketingCampaigns>;
  let api: jasmine.SpyObj<MarketingApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<MarketingApiService>('MarketingApiService', ['list', 'roi']);
    api.list.and.resolveTo({ data: [CAMPAIGN], total: 1 });
    api.roi.and.resolveTo({
      campaigns: [{ id: 'c-1', name: 'September drop', orders: 12, revenue: 50000, roi: 150 }],
      attributedRevenue: 50000,
      unattributedRevenue: 12000,
      spend: 20000,
      roi: 150,
    });

    await TestBed.configureTestingModule({
      imports: [MarketingCampaigns],
      providers: [
        { provide: MarketingApiService, useValue: api },
        { provide: ToastService, useValue: { show: () => undefined } },
        { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => null } as unknown as ParamMap),
            snapshot: { paramMap: { get: () => null } as unknown as ParamMap },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketingCampaigns);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows campaign spend, attributed revenue and ROI', () => {
    expect(api.roi).toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Return on spend');
    expect(text).toContain('Attributed revenue');
    expect(text).toContain('150.0%');
    expect(text).toContain('September drop');
  });
});
