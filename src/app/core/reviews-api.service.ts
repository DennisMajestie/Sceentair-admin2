import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiReviewVariant {
  id: string;
  sku?: string | null;
  size?: string | null;
  colour?: string | null;
  product?: { id: string; name?: string | null } | null;
}

export interface ApiReview {
  id: string;
  orderId?: string;
  rating: number;
  comment: string | null;
  status: 'pending' | 'published' | 'rejected';
  customerId: string | null;
  createdAt: string;
  variant?: ApiReviewVariant | null;
}

@Injectable({ providedIn: 'root' })
export class ReviewsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  pending(): Promise<ApiReview[]> {
    return firstValueFrom(
      this.http.get<ApiReview[]>(apiUrl(this.baseUrl, 'reviews/pending')),
    );
  }

  moderate(id: string, status: 'published' | 'rejected'): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(apiUrl(this.baseUrl, `reviews/${encodeURIComponent(id)}/status`), {
        status,
      }),
    );
  }
}
