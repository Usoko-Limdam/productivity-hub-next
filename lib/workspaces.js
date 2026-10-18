import { cookies } from 'next/headers';
import { sql } from './db';

// The current application has one password-protected owner account, not a user table.
// Keep this principal stable so workspace membership can be introduced without duplicate accounts.
export const OWNER_PRINCIPAL = 'owner';
export const WORKSPACE_COOKIE = 'workhub-workspace';

export async function listOwnerWorkspaces() {
  return sql`SELECT w.id, w.slug, w.name, w.business_type AS "businessType",
    w.description, w.brand, w.active, w.modules FROM business_workspaces w
    JOIN workspace_memberships m ON m.workspace_id = w.id
    WHERE m.principal_id = ${OWNER_PRINCIPAL} AND w.active = true
    ORDER BY w.name`;
}

export async function ownerWorkspace(id) {
  const rows = await sql`SELECT w.id, w.slug, w.name, w.business_type AS "businessType",
    w.description, w.brand, w.active, w.modules FROM business_workspaces w
    JOIN workspace_memberships m ON m.workspace_id = w.id
    WHERE m.principal_id = ${OWNER_PRINCIPAL} AND w.id = ${id} AND w.active = true
    LIMIT 1`;
  return rows[0] || null;
}

export async function activeOwnerWorkspace() {
  const id = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return id ? ownerWorkspace(id) : null;
}
