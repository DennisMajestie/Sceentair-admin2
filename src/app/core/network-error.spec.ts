import { HttpErrorResponse } from '@angular/common/http';
import { NETWORK_ERROR_MESSAGE, friendlyErrorMessage, isNetworkError } from './network-error';

describe('network error handling', () => {
  it('recognises a DNS failure reported as a status-0 HTTP error', () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    expect(isNetworkError(error)).toBeTrue();
    expect(friendlyErrorMessage(error, 'fallback')).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('recognises the generic browser fetch failure', () => {
    const error = new TypeError('Failed to fetch');
    expect(isNetworkError(error)).toBeTrue();
    expect(friendlyErrorMessage(error, 'fallback')).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('recognises socket.io connection failures', () => {
    expect(isNetworkError({ message: 'xhr poll error' })).toBeTrue();
    expect(isNetworkError({ message: 'websocket error' })).toBeTrue();
  });

  it('keeps a real server message instead of blaming the network', () => {
    const error = new HttpErrorResponse({ status: 500, error: { message: 'Gateway timeout' } });
    expect(isNetworkError(error)).toBeFalse();
    expect(friendlyErrorMessage(error, 'fallback')).toBe('Gateway timeout');
  });

  it('uses the fallback when nothing better is available', () => {
    expect(friendlyErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
