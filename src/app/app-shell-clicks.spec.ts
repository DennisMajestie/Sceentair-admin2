import { ComponentFixture, TestBed } from '@angular/core/testing';
import { filter, firstValueFrom } from 'rxjs';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';
import { SdShellStateService } from './core/sd-shell-state.service';

describe('App shell sidebar interaction (full app, real router)', () => {
  let fixture: ComponentFixture<App>;
  let el: HTMLElement;
  let router: Router;

  beforeEach(async () => {
    localStorage.removeItem('sd-rail');
    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [provideRouter(routes)],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard/overview');
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement;
    const shell = TestBed.inject(SdShellStateService);
    if (shell.collapsed()) {
      shell.toggle();
      await fixture.whenStable();
      fixture.detectChanges();
    }
  });

  afterEach(() => {
    localStorage.removeItem('sd-rail');
  });

  function navDone(): Promise<NavigationEnd> {
    return firstValueFrom(
      router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    );
  }

  it('parent group links navigate to their landing pages and keep navigating', async () => {
    const groups = () => el.querySelectorAll<HTMLButtonElement>('app-sidebar .ri-group');
    expect(groups().length).toBe(9);

    const first = navDone();
    groups()[1].click(); // Products → /products/catalog
    await first;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/products/catalog');
    expect(el.querySelectorAll('app-sidebar .nav-children').length).toBe(0);

    const second = navDone();
    el.querySelectorAll<HTMLButtonElement>('app-sidebar .ri-group')[2].click(); // Orders
    await second;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/orders/all');
  });

  it('collapsed group circles navigate on click', async () => {
    const shell = TestBed.inject(SdShellStateService);
    shell.toggle(); // collapse
    await fixture.whenStable();
    fixture.detectChanges();

    const done = navDone();
    el.querySelectorAll<HTMLButtonElement>('app-sidebar .ri-group')[1].click(); // Products
    await done;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/products/catalog');
    expect(el.querySelector('app-sidebar .flyout')).toBeNull();
  });

  it('collapse toggle keeps responding across repeated clicks', async () => {
    const shell = TestBed.inject(SdShellStateService);
    const btn = () => el.querySelector<HTMLButtonElement>('app-sidebar .ri--collapse')!;
    btn().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(shell.collapsed()).toBe(true);
    btn().click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(shell.collapsed()).toBe(false);
  });
});
