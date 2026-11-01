import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { SdShellStateService } from './sd-shell-state.service';

function setInnerWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { get: () => value, configurable: true });
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createService(innerWidth: number): SdShellStateService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      SdShellStateService,
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  setInnerWidth(innerWidth);
  return TestBed.inject(SdShellStateService);
}

describe('SdShellStateService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to expanded at viewport >= 1101px with no stored value', () => {
    const service = createService(1440);
    expect(service.collapsed()).toBeFalse();
  });

  it('defaults to collapsed at viewport <= 1100px with no stored value', () => {
    const service = createService(800);
    expect(service.collapsed()).toBeTrue();
  });

  it('persists collapsed/expanded to sd-rail and restores it', async () => {
    const service = createService(1440);
    service.collapsed.set(true);
    await tick();
    expect(localStorage.getItem('sd-rail')).toBe('collapsed');

    const restored = createService(1440);
    expect(restored.collapsed()).toBeTrue();
  });

  it('toggle() flips the collapsed signal', () => {
    const service = createService(1440);
    expect(service.collapsed()).toBeFalse();
    service.toggle();
    expect(service.collapsed()).toBeTrue();
    service.toggle();
    expect(service.collapsed()).toBeFalse();
  });

  it('falls back to width-based default when storage read throws', () => {
    spyOn(localStorage, 'getItem').and.throwError('quota');
    const service = createService(800);
    expect(service.collapsed()).toBeTrue();
  });

  it('stored value overrides width-based expanded default', async () => {
    const service = createService(1440);
    service.collapsed.set(true);
    await tick();
    const again = createService(1440);
    expect(again.collapsed()).toBeTrue();
  });
});
