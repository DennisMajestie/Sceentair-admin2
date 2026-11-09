import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, ParamMap } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { MediaApiService, type MediaUpload } from '../../core/media-api.service';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-media-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Media</span>
        <h1 class="head__title">Media library</h1>
        <p class="head__lead">Upload and manage catalogue images and assets.</p>
      </div>
      <div class="head__actions">
        <label class="upload-btn" for="file-input">
          <app-icon name="upload" [size]="16" />
          <span>Upload image</span>
        </label>
        <input type="file" id="file-input" accept="image/*" class="hidden-input" (change)="onFileSelected($event)" />
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
      </div>
    </div>

    <div class="stats" aria-label="Media summary">
      <article class="stat">
        <span class="stat__label">Assets</span>
        <strong class="stat__value">{{ uploads().length }}</strong>
        <span class="stat__detail">Media files</span>
      </article>
      <article class="stat">
        <span class="stat__label">Total size</span>
        <strong class="stat__value">{{ totalSizeMB }} MB</strong>
        <span class="stat__detail">Combined file size</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search filename" aria-label="Search media" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} files</span>
    </div>

    <div class="media-grid" aria-label="Media files">
      @for (row of visible(); track row.id) {
        <button type="button" class="media-card" (click)="open(row.id)" [attr.aria-label]="'Media ' + row.filename">
          <span class="media-card__thumb">
            <img [src]="row.url" [alt]="row.filename" loading="lazy" />
          </span>
          <span class="media-card__name">{{ row.filename }}</span>
          <span class="media-card__meta">
            <span>{{ (row.size / 1024 / 1024).toFixed(2) }} MB</span>
            <span>{{ row.mimeType }}</span>
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="media-empty">
          <strong>No media files yet.</strong>
          <span>Upload your first image.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Media detail">
      <ng-container drawerTitle>
        @if (selected(); as m) {
          <div class="dtitle">
            <strong class="mono">{{ m.id }}</strong>
            <span>{{ m.filename }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as m) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Filename</span>
              <span class="dmeta">{{ m.filename }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Size</span>
              <strong class="dtotal">{{ (m.size / 1024 / 1024).toFixed(2) }} MB</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>ID</dt><dd class="mono">{{ m.id }}</dd></div>
            <div><dt>MIME type</dt><dd>{{ m.mimeType }}</dd></div>
            <div><dt>Size</dt><dd>{{ (m.size / 1024 / 1024).toFixed(2) }} MB</dd></div>
            <div><dt>Uploaded</dt><dd>{{ fmtDate(m.createdAt) }}</dd></div>
            <div><dt>URL</dt><dd class="mono">{{ m.url }}</dd></div>
          </dl>

          <div class="dpreview">
            <img [src]="m.url" [alt]="m.filename" class="dpreview-img" />
          </div>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .upload-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); color: var(--text); font-size: var(--fs-sm); cursor: pointer; }
    .upload-btn:hover { border-color: var(--primary); }
    .hidden-input { display: none; }
    .media-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .media-card { display: grid; gap: 12px; width: 100%; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); cursor: pointer; box-shadow: var(--shadow); }
    .media-card:hover { border-color: var(--primary); }
    .media-card__thumb { aspect-ratio: 1; width: 100%; border: 1px solid var(--line); border-radius: 8px; background: var(--well); overflow: hidden; }
    .media-card__thumb img { width: 100%; height: 100%; object-fit: cover; }
    .media-card__name { font-size: var(--fs-sm); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .media-card__meta { color: var(--muted); font-size: var(--fs-xs); }
    .media-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .media-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dpreview { margin-top: 16px; }
    .dpreview-img { max-width: 100%; max-height: 400px; border: 1px solid var(--line); border-radius: 8px; background: var(--well); }
    .mono { font-family: var(--fs-mono, monospace); }
    @media (max-width: 1100px) { .media-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class MediaLibrary {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly mediaApi = inject(MediaApiService);
  private readonly toasts = inject(ToastService);

  protected readonly fmtDate = (value: string) => new Date(value).toLocaleDateString();

  protected readonly query = signal('');
  protected readonly uploads = signal<MediaUpload[]>([]);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p: ParamMap) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    // The media API exposes image uploads only (no list endpoint), so the shelf
    // starts empty and fills as images are uploaded in this session.
    this.uploads.set([]);
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.uploads()
      .filter((m) => {
        if (!q) return true;
        return (m.filename ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });

  protected readonly totalSizeMB = computed(() =>
    (this.uploads().reduce((a, m) => a + m.size, 0) / 1024 / 1024).toFixed(2),
  );

  protected readonly selected = computed(() => this.uploads().find((m) => m.id === this.routeId()));

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const upload = await this.mediaApi.upload(file, (progress) => {
        // Could show progress UI here
      });
      this.uploads.update((list) => [upload, ...list]);
      input.value = '';
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Upload failed.', 'bad');
    }
  }

  protected open(id: string): void {
    this.router.navigate(['/media', id]);
  }

  protected close(): void {
    this.router.navigate(['/media']);
  }
}