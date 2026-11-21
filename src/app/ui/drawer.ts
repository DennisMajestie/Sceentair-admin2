import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  Injector,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { lockDrawerScroll, unlockDrawerScroll } from './drawer-scroll-lock';

@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="scrim" (click)="close.emit()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="label()">
        <header class="drawer__head">
          <div class="drawer__title"><ng-content select="[drawerTitle]" /></div>
          <button type="button" class="drawer__close" (click)="close.emit()" aria-label="Close panel">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div
          class="drawer__body"
          [class.drawer__body--scrolled]="scrolled()"
          (scroll)="onScroll($event)"
        >
          <ng-content />
        </div>
        <footer class="drawer__footer"><ng-content select="[drawerFooter]" /></footer>
      </aside>
    }
  `,
  styles: `
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgb(0 0 0 / 35%);
      backdrop-filter: blur(2px);
      animation: fade 0.16s var(--ease);
    }
    :host-context([data-theme='dark']) .scrim {
      background: rgb(0 0 0 / 52%);
    }
    .drawer {
      position: fixed;
      z-index: 61;
      top: 10px;
      right: 10px;
      bottom: 10px;
      width: min(440px, calc(100vw - 20px));
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 26px;
      background: var(--surface);
      box-shadow: var(--shadow-pop);
      animation: slide 0.22s var(--ease);
    }
    .drawer__head {
      display: flex;
      flex: none;
      align-items: flex-start;
      gap: 12px;
      padding: 18px 18px 14px;
    }
    .drawer__title {
      flex: 1;
      min-width: 0;
    }
    .drawer__close {
      display: grid;
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      place-items: center;
      border: 1px solid var(--primary);
      border-radius: 50%;
      background: var(--well);
      color: var(--text);
      cursor: pointer;
    }
    .drawer__close span {
      font-size: 24px;
      line-height: 1;
    }
    .drawer__close:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
    .drawer__body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0 18px 20px;
      scrollbar-width: thin;
    }
    .drawer__footer {
      flex: none;
      padding: 12px 16px;
      border-top: 1px solid var(--line);
      background: var(--surface);
      transition: box-shadow 0.2s ease;
    }
    .drawer__footer:not(:has(*)) {
      display: none;
    }
    .drawer__body--scrolled ~ .drawer__footer {
      box-shadow: 0 -8px 16px -14px var(--text);
    }
    @keyframes fade {
      from { opacity: 0; }
    }
    @keyframes slide {
      from { transform: translateX(24px); opacity: 0; }
    }
    @media (max-width: 640px) {
      .drawer {
        top: 8px;
        right: 8px;
        bottom: 8px;
        width: calc(100vw - 16px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .scrim, .drawer { animation: none; }
      .drawer__footer { transition: none; }
    }
  `,
})
export class Drawer {
  readonly open = input(false);
  readonly label = input('Details');
  /** Kept for callers that opt into the detail appearance; all drawers now share one design. */
  readonly appearance = input<'default' | 'detail'>('default');
  readonly close = output<void>();
  protected readonly scrolled = signal(false);

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private locked = false;

  constructor() {
    effect(
      () => {
        if (this.open()) {
          if (this.locked) return;
          lockDrawerScroll();
          this.locked = true;
        } else if (this.locked) {
          unlockDrawerScroll();
          this.locked = false;
        }
      },
      { injector: this.injector },
    );
    this.destroyRef.onDestroy(() => {
      if (!this.locked) return;
      unlockDrawerScroll();
      this.locked = false;
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close.emit();
  }

  protected onScroll(event: Event): void {
    this.scrolled.set((event.currentTarget as HTMLElement).scrollTop > 0);
  }
}
