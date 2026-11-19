import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeliveriesApiService } from '../../core/deliveries-api.service';
import { LogisticsApiService, type ApiShippingSettings } from '../../core/logistics-api.service';
import { ToastService } from '../../core/toast';
import { DeliveriesList } from './list';

const SETTINGS: ApiShippingSettings = {
  shippingEnabled: true,
  freeDeliveryThreshold: 100000,
  quoteExpiryMinutes: 30,
  vatEnabled: true,
  vatRatePercent: 7.5,
  pricesIncludeVat: false,
  deliveryTaxable: true,
  couponsEnabled: true,
  supportWhatsappUrl: null,
};

describe('DeliveriesList WhatsApp setting', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DeliveriesList>>;
  let update: jasmine.Spy;

  beforeEach(async () => {
    update = jasmine.createSpy('updateShippingSettings').and.resolveTo(SETTINGS);
    const logistics = jasmine.createSpyObj('LogisticsApiService', [
      'pricing',
      'shippingSettings',
      'updateShippingSettings',
    ]);
    logistics.pricing.and.resolveTo([]);
    logistics.shippingSettings.and.resolveTo(SETTINGS);
    logistics.updateShippingSettings.and.callFake(update);
    const deliveries = jasmine.createSpyObj('DeliveriesApiService', ['list']);
    deliveries.list.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [DeliveriesList],
      providers: [
        provideRouter([]),
        { provide: DeliveriesApiService, useValue: deliveries },
        { provide: LogisticsApiService, useValue: logistics },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DeliveriesList);
    fixture.detectChanges();
  });

  it('saves a trimmed WhatsApp link and sends null when it is cleared', async () => {
    const page = fixture.componentInstance as unknown as {
      settings: { set: (value: ApiShippingSettings | null) => void };
      settingsForm: { supportWhatsappUrl: string };
      reason: string;
      saveSettings: () => Promise<void>;
    };
    page.settings.set(SETTINGS);
    page.reason = 'Add support link';

    page.settingsForm.supportWhatsappUrl = '  https://wa.me/2348000000000  ';
    await page.saveSettings();
    expect(update).toHaveBeenCalledWith(
      jasmine.objectContaining({ supportWhatsappUrl: 'https://wa.me/2348000000000' }),
    );

    update.calls.reset();
    page.settings.set({ ...SETTINGS, supportWhatsappUrl: 'https://wa.me/2348000000000' });
    page.reason = 'Clear support link';
    page.settingsForm.supportWhatsappUrl = '   ';
    await page.saveSettings();
    expect(update).toHaveBeenCalledWith(
      jasmine.objectContaining({ supportWhatsappUrl: null }),
    );
  });
});
