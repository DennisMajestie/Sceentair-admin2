import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiBusinessProfile {
  id: number;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  currency: string;
  timezone: string;
  fiscalStart: string;
  factoryName: string | null;
  factoryCity: string | null;
  factoryAddress: string | null;
  factoryCapacity: number | null;
  factoryHours: string | null;
  expiryWarnDays: number;
  lowStockMode: string;
  defaultLocationId: string | null;
  weekStart: string;
  revenueGoal: number;
  updatedAt: string;
}

export type BusinessProfilePatch = Partial<
  Omit<ApiBusinessProfile, 'id' | 'updatedAt'>
>;

@Injectable({ providedIn: 'root' })
export class BusinessApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getProfile(): Promise<ApiBusinessProfile> {
    return firstValueFrom(
      this.http.get<ApiBusinessProfile>(apiUrl(this.baseUrl, 'business/profile')),
    );
  }

  updateProfile(patch: BusinessProfilePatch): Promise<ApiBusinessProfile> {
    return firstValueFrom(
      this.http.patch<ApiBusinessProfile>(apiUrl(this.baseUrl, 'business/profile'), patch),
    );
  }
}
