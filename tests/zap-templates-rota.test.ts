import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sql, isLoggedIn, criarTemplate } = vi.hoisted(() => ({
  sql: vi.fn(),
  isLoggedIn: vi.fn(),
  criarTemplate: vi.fn(),
}));
vi.mock('../src/lib/db', () => ({ sql }));
vi.mock('../src/lib/auth', () => ({ isLoggedIn }));
vi.mock('../src/lib/zap/meta', () => ({
  criarTemplate,
  enviarTemplate: vi.fn(),
  listarTemplates: vi.fn(),
}));
import { POST } from '../src/app/api/painel/zap/templates/route';

const rascunho = {
  nome: 'convite_imersao',
  idioma: 'pt_BR',
  categoria: 'UTILITY',
  corpo: 'Oi {{1}}, sua vaga na turma de {{2}} está reservada.',
  exemplos: ['Rafael', 'setembro'],
};

const pedir = (corpo: unknown = rascunho) =>
  POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(corpo) }));

beforeEach(() => {
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'segredo');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'numero-id');
  vi.stubEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', 'conta-id');
  sql.mockReset().mockResolvedValue([]);
  isLoggedIn.mockReset().mockResolvedValue(true);
  criarTemplate.mockReset().mockResolvedValue({
    ok: true,
    dados: { id: '555', estado: 'PENDING', categoriaDaMeta: 'UTILITY' },
  });
});

afterEach(() => vi.unstubAllEnvs());

describe('criar template pelo painel', () => {
  it('exige sessão', async () => {
    isLoggedIn.mockResolvedValue(false);
    expect((await pedir()).status).toBe(401);
    expect(criarTemplate).not.toHaveBeenCalled();
  });

  it('cria e guarda a categoria pedida', async () => {
    sql.mockResolvedValueOnce([]) // acharTemplate: não existe
      .mockResolvedValueOnce([{ id: 12 }]); // gravarTemplateCriado

    const r = await pedir();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      ok: true,
      id: 12,
      categoriaPedida: 'UTILITY',
      categoriaDaMeta: 'UTILITY',
      reclassificado: false,
    });

    const gravacao = sql.mock.calls[1];
    expect(gravacao.join('?')).toContain('categoria_pedida');
    expect(gravacao).toContain('UTILITY');
  });

  /**
   * O caso que motiva a tela inteira: pede-se utilidade, a Meta devolve
   * marketing, e a diferença é de cerca de seis vezes por mensagem. Quem não
   * for avisado agora descobre na fatura.
   */
  it('avisa quando a Meta reclassifica a categoria', async () => {
    criarTemplate.mockResolvedValue({
      ok: true,
      dados: { id: '555', estado: 'PENDING', categoriaDaMeta: 'MARKETING' },
    });
    sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 12 }]);

    expect(await (await pedir()).json()).toMatchObject({
      categoriaPedida: 'UTILITY',
      categoriaDaMeta: 'MARKETING',
      reclassificado: true,
    });
  });

  // Cada submissão inválida gasta uma rodada de análise da Meta. Quem itera
  // para tentar a categoria de utilidade já gasta rodadas demais com o que só
  // ela sabe julgar.
  it.each([
    [{ ...rascunho, nome: 'Convite Imersão' }, 'nome fora do padrão'],
    [{ ...rascunho, exemplos: ['Rafael'] }, 'exemplo faltando'],
    [{ ...rascunho, corpo: '{{1}}, sua vaga saiu.' }, 'variável no começo'],
    [{ ...rascunho, corpo: '   ', exemplos: [] }, 'corpo vazio'],
  ])('recusa antes de chamar a Meta: %#, %s', async (corpo) => {
    const r = await pedir(corpo);
    expect(r.status).toBe(400);
    expect(criarTemplate).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it('recusa nome já usado, dizendo o que fazer', async () => {
    sql.mockResolvedValueOnce([{ id: 3, nome: 'convite_imersao' }]);
    const r = await pedir();
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toContain('duplicar e corrigir');
    expect(criarTemplate).not.toHaveBeenCalled();
  });

  it('repassa a recusa da Meta com o texto humano', async () => {
    sql.mockResolvedValueOnce([]);
    criarTemplate.mockResolvedValue({
      ok: false,
      erro: { tipo: 'permanente', codigo: '100', humano: 'O corpo excede o limite de caracteres.' },
    });

    const r = await pedir();
    expect(r.status).toBe(502);
    expect((await r.json()).erro).toBe('O corpo excede o limite de caracteres.');
  });
});
