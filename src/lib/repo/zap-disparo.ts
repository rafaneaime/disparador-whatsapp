import { sql } from '../db';
import type { EstadoCampanha } from './zap-campaigns';

export type CampanhaParaDisparo = {
  id: number; nome: string; estado: EstadoCampanha; template_id: number;
  variaveis: Record<string, unknown>; template_nome: string; idioma: string;
  template_estado: string; componentes: unknown[];
};

export async function acharCampanha(id: number): Promise<CampanhaParaDisparo | null> {
  const rows = await sql`
    select a.id, a.nome, a.estado, a.template_id, a.variaveis,
      t.nome as template_nome, t.idioma, t.estado as template_estado, t.componentes
    from zap_campaigns a join zap_templates t on t.id = a.template_id
    where a.id = ${id}
  `;
  return (rows[0] as CampanhaParaDisparo | undefined) ?? null;
}

/** A condição é avaliada no UPDATE: uma pausa concorrente não é desfeita. */
export async function iniciarCampanha(id: number): Promise<boolean> {
  const rows = await sql`
    update zap_campaigns set estado = 'running',
      iniciada_em = coalesce(iniciada_em, now()), progresso_em = now()
    where id = ${id} and estado in ('draft', 'queued', 'running') returning id
  `;
  return rows.length > 0;
}

export async function telefoneDoContato(id: number): Promise<string | null> {
  const rows = await sql`select telefone from zap_contacts where id = ${id}`;
  return (rows[0]?.telefone as string | undefined) ?? null;
}

/** Complemento transitório da fila provada; nunca altera uma reserva de outro lote. */
export async function devolverPendente(id: number, lote: string, codigo: string, humano: string): Promise<boolean> {
  const rows = await sql`
    with alterada as (
      update zap_messages set estado = 'pendente', lote = null,
        erro_codigo = ${codigo}, erro_texto = ${humano}, falhou_em = null
      where id = ${id} and lote = ${lote} and estado = 'enviando'
      returning id, campaign_id
    ), progresso as (
      update zap_campaigns set progresso_em = now()
      where id in (select campaign_id from alterada)
    ) select id from alterada
  `;
  return rows.length > 0;
}

export async function concluirSeTerminou(id: number): Promise<void> {
  await sql`
    update zap_campaigns set estado = 'completed',
      terminada_em = coalesce(terminada_em, now()), progresso_em = now()
    where id = ${id} and estado = 'running' and not exists (
      select 1 from zap_messages where campaign_id = ${id} and estado in ('pendente', 'enviando')
    )
  `;
}

export type ContagensCampanha = { pendentes: number; enviando: number; enviadas: number; falhas: number };

export async function contarMensagens(id: number): Promise<ContagensCampanha> {
  const rows = await sql`
    select count(*) filter (where estado = 'pendente')::int as pendentes,
      count(*) filter (where estado = 'enviando')::int as enviando,
      count(*) filter (where estado in ('enviada', 'entregue', 'lida'))::int as enviadas,
      count(*) filter (where estado = 'falhou')::int as falhas
    from zap_messages where campaign_id = ${id}
  `;
  return rows[0] as ContagensCampanha;
}

export async function listarCampanhas(): Promise<{ id: number; nome: string; estado: EstadoCampanha; total: number }[]> {
  return await sql`select id, nome, estado, total from zap_campaigns order by criado_em desc, id desc` as
    { id: number; nome: string; estado: EstadoCampanha; total: number }[];
}

export async function listarFalhas(id: number): Promise<{ id: number; erro_codigo: string | null; erro_texto: string | null }[]> {
  return await sql`
    select id, erro_codigo, erro_texto from zap_messages
    where campaign_id = ${id} and erro_texto is not null and estado in ('falhou', 'pendente')
    order by id
  ` as { id: number; erro_codigo: string | null; erro_texto: string | null }[];
}
