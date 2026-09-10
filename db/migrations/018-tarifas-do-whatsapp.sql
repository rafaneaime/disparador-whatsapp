-- As tarifas da Meta, preenchidas por quem instalou.
--
-- Nasce vazia de proposito, e nenhum valor padrao vai no codigo. A Meta
-- atualiza a tabela de precos todo inicio de trimestre — quatro vezes por ano —
-- e varia por pais e por categoria. Tarifa que eu escrevesse aqui hoje
-- envelheceria calada e entregaria um numero errado com cara de certo, que e
-- pior do que nao ter numero nenhum.
--
-- `pais` e o DDI sem o `+`: `55` e o Brasil. A busca casa pelo prefixo mais
-- longo, entao quem quiser distinguir uma faixa pode cadastrar `5511` ao lado
-- de `55`.
--
-- `valor` e numeric, e nao float: preco de mensagem multiplicado por milhares
-- de destinatarios acumula erro de ponto flutuante, e o numero que a pessoa le
-- para de bater com a conta.
create table if not exists zap_tarifas (
  id             serial primary key,
  pais           text not null,
  categoria      text not null,
  valor          numeric(12, 6) not null,
  moeda          text not null,
  vigente_desde  date not null,
  atualizado_em  timestamptz default now(),
  unique (pais, categoria, vigente_desde)
);
