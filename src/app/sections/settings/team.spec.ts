import {
  calculateSeatUsage,
  applyTeamPermissionOverrides,
  filterTeamMembers,
  hasRoleAccess,
  teamPermissionRows,
  teamRoleCounts,
  teamStatusCounts,
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

  it('counts active members and pending invites from their API statuses', () => {
    expect(
      teamStatusCounts([
        member({ status: 'Active' }),
        member({ id: 'member-2', status: 'away' }),
        member({ id: 'member-3', status: 'invited' }),
        member({ id: 'member-4', status: 'pending' }),
      ]),
    ).toEqual({ active: 1, pending: 2 });
  });

  it('builds a permission matrix only from API-provided role permissions', () => {
    expect(
      teamPermissionRows([
        member({ permissions: [{ module: 'orders', accessLevel: 'read' }] }),
        member({
          id: 'member-2',
          role: 'staff',
          permissions: [{ module: 'orders', accessLevel: 'write' }],
        }),
      ]),
    ).toEqual([
      { module: 'orders', access: { manager: 'read', staff: 'write' } },
    ]);
  });

  it('distinguishes no-access levels from granted API access', () => {
    expect(hasRoleAccess('read')).toBeTrue();
    expect(hasRoleAccess('full')).toBeTrue();
    expect(hasRoleAccess('none')).toBeFalse();
    expect(hasRoleAccess(undefined)).toBeFalse();
  });

  it('applies permission checkbox overrides without mutating the source rows', () => {
    const rows = [{ module: 'orders', access: { admin: 'full', manager: 'view' } }] as const;
    const updated = applyTeamPermissionOverrides(rows, {
      orders: { admin: false, manager: false, staff: true },
    });

    expect(updated).toEqual([{ module: 'orders', access: { staff: 'full' } }]);
    expect(rows[0].access).toEqual({ admin: 'full', manager: 'view' });
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
