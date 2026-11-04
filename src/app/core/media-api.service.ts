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
          try {
            resolve(JSON.parse(req.responseText) as MediaUpload);
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
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
