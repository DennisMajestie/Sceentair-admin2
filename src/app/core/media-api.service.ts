import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, apiUrl } from './api-config';

export interface MediaUpload {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MediaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Uploads one image. The endpoint answers with `{ url }` only, so the
   * remaining metadata is taken from the local file to keep the shelf usable.
   */
  upload(file: File, onProgress?: (progress: number) => void): Promise<MediaUpload> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise<MediaUpload>((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      req.addEventListener('load', () => {
        if (req.status >= 200 && req.status < 300) {
          let url: string | undefined;
          try {
            url = (JSON.parse(req.responseText) as { url?: string }).url;
          } catch {
            reject(new Error('Invalid response from server'));
            return;
          }
          if (!url) {
            reject(new Error('Upload did not return an image URL'));
            return;
          }
          resolve({
            id: url.split('/').pop() || String(Date.now()),
            url,
            filename: file.name,
            size: file.size,
            mimeType: file.type || 'image/jpeg',
            createdAt: new Date().toISOString(),
          });
        } else {
          reject(new Error(`Upload failed with status ${req.status}`));
        }
      });
      req.addEventListener('error', () => reject(new Error('Upload failed: network error')));
      req.open('POST', apiUrl(this.baseUrl, 'media/images'));
      req.send(formData);
    });
  }
}
