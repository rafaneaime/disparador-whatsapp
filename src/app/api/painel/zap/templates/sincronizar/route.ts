import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { sincronizarTemplatesDoPainel, ErroCampanha } from '@/lib/zap/campanhas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!await isLoggedIn()) return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  try {
    return NextResponse.json(await sincronizarTemplatesDoPainel());
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof ErroCampanha ? erro.message : 'Não foi possível sincronizar os templates.' },
      { status: erro instanceof ErroCampanha ? erro.status : 503 });
  }
}
