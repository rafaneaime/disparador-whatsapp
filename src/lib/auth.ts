import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';

export const SESSION_COOKIE = 'adeus_sessao';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// O valor do cookie é derivado da senha: trocar PANEL_PASSWORD invalida
// todas as sessões automaticamente.
export function createSession(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `v1.${expires}`;
  const signature = createHmac('sha256', env.panelPassword()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function isLoggedIn(): Promise<boolean> {
  if (!temSenhaConfigurada()) return false;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(value);
}

export function verifySession(value: string | undefined, now = Date.now()): boolean {
  if (!temSenhaConfigurada() || !value || value.length > 100) return false;
  const match = /^v1\.([1-9]\d{9})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const expires = Number(match[1]);
  const current = Math.floor(now / 1000);
  if (expires <= current || expires > current + SESSION_MAX_AGE_SECONDS) return false;
  const expected = createHmac('sha256', env.panelPassword())
    .update(`v1.${match[1]}`).digest('hex');
  return safeEqual(match[2], expected);
}

/**
 * Existe senha de painel configurada nesta instalação?
 *
 * Sem `PANEL_PASSWORD`, `env.panelPassword()` lança — e antes disso o painel
 * respondia com erro 500 e o login não completava, sem nada dizendo por quê.
 * Quem instalasse e esquecesse essa variável ficava com um app que sobe, abre
 * a tela de login, e recusa qualquer senha para sempre.
 *
 * A saída **não** é deixar entrar. É dizer o que houve, e continuar recusando:
 * painel sem senha é painel aberto para quem souber o endereço.
 */
export function temSenhaConfigurada(): boolean {
  return (process.env.PANEL_PASSWORD ?? '').trim().length > 0;
}

export function checkPassword(attempt: string): boolean {
  // Sem senha configurada não existe senha certa. Recusar aqui é o que impede
  // o painel de virar público por omissão.
  if (!temSenhaConfigurada()) return false;
  return safeEqual(attempt, env.panelPassword());
}

export async function requirePanelSession(): Promise<void> {
  if (!(await isLoggedIn())) redirect('/login');
}
