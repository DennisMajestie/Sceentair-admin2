import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { gsap } from 'gsap';

export const SD_INDICATOR_FEEL: 'spring' | 'stretch' = 'stretch';
const INDICATOR_DURATION = 2.8;
/** Droplet timing: tip accelerates toward the item, then contracts onto it. */
const STRETCH_REACH = 0.26;
const STRETCH_SETTLE = 0.52;

export interface IndicatorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function findActiveIndicatorItem(
  items: readonly HTMLElement[],
  activeClass: string,
): HTMLElement | undefined {
  return items.find(
    (item) =>
      item.classList.contains(activeClass) ||
      item.getAttribute('aria-current') === 'page' ||
      item.getAttribute('aria-pressed') === 'true',
  );
}

export function stretchUnionBox(
  current: IndicatorBox,
  target: IndicatorBox,
  isHorizontal: boolean,
): IndicatorBox {
  if (isHorizontal) {
    const x = Math.min(current.x, target.x);
    return {
      x,
      y: target.y,
      width: Math.max(current.x + current.width, target.x + target.width) - x,
      height: target.height,
    };
  }

  const y = Math.min(current.y, target.y);
  return {
    x: target.x,
    y,
    width: target.width,
    height: Math.max(current.y + current.height, target.y + target.height) - y,
  };
}

export function shouldAnimateIndicator(
  hasPlaced: boolean,
  reducedMotion: boolean,
): boolean {
  return hasPlaced && !reducedMotion;
}

@Directive({
  selector: '[sdSlidingIndicator]',
  standalone: true,
})
export class SdSlidingIndicator implements AfterViewInit {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  readonly itemSelector = input.required<string>();
  readonly activeClass = input('is-on');
  readonly feel = input<'spring' | 'stretch'>(SD_INDICATOR_FEEL);
  readonly bg = input('var(--sd-dark)');
  readonly radius = input('var(--sd-r-pill)');

  private indicator?: HTMLSpanElement;
  private mutationObserver?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private context?: gsap.Context;
  private animation?: gsap.core.Animation;
  private activeItem?: HTMLElement;
  private observedItems = new Set<HTMLElement>();
  private originalPosition = '';
  private changedPosition = false;
  private hasPlaced = false;
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.zone.runOutsideAngular(() => this.destroy()));
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.zone.runOutsideAngular(() => this.initialize());
  }

  private initialize(): void {
    const container = this.element.nativeElement;
    this.originalPosition = container.style.position;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
      this.changedPosition = true;
    }

    this.indicator = document.createElement('span');
    this.indicator.className = 'sd-ind';
    Object.assign(this.indicator.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      pointerEvents: 'none',
      zIndex: '0',
      background: this.bg(),
      borderRadius: this.radius(),
      opacity: '0',
    });
    this.indicator.setAttribute('aria-hidden', 'true');
    container.prepend(this.indicator);

    this.context = gsap.context(() => {
      gsap.set(this.indicator!, { opacity: 0 });
    }, container);

    this.resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => this.move(false));
    this.resizeObserver?.observe(container);

    this.mutationObserver = new MutationObserver(() => this.onMutations());
    this.mutationObserver.observe(container, {
      attributes: true,
      subtree: true,
      childList: true,
      attributeFilter: ['class', 'aria-current', 'aria-pressed'],
    });

    this.syncObservedItems();
    this.move(false);

    const onOrientationChange = () => this.move(false);
    window.addEventListener('orientationchange', onOrientationChange);
    this.destroyRef.onDestroy(() => window.removeEventListener('orientationchange', onOrientationChange));

    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (!this.destroyed) this.move(false);
      });
    }
  }

  private onMutations(): void {
    this.syncObservedItems();
    const active = this.findActiveItem();
    if (active !== this.activeItem) this.move(true);
  }

  private syncObservedItems(): void {
    const items = new Set(
      this.element.nativeElement.querySelectorAll<HTMLElement>(this.itemSelector()),
    );
    for (const item of this.observedItems) {
      if (!items.has(item)) this.resizeObserver?.unobserve(item);
    }
    for (const item of items) {
      if (!this.observedItems.has(item)) this.resizeObserver?.observe(item);
    }
    this.observedItems = items;
  }

  private findActiveItem(): HTMLElement | undefined {
    const items = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(this.itemSelector()),
    );
    return findActiveIndicatorItem(items, this.activeClass());
  }

  private move(animate: boolean): void {
    if (!this.indicator || this.destroyed) return;

    const active = this.findActiveItem();
    if (!active) {
      this.killAnimation();
      gsap.set(this.indicator, { opacity: 0 });
      this.activeItem = undefined;
      return;
    }

    this.activeItem = active;
    const container = this.element.nativeElement;
    if (container.offsetWidth === 0 || active.offsetWidth === 0 || active.offsetHeight === 0) {
      this.killAnimation();
      gsap.set(this.indicator, { opacity: 0 });
      return;
    }

    const target: IndicatorBox = {
      x: active.offsetLeft,
      y: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
    };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!animate || !shouldAnimateIndicator(this.hasPlaced, reducedMotion)) {
      this.placeInstantly(target);
      this.hasPlaced = true;
      return;
    }

    const from: IndicatorBox = {
      x: Number(gsap.getProperty(this.indicator, 'x')),
      y: Number(gsap.getProperty(this.indicator, 'y')),
      width: Number(gsap.getProperty(this.indicator, 'width')),
      height: Number(gsap.getProperty(this.indicator, 'height')),
    };
    this.killAnimation();

    if (this.feel() === 'spring') {
      this.animation = gsap.to(this.indicator, {
        ...target,
        opacity: 1,
        duration: INDICATOR_DURATION,
        ease: 'back.out(1.7)',
        overwrite: true,
      });
    } else {
      const isHorizontal = getComputedStyle(container).flexDirection.startsWith('row');
      const union = stretchUnionBox(from, target, isHorizontal);
      this.animation = gsap
        .timeline()
        .to(this.indicator, {
          ...union,
          opacity: 1,
          duration: STRETCH_REACH,
          ease: 'power3.in',
        })
        .to(this.indicator, {
          ...target,
          duration: STRETCH_SETTLE,
          ease: 'power3.out',
        });
    }
    this.hasPlaced = true;
  }

  private placeInstantly(box: IndicatorBox): void {
    const indicator = this.indicator;
    if (!indicator) return;
    this.killAnimation();
    gsap.set(indicator, { ...box, opacity: 1 });
  }

  private killAnimation(): void {
    this.animation?.kill();
    this.animation = undefined;
    if (this.indicator) gsap.killTweensOf(this.indicator);
  }

  private destroy(): void {
    this.destroyed = true;
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.killAnimation();
    this.context?.revert();
    this.indicator?.remove();
    if (this.changedPosition) this.element.nativeElement.style.position = this.originalPosition;
  }
}
