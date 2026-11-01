import { TestBed } from '@angular/core/testing';
import { ProductShot } from './product-shot';

describe('ProductShot', () => {
  it('renders relative API image paths and falls back when an image fails', () => {
    const fixture = TestBed.createComponent(ProductShot);
    fixture.componentRef.setInput('photo', 'assets/products/product_01.png');
    fixture.componentRef.setInput('label', 'Product image');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('assets/products/product_01.png');

    image?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it('keeps generated artwork for placeholder slugs', () => {
    const fixture = TestBed.createComponent(ProductShot);
    fixture.componentRef.setInput('photo', 'balm');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });
});
