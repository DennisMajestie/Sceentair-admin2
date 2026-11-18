import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApprovalsApiService } from '../../core/approvals-api.service';
import { MaterialsApiService } from '../../core/materials-api.service';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast';
import { PurchasingOrders } from './orders';

describe('PurchasingOrders purchase feed failures', () => {
  let fixture: ComponentFixture<PurchasingOrders>;

  beforeEach(async () => {
    const store = {
      pos: signal([]),
      materials: signal([]),
      suppliers: signal([]),
      purchasesError: signal('Gateway timeout'),
      load: () => Promise.resolve(),
      material: () => undefined,
    };
    TestBed.configureTestingModule({
      imports: [PurchasingOrders],
      providers: [
        provideRouter([]),
        { provide: Store, useValue: store },
        { provide: MaterialsApiService, useValue: {} },
        { provide: ApprovalsApiService, useValue: {} },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(PurchasingOrders);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('shows an explicit error instead of claiming zero records', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Purchase records could not be loaded');
    expect(text).toContain('Gateway timeout');
    expect(text).toContain('totals below are incomplete, not zero');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
