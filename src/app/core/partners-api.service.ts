import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface Partner {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  equityPercentage: number;
  investedAmount: number;
  createdAt: string;
}

export interface PartnerList {
  data: Partner[];
  total: number;
}

export interface CreatePartnerInput {
  userId: string;
  equityPercentage: number;
  investedAmount: number;
}

export interface ProfitDistribution {
  id: string;
  period: string;
  totalProfit: number;
  reinvestmentAmount: number;
  dividendPool: number;
  reserveAmount: number;
  perPartnerBreakdown: Record<string, number>;
  createdBy: string | null;
  createdAt: string;
}

export interface ProfitDistributionList {
  data: ProfitDistribution[];
  total: number;
}

export interface CreateDistributionInput {
  period: string;
  totalProfit: number;
  reinvestmentAmount: number;
  dividendPool: number;
  reserveAmount: number;
  perPartnerBreakdown: Record<string, number>;
  createdBy: string | null;
}

@Injectable({ providedIn: 'root' })
export class PartnersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPartners(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<PartnerList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<PartnerList>(apiUrl(this.baseUrl, 'partners'), { params }),
    );
  }

  getPartner(id: string): Promise<Partner> {
    return firstValueFrom(
      this.http.get<Partner>(apiUrl(this.baseUrl, `partners/${encodeURIComponent(id)}`)),
    );
  }

  createPartner(input: CreatePartnerInput): Promise<Partner> {
    return firstValueFrom(
      this.http.post<Partner>(apiUrl(this.baseUrl, 'partners'), input),
    );
  }

  listDistributions(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<ProfitDistributionList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ProfitDistributionList>(apiUrl(this.baseUrl, 'profit-distributions'), { params }),
    );
  }

  createDistribution(input: CreateDistributionInput): Promise<ProfitDistribution> {
    return firstValueFrom(
      this.http.post<ProfitDistribution>(apiUrl(this.baseUrl, 'profit-distributions'), input),
    );
  }

  getPartnerDashboard(id: string): Promise<{
    partner: Partner;
    distributions: ProfitDistribution[];
    totalInvested: number;
    totalDistributed: number;
  }> {
    return firstValueFrom(
      this.http.get<{
        partner: Partner;
        distributions: ProfitDistribution[];
        totalInvested: number;
        totalDistributed: number;
      }>(apiUrl(this.baseUrl, `partners/${encodeURIComponent(id)}/dashboard`)),
    );
  }
}
