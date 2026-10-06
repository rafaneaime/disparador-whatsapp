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

/** O telefone e o nome: o nome é o que preenche `{{1}}` quando a campanha pede. */
export async function contatoDoDisparo(
  id: number,
): Promise<{ telefone: string; nome: string | null } | null> {
  const rows = await sql`select telefone, nome from zap_contacts where id = ${id}`;
  const linha = rows[0] as { telefone: string; nome: string | null } | undefined;
  return linha ?? null;
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

/**
 * As campanhas com o andamento de cada uma, numa consulta só.
 *
 * A tela de campanhas pede as contagens por campanha quando alguém abre uma.
 * O agente precisa do contrário: a lista inteira com o andamento junto, para
 * responder "como está o disparo" sem uma ida ao banco por campanha.
 */
export async function listarCampanhasComProgresso(limite: number): Promise<{
  id: number; nome: string; estado: EstadoCampanha; template_nome: string | null;
  enviadas: number; falhas: number; pendentes: number; enviando: number; criada_em: Date;
}[]> {
  return await sql`
    select c.id, c.nome, c.estado, t.nome as template_nome, c.criado_em as criada_em,
      count(m.*) filter (where m.estado in ('enviada', 'entregue', 'lida'))::int as enviadas,
      count(m.*) filter (where m.estado = 'falhou')::int as falhas,
      count(m.*) filter (where m.estado = 'pendente')::int as pendentes,
      count(m.*) filter (where m.estado = 'enviando')::int as enviando
    from zap_campaigns c
    left join zap_templates t on t.id = c.template_id
    left join zap_messages m on m.campaign_id = c.id
    group by c.id, c.nome, c.estado, t.nome, c.criado_em
    order by c.criado_em desc, c.id desc
    limit ${Math.max(1, Math.min(200, Math.trunc(limite)))}
  ` as {
    id: number; nome: string; estado: EstadoCampanha; template_nome: string | null;
    enviadas: number; falhas: number; pendentes: number; enviando: number; criada_em: Date;
  }[];
}
