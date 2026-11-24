import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

describe('Spinner component', () => {
  it('renders the three orbital arcs with an accessible label', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('label', 'Loading orders');
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading orders');
    expect(el.querySelector('.app-spinner__orbits')).not.toBeNull();
    expect(el.querySelectorAll('.app-spinner__arc').length).toBe(3);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-label')).toBe('Loading orders');
  });

  it('applies the size to the host so the SVG scales', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('app-spinner--sm');

    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('app-spinner--lg');
  });

  it('stays decorative when no label is given', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('role')).toBeNull();
    expect(el.querySelector('.app-spinner__orbits')).not.toBeNull();
  });
});
