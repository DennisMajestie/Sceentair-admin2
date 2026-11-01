import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiSession {
  private readonly accessTokenState = signal<string | null>(null);
  readonly accessToken = this.accessTokenState.asReadonly();

  setAccessToken(token: string): void {
    this.accessTokenState.set(token);
  }

  clear(): void {
    this.accessTokenState.set(null);
  }
}
