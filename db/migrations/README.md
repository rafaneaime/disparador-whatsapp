# Migrações

Arquivos `.sql` aplicados **em ordem lexical**, depois de `db/schema.sql`, toda
vez que `npm run db:setup` roda — e ele roda dentro do `npm run build`, ou
seja, **no deploy de todo cliente**.

Nomeie com prefixo numérico: `001-eventos.sql`, `002-identidades.sql`.

## As duas regras

**1. Idempotente.** Não existe tabela de controle registrando o que já foi
aplicado. Todo arquivo roda de novo em todo deploy, para sempre. Se rodar duas
vezes fizer diferença, está errado.

```sql
create table if not exists eventos (...);
alter table contacts add column if not exists email text;
create index if not exists eventos_contato_idx on eventos (contact_id);
```

**2. Aditiva.** Nada de `drop table`, `drop column`, `truncate`, `drop schema`
ou troca de tipo de coluna. O `db-setup.ts` recusa esses comandos e aborta
antes de executar qualquer coisa — inclusive o que vinha antes no arquivo.

O motivo não é purismo. O cliente atualiza apontando o código novo para o
**mesmo banco** que já tem os contatos dele, o deploy roda sozinho, não há
backup e não há suporte para socorrê-lo. Um `drop column` aqui é perda de dado
de alguém que pagou, sem volta.

## Coluna nova

Sempre nullable ou com default. A versão anterior do código continua rodando
em produção durante o deploy, e ela não sabe preencher a coluna.

```sql
alter table contacts add column if not exists pontuacao int not null default 0;
```

## Backfill

Pode, desde que seja idempotente por natureza — condicionado ao estado, não a
"rodou uma vez".

```sql
-- certo: roda de novo sem efeito
update contacts set pontuacao = 0 where pontuacao is null;

-- errado: soma de novo a cada deploy
update contacts set pontuacao = pontuacao + 10;
```
