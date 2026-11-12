import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Icon } from '../../ui/icon';
import { Drawer } from '../../ui/drawer';
import { WholesaleApiService, type WholesaleTier, type CreateWholesaleTierInput, type UpdateWholesaleTierInput } from '../../core/wholesale-api.service';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-wholesale-tiers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Drawer, FormsModule],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Wholesale</span>
        <h1 class="head__title">Wholesale tiers</h1>
        <p class="head__lead">{{ tiers().length }} pricing tiers.</p>
      </div>
      <div class="head__actions">
        <a class="btn btn--ghost" (click)="load()">Refresh</a>
        <button type="button" class="btn btn--primary" (click)="openCreate()">
          <app-icon name="plus" [size]="15" />
          New tier
        </button>
      </div>
    </div>

    <div class="stats" aria-label="Tier summary">
      <article class="stat">
        <span class="stat__label">Tiers</span>
        <strong class="stat__value">{{ tiers().length }}</strong>
        <span class="stat__detail">Pricing tiers</span>
      </article>
      <article class="stat">
        <span class="stat__label">Avg discount</span>
        <strong class="stat__value">{{ avgDiscount() }}%</strong>
        <span class="stat__detail">Across all tiers</span>
      </article>
    </div>

    <div class="toolbar">
      <div class="toolbar__spacer"></div>
      <label class="search">
        <app-icon name="search" [size]="14" />
        <input type="search" placeholder="Search tier name" aria-label="Search tiers" [value]="query()" (input)="query.set($any($event.target).value)" />
      </label>
      <span class="badge">{{ visible().length }} tiers</span>
    </div>

    <div class="tier-grid" aria-label="Wholesale tiers">
      @for (row of visible(); track row.id) {
        <button type="button" class="tier-card" (click)="open(row.id)" [attr.aria-label]="'Tier ' + row.id">
          <span class="tier-card__top">
            <span class="mono tier-card__id">{{ row.id }}</span>
            <span class="tier-card__discount">{{ row.discountPercent }}% off</span>
          </span>
          <span class="tier-card__name">{{ row.name }}</span>
          <span class="tier-card__desc">{{ row.ruleDescription ?? 'No description' }}</span>
          <span class="tier-card__meta">
            <span>{{ row.createdAt }}</span>
          </span>
        </button>
      }
      @if (visible().length === 0) {
        <div class="tier-empty">
          <strong>No wholesale tiers match.</strong>
          <span>Try another search term.</span>
        </div>
      }
    </div>

    <app-drawer [open]="!!selected()" (close)="close()" label="Wholesale tier detail">
      <ng-container drawerTitle>
        @if (selected(); as t) {
          <div class="dtitle">
            <strong class="mono">{{ t.id }}</strong>
            <span>{{ t.name }}</span>
          </div>
        }
      </ng-container>
      @if (selected(); as t) {
        <div class="dbody">
          <div class="dsummary">
            <div>
              <span class="stat__label">Name</span>
              <span class="dmeta">{{ t.name }}</span>
            </div>
            <div class="dright">
              <span class="stat__label">Discount</span>
              <strong class="dtotal">{{ t.discountPercent }}%</strong>
            </div>
          </div>

          <dl class="facts">
            <div><dt>Description</dt><dd>{{ t.ruleDescription ?? '—' }}</dd></div>
            <div><dt>Created</dt><dd>{{ t.createdAt }}</dd></div>
          </dl>

          <h3 class="dlabel">Edit tier</h3>
          <div class="dedit">
            <label class="edit-label">
              <span>Name</span>
              <input type="text" class="edit-input" [(ngModel)]="editName" [value]="selected()?.name ?? ''" />
            </label>
            <label class="edit-label">
              <span>Discount percent</span>
              <input type="number" class="edit-input" [(ngModel)]="editDiscount" [value]="selected()?.discountPercent ?? 0" min="0" max="100" />
            </label>
            <label class="edit-label">
              <span>Rule description</span>
              <input type="text" class="edit-input" [(ngModel)]="editDescription" [value]="selected()?.ruleDescription ?? ''" />
            </label>
            <div class="edit-actions">
              <button type="button" class="btn btn--ghost" (click)="clearEdit()">Clear</button>
              <button type="button" class="btn" [disabled]="!editName().trim()" (click)="saveEdit(t.id)">Save changes</button>
              <button type="button" class="btn btn--ghost" (click)="deleteTier(t.id)" [class.delete]="true">Delete tier</button>
            </div>
            @if (editError()) {
              <p class="edit-error">{{ editError() }}</p>
            }
          </div>
        </div>
      }
    </app-drawer>

    <app-drawer [open]="creating()" (close)="closeCreate()" label="New wholesale tier">
      <ng-container drawerTitle><div class="dtitle"><strong>New wholesale tier</strong></div></ng-container>
      <form class="create-form" (ngSubmit)="createTier()">
        <label class="field"><span class="field__label">Name</span>
          <input type="text" [(ngModel)]="createForm.name" name="tierName" placeholder="e.g. Gold wholesale" required />
        </label>
        <label class="field"><span class="field__label">Discount %</span>
          <input type="number" min="0" max="100" step="0.01" [(ngModel)]="createForm.discountPercent" name="tierDiscount" required />
        </label>
        <label class="field"><span class="field__label">Rule description</span>
          <input type="text" [(ngModel)]="createForm.ruleDescription" name="tierRule" placeholder="e.g. 50+ units per quarter" />
        </label>
        @if (createError()) {
          <p class="field-err">{{ createError() }}</p>
        }
        <button class="btn btn--primary" type="submit" [disabled]="creatingBusy() || !createForm.name.trim()">
          {{ creatingBusy() ? 'Creating…' : 'Create tier' }}
        </button>
      </form>
    </app-drawer>
  `,
  styles: `
    .tier-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .tier-card { display: grid; gap: 16px; width: 100%; min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: var(--sd-r-card); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; box-shadow: var(--shadow); }
    .tier-card:hover { border-color: var(--primary); }
    .tier-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .tier-card__top, .tier-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .tier-card__id { font-size: var(--fs-sm); font-weight: 750; }
    .tier-card__discount { font-size: var(--fs-sm); font-weight: 700; color: var(--sage); }
    .tier-card__name { font-size: var(--fs-md); font-weight: 700; }
    .tier-card__desc { color: var(--muted); font-size: var(--fs-sm); }
    .tier-card__meta { color: var(--muted); font-size: var(--fs-sm); }
    .tier-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .tier-empty strong { color: var(--text); }
    .dsummary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .dmeta { display: block; margin-top: 4px; color: var(--faint); font-size: var(--fs-xs); }
    .dbody { display: grid; gap: 16px; }
    .dright { display: grid; justify-items: end; }
    .dtotal { font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin: 0; }
    .facts div { display: grid; gap: 2px; }
    .facts dt { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--faint); font-weight: 700; }
    .facts dd { margin: 0; font-size: var(--fs-md); font-weight: 600; }
    .dedit { display: grid; gap: 10px; margin-top: 12px; }
    .edit-label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-xs); color: var(--faint); font-weight: 600; }
    .edit-input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface); color: var(--text); font-size: var(--fs-sm); }
    .edit-actions { display: flex; gap: 8px; margin-top: 8px; }
    .edit-actions .btn--ghost.delete { color: var(--bad); }
    .edit-error { color: var(--bad); font-size: var(--fs-xs); margin-top: 4px; }
    .create-form { display: grid; gap: 12px; }
    .field { display: grid; gap: 5px; }
    .field input { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); font-size: var(--fs-md); }
    .field input:focus-visible { outline: 2px solid var(--primary); }
    .field-err { color: var(--bad); font-size: var(--fs-xs); margin: 0; }
    @media (max-width: 1100px) { .tier-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .tier-grid { grid-template-columns: 1fr; } }
  `,
})
export class WholesaleTiers {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly wholesaleApi = inject(WholesaleApiService);
  private readonly toast = inject(ToastService);

  protected readonly tiers = signal<WholesaleTier[]>([]);
  protected readonly query = signal('');
  protected readonly editName = signal('');
  protected readonly editDiscount = signal(0);
  protected readonly editDescription = signal('');
  protected readonly editError = signal<string | null>(null);

  protected readonly creating = signal(false);
  protected readonly creatingBusy = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createForm = { name: '', discountPercent: 0, ruleDescription: '' };

  private readonly routeId = this.route.snapshot.paramMap.get('id');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const result = await this.wholesaleApi.listTiers({ page: 1, limit: 100 });
    this.tiers.set(result.data);
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.tiers()
      .filter((t) => {
        if (!q) return true;
        return `${t.name} ${t.ruleDescription ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.discountPercent - a.discountPercent);
  });

  protected readonly avgDiscount = computed(() => {
    const tiers = this.tiers();
    return tiers.length > 0 ? Math.round(tiers.reduce((a, t) => a + t.discountPercent, 0) / tiers.length) : 0;
  });

  protected readonly selected = computed(() => this.tiers().find((t) => t.id === this.routeId));

  protected clearEdit(): void {
    this.editName.set('');
    this.editDiscount.set(0);
    this.editDescription.set('');
    this.editError.set(null);
  }

  protected async saveEdit(id: string): Promise<void> {
    try {
      await this.wholesaleApi.updateTier(id, {
        name: this.editName() || undefined,
        discountPercent: this.editDiscount(),
        ruleDescription: this.editDescription() || undefined,
      });
      await this.load();
      this.close();
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  protected async deleteTier(id: string): Promise<void> {
    if (!confirm('Delete this tier? This cannot be undone.')) return;
    try {
      await this.wholesaleApi.deleteTier(id);
      await this.load();
      this.close();
    } catch (err) {
      this.editError.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  protected open(id: string): void {
    this.router.navigate(['/wholesale/tiers', id]);
  }

  protected close(): void {
    this.router.navigate(['/wholesale/tiers']);
  }

  protected openCreate(): void {
    this.createForm.name = '';
    this.createForm.discountPercent = 0;
    this.createForm.ruleDescription = '';
    this.createError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async createTier(): Promise<void> {
    const name = this.createForm.name.trim();
    const discount = Number(this.createForm.discountPercent);
    if (!name) {
      this.createError.set('A tier name is required.');
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      this.createError.set('Discount must be between 0 and 100.');
      return;
    }
    this.creatingBusy.set(true);
    this.createError.set(null);
    try {
      await this.wholesaleApi.createTier({
        name,
        discountPercent: discount,
        ruleDescription: this.createForm.ruleDescription.trim() || null,
      });
      this.toast.show('Wholesale tier created', 'good');
      this.creating.set(false);
      await this.load();
    } catch (err) {
      this.createError.set(err instanceof Error ? err.message : 'Could not create the tier.');
    } finally {
      this.creatingBusy.set(false);
    }
  }
}