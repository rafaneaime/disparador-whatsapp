import { sql } from '../db';

export type MensagemReivindicada = { id: number; contact_id: number };
export type ResultadoEnvio =
  | { estado: 'enviada'; meta_message_id: string }
  | { estado: 'falhou'; erro_codigo: string; erro_texto: string };

/** Retorna quantas pessoas entraram nesta chamada; repetir não infla o total. */
export async function enfileirarCampanha(campanhaId: number, contatos: number[]): Promise<number> {
  if (contatos.length === 0) return 0;
  const rows = (await sql`
    with inseridas as (
      insert into zap_messages (campaign_id, contact_id)
      select ${campanhaId}, c.id from zap_contacts c
      where c.id = any(${contatos}::int[])
        and c.consentimento = 'subscribed' and c.descadastro_em is null
        and exists (select 1 from zap_campaigns where id = ${campanhaId} and estado in ('draft', 'queued'))
      on conflict (campaign_id, contact_id) do nothing
      returning id
    )
    update zap_campaigns
    set total = total + (select count(*) from inseridas)::int,
      progresso_em = now()
    where id = ${campanhaId}
    returning (select count(*)::int from inseridas) as total
  `) as { total: number }[];
  return rows[0]?.total ?? 0;
}

/** Uma instrução HTTP: a reserva e seu heartbeat não podem se separar. */
export async function reivindicarLote(
  campanhaId: number, lote: string, tamanho: number,
): Promise<MensagemReivindicada[]> {
  if (!Number.isSafeInteger(tamanho) || tamanho <= 0) throw new Error('Tamanho de lote inválido');
  return (await sql`
    with reivindicadas as (
      update zap_messages set estado = 'enviando', lote = ${lote}
      where id in (
        select m.id from zap_messages m
        join zap_contacts c on c.id = m.contact_id
        join zap_campaigns a on a.id = m.campaign_id
        where m.campaign_id = ${campanhaId} and m.estado = 'pendente'
          and c.consentimento = 'subscribed' and c.descadastro_em is null
          and a.estado in ('queued', 'running')
        order by m.id limit ${tamanho}
        for update of m skip locked
      ) returning id, contact_id
    ), progresso as (
      update zap_campaigns set progresso_em = now()
      where id = ${campanhaId} and exists (select 1 from reivindicadas)
    )
    select id, contact_id from reivindicadas order by id
  `) as MensagemReivindicada[];
}

/** Uma reserva só escreve seu resultado uma vez. O wamid nunca é retornado. */
export async function marcarResultado(
  mensagemId: number, lote: string, resultado: ResultadoEnvio,
): Promise<boolean> {
  const enviada = resultado.estado === 'enviada';
  const erroTexto = enviada ? null : resultado.erro_texto.replace(/\bwamid\.[\w+/=-]+/gi, '[id omitido]');
  const rows = (await sql`
    with alterada as (
      update zap_messages set estado = ${resultado.estado},
        meta_message_id = ${enviada ? resultado.meta_message_id : null},
        erro_codigo = ${enviada ? null : resultado.erro_codigo}, erro_texto = ${erroTexto},
        enviada_em = case when ${resultado.estado} = 'enviada' then now() else enviada_em end,
        falhou_em = case when ${resultado.estado} = 'falhou' then now() else falhou_em end
      where id = ${mensagemId} and lote = ${lote} and estado = 'enviando'
      returning id, campaign_id
    ), progresso as (
      update zap_campaigns set progresso_em = now()
      where id in (select campaign_id from alterada)
    )
    select id from alterada
  `) as { id: number }[];
  return rows.length > 0;
}
