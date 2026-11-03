import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Smooth polyline path through points using a Catmull-Rom style midpoint curve. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="spark" [attr.viewBox]="'0 0 ' + w() + ' ' + h()" preserveAspectRatio="none" role="img" [attr.aria-label]="label()">
      @if (showGrid()) {
        @for (g of gridLines(); track g) {
          <line [attr.x1]="0" [attr.x2]="w()" [attr.y1]="g" [attr.y2]="g" class="spark__grid" />
        }
      }
      @if (fill() && points().length > 1) {
        <path [attr.d]="areaPath()" class="spark__area" [style.fill]="color()" />
      }
      @if (points().length > 1) {
        <path [attr.d]="linePath()" class="spark__line" [style.stroke]="color()" />
      }
      @if (showDots()) {
        @for (p of points(); track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.4" class="spark__dot" [style.fill]="color()" />
        }
      }
    </svg>
  `,
  styles: `
    .spark__grid {
      stroke: var(--line);
      stroke-width: 1;
    }
    .spark__line {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .spark__area {
      opacity: 0.14;
    }
    .spark__dot {
      stroke: var(--surface);
      stroke-width: 1.5;
    }
  `,
})
export class Sparkline {
  readonly values = input.required<number[]>();
  readonly width = input(280);
  readonly height = input(70);
  readonly color = input('var(--primary)');
  readonly fill = input(true);
  readonly showGrid = input(false);
  readonly showDots = input(false);
  readonly label = input('trend chart');

  protected readonly w = computed(() => this.width());
  protected readonly h = computed(() => this.height());

  protected readonly points = computed(() => {
    const vals = this.values();
    if (vals.length === 0) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const pad = 6;
    const innerH = this.h() - pad * 2;
    return vals.map((v, i) => ({
      x: vals.length === 1 ? this.w() / 2 : (i / (vals.length - 1)) * this.w(),
      y: pad + innerH - ((v - min) / span) * innerH,
    }));
  });

  protected readonly linePath = computed(() => smoothPath(this.points()));
  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return `${this.linePath()} L ${pts[pts.length - 1].x} ${this.h()} L ${pts[0].x} ${this.h()} Z`;
  });

  protected readonly gridLines = computed(() => {
    const n = 3;
    return Array.from({ length: n }, (_, i) => Math.round(((i + 1) / (n + 1)) * this.h()));
  });
}

@Component({
  selector: 'app-hbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hb">
      @for (bar of bars(); track $index) {
        <div class="hb__col">
          <div class="hb__plot">
            <div
              class="hb__bar"
              [style.height.%]="bar.pct"
              [style.background]="bar.color"
              [title]="bar.label + ' · ' + bar.value"
            ></div>
          </div>
          <span class="hb__lab">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .hb {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 100%;
    }
    .hb__col {
      flex: 1;
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 6px;
      height: 100%;
      min-width: 0;
    }
    .hb__plot {
      display: flex;
      align-items: flex-end;
      height: 100%;
    }
    .hb__bar {
      width: 100%;
      border-radius: 6px 6px 3px 3px;
      min-height: 3px;
      transition: height 0.5s var(--ease);
    }
    .hb__lab {
      font-size: var(--fs-2xs);
      color: var(--faint);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class HBar {
  readonly data = input.required<{ label: string; value: number; color?: string }[]>();
  protected readonly bars = computed(() => {
    const rows = this.data();
    const max = Math.max(...rows.map((r) => r.value), 1);
    return rows.map((r) => ({
      label: r.label,
      value: r.value,
      pct: (r.value / max) * 100,
      color: r.color ?? 'var(--primary)',
    }));
  });
}

@Component({
  selector: 'app-fan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fan" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="label()">
        <circle cx="60" cy="60" r="46" class="fan__ring" />
        <circle
          cx="60"
          cy="60"
          r="46"
          class="fan__lit"
          [style.stroke]="color()"
          [attr.stroke-dasharray]="dash()"
          [attr.stroke-dashoffset]="offset()"
        />
        <circle cx="60" cy="60" r="34" class="fan__base" />
        <text x="60" y="57" class="fan__val" text-anchor="middle">{{ value() }}</text>
        <text x="60" y="74" class="fan__lab" text-anchor="middle">{{ caption() }}</text>
      </svg>
    </div>
  `,
  styles: `
    .fan__ring {
      fill: none;
      stroke: var(--well);
      stroke-width: 11;
    }
    .fan__lit {
      fill: none;
      stroke-width: 11;
      stroke-linecap: round;
      transform: rotate(-90deg);
      transform-origin: 60px 60px;
      transition: stroke-dasharray 0.6s var(--ease);
    }
    .fan__base {
      fill: none;
      stroke: transparent;
    }
    .fan__val {
      font-size: 24px;
      font-weight: 700;
      fill: var(--text);
      letter-spacing: -0.02em;
    }
    .fan__lab {
      font-size: 11px;
      fill: var(--faint);
    }
  `,
})
export class Fan {
  readonly pct = input.required<number>();
  readonly value = input<string | number>('');
  readonly caption = input('');
  readonly color = input('var(--primary)');
  readonly size = input(150);
  readonly label = input('gauge');

  private readonly circumference = 2 * Math.PI * 46;
  protected readonly dash = computed(() => `${(this.pct() / 100) * this.circumference} ${this.circumference}`);
  protected readonly offset = computed(() => this.circumference * 0.25);
}

@Component({
  selector: 'app-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="label()">
        <circle cx="60" cy="60" r="46" class="donut__track" />
        @for (slice of slices(); track $index) {
          <circle
            cx="60"
            cy="60"
            r="46"
            class="donut__arc"
            [attr.stroke]="slice.color"
            [attr.stroke-dasharray]="slice.dash"
            [attr.stroke-dashoffset]="slice.offset"
          />
        }
        <text x="60" y="56" class="donut__val" text-anchor="middle">{{ center() }}</text>
        <text x="60" y="73" class="donut__lab" text-anchor="middle">{{ caption() }}</text>
      </svg>
    </div>
  `,
  styles: `
    .donut__track {
      fill: none;
      stroke: var(--well);
      stroke-width: 12;
    }
    .donut__arc {
      fill: none;
      stroke-width: 12;
      transform: rotate(-90deg);
      transform-origin: 60px 60px;
    }
    .donut__val {
      font-size: 22px;
      font-weight: 700;
      fill: var(--text);
    }
    .donut__lab {
      font-size: 10px;
      fill: var(--faint);
    }
  `,
})
export class Donut {
  readonly data = input.required<{ label: string; value: number; color: string }[]>();
  readonly size = input(160);
  readonly center = input<string | number>('');
  readonly caption = input('');
  readonly label = input('distribution');

  private readonly circumference = 2 * Math.PI * 46;
  protected readonly slices = computed(() => {
    const rows = this.data();
    const total = rows.reduce((a, r) => a + r.value, 0) || 1;
    let acc = 0;
    return rows.map((r) => {
      const len = (r.value / total) * this.circumference;
      const slice = {
        ...r,
        dash: `${len} ${this.circumference - len}`,
        offset: -acc,
      };
      acc += len;
      return slice;
    });
  });
}

@Component({
  selector: 'app-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bars"
      [class.bars--expanded]="expanded()"
      [class.bars--loading]="loading()"
      role="group"
      [attr.aria-label]="periodLabel() + ' inventory statistics'"
      [attr.aria-busy]="loading()"
    >
      <div class="bars__plot">
        @if (hasValuedData()) {
          <div class="bars__axis" aria-hidden="true">
            @for (tick of ticks(); track tick.position) {
              <div class="bars__grid" [style.top.%]="100 - tick.position">
                <span>{{ tick.label }}</span>
                <i></i>
              </div>
            }
          </div>
        }
        <div class="bars__months">
          @for (m of months(); track m.label) {
            <button
              class="bars__col"
              type="button"
              [class.is-selected]="m.label === selectedLabel()"
              [attr.aria-pressed]="m.label === selectedLabel()"
              [attr.aria-label]="m.label + ': stock in ' + formatValue(m.stockInValue) + ', stock out ' + formatValue(m.stockOutValue) + ', stock value ' + formatValue(m.stockValue)"
              (mouseenter)="selectMonth(m.label)"
              (focus)="selectMonth(m.label)"
              (click)="selectMonth(m.label)"
            >
              <div class="bars__track">
                <div class="bars__highlight" aria-hidden="true"></div>
                @if (m.in !== null) {
                  <div class="bars__bar bars__bar--in" [style.height.%]="m.in"></div>
                }
                @if (m.out !== null) {
                  <div class="bars__bar bars__bar--out" [style.height.%]="m.out"></div>
                }
                @if (m.val !== null) {
                  <div class="bars__bar bars__bar--val" [style.height.%]="m.val"></div>
                }
              </div>
              <span class="bars__lab">{{ m.label }}</span>
            </button>
          }
        </div>
        @if (hasValuedData() && selected(); as month) {
          <aside class="bars__tooltip" [style.left.%]="month.tipPosition" aria-live="polite">
            <strong>{{ month.label }}</strong>
            <span><i class="bars__key bars__key--in"></i>Stock in <b>{{ formatValue(month.stockInValue) }}</b></span>
            <span><i class="bars__key bars__key--out"></i>Stock out <b>{{ formatValue(month.stockOutValue) }}</b></span>
            <span><i class="bars__key bars__key--val"></i>Stock value <b>{{ formatValue(month.stockValue) }}</b></span>
          </aside>
        } @else {
          <p class="bars__empty">
            {{ error() || 'Historical stock value is unavailable until finished-goods costs are recorded.' }}
          </p>
        }
      </div>
      <p class="bars__summary" aria-live="polite">
        @if (error()) {
          <span class="bars__error">Chart update failed: {{ error() }}</span>
        } @else if (loading()) {
          Updating {{ periodLabel().toLowerCase() }} data…
        } @else if (summary(); as value) {
          {{ summaryLead() }}:
          @if (value.showMoney) {
            <strong>{{ formatValue(value.stockInValue) }} in</strong>,
            <strong>{{ formatValue(value.stockOutValue) }} out</strong>
            — net <strong [class.bars__positive]="value.netValue >= 0" [class.bars__negative]="value.netValue < 0">
              {{ value.netValue > 0 ? '+' : value.netValue < 0 ? '−' : '' }}{{ formatValue(abs(value.netValue)) }}
            </strong>
          } @else {
            <strong>{{ value.stockIn }} {{ unitLabel(value.stockIn) }} in</strong>,
            <strong>{{ value.stockOut }} {{ unitLabel(value.stockOut) }} out</strong>
            — net <strong [class.bars__positive]="value.netUnits >= 0" [class.bars__negative]="value.netUnits < 0">
              {{ value.netUnits > 0 ? '+' : value.netUnits < 0 ? '−' : '' }}{{ abs(value.netUnits) }} {{ unitLabel(value.netUnits) }}
            </strong>
          }
          · value
          @if (value.valueChangePercent !== null) {
            <strong [class.bars__positive]="value.valueChangePercent >= 0" [class.bars__negative]="value.valueChangePercent < 0">
              {{ value.valueChangePercent >= 0 ? '↗' : '↘' }}
              {{ abs(value.valueChangePercent).toFixed(1) }}%
            </strong>
            on last {{ periodLabel().toLowerCase() }}
          } @else {
            <strong>unavailable</strong>
          }
        } @else if (error()) {
          <span class="bars__error">Chart data unavailable: {{ error() }}</span>
        }
      </p>
    </div>
  `,
  styles: `
    .bars {
      height: 218px;
      position: relative;
    }
    .bars--loading { opacity: 0.72; }
    .bars__summary {
      min-height: 20px;
      margin: 8px 0 0;
      color: var(--faint);
      font-size: 10px;
      line-height: 1.5;
      font-variant-numeric: tabular-nums;
    }
    .bars__summary strong { color: var(--text); }
    .bars__positive { color: var(--good) !important; }
    .bars__negative, .bars__error { color: var(--bad) !important; }
    .bars--expanded {
      height: calc(100vh - 140px);
    }
    .bars__plot {
      position: relative;
      height: 100%;
    }
    .bars__axis {
      position: absolute;
      inset: 0 0 28px 44px;
      z-index: 0;
    }
    .bars__months {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: stretch;
      min-width: 0;
    }
    .bars__grid {
      position: absolute;
      left: -44px;
      right: 0;
      height: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--faint);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }
    .bars__grid span {
      width: 36px;
      flex: none;
      text-align: left;
    }
    .bars__grid i {
      flex: 1;
      border-top: 1px dashed var(--line);
    }
    .bars__col {
      position: relative;
      z-index: 1;
      flex: 1;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 28px;
      align-items: stretch;
      min-width: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .bars__col:focus-visible {
      z-index: 2;
    }
    .bars__track {
      position: relative;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      width: 100%;
      min-height: 0;
      padding: 0 2px;
    }
    .bars__highlight {
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: 10px 10px 0 0;
      background: transparent;
    }
    .bars__col.is-selected .bars__highlight {
      background: color-mix(in srgb, var(--ochre) 12%, transparent);
    }
    .bars__bar {
      flex: 0 0 7px;
      position: relative;
      z-index: 1;
      border-radius: 2px 2px 0 0;
      min-height: 2px;
      transition: height 0.6s var(--ease);
    }
    .bars__bar--in {
      border-inline: 1px solid color-mix(in srgb, var(--good) 28%, transparent);
      background: linear-gradient(to bottom, var(--good) 0 3px, color-mix(in srgb, var(--good) 14%, var(--sd-card)) 3px);
    }
    .bars__bar--out {
      border-inline: 1px solid color-mix(in srgb, var(--bad) 28%, transparent);
      background: linear-gradient(to bottom, var(--bad) 0 3px, color-mix(in srgb, var(--bad) 14%, var(--sd-card)) 3px);
    }
    .bars__bar--val {
      border-inline: 1px solid color-mix(in srgb, var(--sky) 28%, transparent);
      background: linear-gradient(to bottom, var(--sky) 0 3px, color-mix(in srgb, var(--sky) 14%, var(--sd-card)) 3px);
    }
    .bars__lab {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 500;
      color: var(--faint);
      text-align: center;
    }
    .bars__col.is-selected .bars__lab {
      color: var(--text);
      font-weight: 700;
    }
    .bars__tooltip {
      position: absolute;
      z-index: 3;
      top: 0;
      width: 140px;
      display: grid;
      gap: 5px;
      padding: 10px 12px;
      border: 1px solid var(--line-2);
      border-radius: 12px;
      background: var(--sd-card);
      box-shadow: var(--sd-shadow);
      font-size: 8px;
      transform: translateX(-50%);
    }
    .bars__tooltip strong {
      margin-bottom: 2px;
    }
    .bars__tooltip span {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--muted);
    }
    .bars__tooltip b {
      margin-left: auto;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
    .bars__key {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ochre);
      flex: none;
    }
    .bars__key--out { background: var(--bad); }
    .bars__key--val { background: var(--sky); }
    .bars__empty {
      position: absolute;
      inset: 0 0 28px 44px;
      display: grid;
      place-items: center;
      margin: 0;
      color: var(--faint);
      font-size: var(--fs-xs);
      text-align: center;
    }
    @media (max-width: 640px) {
      .bars { height: 280px; }
      .bars--expanded { height: calc(100vh - 140px); }
      .bars__axis { left: 38px; }
      .bars__grid { left: -38px; }
      .bars__track { gap: 1px; padding-inline: 1px; }
      .bars__tooltip { width: 132px; }
      .bars__empty { left: 38px; }
    }
  `,
})
export class Bars {
  readonly expanded = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly period = input<'weekly' | 'monthly' | 'quarterly'>('monthly');
  readonly data = input.required<{
    label: string;
    stockIn: number;
    stockOut: number;
    unitsOnHand: number;
    stockInValue: number | null;
    stockOutValue: number | null;
    stockValue: number | null;
  }[]>();
  protected readonly selectedMonth = signal('');

  protected readonly periodLabel = computed(() => this.period().slice(0, -2));
  protected readonly summaryLead = computed(() =>
    this.period() === 'weekly'
      ? 'This week so far'
      : this.period() === 'monthly'
        ? 'This month so far'
        : 'This quarter so far',
  );
  protected readonly summary = computed(() => {
    const rows = this.data();
    const current = rows.at(-1);
    const previous = rows.at(-2);
    if (!current || !previous) return null;
    const showMoney =
      current.stockInValue !== null &&
      current.stockOutValue !== null &&
      (current.stockIn > 0 || current.stockOut > 0 || current.stockValue !== null);
    const valueChangePercent =
      current.stockValue === null ||
      previous.stockValue === null ||
      previous.stockValue === 0
        ? null
        : ((current.stockValue - previous.stockValue) / previous.stockValue) * 100;
    return {
      showMoney,
      stockIn: current.stockIn,
      stockOut: current.stockOut,
      stockInValue: current.stockInValue,
      stockOutValue: current.stockOutValue,
      netValue:
        current.stockInValue !== null && current.stockOutValue !== null
          ? current.stockInValue - current.stockOutValue
          : 0,
      netUnits: current.stockIn - current.stockOut,
      valueChangePercent,
    };
  });

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected unitLabel(value: number): string {
    return Math.abs(value) === 1 ? 'unit' : 'units';
  }

  protected readonly hasValuedData = computed(() =>
    this.data().some((month) =>
      month.stockValue !== null ||
      (month.stockIn > 0 && month.stockInValue !== null) ||
      (month.stockOut > 0 && month.stockOutValue !== null),
    ),
  );

  protected readonly months = computed(() => {
    const rows = this.data();
    const allVals = rows.flatMap((r) => [r.stockInValue, r.stockOutValue, r.stockValue])
      .filter((value): value is number => value !== null);
    const max = this.scaleMax(allVals);
    return rows.map((r, index) => ({
      label: r.label,
      stockInValue: r.stockInValue,
      stockOutValue: r.stockOutValue,
      stockValue: r.stockValue,
      in: r.stockInValue === null ? null : (r.stockInValue / max) * 100,
      out: r.stockOutValue === null ? null : (r.stockOutValue / max) * 100,
      val: r.stockValue === null ? null : (r.stockValue / max) * 100,
      tipPosition: Math.max(14, Math.min(86, ((index + 0.5) / rows.length) * 100)),
    }));
  });

  protected readonly ticks = computed(() => {
    const rows = this.data();
    const values = rows.flatMap((row) => [row.stockInValue, row.stockOutValue, row.stockValue])
      .filter((value): value is number => value !== null);
    if (values.length === 0) return [];
    const max = this.scaleMax(values);
    return Array.from({ length: 6 }, (_, index) => ({
      label: this.formatAxisValue((max * index) / 5),
      position: (index / 5) * 100,
    }));
  });

  protected readonly selected = computed(
    () => this.months().find((month) => month.label === this.selectedMonth()) ?? this.months().at(-1),
  );
  protected readonly selectedLabel = computed(
    () => this.selectedMonth() || this.months().at(-1)?.label || '',
  );

  protected formatValue(value: number | null): string {
    return value === null
      ? 'Not recorded'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(value);
  }

  protected formatAxisValue(value: number): string {
    if (value >= 1000) return `$${Math.round(value / 1000)}k`;
    return `$${Math.round(value)}`;
  }

  protected selectMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  private scaleMax(values: number[]): number {
    const maxValue = Math.max(...values, 1000);
    const roughStep = maxValue / 5;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;
    const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    return niceStep * 5;
  }
}

@Component({
  selector: 'app-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gauge-wrap" [style.width.px]="size()">
      <svg viewBox="0 0 330 220" role="img" [attr.aria-label]="label() + ': ' + value() + ' ' + caption()">
        @for (t of ticks(); track t.i) {
          <line
            class="sd-tick"
            [class.sd-tick--on]="t.on"
            [attr.x1]="t.x1"
            [attr.y1]="t.y1"
            [attr.x2]="t.x2"
            [attr.y2]="t.y2"
          />
        }
        <text x="165" y="150" class="gauge__val" text-anchor="middle">{{ value() }}</text>
        <text x="165" y="174" class="gauge__lab" text-anchor="middle">{{ caption() }}</text>
      </svg>
    </div>
  `,
  styles: `
    .gauge-wrap {
      margin: 0 auto;
    }
    .sd-tick {
      stroke: var(--well);
      stroke-width: 2.4;
      stroke-linecap: round;
      transition: stroke 0.4s var(--ease);
    }
    .sd-tick--on {
      stroke: var(--ochre);
    }
    .gauge__val {
      font-size: 26px;
      font-weight: 500;
      fill: var(--text);
      letter-spacing: -0.02em;
    }
    .gauge__lab {
      font-size: 11px;
      fill: var(--faint);
      font-weight: 500;
    }
  `,
})
export class Gauge {
  readonly pct = input.required<number>();
  readonly value = input<string | number>('');
  readonly caption = input('');
  readonly size = input(240);
  readonly label = input('gauge');

  protected readonly ticks = computed(() => {
    const total = 84;
    const active = Math.round((Math.max(0, Math.min(this.pct(), 100)) / 100) * total);
    const pts = [];
    const r1 = 88;
    const r2 = 140;
    const cx = 165;
    const cy = 165;

    for (let i = 0; i < total; i++) {
      const angle = -90 + (i / (total - 1)) * 180;
      const rad = (angle * Math.PI) / 180;
      pts.push({
        i,
        on: i < active,
        x1: cx + r1 * Math.sin(rad),
        y1: cy - r1 * Math.cos(rad),
        x2: cx + r2 * Math.sin(rad),
        y2: cy - r2 * Math.cos(rad),
      });
    }
    return pts;
  });
}
