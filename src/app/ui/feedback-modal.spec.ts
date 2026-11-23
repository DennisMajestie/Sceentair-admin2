import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackModal } from './feedback-modal';

describe('FeedbackModal', () => {
  let fixture: ComponentFixture<FeedbackModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FeedbackModal] }).compileComponents();
    fixture = TestBed.createComponent(FeedbackModal);
  });

  afterEach(() => fixture.destroy());

  function set(
    state: 'processing' | 'success' | 'error',
    title: string,
    detail: string,
    question = '',
  ): void {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('title', title);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('actions', [{ label: 'No, thanks' }, { label: 'Print receipt', tone: 'accent' }]);
    fixture.detectChanges();
  }

  it('shows the orbital spinner while processing', () => {
    set('processing', 'Processing payment', '₦8,400 with Cash');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.spinner-orbital')).not.toBeNull();
    expect(el.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading');
    expect(el.textContent).toContain('Processing payment');
    expect(el.textContent).toContain('₦8,400 with Cash');
    expect(el.querySelector('app-icon')).toBeNull();
  });

  it('shows the success badge, question and two actions when finished', () => {
    set('success', 'Payment successful', '₦8,400 paid via Cash', 'Would you like a receipt?');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.spinner-orbital')).toBeNull();
    expect(el.querySelector('.feedback__badge')).not.toBeNull();
    expect(el.textContent).toContain('Would you like a receipt?');
    expect(el.querySelectorAll('.feedback__button').length).toBe(2);
  });

  it('emits the chosen action label', () => {
    set('success', 'Payment successful', '₦8,400 paid via Cash', 'Would you like a receipt?');
    const emitted: string[] = [];
    (fixture.componentInstance as unknown as { choose: { subscribe: (fn: (v: string) => void) => void } })
      .choose.subscribe((value) => emitted.push(value));
    (fixture.nativeElement.querySelectorAll('.feedback__button')[1] as HTMLButtonElement).click();
    expect(emitted).toEqual(['Print receipt']);
  });
});
