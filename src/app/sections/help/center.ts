import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { HelpApiService } from '../../core/help-api.service';
import { ToastService } from '../../core/toast';

interface Topic {
  id: string;
  title: string;
  blurb: string;
  icon: string;
}

const TOPICS: Topic[] = [
  { id: 'batches', title: 'Batches & QA', blurb: 'Making lots, release, holds, expiry', icon: 'check' },
  { id: 'stock', title: 'Stock & counts', blurb: 'Transfers, counts, reorder points', icon: 'layers' },
  { id: 'orders', title: 'Orders & returns', blurb: 'Wholesale, online, the board, returns', icon: 'truck' },
  { id: 'purchasing', title: 'Purchasing', blurb: 'Suppliers, POs, receiving', icon: 'purchasing' },
  { id: 'team', title: 'Team & data', blurb: 'Roles, exports, settings', icon: 'customers' },
  { id: 'shortcuts', title: 'Shortcuts', blurb: 'Get around without the mouse', icon: 'selector' },
];

const POPULAR = ['expiry', 'transfer', 'count', 'return', 'shortcuts'];

@Component({
  selector: 'app-help-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="hero">
      <span class="hero__eyebrow">Help</span>
      <h1 class="hero__title">How can we help?</h1>
      <p class="hero__lead">
        Answers about batches, stock, orders and the team — written by the people who run Vessa.
      </p>
    </div>

    <label class="search help__search">
      <app-icon name="search" [size]="16" />
      <input
        type="search"
        placeholder="Search for an answer"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      <kbd class="help__kbd">/</kbd>
    </label>

    <div class="popular">
      <span class="popular__label">Popular:</span>
      @for (p of popular; track p) {
        <button type="button" class="chip" [class.is-on]="chip() === p" (click)="toggleChip(p)">
          {{ p }}
        </button>
      }
    </div>

    <section class="topics">
      @for (t of topics; track t.id) {
        <article class="card topic" (click)="toggleTopic(t.id)">
          <span class="topic__icon"><app-icon [name]="t.icon" [size]="17" /></span>
          <h2 class="topic__title">{{ t.title }}</h2>
          <p class="topic__blurb">{{ t.blurb }}</p>
          <span class="topic__count">{{ countFor(t.id) }}</span>
        </article>
      }
    </section>

    <div class="qa__head">
      <div>
        <h2 class="qa__title">Questions and answers</h2>
        <p class="qa__sub">{{ filtered().length }} answers across {{ topicCount() }} topics</p>
      </div>
      <button type="button" class="btn btn--xs btn--ghost" (click)="clear()">Clear</button>
    </div>

    @if (loading() && articles().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3, 4, 5]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 58px"></div>
        }
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    @if (filtered().length === 0 && !loading() && !error()) {
      <article class="card">
        <p class="empty">Nothing matches that yet — try a shorter search, or open a ticket.</p>
      </article>
    }

    <section class="qa">
      @for (a of filtered(); track a.id) {
        <article class="card q" [class.is-open]="open() === a.id">
          <button type="button" class="q__head" (click)="toggle(a.id)">
            <span class="q__question">{{ a.title }}</span>
            <app-icon name="chevronDown" [size]="16" />
          </button>
          @if (open() === a.id) {
            <div class="q__body">
              <p class="q__answer">{{ a.content ?? a.blurb ?? 'No content available.' }}</p>
              <div class="q__foot">
                @if (a.source) {
                  <span class="q__help">Source: {{ a.source }}</span>
                }
                <span class="chip chip--quiet">{{ topicTitle(a.keywords[0] ?? 'general') }}</span>
              </div>
            </div>
          }
        </article>
      }
    </section>
  `,
  styles: `
    .hero { display: grid; gap: 6px; margin-bottom: 18px; }
    .hero__eyebrow { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
    .hero__title { font-size: var(--fs-4xl); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; margin: 0; }
    .hero__lead { margin: 0; color: var(--muted); font-size: var(--fs-md); max-width: 62ch; }
    .help__search { max-width: 640px; margin-bottom: 12px; }
    .help__kbd { margin-left: auto; font-family: var(--font-mono, monospace); font-size: var(--fs-2xs); color: var(--faint); border: 1px solid var(--line-2); border-radius: 5px; padding: 1px 6px; }
    .popular { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 22px; }
    .popular__label { font-size: var(--fs-xs); color: var(--muted); }
    .chip { border: 1px solid var(--line-2); background: var(--surface); color: var(--muted); border-radius: 999px; padding: 3px 10px; font: inherit; font-size: var(--fs-xs); cursor: pointer; }
    .chip.is-on { background: var(--primary); border-color: var(--primary); color: #fff; }
    .chip--quiet { cursor: default; background: var(--well); border-style: dashed; }
    .topics { display: grid; grid-template-columns: repeat(auto-fit, minmax(215px, 1fr)); gap: var(--gap); margin-bottom: 26px; }
    .topic { display: grid; gap: 7px; align-content: start; cursor: pointer; }
    .topic__icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--well); color: var(--primary); }
    .topic__title { font-size: var(--fs-md); font-weight: 700; letter-spacing: -0.01em; margin: 0; }
    .topic__blurb { font-size: var(--fs-xs); color: var(--muted); margin: 0; }
    .topic__count { justify-self: start; font-size: var(--fs-2xs); font-weight: 700; color: var(--faint); border: 1px solid var(--line-2); border-radius: 999px; padding: 1px 8px; }
    .qa__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .qa__title { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
    .qa__sub { margin: 2px 0 0; font-size: var(--fs-xs); color: var(--muted); }
    .qa { display: grid; gap: 10px; }
    .q { padding: 0; overflow: hidden; }
    .q__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; border: none; background: none; padding: 14px 16px; font: inherit; text-align: left; cursor: pointer; color: inherit; }
    .q__question { font-size: var(--fs-md); font-weight: 600; }
    .q.is-open .q__head app-icon { transform: rotate(180deg); }
    .q__body { padding: 0 16px 16px; display: grid; gap: 12px; }
    .q__answer { margin: 0; font-size: var(--fs-sm); line-height: 1.65; color: var(--muted); max-width: 76ch; }
    .q__foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .q__help { font-size: var(--fs-2xs); color: var(--faint); }
    .empty { color: var(--muted); font-size: var(--fs-sm); margin: 0; }
    .cs-skel { display: grid; gap: 8px; }
    .cs-row { height: 58px; border-radius: 8px; background: var(--well); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .notice--error { margin: 10px 0; border-color: var(--bad); color: var(--bad); }
  `,
})
export class HelpCenter {
  private readonly helpApi = inject(HelpApiService);
  private readonly toasts = inject(ToastService);

  protected readonly topics = TOPICS;
  protected readonly popular = POPULAR;

  protected readonly query = signal('');
  protected readonly chip = signal('');
  protected readonly topic = signal('');
  protected readonly open = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly articles = signal<{ id: string; title: string; blurb: string | null; content: string | null; source: string | null; keywords: string[] }[]>([]);

  constructor() {
    void this.loadArticles();
  }

  private async loadArticles(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.helpApi.articles();
      this.articles.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load help articles.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const chip = this.chip();
    const topic = this.topic();
    return this.articles().filter((a) => {
      if (chip && !a.keywords.includes(chip)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        (a.content ?? '').toLowerCase().includes(q) ||
        a.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  });

  protected readonly topicCount = computed(() => {
    const set = new Set(this.filtered().flatMap((a) => a.keywords));
    return set.size;
  });

  protected countFor(topicId: string): number {
    return this.articles().filter((a) => a.keywords.includes(topicId)).length;
  }

  protected topicTitle(topicId: string): string {
    return TOPICS.find((t) => t.id === topicId)?.title ?? topicId;
  }

  protected toggle(id: string): void {
    this.open.set(this.open() === id ? '' : id);
  }

  protected toggleChip(chip: string): void {
    this.chip.set(this.chip() === chip ? '' : chip);
  }

  protected toggleTopic(id: string): void {
    this.topic.set(this.topic() === id ? '' : id);
    this.open.set('');
  }

  protected clear(): void {
    this.query.set('');
    this.chip.set('');
    this.topic.set('');
    this.open.set('');
  }
}
