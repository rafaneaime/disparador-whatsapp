-- Uma instalação, um número. As credenciais vêm do ambiente.
-- Aditiva e idempotente; o índice da fila acompanha a criação das tabelas.
create table if not exists zap_templates (
  id serial primary key,
  meta_id text,
  nome text not null,
  idioma text not null,
  categoria_pedida text,
  categoria_meta text,
  componentes jsonb not null default '[]',
  estado text not null default 'draft'
    check (estado in ('draft', 'submitting', 'pending', 'approved', 'rejected', 'paused', 'disabled')),
  motivo_rejeicao text,
  sincronizado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (nome, idioma)
);

create table if not exists zap_contacts (
  id serial primary key,
  telefone text not null,
  nome text,
  email text,
  etiquetas text[] not null default '{}',
  consentimento text not null default 'unknown'
    check (consentimento in ('subscribed', 'unsubscribed', 'unknown')),
  consentimento_origem text,
  consentimento_em timestamptz,
  descadastro_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (telefone)
);

create table if not exists zap_imports (
  id serial primary key,
  origem text not null check (origem in ('arquivo', 'colado')),
  nome_do_arquivo text,
  mapeamento jsonb,
  total int,
  validos int,
  invalidos int,
  duplicados int,
  estado text not null,
  erros jsonb,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz
);

create table if not exists zap_campaigns (
  id serial primary key,
  nome text not null,
  template_id int not null references zap_templates(id),
  variaveis jsonb not null default '{}',
  estado text not null default 'draft'
    check (estado in ('draft', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  total int not null default 0,
  criado_em timestamptz not null default now(),
  iniciada_em timestamptz,
  terminada_em timestamptz,
  progresso_em timestamptz
);

-- meta_message_id é dado pessoal: persistência apenas, nunca log ou tela.
create table if not exists zap_messages (
  id serial primary key,
  campaign_id int not null references zap_campaigns(id) on delete cascade,
  contact_id int not null references zap_contacts(id) on delete cascade,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'enviando', 'enviada', 'entregue', 'lida', 'falhou', 'cancelada')),
  meta_message_id text,
  erro_codigo text,
  erro_texto text,
  lote text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  entregue_em timestamptz,
  lida_em timestamptz,
  falhou_em timestamptz,
  unique (campaign_id, contact_id)
);

create index if not exists zap_messages_campaign_estado_idx on zap_messages (campaign_id, estado);

create table if not exists zap_webhook_events (
  id serial primary key,
  chave text not null,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text,
  unique (chave)
);
