import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface ApiRole {
  id: string;
  name: string;
  permissions?: ApiRolePermission[];
}

export interface ApiRolePermission {
  module: string;
  accessLevel: string;
}

export interface ApiRoleMatrixRow {
  id: string;
  name: string;
  permissions: ApiRolePermission[];
}

export interface ApiUser {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  title: string | null;
  role: ApiRole;
  status: string;
  emailVerifiedAt: string | null;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiUserList {
  data: ApiUser[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(page = 1, limit = 100): Promise<ApiUserList> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return firstValueFrom(this.http.get<ApiUserList>(apiUrl(this.baseUrl, 'users'), { params }));
  }

  rolesMatrix(): Promise<ApiRoleMatrixRow[]> {
    return firstValueFrom(
      this.http.get<ApiRoleMatrixRow[]>(apiUrl(this.baseUrl, 'users/roles')),
    );
  }

  updateRolePermissions(roleName: string, permissions: ApiRolePermission[]): Promise<unknown> {
    return firstValueFrom(
      this.http.put(
        apiUrl(this.baseUrl, `users/roles/${encodeURIComponent(roleName)}/permissions`),
        { permissions },
      ),
    );
  }

  updateRole(id: string, role: string): Promise<ApiUser> {
    return firstValueFrom(
      this.http.patch<ApiUser>(apiUrl(this.baseUrl, `users/${encodeURIComponent(id)}/role`), {
        role,
      }),
    );
  }

  updateMe(patch: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  }): Promise<ApiUser> {
    return firstValueFrom(
      this.http.patch<ApiUser>(apiUrl(this.baseUrl, 'users/me'), patch),
    );
  }
}
