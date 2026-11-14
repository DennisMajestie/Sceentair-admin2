export function showAppPreloader(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('app-preloader');
  if (el) el.classList.remove('app-preloader--done');
}

export function hideAppPreloader(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('app-preloader');
  if (el) el.classList.add('app-preloader--done');
}