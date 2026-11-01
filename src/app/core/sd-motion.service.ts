import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';

@Injectable({ providedIn: 'root' })
export class SdMotionService {
  private zone = inject(NgZone);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private shown = new WeakMap<HTMLElement, number>();

  outside<T>(fn: () => T): T {
    return this.zone.runOutsideAngular(fn);
  }

  countTo(
    el: HTMLElement,
    to: number,
    fmt: (n: number) => string,
    opts: { tl?: gsap.core.Timeline; position?: number | string; duration?: number; from?: number } = {},
  ) {
    const from = opts.from ?? this.shown.get(el) ?? 0;
    const o = { v: from };
    const vars: gsap.TweenVars = {
      v: to,
      duration: opts.duration ?? 1.4,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmt(o.v);
        this.shown.set(el, o.v);
      },
      onComplete: () => {
        el.textContent = fmt(to);
        this.shown.set(el, to);
      },
    };
    return opts.tl ? opts.tl.to(o, vars, opts.position) : gsap.to(o, vars);
  }

  setFinal(el: HTMLElement, to: number, fmt: (n: number) => string) {
    el.textContent = fmt(to);
    this.shown.set(el, to);
  }
}
