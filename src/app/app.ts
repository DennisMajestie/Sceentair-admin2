import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime } from 'rxjs';
import { Topbar } from './ui/topbar';
import { Sidebar } from './ui/sidebar';
import { Palette } from './ui/palette';
import { ToastHost } from './ui/toast-host';
import { hideAppPreloader } from './core/app-preloader';
import { SdShellStateService } from './core/sd-shell-state.service';
import { ApiSession } from './core/api-session';
import { RealtimeService } from './core/realtime.service';
import { Store } from './core/store';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Topbar, Sidebar, Palette, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly state = inject(SdShellStateService);
  private readonly session = inject(ApiSession);
  private readonly realtime = inject(RealtimeService);
  private readonly store = inject(Store);
  private readonly paletteRef = viewChild(Palette);
  private readonly layoutRef = viewChild<ElementRef<HTMLElement>>('layoutEl');
  protected readonly mobileNav = signal(false);
  protected readonly layoutAnimated = signal(false);
  protected readonly isSignin = signal(true);
  protected readonly resolved = signal(false);

  protected readonly collapsed = this.state.collapsed;
  protected readonly realtimeStatus = this.realtime.status;

  constructor() {
    effect(() => this.realtime.connect(this.session.accessToken()));
    this.realtime.adminDataChanged
      .pipe(auditTime(250), takeUntilDestroyed())
      .subscribe(() => void this.store.load());

    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd) {
        const onSignin = e.urlAfterRedirects.startsWith('/signin');
        this.isSignin.set(onSignin);
        if (!this.resolved()) this.resolved.set(true);
        // Reset scroll on navigation (layout scroll container).
        if (!e.urlAfterRedirects.includes('#')) {
          this.layoutRef()?.nativeElement.scrollTo?.({ top: 0, left: 0 });
        }
        if (onSignin) hideAppPreloader();
      }
      if (!(e instanceof NavigationStart)) return;
      const seg = (u: string) => (u || '').split('?')[0].split('/')[1] ?? '';
      if (seg(e.url) && seg(e.url) === seg(this.router.url)) {
        document.documentElement.classList.add('vt-side');
      } else {
        document.documentElement.classList.remove('vt-side');
      }
    });

    // Only enable the width transition after the first paint so the initial
    // render never animates. Two nested requestAnimationFrames.
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          this.layoutAnimated.set(true);
        });
      });
    }
  }

  protected togglePalette(): void {
    this.paletteRef()?.toggle();
  }
}
