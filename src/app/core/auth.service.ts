import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';
import { ApiSession } from './api-session';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  phone?: string | null;
  title?: string | null;
  access: Record<string, string>;
  totpEnabled?: boolean;
}

interface TokenResponse {
  accessToken: string;
}

interface TwoFactorChallenge {
  requires2fa: true;
  challengeToken: string;
}

export type LoginResult = { requires2fa: true } | { requires2fa: false };

export interface ApiAuthSession {
  id: string;
  createdAt: string;
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(ApiSession);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly router = inject(Router);
  private restorePromise: Promise<boolean> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly error = signal<string | null>(null);
  private challengeToken: string | null = null;

  async login(email: string, password: string): Promise<LoginResult> {
    this.error.set(null);
    this.challengeToken = null;
    try {
      const result = await firstValueFrom(
        this.http.post<TokenResponse | TwoFactorChallenge>(
          apiUrl(this.baseUrl, 'auth/login'),
          { email, password },
          { withCredentials: true },
        ),
      );
      if ('requires2fa' in result && result.requires2fa) {
        this.challengeToken = result.challengeToken;
        return { requires2fa: true };
      }
      await this.acceptToken((result as TokenResponse).accessToken);
      return { requires2fa: false };
    } catch (error) {
      this.error.set(this.messageFor(error, 'Sign-in failed.'));
      throw error;
    }
  }

  async verifyTwoFactor(code: string): Promise<void> {
    if (!this.challengeToken) {
      throw new Error('The two-factor challenge has expired. Sign in again.');
    }
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<TokenResponse>(
          apiUrl(this.baseUrl, 'auth/2fa/verify'),
          { challengeToken: this.challengeToken, code },
          { withCredentials: true },
        ),
      );
      this.challengeToken = null;
      await this.acceptToken(result.accessToken);
    } catch (error) {
      this.error.set(this.messageFor(error, 'Two-factor verification failed.'));
      throw error;
    }
  }

  cancelLogin(): void {
    this.challengeToken = null;
    this.error.set(null);
  }

  async restoreSession(): Promise<boolean> {
    if (this.session.accessToken() && this.user()) return true;
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this.restore();
    try {
      return await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  /** Force a token refresh (used after a 401 or at token expiry). */
  async refreshSession(): Promise<boolean> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this.restore();
    try {
      return await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  async logout(): Promise<void> {
    const token = this.session.accessToken();
    if (!token) {
      this.clear();
      return;
    }
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(apiUrl(this.baseUrl, 'auth/logout'), {}, { withCredentials: true }),
      );
    } catch (error) {
      this.error.set(this.messageFor(error, 'Could not reach the sign-out service.'));
    } finally {
      this.clear();
    }
  }

  async resetPassword(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(apiUrl(this.baseUrl, 'auth/reset-password'), { email }, { withCredentials: true }),
    );
  }

  async listSessions(): Promise<ApiAuthSession[]> {
    const result = await firstValueFrom(
      this.http.get<ApiAuthSession[]>(apiUrl(this.baseUrl, 'auth/sessions')),
    );
    return Array.isArray(result) ? result : [];
  }

  async revokeSession(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(apiUrl(this.baseUrl, `auth/sessions/${id}`)),
    );
  }

  async setup2fa(): Promise<{ secret: string; otpauthUrl: string }> {
    return firstValueFrom(
      this.http.post<{ secret: string; otpauthUrl: string }>(
        apiUrl(this.baseUrl, 'auth/2fa/setup'),
        {},
        { withCredentials: true },
      ),
    );
  }

  async enable2fa(code: string): Promise<{ enabled: boolean }> {
    return firstValueFrom(
      this.http.post<{ enabled: boolean }>(
        apiUrl(this.baseUrl, 'auth/2fa/enable'),
        { code },
        { withCredentials: true },
      ),
    );
  }

  async disable2fa(code: string): Promise<{ enabled: boolean }> {
    return firstValueFrom(
      this.http.post<{ enabled: boolean }>(
        apiUrl(this.baseUrl, 'auth/2fa/disable'),
        { code },
        { withCredentials: true },
      ),
    );
  }

  private async restore(): Promise<boolean> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<TokenResponse>(
          apiUrl(this.baseUrl, 'auth/refresh'),
          {},
          { withCredentials: true },
        ),
      );
      await this.acceptToken(result.accessToken);
      return true;
    } catch (error) {
      this.clear();
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        return false;
      }
      this.error.set(this.messageFor(error, 'Could not connect to the API.'));
      return false;
    }
  }

  private async acceptToken(token: string): Promise<void> {
    this.session.setAccessToken(token);
    this.scheduleExpiry(token);
    try {
      this.user.set(
        await firstValueFrom(
          this.http.get<AuthUser>(apiUrl(this.baseUrl, 'auth/me'), { withCredentials: true }),
        ),
      );
    } catch (error) {
      this.clear();
      throw error;
    }
  }

  /** Refresh a few seconds before the access token expires; sign out if it cannot. */
  private scheduleExpiry(token: string): void {
    this.cancelExpiryTimer();
    if (typeof window === 'undefined') return;
    const expiresAt = this.tokenExpiry(token);
    if (!expiresAt) return;
    const delay = Math.max(expiresAt - Date.now() - 15_000, 1_000);
    this.expiryTimer = setTimeout(() => {
      void this.refreshSession().then((ok) => {
        if (!ok) this.redirectToSignIn();
      });
    }, delay);
  }

  private tokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const json = JSON.parse(atob(padded));
      return typeof json.exp === 'number' ? json.exp * 1_000 : null;
    } catch {
      return null;
    }
  }

  private redirectToSignIn(): void {
    const url = this.router.url;
    if (url.startsWith('/signin')) return;
    void this.router.navigate(['/signin'], {
      queryParams: url && url !== '/' ? { returnUrl: url } : {},
    });
  }

  private cancelExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private clear(): void {
    this.cancelExpiryTimer();
    this.session.clear();
    this.user.set(null);
    this.challengeToken = null;
  }

  private messageFor(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'Cannot reach the API. Check its URL and availability.';
    }
    return fallback;
  }
}
