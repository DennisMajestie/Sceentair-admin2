let active = 0;
let previousOverflow = '';
let previousGutter = '';
let hadOpenClass = false;

/** Reference-counted so overlapping drawers cannot unlock the page too early. */
export function lockDrawerScroll(): void {
  if (typeof document === 'undefined' || active++ > 0) return;
  const root = document.documentElement;
  previousOverflow = document.body.style.overflow;
  previousGutter = root.style.scrollbarGutter;
  hadOpenClass = root.classList.contains('sd-detail-open');
  root.classList.add('sd-detail-open');
  document.body.style.overflow = 'hidden';
  root.style.scrollbarGutter = 'stable';
}

export function unlockDrawerScroll(): void {
  if (typeof document === 'undefined' || active === 0 || --active > 0) return;
  const root = document.documentElement;
  document.body.style.overflow = previousOverflow;
  root.style.scrollbarGutter = previousGutter;
  if (!hadOpenClass) root.classList.remove('sd-detail-open');
}
