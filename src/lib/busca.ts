/**
 * Escape de coringa para busca com `ILIKE`.
 *
 * Vive aqui, no produto base, e não junto do filtro de contatos da Plataforma
 * — que foi onde ele nasceu. A tela de Logs é da base e precisa da mesma
 * proteção; sem um lugar comum, ou ela ficaria sem escape (foi o que
 * aconteceu) ou a base importaria da Plataforma e a exportação quebraria.
 *
 * O que ele evita: `%` e `_` são coringas do `LIKE`. Underscore em @ do
 * Instagram é comum — `igor.braga_` existe nesta base — e sem escape o `_`
 * casa com qualquer caractere. Medido contra produção: buscar `_` sozinho
 * casa 212 de 212 payloads. Numa busca com teto, isso enche o resultado de
 * falso positivo e empurra para fora justamente a linha procurada,
 * produzindo um "não achei" que é mentira.
 *
 * Quem usa precisa passar `escape '\'` na consulta, senão a barra invertida
 * fica literal e o problema volta ao contrário.
 */
export function escaparBuscaIlike(busca: string): string {
  return busca.replace(/[\\%_]/g, '\\$&');
}
