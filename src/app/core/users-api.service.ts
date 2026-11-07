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
  /** Enum order from the server; oldest callers may omit it. */
  accessLevels?: string[];
  /** Stable SHA-256 over the canonical module/level set. */
  version?: string;
  /** Active users in the role (aggregate count, no personal data). */
  memberCount?: number;
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

/** Payload for creating a staff account. */
export interface ApiCreateUserInput {
  name: string;
  email: string;
  role: string;
  password: string;
  phone?: string;
  title?: string;
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

  updateRolePermissions(
    roleName: string,
    permissions: ApiRolePermission[],
    options?: { baseVersion?: string; reason?: string },
  ): Promise<ApiRoleMatrixRow> {
    return firstValueFrom(
      this.http.put<ApiRoleMatrixRow>(
        apiUrl(this.baseUrl, `users/roles/${encodeURIComponent(roleName)}/permissions`),
        { ...options, permissions },
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

  detail(id: string): Promise<ApiUser> {
    return firstValueFrom(
      this.http.get<ApiUser>(apiUrl(this.baseUrl, `users/${encodeURIComponent(id)}`)),
    );
  }

  create(input: ApiCreateUserInput): Promise<ApiUser> {
    return firstValueFrom(
      this.http.post<ApiUser>(apiUrl(this.baseUrl, 'users'), input),
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
