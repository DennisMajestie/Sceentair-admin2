import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import {
  findActiveIndicatorItem,
  SdSlidingIndicator,
  shouldAnimateIndicator,
  stretchUnionBox,
} from './sliding-indicator';

@Component({
  standalone: true,
  imports: [SdSlidingIndicator],
  template: `
    <div class="indicator-container" sdSlidingIndicator itemSelector=".item" feel="spring">
      <button
        class="item"
        [class.is-on]="active === 'first'"
        [attr.aria-pressed]="active === 'first'"
      >
        First
      </button>
      <button
        class="item"
        [class.is-on]="active === 'second'"
        [attr.aria-pressed]="active === 'second'"
      >
        Second
      </button>
    </div>
  `,
  styles: `
    .indicator-container { display: flex; width: 220px; }
    .item { box-sizing: border-box; width: 100px; height: 40px; }
  `,
})
class IndicatorTestHost {
  active = 'first';
}

describe('sliding indicator', () => {
  let fixture: ComponentFixture<IndicatorTestHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IndicatorTestHost] });
    fixture = TestBed.createComponent(IndicatorTestHost);
  });

  afterEach(() => {
    fixture.destroy();
    gsap.globalTimeline.clear();
  });

  it('detects active items from class and ARIA attribute state', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    first.classList.add('is-on');
    second.setAttribute('aria-current', 'page');

    expect(findActiveIndicatorItem([first, second], 'is-on')).toBe(first);
    first.classList.remove('is-on');
    expect(findActiveIndicatorItem([first, second], 'is-on')).toBe(second);

    second.removeAttribute('aria-current');
    second.setAttribute('aria-pressed', 'true');
    expect(findActiveIndicatorItem([first, second], 'is-on')).toBe(second);
  });

  it('moves the indicator when active state attributes change', async () => {
    const tweenSpy = spyOn(gsap, 'to').and.callThrough();
    fixture.detectChanges();
    const host = fixture.componentInstance;
    host.active = 'second';
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tweenSpy).toHaveBeenCalled();
    expect(tweenSpy).toHaveBeenCalledWith(
      jasmine.any(HTMLElement),
      jasmine.objectContaining({ duration: 2.8 }),
    );
    expect(fixture.nativeElement.querySelector('.sd-ind')).toBeTruthy();
  });

  it('calculates stretch union boxes along either axis', () => {
    const current = { x: 10, y: 20, width: 30, height: 40 };
    const target = { x: 80, y: 100, width: 50, height: 60 };

    expect(stretchUnionBox(current, target, true)).toEqual({
      x: 10,
      y: 100,
      width: 120,
      height: 60,
    });
    expect(stretchUnionBox(current, target, false)).toEqual({
      x: 80,
      y: 20,
      width: 50,
      height: 140,
    });
  });

  it('uses instant placement before the first move and when reduced motion is enabled', async () => {
    const tweenSpy = spyOn(gsap, 'to').and.callThrough();
    spyOn(window, 'matchMedia').and.callFake(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    fixture.detectChanges();
    expect(tweenSpy).not.toHaveBeenCalled();
    const indicator = fixture.nativeElement.querySelector('.sd-ind') as HTMLElement;
    expect(Number(gsap.getProperty(indicator, 'width'))).toBe(100);

    fixture.componentInstance.active = 'second';
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tweenSpy).not.toHaveBeenCalled();
  });

  it('disconnects observers and removes the indicator on destroy', () => {
    const mutationDisconnect = spyOn(MutationObserver.prototype, 'disconnect').and.callThrough();
    const resizeDisconnect =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();
    fixture.detectChanges();
    const container = fixture.nativeElement.querySelector('.indicator-container') as HTMLElement;
    expect(container.querySelector('.sd-ind')).toBeTruthy();

    fixture.destroy();

    expect(mutationDisconnect).toHaveBeenCalled();
    if (resizeDisconnect) expect(resizeDisconnect).toHaveBeenCalled();
    expect(container.querySelector('.sd-ind')).toBeNull();
  });

  it('skips animation for initial placement and reduced motion', () => {
    expect(shouldAnimateIndicator(false, false)).toBeFalse();
    expect(shouldAnimateIndicator(true, true)).toBeFalse();
    expect(shouldAnimateIndicator(true, false)).toBeTrue();
  });
});
