import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type CouponType = 'percent_off' | 'fixed_off' | 'free_delivery';
export type CouponClaimKind = 'coupon' | 'bundle';

export interface ApiCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: CouponType;
  value: number;
  max_discount: number | null;
  min_spend: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_cap: number | null;
  per_customer_cap: number;
  applies_to_sale_items: boolean;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  minSpend: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageCap: number | null;
  perCustomerCap: number;
  appliesToSaleItems: boolean;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCouponList {
  data: ApiCoupon[];
  total: number;
}

export interface ClaimCouponInput {
  coupon_id: string;
}

export interface ClaimCouponResult {
  claimed: boolean;
  coupon_id: string;
  message: string;
}

function mapCoupon(c: ApiCoupon): Coupon {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    type: c.type,
    value: c.value,
    maxDiscount: c.max_discount,
    minSpend: c.min_spend,
    startsAt: c.starts_at,
    expiresAt: c.expires_at,
    usageCap: c.usage_cap,
    perCustomerCap: c.per_customer_cap,
    appliesToSaleItems: c.applies_to_sale_items,
    timesUsed: c.times_used,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class CouponsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  mine(page = 1, limit = 50): Promise<Coupon[]> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(
      this.http.get<ApiCouponList>(apiUrl(this.baseUrl, 'coupons/mine'), { params }),
    ).then((r) => r.data.map(mapCoupon));
  }

  claim(input: ClaimCouponInput): Promise<ClaimCouponResult> {
    return firstValueFrom(
      this.http.post<ClaimCouponResult>(apiUrl(this.baseUrl, 'coupons/claim'), input),
    );
  }
}
