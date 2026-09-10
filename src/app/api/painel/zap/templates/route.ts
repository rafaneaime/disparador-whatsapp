import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { criarTemplateDoPainel, ErroCampanha } from '@/lib/zap/campanhas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await criarTemplateDoPainel(corpo));
  } catch (erro) {
    return NextResponse.json(
      {
        ok: false,
        erro: erro instanceof ErroCampanha ? erro.message : 'Não foi possível criar o template.',
      },
      { status: erro instanceof ErroCampanha ? erro.status : 503 },
    );
  }
}
