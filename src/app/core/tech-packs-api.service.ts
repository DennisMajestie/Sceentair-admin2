import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiTechPackVariant {
  id: string;
  sku?: string | null;
  size?: string | null;
  colour?: string | null;
  product?: { id: string; name?: string | null; category?: string | null } | null;
}

export interface ApiTechPack {
  id: string;
  variant: ApiTechPackVariant;
  silhouette: string | null;
  targetYieldUnits: number | null;
  cuttingEfficiencyPct: number | null;
  gradedMeasurements: Record<string, Record<string, string | number>> | null;
  stitchProtocol: string | null;
  laydownProtocol: string | null;
  dxfUrl: string | null;
  revision: number;
  status: 'draft' | 'approved';
  approvedBy: string | null;
  approvedAt: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  revisionCount?: number;
}

export interface ApiTechPackRevision {
  id: string;
  revision: number;
  status?: string;
  createdAt: string;
}

export interface UpsertTechPackInput {
  silhouette?: string | null;
  targetYieldUnits?: number | null;
  cuttingEfficiencyPct?: number | null;
  gradedMeasurements?: Record<string, Record<string, string | number>> | null;
  stitchProtocol?: string | null;
  laydownProtocol?: string | null;
  dxfUrl?: string | null;
}

export interface CreateTechPackInput extends UpsertTechPackInput {
  variantId: string;
}

@Injectable({ providedIn: 'root' })
export class TechPacksApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Promise<ApiTechPack[]> {
    return firstValueFrom(
      this.http.get<ApiTechPack[]>(apiUrl(this.baseUrl, 'tech-packs')),
    );
  }

  detail(id: string): Promise<ApiTechPack> {
    return firstValueFrom(
      this.http.get<ApiTechPack>(apiUrl(this.baseUrl, `tech-packs/${encodeURIComponent(id)}`)),
    );
  }

  create(input: CreateTechPackInput): Promise<ApiTechPack> {
    return firstValueFrom(this.http.post<ApiTechPack>(apiUrl(this.baseUrl, 'tech-packs'), input));
  }

  update(id: string, input: UpsertTechPackInput): Promise<ApiTechPack> {
    return firstValueFrom(
      this.http.put<ApiTechPack>(apiUrl(this.baseUrl, `tech-packs/${encodeURIComponent(id)}`), input),
    );
  }

  approve(id: string): Promise<ApiTechPack> {
    return firstValueFrom(
      this.http.post<ApiTechPack>(apiUrl(this.baseUrl, `tech-packs/${encodeURIComponent(id)}/approve`), {}),
    );
  }

  revisions(id: string): Promise<ApiTechPackRevision[]> {
    return firstValueFrom(
      this.http.get<ApiTechPackRevision[]>(
        apiUrl(this.baseUrl, `tech-packs/${encodeURIComponent(id)}/revisions`),
      ),
    );
  }
}
