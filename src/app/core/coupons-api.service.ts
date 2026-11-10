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

// --- Operator (admin) surface — coupons/admin/*, gated at marketing:full ---

export type CouponAudience = 'all' | 'new_customers' | 'specific';
export type CouponCampaignClaimKind = 'coupon' | 'bundle';
export type CouponCampaignPlacement = 'home_top';
export type CouponCampaignStatus = 'upcoming' | 'running' | 'ended';

export interface AdminCoupon {
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
  audience: CouponAudience;
  appliesToSaleItems: boolean;
  isActive: boolean;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CouponBundle {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponCampaign {
  id: string;
  badgeText: string | null;
  headline: string;
  offerText: string | null;
  labelText: string;
  startsAt: string;
  endsAt: string;
  placement: CouponCampaignPlacement;
  claimKind: CouponCampaignClaimKind;
  couponId: string | null;
  bundleId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One row of `GET /coupons/admin/report`; counts arrive as raw DB integers. */
export interface CouponReportRow {
  couponId: string;
  code: string;
  name: string;
  held: number;
  used: number;
  expired: number;
}

export interface CreateCouponInput {
  name: string;
  description?: string | null;
  type: CouponType;
  value: number;
  maxDiscount?: number | null;
  minSpend?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageCap?: number | null;
  perCustomerCap?: number;
  audience: CouponAudience;
  appliesToSaleItems?: boolean;
  isActive?: boolean;
  reason: string;
}

export interface CreateBundleInput {
  name: string;
  description?: string | null;
  couponIds: string[];
  reason: string;
}

export interface CreateCampaignInput {
  headline: string;
  badgeText?: string;
  offerText?: string;
  labelText?: string;
  startsAt: string;
  endsAt: string;
  claimKind: CouponCampaignClaimKind;
  couponId?: string;
  bundleId?: string;
  placement?: CouponCampaignPlacement;
  reason: string;
}

export interface IssueCouponInput {
  customerIds: string[];
  expiresAt?: string | null;
  reason: string;
}

/**
 * The admin controllers return TypeORM entities (camelCase), while nothing in
 * the API serialises snake_case globally. Normalise both spellings so a casing
 * change on the server cannot silently blank a field.
 */
function camelize<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelize(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = camelize(v);
    }
    return out as T;
  }
  return value as T;
}

function mapCoupon(c: any): Coupon {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description ?? null,
    type: c.type,
    value: c.value,
    maxDiscount: c.maxDiscount ?? c.max_discount ?? null,
    minSpend: c.minSpend ?? c.min_spend ?? null,
    startsAt: c.startsAt ?? c.starts_at ?? null,
    expiresAt: c.expiresAt ?? c.expires_at ?? null,
    usageCap: c.usageCap ?? c.usage_cap ?? null,
    perCustomerCap: c.perCustomerCap ?? c.per_customer_cap ?? 1,
    appliesToSaleItems: c.appliesToSaleItems ?? c.applies_to_sale_items ?? false,
    timesUsed: c.timesUsed ?? c.times_used ?? 0,
    createdAt: c.createdAt ?? c.created_at,
    updatedAt: c.updatedAt ?? c.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class CouponsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  mine(page = 1, limit = 50): Promise<Coupon[]> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(
      this.http.get<unknown>(apiUrl(this.baseUrl, 'coupons/mine'), { params }),
    ).then((r) => {
      const raw = r as Record<string, unknown>;
      const list: unknown[] = Array.isArray(r)
        ? r
        : Array.isArray(raw?.['data'])
          ? (raw['data'] as unknown[])
          : ['available', 'used', 'expired', 'revoked'].flatMap((key) =>
              Array.isArray(raw?.[key]) ? (raw[key] as unknown[]) : [],
            );
      return camelize<Coupon[]>(list).map(mapCoupon);
    });
  }

  claim(input: ClaimCouponInput): Promise<ClaimCouponResult> {
    return firstValueFrom(
      this.http.post<ClaimCouponResult>(apiUrl(this.baseUrl, 'coupons/claim'), input),
    );
  }

  // --- Operator surface (marketing:full) ---

  adminCoupons(): Promise<AdminCoupon[]> {
    return firstValueFrom(
      this.http.get<unknown>(apiUrl(this.baseUrl, 'coupons/admin/coupons')),
    ).then((r) => camelize<AdminCoupon[]>(r));
  }

  createCoupon(input: CreateCouponInput): Promise<AdminCoupon> {
    return firstValueFrom(
      this.http.post<unknown>(apiUrl(this.baseUrl, 'coupons/admin/coupons'), input),
    ).then((r) => camelize<{ coupon: AdminCoupon }>(r).coupon);
  }

  updateCoupon(id: string, patch: Partial<CreateCouponInput>): Promise<AdminCoupon> {
    return firstValueFrom(
      this.http.patch<unknown>(
        apiUrl(this.baseUrl, `coupons/admin/coupons/${encodeURIComponent(id)}`),
        patch,
      ),
    ).then((r) => camelize<AdminCoupon>(r));
  }

  /** Deactivating keeps the row and its history; it just stops new use. */
  deactivateCoupon(id: string, reason: string): Promise<AdminCoupon> {
    return firstValueFrom(
      this.http.delete<unknown>(apiUrl(this.baseUrl, `coupons/admin/coupons/${encodeURIComponent(id)}`), {
        body: { reason },
      }),
    ).then((r) => camelize<AdminCoupon>(r));
  }

  bundles(): Promise<CouponBundle[]> {
    return firstValueFrom(
      this.http.get<unknown>(apiUrl(this.baseUrl, 'coupons/admin/bundles')),
    ).then((r) => camelize<CouponBundle[]>(r));
  }

  createBundle(input: CreateBundleInput): Promise<CouponBundle> {
    return firstValueFrom(
      this.http.post<unknown>(apiUrl(this.baseUrl, 'coupons/admin/bundles'), input),
    ).then((r) => camelize<CouponBundle>(r));
  }

  campaigns(): Promise<CouponCampaign[]> {
    return firstValueFrom(
      this.http.get<unknown>(apiUrl(this.baseUrl, 'coupons/admin/campaigns')),
    ).then((r) => camelize<CouponCampaign[]>(r));
  }

  createCampaign(input: CreateCampaignInput): Promise<CouponCampaign> {
    return firstValueFrom(
      this.http.post<unknown>(apiUrl(this.baseUrl, 'coupons/admin/campaigns'), input),
    ).then((r) => camelize<CouponCampaign>(r));
  }

  deactivateCampaign(id: string, reason: string): Promise<CouponCampaign> {
    return firstValueFrom(
      this.http.delete<unknown>(
        apiUrl(this.baseUrl, `coupons/admin/campaigns/${encodeURIComponent(id)}`),
        { body: { reason } },
      ),
    ).then((r) => camelize<CouponCampaign>(r));
  }

  /** Hands a coupon to named customers; returns how many were issued. */
  issue(couponId: string, input: IssueCouponInput): Promise<number> {
    return firstValueFrom(
      this.http.post<number>(
        apiUrl(this.baseUrl, `coupons/admin/coupons/${encodeURIComponent(couponId)}/issue`),
        input,
      ),
    );
  }

  report(): Promise<CouponReportRow[]> {
    return firstValueFrom(
      this.http.get<unknown>(apiUrl(this.baseUrl, 'coupons/admin/report')),
    ).then((r) =>
      camelize<CouponReportRow[]>(r).map((row) => ({
        ...row,
        held: Number(row.held) || 0,
        used: Number(row.used) || 0,
        expired: Number(row.expired) || 0,
      })),
    );
  }
}

/** The banner's state at `now`, derived from the window rather than stored. */
export function campaignStatus(
  c: Pick<CouponCampaign, 'startsAt' | 'endsAt'>,
  now: number = Date.now(),
): CouponCampaignStatus {
  const start = Date.parse(c.startsAt);
  const end = Date.parse(c.endsAt);
  if (now < start) return 'upcoming';
  if (now >= end) return 'ended';
  return 'running';
}
