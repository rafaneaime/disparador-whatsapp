import { sql } from '../db';
import type { Tarifa } from '../zap/custo';

/**
 * As tarifas mais recentes de cada par (país, categoria).
 *
 * A tabela guarda o histórico — uma linha por `vigente_desde` —, mas a
 * estimativa usa só a vigente. Guardar o histórico é o que permite olhar para
 * trás e entender uma fatura antiga; apagar a anterior a cada atualização
 * apagaria essa explicação junto.
 */
export async function tarifasVigentes(): Promise<Tarifa[]> {
  const linhas = (await sql`
    select distinct on (pais, categoria)
      pais, categoria, valor::float8 as valor, moeda, to_char(vigente_desde, 'YYYY-MM-DD') as vigente_desde
    from zap_tarifas
    order by pais, categoria, vigente_desde desc
  `) as Tarifa[];
  return linhas;
}

export async function listarTarifas(): Promise<(Tarifa & { id: number })[]> {
  return (await sql`
    select id, pais, categoria, valor::float8 as valor, moeda,
      to_char(vigente_desde, 'YYYY-MM-DD') as vigente_desde
    from zap_tarifas order by pais, categoria, vigente_desde desc
  `) as (Tarifa & { id: number })[];
}

export async function salvarTarifa(t: Tarifa): Promise<number> {
  const linhas = (await sql`
    insert into zap_tarifas (pais, categoria, valor, moeda, vigente_desde)
    values (${t.pais}, ${t.categoria}, ${t.valor}, ${t.moeda}, ${t.vigente_desde}::date)
    on conflict (pais, categoria, vigente_desde) do update set
      valor = excluded.valor, moeda = excluded.moeda, atualizado_em = now()
    returning id
  `) as { id: number }[];
  return linhas[0].id;
}

export async function apagarTarifa(id: number): Promise<void> {
  await sql`delete from zap_tarifas where id = ${id}`;
}
