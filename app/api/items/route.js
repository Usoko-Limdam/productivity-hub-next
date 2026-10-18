import { NextResponse } from 'next/server';
import { authed } from '../../../lib/auth';
import { sql, init } from '../../../lib/db';
import { ownerWorkspace } from '../../../lib/workspaces';

const KINDS = ['task', 'note', 'diary', 'goal', 'project', 'sale', 'expense', 'setting', 'programme', 'cohort', 'learner', 'enrollment', 'instructor', 'session', 'lead'];
const EDUCATION = new Set(['programme', 'cohort', 'learner', 'enrollment', 'instructor', 'session', 'lead']);
const no = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function context(workspaceId) {
  await init();
  return typeof workspaceId === 'string' ? ownerWorkspace(workspaceId) : null;
}

async function validRelations(workspace, kind, data) {
  const exists = async (id, expected) => {
    if (typeof id !== 'string' || !id) return false;
    const rows = await sql`SELECT id FROM items WHERE id = ${id} AND workspace_id = ${workspace.id} AND kind = ${expected} LIMIT 1`;
    return rows.length > 0;
  };
  if (kind === 'cohort' && !(await exists(data.programmeId, 'programme'))) return false;
  if (kind === 'enrollment' && (!(await exists(data.learnerId, 'learner')) || !(await exists(data.cohortId, 'cohort')))) return false;
  if (kind === 'session' && data.cohortId && !(await exists(data.cohortId, 'cohort'))) return false;
  if (kind === 'sale' && data.enrollmentId && !(await exists(data.enrollmentId, 'enrollment'))) return false;
  return true;
}

export async function POST(req) {
  if (!(await authed())) return no();
  const { kind, id, data, workspaceId } = await req.json().catch(() => ({}));
  if (!KINDS.includes(kind) || typeof id !== 'string' || !id || id.length > 64) return bad('bad request');
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return bad('bad request');
  const json = JSON.stringify(data);
  if (json.length > 100_000) return bad('too large', 413);
  const workspace = await context(workspaceId);
  if (!workspace) return bad('Choose an active workspace first.', 409);
  if (EDUCATION.has(kind) !== (workspace.slug === 'bravestone-learning')) return bad('This record type is not available in the active workspace.', 403);
  if (!(await validRelations(workspace, kind, data))) return bad('Linked records must exist in this workspace.', 400);
  const rows = await sql`INSERT INTO items (id, kind, data, workspace_id) VALUES (${id}, ${kind}, ${json}::jsonb, ${workspace.id})
    ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, data = EXCLUDED.data
    WHERE items.workspace_id = EXCLUDED.workspace_id RETURNING id`;
  if (!rows.length) return bad('Record belongs to a different workspace.', 409);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await authed())) return no();
  const params = new URL(req.url).searchParams;
  const id = params.get('id') || '';
  if (!id || id.length > 64) return bad('bad request');
  const workspace = await context(params.get('workspaceId'));
  if (!workspace) return bad('Choose an active workspace first.', 409);
  await sql`DELETE FROM items WHERE id = ${id} AND workspace_id = ${workspace.id}`;
  return NextResponse.json({ ok: true });
}
