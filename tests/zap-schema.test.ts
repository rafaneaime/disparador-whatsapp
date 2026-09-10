import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analisarSql, motivoDestrutivo } from '../src/lib/sql-statements';

const caminho = 'db/migrations/017-disparador.sql';
const sql = existsSync(caminho) ? readFileSync(caminho, 'utf8').toLowerCase() : '';
const comandos = analisarSql(sql);

function tabela(nome: string): string {
  const comando = comandos.find((c) => c.codigo.startsWith(`create table if not exists zap_${nome} (`));
  expect(comando, `tabela zap_${nome} ausente`).toBeDefined();
  return comando!.raw;
}

describe('schema do disparador', () => {
  it.each([
    ['templates', ['meta_id text', 'nome text not null', 'idioma text not null',
      'categoria_pedida text', 'categoria_meta text', 'componentes jsonb',
      'estado text', 'motivo_rejeicao text', 'sincronizado_em timestamptz']],
    ['contacts', ['telefone text not null', 'nome text', 'email text',
      "etiquetas text[] not null default '{}'", "consentimento text not null default 'unknown'",
      'consentimento_origem text', 'consentimento_em timestamptz', 'descadastro_em timestamptz']],
    ['imports', ['origem text', 'nome_do_arquivo text', 'mapeamento jsonb', 'total int',
      'validos int', 'invalidos int', 'duplicados int', 'estado text', 'erros jsonb', 'confirmado_em timestamptz']],
    ['campaigns', ['nome text', 'template_id int', 'references zap_templates(id)',
      'variaveis jsonb', 'estado text', 'total int not null default 0',
      'iniciada_em timestamptz', 'terminada_em timestamptz', 'progresso_em timestamptz']],
    ['messages', ['campaign_id int not null references zap_campaigns(id) on delete cascade',
      'contact_id int not null references zap_contacts(id) on delete cascade',
      "estado text not null default 'pendente'", 'meta_message_id text', 'erro_codigo text',
      'erro_texto text', 'lote text', 'enviada_em timestamptz', 'entregue_em timestamptz',
      'lida_em timestamptz', 'falhou_em timestamptz']],
    ['webhook_events', ['chave text not null', 'payload jsonb',
      'recebido_em timestamptz not null default now()', 'processado_em timestamptz', 'erro text']],
  ] as const)('cria zap_%s com o contrato de colunas e sem conta', (nome, colunas) => {
    const ddl = tabela(nome).replace(/\s+/g, ' ');
    for (const coluna of colunas) expect(ddl).toContain(coluna);
    expect(ddl).toContain('id serial primary key');
    if (nome !== 'webhook_events') expect(ddl).toContain('criado_em timestamptz not null default now()');
    expect(ddl).not.toContain('account_id');
  });

  it.each([
    ['templates', 'nome, idioma'], ['contacts', 'telefone'],
    ['messages', 'campaign_id, contact_id'], ['webhook_events', 'chave'],
  ])('impede duplicatas em zap_%s por %s', (nome, chave) => {
    expect(tabela(nome)).toContain(`unique (${chave})`);
  });

  it.each([
    ['templates', 'estado', ['draft', 'submitting', 'pending', 'approved', 'rejected', 'paused', 'disabled']],
    ['contacts', 'consentimento', ['subscribed', 'unsubscribed', 'unknown']],
    ['imports', 'origem', ['arquivo', 'colado']],
    ['campaigns', 'estado', ['draft', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed']],
    ['messages', 'estado', ['pendente', 'enviando', 'enviada', 'entregue', 'lida', 'falhou', 'cancelada']],
  ])('restringe %s.%s aos estados previstos', (nome, coluna, estados) => {
    const ddl = tabela(nome);
    const restricao = ddl.match(new RegExp(`check\\s*\\(${coluna} in \\(([^)]+)\\)\\)`));
    expect(restricao?.[1].match(/'[^']+'/g)?.map((s) => s.slice(1, -1))).toEqual(estados);
  });

  it('mantém o índice da drenagem dentro da migração idempotente e aditiva', () => {
    expect(comandos.filter((c) => c.codigo.startsWith('create table if not exists zap_'))).toHaveLength(6);
    expect(comandos.some((c) => /create index if not exists zap_\w+ on zap_messages \(campaign_id, estado\)/.test(c.codigo))).toBe(true);
    expect(comandos.map((c) => motivoDestrutivo(c.codigo)).filter(Boolean)).toEqual([]);
  });
});
