import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { count as fmtCount } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import { AuthService } from '../../core/auth.service';
import { LoyaltyApiService, type LoyaltyAccount } from '../../core/loyalty-api.service';
import { ToastService } from '../../core/toast';
import { Spinner } from '../../ui/spinner';

@Component({
  selector: 'app-marketing-loyalty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Marketing</span>
        <h1 class="head__title">Loyalty</h1>
        <p class="head__lead">
          Points earned on paid orders and redeemed at checkout. Adjustments are approval-gated.
        </p>
      </div>
      <div class="head__actions">
        <button class="btn btn--ghost" type="button" [disabled]="loading()" (click)="load()">Refresh</button>
      </div>
    </div>

    @if (loading()) {
      <div class="load-center"><app-spinner size="md" label="Loading loyalty accounts" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load loyalty accounts.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else {
      <section class="kpis" aria-label="Loyalty summary">
        <article class="card kpi">
          <span class="stat__label">Points outstanding</span>
          <span class="kpi__value">{{ count(points()) }}</span>
          <span class="kpi__meta">across all shoppers</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Members</span>
          <span class="kpi__value">{{ count(accounts().length) }}</span>
          <span class="kpi__meta">shoppers with a balance</span>
        </article>
      </section>

      <section class="card panel">
        <h2 class="panel__title">Balances</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Customer</th><th scope="col" class="num">Points</th><th scope="col" class="num">Lifetime points</th></tr></thead>
            <tbody>
              @for (row of accounts(); track row.customerId) {
                <tr>
                  <td class="mono">{{ row.customerId }}</td>
                  <td class="num">{{ count(row.points) }}</td>
                  <td class="num">{{ count(row.lifetimePoints) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="muted">No loyalty balances yet — points appear after a paid order.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (canWrite()) {
        <section class="card panel">
          <h2 class="panel__title">Adjust points</h2>
          <form class="adjust-form" (ngSubmit)="adjust()">
            <p class="note">Create a fund-movement approval first; the API checks the approved request before applying points.</p>
            <div class="cgrid">
              <label class="field"><span class="field__label">Customer ID</span><input type="text" [(ngModel)]="form.customerId" name="customerId" required /></label>
              <label class="field"><span class="field__label">Points (±, non-zero)</span><input type="number" step="1" [(ngModel)]="form.points" name="points" required /></label>
            </div>
            <label class="field"><span class="field__label">Note</span><input type="text" [(ngModel)]="form.note" name="note" required /></label>
            <label class="field"><span class="field__label">Approval request ID</span><input type="text" [(ngModel)]="form.approvalRequestId" name="approvalRequestId" required /></label>
            @if (formError()) { <p class="error">{{ formError() }}</p> }
            <button class="btn btn--primary" type="submit" [disabled]="busy() || !form.customerId || !form.points || !form.note.trim() || !form.approvalRequestId">
              {{ busy() ? 'Applying…' : 'Adjust points' }}
            </button>
          </form>
        </section>
      }
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi__meta, .muted { color: var(--muted); font-size: var(--fs-xs); }
    .panel { margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: var(--fs-mono, monospace); }
    .adjust-form { display: grid; gap: 12px; max-width: 720px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); }
    .note { margin: 0; color: var(--muted); font-size: var(--fs-xs); }
    .error { margin: 0; color: var(--bad); font-size: var(--fs-xs); }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 700px) { .cgrid { grid-template-columns: 1fr; } }
  `,
})
export class MarketingLoyalty {
  private readonly api = inject(LoyaltyApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly count = fmtCount;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly accounts = signal<LoyaltyAccount[]>([]);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly form = { customerId: '', points: 0, note: '', approvalRequestId: '' };

  protected readonly canWrite = computed(
    () => this.auth.user()?.access?.['marketing'] === 'full',
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.accounts.set(await this.api.accounts());
    } catch (err) {
      this.accounts.set([]);
      this.error.set(friendlyErrorMessage(err, 'The loyalty service is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly points = computed(() =>
    this.accounts().reduce((sum, account) => sum + account.points, 0),
  );

  protected async adjust(): Promise<void> {
    const points = Math.trunc(Number(this.form.points));
    if (!this.form.customerId.trim() || !Number.isInteger(points) || points === 0 || !this.form.note.trim() || !this.form.approvalRequestId.trim()) {
      this.formError.set('Enter a customer, a non-zero whole number of points, a note and an approval ID.');
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      await this.api.adjust({
        customerId: this.form.customerId.trim(),
        points,
        note: this.form.note.trim(),
        approvalRequestId: this.form.approvalRequestId.trim(),
      });
      this.toast.show('Loyalty points adjusted', 'good');
      this.form.customerId = '';
      this.form.points = 0;
      this.form.note = '';
      this.form.approvalRequestId = '';
      await this.load();
    } catch (err) {
      this.formError.set(friendlyErrorMessage(err, 'The points adjustment was refused.'));
    } finally {
      this.busy.set(false);
    }
  }
}
