import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiVariant {
  id: string;
  sku: string;
  size: string | null;
  colour: string | null;
  priceOverride: number | null;
  imageUrl: string | null;
  availabilityStatus: string;
  storageLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProductionBatch {
  id: string;
  variant: ApiVariant;
  quantity: number;
  stage: string;
  plannedDate: string | null;
  completedDate: string | null;
  approvalRequestId: string;
  barcode: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ApiProductionBatchList {
  data: ApiProductionBatch[];
  total: number;
  stages: string[];
}

export interface ApiProductionCost {
  id: string;
  materialCost: number;
  sewingCost: number;
  brandingCost: number;
  packagingCost: number;
  confirmedComponents: string[];
  totalCost: number;
}

export interface ApiQCRejection {
  id: string;
  quantity: number;
  reason: string;
  disposition: string;
  inspectorId: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface ApiBatchScan {
  id: string;
  stage: string;
  scannedBy: string | null;
  scannedAt: string;
}

export interface ApiBatchTelemetry {
  id: string;
  metric: string;
  value: number;
  recordedAt: string;
}

export interface ApiBatchBomRow {
  materialId: string;
  materialName: string;
  unit: string;
  plannedQuantity: number;
  consumedQuantity: number;
}

export interface CreateBatchInput {
  variantId: string;
  quantity: number;
  plannedDate?: string;
  approvalRequestId: string;
}

export interface RecordCostInput {
  materialCost?: number;
  sewingCost?: number;
  brandingCost?: number;
  packagingCost?: number;
}

export type QcDisposition = 'burned' | 'repaired_restocked';

export interface RecordQcRejectionInput {
  quantity?: number;
  reason: string;
  disposition: QcDisposition;
  inspectorId?: string;
}

export interface RecordScanInput {
  eventType: string;
  scannedQty?: number;
  operatorId?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 50, stage?: string): Promise<ApiProductionBatchList> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (stage) params = params.set('stage', stage);
    return firstValueFrom(
      this.http.get<ApiProductionBatchList>(apiUrl(this.baseUrl, 'production-batches'), {
        params,
      }),
    );
  }

  detail(id: string): Promise<ApiProductionBatch> {
    return firstValueFrom(
      this.http.get<ApiProductionBatch>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}`),
      ),
    );
  }

  cost(id: string): Promise<ApiProductionCost | null> {
    return firstValueFrom(
      this.http.get<ApiProductionCost | null>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/cost`),
      ),
    );
  }

  rejections(id: string): Promise<ApiQCRejection[]> {
    return firstValueFrom(
      this.http.get<ApiQCRejection[]>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/qc-rejections`),
      ),
    );
  }

  scans(id: string): Promise<ApiBatchScan[]> {
    return firstValueFrom(
      this.http.get<ApiBatchScan[]>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/scans`),
      ),
    );
  }

  telemetry(id: string): Promise<ApiBatchTelemetry[]> {
    return firstValueFrom(
      this.http.get<ApiBatchTelemetry[]>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/telemetry`),
      ),
    );
  }

  bom(id: string): Promise<ApiBatchBomRow[]> {
    return firstValueFrom(
      this.http.get<ApiBatchBomRow[]>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/bom`),
      ),
    );
  }

  updateStage(id: string, stage: string): Promise<ApiProductionBatch> {
    return firstValueFrom(
      this.http.patch<ApiProductionBatch>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/stage`),
        { stage },
      ),
    );
  }

  createBatch(input: CreateBatchInput): Promise<ApiProductionBatch> {
    return firstValueFrom(
      this.http.post<ApiProductionBatch>(apiUrl(this.baseUrl, 'production-batches'), input),
    );
  }

  recordCost(id: string, input: RecordCostInput): Promise<ApiProductionCost> {
    return firstValueFrom(
      this.http.post<ApiProductionCost>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/cost`),
        input,
      ),
    );
  }

  registerBarcode(id: string, barcode: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/barcode`),
        { barcode },
      ),
    ).then(() => undefined);
  }

  recordScan(id: string, input: RecordScanInput): Promise<void> {
    return firstValueFrom(
      this.http.post(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/scans`),
        input,
      ),
    ).then(() => undefined);
  }

  recordQcRejection(id: string, input: RecordQcRejectionInput): Promise<ApiQCRejection> {
    return firstValueFrom(
      this.http.post<ApiQCRejection>(
        apiUrl(this.baseUrl, `production-batches/${encodeURIComponent(id)}/qc-rejection`),
        input,
      ),
    );
  }
}
