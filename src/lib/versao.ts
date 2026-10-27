import dados from '../../versao.json';

/**
 * Qual versao esta instalacao roda, e qual e a mais nova.
 *
 * Existe porque quem compra nao sabe que existe versao. Em 14/10/2026, um
 * comprador passou a manha achando que o painel dele estava quebrado: o
 * defeito ja estava corrigido havia dois dias, so nao tinha chegado nele.
 * Enquanto a atualizacao depender de alguem abrir o GitHub, o painel precisa
 * pelo menos AVISAR — isso sozinho transforma "esta quebrado" em "atualiza".
 *
 * A data vem de `versao.json`, que viaja dentro do pacote: a copia instalada
 * carrega a data do dia em que foi publicada. A mais nova vem do mesmo
 * arquivo no repositorio publico do produto, e qual e esse repositorio quem
 * diz e `navegacao.ts` — cada produto tem o seu. A Plataforma olha para o
 * repositorio da base porque os repositorios pagos sao privados, e tudo que
 * muda na base muda na Plataforma tambem.
 */
export const VERSAO_INSTALADA: string = dados.versao;
export const NOVIDADES_DA_VERSAO: string = dados.novidades;

/**
 * Data, com hora opcional: `2026-10-14` ou `2026-10-14T16:45`.
 *
 * A hora entrou porque publicacao acontece mais de uma vez no mesmo dia. So
 * com a data, quem atualizasse de manha ficava sem aviso da correcao da tarde
 * ate o dia seguinte — e a correcao da tarde costuma ser justamente a do
 * problema que a pessoa acabou de ter.
 *
 * O formato compara como texto, em ordem, com ou sem hora dos dois lados.
 */
const FORMATO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

/** `2026-10-14T16:45` vira `14/10/2026`. A hora serve para comparar, nao para ler. */
export function comoData(versao: string): string {
  if (!FORMATO.test(versao)) return versao;
  const [ano, mes, resto] = versao.split('-');
  return `${resto.slice(0, 2)}/${mes}/${ano}`;
}

function soODia(versao: string): string {
  return versao.slice(0, 10);
}

/**
 * A frase da faixa.
 *
 * Mora aqui, e nao no componente, porque ha um caso que so se ve escrevendo:
 * duas publicacoes no mesmo dia. "Seu painel esta na versao de 14/10/2026, e a
 * de 14/10/2026 ja saiu" e uma frase que faz quem le duvidar do painel.
 */
export function fraseDaVersao(instalada: string, maisNova: string): string {
  if (soODia(instalada) === soODia(maisNova)) {
    return `Saiu uma versão nova hoje, depois da que você instalou.`;
  }
  return (
    `Seu painel está na versão de ${comoData(instalada)}, ` +
    `e a de ${comoData(maisNova)} já saiu.`
  );
}

/**
 * Datas no formato ISO comparam como texto. Qualquer coisa fora do formato
 * responde "nao esta atrasada": na duvida, o painel fica calado. Um aviso
 * errado custa mais do que um aviso que falta — quem instalou nao tem como
 * saber que o aviso e que esta enganado.
 */
export function estaAtrasada(instalada: string, maisNova: string | null): boolean {
  if (!maisNova) return false;
  if (!FORMATO.test(instalada) || !FORMATO.test(maisNova)) return false;
  return instalada < maisNova;
}

export type SituacaoDaVersao = {
  instalada: string;
  maisNova: string | null;
  atrasada: boolean;
  novidades: string | null;
};

/**
 * Nunca derruba a tela nem a segura.
 *
 * A consulta sai para fora da instalacao, e fora da instalacao nada e
 * garantido: GitHub fora do ar, rede lenta, resposta estranha. Qualquer um
 * desses casos responde "nao sei", e o painel abre como sempre.
 */
export async function situacaoDaVersao(endereco: string): Promise<SituacaoDaVersao> {
  const semResposta: SituacaoDaVersao = {
    instalada: VERSAO_INSTALADA,
    maisNova: null,
    atrasada: false,
    novidades: null,
  };

  try {
    const resposta = await fetch(endereco, {
      // Uma consulta por hora, e nao uma por tela aberta.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!resposta.ok) return semResposta;

    const corpo = (await resposta.json()) as { versao?: unknown; novidades?: unknown };
    const maisNova = typeof corpo.versao === 'string' ? corpo.versao : null;
    if (!maisNova || !FORMATO.test(maisNova)) return semResposta;

    return {
      instalada: VERSAO_INSTALADA,
      maisNova,
      atrasada: estaAtrasada(VERSAO_INSTALADA, maisNova),
      novidades: typeof corpo.novidades === 'string' ? corpo.novidades : null,
    };
  } catch (falha) {
    console.error('versao: nao consegui conferir a versao mais nova', falha);
    return semResposta;
  }
}
