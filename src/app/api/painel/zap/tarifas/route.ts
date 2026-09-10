import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { apagarTarifa, salvarTarifa } from '@/lib/repo/zap-tarifas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIAS = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);

function recusar(erro: string, status = 400) {
  return NextResponse.json({ ok: false, erro }, { status });
}

export async function POST(request: Request) {
  if (!(await isLoggedIn())) return recusar('Sessão necessária.', 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return recusar('Corpo inválido.');
  }

  const pais = String(corpo.pais ?? '').replace(/\D/g, '');
  const categoria = String(corpo.categoria ?? '').toUpperCase();
  const valor = Number(corpo.valor);
  const moeda = String(corpo.moeda ?? '').trim().toUpperCase();
  const vigenteDesde = String(corpo.vigente_desde ?? '').trim();

  if (pais === '' || pais.length > 4) return recusar('Informe o DDI do país, só dígitos. Ex.: 55 para o Brasil.');
  if (!CATEGORIAS.has(categoria)) return recusar('Escolha entre marketing, utilidade e autenticação.');
  // Zero passaria como tarifa válida e faria a estimativa dizer que é de graça.
  if (!Number.isFinite(valor) || valor <= 0) return recusar('Informe o valor por mensagem, maior que zero.');
  if (!/^[A-Z]{3}$/.test(moeda)) return recusar('Informe a moeda com três letras. Ex.: USD.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) return recusar('Informe a data em que a tarifa passou a valer.');

  const id = await salvarTarifa({ pais, categoria, valor, moeda, vigente_desde: vigenteDesde });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  if (!(await isLoggedIn())) return recusar('Sessão necessária.', 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return recusar('Corpo inválido.');
  }

  const id = corpo.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    return recusar('Id inválido.');
  }
  await apagarTarifa(id);
  return NextResponse.json({ ok: true });
}
