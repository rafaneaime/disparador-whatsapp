/**
 * Quanto uma campanha deve custar, antes de disparar.
 *
 * É **estimativa**, e a palavra importa: quem cobra é a Meta, e só a fatura
 * dela é verdade. O que esta função faz é impedir a surpresa — não prometer o
 * valor.
 *
 * Três coisas mandam no cálculo, e cada uma já custou dinheiro de alguém:
 *
 * - **a categoria que a Meta devolveu**, não a que se pediu. Marketing custa
 *   cerca de seis vezes utilidade, e quem pede utilidade e recebe marketing
 *   descobre na fatura se a conta usar a pedida;
 * - **o país de cada destinatário**, pelo DDI. A mesma mensagem tem preços
 *   diferentes por país;
 * - **a data da tarifa**. A Meta atualiza a tabela todo início de trimestre —
 *   quatro vezes por ano.
 *
 * Por isso nenhuma tarifa mora aqui dentro. Elas vêm da tabela que a pessoa
 * cadastrou, e a função devolve a data mais antiga que usou, para a tela poder
 * avisar que está velha.
 */

export type Tarifa = {
  /** O DDI, sem `+`. `55` é o Brasil. */
  pais: string;
  categoria: string;
  valor: number;
  moeda: string;
  vigente_desde: string;
};

export type EntradaDeCusto = {
  /** Telefones canônicos, só dígitos, com DDI. */
  telefones: readonly string[];
  /** A categoria devolvida pela Meta. `null` quando ainda não se sabe. */
  categoria: string | null;
  tarifas: readonly Tarifa[];
};

export type LinhaDeCusto = {
  pais: string;
  quantos: number;
  valorUnitario: number;
  moeda: string;
  total: number;
};

export type Estimativa = {
  linhas: LinhaDeCusto[];
  totalPorMoeda: { moeda: string; valor: number }[];
  /**
   * Quem ficou de fora da conta, agrupado pelos três primeiros dígitos.
   *
   * É pista, não país: DDI tem de um a três dígitos e não dá para saber qual é
   * sem a tarifa cadastrada. Serve para a pessoa descobrir qual tarifa falta.
   */
  semTarifa: { prefixo: string; quantos: number }[];
  /** A `vigente_desde` mais antiga entre as tarifas usadas. */
  tarifaMaisAntiga: string | null;
};

/** A tarifa cujo DDI é o prefixo mais longo que casa com o telefone. */
function tarifaDoTelefone(
  telefone: string,
  categoria: string,
  tarifas: readonly Tarifa[],
): Tarifa | null {
  let melhor: Tarifa | null = null;
  for (const tarifa of tarifas) {
    if (tarifa.categoria !== categoria) continue;
    if (!telefone.startsWith(tarifa.pais)) continue;
    // Mais longo vence: quem cadastrou `55` e `5511` quis distinguir os dois.
    if (melhor === null || tarifa.pais.length > melhor.pais.length) melhor = tarifa;
  }
  return melhor;
}

export function estimarCusto(entrada: EntradaDeCusto): Estimativa {
  const vazia: Estimativa = {
    linhas: [],
    totalPorMoeda: [],
    semTarifa: [],
    tarifaMaisAntiga: null,
  };

  if (entrada.telefones.length === 0) return vazia;

  // Sem saber a categoria não há o que estimar — e chutar uma seria escolher
  // entre dois preços que diferem em seis vezes.
  if (entrada.categoria === null) {
    return {
      ...vazia,
      semTarifa: agruparPorPrefixo(entrada.telefones),
    };
  }

  const porPais = new Map<string, { tarifa: Tarifa; quantos: number }>();
  const orfaos: string[] = [];

  for (const telefone of entrada.telefones) {
    const tarifa = tarifaDoTelefone(telefone, entrada.categoria, entrada.tarifas);
    if (tarifa === null) {
      orfaos.push(telefone);
      continue;
    }
    const atual = porPais.get(tarifa.pais);
    if (atual) atual.quantos += 1;
    else porPais.set(tarifa.pais, { tarifa, quantos: 1 });
  }

  const linhas = [...porPais.values()]
    .map(({ tarifa, quantos }) => ({
      pais: tarifa.pais,
      quantos,
      valorUnitario: tarifa.valor,
      moeda: tarifa.moeda,
      total: Number((tarifa.valor * quantos).toFixed(6)),
    }))
    .sort((a, b) => b.quantos - a.quantos || a.pais.localeCompare(b.pais));

  // Moeda diferente nunca soma. Duas moedas viram dois totais, como na tela de
  // Vendas: somar real com dólar produz um número que não existe.
  const porMoeda = new Map<string, number>();
  for (const linha of linhas) {
    porMoeda.set(linha.moeda, (porMoeda.get(linha.moeda) ?? 0) + linha.total);
  }

  const datas = [...porPais.values()].map(({ tarifa }) => tarifa.vigente_desde).sort();

  return {
    linhas,
    totalPorMoeda: [...porMoeda]
      .map(([moeda, valor]) => ({ moeda, valor: Number(valor.toFixed(6)) }))
      .sort((a, b) => a.moeda.localeCompare(b.moeda)),
    semTarifa: agruparPorPrefixo(orfaos),
    tarifaMaisAntiga: datas[0] ?? null,
  };
}

function agruparPorPrefixo(telefones: readonly string[]): { prefixo: string; quantos: number }[] {
  const contagem = new Map<string, number>();
  for (const telefone of telefones) {
    const prefixo = telefone.slice(0, 3);
    contagem.set(prefixo, (contagem.get(prefixo) ?? 0) + 1);
  }
  return [...contagem]
    .map(([prefixo, quantos]) => ({ prefixo, quantos }))
    .sort((a, b) => b.quantos - a.quantos || a.prefixo.localeCompare(b.prefixo));
}

/** Quantos trimestres se passaram desde a tarifa. A Meta muda a tabela a cada um. */
export function trimestresDesde(vigenteDesde: string | null, agora: Date): number {
  if (vigenteDesde === null) return 0;
  const data = new Date(vigenteDesde);
  if (Number.isNaN(data.getTime())) return 0;
  const meses =
    (agora.getUTCFullYear() - data.getUTCFullYear()) * 12 +
    (agora.getUTCMonth() - data.getUTCMonth());
  return Math.floor(Math.max(0, meses) / 3);
}
