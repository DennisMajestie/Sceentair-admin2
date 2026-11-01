import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  NgZone,
  PLATFORM_ID,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { gsap } from 'gsap';

@Component({
  selector: 'sd-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="sd-detail-dialog"
      [attr.aria-labelledby]="labelledBy()"
      (cancel)="onCancel($event)"
      (click)="onDialogClick($event)"
    >
      <div class="sd-detail-frame">
        <header class="sd-detail-header">
          <div class="sd-detail-header-content"><ng-content select="[sdDrawerHeader]" /></div>
          <button #closeButton class="sd-detail-close" type="button" aria-label="Close" (click)="requestClose()">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="sd-detail-scroll" [class.sd-detail-scroll--scrolled]="scrolled()" (scroll)="onScroll($event)">
          <ng-content select="[sdDrawerContent]" />
        </div>
        @if (showFooter()) {
          <footer class="sd-detail-footer">
            <ng-content select="[sdDrawerFooter]" />
          </footer>
        }
      </div>
    </dialog>
  `,
  styleUrl: './sd-detail-drawer.css',
})
export class SdDetailDrawerComponent implements AfterViewInit {
  readonly open = input(false);
  readonly labelledBy = input('sd-detail-title');
  readonly showFooter = input(true);
  readonly close = output<void>();
  protected readonly scrolled = signal(false);

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private animation?: gsap.core.Tween;
  private closing = false;
  private previousOverflow = '';
  private previousGutter = '';
  private hadOpenClass = false;
  private scrollLocked = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.zone.runOutsideAngular(() => this.destroy()));
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    effect(
      () => {
        const open = this.open();
        const dialog = this.dialogRef()?.nativeElement;
        if (dialog) this.zone.runOutsideAngular(() => this.syncDialog(dialog, open));
      },
      { injector: this.injector },
    );
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialogRef()?.nativeElement) this.requestClose();
  }

  protected onScroll(event: Event): void {
    this.scrolled.set((event.currentTarget as HTMLElement).scrollTop > 0);
  }

  protected requestClose(): void {
    this.zone.runOutsideAngular(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog?.open || this.closing) return;
      this.closing = true;
      this.animate(dialog, false, () => {
        this.finishClose(dialog);
        this.zone.run(() => this.close.emit());
      });
    });
  }

  private syncDialog(dialog: HTMLDialogElement, open: boolean): void {
    if (open) {
      if (dialog.open) {
        this.closing = false;
        return;
      }
      dialog.showModal();
      this.lockScroll();
      this.closeButton()?.nativeElement.focus();
      this.animate(dialog, true);
      return;
    }
    if (dialog.open && !this.closing) {
      this.closing = true;
      this.animate(dialog, false, () => this.finishClose(dialog));
    }
  }

  private animate(dialog: HTMLDialogElement, open: boolean, complete?: () => void): void {
    this.animation?.kill();
    this.animation = undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(dialog, { x: 0, opacity: open ? 1 : 0 });
      complete?.();
      return;
    }
    this.animation = open
      ? gsap.fromTo(
          dialog,
          { x: 24, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.3, ease: 'power3.out', overwrite: true },
        )
      : gsap.to(dialog, {
          x: 24,
          opacity: 0,
          duration: 0.22,
          ease: 'power2.in',
          overwrite: true,
          onComplete: complete,
        });
    if (open) this.animation.eventCallback('onComplete', complete ?? null);
  }

  private lockScroll(): void {
    if (this.scrollLocked) return;
    const root = document.documentElement;
    this.previousOverflow = document.body.style.overflow;
    this.previousGutter = root.style.scrollbarGutter;
    this.hadOpenClass = root.classList.contains('sd-detail-open');
    root.classList.add('sd-detail-open');
    document.body.style.overflow = 'hidden';
    root.style.scrollbarGutter = 'stable';
    this.scrollLocked = true;
  }

  private finishClose(dialog: HTMLDialogElement): void {
    if (dialog.open) dialog.close();
    this.unlockScroll();
    this.closing = false;
    this.scrolled.set(false);
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) return;
    document.body.style.overflow = this.previousOverflow;
    const root = document.documentElement;
    root.style.scrollbarGutter = this.previousGutter;
    if (!this.hadOpenClass) root.classList.remove('sd-detail-open');
    this.scrollLocked = false;
  }

  private destroy(): void {
    this.animation?.kill();
    this.animation = undefined;
    const dialog = this.dialogRef()?.nativeElement;
    if (dialog?.open) dialog.close();
    if (this.isBrowser) this.unlockScroll();
  }
}
