import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

/** A zone price row for shipping by weight. */
export interface ApiLogisticsPricing {
  id: string;
  zone: string;
  baseKg: number;
  basePrice: number;
  perKgPrice: number;
}

/** Checkout delivery/tax effective settings. */
export interface ApiShippingSettings {
  shippingEnabled: boolean;
  freeDeliveryThreshold: number | null;
  quoteExpiryMinutes: number;
  vatEnabled: boolean;
  vatRatePercent: number;
  pricesIncludeVat: boolean;
  deliveryTaxable: boolean;
  couponsEnabled: boolean;
}

/** Settings update; the API requires the reason for the audit trail. */
export interface ApiShippingSettingsUpdate {
  shippingEnabled?: boolean;
  freeDeliveryThreshold?: number | null;
  quoteExpiryMinutes?: number;
  vatEnabled?: boolean;
  vatRatePercent?: number;
  pricesIncludeVat?: boolean;
  deliveryTaxable?: boolean;
  couponsEnabled?: boolean;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class LogisticsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  pricing(): Promise<ApiLogisticsPricing[]> {
    return firstValueFrom(
      this.http.get<ApiLogisticsPricing[]>(apiUrl(this.baseUrl, 'logistics/pricing')),
    );
  }

  upsertPricing(body: Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl(this.baseUrl, 'logistics/pricing'), body),
    );
  }

  quote(weightKg: number, zone: string): Promise<{ cost: number }> {
    const params = new HttpParams()
      .set('weightKg', weightKg)
      .set('zone', zone);
    return firstValueFrom(
      this.http.get<{ cost: number }>(apiUrl(this.baseUrl, 'logistics/quote'), { params }),
    );
  }

  shippingSettings(): Promise<ApiShippingSettings> {
    return firstValueFrom(
      this.http.get<ApiShippingSettings>(
        apiUrl(this.baseUrl, 'checkout-shipping/admin/settings'),
      ),
    );
  }

  updateShippingSettings(body: ApiShippingSettingsUpdate): Promise<ApiShippingSettings> {
    return firstValueFrom(
      this.http.patch<ApiShippingSettings>(
        apiUrl(this.baseUrl, 'checkout-shipping/admin/settings'),
        body,
      ),
    );
  }
}
