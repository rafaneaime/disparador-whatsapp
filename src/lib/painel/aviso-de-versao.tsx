import { COMO_ATUALIZAR, ONDE_CONFERIR_VERSAO } from './navegacao';
import { fraseDaVersao, situacaoDaVersao } from '../versao';

/**
 * A faixa que diz que saiu versao nova.
 *
 * Fica no topo de todas as telas, e nao escondida na Configuracao: quem
 * precisa dela e justamente quem nao vai procurar. Some sozinha assim que a
 * instalacao estiver em dia — nada para fechar, nada para lembrar.
 *
 * O estado esta escrito ("Atualizacao disponivel"), nao pintado. Cor aqui e
 * reforco, nunca o recado.
 */
export async function AvisoDeVersao() {
  const situacao = await situacaoDaVersao(ONDE_CONFERIR_VERSAO);
  if (!situacao.atrasada || !situacao.maisNova) return null;

  return (
    <aside className="mb-6 rounded-xl border border-linha-forte bg-superficie px-4 py-3">
      <p className="text-sm">
        <strong>Atualização disponível.</strong>{' '}
        {fraseDaVersao(situacao.instalada, situacao.maisNova)}{' '}
        <a href={COMO_ATUALIZAR} target="_blank" rel="noopener noreferrer" className="underline">
          Como atualizar
        </a>
      </p>
      {situacao.novidades && (
        <p className="mt-1 text-sm text-tinta-media">{situacao.novidades}</p>
      )}
    </aside>
  );
}
