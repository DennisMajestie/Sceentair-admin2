import { computeOverviewSpans, OverviewPresence } from './overview';

const ALL: OverviewPresence = {
  welcome: true,
  sales: true,
  open: true,
  approvals: true,
  chart: true,
  gauge: true,
  activities: true,
  alerts: true,
  sellers: true,
  ships: true,
  locations: true,
};

function withFlags(overrides: Partial<OverviewPresence>): OverviewPresence {
  return { ...ALL, ...overrides };
}

function cols(span: string): number {
  return span ? Number(span.replace('span ', '')) : 0;
}

function rowSum(flags: OverviewPresence, spans: string[]): number {
  return spans
    .filter((key) => (flags as unknown as Record<string, boolean>)[key])
    .map((key) => cols((computeOverviewSpans(flags) as unknown as Record<string, string>)[key]))
    .reduce((a, b) => a + b, 0);
}

describe('computeOverviewSpans (12-column grid)', () => {
  it('row 1: welcome and three KPI cards each span three columns', () => {
    const s = computeOverviewSpans(withFlags({}));
    expect(s.welcome).toBe('span 3');
    expect(s.sales).toBe('span 3');
    expect(s.open).toBe('span 3');
    expect(s.approvals).toBe('span 3');
  });

  it('row 1: two KPI cards share the remaining space beside the welcome block', () => {
    const cases: Partial<OverviewPresence>[] = [
      { approvals: false },
      { open: false },
      { sales: false },
    ];
    for (const c of cases) {
      const s = computeOverviewSpans(withFlags(c));
      const live = (['sales', 'open', 'approvals'] as const).filter(
        (k) => (s as unknown as Record<string, string>)[k] !== '',
      );
      expect(live.length).toBe(2);
      expect(s.welcome).toBe('span 3');
      expect(live.map((k) => cols((s as unknown as Record<string, string>)[k])).sort()).toEqual([4, 5]);
    }
  });

  it('row 1: a single KPI card takes the remaining nine columns', () => {
    for (const only of ['sales', 'open', 'approvals'] as const) {
      const s = computeOverviewSpans(
        withFlags({ sales: only === 'sales', open: only === 'open', approvals: only === 'approvals' }),
      );
      expect(s.welcome).toBe('span 3');
      expect((s as unknown as Record<string, string>)[only]).toBe('span 9');
    }
  });

  it('row 1: no figure cards gives the welcome block all 48 columns', () => {
    const s = computeOverviewSpans(withFlags({ sales: false, open: false, approvals: false }));
    expect(s.welcome).toBe('span 12');
    expect(s.sales).toBe('');
    expect(s.open).toBe('');
    expect(s.approvals).toBe('');
  });

  it('row 1: without the welcome block the figure cards split all 12 columns', () => {
    expect(computeOverviewSpans(withFlags({ welcome: false })).sales).toBe('span 4');
    expect(computeOverviewSpans(withFlags({ welcome: false, approvals: false })).open).toBe('span 6');
    expect(
      computeOverviewSpans(withFlags({ welcome: false, approvals: false, open: false })).sales,
    ).toBe('span 12');
  });

  it('row 2: the chart spans eight and the gauge four when both are present', () => {
    const s = computeOverviewSpans(withFlags({}));
    expect(s.chart).toBe('span 8');
    expect(s.gauge).toBe('span 4');
  });

  it('row 2: a lone chart or lone gauge spans all 12 columns', () => {
    expect(computeOverviewSpans(withFlags({ gauge: false })).chart).toBe('span 12');
    expect(computeOverviewSpans(withFlags({ chart: false })).gauge).toBe('span 12');
    const none = computeOverviewSpans(withFlags({ chart: false, gauge: false }));
    expect(none.chart).toBe('');
    expect(none.gauge).toBe('');
  });

  it('row 3: three cards span 16 each', () => {
    const s = computeOverviewSpans(withFlags({}));
    expect(s.activities).toBe('span 4');
    expect(s.alerts).toBe('span 4');
    expect(s.sellers).toBe('span 4');
  });

  it('row 3: two cards span six each regardless of the pair', () => {
    const pairs: Partial<OverviewPresence>[] = [
      { sellers: false },
      { alerts: false },
      { activities: false },
    ];
    for (const c of pairs) {
      const s = computeOverviewSpans(withFlags(c));
      const live = (['activities', 'alerts', 'sellers'] as const).filter(
        (k) => (s as unknown as Record<string, string>)[k] !== '',
      );
      expect(live.length).toBe(2);
      for (const k of live) {
        expect((s as unknown as Record<string, string>)[k]).toBe('span 6');
      }
    }
  });

  it('row 3: a lone card spans all 12 columns', () => {
    for (const only of ['activities', 'alerts', 'sellers'] as const) {
      const s = computeOverviewSpans(
        withFlags({
          activities: only === 'activities',
          alerts: only === 'alerts',
          sellers: only === 'sellers',
        }),
      );
      expect((s as unknown as Record<string, string>)[only]).toBe('span 12');
    }
  });

  it('row 4: ships spans seven and stock by location five when both are present', () => {
    const s = computeOverviewSpans(withFlags({}));
    expect(s.ships).toBe('span 7');
    expect(s.locations).toBe('span 5');
  });

  it('row 4: a lone card spans all 12 columns', () => {
    expect(computeOverviewSpans(withFlags({ locations: false })).ships).toBe('span 12');
    expect(computeOverviewSpans(withFlags({ ships: false })).locations).toBe('span 12');
  });

  it('every filled row sums to exactly 12 columns for all flag combinations', () => {
    const keys: (keyof OverviewPresence)[] = [
      'welcome', 'sales', 'open', 'approvals', 'chart', 'gauge',
      'activities', 'alerts', 'sellers', 'ships', 'locations',
    ];
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const flags = { ...ALL };
      keys.forEach((k, i) => {
        flags[k] = (mask & (1 << i)) !== 0;
      });
      const s = computeOverviewSpans(flags);
      const row1 = rowSum(flags, ['welcome', 'sales', 'open', 'approvals']);
      const row2 = rowSum(flags, ['chart', 'gauge']);
      const row3 = rowSum(flags, ['activities', 'alerts', 'sellers']);
      const row4 = rowSum(flags, ['ships', 'locations']);
      for (const [name, sum] of [['row1', row1], ['row2', row2], ['row3', row3], ['row4', row4]] as const) {
        if (sum > 0) {
          expect(`${name}=${sum}`).toBe(`${name}=12`);
        }
      }
    }
  });
});
