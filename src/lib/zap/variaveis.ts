/**
 * O que preenche `{{1}}`, `{{2}}`… na hora de disparar.
 *
 * Um template aprovado com variável é inútil enquanto ninguém diz de onde vem
 * cada valor. Esta é essa decisão, guardada na campanha: para cada posição, ou
 * o **nome do contato**, ou um **texto fixo** igual para todo mundo.
 *
 * **Reserva não é luxo.** Nem todo contato tem nome — colagem só com telefone,
 * compra sem nome no checkout. A Meta recusa variável vazia, e sem reserva a
 * mensagem simplesmente não sairia para essas pessoas, uma a uma, sem que
 * ninguém entendesse por quê.
 */

export type Variavel =
  | { origem: 'nome'; padrao: string }
  | { origem: 'fixo'; texto: string };

export type ContatoParaVariaveis = { nome: string | null };

export type ValoresResolvidos =
  | { ok: true; valores: string[] }
  | { ok: false; erro: string };

/**
 * O texto que a Meta aceita dentro de uma variável.
 *
 * Quebra de linha, tabulação e quatro espaços seguidos são recusados pela
 * Cloud API — e vêm de graça em nome colado de planilha. Limpar aqui evita uma
 * recusa que fala de "parâmetro inválido" sem dizer qual.
 */
export function limparValor(valor: string): string {
  return valor.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();
}

export function contarVariaveis(componentes: unknown): number {
  const achados = JSON.stringify(componentes ?? []).match(/\{\{(\d+)\}\}/g) ?? [];
  const posicoes = new Set(achados.map((m) => Number(m.replace(/\D/g, ''))));
  return posicoes.size === 0 ? 0 : Math.max(...posicoes);
}

/** Aceita só o que a tela escreve; qualquer outra forma vira `null`. */
export function lerVariaveis(valor: unknown): Variavel[] | null {
  if (!Array.isArray(valor)) return null;
  const lidas: Variavel[] = [];
  for (const item of valor) {
    const v = item as Record<string, unknown> | null;
    if (!v || typeof v !== 'object') return null;
    if (v.origem === 'nome') {
      if (typeof v.padrao !== 'string') return null;
      lidas.push({ origem: 'nome', padrao: limparValor(v.padrao).slice(0, 200) });
    } else if (v.origem === 'fixo') {
      if (typeof v.texto !== 'string') return null;
      lidas.push({ origem: 'fixo', texto: limparValor(v.texto).slice(0, 200) });
    } else {
      return null;
    }
  }
  return lidas;
}

export function resolverVariaveis(
  variaveis: readonly Variavel[],
  contato: ContatoParaVariaveis,
): ValoresResolvidos {
  const valores: string[] = [];

  for (const [indice, variavel] of variaveis.entries()) {
    const bruto = variavel.origem === 'fixo'
      ? variavel.texto
      : limparValor(contato.nome ?? '') || variavel.padrao;
    const valor = limparValor(bruto);

    if (!valor) {
      // Acontece com contato sem nome e reserva vazia. A mensagem falha
      // sozinha, com motivo; as outras da mesma campanha seguem.
      return {
        ok: false,
        erro: variavel.origem === 'nome'
          ? `Este contato está sem nome, e a variável {{${indice + 1}}} ficou sem texto de reserva.`
          : `A variável {{${indice + 1}}} está sem texto.`,
      };
    }
    valores.push(valor);
  }

  return { ok: true, valores };
}
