import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const { sql, isLoggedIn, enviarTemplate, listarTemplates } = vi.hoisted(() => ({
  sql: vi.fn(), isLoggedIn: vi.fn(), enviarTemplate: vi.fn(), listarTemplates: vi.fn(),
}));
vi.mock('../src/lib/db', () => ({ sql }));
vi.mock('../src/lib/auth', () => ({ isLoggedIn }));
vi.mock('../src/lib/zap/meta', () => ({ enviarTemplate, listarTemplates }));
import { POST as criar } from '../src/app/api/painel/zap/campanhas/route';
import { POST as disparar } from '../src/app/api/painel/zap/campanhas/[id]/disparar/route';
import { POST as sincronizar } from '../src/app/api/painel/zap/templates/sincronizar/route';

const template = { id: 7, nome: 'hello_world', idioma: 'en_US', estado: 'approved', componentes: [], motivo_rejeicao: null };
const campanha = { id: 8, nome: 'Primeiro envio', template_id: 7, estado: 'draft', variaveis: {},
  template_nome: 'hello_world', idioma: 'en_US', template_estado: 'approved', componentes: [] };
const contexto = { params: Promise.resolve({ id: '8' }) };
const pedido = (body: unknown = {}) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
const consulta = (i: number) => ({ texto: sql.mock.calls[i][0].join('?').replace(/\s+/g, ' ').trim(), valores: sql.mock.calls[i].slice(1) });
const consultas = () => sql.mock.calls.map((_, i) => consulta(i));

beforeEach(() => {
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'segredo');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'numero-id');
  vi.stubEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', 'conta-id');
  sql.mockReset().mockResolvedValue([]);
  isLoggedIn.mockReset().mockResolvedValue(true);
  enviarTemplate.mockReset().mockResolvedValue({ ok: true, dados: { id: 'wamid.ID_PRIVADO', estado: 'accepted' } });
  listarTemplates.mockReset().mockResolvedValue({ ok: true, dados: [{ name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY' }] });
});

afterEach(() => { vi.unstubAllEnvs(); });

function lote(resultado: { pendentes: number; enviando?: number } = { pendentes: 0 }) {
  sql.mockResolvedValueOnce([campanha]) // leitura
    .mockResolvedValueOnce([{ id: 8 }]) // início condicional
    .mockResolvedValueOnce([{ id: 90, contact_id: 42 }])
    .mockResolvedValueOnce([{ telefone: '5511987654321' }])
    .mockResolvedValueOnce([{ id: 90 }]) // resultado
    .mockResolvedValueOnce([]) // conclusão condicional
    .mockResolvedValueOnce([{ ...resultado, enviando: resultado.enviando ?? 0 }]);
}

describe('sessão e validação de campanhas', () => {
  it('exige sessão nas três mutações antes do banco ou Meta', async () => {
    isLoggedIn.mockResolvedValue(false);
    for (const resposta of [await criar(pedido()), await disparar(pedido(), contexto), await sincronizar()]) {
      expect(resposta.status).toBe(401);
    }
    expect(sql).not.toHaveBeenCalled();
    expect(enviarTemplate).not.toHaveBeenCalled();
    expect(listarTemplates).not.toHaveBeenCalled();
  });

  it.each([{}, null, [], { nome: ' ', templateId: 7, contatos: [1] }, { nome: 'Teste', templateId: 0, contatos: [1] },
    { nome: 'Teste', templateId: 7, contatos: [] }, { nome: 'Teste', templateId: 7, contatos: ['1'] },
    { nome: 'Teste', templateId: 7, contatos: [-1] }])('recusa corpo inválido %j', async (body) => {
    expect((await criar(pedido(body))).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it('recusa JSON quebrado', async () => {
    expect((await criar(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
  });

  it('recusa template não aprovado com motivo', async () => {
    sql.mockResolvedValueOnce([{ ...template, estado: 'rejected', motivo_rejeicao: 'Conteúdo recusado pela Meta.' }]);
    const r = await criar(pedido({ nome: 'Teste', templateId: 7, contatos: [1] }));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toContain('Conteúdo recusado pela Meta.');
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('recusa variáveis conhecidas antes de criar a campanha', async () => {
    sql.mockResolvedValueOnce([{ ...template, componentes: [{ type: 'BODY', text: 'Olá {{1}}' }] }]);
    const r = await criar(pedido({ nome: 'Teste', templateId: 7, contatos: [1] }));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toMatch(/sem variáveis/);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('dez contatos, três sem consentimento: usa a fila real e informa sete e três', async () => {
    sql.mockResolvedValueOnce([template]).mockResolvedValueOnce([{ id: 8 }]).mockResolvedValueOnce([{ total: 7 }]);
    const r = await criar(pedido({ nome: ' Teste ', templateId: 7, contatos: [1,2,3,4,5,6,7,8,9,10,10] }));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true, id: 8, enfileirados: 7, recusadosPorConsentimento: 3 });
    expect(consulta(1).texto).toContain("'draft'");
    expect(consulta(1).valores).toEqual(['Teste', 7, '{}']);
    expect(consulta(2).texto).toContain("c.consentimento = 'subscribed' and c.descadastro_em is null");
    expect(consulta(2).valores).toContainEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(sql).toHaveBeenCalledTimes(3);
  });
});

describe('drenagem de um lote', () => {
  it('falha na gravação não abandona as demais reservas e repete só a gravação', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([{ id: 90, contact_id: 42 }, { id: 91, contact_id: 43 }])
      .mockResolvedValueOnce([{ telefone: '5511987654321' }])
      .mockRejectedValueOnce(new Error('gravação indisponível'))
      .mockResolvedValueOnce([{ telefone: '5521987654321' }]).mockResolvedValueOnce([{ id: 91 }])
      .mockResolvedValueOnce([{ id: 90 }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ pendentes: 0, enviando: 0 }]);
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 2, falhas: 0, pendentes: 0 });
    expect(enviarTemplate).toHaveBeenCalledTimes(2);
    expect(consulta(7)).toEqual(consulta(4));
  });

  it('falha ao persistir retorno transitório repete pendente, nunca converte para falhou', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([{ id: 90, contact_id: 42 }])
      .mockResolvedValueOnce([{ telefone: '5511987654321' }])
      .mockRejectedValueOnce(new Error('banco')).mockResolvedValueOnce([{ id: 90 }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ pendentes: 1, enviando: 0 }]);
    enviarTemplate.mockResolvedValue({ ok: false, erro: { tipo: 'transitorio', codigo: 'HTTP_500', humano: 'Tente mais tarde.' } });
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 0, falhas: 0, pendentes: 1 });
    expect(consulta(5)).toEqual(consulta(4));
    expect(enviarTemplate).toHaveBeenCalledTimes(1);
  });

  it('persiste enviada com id privado; resposta tem apenas contagens', async () => {
    lote();
    const r = await disparar(pedido(), contexto);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enviadas: 1, falhas: 0, pendentes: 0 });
    expect(enviarTemplate.mock.calls[0][1]).toEqual({ para: '5511987654321', template: 'hello_world', idioma: 'en_US' });
    expect(consulta(4).valores).toContain('enviada');
    expect(consulta(4).valores).toContain('wamid.ID_PRIVADO');
    expect(consulta(4).valores).toContain(consulta(2).valores[0]);
  });

  it('falha permanente persiste código e texto humano', async () => {
    lote();
    enviarTemplate.mockResolvedValue({ ok: false, erro: { tipo: 'permanente', codigo: '131030', humano: 'Confirme o número na lista de teste.' } });
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 0, falhas: 1, pendentes: 0 });
    expect(consulta(4).valores).toEqual(expect.arrayContaining(['falhou', '131030', 'Confirme o número na lista de teste.']));
  });

  it('falha transitória volta para pendente e a próxima drenagem envia com novo lote', async () => {
    lote({ pendentes: 1 });
    lote();
    enviarTemplate.mockResolvedValueOnce({ ok: false, erro: { tipo: 'transitorio', codigo: 'HTTP_429', humano: 'Tente novamente mais tarde.' } });
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 0, falhas: 0, pendentes: 1 });
    expect(consulta(4).texto).toContain("estado = 'pendente'");
    expect(consulta(4).texto).toContain("estado = 'enviando'");
    expect(consulta(4).texto).toContain('lote = ?');
    expect(consulta(4).valores).toContain('HTTP_429');
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 1, falhas: 0, pendentes: 0 });
    expect(consulta(2).valores[0]).not.toBe(consulta(9).valores[0]);
  });

  it('exceção inesperada recebe resultado seguro e não escapa para logs', async () => {
    lote();
    enviarTemplate.mockRejectedValue(new Error('5511987654321 wamid.ID_PRIVADO segredo'));
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 0, falhas: 1, pendentes: 0 });
    expect(consulta(4).valores).toContain('falhou');
    expect(consulta(4).valores).toContain('ENVIO_INESPERADO');
    expect(JSON.stringify(consulta(4).valores)).not.toMatch(/5511987654321|wamid|segredo/);
  });

  it('falha ao buscar telefone também encerra a reserva', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([{ id: 90, contact_id: 42 }]).mockRejectedValueOnce(new Error('banco'))
      .mockResolvedValueOnce([{ id: 90 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ pendentes: 0, enviando: 0 }]);
    expect((await disparar(pedido(), contexto)).status).toBe(200);
    expect(consulta(4).valores).toContain('falhou');
    expect(enviarTemplate).not.toHaveBeenCalled();
  });

  it.each(['paused', 'cancelled', 'completed', 'failed'])('campanha %s não drena', async (estado) => {
    sql.mockResolvedValueOnce([{ ...campanha, estado }]);
    const r = await disparar(pedido(), contexto);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ estado, erro: expect.any(String) });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(enviarTemplate).not.toHaveBeenCalled();
  });

  it('sem pendentes conclui com timestamp, sem concluir outra reserva em andamento', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([{ id: 8 }]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ pendentes: 0, enviando: 0 }]);
    expect(await (await disparar(pedido(), contexto)).json()).toEqual({ enviadas: 0, falhas: 0, pendentes: 0 });
    expect(consulta(3).texto).toContain("estado = 'completed'");
    expect(consulta(3).texto).toContain('terminada_em =');
    expect(consulta(3).texto).toContain('not exists');
    expect(consulta(3).texto).toContain("('pendente', 'enviando')");
  });

  it('envia sequencialmente e grava cada resultado antes de iniciar o próximo', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([{ id: 90, contact_id: 42 }, { id: 91, contact_id: 43 }])
      .mockResolvedValueOnce([{ telefone: '5511987654321' }]).mockResolvedValueOnce([{ id: 90 }])
      .mockResolvedValueOnce([{ telefone: '5521987654321' }]).mockResolvedValueOnce([{ id: 91 }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ pendentes: 12, enviando: 0 }]);
    let liberar!: (v: unknown) => void;
    enviarTemplate.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    const resposta = disparar(pedido(), contexto);
    await vi.waitFor(() => expect(enviarTemplate).toHaveBeenCalledTimes(1));
    expect(sql).toHaveBeenCalledTimes(4);
    liberar({ ok: true, dados: { id: 'wamid.PRIMEIRO', estado: 'accepted' } });
    expect(await (await resposta).json()).toEqual({ enviadas: 2, falhas: 0, pendentes: 12 });
    expect(sql.mock.invocationCallOrder[4]).toBeLessThan(enviarTemplate.mock.invocationCallOrder[1]);
    expect(consultas().filter(q => q.texto.includes('skip locked'))).toHaveLength(1);
  });

  it('não reserva sem credenciais', async () => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '');
    sql.mockResolvedValueOnce([campanha]);
    expect((await disparar(pedido(), contexto)).status).toBe(400);
    expect(consultas().some(q => q.texto.includes('skip locked'))).toBe(false);
  });

  it('não retoma campanha pausada entre leitura e início', async () => {
    sql.mockResolvedValueOnce([campanha]).mockResolvedValueOnce([]);
    expect((await disparar(pedido(), contexto)).status).toBe(409);
    expect(consulta(1).texto).toContain("estado in ('draft', 'queued', 'running')");
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it.each(['0', 'NaN', '1.2', '-1', '8x'])('recusa id %s', async (id) => {
    expect((await disparar(pedido(), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe('sincronização', () => {
  // A listagem da Meta traz nome, idioma, estado, categoria, id e — quando há —
  // o motivo da rejeição. **Não** traz os componentes, então estes continuam
  // intocados: o que a pessoa escreveu localmente não pode ser apagado por uma
  // sincronização que não sabe o conteúdo.
  it('traz hello_world pelo par nome/idioma sem apagar os componentes locais', async () => {
    const r = await sincronizar();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, sincronizados: 1 });
    const q = consulta(0);
    expect(q.texto).toContain('on conflict (nome, idioma) do update set');
    expect(q.texto).not.toContain('componentes =');
    expect(JSON.parse(q.valores[0])).toEqual([{
      nome: 'hello_world', idioma: 'en_US', estado: 'approved',
      categoria_meta: 'UTILITY', meta_id: null, motivo_rejeicao: null,
    }]);
  });

  it('guarda o motivo quando a Meta rejeita, e o descarta quando ela aprova', async () => {
    listarTemplates.mockResolvedValue({
      ok: true,
      dados: [
        { id: '9', name: 'convite', language: 'pt_BR', status: 'REJECTED', category: 'MARKETING', rejected_reason: 'INVALID_FORMAT' },
        { id: '10', name: 'aviso', language: 'pt_BR', status: 'APPROVED', category: 'UTILITY' },
      ],
    });

    expect((await sincronizar()).status).toBe(200);
    expect(JSON.parse(consulta(0).valores[0])).toEqual([
      { nome: 'convite', idioma: 'pt_BR', estado: 'rejected', categoria_meta: 'MARKETING', meta_id: '9', motivo_rejeicao: 'INVALID_FORMAT' },
      { nome: 'aviso', idioma: 'pt_BR', estado: 'approved', categoria_meta: 'UTILITY', meta_id: '10', motivo_rejeicao: null },
    ]);
  });

  it('lista vazia marca ausentes sem apagar templates nem rascunhos locais', async () => {
    listarTemplates.mockResolvedValue({ ok: true, dados: [] });
    expect((await sincronizar()).status).toBe(200);
    const q = consulta(0);
    expect(q.valores[0]).toBe('[]');
    expect(q.texto).toContain("estado = 'disabled'");
    expect(q.texto).toContain('sincronizado_em is not null');
    expect(q.texto).toContain('not exists');
    expect(q.texto).not.toMatch(/\bdelete\b/i);
  });

  it('falha da Meta não altera o banco', async () => {
    listarTemplates.mockResolvedValue({ ok: false, erro: { tipo: 'transitorio', codigo: 'HTTP_500', humano: 'Meta indisponível.' } });
    const r = await sincronizar();
    expect(r.status).toBe(502);
    expect((await r.json()).erro).toContain('Meta indisponível.');
    expect(sql).not.toHaveBeenCalled();
  });
});

it('módulos do disparo não contêm saídas de console nem paralelização ou autochamada', () => {
  for (const path of ['src/lib/zap/campanhas.ts', 'src/lib/repo/zap-disparo.ts',
    'src/app/api/painel/zap/campanhas/route.ts', 'src/app/api/painel/zap/campanhas/[id]/disparar/route.ts',
    'src/app/api/painel/zap/templates/sincronizar/route.ts']) {
    const codigo = readFileSync(path, 'utf8');
    expect(codigo).not.toMatch(/console\s*\./);
    expect(codigo).not.toMatch(/Promise\.all|after\(/);
  }
});
