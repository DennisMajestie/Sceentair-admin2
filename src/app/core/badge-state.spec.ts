import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BadgeStateService } from './badge-state';

describe('BadgeStateService', () => {
  let service: BadgeStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BadgeStateService);
  });

  it('counts items above the seen baseline', () => {
    expect(service.unseen('alerts', 3)).toBe(3);
    service.view('alerts', 3);
    expect(service.unseen('alerts', 3)).toBe(0);
    expect(service.unseen('alerts', 5)).toBe(2);
  });

  it('does not write a signal while a badge is read reactively', () => {
    service.view('alerts', 10);
    const badge = computed(() => service.unseen('alerts', 4));
    expect(badge()).toBe(0);
  });

  it('re-anchors a dropped baseline after rendering', async () => {
    service.view('alerts', 10);
    expect(service.unseen('alerts', 4)).toBe(0);
    await Promise.resolve();
    expect(service.unseen('alerts', 4)).toBe(0);
    expect(service.unseen('alerts', 7)).toBe(3);
  });
});
