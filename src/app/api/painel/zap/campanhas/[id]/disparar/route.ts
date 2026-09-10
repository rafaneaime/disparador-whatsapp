import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { dispararLote, ErroCampanha, idValido } from '@/lib/zap/campanhas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isLoggedIn()) return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  const { id } = await params;
  if (!/^\d+$/.test(id) || !idValido(Number(id))) return NextResponse.json({ ok: false, erro: 'O id da campanha é inválido.' }, { status: 400 });
  try {
    return NextResponse.json(await dispararLote(Number(id)));
  } catch (erro) {
    return NextResponse.json({ ok: false,
      erro: erro instanceof ErroCampanha ? erro.message : 'Não foi possível registrar o disparo. Confira o detalhe da campanha.',
      ...(erro instanceof ErroCampanha && erro.estado ? { estado: erro.estado } : {}) },
    { status: erro instanceof ErroCampanha ? erro.status : 503 });
  }
}
