import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';
import { normalizeList } from './api-shape';

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

export interface ApiPartner {
  id: string;
  userId?: string;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
  userName?: string | null;
  userEmail?: string | null;
  equityPercentage: number;
  investedAmount: number;
  createdAt: string;
}

/** The API nests the linked user; the UI expects flat name/email fields. */
function mapPartner(row: ApiPartner): Partner {
  return {
    id: row.id,
    userId: row.userId ?? row.user?.id ?? '',
    userName: row.userName ?? row.user?.name ?? null,
    userEmail: row.userEmail ?? row.user?.email ?? null,
    equityPercentage: row.equityPercentage,
    investedAmount: row.investedAmount,
    createdAt: row.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class PartnersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPartners(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<PartnerList> {
    const params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<PartnerList | Partner[]>(apiUrl(this.baseUrl, 'partners'), { params }),
    ).then((result) => {
      const list = normalizeList<ApiPartner>(result);
      return { ...list, data: list.data.map(mapPartner) };
    });
  }

  getPartner(id: string): Promise<Partner> {
    return firstValueFrom(
      this.http.get<ApiPartner>(apiUrl(this.baseUrl, `partners/${encodeURIComponent(id)}`)),
    ).then(mapPartner);
  }

  createPartner(input: CreatePartnerInput): Promise<Partner> {
    return firstValueFrom(
      this.http.post<Partner>(apiUrl(this.baseUrl, 'partners'), input),
    );
  }

  listDistributions(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<ProfitDistributionList> {
    const params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ProfitDistributionList | ProfitDistribution[]>(
        apiUrl(this.baseUrl, 'profit-distributions'),
        { params },
      ),
    ).then((result) => normalizeList<ProfitDistribution>(result));
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
        partner: ApiPartner;
        distributions: ProfitDistribution[];
        totalInvested: number;
        totalDistributed: number;
      }>(apiUrl(this.baseUrl, `partners/${encodeURIComponent(id)}/dashboard`)),
    ).then((result) => ({ ...result, partner: mapPartner(result.partner) }));
  }
}
