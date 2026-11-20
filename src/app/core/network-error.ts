import { HttpErrorResponse } from '@angular/common/http';

/**
 * Shown whenever a request fails before it reaches the server (DNS failure,
 * offline, blocked connection). The browser logs these as net::ERR_* codes,
 * but only a generic error reaches application code, so we detect them here
 * and replace the jargon with a message the user can act on.
 */
export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. This looks like a network or connection problem - check your internet connection, VPN and DNS settings, then try again.";

const NETWORK_PATTERN =
  /failed to fetch|network\s?error|networkerror|load failed|fetch failed|err_name_not_resolved|err_internet_disconnected|err_connection|err_network|xhr poll error|websocket error|websocket closed|socket hang up|timeout/i;

function errorText(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    return `${error.message ?? ''} ${typeof body === 'string' ? body : ''}`;
  }
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; description?: unknown; reason?: unknown };
    return `${String(record.message ?? '')} ${String(record.description ?? '')} ${String(record.reason ?? '')}`;
  }
  return typeof error === 'string' ? error : '';
}

/** True when the failure happened at the transport layer, not in server logic. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    // status 0 means no response was received (DNS, offline, CORS or TLS failure).
    if (error.status === 0) return true;
  }
  if (error instanceof TypeError) {
    return NETWORK_PATTERN.test(error.message ?? '');
  }
  return NETWORK_PATTERN.test(errorText(error));
}

/**
 * User-facing text for any error: a clear network explanation for connection
 * failures, the server's own message when available, otherwise the fallback.
 */
export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: unknown } | string | null;
    const message = body && typeof body === 'object' ? body.message : undefined;
    if (Array.isArray(message) && message.length) return message.join(' ');
    if (typeof message === 'string' && message.trim()) return message;
    if (typeof body === 'string' && body.trim()) return body;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
