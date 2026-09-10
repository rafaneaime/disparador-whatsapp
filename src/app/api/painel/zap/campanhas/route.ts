import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { criarCampanhaDoPainel, ErroCampanha } from '@/lib/zap/campanhas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!await isLoggedIn()) return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  try {
    const texto = await request.text();
    if (new TextEncoder().encode(texto).byteLength > 100 * 1024) {
      return NextResponse.json({ ok: false, erro: 'O corpo ultrapassa 100 KB.' }, { status: 413 });
    }
    let corpo: unknown;
    try { corpo = JSON.parse(texto); }
    catch { throw new ErroCampanha('Corpo inválido. Envie nome, templateId e contatos.'); }
    return NextResponse.json(await criarCampanhaDoPainel(corpo), { status: 201 });
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof ErroCampanha ? erro.message : 'Não foi possível criar a campanha.' },
      { status: erro instanceof ErroCampanha ? erro.status : 503 });
  }
}
