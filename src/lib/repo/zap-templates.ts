import { sql } from '../db';

export type EstadoTemplate = 'draft' | 'submitting' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
export type TemplateSincronizado = {
  meta_id: string;
  nome: string;
  idioma: string;
  categoria_pedida?: string | null;
  categoria_meta: string | null;
  componentes: unknown[];
  estado: EstadoTemplate;
  motivo_rejeicao?: string | null;
};
export type TemplateZap = Omit<TemplateSincronizado, 'meta_id' | 'categoria_pedida' | 'motivo_rejeicao'> & {
  id: number;
  meta_id: string | null;
  categoria_pedida: string | null;
  motivo_rejeicao: string | null;
  sincronizado_em: Date | null;
  criado_em: Date;
};

/** A sincronização atualiza o retrato da Meta sem apagar a intenção local. */
export async function sincronizarTemplates(templates: TemplateSincronizado[]): Promise<void> {
  if (templates.length === 0) return;
  const unicos = new Map(templates.map((t) => [JSON.stringify([t.nome, t.idioma]), t]));
  await sql`
    insert into zap_templates
      (meta_id, nome, idioma, categoria_pedida, categoria_meta, componentes,
       estado, motivo_rejeicao, sincronizado_em)
    select meta_id, nome, idioma, categoria_pedida, categoria_meta, componentes,
      estado, motivo_rejeicao, now()
    from jsonb_to_recordset(${JSON.stringify([...unicos.values()])}::jsonb) as t(
      meta_id text, nome text, idioma text, categoria_pedida text,
      categoria_meta text, componentes jsonb, estado text, motivo_rejeicao text
    )
    where true
    on conflict (nome, idioma) do update set
      meta_id = excluded.meta_id,
      categoria_pedida = coalesce(zap_templates.categoria_pedida, excluded.categoria_pedida),
      categoria_meta = excluded.categoria_meta,
      componentes = excluded.componentes,
      estado = excluded.estado,
      motivo_rejeicao = excluded.motivo_rejeicao,
      sincronizado_em = now()
  `;
}

/**
 * Grava um template que ACABAMOS de criar na Meta.
 *
 * Existe separada de `sincronizarResumoTemplates` por um motivo que quase virou
 * defeito: aquela função marca como `disabled` tudo que não veio na lista
 * recebida, porque a lista dela é o retrato completo da conta. Chamá-la com um
 * template só desabilitaria todos os outros.
 *
 * Aqui a `categoria_pedida` é guardada — é a única hora em que ela existe. A
 * Meta pode devolver outra em `categoria_meta`, e é a divergência entre as duas
 * que a tela precisa mostrar, porque a cobrança segue a devolvida.
 */
export async function gravarTemplateCriado(t: {
  meta_id: string; nome: string; idioma: string;
  categoria_pedida: string; categoria_meta: string | null;
  componentes: unknown[]; estado: EstadoTemplate;
}): Promise<number> {
  const rows = (await sql`
    insert into zap_templates
      (meta_id, nome, idioma, categoria_pedida, categoria_meta, componentes, estado, sincronizado_em)
    values (${t.meta_id}, ${t.nome}, ${t.idioma}, ${t.categoria_pedida}, ${t.categoria_meta},
            ${JSON.stringify(t.componentes)}::jsonb, ${t.estado}, now())
    on conflict (nome, idioma) do update set
      meta_id = excluded.meta_id, categoria_meta = excluded.categoria_meta,
      componentes = excluded.componentes, estado = excluded.estado,
      motivo_rejeicao = null, sincronizado_em = now()
    returning id
  `) as { id: number }[];
  return rows[0].id;
}

export async function listarTemplates(estado: EstadoTemplate | '' = ''): Promise<TemplateZap[]> {
  return (await sql`
    select id, meta_id, nome, idioma, categoria_pedida, categoria_meta,
      componentes, estado, motivo_rejeicao, sincronizado_em, criado_em
    from zap_templates where (${estado === ''} or estado = ${estado})
    order by nome, idioma
  `) as TemplateZap[];
}

export async function acharTemplate(nome: string, idioma: string): Promise<TemplateZap | null> {
  const rows = (await sql`
    select id, meta_id, nome, idioma, categoria_pedida, categoria_meta,
      componentes, estado, motivo_rejeicao, sincronizado_em, criado_em
    from zap_templates where nome = ${nome} and idioma = ${idioma}
  `) as TemplateZap[];
  return rows[0] ?? null;
}

export async function acharTemplatePorId(id: number): Promise<TemplateZap | null> {
  const rows = await sql`
    select id, meta_id, nome, idioma, categoria_pedida, categoria_meta,
      componentes, estado, motivo_rejeicao, sincronizado_em, criado_em
    from zap_templates where id = ${id}
  `;
  return (rows[0] as TemplateZap | undefined) ?? null;
}

/**
 * O retrato que a listagem da Meta devolve. Não traz componentes — por isso não
 * apaga os locais.
 *
 * `motivo_rejeicao` entrou em 08/09. Antes disso a coluna nunca era preenchida,
 * porque o adaptador nem pedia o campo à Meta: a pessoa via "rejeitado" sem
 * saber por quê, que é inútil justamente para quem ajusta e submete de novo.
 */
export async function sincronizarResumoTemplates(templates: {
  nome: string; idioma: string; estado: EstadoTemplate; categoria_meta: string;
  meta_id?: string | null; motivo_rejeicao?: string | null;
}[]): Promise<void> {
  const unicos = new Map(templates.map(t => [JSON.stringify([t.nome, t.idioma]), t]));
  await sql`
    with recebidos as (
      select * from jsonb_to_recordset(${JSON.stringify([...unicos.values()])}::jsonb)
        as t(nome text, idioma text, estado text, categoria_meta text,
             meta_id text, motivo_rejeicao text)
    ), atualizados as (
      insert into zap_templates (nome, idioma, estado, categoria_meta, meta_id, motivo_rejeicao, sincronizado_em)
      select nome, idioma, estado, categoria_meta, meta_id, motivo_rejeicao, now() from recebidos
      where true on conflict (nome, idioma) do update set
        estado = excluded.estado, categoria_meta = excluded.categoria_meta,
        meta_id = coalesce(excluded.meta_id, zap_templates.meta_id),
        motivo_rejeicao = excluded.motivo_rejeicao,
        sincronizado_em = now()
      returning id
    )
    update zap_templates t set estado = 'disabled',
      motivo_rejeicao = 'Este template não está mais disponível na Meta.', sincronizado_em = now()
    where t.sincronizado_em is not null and not exists (
      select 1 from recebidos r where r.nome = t.nome and r.idioma = t.idioma
    )
  `;
}
