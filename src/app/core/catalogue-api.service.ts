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

export function primaryProductImage(
  product: Pick<ApiProduct, 'primaryImageUrl' | 'variants'>,
): string | null {
  return (
    product.primaryImageUrl ||
    product.variants.find((variant) => variant.imageUrl)?.imageUrl ||
    null
  );
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

/** One BOM line for a variant: which material and how much per unit. */
export interface ApiBomRow {
  id: string;
  materialId: string;
  materialName?: string;
  materialUnit?: string;
  quantity: number;
  note?: string | null;
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
    return firstValueFrom(this.http.get<ApiCollection[]>(apiUrl(this.baseUrl, 'collections')));
  }

  /** Product photo upload (multipart, field `file`); server returns the public URL. */
  uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData();
    body.append('file', file, file.name);
    return firstValueFrom(
      this.http.post<{ url: string }>(apiUrl(this.baseUrl, 'media/images'), body),
    );
  }

  createProduct(body: Partial<ApiProduct> & Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(
      this.http.post(apiUrl(this.baseUrl, 'products'), body),
    );
  }

  updateProduct(id: string, body: Partial<ApiProduct> & Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}`), body),
    );
  }

  deleteProduct(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}`)),
    );
  }

  /** Start a timed sale; the API requires the covering approval request id. */
  setProductSale(
    id: string,
    body: { percent: number; endsAt: string; approvalRequestId: string },
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.put(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}/sale`), body),
    );
  }

  endProductSale(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(apiUrl(this.baseUrl, `products/${encodeURIComponent(id)}/sale`)),
    );
  }

  createVariant(productId: string, body: Partial<ApiProductVariant> & Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        apiUrl(this.baseUrl, `products/${encodeURIComponent(productId)}/variants`),
        body,
      ),
    );
  }

  updateVariant(
    productId: string,
    variantId: string,
    body: Partial<ApiProductVariant> & Record<string, unknown>,
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(
        apiUrl(
          this.baseUrl,
          `products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
        ),
        body,
      ),
    );
  }

  bom(variantId: string): Promise<ApiBomRow[]> {
    return firstValueFrom(
      this.http.get<ApiBomRow[]>(apiUrl(this.baseUrl, `variants/${encodeURIComponent(variantId)}/bom`)),
    );
  }

  replaceBom(
    variantId: string,
    items: Array<{ materialId: string; quantity: number; note?: string }>,
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.put(
        apiUrl(this.baseUrl, `variants/${encodeURIComponent(variantId)}/bom`),
        { items },
      ),
    );
  }

  specSheet(variantId: string): Promise<Record<string, unknown>> {
    return firstValueFrom(
      this.http.get<Record<string, unknown>>(
        apiUrl(this.baseUrl, `variants/${encodeURIComponent(variantId)}/spec-sheet`),
      ),
    );
  }

  createCategory(name: string): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl(this.baseUrl, 'categories'), { name }));
  }

  createCollection(name: string): Promise<unknown> {
    return firstValueFrom(this.http.post(apiUrl(this.baseUrl, 'collections'), { name }));
  }
}
