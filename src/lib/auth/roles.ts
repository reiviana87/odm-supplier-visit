import type { UserRole } from "@/types/domain";

/**
 * Role hierarchy — architecture only (README §13 / Settings "Roles" tab).
 *
 * Phase 1 does not implement permission enforcement: nothing in the UI is
 * hidden or disabled by role yet. These predicates exist so the checks land in
 * one place when they are switched on, and so the Settings screens have a
 * vocabulary to render.
 *
 *   admin  >  manager  >  editor  >  viewer
 */
const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  editor: 1,
  manager: 2,
  admin: 3,
};

/** True when `role` sits at or above `minimum` in the hierarchy. */
export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Write report content, upload photographs, edit supplier records. */
export function canEdit(role: UserRole): boolean {
  return roleAtLeast(role, "editor");
}

/** Move a report through review, manage templates and members. */
export function canManage(role: UserRole): boolean {
  return roleAtLeast(role, "manager");
}

/** Organisation settings, roles and storage. */
export function canAdminister(role: UserRole): boolean {
  return roleAtLeast(role, "admin");
}
