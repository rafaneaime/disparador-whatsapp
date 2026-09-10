import { beforeEach, describe, expect, it, vi } from 'vitest';

// Só o transporte HTTP é substituído. Conferimos o SQL e os parâmetros que
// os repositórios reais entregam ao driver; isto não simula locks do Postgres.
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../src/lib/db', () => ({ sql }));

import { sincronizarTemplates, listarTemplates, acharTemplate } from '../src/lib/repo/zap-templates';
import { salvarContato, listarContatos, marcarDescadastro } from '../src/lib/repo/zap-contacts';
import { criarCampanha, mudarEstadoCampanha, tocarProgresso } from '../src/lib/repo/zap-campaigns';
import { enfileirarCampanha, reivindicarLote, marcarResultado } from '../src/lib/repo/zap-messages';

beforeEach(() => { sql.mockReset().mockResolvedValue([]); });

function consulta() {
  expect(sql).toHaveBeenCalledTimes(1);
  const [partes, ...valores] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  const texto = partes.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, '').replace(/\s+/g, ' ').trim();
  expect(texto).not.toContain('account_id');
  return { texto, valores };
}

const template = {
  meta_id: 'meta-template', nome: 'aviso', idioma: 'pt_BR',
  categoria_pedida: 'UTILITY', categoria_meta: 'MARKETING',
  componentes: [{ type: 'BODY', text: 'Olá {{1}}' }], estado: 'approved' as const,
  motivo_rejeicao: null,
};

describe('templates', () => {
  it('sincroniza em uma instrução e preserva a categoria originalmente pedida', async () => {
    await sincronizarTemplates([template]);
    const { texto, valores } = consulta();
    expect(texto).toContain('jsonb_to_recordset($1::jsonb)');
    expect(texto).toContain('on conflict (nome, idioma) do update set');
    expect(texto).toContain(') where true on conflict');
    expect(texto).toContain('categoria_pedida = coalesce(zap_templates.categoria_pedida, excluded.categoria_pedida)');
    expect(texto).toContain('categoria_meta = excluded.categoria_meta');
    expect(texto).toContain('componentes = excluded.componentes');
    expect(texto).toContain('estado = excluded.estado');
    expect(texto).toContain('motivo_rejeicao = excluded.motivo_rejeicao');
    expect(texto).toContain('sincronizado_em = now()');
    expect(JSON.parse(valores[0] as string)).toEqual([template]);
  });

  it('deduplica nome e idioma no próprio lote antes do upsert', async () => {
    await sincronizarTemplates([template, { ...template, estado: 'paused' }]);
    expect(JSON.parse(consulta().valores[0] as string)).toEqual([{ ...template, estado: 'paused' }]);
  });

  it('não consulta o banco para uma sincronização vazia', async () => {
    await sincronizarTemplates([]);
    expect(sql).not.toHaveBeenCalled();
  });

  it.each(['', 'approved'] as const)('lista templates com bandeira de estado %s', async (estado) => {
    sql.mockResolvedValue([{ ...template, id: 7 }]);
    expect(await listarTemplates(estado)).toEqual([{ ...template, id: 7 }]);
    const q = consulta();
    expect(q.texto).toContain('where ($1 or estado = $2)');
    expect(q.valores).toEqual([estado === '', estado]);
  });

  it('acha pelo par nome/idioma parametrizado', async () => {
    sql.mockResolvedValue([{ ...template, id: 7 }]);
    expect(await acharTemplate('aviso', 'pt_BR')).toEqual({ ...template, id: 7 });
    const q = consulta();
    expect(q.texto).toContain('where nome = $1 and idioma = $2');
    expect(q.valores).toEqual(['aviso', 'pt_BR']);
  });

  it('devolve null para template inexistente', async () => {
    expect(await acharTemplate('ausente', 'en_US')).toBeNull();
  });
});

describe('contatos', () => {
  it.each(['551187654321', '(11) 98765-4321'])('faz upsert de %s pela identidade canônica', async (telefone) => {
    sql.mockResolvedValue([{ id: 42 }]);
    expect(await salvarContato({ telefone, nome: 'Ana' })).toBe(42);
    const q = consulta();
    expect(q.texto).toContain('on conflict (telefone) do update set');
    expect(q.valores[0]).toBe('5511987654321');
    expect(q.valores).toContain('unknown');
    expect(q.texto).toContain('nome = coalesce(excluded.nome, zap_contacts.nome)');
  });

  it('recusa telefone inválido antes do banco sem incluí-lo no erro', async () => {
    await expect(salvarContato({ telefone: 'dado-inválido' })).rejects.toThrow('Telefone inválido');
    expect(sql).not.toHaveBeenCalled();
  });

  it('reimportação não apaga consentimento ativo nem reativa descadastrado', async () => {
    sql.mockResolvedValue([{ id: 42 }]);
    await salvarContato({ telefone: '5511987654321', consentimento: 'subscribed',
      consentimento_origem: 'formulário', consentimento_em: new Date('2026-09-01T00:00:00Z') });
    const q = consulta();
    expect(q.texto).toContain("when zap_contacts.consentimento = 'unsubscribed' then zap_contacts.consentimento");
    expect(q.texto).toContain("when excluded.consentimento = 'unknown' then zap_contacts.consentimento");
    expect(q.texto).toMatch(/consentimento_origem = case when zap_contacts.consentimento = 'unsubscribed'/);
    expect(q.texto).toMatch(/consentimento_em = case when zap_contacts.consentimento = 'unsubscribed'/);
    expect(q.texto).not.toContain('descadastro_em = null');
  });

  it.each(['', "Ana_%' OR 1=1 --"])('busca %s com bandeira e coringas literais', async (busca) => {
    sql.mockResolvedValue([{ id: 42, nome: 'Ana' }]);
    expect(await listarContatos(busca)).toEqual([{ id: 42, nome: 'Ana' }]);
    const q = consulta();
    expect(q.texto).toContain('where ($1 or');
    expect(q.texto).toContain(String.raw`nome ilike $2 escape '\'`);
    expect(q.texto).toContain(String.raw`telefone ilike $3 escape '\'`);
    expect(q.texto).toContain(String.raw`email ilike $4 escape '\'`);
    expect(q.valores).toEqual([busca === '', ...Array(3).fill(busca ? "%Ana\\_\\%' OR 1=1 --%" : '%%')]);
  });

  it('descadastra e cancela a fila pendente tocando as campanhas em uma instrução', async () => {
    await marcarDescadastro(42);
    const q = consulta();
    expect(q.texto).toContain("update zap_contacts set consentimento = 'unsubscribed'");
    expect(q.texto).toContain('descadastro_em = coalesce(descadastro_em, now())');
    expect(q.texto).toContain("update zap_messages set estado = 'cancelada'");
    expect(q.texto).toContain("estado = 'pendente'");
    expect(q.texto).toContain('contact_id in (select id from descadastrado)');
    expect(q.texto).toContain('update zap_campaigns set progresso_em = now()');
    expect(q.valores).toEqual([42]);
  });
});

describe('campanhas', () => {
  it('cria rascunho com template e variáveis parametrizados', async () => {
    sql.mockResolvedValue([{ id: 8 }]);
    expect(await criarCampanha({ nome: 'Aviso', template_id: 7, variaveis: { '1': 'nome' } })).toBe(8);
    const q = consulta();
    expect(q.texto).toContain('insert into zap_campaigns');
    expect(q.texto).toContain("'draft'");
    expect(q.valores).toEqual(['Aviso', 7, '{"1":"nome"}']);
  });

  it.each(['running', 'paused', 'completed', 'cancelled', 'failed'] as const)('muda estado para %s e registra marcos', async (estado) => {
    await mudarEstadoCampanha(8, estado);
    const q = consulta();
    expect(q.texto).toContain('update zap_campaigns set estado = $1');
    expect(q.texto).toContain("iniciada_em = case when $2 = 'running' then coalesce(iniciada_em, now())");
    expect(q.texto).toContain("terminada_em = case when $3 in ('completed', 'cancelled', 'failed')");
    expect(q.texto).toContain('progresso_em = now()');
    expect(q.valores).toEqual([estado, estado, estado, 8]);
  });

  it('toca o progresso de uma campanha específica', async () => {
    await tocarProgresso(8);
    const q = consulta();
    expect(q.texto).toBe('update zap_campaigns set progresso_em = now() where id = $1');
    expect(q.valores).toEqual([8]);
  });
});

describe('fila e livro-caixa', () => {
  it('enfileira todo o público elegível sem duplicatas e atualiza total/progresso atomicamente', async () => {
    sql.mockResolvedValue([{ total: 2 }]);
    expect(await enfileirarCampanha(8, [42, 43, 42, 44])).toBe(2);
    const q = consulta();
    expect(q.texto).toContain('insert into zap_messages (campaign_id, contact_id) select');
    expect(q.texto).toContain('c.id = any($2::int[])');
    expect(q.texto).toContain("c.consentimento = 'subscribed'");
    expect(q.texto).toContain('c.descadastro_em is null');
    expect(q.texto).toContain('on conflict (campaign_id, contact_id) do nothing');
    expect(q.texto).toContain('update zap_campaigns');
    expect(q.texto).toContain('select count(*) from inseridas');
    expect(q.texto).toContain('progresso_em = now()');
    expect(q.valores).toEqual([8, [42, 43, 42, 44], 8, 8]);
  });

  it('público vazio não envia instrução nem altera campanha', async () => {
    expect(await enfileirarCampanha(8, [])).toBe(0);
    expect(sql).not.toHaveBeenCalled();
  });

  it('reivindica lote com skip locked, consentimento e campanha ativa numa instrução', async () => {
    sql.mockResolvedValue([{ id: 100, contact_id: 42 }]);
    expect(await reivindicarLote(8, 'lote-a', 50)).toEqual([{ id: 100, contact_id: 42 }]);
    const q = consulta();
    expect(q.texto).toContain("update zap_messages set estado = 'enviando', lote = $1");
    expect(q.texto).toContain("m.campaign_id = $2 and m.estado = 'pendente'");
    expect(q.texto).toContain("c.consentimento = 'subscribed'");
    expect(q.texto).toContain('c.descadastro_em is null');
    expect(q.texto).toContain("a.estado in ('queued', 'running')");
    expect(q.texto).toContain('order by m.id limit $3 for update of m skip locked');
    expect(q.texto).toContain('returning id, contact_id');
    expect(q.texto).toContain('progresso_em = now()');
    expect(q.texto).toContain('select id, contact_id from reivindicadas');
    expect(q.valores).toEqual(['lote-a', 8, 50, 8]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('recusa tamanho de lote inválido %s', async (tamanho) => {
    await expect(reivindicarLote(8, 'lote-a', tamanho)).rejects.toThrow('Tamanho de lote inválido');
    expect(sql).not.toHaveBeenCalled();
  });

  it('marca envio aceito só para a reserva atual, sem devolver wamid', async () => {
    sql.mockResolvedValue([{ id: 100 }]);
    expect(await marcarResultado(100, 'lote-a', { estado: 'enviada', meta_message_id: 'wamid.pessoal' })).toBe(true);
    const q = consulta();
    expect(q.texto).toContain('meta_message_id = $2');
    expect(q.texto).toContain("enviada_em = case when $5 = 'enviada' then now()");
    expect(q.texto).toContain("where id = $7 and lote = $8 and estado = 'enviando'");
    expect(q.texto).toContain('progresso_em = now()');
    expect(q.valores).toEqual(['enviada', 'wamid.pessoal', null, null, 'enviada', 'enviada', 100, 'lote-a']);
    expect(q.texto).not.toContain('wamid.pessoal');
  });

  it('registra falha e remove wamid do texto de erro persistido', async () => {
    sql.mockResolvedValue([{ id: 100 }]);
    expect(await marcarResultado(100, 'lote-a', { estado: 'falhou', erro_codigo: '131026',
      erro_texto: 'Recusada wamid.ABC123== no provedor' })).toBe(true);
    const q = consulta();
    expect(q.texto).toContain("falhou_em = case when $6 = 'falhou' then now()");
    expect(q.valores).toEqual(['falhou', null, '131026', 'Recusada [id omitido] no provedor', 'falhou', 'falhou', 100, 'lote-a']);
  });

  it('resultado repetido ou de outra reserva não confirma escrita', async () => {
    expect(await marcarResultado(100, 'antigo', { estado: 'enviada', meta_message_id: 'wamid.pessoal' })).toBe(false);
  });
});
