import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface LoyaltyAccount {
  customerId: string;
  points: number;
  lifetimePoints: number;
}

export interface AdjustLoyaltyInput {
  customerId: string;
  points: number;
  note: string;
  approvalRequestId: string;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  accounts(): Promise<LoyaltyAccount[]> {
    return firstValueFrom(
      this.http.get<LoyaltyAccount[]>(apiUrl(this.baseUrl, 'loyalty/accounts')),
    );
  }

  adjust(input: AdjustLoyaltyInput): Promise<LoyaltyAccount> {
    return firstValueFrom(
      this.http.post<LoyaltyAccount>(apiUrl(this.baseUrl, 'loyalty/adjust'), input),
    );
  }
}
