import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Drawer } from './drawer';

@Component({
  imports: [Drawer],
  template: `
    <app-drawer [open]="open()" (close)="closed = true">
      <span drawerTitle>Panel title</span>
      <p>Panel body</p>
      <button drawerFooter>Done</button>
    </app-drawer>
  `,
})
class Host {
  readonly open = signal(false);
  closed = false;
}

describe('app-drawer', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.drawer');
  }

  it('renders nothing while closed', () => {
    expect(panel()).toBeNull();
  });

  it('renders the shared frame with title, body and footer when open', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const root = panel()!;
    expect(root).not.toBeNull();
    expect(root.querySelector('.drawer__title')?.textContent).toContain('Panel title');
    expect(root.querySelector('.drawer__body')?.textContent).toContain('Panel body');
    expect(root.querySelector('.drawer__footer')?.textContent).toContain('Done');
    expect(root.querySelector('.drawer__close')).not.toBeNull();
  });

  it('locks page scroll only while open', () => {
    const before = document.body.style.overflow;
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe(before);
  });

  it('emits close from the close button and from Escape', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    (panel()!.querySelector('.drawer__close') as HTMLButtonElement).click();
    expect(fixture.componentInstance.closed).toBeTrue();

    fixture.componentInstance.closed = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closed).toBeTrue();
  });
});
