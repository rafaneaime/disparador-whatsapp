import { sql } from '../db';
import { escaparBuscaIlike } from '../busca';
import { normalizarTelefone } from '../zap/telefone';

export type Consentimento = 'subscribed' | 'unsubscribed' | 'unknown';
export type ContatoZap = {
  id: number;
  telefone: string;
  nome: string | null;
  email: string | null;
  etiquetas: string[];
  consentimento: Consentimento;
  consentimento_origem: string | null;
  consentimento_em: Date | null;
  descadastro_em: Date | null;
  criado_em: Date;
};
export type EntradaContato = {
  telefone: unknown;
  nome?: string | null;
  email?: string | null;
  etiquetas?: string[];
  // Opt-out passa por marcarDescadastro, que também cancela a fila existente.
  consentimento?: 'subscribed' | 'unknown';
  consentimento_origem?: string | null;
  consentimento_em?: Date | null;
};

/**
 * A colagem não edita contatos existentes: o primeiro sim e todo opt-out
 * ficam intactos. O unique decide inclusive entre duas chamadas simultâneas.
 * A instalação tem um único operador, autenticado pela senha do painel.
 */
export async function inserirContatosColados(telefones: string[], origem: string): Promise<string[]> {
  if (telefones.length === 0) return [];
  const rows = (await sql`
    insert into zap_contacts (telefone, consentimento, consentimento_origem, consentimento_em)
    select telefone, 'subscribed', ${origem}, now()
    from unnest(${telefones}::text[]) as entrada(telefone)
    on conflict (telefone) do nothing
    returning telefone
  `) as { telefone: string }[];
  return rows.map((row) => row.telefone);
}

export async function salvarContato(contato: EntradaContato): Promise<number> {
  const telefone = normalizarTelefone(contato.telefone);
  if (!telefone) throw new Error('Telefone inválido');
  const rows = (await sql`
    insert into zap_contacts
      (telefone, nome, email, etiquetas, consentimento, consentimento_origem, consentimento_em)
    values (${telefone}, ${contato.nome ?? null}, ${contato.email ?? null},
      coalesce(${contato.etiquetas ?? null}::text[], '{}'), ${contato.consentimento ?? 'unknown'},
      ${contato.consentimento_origem ?? null}, ${contato.consentimento_em ?? null})
    on conflict (telefone) do update set
      nome = coalesce(excluded.nome, zap_contacts.nome),
      email = coalesce(excluded.email, zap_contacts.email),
      etiquetas = case when ${contato.etiquetas === undefined}
        then zap_contacts.etiquetas else excluded.etiquetas end,
      consentimento = case
        when zap_contacts.consentimento = 'unsubscribed' then zap_contacts.consentimento
        when excluded.consentimento = 'unknown' then zap_contacts.consentimento
        else excluded.consentimento end,
      consentimento_origem = case when zap_contacts.consentimento = 'unsubscribed'
        or excluded.consentimento = 'unknown' then zap_contacts.consentimento_origem
        else coalesce(excluded.consentimento_origem, zap_contacts.consentimento_origem) end,
      consentimento_em = case when zap_contacts.consentimento = 'unsubscribed'
        or excluded.consentimento = 'unknown' then zap_contacts.consentimento_em
        else coalesce(excluded.consentimento_em, zap_contacts.consentimento_em) end
    returning id
  `) as { id: number }[];
  return rows[0].id;
}

export async function listarContatos(busca = ''): Promise<ContatoZap[]> {
  const termo = busca.trim();
  const padrao = `%${escaparBuscaIlike(termo)}%`;
  return (await sql`
    select id, telefone, nome, email, etiquetas, consentimento, consentimento_origem,
      consentimento_em, descadastro_em, criado_em
    from zap_contacts
    where (${termo === ''} or nome ilike ${padrao} escape '\\'
      or telefone ilike ${padrao} escape '\\' or email ilike ${padrao} escape '\\')
    order by criado_em desc, id desc
  `) as ContatoZap[];
}

/** Descadastro prevalece mesmo quando a pessoa já estava numa fila. */
export async function marcarDescadastro(contatoId: number): Promise<void> {
  await sql`
    with descadastrado as (
      update zap_contacts set consentimento = 'unsubscribed',
        descadastro_em = coalesce(descadastro_em, now())
      where id = ${contatoId} returning id
    ), canceladas as (
      update zap_messages set estado = 'cancelada'
      where contact_id in (select id from descadastrado) and estado = 'pendente'
      returning campaign_id
    )
    update zap_campaigns set progresso_em = now()
    where id in (select campaign_id from canceladas)
  `;
}
