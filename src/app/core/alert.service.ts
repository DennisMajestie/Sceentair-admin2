import { Injectable } from '@angular/core';

export type WipAlertTone = 'success' | 'neutral' | 'error';

export interface AlertOptions {
  title: string;
  message: string;
  tone?: WipAlertTone;
  question?: string;
  showCancel?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

export interface AlertResult {
  confirmed: boolean;
  reason: string;
}

let nextId = 0;

const ALERT_CSS = `
.sd-alert{position:fixed;inset:0;margin:auto;width:min(100% - 32px,310px);max-width:none;max-height:calc(100dvh - 32px);padding:0;border:0;background:transparent;color:var(--text,#1b1916);overflow:visible;z-index:2147483647}
.sd-alert::backdrop{background:rgba(23,20,17,.55)}
.sd-alert__card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 20px 20px;border:1px solid var(--line,#e8e1d3);border-radius:22px;background:var(--surface,#fffdf9);box-shadow:0 20px 48px -8px rgba(27,25,22,.22)}
.sd-alert__disc{display:grid;place-items:center;width:56px;height:56px;margin-bottom:16px;border-radius:999px;background:var(--good,#23804d);color:#fff;font:700 24px/1 sans-serif}
.sd-alert--error .sd-alert__disc{background:var(--bad,#bf3a2d)}
.sd-alert--neutral .sd-alert__disc{background:var(--warn,#93600a)}
.sd-alert__disc svg{width:28px;height:28px}
.sd-alert__title{margin:0;font-size:17px;font-weight:700;color:var(--text,#1b1916)}
.sd-alert__message{margin:4px 0 0;font-size:13px;color:var(--muted,#7b756a)}
.sd-alert__divider{width:100%;height:1px;margin:16px 0;background:var(--line,#e8e1d3)}
.sd-alert__question{margin:0 0 12px;font-size:13px;font-weight:600;color:var(--text,#1b1916)}
.sd-alert__reason{display:grid;gap:6px;width:100%;margin:0 0 14px;text-align:left;font-size:12px;font-weight:600;color:var(--muted,#7b756a)}
.sd-alert__reason textarea{width:100%;min-height:76px;padding:10px 12px;border:1px solid var(--line,#e8e1d3);border-radius:12px;background:var(--surface,#fffdf9);color:var(--text,#1b1916);font:inherit;font-size:13px;resize:vertical}
.sd-alert__reason textarea:focus-visible{outline:2px solid var(--primary,#c88a12);outline-offset:2px}
.sd-alert__actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.sd-alert__btn{min-height:44px;padding:0 16px;border:1px solid transparent;border-radius:14px;font-size:13px;font-weight:650;cursor:pointer}
.sd-alert__btn:focus-visible{outline:2px solid var(--primary,#c88a12);outline-offset:2px}
.sd-alert__btn--quiet{background:var(--well,#f2ece0);color:var(--text,#1b1916);border-color:var(--line,#e8e1d3)}
.sd-alert__btn--primary{background:var(--primary,#c88a12);color:#1a1405}
.sd-alert__btn--wide{width:100%;margin-top:16px}
@media(prefers-reduced-motion:reduce){.sd-alert *{animation:none!important}}
`;

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('sd-alert-styles')) return;
  const style = document.createElement('style');
  style.id = 'sd-alert-styles';
  style.textContent = ALERT_CSS;
  document.head.append(style);
}

function openDialog(dialog: HTMLDialogElement): void {
  try {
    if (!dialog.open) dialog.showModal();
  } catch {
    dialog.setAttribute('open', '');
  }
}

/** Reusable outcome modal (native dialog, focus-trapped) for Vessa screens. */
@Injectable({ providedIn: 'root' })
export class AlertService {
  show(options: AlertOptions): Promise<boolean> {
    return this.present(options, false).then((result) => result.confirmed);
  }

  /** Same card, with an audit-reason field and the entered reason in the result. */
  showWithReason(options: AlertOptions): Promise<AlertResult> {
    return this.present(options, true);
  }

  private present(options: AlertOptions, collectReason: boolean): Promise<AlertResult> {
    if (typeof document === 'undefined') return Promise.resolve({ confirmed: false, reason: '' });
    ensureStyles();
    const id = `sd-alert-${++nextId}`;
    const tone = options.tone ?? 'success';
    const dialog = document.createElement('dialog');
    dialog.className = `sd-alert sd-alert--${tone}`;
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-message`);

    const card = document.createElement('div');
    card.className = 'sd-alert__card';
    const disc = document.createElement('div');
    disc.className = 'sd-alert__disc';
    disc.innerHTML =
      tone === 'success'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : `<span aria-hidden="true">${tone === 'error' ? '!' : 'i'}</span>`;
    const title = document.createElement('h2');
    title.className = 'sd-alert__title';
    title.id = `${id}-title`;
    title.textContent = options.title;
    const message = document.createElement('p');
    message.className = 'sd-alert__message';
    message.id = `${id}-message`;
    message.textContent = options.message;
    card.append(disc, title, message);

    let reasonInput: HTMLTextAreaElement | null = null;
    if (collectReason) {
      const label = document.createElement('label');
      label.className = 'sd-alert__reason';
      label.textContent = options.reasonLabel ?? 'Reason (audit)';
      reasonInput = document.createElement('textarea');
      reasonInput.placeholder = options.reasonPlaceholder ?? 'Required';
      reasonInput.maxLength = 300;
      label.append(reasonInput);
      card.append(label);
    }

    if (options.question || options.showCancel) {
      if (options.question) {
        const divider = document.createElement('div');
        divider.className = 'sd-alert__divider';
        const question = document.createElement('p');
        question.className = 'sd-alert__question';
        question.textContent = options.question;
        card.append(divider, question);
      }

      const actions = document.createElement('div');
      actions.className = 'sd-alert__actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'sd-alert__btn sd-alert__btn--quiet';
      cancel.textContent = options.cancelLabel ?? 'No, thanks';
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'sd-alert__btn sd-alert__btn--primary';
      confirm.textContent = options.confirmLabel ?? 'Continue';
      actions.append(cancel, confirm);
      card.append(actions);

      return new Promise<AlertResult>((resolve) => {
        const finish = (confirmed: boolean) => {
          dialog.close();
          dialog.remove();
          resolve({ confirmed, reason: reasonInput?.value.trim() ?? '' });
        };
        const accept = () => {
          if (collectReason && reasonInput && !reasonInput.value.trim()) {
            reasonInput.focus();
            return;
          }
          finish(true);
        };
        cancel.addEventListener('click', () => finish(false));
        confirm.addEventListener('click', accept);
        dialog.addEventListener('cancel', (event) => {
          event.preventDefault();
          finish(false);
        });
        dialog.append(card);
        document.body.append(dialog);
        (reasonInput ?? cancel).focus();
        openDialog(dialog);
      });
    }

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'sd-alert__btn sd-alert__btn--primary sd-alert__btn--wide';
    done.textContent = options.confirmLabel ?? 'Done';
    card.append(done);

    return new Promise<AlertResult>((resolve) => {
      const finish = (confirmed: boolean) => {
        dialog.close();
        dialog.remove();
        resolve({ confirmed, reason: reasonInput?.value.trim() ?? '' });
      };
      done.addEventListener('click', () => {
        if (collectReason && reasonInput && !reasonInput.value.trim()) {
          reasonInput.focus();
          return;
        }
        finish(true);
      });
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(false);
      });
      dialog.append(card);
      document.body.append(dialog);
      (reasonInput ?? done).focus();
      dialog.showModal();
    });
  }
}
