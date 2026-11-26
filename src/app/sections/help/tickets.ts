import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Spinner } from '../../ui/spinner';
import { dateFull, statusLabel, statusTone } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { HelpApiService } from '../../core/help-api.service';
import { ToastService } from '../../core/toast';

interface TicketRow {
  id: string;
  number: string;
  subject: string;
  body: string;
  reply: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  tone: string;
  label: string;
  at: string;
  actorId: string | null;
}

@Component({
  selector: 'app-help-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, Drawer, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Help</span>
        <h1 class="head__title">My tickets</h1>
        <p class="head__lead">{{ openCount().length }} open · {{ closed().length }} closed.</p>
      </div>
      <div class="head__actions">
        <button type="button" class="btn btn--primary" (click)="openNewTicket()">
          <app-icon name="plus" [size]="15" />
          New ticket
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Status filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" (click)="setFilter(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <span class="badge">{{ visible().length }} tickets</span>
    </div>

    @if (loading() && rows().length === 0) {
      <div class="load-center" role="status">
        <app-spinner size="md" label="Loading support tickets" />
      </div>
    } @else {
      <div class="grid grid--2">
        @for (t of visible(); track t.id) {
          <article class="card tcard" (click)="openTicket(t.id)">
            <div class="tcard__head">
              <span class="mono tcard__num">{{ t.number }}</span>
              <span class="badge" [class]="'badge badge--' + t.tone">{{ t.label }}</span>
            </div>
            <h2 class="tcard__subject">{{ t.subject }}</h2>
            <p class="tcard__body">{{ t.body }}</p>
            <div class="tcard__foot">
              <span class="tcard__at">{{ t.at }}</span>
            </div>
          </article>
        }
        @if (!loading() && visible().length === 0 && !error()) {
          <p class="empty">No tickets match this filter.</p>
        }
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Ticket detail">
      <ng-container drawerTitle>
        @if (selected(); as t) {
          <div class="dtitle">
            <strong class="mono">{{ t.number }}</strong>
            <span class="badge" [class]="'badge badge--' + t.tone">{{ t.label }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as t) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>Subject</dt><dd>{{ t.subject }}</dd></div>
            <div><dt>Opened</dt><dd>{{ t.at }}</dd></div>
            <div><dt>Status</dt><dd>{{ t.label }}</dd></div>
          </dl>

          <div class="dmessage">
            <span class="dmessage__who">You</span>
            <p>{{ t.body }}</p>
          </div>

          @if (t.reply) {
            <div class="dmessage dmessage--reply">
              <span class="dmessage__who">Support</span>
              <p>{{ t.reply }}</p>
            </div>
          }

          @if (t.status === 'open') {
            <button type="button" class="btn btn--primary" (click)="resolveTicket(t.id)">
              Mark resolved
            </button>
          }
          <div class="dfoot">
            <button type="button" class="btn btn--ghost" (click)="close()">Close ticket</button>
          </div>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New ticket">
      <ng-container drawerTitle><div class="dtitle"><strong>New ticket</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createTicket()">
        <label class="field"><span class="field__label">Subject</span>
          <input type="text" [(ngModel)]="createForm.subject" name="subject" required />
        </label>
        <label class="field"><span class="field__label">Description</span>
          <textarea rows="5" [(ngModel)]="createForm.body" name="body" required></textarea>
        </label>
        @if (createError()) { <p class="notice notice--error" role="alert">{{ createError() }}</p> }
        <div class="dfoot">
          <button class="btn btn--primary" type="submit" [disabled]="createBusy() || !createForm.subject.trim() || !createForm.body.trim()">
            {{ createBusy() ? 'Submitting…' : 'Submit ticket' }}
          </button>
          <button class="btn btn--ghost" type="button" (click)="closeCreate()">Cancel</button>
        </div>
      </form>
    </app-drawer>
  `,
  styles: `
    .grid { margin-bottom: var(--gap); }
    .tcard { display: grid; gap: 8px; cursor: pointer; }
    .tcard__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tcard__num { font-size: var(--fs-sm); font-weight: 700; color: var(--muted); }
    .tcard__subject { font-size: var(--fs-lg); font-weight: 700; letter-spacing: -0.015em; }
    .tcard__body { font-size: var(--fs-sm); color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tcard__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 9px; border-top: 1px solid var(--line); }
    .tcard__at { font-size: var(--fs-2xs); color: var(--faint); }
    .dmessage { display: grid; gap: 4px; padding: 12px 14px; border-radius: var(--r-tile); background: var(--surface-2); }
    .dmessage--reply { background: var(--well); }
    .dmessage__who { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--faint); }
    .dmessage p { margin: 0; font-size: var(--fs-md); line-height: 1.55; color: var(--muted); }
    .dfoot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
    .create-form { display: grid; gap: 12px; }
    .field { display: grid; gap: 5px; }
    .field input, .field textarea { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; resize: vertical; }
    .field__label { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
    .empty { color: var(--muted); font-size: var(--fs-sm); margin: 0; }
  `,
})
export class HelpTickets {
  private readonly helpApi = inject(HelpApiService);
  private readonly toasts = inject(ToastService);

  protected readonly filter = signal<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'resolved', label: 'Resolved' },
  ];

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly createBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = { subject: '', body: '' };
  protected readonly tickets = signal<{ id: string; number: string; subject: string; body: string; reply: string | null; status: 'open' | 'in_progress' | 'resolved'; createdAt: string; updatedAt: string; actorId: string | null }[]>([]);

  constructor() {
    void this.loadTickets();
  }

  private async loadTickets(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.helpApi.tickets({ page: 1, limit: 50 });
      this.tickets.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed<TicketRow[]>(() =>
    this.tickets().map((t) => ({
      id: t.id,
      number: t.number,
      subject: t.subject,
      body: t.body,
      reply: t.reply,
      status: t.status,
      tone: statusTone(t.status),
      label: statusLabel(t.status),
      at: dateFull(Date.parse(t.createdAt)),
      actorId: t.actorId,
    })),
  );

  protected readonly openCount = computed(() => this.rows().filter((t) => t.status === 'open'));
  protected readonly closed = computed(() => this.rows().filter((t) => t.status !== 'open'));

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.rows()
      .filter((t) => f === 'all' || t.status === f)
      .sort((a, b) => b.id.localeCompare(a.id));
  });

  protected readonly selected = computed(
    () => this.rows().find((t) => t.id === this.selectedId()) ?? null,
  );

  protected setFilter(id: string): void {
    this.filter.set(id as 'all' | 'open' | 'in_progress' | 'resolved');
  }

  protected openTicket(id: string): void {
    this.selectedId.set(id);
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  protected openNewTicket(): void {
    this.createForm.subject = '';
    this.createForm.body = '';
    this.createError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async createTicket(): Promise<void> {
    const { subject, body } = this.createForm;
    if (!subject.trim() || !body.trim()) {
      this.createError.set('Enter a subject and a description.');
      return;
    }
    this.createBusy.set(true);
    this.createError.set(null);
    try {
      await this.helpApi.createTicket({ subject: subject.trim(), body: body.trim() });
      this.creating.set(false);
      await this.loadTickets();
      this.toasts.show('Ticket submitted to support.', 'good');
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'The ticket could not be sent.');
    } finally {
      this.createBusy.set(false);
    }
  }

  protected resolveTicket(id: string): void {
      this.helpApi.updateTicketStatus(id, { status: 'resolved' }).then(() => {
      this.close();
      void this.loadTickets();
      this.toasts.show('Ticket marked resolved.', 'good');
    }).catch((err) => {
      this.error.set(err instanceof Error ? err.message : 'Could not update ticket.');
    });
  }
}
