import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

describe('Spinner component', () => {
  it('renders default ring pulse spinner with accessible label', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('label', 'Loading orders');
    fixture.componentRef.setInput('size', 'md');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading orders');
    const spinner = el.querySelector('.spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('role')).toBe('status');
  });

  it('renders advanced ldrs custom elements when variant is set', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('variant', 'quantum');
    fixture.componentRef.setInput('size', 'lg');
    fixture.componentRef.setInput('color', '#bf3a2d');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const customEl = el.querySelector('l-quantum');
    expect(customEl).not.toBeNull();
    expect(customEl?.getAttribute('size')).toBe('40');
    expect(customEl?.getAttribute('color')).toBe('#bf3a2d');
  });

  it('supports helix and infinity variants', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('variant', 'helix');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();

    let el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('l-helix')).not.toBeNull();

    fixture.componentRef.setInput('variant', 'infinity');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('l-infinity')).not.toBeNull();
  });
});

