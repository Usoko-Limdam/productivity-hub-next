import { authed } from '../lib/auth';
import { sql, init } from '../lib/db';
import App from '../components/App';
import Login from '../components/Login';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await authed())) return <Login />;
  await init();
  const items = await sql`SELECT id, kind, data FROM items ORDER BY created_at`;
  return <App initial={items} />;
}
