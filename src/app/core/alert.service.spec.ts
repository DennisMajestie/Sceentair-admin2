import { TestBed } from '@angular/core/testing';
import { AlertService } from './alert.service';

describe('AlertService', () => {
  let alerts: AlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    alerts = TestBed.inject(AlertService);
  });

  afterEach(() => {
    document.querySelectorAll('dialog.sd-alert').forEach((d) => d.remove());
  });

  it('shows a visible confirmation card with the warning title and two actions', async () => {
    const pending = alerts.show({
      title: 'Sign out?',
      message: "You'll need to sign back in to access the dashboard.",
      tone: 'neutral',
      showCancel: true,
      cancelLabel: 'Cancel',
      confirmLabel: 'Sign out',
    });

    const dialog = document.querySelector<HTMLDialogElement>('dialog.sd-alert');
    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBeTrue();
    expect(dialog?.textContent).toContain('Sign out?');
    expect(dialog?.querySelectorAll('button').length).toBe(2);
    expect(document.getElementById('sd-alert-styles')).not.toBeNull();

    dialog?.querySelector<HTMLButtonElement>('.sd-alert__btn--quiet')?.click();
    await expectAsync(pending).toBeResolvedTo(false);
    expect(document.querySelector('dialog.sd-alert')).toBeNull();
  });
});
