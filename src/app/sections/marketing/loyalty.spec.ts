import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { LoyaltyApiService } from '../../core/loyalty-api.service';
import { ToastService } from '../../core/toast';
import { MarketingLoyalty } from './loyalty';

const ACCOUNTS = [
  { customerId: 'u-1', points: 45, lifetimePoints: 120 },
  { customerId: 'u-2', points: 10, lifetimePoints: 30 },
];

describe('MarketingLoyalty', () => {
  let fixture: ComponentFixture<MarketingLoyalty>;
  let api: jasmine.SpyObj<LoyaltyApiService>;
  let canWrite: boolean;

  async function setUp(): Promise<void> {
    canWrite = true;
    api = jasmine.createSpyObj<LoyaltyApiService>('LoyaltyApiService', ['accounts', 'adjust']);
    api.accounts.and.resolveTo(ACCOUNTS);
    api.adjust.and.resolveTo(ACCOUNTS[0]);
    await TestBed.configureTestingModule({
      imports: [MarketingLoyalty],
      providers: [
        { provide: LoyaltyApiService, useValue: api },
        { provide: ToastService, useValue: { show: () => undefined } },
        {
          provide: AuthService,
          useValue: { user: () => ({ access: { marketing: canWrite ? 'full' : 'view' } }) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarketingLoyalty);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows balances and total points outstanding', async () => {
    await setUp();
    expect(text()).toContain('u-1');
    expect(text()).toContain('55');
    expect(text()).toContain('Balances');
  });

  it('submits an approved adjustment', async () => {
    await setUp();
    const page = fixture.componentInstance as unknown as {
      form: { customerId: string; points: number; note: string; approvalRequestId: string };
      adjust: () => Promise<void>;
    };
    page.form = { customerId: 'u-1', points: -5, note: 'Goodwill', approvalRequestId: 'appr-1' };
    await page.adjust();
    expect(api.adjust).toHaveBeenCalledWith({
      customerId: 'u-1', points: -5, note: 'Goodwill', approvalRequestId: 'appr-1',
    });
  });
});
