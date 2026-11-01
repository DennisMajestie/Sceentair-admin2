import {
  calculateSeatUsage,
  filterTeamMembers,
  teamRoleCounts,
  teamStatusTone,
  TeamMemberRow,
} from './team';

function member(overrides: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: 'member-1',
    name: 'Avery Lane',
    email: 'avery@example.test',
    title: 'Warehouse lead',
    role: 'manager',
    roleLabel: 'Manager',
    status: 'Active',
    statusTone: 'good',
    isMe: false,
    initials: 'AL',
    avatarTone: 'pine',
    ...overrides,
  };
}

describe('Team & roles helpers', () => {
  it('filters members by role and by name, email, or title', () => {
    const rows = [
      member(),
      member({
        id: 'member-2',
        name: 'Jordan Reed',
        email: 'jordan@example.test',
        title: 'Finance',
        role: 'viewer',
        roleLabel: 'Viewer',
      }),
    ];

    expect(filterTeamMembers(rows, 'manager', '').map((row) => row.id)).toEqual(['member-1']);
    expect(filterTeamMembers(rows, 'all', 'JORDAN').map((row) => row.id)).toEqual(['member-2']);
    expect(filterTeamMembers(rows, 'all', 'example.test').length).toBe(2);
    expect(filterTeamMembers(rows, 'viewer', 'warehouse')).toEqual([]);
  });

  it('counts only roles present in the member data', () => {
    const counts = teamRoleCounts([
      member(),
      member({ id: 'member-2', role: 'manager' }),
      member({ id: 'member-3', role: 'viewer', roleLabel: 'Viewer' }),
    ]);

    expect(counts).toEqual([
      { id: 'manager', label: 'Manager', count: 2 },
      { id: 'viewer', label: 'Viewer', count: 1 },
    ]);
  });

  it('maps known statuses to distinct tones and unknown statuses to neutral', () => {
    expect(teamStatusTone('active')).toBe('good');
    expect(teamStatusTone('Away')).toBe('warn');
    expect(teamStatusTone('invited')).toBe('info');
    expect(teamStatusTone('deactivated')).toBe('neutral');
  });

  it('calculates seat use and safely handles empty or exceeded limits', () => {
    expect(calculateSeatUsage(10, 12)).toEqual({
      used: 10,
      limit: 12,
      left: 2,
      percent: (10 / 12) * 100,
    });
    expect(calculateSeatUsage(0, 12)?.percent).toBe(0);
    expect(calculateSeatUsage(14, 12)).toEqual({
      used: 14,
      limit: 12,
      left: 0,
      percent: 100,
    });
    expect(calculateSeatUsage(4, 0)).toBeNull();
  });
});
