import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Topbar } from './ui/topbar';
import { Sidebar } from './ui/sidebar';
import { Palette } from './ui/palette';
import { ToastHost } from './ui/toast-host';
import { SdShellStateService } from './core/sd-shell-state.service';

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
  private readonly paletteRef = viewChild(Palette);
  protected readonly mobileNav = signal(false);
  protected readonly layoutAnimated = signal(false);
  protected readonly isSignin = signal(this.router.url.startsWith('/signin'));

  protected readonly collapsed = this.state.collapsed;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.isSignin.set(e.urlAfterRedirects.startsWith('/signin'));
        // Every page load starts at the top of the document. Skip fragment links.
        if (typeof window !== 'undefined' && !e.urlAfterRedirects.includes('#')) {
          window.scrollTo(0, 0);
        }
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
