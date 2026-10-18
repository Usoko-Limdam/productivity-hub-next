import { authed } from '../lib/auth';
import { sql, init } from '../lib/db';
import { activeOwnerWorkspace, listOwnerWorkspaces } from '../lib/workspaces';
import App from '../components/App';
import Login from '../components/Login';
import WorkspacePicker from '../components/WorkspacePicker';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await authed())) return <Login />;
  await init();
  const [workspaces, workspace] = await Promise.all([listOwnerWorkspaces(), activeOwnerWorkspace()]);
  if (!workspace) return <WorkspacePicker workspaces={workspaces} />;
  const items = await sql`SELECT id, kind, data FROM items WHERE workspace_id = ${workspace.id} ORDER BY created_at`;
  return <App key={workspace.id} initial={items} workspace={workspace} workspaces={workspaces} />;
}
