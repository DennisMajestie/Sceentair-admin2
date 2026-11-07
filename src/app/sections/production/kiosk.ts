import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
    <div class="kiosk">
      <header class="kiosk__head">
        <div>
          <span class="kiosk__eyebrow">Floor kiosk</span>
          <h1 class="kiosk__title">Production line</h1>
        </div>
        <a class="kiosk__back" routerLink="/production">Exit to admin</a>
      </header>

      <div class="kiosk__scanbar">
        <input class="kiosk__scan" type="text" inputmode="text" autofocus autocomplete="off" placeholder="Scan or type barcode…" aria-label="Scan barcode" [value]="query()" (input)="query.set($any($event.target).value)" />
      </div>

      @if (loading()) {
        <p class="kiosk__note">Loading the floor…</p>
      } @else if (loadError()) {
        <p class="kiosk__note kiosk__note--error">{{ loadError() }} <button class="kiosk__retry" type="button" (click)="load()">Retry</button></p>
      }

      @if (query().trim()) {
        <button type="button" class="kiosk__clear" (click)="query.set('')">Clear scan filter</button>
      }

      @if (!selectedBatch()) {
        <div class="kiosk__stages" aria-label="Batches by stage">
          @for (stage of stageColumns(); track stage.name) {
            <section class="kiosk__stage">
              <h2 class="kiosk__stageName">{{ stage.name }} <span>{{ stage.batches.length }}</span></h2>
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
            <div class="kiosk__hero">
              <span class="kiosk__lot">{{ lotOf(b) }}</span>
              <span class="kiosk__product">{{ productName(b) }}</span>
              <span class="kiosk__qty">{{ b.quantity }} units · current stage: <strong>{{ b.stage }}</strong></span>
            </div>

            <div class="kiosk__actions">
              @if (nextStage()) {
                <button class="kiosk__big kiosk__big--go" type="button" [disabled]="busy()" (click)="advance()">
                  {{ busy() ? 'Working…' : 'Move to ' + nextStage() }}
                </button>
              } @else {
                <p class="kiosk__note">Final stage reached.</p>
              }
              <button class="kiosk__big kiosk__big--qc" type="button" [disabled]="busy()" (click)="qcOpen.set(!qcOpen())">
                {{ qcOpen() ? 'Close rejection form' : 'Log QC rejection' }}
              </button>
              <button class="kiosk__big kiosk__big--ghost" type="button" (click)="selectedId.set(null)">Back to line</button>
            </div>

            @if (qcOpen()) {
              <form class="kiosk__qc" (ngSubmit)="saveRejection()">
                <label class="kiosk__field"><span>Qty rejected</span><input type="number" min="1" step="1" [(ngModel)]="rejectionForm.quantity" name="rqty" required /></label>
                <label class="kiosk__field"><span>Reason</span><input type="text" [(ngModel)]="rejectionForm.reason" name="rreason" placeholder="stitch defect" required /></label>
                <label class="kiosk__field"><span>Disposition</span>
                  <select [(ngModel)]="rejectionForm.disposition" name="rdisposition">
                    <option value="repaired_restocked">Repaired &amp; restocked</option>
                    <option value="burned">Burned</option>
                  </select>
                </label>
                <button class="kiosk__big kiosk__big--qc" type="submit" [disabled]="busy() || !rejectionForm.reason.trim()">Save rejection</button>
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
    :host { display: block; background: #14110e; color: #f5f2ea; min-height: 100dvh; }
    .kiosk { display: grid; gap: 16px; padding: 18px; max-width: 1100px; margin: 0 auto; }
    .kiosk__head { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid #2a251f; }
    .kiosk__eyebrow { font-size: 0.75rem; letter-spacing: 0.25em; text-transform: uppercase; color: #c9a24b; font-weight: 800; }
    .kiosk__title { font-size: clamp(1.6rem, 3.4vw, 2.4rem); font-weight: 800; margin: 2px 0 0; }
    .kiosk__back { color: #c9a24b; text-decoration: none; font-weight: 700; font-size: 0.95rem; border: 1px solid #c9a24b; border-radius: 10px; padding: 10px 16px; }
    .kiosk__scanbar { display: flex; }
    .kiosk__scan { flex: 1; height: 64px; font-size: 1.35rem; padding: 0 20px; border-radius: 14px; border: 2px solid #2a251f; background: #1d1915; color: #f5f2ea; }
    .kiosk__scan:focus-visible { outline: 3px solid #c9a24b; }
    .kiosk__stages { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(280px, 1fr); gap: 14px; overflow-x: auto; padding-bottom: 12px; }
    .kiosk__stage { background: #1d1915; border-radius: 16px; padding: 14px; min-height: 320px; }
    .kiosk__stageName { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.12em; color: #c9a24b; margin: 0 0 12px; display: flex; justify-content: space-between; }
    .kiosk__stageName span { color: #f5f2ea; }
    .kiosk__tile { display: grid; gap: 4px; width: 100%; text-align: left; background: #262019; border: 1px solid #332c23; border-radius: 14px; padding: 16px; margin-bottom: 10px; color: #f5f2ea; cursor: pointer; min-height: 96px; }
    .kiosk__tile:hover, .kiosk__tile:focus-visible { border-color: #c9a24b; }
    .kiosk__tile:focus-visible { outline: 3px solid #c9a24b; outline-offset: 2px; }
    .kiosk__lot { font-family: var(--font-mono, monospace); font-size: 0.95rem; color: #c9a24b; }
    .kiosk__product { font-size: 1.2rem; font-weight: 750; }
    .kiosk__qty { color: #b6b0a2; font-size: 1rem; }
    .kiosk__empty { color: #7d766a; font-size: 0.9rem; padding: 8px 4px; }
    .kiosk__detail { display: grid; gap: 18px; }
    .kiosk__hero { background: #1d1915; border-radius: 18px; padding: 22px; display: grid; gap: 6px; border: 1px solid #2a251f; }
    .kiosk__hero .kiosk__product { font-size: clamp(1.6rem, 4vw, 2.3rem); }
    .kiosk__hero .kiosk__qty { font-size: 1.2rem; }
    .kiosk__actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .kiosk__big { min-height: 84px; border: 0; border-radius: 16px; font-size: clamp(1rem, 2vw, 1.3rem); font-weight: 800; cursor: pointer; }
    .kiosk__big--go { background: #c9a24b; color: #241f17; }
    .kiosk__big--qc { background: #b4453a; color: #fff; }
    .kiosk__big--ghost { background: #262019; color: #f5f2ea; border: 1px solid #332c23; }
    .kiosk__big:disabled { opacity: 0.55; cursor: not-allowed; }
    .kiosk__big:focus-visible { outline: 3px solid #c9a24b; outline-offset: 2px; }
    .kiosk__qc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; align-items: end; background: #1d1915; padding: 16px; border-radius: 16px; border: 1px solid #2a251f; }
    .kiosk__field { display: grid; gap: 6px; }
    .kiosk__field span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; color: #b6b0a2; font-weight: 800; }
    .kiosk__field input, .kiosk__field select { height: 56px; font-size: 1.1rem; padding: 0 14px; border-radius: 12px; border: 2px solid #332c23; background: #14110e; color: #f5f2ea; }
    .kiosk__field input:focus-visible, .kiosk__field select:focus-visible { outline: 3px solid #c9a24b; }
    .kiosk__sub { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.15em; color: #b6b0a2; margin: 0; }
    .kiosk__scans { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .kiosk__scans li { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #1d1915; border-radius: 10px; font-size: 1rem; }
    .kiosk__scans span { color: #b6b0a2; }
    .kiosk__note { color: #b6b0a2; font-size: 1.05rem; padding: 18px; background: #1d1915; border-radius: 14px; }
    .kiosk__note--error { color: #ff9d8a; }
    .kiosk__retry { margin-left: 10px; padding: 8px 14px; border-radius: 8px; border: 1px solid #c9a24b; background: transparent; color: #c9a24b; cursor: pointer; }
    .kiosk__clear { border: 1px solid #332c23; background: #1d1915; color: #c9a24b; border-radius: 10px; height: 48px; cursor: pointer; }
    @media (max-width: 900px) { .kiosk__actions { grid-template-columns: 1fr; } .kiosk__qc { grid-template-columns: 1fr 1fr; } }
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
