import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Store } from '../../core/store';
import { ToastService } from '../../core/toast';
import { ApiRoleMatrixRow, UsersApiService } from '../../core/users-api.service';
import {
  calculateSeatUsage,
  filterTeamMembers,
  teamRoleCounts,
  teamStatusCounts,
  teamStatusTone,
  SettingsTeam,
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

const TEST_PERMISSION_MATRIX: ApiRoleMatrixRow[] = [
  {
    id: 'role-owner',
    name: 'business_owner_admin',
    permissions: [
      { module: 'inventory', accessLevel: 'full' },
      { module: 'staff_access', accessLevel: 'full' },
    ],
  },
];

async function setupPermissionPage(staffAccess: string) {
  const api = jasmine.createSpyObj('UsersApiService', ['rolesMatrix', 'updateRolePermissions']);
  api.rolesMatrix.and.returnValue(Promise.resolve(TEST_PERMISSION_MATRIX));
  api.updateRolePermissions.and.returnValue(Promise.resolve({}));
  const toast = jasmine.createSpyObj('ToastService', ['show', 'dismiss']);
  const authUser = signal({
    id: 'user-admin',
    email: 'admin@example.test',
    role: 'business_owner_admin',
    access: { staff_access: staffAccess },
  });
  const store = {
    team: signal([]),
    settings: signal({ billing: { plan: 'Test', seats: 12 }, me: { id: 'user-admin' } }),
    location: () => undefined,
    setTeammateRole: jasmine.createSpy('setTeammateRole'),
  } as unknown as Store;

  TestBed.configureTestingModule({
    imports: [SettingsTeam],
    providers: [
      { provide: UsersApiService, useValue: api },
      { provide: AuthService, useValue: { user: authUser } },
      { provide: ToastService, useValue: toast },
      { provide: Store, useValue: store },
      { provide: PLATFORM_ID, useValue: 'server' },
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(SettingsTeam);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, toast };
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

describe('team role permission editor', () => {
  it('loads access from the API and toggles the checkbox draft without saving', async () => {
    const { fixture, api } = await setupPermissionPage('full');
    const page = fixture.componentInstance as any;
    const roleName = 'business_owner_admin';
    const checkbox = fixture.nativeElement.querySelector(
      `[name="access-${roleName}-inventory"]`,
    ) as HTMLInputElement;
    const level = fixture.nativeElement.querySelector(
      `[name="level-${roleName}-inventory"]`,
    ) as HTMLSelectElement;

    expect(api.rolesMatrix).toHaveBeenCalled();
    expect(checkbox.checked).toBeTrue();
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.edit()[roleName]['inventory']).toBe('none');
    expect(level.disabled).toBeTrue();

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(page.edit()[roleName]['inventory']).toBe('full');
    expect(level.disabled).toBeFalse();
    expect(api.updateRolePermissions).not.toHaveBeenCalled();
  });

  it('keeps staff access enabled and disables editing for users without full access', async () => {
    const { fixture } = await setupPermissionPage('view');
    const page = fixture.componentInstance as any;
    const roleName = 'business_owner_admin';
    const checkbox = fixture.nativeElement.querySelector(
      `[name="access-${roleName}-staff_access"]`,
    ) as HTMLInputElement;

    expect(checkbox.disabled).toBeTrue();
    page.setAccess('staff_access', roleName, false);
    expect(page.edit()[roleName]['staff_access']).toBe('full');
    expect(fixture.nativeElement.querySelector('.permission-actions')).toBeNull();
    fixture.destroy();
  });

  it('confirms the role permission save and sends the complete draft to the API', async () => {
    const { fixture, api, toast } = await setupPermissionPage('full');
    const page = fixture.componentInstance as any;
    page.setLevel('inventory', 'business_owner_admin', 'approve');
    fixture.detectChanges();
    page.requestPermissionSave(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(api.updateRolePermissions).not.toHaveBeenCalled();

    await page.confirmPermissionSave();
    fixture.detectChanges();
    expect(api.updateRolePermissions).toHaveBeenCalledWith('business_owner_admin', [
      { module: 'inventory', accessLevel: 'approve' },
      { module: 'staff_access', accessLevel: 'full' },
    ]);
    expect(page.permissionDraftDirty()).toBeFalse();
    expect(toast.show).toHaveBeenCalledWith('Permissions saved for owner', 'good');
  });
});
