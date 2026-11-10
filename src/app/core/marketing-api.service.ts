import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';
import { normalizeList } from './api-shape';

export type CampaignType = 'campaign' | 'promotion' | 'loyalty' | 'visibility_boost';

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  channel: string | null;
  discountPercent: number | null;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface CampaignList {
  data: Campaign[];
  total: number;
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  channel: string | null;
  discountPercent: number | null;
  startDate: string;
  endDate: string;
}

@Injectable({ providedIn: 'root' })
export class MarketingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<CampaignList> {
    const params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<CampaignList | Campaign[]>(apiUrl(this.baseUrl, 'campaigns'), { params }),
    ).then((result) => normalizeList<Campaign>(result));
  }

  create(input: CreateCampaignInput): Promise<Campaign> {
    return firstValueFrom(
      this.http.post<Campaign>(apiUrl(this.baseUrl, 'campaigns'), input),
    );
  }
}
