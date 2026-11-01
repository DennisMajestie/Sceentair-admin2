import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  ApiArticle,
  HelpApiService,
} from '../../core/help-api.service';
import { HelpCenter } from './center';
import { HelpTickets } from './tickets';
import { ToastService } from '../../core/toast';

const ARTICLE: ApiArticle = {
  id: 'a-1',
  title: 'How does a batch get from the lab onto the shelf?',
  blurb: 'Making lots, release, holds, expiry',
  content: 'Build a lot from Products › Batches...',
  source: 'docs/batches.md',
  keywords: ['batch', 'release', 'lab', 'shelf'],
};

const ARTICLE_2: ApiArticle = {
  ...ARTICLE,
  id: 'a-2',
  title: 'How do cycle counts work?',
  keywords: ['count', 'cycle', 'variance', 'stocktake'],
};

const TICKET: { id: string; number: string; subject: string; body: string; reply: string | null; status: 'open' | 'in_progress' | 'resolved'; createdAt: string; updatedAt: string; actorId: string | null } = {
  id: 't-1',
  number: 'HT-1001',
  subject: 'Batch release question',
  body: 'How do I release a batch from QA?',
  reply: null,
  status: 'open',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
  actorId: 'm-okafor',
};

function makeHelpApi(articlesResult: { data: ApiArticle[]; total: number } = { data: [], total: 0 }) {
  const api = jasmine.createSpyObj('HelpApiService', ['articles', 'tickets', 'createTicket', 'updateTicketStatus']);
  api.articles.and.returnValue(Promise.resolve(articlesResult));
  api.tickets.and.returnValue(Promise.resolve({ data: [], total: 0 }));
  api.createTicket.and.returnValue(Promise.resolve(TICKET));
  api.updateTicketStatus.and.returnValue(Promise.resolve({ ...TICKET, status: 'resolved' }));
  return api;
}

function makeToast() {
  return jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
}

function createHelpCenterComponent(helpApi: ReturnType<typeof makeHelpApi>) {
  TestBed.configureTestingModule({
    imports: [HelpCenter],
    providers: [
      { provide: HelpApiService, useValue: helpApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(HelpCenter);
}

function createHelpTicketsComponent(helpApi: ReturnType<typeof makeHelpApi>) {
  TestBed.configureTestingModule({
    imports: [HelpTickets],
    providers: [
      { provide: HelpApiService, useValue: helpApi },
      { provide: ToastService, useValue: makeToast() },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of({ get: () => null } as unknown as ParamMap) },
      },
      { provide: Router, useValue: { url: '', events: of(null), navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return TestBed.createComponent(HelpTickets);
}

describe('help articles response mapping', () => {
  it('maps api article fields verbatim', async () => {
    const helpApi = makeHelpApi({ data: [ARTICLE], total: 1 });
    const fixture = createHelpCenterComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadArticles();
    await fixture.whenStable();

    const articles = (component as any).articles();
    expect(articles).toHaveSize(1);
    expect(articles[0].id).toBe('a-1');
    expect(articles[0].title).toBe('How does a batch get from the lab onto the shelf?');
    expect(articles[0].blurb).toBe('Making lots, release, holds, expiry');
    expect(articles[0].content).toBe('Build a lot from Products › Batches...');
    expect(articles[0].source).toBe('docs/batches.md');
    expect(articles[0].keywords).toEqual(['batch', 'release', 'lab', 'shelf']);
  });

  it('filters articles by keyword from the API', async () => {
    const helpApi = makeHelpApi({ data: [ARTICLE, ARTICLE_2], total: 2 });
    const fixture = createHelpCenterComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadArticles();
    await fixture.whenStable();

    (component as any).chip.set('count');
    const filtered = (component as any).filtered();
    expect(filtered).toHaveSize(1);
    expect(filtered[0].id).toBe('a-2');
  });

  it('does not fabricate fields the API lacks on articles', async () => {
    const helpApi = makeHelpApi({ data: [ARTICLE], total: 1 });
    const fixture = createHelpCenterComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadArticles();
    await fixture.whenStable();

    const articles = (component as any).articles();
    expect((articles[0] as any).author).toBeUndefined();
    expect((articles[0] as any).category).toBeUndefined();
    expect((articles[0] as any).readTime).toBeUndefined();
  });
});

describe('help tickets response mapping', () => {
  it('maps api ticket fields verbatim', async () => {
    const helpApi = makeHelpApi({ data: [], total: 0 });
    helpApi.tickets.and.returnValue(Promise.resolve({ data: [TICKET], total: 1 }));
    const fixture = createHelpTicketsComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadTickets();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows).toHaveSize(1);
    expect(rows[0].id).toBe('t-1');
    expect(rows[0].number).toBe('HT-1001');
    expect(rows[0].subject).toBe('Batch release question');
    expect(rows[0].body).toBe('How do I release a batch from QA?');
    expect(rows[0].status).toBe('open');
    expect(rows[0].actorId).toBe('m-okafor');
  });

  it('maps ticket status transitions correctly', async () => {
    const helpApi = makeHelpApi({ data: [], total: 0 });
    helpApi.tickets.and.returnValue(Promise.resolve({ data: [TICKET], total: 1 }));
    const fixture = createHelpTicketsComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadTickets();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect(rows[0].status).toBe('open');
    expect((component as any).openCount().length).toBe(1);

    await (component as any).resolveTicket('t-1');
    expect(helpApi.updateTicketStatus).toHaveBeenCalledWith('t-1', { status: 'resolved' });
  });

  it('does not fabricate fields the API lacks on tickets', async () => {
    const helpApi = makeHelpApi({ data: [], total: 0 });
    helpApi.tickets.and.returnValue(Promise.resolve({ data: [TICKET], total: 1 }));
    const fixture = createHelpTicketsComponent(helpApi);
    const component = fixture.componentInstance;

    await (component as any).loadTickets();
    await fixture.whenStable();

    const rows = (component as any).rows();
    expect((rows[0] as any).priority).toBeUndefined();
    expect((rows[0] as any).assignee).toBeUndefined();
    expect((rows[0] as any).department).toBeUndefined();
  });
});
