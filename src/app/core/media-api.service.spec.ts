import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { API_BASE_URL } from './api-config';
import { MediaApiService } from './media-api.service';

class FakeXhr {
  static instances: FakeXhr[] = [];
  upload = { addEventListener: jasmine.createSpy('upload-onprogress') };
  private listeners: Record<string, (e?: ProgressEvent) => void> = {};
  status = 200;
  responseText = '';
  method = '';
  url = '';
  body: unknown = null;
  addEventListener(type: string, cb: (e?: ProgressEvent) => void): void {
    this.listeners[type] = cb;
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  send(body: unknown): void {
    this.body = body;
    FakeXhr.instances.push(this);
  }
  respond(status: number, responseText: string): void {
    this.status = status;
    this.responseText = responseText;
    this.listeners['load']?.();
  }
  error(): void {
    this.listeners['error']?.();
  }
}

describe('MediaApiService upload', () => {
  let service: MediaApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: '/api/v1' }],
    });
    service = TestBed.inject(MediaApiService);
    (globalThis as any).XMLHttpRequest = FakeXhr;
  });

  afterEach(() => {
    delete (globalThis as any).XMLHttpRequest;
    FakeXhr.instances = [];
  });

  it('POSTs the file to media/images as form data', async () => {
    const file = new File(['bytes'], 'shirt.png', { type: 'image/png' });
    const promise = service.upload(file);
    const xhr = FakeXhr.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/v1/media/images');
    expect(xhr.body instanceof FormData).toBeTrue();
    expect((xhr.body as FormData).get('file')).toBe(file);

    xhr.respond(
      200,
      JSON.stringify({
        id: 'm-1',
        url: '/cdn/shirt.png',
        filename: 'shirt.png',
        size: 5,
        mimeType: 'image/png',
        createdAt: '2026-05-01T00:00:00Z',
      }),
    );
    const result = await promise;
    expect(result.id).toBe('m-1');
    expect(result.url).toBe('/cdn/shirt.png');
    expect(result.mimeType).toBe('image/png');
  });

  it('rejects with the server status on a failed upload', async () => {
    const promise = service.upload(new File(['x'], 'fail.png'));
    const xhr = FakeXhr.instances[0];
    xhr.respond(500, 'boom');
    await expectAsync(promise).toBeRejectedWithError('Upload failed with status 500');
  });

  it('rejects with a network error when the request never loads', async () => {
    const promise = service.upload(new File(['x'], 'net.png'));
    const xhr = FakeXhr.instances[0];
    xhr.error();
    await expectAsync(promise).toBeRejectedWithError('Upload failed: network error');
  });

  it('reports upload progress through the callback', async () => {
    const seen: number[] = [];
    const promise = service.upload(new File(['x'], 'prog.png'), (p) => seen.push(p));
    const xhr = FakeXhr.instances[0];
    const progressListener = xhr.upload.addEventListener.calls.mostRecent().args[1] as (e: ProgressEvent) => void;
    const makeEvent = (loaded: number) =>
      ({ lengthComputable: true, loaded, total: 10 }) as ProgressEvent;
    progressListener(makeEvent(5));
    progressListener(makeEvent(10));
    xhr.respond(200, JSON.stringify({ id: 'm-2', url: '/u', filename: 'prog.png', size: 1, mimeType: 'image/png', createdAt: '2026-01-01' }));
    await promise;
    expect(seen).toEqual([50, 100]);
  });
});
