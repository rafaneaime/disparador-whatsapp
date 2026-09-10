import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  sessionValue,
  checkPassword,
  temSenhaConfigurada,
} from '@/lib/auth';

export const runtime = 'nodejs';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const configurada = temSenhaConfigurada();

  async function entrar(formData: FormData) {
    'use server';
    const senha = String(formData.get('senha') ?? '');

    if (!checkPassword(senha)) redirect('/login?erro=1');

    (await cookies()).set(SESSION_COOKIE, sessionValue(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect('/');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-2xl font-semibold">Painel</h1>

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
        {erro && <p className="text-sm text-caindo-forte">Senha incorreta.</p>}
      </form>
    </main>
  );
}
