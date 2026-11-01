import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Sidebar } from './sidebar';
import { SdShellStateService } from '../core/sd-shell-state.service';
import { ThemeService } from '../core/theme';
import { NAV } from '../core/nav';

describe('Sidebar buttons', () => {
  let fixture: ComponentFixture<Sidebar>;
  let el: HTMLElement;
  let shell: SdShellStateService;
  let theme: ThemeService;

  beforeEach(async () => {
    localStorage.removeItem('sd-rail');
    await TestBed.configureTestingModule({
      imports: [Sidebar, HttpClientTestingModule],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Sidebar);
    el = fixture.nativeElement;
    fixture.detectChanges();
    shell = TestBed.inject(SdShellStateService);
    theme = TestBed.inject(ThemeService);
    if (shell.collapsed()) shell.toggle();
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('sd-rail');
  });

  function button(selector: string, index = 0): HTMLButtonElement {
    const found = el.querySelectorAll<HTMLButtonElement>(selector);
    expect(found.length).toBeGreaterThan(0);
    expect(found[index]).toBeTruthy();
    return found[index];
  }

  it('collapse button flips the shell state both ways', () => {
    const btn = button('.ri--collapse');
    const before = shell.collapsed();
    btn.click();
    fixture.detectChanges();
    expect(shell.collapsed()).toBe(!before);
  });

  it('theme buttons switch light and dark modes', () => {
    button('button[aria-label="Light mode"]').click();
    fixture.detectChanges();
    expect(theme.resolved()).toBe('light');

    button('button[aria-label="Dark mode"]').click();
    fixture.detectChanges();
    expect(theme.resolved()).toBe('dark');
  });

  it('renders exactly one parent link per nav section', () => {
    const groups = el.querySelectorAll<HTMLButtonElement>('.ri-group');
    expect(groups.length).toBe(NAV.length);
    expect(groups[1].textContent).toContain('Products');
  });

  it('shows no child links and no flyout anywhere', () => {
    expect(el.querySelector('.nav-children')).toBeNull();
    expect(el.querySelector('.flyout')).toBeNull();
    expect(el.querySelector('.nav-child__dot')).toBeNull();
  });

  it('group rows highlight their active section', () => {
    const groups = el.querySelectorAll<HTMLButtonElement>('.ri-group');
    const dash = groups[0];
    expect(dash.textContent).toContain('Dashboard');
  });
});
