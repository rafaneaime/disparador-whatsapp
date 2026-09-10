/**
 * O que a Meta recusa, conferido antes de gastar a análise dela.
 *
 * Cada submissão rejeitada custa tempo: o template entra na fila de análise,
 * volta reprovado, e só então a pessoa descobre que faltava um exemplo. Como o
 * costume de quem trabalha com marketing é submeter, ajustar e submeter de novo
 * até passar, cada ida e volta evitável aqui é uma rodada a menos lá.
 *
 * As regras abaixo são as que a Meta documenta e recusa de forma previsível.
 * Não é a validação dela inteira — é a parte que dá para conferir sem rede.
 */

export type ComponenteDeTexto = {
  corpo: string;
  /** Um exemplo por variável, na ordem: o primeiro é o de `{{1}}`. */
  exemplos: string[];
};

export type Rascunho = {
  nome: string;
  idioma: string;
  categoria: string;
} & ComponenteDeTexto;

export type Problema = { campo: 'nome' | 'idioma' | 'categoria' | 'corpo' | 'exemplos'; texto: string };

const NOME = /^[a-z0-9_]{1,512}$/;
const CATEGORIAS = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;

/** As variáveis do corpo, na ordem em que aparecem. `{{1}}` vira 1. */
export function variaveisDoCorpo(corpo: string): number[] {
  return [...corpo.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((achado) => Number(achado[1]));
}

export function validarRascunho(rascunho: Rascunho): Problema[] {
  const problemas: Problema[] = [];
  const corpo = rascunho.corpo.trim();

  if (!NOME.test(rascunho.nome)) {
    problemas.push({
      campo: 'nome',
      texto: 'O nome aceita só letras minúsculas, números e _ — sem espaço, acento ou maiúscula.',
    });
  }

  if (rascunho.idioma.trim() === '') {
    problemas.push({ campo: 'idioma', texto: 'Escolha o idioma do template.' });
  }

  if (!(CATEGORIAS as readonly string[]).includes(rascunho.categoria)) {
    problemas.push({
      campo: 'categoria',
      texto: 'Escolha entre marketing, utilidade e autenticação.',
    });
  }

  if (corpo === '') {
    problemas.push({ campo: 'corpo', texto: 'Escreva o texto da mensagem.' });
    return problemas;
  }

  const variaveis = variaveisDoCorpo(corpo);

  // Sequenciais a partir de 1, sem buraco e sem repetir fora de ordem. A Meta
  // numera pela posição, então `{{1}} ... {{3}}` não é "faltou a 2": é inválido.
  const esperado = variaveis.map((_, indice) => indice + 1);
  if (String(variaveis) !== String(esperado)) {
    problemas.push({
      campo: 'corpo',
      texto: `As variáveis precisam ser {{1}}, {{2}}, {{3}}… nessa ordem. Encontrei ${
        variaveis.length === 0 ? 'nenhuma' : variaveis.map((n) => `{{${n}}}`).join(', ')
      }.`,
    });
  }

  // Variável colada no começo ou no fim: a Meta recusa, porque a mensagem
  // inteira poderia virar conteúdo livre e escapar da análise.
  if (/^\s*\{\{\s*\d+\s*\}\}/.test(corpo)) {
    problemas.push({ campo: 'corpo', texto: 'A mensagem não pode começar com uma variável. Escreva algo antes dela.' });
  }
  if (/\{\{\s*\d+\s*\}\}\s*$/.test(corpo)) {
    problemas.push({ campo: 'corpo', texto: 'A mensagem não pode terminar com uma variável. Escreva algo depois dela.' });
  }

  // Duas variáveis coladas, com nada ou só espaço entre elas — mesma razão.
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(corpo)) {
    problemas.push({ campo: 'corpo', texto: 'Duas variáveis seguidas precisam de texto entre elas.' });
  }

  const exemplos = rascunho.exemplos.map((e) => e.trim());
  if (exemplos.length !== variaveis.length || exemplos.some((e) => e === '')) {
    problemas.push({
      campo: 'exemplos',
      texto: `A Meta exige um exemplo para cada variável. São ${variaveis.length} variável(is) e ${
        exemplos.filter((e) => e !== '').length
      } exemplo(s) preenchido(s).`,
    });
  }

  return problemas;
}

/** O corpo com os exemplos no lugar das variáveis — a prévia da mensagem. */
export function previa(rascunho: ComponenteDeTexto): string {
  return rascunho.corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (inteiro, numero: string) => {
    const exemplo = rascunho.exemplos[Number(numero) - 1];
    return exemplo === undefined || exemplo.trim() === '' ? inteiro : exemplo;
  });
}

/**
 * O nome da próxima tentativa.
 *
 * Nome de template é **imutável depois de submetido**: não existe corrigir, só
 * criar outro. E como o ciclo normal é submeter, ser reprovado, ajustar e
 * submeter de novo, quem itera precisa de um nome novo a cada rodada — sem
 * inventar um a cada vez e sem colidir com o que já existe.
 */
export function sugerirNomeDeVersao(nome: string, existentes: readonly string[]): string {
  const base = nome.replace(/_v\d+$/, '');
  const usados = new Set(existentes);
  for (let versao = 2; versao < 1000; versao += 1) {
    const candidato = `${base}_v${versao}`;
    if (!usados.has(candidato)) return candidato;
  }
  return `${base}_v1000`;
}

/** O formato que a Meta espera na criação. Só corpo de texto, por ora. */
export function componentesParaMeta(rascunho: ComponenteDeTexto): unknown[] {
  const variaveis = variaveisDoCorpo(rascunho.corpo);
  const corpo: Record<string, unknown> = { type: 'BODY', text: rascunho.corpo };
  if (variaveis.length > 0) {
    corpo.example = { body_text: [rascunho.exemplos.slice(0, variaveis.length)] };
  }
  return [corpo];
}
