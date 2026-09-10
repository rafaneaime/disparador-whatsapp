import { sql } from '../db';

export type EstadoCampanha = 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export async function criarCampanha(campanha: {
  nome: string;
  template_id: number;
  variaveis: Record<string, unknown>;
}): Promise<number> {
  const rows = (await sql`
    insert into zap_campaigns (nome, template_id, variaveis, estado)
    values (${campanha.nome}, ${campanha.template_id}, ${JSON.stringify(campanha.variaveis)}::jsonb, 'draft')
    returning id
  `) as { id: number }[];
  return rows[0].id;
}

export async function mudarEstadoCampanha(campanhaId: number, estado: EstadoCampanha): Promise<void> {
  await sql`
    update zap_campaigns set estado = ${estado},
      iniciada_em = case when ${estado} = 'running' then coalesce(iniciada_em, now()) else iniciada_em end,
      terminada_em = case when ${estado} in ('completed', 'cancelled', 'failed')
        then coalesce(terminada_em, now()) else terminada_em end,
      progresso_em = now()
    where id = ${campanhaId}
  `;
}

export async function tocarProgresso(campanhaId: number): Promise<void> {
  await sql`update zap_campaigns set progresso_em = now() where id = ${campanhaId}`;
}
