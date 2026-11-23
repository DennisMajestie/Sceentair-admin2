import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from './icon';
import { Spinner } from './spinner';

export type FeedbackState = 'processing' | 'success' | 'error';

export interface FeedbackAction {
  label: string;
  tone?: 'quiet' | 'accent';
}

@Component({
  selector: 'app-feedback-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Spinner],
  template: `
    <dialog
      #dialog
      class="feedback"
      aria-modal="true"
      [attr.aria-label]="title()"
      (cancel)="onCancel($event)"
      (click)="onBackdrop($event)"
    >
      <div class="feedback__card" [class.feedback__card--wide]="state() !== 'processing'">
        @if (state() === 'processing') {
          <div class="feedback__spinner">
            <app-spinner variant="orbital" [size]="48" />
          </div>
          <h2 class="feedback__title">{{ title() }}</h2>
          <p class="feedback__detail">{{ detail() }}</p>
        } @else {
          <div
            class="feedback__badge"
            [class.feedback__badge--error]="state() === 'error'"
          >
            <app-icon [name]="state() === 'error' ? 'alert' : 'check'" [size]="28" />
          </div>
          <h2 class="feedback__title">{{ title() }}</h2>
          <p class="feedback__detail">{{ detail() }}</p>
          @if (question()) {
            <div class="feedback__rule"></div>
            <p class="feedback__question">{{ question() }}</p>
            <div class="feedback__actions">
              @for (action of actions(); track action.label) {
                <button
                  type="button"
                  class="feedback__button"
                  [class.feedback__button--accent]="action.tone === 'accent'"
                  (click)="choose.emit(action.label)"
                >
                  {{ action.label }}
                </button>
              }
            </div>
          } @else {
            <div class="feedback__actions">
              <button type="button" class="feedback__button feedback__button--accent" (click)="dismiss.emit()">
                Close
              </button>
            </div>
          }
        }
      </div>
    </dialog>
  `,
  styles: `
    :host { display: contents; }
    .feedback {
      max-width: none;
      max-height: none;
      padding: 0;
      border: 0;
      overflow: visible;
      background: transparent;
      color: var(--text);
    }
    .feedback::backdrop {
      background: rgb(27 25 22 / 45%);
      backdrop-filter: blur(2px);
    }
    :host-context([data-theme='dark']) .feedback::backdrop {
      background: rgb(0 0 0 / 60%);
    }
    .feedback__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: min(300px, calc(100vw - 40px));
      padding: 28px 24px;
      border: 1px solid var(--line);
      border-radius: var(--r-card);
      background: var(--surface);
      box-shadow: var(--shadow-pop);
      text-align: center;
      animation: feedback-enter 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .feedback__card--wide {
      width: min(310px, calc(100vw - 40px));
      padding: 24px 20px 20px;
    }
    .feedback__spinner {
      display: grid;
      place-items: center;
      margin-bottom: 20px;
    }
    .feedback__badge {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
      border-radius: 50%;
      background: var(--good);
      box-shadow: var(--shadow);
      color: #fff;
    }
    .feedback__badge--error {
      background: var(--bad);
    }
    :host-context([data-theme='dark']) .feedback__badge {
      color: #10241a;
    }
    .feedback__title {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .feedback__detail {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    .feedback__rule {
      width: 100%;
      height: 1px;
      margin: 16px 0;
      background: var(--line);
    }
    .feedback__question {
      margin: 0 0 14px;
      font-size: 13px;
      font-weight: 600;
    }
    .feedback__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      width: 100%;
    }
    .feedback__button {
      height: 44px;
      border: 0;
      border-radius: 14px;
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.12s ease-out, transform 0.12s ease-out;
    }
    .feedback__button:hover { filter: brightness(0.97); }
    .feedback__button:active { transform: scale(0.98); }
    .feedback__button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .feedback__button--accent {
      background: var(--ochre);
      color: #1a1405;
    }
    @keyframes feedback-enter {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .feedback__card { animation: none; }
      .feedback__button { transition: none; }
    }
  `,
})
export class FeedbackModal {
  readonly open = input(false);
  readonly state = input<FeedbackState>('processing');
  readonly title = input('');
  readonly detail = input('');
  readonly question = input('');
  readonly actions = input<FeedbackAction[]>([]);

  readonly dismiss = output<void>();
  readonly choose = output<string>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
    inject(DestroyRef).onDestroy(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (dialog?.open) dialog.close();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) this.dismiss.emit();
  }
}
