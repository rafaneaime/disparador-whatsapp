import { Cartao, Chip, Secao, TituloDaTela, Vazio } from '@/lib/painel/ui';
import { listarTemplates, type TemplateZap } from '@/lib/repo/zap-templates';
import { EditorDeTemplate, type TemplateExistente } from './editor-de-template';
import { SincronizarTemplates } from './sincronizar-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESTADOS: Record<string, string> = {
  draft: 'Rascunho',
  submitting: 'Enviando',
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  paused: 'Pausado',
  disabled: 'Desativado',
};

const CATEGORIAS: Record<string, string> = {
  UTILITY: 'utilidade',
  MARKETING: 'marketing',
  AUTHENTICATION: 'autenticação',
};

const categoria = (valor: string | null) =>
  valor === null ? '—' : CATEGORIAS[valor] ?? valor.toLowerCase();

/**
 * O texto do corpo, quando sabemos qual é.
 *
 * Template sincronizado da Meta chega sem componentes — a listagem dela não os
 * traz. Por isso "duplicar e corrigir" só preenche a mensagem dos que foram
 * criados por aqui; nos outros, o editor abre com o nome novo e o corpo vazio,
 * em vez de inventar um texto que não é o de lá.
 */
function corpoDoTemplate(componentes: unknown): string {
  if (!Array.isArray(componentes)) return '';
  for (const parte of componentes) {
    const p = parte as { type?: unknown; text?: unknown };
    if (String(p?.type).toUpperCase() === 'BODY' && typeof p.text === 'string') return p.text;
  }
  return '';
}

const paraEditor = (t: TemplateZap): TemplateExistente => ({
  id: t.id,
  nome: t.nome,
  idioma: t.idioma,
  estado: t.estado,
  categoria_pedida: t.categoria_pedida,
  categoria_meta: t.categoria_meta,
  corpo: corpoDoTemplate(t.componentes),
});

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string }>;
}) {
  const { duplicar } = await searchParams;
  const templates = await listarTemplates();
  const existentes = templates.map(paraEditor);
  const partirDe = existentes.find((t) => String(t.id) === duplicar);

  return (
    <div>
      <a href="/disparador" className="mb-4 inline-block text-sm text-tinta-media hover:underline">
        Voltar ao disparador
      </a>
      <TituloDaTela
        titulo="Templates"
        pergunta="O que a Meta já aprovou para você enviar, e o que ainda está em análise."
      />

      <EditorDeTemplate existentes={existentes} partirDe={partirDe} />

      <Secao
        titulo="Templates da sua conta"
        descricao="O estado vem da Meta. Clique em sincronizar depois de submeter, para ver se saiu da análise."
      >
        <SincronizarTemplates />
        {templates.length === 0 ? (
          <Vazio>Nenhum template ainda. Sincronize para trazer os que já existem na Meta.</Vazio>
        ) : (
          <Cartao>
            <ul className="divide-y divide-linha">
              {templates.map((t) => {
                const divergiu =
                  t.categoria_pedida !== null &&
                  t.categoria_meta !== null &&
                  t.categoria_pedida !== t.categoria_meta;

                return (
                  <li key={t.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-medium">{t.nome}</strong>
                      <span className="text-sm text-tinta-media">{t.idioma}</span>
                      <Chip>{ESTADOS[t.estado] ?? t.estado}</Chip>
                      {t.estado !== 'approved' ? null : (
                        <a
                          href={`/disparador/templates?duplicar=${t.id}`}
                          className="text-sm text-tinta-media hover:underline"
                        >
                          duplicar e corrigir
                        </a>
                      )}
                    </div>

                    {divergiu ? (
                      <p className="mt-2 text-sm">
                        Você pediu <strong>{categoria(t.categoria_pedida)}</strong> e a Meta
                        classificou como <strong>{categoria(t.categoria_meta)}</strong>. A cobrança
                        segue a dela.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-tinta-media">
                        Categoria: {categoria(t.categoria_meta ?? t.categoria_pedida)}
                      </p>
                    )}

                    {t.motivo_rejeicao && (
                      <p className="mt-2 text-sm">
                        Motivo da rejeição: <strong>{t.motivo_rejeicao}</strong>. Ajuste o texto e
                        crie uma versão nova — o nome não pode ser reaproveitado.
                      </p>
                    )}

                    {corpoDoTemplate(t.componentes) && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-tinta-media">
                        {corpoDoTemplate(t.componentes)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Cartao>
        )}
      </Secao>
    </div>
  );
}
