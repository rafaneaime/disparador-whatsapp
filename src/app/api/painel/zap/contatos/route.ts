import { NextResponse } from 'next/server';
import { isLoggedIn } from '@/lib/auth';
import { lerColagem, type ResultadoColagem } from '@/lib/zap/colar';
import { inserirContatosColados, marcarDescadastro } from '@/lib/repo/zap-contacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function recusar(erro: string, status = 400) {
  return NextResponse.json({ ok: false, erro }, { status });
}

async function lerCorpo(request: Request): Promise<Record<string, unknown> | NextResponse> {
  // Como /api/collect: medir bytes reais do corpo inteiro antes de JSON.parse.
  const texto = await request.text();
  if (new TextEncoder().encode(texto).byteLength > 100 * 1024) {
    return recusar('O corpo ultrapassa 100 KB. Cole menos números por vez.', 413);
  }
  try {
    const recebido: unknown = JSON.parse(texto);
    if (typeof recebido === 'object' && recebido !== null && !Array.isArray(recebido)) {
      return recebido as Record<string, unknown>;
    }
  } catch {
    // JSON quebrado recebe a mesma orientação que um corpo de formato errado.
  }
  return recusar('Corpo inválido. Envie os números e a confirmação de consentimento obrigatória.');
}

export async function POST(request: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  }
  const corpo = await lerCorpo(request);
  if (corpo instanceof NextResponse) return corpo;
  // Não confiar na caixa do navegador nem aceitar valores truthy como "true".
  if (corpo.consentimento !== true) {
    return recusar('A confirmação de consentimento é obrigatória para cadastrar os contatos.');
  }
  if (typeof corpo.texto !== 'string') {
    return recusar('Cole os números em texto, um por linha.');
  }
  const origem = typeof corpo.origem === 'string' && corpo.origem.trim()
    ? corpo.origem.trim() : 'colado-no-painel';
  const colagem = lerColagem(corpo.texto, 1000);
  const cadastrados = new Set(await inserirContatosColados(colagem.validos, origem));
  const resultado: ResultadoColagem = {
    contagens: {
      validos: colagem.validos.length,
      repetidos: colagem.linhas.filter((linha) => linha.situacao === 'repetido').length,
      invalidos: colagem.linhas.filter((linha) => linha.situacao === 'invalido').length,
      cadastrados: cadastrados.size,
      existentes: colagem.validos.length - cadastrados.size,
    },
    linhas: colagem.linhas.map((linha) => linha.situacao === 'valido'
      ? { ...linha, resultado: cadastrados.has(linha.telefone) ? 'cadastrado' : 'existente' }
      : linha),
  };
  return NextResponse.json({ ok: true, ...resultado });
}

export async function DELETE(request: Request) {
  if (!(await isLoggedIn())) {
    return NextResponse.json({ ok: false, erro: 'Sessão necessária.' }, { status: 401 });
  }
  const corpo = await lerCorpo(request);
  if (corpo instanceof NextResponse) return corpo;
  if (typeof corpo.id !== 'number' || !Number.isSafeInteger(corpo.id) || corpo.id <= 0) {
    return recusar('O id do contato é inválido.');
  }
  await marcarDescadastro(corpo.id);
  return NextResponse.json({ ok: true });
}
