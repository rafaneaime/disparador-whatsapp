import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  createSession,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  temSenhaConfigurada,
  isLoggedIn,
} from '@/lib/auth';
import { reserveLoginAttempt, resetLoginFailures } from '@/lib/repo/panel-login-attempts';

export const runtime = 'nodejs';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const configurada = temSenhaConfigurada();
  const loggedIn = await isLoggedIn();

  async function sair() {
    'use server';
    (await cookies()).delete(SESSION_COOKIE);
    redirect('/login');
  }

  async function entrar(formData: FormData) {
    'use server';
    const senha = String(formData.get('senha') ?? '');

    let allowed = false;
    try {
      allowed = await reserveLoginAttempt();
    } catch (error) {
      console.error('login: controle de tentativas indisponível; aplique a migração 024', error);
      redirect('/login?erro=config');
    }
    if (!allowed) redirect('/login?erro=limite');
    if (!checkPassword(senha)) redirect('/login?erro=1');
    await resetLoginFailures();

    (await cookies()).set(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    redirect('/');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-2xl font-semibold">Painel</h1>

      {loggedIn && (
        <form action={sair} className="mb-6">
          <button type="submit" className="rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-papel">
            Encerrar sessão
          </button>
        </form>
      )}

      {configurada ? (
        <p className="mb-6 text-sm text-tinta-fraca">
          Digite a senha definida em PANEL_PASSWORD.
        </p>
      ) : (
        /*
          Sem senha configurada, nenhuma senha funciona — e antes disso a
          pessoa só via a tela recusar tudo, para sempre, sem explicação. O
          login continua fechado de propósito: painel sem senha é painel
          aberto para quem souber o endereço.
        */
        <div className="mb-6 rounded-xl border border-caindo-tenue bg-caindo-tenue p-4 text-sm text-caindo-forte">
          <p className="font-medium">Esta instalação está sem senha de painel.</p>
          <p className="mt-1">
            Nenhuma senha vai funcionar até você criar a variável{' '}
            <code>PANEL_PASSWORD</code> nas configurações do seu projeto na
            Vercel e publicar de novo.
          </p>
        </div>
      )}

      <form action={entrar} className="flex flex-col gap-3">
        <input
          type="password"
          name="senha"
          autoFocus
          required
          placeholder="Senha"
          className="rounded-md border border-linha-forte px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-papel transition-colors hover:bg-tinta/90"
        >
          Entrar
        </button>
        {erro && (
          <p className="text-sm text-caindo-forte">
            {erro === 'limite'
              ? 'Muitas tentativas. Aguarde dez minutos e tente novamente.'
              : erro === 'config'
                ? 'Login indisponível: aplique a migração 024 no banco e tente novamente.'
                : 'Senha incorreta.'}
          </p>
        )}
      </form>
    </main>
  );
}
