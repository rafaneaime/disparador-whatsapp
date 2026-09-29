import { sql } from '../db';

const MAX_FAILURES = 25;

/** Reserve before checking the password. PostgreSQL serializes conflicting upserts. */
export async function reserveLoginAttempt(): Promise<boolean> {
  const rows = (await sql`
    insert into panel_login_attempts (id, window_started_at, failures)
    values (1, now(), 1)
    on conflict (id) do update set
      window_started_at = case
        when panel_login_attempts.window_started_at < now() - interval '10 minutes'
          then now()
        else panel_login_attempts.window_started_at
      end,
      failures = case
        when panel_login_attempts.window_started_at < now() - interval '10 minutes'
          then 1
        else panel_login_attempts.failures + 1
      end
    where panel_login_attempts.window_started_at < now() - interval '10 minutes'
       or panel_login_attempts.failures < ${MAX_FAILURES}
    returning id
  `) as { id: number }[];
  return rows.length > 0;
}

export async function resetLoginFailures(): Promise<void> {
  await sql`delete from panel_login_attempts where id = 1`;
}
