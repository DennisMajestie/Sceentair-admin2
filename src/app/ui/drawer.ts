import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (open()) {
      <div class="scrim" (click)="close.emit()"></div>
      <aside
        class="drawer"
        [class.drawer--detail]="appearance() === 'detail'"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="label()"
      >
        <header class="drawer__head">
          <div class="drawer__title">
            <ng-content select="[drawerTitle]"></ng-content>
          </div>
          <button type="button" class="iconbtn" (click)="close.emit()" aria-label="Close panel">
            <app-icon name="close" [size]="16" />
          </button>
        </header>
        <div class="drawer__body">
          <ng-content></ng-content>
        </div>
      </aside>
    }
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgb(20 36 28 / 35%);
      backdrop-filter: blur(2px);
      animation: fade 0.16s var(--ease);
    }
    :host-context([data-theme='dark']) .scrim {
      background: rgb(0 0 0 / 52%);
    }
    .drawer {
      position: fixed;
      z-index: 61;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(560px, 96vw);
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-left: 1px solid var(--line-2);
      box-shadow: var(--shadow-pop);
      animation: slide 0.22s var(--ease);
    }
    .drawer--detail {
      top: 10px;
      right: 10px;
      bottom: 10px;
      width: min(440px, calc(100vw - 20px));
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 24px;
    }
    .drawer--detail .drawer__head {
      gap: 10px;
      padding: 11px 12px 8px 14px;
      border-bottom: 0;
    }
    .drawer--detail .drawer__body {
      padding: 0 14px 14px;
      scrollbar-width: thin;
    }
    .drawer__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
    }
    .drawer__title {
      flex: 1;
      min-width: 0;
    }
    .drawer__body {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
    }
    .iconbtn {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 1px solid var(--line-2);
      background: var(--raised);
      color: var(--muted);
      cursor: pointer;
    }
    @keyframes fade {
      from { opacity: 0; }
    }
    @keyframes slide {
      from { transform: translateX(24px); opacity: 0; }
    }
    @media (max-width: 640px) {
      .drawer--detail {
        top: 8px;
        right: 8px;
        bottom: 8px;
        width: calc(100vw - 16px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .scrim, .drawer { animation: none; }
    }
  `,
})
export class Drawer {
  readonly open = input(false);
  readonly label = input('Details');
  readonly appearance = input<'default' | 'detail'>('default');
  readonly close = output<void>();
}
