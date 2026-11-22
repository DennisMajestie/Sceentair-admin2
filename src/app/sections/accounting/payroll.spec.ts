import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountingApiService, type ApiPayrollRun } from '../../core/accounting-api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast';
import { AccountingPayroll } from './payroll';

const RUN: ApiPayrollRun = {
  id: 'pr-1',
  periodMonth: '2026-10',
  lines: [
    { name: 'Ada Obi', amount: 25000 },
    { name: 'Tunde Bakare', amount: 30000 },
  ],
  totalAmount: 55000,
  status: 'posted',
  approvalRequestId: 'appr-1',
  ledgerEntryId: 'le-1',
  postedAt: '2026-10-31T00:00:00Z',
};

describe('AccountingPayroll', () => {
  let fixture: ComponentFixture<AccountingPayroll>;
  let api: jasmine.SpyObj<AccountingApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AccountingApiService>('AccountingApiService', [
      'payrollRuns',
      'createPayrollRun',
    ]);
    api.payrollRuns.and.resolveTo({ data: [RUN], total: 1 });
    api.createPayrollRun.and.resolveTo(RUN);

    await TestBed.configureTestingModule({
      imports: [AccountingPayroll],
      providers: [
        { provide: AccountingApiService, useValue: api },
        { provide: ToastService, useValue: { show: () => undefined } },
        { provide: AuthService, useValue: { user: () => ({ access: { accounting: 'full' } }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountingPayroll);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('lists payroll runs with staff, total and posted state', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2026-10');
    expect(text).toContain('Ada Obi, Tunde Bakare');
    expect(text).toContain('Posted');
  });

  it('posts an approved run with its staff lines', async () => {
    const page = fixture.componentInstance as unknown as {
      form: { periodMonth: string; approvalRequestId: string; lines: Array<{ name: string; amount: number | null; note: string }> };
      postRun: () => Promise<void>;
    };
    page.form = {
      periodMonth: '2026-11',
      approvalRequestId: 'appr-2',
      lines: [{ name: 'Ada Obi', amount: 25000, note: '' }],
    };

    await page.postRun();

    expect(api.createPayrollRun).toHaveBeenCalledWith({
      periodMonth: '2026-11',
      approvalRequestId: 'appr-2',
      lines: [{ name: 'Ada Obi', amount: 25000, note: undefined }],
    });
  });
});
