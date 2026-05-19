import { NextResponse } from 'next/server';
import { SecurityRegistry } from '@claw/core/lib/registry/SecurityRegistry';

/**
 * GET /api/security/roles
 * Returns all registered user roles and their associated permissions.
 */
export async function GET() {
  try {
    const roles = SecurityRegistry.getAllUserRoles();
    const roleMap = roles.reduce(
      (acc, role) => {
        acc[role] = SecurityRegistry.getRolePermissions(role);
        return acc;
      },
      {} as Record<string, string[]>
    );

    return NextResponse.json({
      success: true,
      roles: roleMap,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
