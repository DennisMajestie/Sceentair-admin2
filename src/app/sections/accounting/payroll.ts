import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { count as fmtCount, money as fmtMoney } from '../../core/format';
import { friendlyErrorMessage } from '../../core/network-error';
import { AuthService } from '../../core/auth.service';
import { AccountingApiService, type ApiPayrollRun } from '../../core/accounting-api.service';
import { ToastService } from '../../core/toast';
import { Spinner } from '../../ui/spinner';

interface LineForm {
  name: string;
  amount: number | null;
  note: string;
}

@Component({
  selector: 'app-accounting-payroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Spinner],
  template: `
    <div class="head">
      <div class="head__text">
        <span class="head__eyebrow">Finance</span>
        <h1 class="head__title">Payroll</h1>
        <p class="head__lead">
          Monthly payroll runs. Posting one moves money on the books, so it needs an approved
          fund-movement request.
        </p>
      </div>
      <div class="head__actions">
        <button class="btn btn--ghost" type="button" [disabled]="loading()" (click)="load()">Refresh</button>
        @if (canWrite()) {
          <button class="btn btn--primary" type="button" (click)="openStart()">Start payroll</button>
        }
      </div>
    </div>

    @if (loading()) {
      <div class="load-center"><app-spinner size="sm" label="Loading payroll runs" /></div>
    } @else if (error(); as message) {
      <div class="empty">
        <strong>Couldn't load payroll runs.</strong>
        <span>{{ message }}</span>
        <button class="btn btn--ghost" type="button" (click)="load()">Retry</button>
      </div>
    } @else {
      <section class="kpis" aria-label="Payroll summary">
        <article class="card kpi">
          <span class="stat__label">Runs</span>
          <span class="kpi__value">{{ count(runs().length) }}</span>
          <span class="kpi__meta">recorded payroll periods</span>
        </article>
        <article class="card kpi">
          <span class="stat__label">Total paid</span>
          <span class="kpi__value">{{ money(totalPaid()) }}</span>
          <span class="kpi__meta">across all runs</span>
        </article>
      </section>

      <section class="card panel">
        <h2 class="panel__title">Payroll runs</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Period</th><th scope="col">Staff</th><th scope="col" class="num">Total</th><th scope="col">Status</th><th scope="col">Posted</th></tr>
            </thead>
            <tbody>
              @for (run of runs(); track run.id) {
                <tr>
                  <td><strong>{{ run.periodMonth }}</strong></td>
                  <td>{{ names(run) }}</td>
                  <td class="num">{{ money(run.totalAmount) }}</td>
                  <td><span class="badge" [class.badge--good]="!!run.ledgerEntryId">{{ run.ledgerEntryId ? 'Posted' : 'Pending' }}</span></td>
                  <td>{{ run.postedAt ? date(run.postedAt) : '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted">No payroll runs yet — start one to pay the team for a month.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @if (starting()) {
      <section class="card panel">
        <h2 class="panel__title">Start payroll</h2>
        <form class="payroll-form" (ngSubmit)="postRun()">
          <p class="note">The total is posted to the ledger as a payroll expense once the approval is confirmed.</p>
          <div class="cgrid">
            <label class="field"><span class="field__label">Period (YYYY-MM)</span>
              <input type="month" [(ngModel)]="form.periodMonth" name="periodMonth" required />
            </label>
            <label class="field"><span class="field__label">Approval request ID</span>
              <input type="text" [(ngModel)]="form.approvalRequestId" name="approvalRequestId" required />
            </label>
          </div>

          <h3 class="dlabel">Staff lines</h3>
          @for (line of form.lines; track $index) {
            <div class="line-row">
              <input type="text" [(ngModel)]="line.name" [name]="'name' + $index" placeholder="Staff name" required />
              <input type="number" min="1" step="0.01" [(ngModel)]="line.amount" [name]="'amount' + $index" placeholder="Amount" required />
              <input type="text" [(ngModel)]="line.note" [name]="'note' + $index" placeholder="Note (optional)" />
              @if (form.lines.length > 1) {
                <button type="button" class="btn btn--ghost btn--xs" (click)="removeLine($index)">Remove</button>
              }
            </div>
          }
          <button type="button" class="btn btn--ghost btn--xs" (click)="addLine()">Add staff line</button>
          <p class="total">Total {{ money(formTotal()) }}</p>

          @if (formError()) { <p class="error" role="alert">{{ formError() }}</p> }
          <div class="edit-actions">
            <button class="btn btn--primary" type="submit" [disabled]="busy()">{{ busy() ? 'Posting…' : 'Post payroll' }}</button>
            <button class="btn btn--ghost" type="button" (click)="starting.set(false)">Cancel</button>
          </div>
        </form>
      </section>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--gap); margin-bottom: var(--gap); }
    .kpi { display: grid; gap: 4px; }
    .kpi__value { font-size: var(--fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi__meta { color: var(--muted); font-size: var(--fs-xs); }
    .panel { margin-bottom: var(--gap); padding: 16px; }
    .panel__title { margin: 0 0 12px; font-size: var(--fs-lg); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
    th { color: var(--faint); font-size: var(--fs-2xs); text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: var(--muted); }
    .payroll-form { display: grid; gap: 12px; max-width: 860px; }
    .cgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field input { height: 40px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text); }
    .line-row { display: grid; grid-template-columns: 2fr 1fr 2fr auto; gap: 8px; align-items: center; }
    .line-row input { height: 38px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--text); min-width: 0; }
    .note, .total { margin: 0; color: var(--muted); font-size: var(--fs-xs); }
    .total { font-size: var(--fs-md); font-weight: 700; color: var(--text); }
    .error { margin: 0; color: var(--bad); font-size: var(--fs-xs); }
    .dlabel { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
    .edit-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .empty { display: grid; justify-items: center; gap: 10px; padding: 54px 20px; border: 1px dashed var(--line); border-radius: var(--sd-r-card); color: var(--muted); text-align: center; }
    .empty strong { color: var(--text); }
    @media (max-width: 800px) { .cgrid, .line-row { grid-template-columns: 1fr; } .table-wrap { overflow-x: auto; } }
  `,
})
export class AccountingPayroll {
  private readonly api = inject(AccountingApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly count = fmtCount;
  protected readonly money = fmtMoney;
  protected readonly date = (value: string) => new Date(value).toLocaleDateString();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly runs = signal<ApiPayrollRun[]>([]);
  protected readonly starting = signal(false);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly form = {
    periodMonth: '',
    approvalRequestId: '',
    lines: [{ name: '', amount: null, note: '' }] as LineForm[],
  };

  protected readonly canWrite = computed(
    () => this.auth.user()?.access?.['accounting'] === 'full',
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.payrollRuns(50);
      this.runs.set(result.data ?? []);
    } catch (err) {
      this.runs.set([]);
      this.error.set(friendlyErrorMessage(err, 'The payroll service is unreachable. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly totalPaid = computed(() =>
    this.runs().reduce((sum, run) => sum + run.totalAmount, 0),
  );

  protected readonly formTotal = computed(() =>
    this.form.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
  );

  protected names(run: ApiPayrollRun): string {
    return run.lines.map((line) => line.name).join(', ');
  }

  protected openStart(): void {
    this.form.periodMonth = '';
    this.form.approvalRequestId = '';
    this.form.lines = [{ name: '', amount: null, note: '' }];
    this.formError.set(null);
    this.starting.set(true);
  }

  protected addLine(): void {
    this.form.lines.push({ name: '', amount: null, note: '' });
  }

  protected removeLine(index: number): void {
    this.form.lines.splice(index, 1);
  }

  protected async postRun(): Promise<void> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.form.periodMonth)) {
      this.formError.set('Choose a valid payroll month (YYYY-MM).');
      return;
    }
    if (!this.form.approvalRequestId.trim()) {
      this.formError.set('Enter the approved fund-movement request ID.');
      return;
    }
    if (this.form.lines.length === 0 || this.form.lines.some((l) => l.name.trim().length < 2 || !Number(l.amount) || Number(l.amount) < 1)) {
      this.formError.set('Every staff line needs a name and an amount of at least 1.');
      return;
    }

    this.busy.set(true);
    this.formError.set(null);
    try {
      await this.api.createPayrollRun({
        periodMonth: this.form.periodMonth,
        approvalRequestId: this.form.approvalRequestId.trim(),
        lines: this.form.lines.map((line) => ({
          name: line.name.trim(),
          amount: Number(line.amount),
          note: line.note.trim() || undefined,
        })),
      });
      this.toast.show('Payroll run posted', 'good');
      this.starting.set(false);
      await this.load();
    } catch (err) {
      this.formError.set(friendlyErrorMessage(err, 'The payroll run was refused.'));
    } finally {
      this.busy.set(false);
    }
  }
}
