import { connection } from 'next/server';
import { conferirBanco } from '@/lib/repo/zap-banco';
import { lerCredenciais } from '@/lib/zap/credenciais';
import { montarDiagnostico, type Diagnostico, type Passo } from '@/lib/zap/diagnostico';
import { consultarNumero, listarTemplates, type ResultadoDaMeta } from '@/lib/zap/meta';

export const metadata = { title: 'Disparador de WhatsApp' };

const ESTADOS: Record<Diagnostico['estado'], string> = {
  nao_configurado: 'Não configurado', conectado: 'Conectado',
  degradado: 'Conexão com pendências', desconectado: 'Desconectado',
};
const PASSOS: Record<Passo['estado'], { rotulo: string; cor: string }> = {
  ok: { rotulo: 'Pronto', cor: 'bg-subindo-tenue text-subindo-forte' },
  falta: { rotulo: 'Falta configurar', cor: 'bg-interessado-tenue text-interessado-forte' },
  erro: { rotulo: 'Precisa de atenção', cor: 'bg-caindo-tenue text-caindo-forte' },
  opcional: { rotulo: 'Opcional', cor: 'bg-frio-tenue text-tinta-media' },
};
const QUALIDADES: Record<string, string> = { GREEN: 'Boa', YELLOW: 'Média', RED: 'Baixa', UNKNOWN: 'Ainda não informada' };

async function proteger<T>(consultar: () => Promise<ResultadoDaMeta<T>>): Promise<ResultadoDaMeta<T>> {
  try {
    return await consultar();
  } catch {
    // Exceções podem conter requisições, credenciais e ids. Nunca as ecoar.
    return { ok: false, erro: { tipo: 'transitorio', codigo: 'INESPERADO', humano: 'Não foi possível conferir a Meta agora.' } };
  }
}

/** Omite o campo inteiro se vier contaminado, inclusive por fragmentos de segredos. */
function campoSeguro(valor: string, segredos: string[]): string {
  if (/wamid/i.test(valor)) return 'Não exibido';
  for (const segredo of segredos.filter(Boolean)) {
    const tamanho = Math.min(6, segredo.length);
    for (let i = 0; i <= segredo.length - tamanho; i++) {
      if (valor.includes(segredo.slice(i, i + tamanho))) return 'Não exibido';
    }
  }
  return valor;
}

export default async function DisparadorPage() {
  // Next 16: não avaliar ambiente nem consultar Meta durante prerenderização.
  await connection();
  const credenciais = lerCredenciais(process.env);
  const chaveWebhook = process.env.META_APP_SECRET?.trim() ?? '';
  const creds = credenciais.credenciais;
  const buscar: typeof fetch = (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10_000) });
  const [banco, [numero, templates]] = await Promise.all([
    conferirBanco(),
    creds ? Promise.all([
      proteger(() => consultarNumero(creds, buscar)),
      proteger(() => listarTemplates(creds, buscar)),
    ]) : Promise.resolve([undefined, undefined] as const),
  ]);
  const diagnostico = montarDiagnostico({ credenciais, numero, templates, banco, webhookConfigurado: Boolean(chaveWebhook) });
  const dados = numero?.ok ? numero.dados : null;
  const segredos = [creds?.token ?? '', chaveWebhook];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[1.375rem] font-semibold tracking-tight">Disparador de WhatsApp</h1>
        <p className="mt-1 text-sm text-tinta-media">Confira os passos para conectar sua conta e fazer o primeiro disparo.</p>
        <a href="/disparador/contatos" className="mt-3 inline-block rounded-md border border-linha-forte px-3 py-2 text-sm font-medium hover:bg-papel">Gerenciar contatos</a>
        <a href="/disparador/campanhas" className="ml-2 mt-3 inline-block rounded-md border border-linha-forte px-3 py-2 text-sm font-medium hover:bg-papel">Gerenciar campanhas</a>
        <a href="/disparador/templates" className="ml-2 mt-3 inline-block rounded-md border border-linha-forte px-3 py-2 text-sm font-medium hover:bg-papel">Templates</a>
        <a href="/disparador/tarifas" className="ml-2 mt-3 inline-block rounded-md border border-linha-forte px-3 py-2 text-sm font-medium hover:bg-papel">Tarifas</a>
      </header>

      <section aria-labelledby="estado-conexao" className="rounded-lg border border-linha-forte p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="estado-conexao" className="font-semibold">{ESTADOS[diagnostico.estado]}</h2>
          {/* Navegação completa: a conferência também funciona sem JavaScript. */}
          <a href="/disparador" className="rounded-md border border-linha-forte px-3 py-2 text-sm font-medium hover:bg-papel">Conferir novamente</a>
        </div>
        <p className="mt-2 text-sm text-tinta-media">A conferência é feita na Meta a cada abertura. Siga as orientações dos passos pendentes abaixo.</p>
        {dados && (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-tinta-fraca">Número</dt><dd className="mt-1 break-words font-medium">{campoSeguro(dados.display_phone_number, segredos)}</dd></div>
            <div><dt className="text-tinta-fraca">Nome exibido</dt><dd className="mt-1 break-words font-medium">{campoSeguro(dados.verified_name, segredos)}</dd></div>
            <div><dt className="text-tinta-fraca">Qualidade</dt><dd className="mt-1 font-medium">{Object.hasOwn(QUALIDADES, dados.quality_rating) ? QUALIDADES[dados.quality_rating] : 'Ainda não informada'}</dd></div>
          </dl>
        )}
      </section>

      <ol aria-label="Passos da configuração" className="grid gap-3">
        {diagnostico.passos.map((passo, indice) => (
          <li key={passo.nome} className="rounded-lg border border-linha-forte p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{indice + 1}. {passo.nome}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PASSOS[passo.estado].cor}`}>{PASSOS[passo.estado].rotulo}</span>
            </div>
            {passo.oQueFazer && <p className="mt-2 break-words text-sm leading-relaxed text-tinta-media">{passo.oQueFazer}</p>}
            {passo.detalhe && <p className="mt-2 text-sm text-tinta-fraca">{passo.detalhe}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
