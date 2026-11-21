import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Spinner } from '../../ui/spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionApiService,
  type ApiProductionBatch,
  type ApiBatchScan,
  type QcDisposition,
} from '../../core/production-api.service';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-floor-kiosk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, Spinner],
  template: `
    <div class="kiosk">
      <div class="head">
        <div class="head__text">
          <span class="head__eyebrow">Floor kiosk</span>
          <h1 class="head__title">Production line</h1>
          <p class="head__lead">{{ active().length }} batches on the floor. Scan a barcode or tap a tile.</p>
        </div>
        <div class="head__actions">
          <a class="btn btn--ghost" routerLink="/production">Exit to admin</a>
        </div>
      </div>

      <section class="stats" aria-label="Production line summary">
        <article class="stat">
          <span class="stat__label">On the floor</span>
          <span class="stat__value">{{ active().length }}</span>
        </article>
        <article class="stat">
          <span class="stat__label">Stages in use</span>
          <span class="stat__value">{{ stageColumns().length }}</span>
        </article>
        <article class="stat">
          <span class="stat__label">Total runs</span>
          <span class="stat__value">{{ batches().length }}</span>
        </article>
      </section>

      <section class="card kiosk__scan-card">
        <div class="card__head">
          <h2 class="card__title">Find a batch</h2>
          <span class="card__sub">Scan a barcode or type it to jump straight to a run.</span>
        </div>
        <input class="kiosk__scan" type="text" inputmode="text" autocomplete="off" placeholder="Scan or type barcode..." aria-label="Scan barcode" [value]="query()" (input)="query.set($any($event.target).value)" />
        @if (query().trim()) {
          <button type="button" class="btn btn--sm btn--soft kiosk__clear" (click)="query.set('')">Clear filter</button>
        }
        @if (loading()) {
          <p class="kiosk__note"><app-spinner size="sm" label="Loading the floor" /></p>
        } @else if (loadError()) {
          <p class="kiosk__note kiosk__note--error">{{ loadError() }} <button class="btn btn--sm btn--soft" type="button" (click)="load()">Retry</button></p>
        }
      </section>

      @if (!selectedBatch()) {
        <div class="kiosk__stages" aria-label="Batches by stage">
          @for (stage of stageColumns(); track stage.name) {
            <section class="card kiosk__stage" [attr.aria-label]="stage.name + ' stage'">
              <div class="card__head">
                <h2 class="card__title kiosk__stageName">{{ stage.name }}</h2>
                <span class="card__sub">{{ stage.batches.length }} {{ stage.batches.length === 1 ? 'batch' : 'batches' }}</span>
              </div>
              @for (b of stage.batches; track b.id) {
                <button type="button" class="kiosk__tile" (click)="selectBatch(b)">
                  <span class="kiosk__lot">{{ lotOf(b) }}</span>
                  <span class="kiosk__product">{{ productName(b) }}</span>
                  <span class="kiosk__qty">{{ b.quantity }} units</span>
                </button>
              }
              @if (!stage.batches.length) {
                <p class="kiosk__empty">No batches here.</p>
              }
            </section>
          }
        </div>
      } @else {
        @if (selectedBatch(); as b) {
          <section class="kiosk__detail" aria-label="Batch actions">
            <div class="card kiosk__hero">
              <span class="kiosk__lot">{{ lotOf(b) }}</span>
              <span class="kiosk__product">{{ productName(b) }}</span>
              <span class="kiosk__qty">{{ b.quantity }} units · current stage: <strong>{{ b.stage }}</strong></span>
            </div>

            <div class="kiosk__actions">
              @if (nextStage()) {
                <button class="btn kiosk__big kiosk__big--go" type="button" [disabled]="busy()" (click)="advance()">
                  {{ busy() ? 'Working...' : 'Move to ' + nextStage() }}
                </button>
              } @else {
                <p class="card kiosk__note">Final stage reached.</p>
              }
              <button class="btn kiosk__big kiosk__big--qc" type="button" [disabled]="busy()" (click)="qcOpen.set(!qcOpen())">
                {{ qcOpen() ? 'Close rejection form' : 'Log QC rejection' }}
              </button>
              <button class="btn kiosk__big kiosk__big--ghost" type="button" (click)="selectedId.set(null)">Back to line</button>
            </div>

            @if (qcOpen()) {
              <form class="card kiosk__qc" (ngSubmit)="saveRejection()">
                <label class="kiosk__field"><span>Qty rejected</span><input type="number" min="1" step="1" [(ngModel)]="rejectionForm.quantity" name="rqty" required /></label>
                <label class="kiosk__field"><span>Reason</span><input type="text" [(ngModel)]="rejectionForm.reason" name="rreason" placeholder="stitch defect" required /></label>
                <label class="kiosk__field"><span>Disposition</span>
                  <select [(ngModel)]="rejectionForm.disposition" name="rdisposition">
                    <option value="repaired_restocked">Repaired &amp; restocked</option>
                    <option value="burned">Burned</option>
                  </select>
                </label>
                <button class="btn kiosk__big kiosk__big--qc" type="submit" [disabled]="busy() || !rejectionForm.reason.trim()">Save rejection</button>
              </form>
            }

            <h2 class="kiosk__sub">Recent scans</h2>
            @if (scans().length) {
              <ol class="kiosk__scans">
                @for (s of scans(); track s.id) {
                  <li><strong>{{ s.stage }}</strong><span>{{ s.scannedAt | date: 'medium' }}</span></li>
                }
              </ol>
            } @else {
              <p class="kiosk__note">No scans yet.</p>
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .kiosk { display: grid; gap: var(--sd-island-gap); align-content: start; }
    .kiosk .stats { margin-bottom: 0; }
    .kiosk__scan-card { display: grid; gap: 10px; }
    .kiosk__scan-card .card__head { margin-bottom: 0; }
    .kiosk__scan { width: 100%; height: 56px; font-size: var(--fs-xl); padding: 0 18px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--text); }
    .kiosk__scan::placeholder { color: var(--faint); }
    .kiosk__scan:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    .kiosk__stages { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--sd-island-gap); align-items: start; }
    .kiosk__stage { display: grid; align-content: start; gap: 4px; min-height: 0; }
    .kiosk__stage .card__head { margin-bottom: 8px; }
    .kiosk__stageName { font-size: var(--fs-md); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text); }
    .kiosk__tile { display: grid; gap: 4px; width: 100%; text-align: left; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-tile); padding: 16px; margin-bottom: 10px; color: var(--text); cursor: pointer; min-height: 96px; font: inherit; }
    .kiosk__tile:hover, .kiosk__tile:focus-visible { border-color: var(--primary); }
    .kiosk__tile:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .kiosk__lot { font-family: var(--mono); font-size: var(--fs-sm); color: var(--primary); font-weight: 700; }
    .kiosk__product { font-size: var(--fs-xl); font-weight: 750; }
    .kiosk__qty { color: var(--muted); font-size: var(--fs-md); }
    .kiosk__empty { color: var(--faint); font-size: var(--fs-sm); padding: 16px 6px; }
    .kiosk__detail { display: grid; gap: var(--sd-island-gap); }
    .kiosk__hero { display: grid; gap: 6px; }
    .kiosk__hero .kiosk__product { font-size: clamp(var(--fs-3xl), 4vw, var(--fs-display)); }
    .kiosk__hero .kiosk__qty { font-size: var(--fs-lg); }
    .kiosk__actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .kiosk__big { min-height: 64px; justify-content: center; border-radius: var(--r-tile); font-size: var(--fs-lg); font-weight: 750; }
    .kiosk__big--go { background: var(--primary); border-color: transparent; color: var(--on-primary); }
    .kiosk__big--qc { background: var(--bad); border-color: transparent; color: #fff; }
    .kiosk__big--ghost { background: var(--surface-2); color: var(--text); }
    .kiosk__qc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; align-items: end; }
    .kiosk__field { display: grid; gap: 6px; }
    .kiosk__field span { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); font-weight: 700; }
    .kiosk__field input, .kiosk__field select { height: 52px; font-size: var(--fs-lg); padding: 0 14px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--text); font: inherit; }
    .kiosk__field input:focus-visible, .kiosk__field select:focus-visible { outline: 2px solid var(--primary); }
    .kiosk__sub { font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 0; }
    .kiosk__scans { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .kiosk__scans li { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-tile); font-size: var(--fs-md); }
    .kiosk__scans span { color: var(--muted); }
    .kiosk__note { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: var(--fs-md); }
    .kiosk__note--error { color: var(--bad); }
    .kiosk__clear { justify-self: start; }
    @media (max-width: 900px) { .kiosk__qc { grid-template-columns: 1fr 1fr; } }
  `,
})
export class FloorKiosk {
  private readonly api = inject(ProductionApiService);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly batches = signal<ApiProductionBatch[]>([]);
  protected readonly stages = signal<string[]>([]);
  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly scans = signal<ApiBatchScan[]>([]);
  protected readonly busy = signal(false);
  protected readonly qcOpen = signal(false);

  protected readonly rejectionForm: { quantity: number; reason: string; disposition: QcDisposition } = {
    quantity: 1,
    reason: '',
    disposition: 'repaired_restocked',
  };

  constructor() {
    void this.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.selectedId.set(id);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const result = await this.api.list(1, 100);
      this.batches.set(result.data);
      this.stages.set(result.stages ?? []);
    } catch {
      this.loadError.set('The production service is unreachable.');
    } finally {
      this.loading.set(false);
    }
  }

  protected lotOf(b: ApiProductionBatch): string {
    return b.barcode ?? b.id.slice(0, 8).toUpperCase();
  }

  protected productName(b: ApiProductionBatch): string {
    const variantId = b.variant?.id;
    if (!variantId) return 'Unknown product';
    return this.store.products().find((p) => (p.variantIds ?? []).includes(variantId))?.name ?? 'Unknown product';
  }

  protected isFinal(b: ApiProductionBatch): boolean {
    const last = this.stages()[this.stages().length - 1];
    return !!last && (b.stage ?? '').toLowerCase() === last.toLowerCase();
  }

  protected readonly active = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.batches().filter((b) => !this.isFinal(b) && (!q || `${this.lotOf(b)} ${this.productName(b)}`.toLowerCase().includes(q)));
  });

  protected readonly stageColumns = computed(() =>
    this.stages()
      .filter((stage) => !this.isFinalName(stage))
      .map((stage) => ({
        name: stage,
        batches: this.active().filter((b) => (b.stage ?? '').toLowerCase() === stage.toLowerCase()),
      })),
  );

  private isFinalName(name: string): boolean {
    const last = this.stages()[this.stages().length - 1];
    return !!last && name.toLowerCase() === last.toLowerCase();
  }

  protected readonly selectedBatch = computed(() => this.batches().find((b) => b.id === this.selectedId()) ?? null);

  protected readonly nextStage = computed(() => {
    const b = this.selectedBatch();
    if (!b) return null;
    const idx = this.stages().findIndex((s) => s.toLowerCase() === (b.stage ?? '').toLowerCase());
    return this.stages()[idx + 1] ?? null;
  });

  protected selectBatch(b: ApiProductionBatch): void {
    this.selectedId.set(b.id);
    this.qcOpen.set(false);
    void this.api.scans(b.id).then((s) => this.scans.set(s)).catch(() => this.scans.set([]));
  }

  protected async advance(): Promise<void> {
    const b = this.selectedBatch();
    const next = this.nextStage();
    if (!b || !next) return;
    this.busy.set(true);
    try {
      await this.api.updateStage(b.id, next);
      this.toast.show(`Moved to ${next}`, 'good');
      await this.load();
      this.selectedId.set(b.id);
      this.scans.set(await this.api.scans(b.id).catch(() => []));
    } catch {
      this.toast.show('Could not advance this batch.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveRejection(): Promise<void> {
    const b = this.selectedBatch();
    if (!b) return;
    this.busy.set(true);
    try {
      await this.api.recordQcRejection(b.id, {
        quantity: Number(this.rejectionForm.quantity) || 1,
        reason: this.rejectionForm.reason.trim(),
        disposition: this.rejectionForm.disposition,
      });
      this.toast.show('Rejection recorded', 'good');
      this.rejectionForm.quantity = 1;
      this.rejectionForm.reason = '';
      this.qcOpen.set(false);
    } catch {
      this.toast.show('Could not record the rejection.', 'bad');
    } finally {
      this.busy.set(false);
    }
  }
}
