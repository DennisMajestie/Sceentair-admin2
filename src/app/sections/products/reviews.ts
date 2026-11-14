import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReviewsApiService,
  type ApiReview,
} from '../../core/reviews-api.service';
import { ToastService } from '../../core/toast';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'app-products-reviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, FormsModule, DatePipe, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Products</span>
        <h1 class="head__title">Review moderation</h1>
        <p class="head__lead">{{ pending().length }} reviews waiting for a publishing decision</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/products/catalog">Catalog</a>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center" role="status"><app-spinner size="sm" label="Loading pending reviews" /></div>
    } @else if (loadError()) {
      <div class="empty"><strong>Couldn't load reviews.</strong><span>{{ loadError() }}</span><button class="btn btn--ghost" type="button" (click)="load()">Retry</button></div>
    }

    <div class="review-grid" aria-label="Pending reviews">
      @for (review of visible(); track review.id) {
        <article class="review-card">
          <header class="review-card__top">
            <div class="stars" [attr.aria-label]="'Rated ' + review.rating + ' out of 5'">
              @for (star of [1, 2, 3, 4, 5]; track star) {
                <app-icon name="star" [size]="14" [class.is-on]="star <= review.rating" />
              }
            </div>
            <span class="sub">{{ review.createdAt | date: 'medium' }}</span>
          </header>
          <p class="review-card__comment">{{ review.comment || 'No written comment.' }}</p>
          <footer class="review-card__foot">
            <div class="review-card__meta">
              <span class="review-card__product">{{ productName(review) }}</span>
              <span class="sub mono">{{ review.variant?.sku ?? 'no sku' }}{{ review.variant?.size ? ' · ' + review.variant?.size : '' }}</span>
            </div>
            <div class="review-card__actions">
              <button class="btn btn--ghost" type="button" [disabled]="!!busyId()" (click)="startReject(review.id)">Reject</button>
              <button class="btn btn--primary" type="button" [disabled]="!!busyId()" (click)="publish(review.id)">{{ busyId() === review.id ? 'Publishing…' : 'Publish' }}</button>
            </div>
            @if (rejectingId() === review.id) {
              <form class="reject-row" (ngSubmit)="confirmReject(review.id)">
                <button class="btn btn--ghost" type="button" (click)="rejectingId.set(null)">Keep</button>
                <button class="btn btn--ghost destructive" type="submit" [disabled]="!!busyId()">Confirm rejection</button>
              </form>
            }
          </footer>
        </article>
      }
      @if (!visible().length && !loading() && !loadError()) {
        <div class="empty"><strong>The moderation queue is clear.</strong><span>New reviews appear here as customers post them.</span></div>
      }
    </div>
  `,
  styles: `
    .note { padding: 14px 16px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); font-size: var(--fs-sm); }
    .review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .review-card { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); box-shadow: var(--shadow); }
    .review-card__top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .stars { display: inline-flex; gap: 2px; color: var(--line); }
    .stars app-icon.is-on { color: var(--ochre); }
    .review-card__comment { font-size: var(--fs-md); line-height: 1.5; color: var(--text); min-height: 3em; }
    .review-card__foot { display: grid; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; }
    .review-card__meta { display: grid; gap: 2px; }
    .review-card__product { font-weight: 700; font-size: var(--fs-sm); }
    .sub { color: var(--faint); font-size: var(--fs-xs); }
    .review-card__actions { display: flex; gap: 10px; justify-content: flex-end; }
    .reject-row { display: flex; gap: 10px; justify-content: flex-end; }
    .destructive { color: var(--bad); }
    .empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 900px) { .review-grid { grid-template-columns: 1fr; } }
  `,
})
export class ProductsReviews {
  private readonly api = inject(ReviewsApiService);
  private readonly toast = inject(ToastService);



  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly pending = signal<ApiReview[]>([]);
  protected readonly busyId = signal<string | null>(null);
  protected readonly rejectingId = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected productName(review: ApiReview): string {
    return review.variant?.product?.name ?? 'Unknown product';
  }

  protected readonly visible = computed(() => this.pending().slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));

  protected publish(id: string): void {
    this.moderate(id, 'published');
  }

  protected startReject(id: string): void {
    this.rejectingId.set(id);
  }

  protected confirmReject(id: string): void {
    this.rejectingId.set(null);
    this.moderate(id, 'rejected');
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.pending.set(await this.api.pending());
    } catch {
      this.loadError.set('The reviews service is unreachable. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private async moderate(id: string, status: 'published' | 'rejected'): Promise<void> {
    this.busyId.set(id);
    try {
      await this.api.moderate(id, status);
      this.pending.update((list) => list.filter((review) => review.id !== id));
      this.toast.show(status === 'published' ? 'Review published' : 'Review rejected', 'good');
    } catch {
      this.toast.show('Could not update the review.', 'bad');
    } finally {
      this.busyId.set(null);
    }
  }
}
