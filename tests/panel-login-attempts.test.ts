import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ attempts: 0, query: '' }));
vi.mock('@/lib/db', () => ({
  sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    db.query = strings.join('?');
    const limit = Number(values[0]);
    // Model the row-level serialization of a conflicting PostgreSQL upsert.
    if (db.attempts >= limit) return [];
    db.attempts += 1;
    return [{ id: 1 }];
  },
}));

import { reserveLoginAttempt } from '@/lib/repo/panel-login-attempts';

describe('atomic login attempt reservation', () => {
  it('admits at most 25 simultaneous password checks', async () => {
    db.attempts = 0;
    const results = await Promise.all(Array.from({ length: 100 }, () => reserveLoginAttempt()));
    expect(results.filter(Boolean)).toHaveLength(25);
    expect(db.attempts).toBe(25);
    expect(db.query).toMatch(/insert into panel_login_attempts[\s\S]*on conflict \(id\) do update[\s\S]*where[\s\S]*failures < \?[\s\S]*returning id/i);
  });
});
