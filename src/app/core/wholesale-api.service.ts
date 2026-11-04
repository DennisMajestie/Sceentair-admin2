import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export type WholesaleAccountStatus = 'pending' | 'approved' | 'rejected';
export type WholesaleBuyerType = 'retailer' | 'online_reseller' | 'institution' | 'distributor' | 'other';

export interface WholesaleAccount {
  id: string;
  userId: string;
  tierId: string | null;
  tierName: string | null;
  status: WholesaleAccountStatus;
  businessName: string | null;
  buyerType: WholesaleBuyerType | null;
  businessPhone: string | null;
  city: string | null;
  state: string | null;
  openingVolume: number | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
}

export interface WholesaleAccountList {
  data: WholesaleAccount[];
  total: number;
}

export interface WholesaleTier {
  id: string;
  name: string;
  ruleDescription: string | null;
  discountPercent: number;
  createdAt: string;
}

export interface WholesaleTierList {
  data: WholesaleTier[];
  total: number;
}

export interface WholesalePricing {
  variantId: string;
  sku: string | null;
  name: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  discountPercent: number | null;
  moq: number | null;
}

export interface WholesalePricingList {
  data: WholesalePricing[];
  total: number;
}

export interface WholesaleInvoice {
  id: string;
  accountId: string;
  accountName: string | null;
  orderId: string | null;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface WholesaleInvoiceList {
  data: WholesaleInvoice[];
  total: number;
}

export interface CreateWholesaleApplicationInput {
  businessName: string;
  businessPhone: string | null;
  city: string | null;
  state: string | null;
  openingVolume: number | null;
  buyerType: WholesaleBuyerType | null;
  tierId: string | null;
}

export interface ReviewWholesaleAccountInput {
  status: WholesaleAccountStatus;
  reviewedBy: string | null;
}

export interface CreateWholesaleTierInput {
  name: string;
  ruleDescription: string | null;
  discountPercent: number;
}

export interface UpdateWholesaleTierInput {
  name?: string;
  ruleDescription?: string | null;
  discountPercent?: number;
}

export interface WholesaleStockItem {
  variantId: string;
  sku: string | null;
  name: string | null;
  onHand: number;
  reserved: number;
  available: number;
}

export interface WholesaleStockList {
  data: WholesaleStockItem[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class WholesaleApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Public application
  apply(input: CreateWholesaleApplicationInput): Promise<WholesaleAccount> {
    return firstValueFrom(
      this.http.post<WholesaleAccount>(
        apiUrl(this.baseUrl, 'wholesale/apply'),
        input,
      ),
    );
  }

  // Staff account management
  listAccounts(filters: { page: number; limit: number; status?: WholesaleAccountStatus } = { page: 1, limit: 50 }): Promise<WholesaleAccountList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    if (filters.status) params = params.set('status', filters.status);
    return firstValueFrom(
      this.http.get<WholesaleAccountList>(apiUrl(this.baseUrl, 'wholesale/accounts'), { params }),
    );
  }

  getAccount(id: string): Promise<WholesaleAccount> {
    return firstValueFrom(
      this.http.get<WholesaleAccount>(apiUrl(this.baseUrl, `wholesale/accounts/${encodeURIComponent(id)}`)),
    );
  }

  reviewAccount(id: string, input: ReviewWholesaleAccountInput): Promise<WholesaleAccount> {
    return firstValueFrom(
      this.http.patch<WholesaleAccount>(
        apiUrl(this.baseUrl, `wholesale/accounts/${encodeURIComponent(id)}`),
        input,
      ),
    );
  }

  // Tier management
  listTiers(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<WholesaleTierList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<WholesaleTierList>(apiUrl(this.baseUrl, 'wholesale/tiers'), { params }),
    );
  }

  createTier(input: CreateWholesaleTierInput): Promise<WholesaleTier> {
    return firstValueFrom(
      this.http.post<WholesaleTier>(apiUrl(this.baseUrl, 'wholesale/tiers'), input),
    );
  }

  updateTier(id: string, input: UpdateWholesaleTierInput): Promise<WholesaleTier> {
    return firstValueFrom(
      this.http.patch<WholesaleTier>(
        apiUrl(this.baseUrl, `wholesale/tiers/${encodeURIComponent(id)}`),
        input,
      ),
    );
  }

  deleteTier(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(apiUrl(this.baseUrl, `wholesale/tiers/${encodeURIComponent(id)}`)),
    );
  }

  // Pricing
  listPricing(filters: { page: number; limit: number } = { page: 1, limit: 100 }): Promise<WholesalePricingList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<WholesalePricingList>(apiUrl(this.baseUrl, 'wholesale/pricing'), { params }),
    );
  }

  // Stock
  listStock(filters: { variantIds?: string[] } = {}): Promise<WholesaleStockList> {
    let params = new HttpParams();
    if (filters.variantIds) {
      for (const id of filters.variantIds) {
        params = params.append('variantIds', id);
      }
    }
    return firstValueFrom(
      this.http.get<WholesaleStockList>(apiUrl(this.baseUrl, 'wholesale/stock'), { params }),
    );
  }

  // Invoices
  listInvoices(filters: { page: number; limit: number } = { page: 1, limit: 50 }): Promise<WholesaleInvoiceList> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('limit', filters.limit);
    return firstValueFrom(
      this.http.get<WholesaleInvoiceList>(apiUrl(this.baseUrl, 'wholesale/invoices'), { params }),
    );
  }
}
