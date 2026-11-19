import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MessagingApiService, type ApiConversationDetail } from '../../core/messaging-api.service';
import { ToastService } from '../../core/toast';
import { chatChannelLabel, ConversationsInbox, statusMeaning, threadFrom } from './conversations';

const conversation = {
  id: 'c1',
  customerId: 'u1',
  customerName: 'Ada Obi',
  guestName: null,
  guestEmail: null,
  guestPhone: null,
  channel: 'whatsapp' as const,
  status: 'open' as const,
  relatedOrderId: 'order123456',
  subject: 'Where is my order?',
  assigneeId: null,
  lastMessageAt: '2026-11-19T10:00:00.000Z',
  lastMessagePreview: 'Hello, any update?',
  unreadStaff: 2,
  unreadCustomer: 0,
  createdAt: '2026-11-19T09:00:00.000Z',
};

const detail: ApiConversationDetail = {
  conversation,
  messages: [
    {
      id: 'm1',
      conversationId: 'c1',
      direction: 'in',
      authorUserId: null,
      authorName: 'Ada Obi',
      body: 'Hello, any update?',
      attachmentUrl: null,
      readAt: null,
      createdAt: '2026-11-19T10:00:00.000Z',
    },
  ],
};

describe('ConversationsInbox', () => {
  let fixture: ComponentFixture<ConversationsInbox>;
  let api: jasmine.SpyObj<MessagingApiService>;
  let canReply: boolean;

  beforeEach(async () => {
    canReply = true;
    api = jasmine.createSpyObj('MessagingApiService', [
      'threads',
      'detail',
      'reply',
      'markRead',
      'update',
    ]);
    api.threads.and.resolveTo({ data: [conversation], total: 1 });
    api.detail.and.resolveTo(detail);
    api.reply.and.resolveTo({});
    api.markRead.and.resolveTo({});
    api.update.and.resolveTo({});

    await TestBed.configureTestingModule({
      imports: [ConversationsInbox],
      providers: [
        provideRouter([]),
        { provide: MessagingApiService, useValue: api },
        {
          provide: AuthService,
          useValue: { user: () => ({ access: { communication: canReply ? 'full' : 'view' } }) },
        },
        { provide: ToastService, useValue: { show: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConversationsInbox);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('maps channel and status labels for the thread list', () => {
    const row = threadFrom(conversation);
    expect(row.who).toBe('Ada Obi');
    expect(row.unread).toBe(2);
    expect(chatChannelLabel('in_platform')).toBe('In-app');
    expect(chatChannelLabel('whatsapp')).toBe('WhatsApp');
    expect(statusMeaning('pending').label).toBe('Waiting on reply');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada Obi');
  });

  it('marks a thread read, loads its history and sends a reply', async () => {
    const page = fixture.componentInstance as unknown as { send: () => Promise<void>; draft: string };
    const openButton = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Open',
    ) as HTMLButtonElement;
    openButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.markRead).toHaveBeenCalledWith('c1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hello, any update?');
    expect((fixture.nativeElement as HTMLElement).querySelector('.badge--warn')).toBeNull();

    page.draft = 'Tracking link: ABC';
    await page.send();
    expect(api.reply).toHaveBeenCalledWith('c1', 'Tracking link: ABC');
    expect(api.detail).toHaveBeenCalledTimes(2);
  });
});
