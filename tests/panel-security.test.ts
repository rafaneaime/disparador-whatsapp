import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, verifySession } from '@/lib/auth';
import { authorizeCron } from '@/lib/cron-auth';
import { MAX_WEBHOOK_BYTES, readWebhookBody } from '@/lib/webhook-body';

const originalPassword = process.env.PANEL_PASSWORD;
const originalCron = process.env.CRON_SECRET;
afterEach(() => {
  if (originalPassword === undefined) delete process.env.PANEL_PASSWORD;
  else process.env.PANEL_PASSWORD = originalPassword;
  if (originalCron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCron;
});

describe('signed panel session', () => {
  it('expires, rejects tampering, and rotates with the password', () => {
    process.env.PANEL_PASSWORD = 'test-password';
    const now = 1_800_000_000_000;
    const issued = createSession(now);
    expect(verifySession(issued, now + 1)).toBe(true);
    expect(verifySession(issued, now + 8 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(verifySession(`${issued}x`, now + 1)).toBe(false);
    process.env.PANEL_PASSWORD = 'new-password';
    expect(verifySession(issued, now + 1)).toBe(false);
  });
});

describe('cron authorization', () => {
  const request = (authorization?: string) => new Request('https://example.test/cron', {
    headers: authorization ? { authorization } : {},
  });
  it('fails closed when the secret is absent', async () => {
    delete process.env.CRON_SECRET;
    const denied = authorizeCron(request());
    expect(denied?.status).toBe(503);
    expect(await denied?.json()).toMatchObject({ erro: expect.stringContaining('CRON_SECRET') });
  });
  it('requires the configured bearer token', () => {
    process.env.CRON_SECRET = 'secret';
    expect(authorizeCron(request())?.status).toBe(401);
    expect(authorizeCron(request('Bearer wrong'))?.status).toBe(401);
    expect(authorizeCron(request('Bearer secret'))).toBeNull();
  });
});

describe('webhook body', () => {
  it('preserves a valid payload and rejects oversized input', async () => {
    const body = '{"ok":true}';
    expect(await readWebhookBody(new Request('https://example.test', { method: 'POST', body }))).toBe(body);
    const oversized = 'x'.repeat(MAX_WEBHOOK_BYTES + 1);
    expect(await readWebhookBody(new Request('https://example.test', { method: 'POST', body: oversized }))).toBeNull();
  });
});
