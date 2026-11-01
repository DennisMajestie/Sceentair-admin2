import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast';
import { Icon } from './icon';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [attr.data-tone]="toast.tone">
          <app-icon [name]="toast.tone === 'bad' ? 'alert' : toast.tone === 'good' ? 'check' : 'bell'" [size]="16" />
          <span class="toast__msg">{{ toast.message }}</span>
          @if (toast.undo) {
            <button type="button" class="toast__undo" (click)="undo(toast.id)">Undo</button>
          }
          <button type="button" class="toast__x" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">
            <app-icon name="close" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 80;
      display: grid;
      gap: 10px;
      justify-items: end;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      min-width: 260px;
      max-width: 420px;
      border-radius: 14px;
      background: var(--raised);
      border: 1px solid var(--line-2);
      box-shadow: var(--shadow-pop);
      font-size: var(--fs-md);
      animation: slide 0.2s var(--ease);
    }
    .toast[data-tone='bad'] { color: var(--bad); }
    .toast[data-tone='good'] { color: var(--good); }
    .toast__msg {
      color: var(--text);
      flex: 1;
    }
    .toast__undo {
      border: none;
      background: none;
      color: var(--primary);
      font-weight: 700;
      font-size: var(--fs-sm);
      cursor: pointer;
    }
    .toast__x {
      display: grid;
      place-items: center;
      border: none;
      background: none;
      color: var(--faint);
      cursor: pointer;
    }
    @keyframes slide {
      from { opacity: 0; transform: translateX(16px); }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);

  protected undo(id: number): void {
    const toast = this.toasts.toasts().find((t) => t.id === id);
    toast?.undo?.();
    this.toasts.dismiss(id);
  }
}
