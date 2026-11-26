import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { count as fmtCount, relative as fmtRelative, titleCase } from '../../core/format';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast';
import {
  MessagingApiService,
  type ApiConversation,
  type ApiConversationDetail,
} from '../../core/messaging-api.service';
import { Drawer } from '../../ui/drawer';
import { Spinner } from '../../ui/spinner';

export interface InboxThread {
  id: string;
  who: string;
  channel: string;
  status: string;
  unread: number;
  preview: string;
  lastMessageAt: string | null;
  relatedOrderId: string | null;
  subject: string | null;
}

export function threadFrom(c: ApiConversation): InboxThread {
  return {
    id: c.id,
    who: c.customerName || c.guestName || c.guestEmail || c.guestPhone || 'Customer',
    channel: chatChannelLabel(c.channel),
    status: c.status,
    unread: c.unreadStaff,
    preview: c.lastMessagePreview ?? '',
    lastMessageAt: c.lastMessageAt,
    relatedOrderId: c.relatedOrderId,
    subject: c.subject,
  };
}

export function chatChannelLabel(channel: string): string {
  if (channel === 'in_platform') return 'In-app';
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'sms') return 'SMS';
  if (channel === 'email') return 'Email';
  return titleCase(channel);
}

export function statusMeaning(status: string): { label: string; tone: string } {
  if (status === 'open') return { label: 'Open', tone: 'info' };
  if (status === 'pending') return { label: 'Waiting on reply', tone: 'warn' };
  return { label: 'Closed', tone: '' };
}

const MACROS = [
  { label: 'Send tracking', text: 'Your order is with the courier. We will share the live tracking link as soon as it is dispatched.' },
  { label: 'Size exchange', text: 'Size exchanges follow the returns window: request within 12 hours of receipt and we will guide you through the swap.' },
  { label: 'Payment reminder', text: 'Your order is reserved and awaiting full payment; it ships as soon as payment is confirmed.' },
];

function errorText(err: unknown, fallback: string): string {
  const raw = err as { error?: { message?: unknown }; message?: unknown };
  const text = raw?.error?.message ?? raw?.message;
  return typeof text === 'string' && text ? text : fallback;
}

@Component({
  selector: 'app-conversations-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Drawer, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Support</span>
        <h1 class="head__title">Conversations</h1>
        <p class="head__lead">
          One inbox for in-app chat, WhatsApp, SMS and email replies. Opening a thread marks it read.
        </p>
      </div>
    </div>

    <section class="kpis">
      <article class="card kpi">
        <span class="stat__label">Conversations</span>
        <span class="kpi__value">{{ count(threads().length) }}</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Unread</span>
        <span class="kpi__value">{{ count(unread()) }}</span>
        <span class="kpi__meta">waiting for a reply</span>
      </article>
      <article class="card kpi">
        <span class="stat__label">Open</span>
        <span class="kpi__value">{{ count(open()) }}</span>
      </article>
    </section>

    <div class="toolbar">
      <label class="search">
        <input type="search" placeholder="Search conversations" [(ngModel)]="query" name="query" />
      </label>
      <select [ngModel]="filter" name="filter" aria-label="Conversation filter" (ngModelChange)="filter = $event; load()">
        <option value="all">All conversations</option>
        <option value="unread">Unread</option>
        <option value="open">Open</option>
        <option value="pending">Waiting on reply</option>
        <option value="closed">Closed</option>
      </select>
    </div>

    <div class="card table-wrap">
      <table>
        <thead>
          <tr><th>Customer</th><th>Channel</th><th>Status</th><th>Unread</th><th>Preview</th><th>Last activity</th><th></th></tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr><td colspan="7"><div class="loading"><app-spinner size="md" label="Loading conversations" /></div></td></tr>
          }
          @for (row of rows(); track row.id) {
            <tr>
              <td><strong>{{ row.who }}</strong><span class="sub">{{ row.subject || 'No subject' }}</span></td>
              <td>{{ row.channel }}</td>
              <td><span class="badge" [class.badge--warn]="statusMeaning(row.status).tone === 'warn'">{{ statusMeaning(row.status).label }}</span></td>
              <td>{{ row.unread > 0 ? row.unread : '—' }}</td>
              <td class="preview">{{ row.preview || '—' }}</td>
              <td>{{ row.lastMessageAt ? ago(row.lastMessageAt!) : '—' }}</td>
              <td><button type="button" class="btn btn--ghost btn--xs" (click)="selectThread(row)">Open</button></td>
            </tr>
          }
          @if (!loading() && rows().length === 0 && !error()) {
            <tr><td colspan="7" class="empty">No conversations match this view.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }} <button type="button" class="btn btn--xs" (click)="load()">Retry</button></div>
    }

    <app-drawer [open]="!!selectedId()" (close)="close()" label="Conversation">
      <ng-container drawerTitle>
        @if (thread(); as t) {
          <div class="dtitle"><strong>{{ t.who }}</strong><span class="sub">{{ t.channel }} · {{ statusMeaning(t.status).label }}</span></div>
        }
      </ng-container>
      @if (detail(); as d) {
        <div class="dbody">
          @if (d.conversation.relatedOrderId) {
            <p class="order-link">About order <a [routerLink]="['/orders/all', d.conversation.relatedOrderId]">#{{ d.conversation.relatedOrderId.slice(0, 8).toUpperCase() }}</a></p>
          }
          <ol class="thread">
            @for (m of d.messages; track m.id) {
              <li class="bubble" [class.bubble--out]="m.direction === 'out'">
                <span class="bubble__author">{{ m.authorName || (m.direction === 'out' ? 'You' : 'Customer') }}</span>
                <span class="bubble__body">{{ m.body }}</span>
                <span class="bubble__meta">{{ ago(m.createdAt) }} @if (m.direction === 'out' && m.readAt) { · read }</span>
              </li>
            }
            @if (d.messages.length === 0) {
              <li class="empty">No messages yet.</li>
            }
          </ol>

          @if (canReply() && d.conversation.status !== 'closed') {
            <form class="dform" (ngSubmit)="send()">
              <label class="field"><span class="field__label">Reply</span><textarea rows="4" [(ngModel)]="draft" name="draft"></textarea></label>
              @if (draftError()) { <span class="field-error" role="alert">{{ draftError() }}</span> }
              <div class="macros" role="group" aria-label="Starter replies">
                @for (macro of macros; track macro.label) {
                  <button type="button" class="btn btn--ghost btn--xs" (click)="applyMacro(macro.text)">{{ macro.label }}</button>
                }
              </div>
              <div class="dform__actions"><button type="submit" class="btn btn--primary" [disabled]="sending()">{{ sending() ? 'Sending…' : 'Send reply' }}</button></div>
            </form>
          } @else if (!canReply()) {
            <div class="notice notice--info" role="status">Your role can read conversations but not reply.</div>
          } @else {
            <div class="notice notice--info" role="status">This conversation is closed.</div>
          }

          @if (canReply()) {
            <div class="dform__actions">
              <button type="button" class="btn btn--ghost" (click)="toggleStatus(d)">
                {{ d.conversation.status === 'closed' ? 'Reopen' : 'Close' }} conversation
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="loading"><app-spinner size="md" label="Loading conversation" /></div>
      }
    </app-drawer>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-3xl); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    .kpi__meta, .sub { font-size: var(--fs-2xs); color: var(--faint); }
    .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: var(--gap); }
    .search input { padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); }
    .toolbar select { padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); vertical-align: top; }
    th { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); }
    .preview { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { color: var(--muted); text-align: center; }
    .loading { display: flex; justify-content: center; padding: 30px 0; }
    .notice { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); margin: var(--gap) 0; }
    .notice--error { color: var(--bad); border-color: var(--bad); }
    .notice--info { color: var(--primary); border-color: var(--primary); margin: 0; }
    .order-link { font-size: var(--fs-sm); }
    .thread { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .bubble { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--well); }
    .bubble--out { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
    .bubble__author { font-size: var(--fs-2xs); font-weight: 700; color: var(--faint); }
    .bubble__body { font-size: var(--fs-sm); white-space: pre-wrap; }
    .bubble__meta { font-size: var(--fs-2xs); color: var(--faint); }
    .dform { display: grid; gap: 12px; }
    .field { display: grid; gap: 5px; }
    .field textarea { padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-family: inherit; }
    .field-error { color: var(--bad); font-size: var(--fs-xs); }
    .macros { display: flex; flex-wrap: wrap; gap: 8px; }
    .dform__actions { display: flex; justify-content: flex-end; }
  `,
})
export class ConversationsInbox {
  private readonly api = inject(MessagingApiService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly count = fmtCount;
  protected readonly ago = (iso: string): string => fmtRelative(Date.parse(iso) || 0);
  protected readonly statusMeaning = statusMeaning;
  protected readonly macros = MACROS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly threads = signal<InboxThread[]>([]);
  protected readonly total = signal(0);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly detail = signal<ApiConversationDetail | null>(null);
  protected readonly sending = signal(false);
  protected readonly draftError = signal<string | null>(null);
  protected query = '';
  protected filter = 'all';
  protected draft = '';

  protected readonly canReply = computed(
    () => this.auth.user()?.access['communication'] === 'full',
  );
  protected readonly unread = computed(() => this.threads().reduce((n, t) => n + t.unread, 0));
  protected readonly open = computed(
    () => this.threads().filter((t) => t.status === 'open').length,
  );
  protected readonly thread = computed(() => this.threads().find((t) => t.id === this.selectedId()) ?? null);
  protected readonly rows = computed(() => {
    const term = this.query.trim().toLowerCase();
    return term ? this.threads().filter((t) => t.who.toLowerCase().includes(term) || t.preview.toLowerCase().includes(term)) : this.threads();
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const options =
      this.filter === 'unread'
        ? { unreadOnly: true }
        : this.filter === 'all'
          ? {}
          : { status: this.filter };
    try {
      const res = await this.api.threads({ ...options, limit: 100 });
      this.threads.set(res.data.map(threadFrom));
      this.total.set(res.total);
    } catch (err) {
      if (this.threads().length === 0) this.error.set(errorText(err, 'The server did not respond.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected selectThread(thread: InboxThread): void {
    this.selectedId.set(thread.id);
    this.draft = '';
    this.draftError.set(null);
    this.detail.set(null);
    void this.api.markRead(thread.id).catch(() => undefined);
    this.threads.update((rows) => rows.map((t) => (t.id === thread.id ? { ...t, unread: 0 } : t)));
    void this.api
      .detail(thread.id)
      .then((detail) => this.detail.set(detail))
      .catch((err) => this.error.set(errorText(err, 'Could not load this conversation.')));
  }

  protected close(): void {
    this.selectedId.set(null);
    this.detail.set(null);
  }

  protected applyMacro(text: string): void {
    this.draft = this.draft.trim() ? `${this.draft.trim()}\n${text}` : text;
  }

  protected async send(): Promise<void> {
    const body = this.draft.trim();
    const id = this.selectedId();
    if (!body) {
      this.draftError.set('Write the reply first.');
      return;
    }
    if (!id) return;
    this.sending.set(true);
    this.draftError.set(null);
    try {
      await this.api.reply(id, body);
      this.draft = '';
      this.toasts.show('Reply sent', 'good');
      this.detail.set(await this.api.detail(id));
      await this.load();
    } catch (err) {
      this.draftError.set(errorText(err, 'The reply could not be sent.'));
    } finally {
      this.sending.set(false);
    }
  }

  protected async toggleStatus(detail: ApiConversationDetail): Promise<void> {
    const status = detail.conversation.status === 'closed' ? 'open' : 'closed';
    try {
      await this.api.update(detail.conversation.id, { status });
      this.toasts.show(status === 'closed' ? 'Conversation closed' : 'Conversation reopened', 'good');
      this.detail.set(await this.api.detail(detail.conversation.id));
      await this.load();
    } catch (err) {
      this.toasts.show(errorText(err, 'That change could not be saved.'), 'bad');
    }
  }
}
