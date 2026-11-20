import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '../../core/store';
import {
  calculateSeatUsage,
  API_ROLES,
  CREATE_ROLES,
  hasApiRoleOption,
  roleLabelFor,
  filterTeamMembers,
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
    role: 'management',
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
  it('members dropdown offers the Wholesaler API role', () => {
    const ids: string[] = API_ROLES.map((role) => role.id);
    expect(ids).toContain('wholesaler');
    expect(ids).not.toContain('staff');
  });

  it('create form offers only roles accepted by POST /users', () => {
    const ids: string[] = CREATE_ROLES.map((role) => role.id);
    expect(ids).not.toContain('staff');
    expect(ids).toContain('sales');
    expect(ids).toContain('wholesaler');
  });

  it('filters members by their real API role and by name, email, or title', () => {
    const rows = [
      member(),
      member({
        id: 'member-2',
        name: 'Jordan Reed',
        email: 'jordan@example.test',
        title: 'Finance',
        role: 'wholesaler',
        roleLabel: 'Wholesaler',
      }),
    ];

    expect(filterTeamMembers(rows, 'management', '').map((row) => row.id)).toEqual(['member-1']);
    expect(filterTeamMembers(rows, 'wholesaler', '').map((row) => row.id)).toEqual(['member-2']);
    expect(filterTeamMembers(rows, 'all', 'JORDAN').map((row) => row.id)).toEqual(['member-2']);
    expect(filterTeamMembers(rows, 'all', 'example.test').length).toBe(2);
    expect(filterTeamMembers(rows, 'wholesaler', 'warehouse')).toEqual([]);
  });

  it('counts each API role present instead of collapsing roles into four buckets', () => {
    const counts = teamRoleCounts([
      member(),
      member({ id: 'member-2', role: 'management' }),
      member({ id: 'member-3', role: 'wholesaler', roleLabel: 'Wholesaler' }),
      member({ id: 'member-4', role: 'sales', roleLabel: 'Sales' }),
    ]);

    expect(counts).toEqual([
      { id: 'management', label: 'Manager', count: 2 },
      { id: 'sales', label: 'Sales', count: 1 },
      { id: 'wholesaler', label: 'Wholesaler', count: 1 },
    ]);
  });

  it('only offers roles the API accepts', () => {
    expect(hasApiRoleOption('wholesaler')).toBeTrue();
    expect(hasApiRoleOption('viewer')).toBeFalse();
  });

  it('labels unknown API roles instead of falling back to Admin', () => {
    expect(roleLabelFor('wholesaler')).toBe('Wholesaler');
    expect(roleLabelFor('regional_manager')).toBe('Regional Manager');
    expect(teamRoleCounts([member({ role: 'regional_manager' })])).toEqual([
      { id: 'regional_manager', label: 'Regional Manager', count: 1 },
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