import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { monthYear, money as fmtMoney, date as fmtDate } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import {
  ApiSupplier,
  SuppliersApiService,
} from '../../core/suppliers-api.service';

interface SupplierRow {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  certified: boolean;
  slaScore: number | null;
  quotaUnits: number | null;
  complianceNotes: string | null;
  createdAt: string;
  tone: string;
  initials: string;
  sinceLabel: string;
  formattedCreatedAt: string;
}

@Component({
  selector: 'app-purchasing-suppliers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Drawer],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Purchasing</span>
        <h1 class="head__title">Suppliers</h1>
        <p class="head__lead">{{ rows().length }} partners · average on-time rate {{ avgOnTime() }}%.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" routerLink="/purchasing/materials">Materials</a>
      </div>
    </div>

    <div class="stats" aria-label="Supplier summary">
      <article class="stat">
        <span class="stat__label">Suppliers</span>
        <strong class="stat__value">{{ rows().length }}</strong>
        <span class="stat__detail">All partners</span>
      </article>
      <article class="stat">
        <span class="stat__label">Certified</span>
        <strong class="stat__value">{{ preferredCount() }}</strong>
        <span class="stat__detail">Certified suppliers</span>
      </article>
      <article class="stat">
        <span class="stat__label">Avg. SLA score</span>
        <strong class="stat__value">{{ avgSla() }}</strong>
        <span class="stat__detail">Supplier quality score</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Supplier filter">
        @for (f of filters; track f.id) {
          <button type="button" class="seg__btn" [class.is-on]="filter() === f.id" [attr.aria-pressed]="filter() === f.id" (click)="setFilter(f.id)">
            {{ f.label }}
          </button>
        }
      </div>
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search supplier" aria-label="Search suppliers" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
    </div>

    @if (loading() && rows().length === 0) {
      <div class="card cs-skel" aria-hidden="true">
        @for (i of [0, 1, 2, 3]; track i) {
          <div class="cs-row cs-skel__row" style="--row-h: 140px"></div>
        }
      </div>
    } @else {
      <div class="grid grid--3">
        @for (s of visible(); track s.id) {
          <article class="card scard">
            <div class="scard__head">
              <span class="av av--lg av--{{ s.tone }}">{{ s.initials }}</span>
              <div class="scard__id">
                <h2 class="scard__name">{{ s.name }}</h2>
                <span class="scard__where">{{ s.location ?? 'Location not set' }}</span>
              </div>
              @if (s.certified) {
                <span class="badge badge--warn">Certified</span>
              }
            </div>

            @if (s.category) {
              <p class="scard__supplies">{{ s.category }}</p>
            }

            <div class="scard__stats">
              <div class="stat">
                <span class="stat__label">SLA score</span>
                <span class="stat__value">{{ s.slaScore ?? '—' }}</span>
              </div>
              <div class="stat">
                <span class="stat__label">Quota</span>
                <span class="stat__value">{{ s.quotaUnits ?? '—' }}</span>
              </div>
            </div>

            <div class="scard__foot">
              <span class="scard__since">Added {{ s.sinceLabel }}</span>
              <button type="button" class="btn btn--xs btn--ghost" (click)="open(s.id)">View</button>
            </div>
          </article>
        }
      </div>
    }

    @if (error()) {
      <div class="notice notice--error" role="alert">{{ error() }}</div>
    }

    <app-drawer [open]="!!selected()" (close)="close()" label="Supplier detail">
      <ng-container drawerTitle>
        @if (selected(); as s) {
          <div class="dtitle">
            <strong>{{ s.name }}</strong>
            <span class="badge">{{ s.location ?? 'Location not set' }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as s) {
        <div class="dbody">
          <dl class="facts">
            <div><dt>ID</dt><dd class="mono">{{ s.id }}</dd></div>
            <div><dt>Category</dt><dd>{{ s.category ?? 'Not set' }}</dd></div>
            <div><dt>Location</dt><dd>{{ s.location ?? 'Not set' }}</dd></div>
            <div><dt>Certified</dt><dd>{{ s.certified ? 'Yes' : 'No' }}</dd></div>
            <div><dt>SLA score</dt><dd>{{ s.slaScore ?? 'Not set' }}</dd></div>
            <div><dt>Quota units</dt><dd>{{ s.quotaUnits ?? 'Not set' }}</dd></div>
            <div><dt>Compliance notes</dt><dd>{{ s.complianceNotes ?? 'None' }}</dd></div>
            <div><dt>Added</dt><dd>{{ s.formattedCreatedAt }}</dd></div>
          </dl>

          <h3 class="dlabel">Notes</h3>
          <p class="dnote">{{ s.complianceNotes ?? 'No compliance notes on file.' }}</p>
        </div>
      }
    </app-drawer>
  `,
  styles: `
    .scard { display: grid; gap: 12px; }
    .scard__head { display: flex; align-items: center; gap: 12px; }
    .scard__id { flex: 1; min-width: 0; line-height: 1.25; }
    .scard__name { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.015em; }
    .scard__where { font-size: var(--fs-2xs); color: var(--faint); }
    .scard__supplies { font-size: var(--fs-sm); color: var(--muted); }
    .scard__stats { display: flex; gap: 18px; }
    .scard__stats .stat__value { font-size: var(--fs-xl); }
    .scard__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .scard__since { font-size: var(--fs-2xs); color: var(--faint); }
    .dtitle { display: flex; align-items: center; gap: 9px; }
    .dtitle strong { font-size: var(--fs-lg); }
    .dbody { display: grid; gap: 16px; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dnote { font-size: var(--fs-md); color: var(--muted); }
    .notice {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--well); color: var(--muted); font-size: var(--fs-xs);
    }
    .cs-skel { display: grid; gap: 16px; }
    .cs-row { height: 140px; border-radius: 8px; background: var(--well); }
  `,
})
export class PurchasingSuppliers {
  private readonly suppliersApi = inject(SuppliersApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly date = fmtDate;
  protected readonly money = fmtMoney;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly suppliers = signal<ApiSupplier[]>([]);

  protected readonly filter = signal('all');
  protected readonly query = signal('');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'certified', label: 'Certified' },
  ];

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  constructor() {
    void this.loadSuppliers();
  }

  private async loadSuppliers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.suppliersApi.list({ page: 1, limit: 100 });
      this.suppliers.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load suppliers.');
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly rows = computed<SupplierRow[]>(() =>
    this.suppliers().map((s) => {
      const tone = ['pine', 'ocean', 'ochre', 'sage', 'rose', 'slate'][
        [...s.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6
      ];
      const initials = s.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        location: s.location,
        certified: s.certified,
        slaScore: s.slaScore,
        quotaUnits: s.quotaUnits,
        complianceNotes: s.complianceNotes,
        createdAt: s.createdAt,
        tone,
        initials,
        sinceLabel: monthYear(Date.parse(s.createdAt)),
        formattedCreatedAt: fmtDate(Date.parse(s.createdAt)),
      };
    }),
  );

  protected readonly avgOnTime = computed(() => {
    const list = this.rows();
    if (list.length === 0) return 0;
    const scores = list.filter((s) => s.slaScore !== null).map((s) => s.slaScore!);
    return scores.length ? Math.round(scores.reduce((a, s) => a + s, 0) / scores.length) : 0;
  });
  protected readonly avgSla = computed(() => this.avgOnTime());
  protected readonly preferredCount = computed(() => this.rows().filter((s) => s.certified).length);

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (f === 'certified' && !r.certified) return false;
      if (!q) return true;
      return `${r.name} ${r.location}`.toLowerCase().includes(q);
    });
  });

  protected readonly selected = computed<SupplierRow | null>(() => {
    const found = this.rows().find((s) => s.id === this.routeId());
    return found ?? null;
  });

  protected setFilter(id: string): void {
    this.filter.set(id as 'all' | 'certified');
  }

  protected open(id: string): void {
    this.router.navigate(['/purchasing/suppliers', id]);
  }

  protected close(): void {
    this.router.navigate(['/purchasing/suppliers']);
  }
}