import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type ApiVariantAvailability = 'in_stock' | 'out_of_stock' | 'made_to_order';

export interface ApiProductVariant {
  id: string;
  size: string | null;
  colour: string | null;
  sku: string;
  priceOverride: number | null;
  imageUrl: string | null;
  availabilityStatus: ApiVariantAvailability;
  storageLocation: string | null;
}

export interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isBestseller: boolean;
  basePrice: number;
  salePercent: number | null;
  saleEndsAt: string | null;
  primaryImageUrl: string | null;
  sizeClass: string | null;
  variants: ApiProductVariant[];
  createdAt: string;
  updatedAt: string;
  soldCount?: number;
  salePrice?: number | null;
}

export interface ApiProductList {
  data: ApiProduct[];
  total: number;
}

export interface ApiCategory {
  id: string;
  name: string;
}

export interface ApiCollection {
  id: string;
  name: string;
}

export interface ApiProductFilters {
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogueApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(filters: ApiProductFilters): Promise<ApiProductList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<ApiProductList>(apiUrl(this.baseUrl, 'products'), { params }),
    );
  }

  detail(id: string): Promise<ApiProduct> {
    return firstValueFrom(
      this.http.get<ApiProduct>(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}`)),
    );
  }

  variants(id: string): Promise<ApiProductVariant[]> {
    return firstValueFrom(
      this.http.get<ApiProductVariant[]>(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}/variants`)),
    );
  }

  categories(): Promise<ApiCategory[]> {
    return firstValueFrom(
      this.http.get<ApiCategory[]>(apiUrl(this.baseUrl, 'categories')),
    );
  }

  collections(): Promise<ApiCollection[]> {
    return firstValueFrom(
      this.http.get<ApiCollection[]>(apiUrl(this.baseUrl, 'collections')),
    );
  }
}
