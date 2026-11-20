import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL, REALTIME_URL } from './api-config';
import { NETWORK_ERROR_MESSAGE } from './network-error';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'offline';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly realtimeUrl = inject(REALTIME_URL);
  private readonly changes = new Subject<void>();
  private socket?: Socket;
  private token: string | null = null;

  readonly status = signal<RealtimeStatus>('idle');
  /** Set when the socket cannot reach the realtime server, for the shell's connection warning. */
  readonly connectionError = signal('');
  readonly adminDataChanged = this.changes.asObservable();

  connect(token: string | null): void {
    if (!token) {
      this.disconnect();
      return;
    }
    if (this.socket && this.token === token) return;

    this.socket?.disconnect();
    this.token = token;
    this.status.set('connecting');

    const origin =
      this.realtimeUrl ||
      new URL(
        this.baseUrl,
        typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
      ).origin;
    void this.openSocket(token, origin);
  }

  private async openSocket(token: string, origin: string): Promise<void> {
    let io: typeof import('socket.io-client').io;
    try {
      ({ io } = await import('socket.io-client'));
    } catch (error) {
      if (this.token === token) {
        this.status.set('offline');
        this.connectionError.set(NETWORK_ERROR_MESSAGE);
        console.error('Could not load the realtime client.', error);
      }
      return;
    }
    if (this.token !== token) return;

    const socket = io(origin, {
      withCredentials: true,
      auth: (callback) => callback({ token }),
    });
    this.socket = socket;
    socket.on('connect', () => {
      this.status.set('connected');
      this.connectionError.set('');
    });
    socket.on('disconnect', () => {
      this.status.set('offline');
      this.connectionError.set(NETWORK_ERROR_MESSAGE);
    });
    socket.on('connect_error', () => {
      this.status.set('offline');
      this.connectionError.set(NETWORK_ERROR_MESSAGE);
    });
    socket.on('admin:data-changed', () => this.changes.next());
  }

  /** Re-open the socket after a connection failure, keeping the current session. */
  reconnect(): void {
    const token = this.token;
    this.disconnect();
    if (token) this.connect(token);
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.token = null;
    this.status.set('idle');
    this.connectionError.set('');
  }
}
