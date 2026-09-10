import { beforeEach, describe, expect, it, vi } from 'vitest';

// A rota, a normalização e o repositório são reais. Só a sessão do Next e o
// transporte do banco são substituídos; o SQL emitido é parte do contrato.
const { sql, isLoggedIn } = vi.hoisted(() => ({ sql: vi.fn(), isLoggedIn: vi.fn() }));
vi.mock('../src/lib/db', () => ({ sql }));
vi.mock('../src/lib/auth', () => ({ isLoggedIn }));
import { POST, DELETE } from '../src/app/api/painel/zap/contatos/route';

beforeEach(() => {
  sql.mockReset().mockResolvedValue([]);
  isLoggedIn.mockReset().mockResolvedValue(true);
});

function pedido(corpo: unknown, method = 'POST') {
  return new Request('http://localhost/api/painel/zap/contatos', {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
}

function consulta(indice = 0) {
  const [partes, ...valores] = sql.mock.calls[indice] as [TemplateStringsArray, ...unknown[]];
  return { texto: partes.join('?').replace(/\s+/g, ' ').trim(), valores };
}

describe('POST contatos colados', () => {
  it.each([undefined, false, null, 'true', 1, {}, []].map((consentimento) => ({ consentimento })))('recusa consentimento $consentimento com 400 antes de qualquer gravação', async ({ consentimento }) => {
    const resposta = await POST(pedido({ texto: '5511987654321', consentimento }));
    expect(resposta.status).toBe(400);
    expect((await resposta.json()).erro).toMatch(/confirmação.*obrigatória/i);
    expect(sql).not.toHaveBeenCalled();
  });

  it.each([null, [], 'texto', { consentimento: true }, { consentimento: true, texto: 123 }].map((corpo) => ({ corpo })))('recusa corpo inválido $corpo sem banco', async ({ corpo }) => {
    expect((await POST(pedido(corpo))).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it('recusa JSON quebrado sem banco', async () => {
    expect((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it('grava só os canônicos únicos com data do servidor e origem padrão', async () => {
    sql.mockResolvedValue([{ telefone: '5511987654321' }]);
    const resposta = await POST(pedido({ texto: '(11) 98765-4321\n551187654321\nlixo', consentimento: true }));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ ok: true,
      contagens: { validos: 1, repetidos: 1, invalidos: 1, cadastrados: 1, existentes: 0 },
      linhas: [
        { situacao: 'valido', telefone: '5511987654321', resultado: 'cadastrado' },
        { situacao: 'repetido', telefone: '5511987654321' },
        { situacao: 'invalido', motivo: 'não parece telefone' },
      ],
    });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(consulta().valores).toEqual(['colado-no-painel', ['5511987654321']]);
    expect(consulta().texto).toContain("'subscribed'");
    expect(consulta().texto).toContain('now()');
  });

  it('segunda colagem não duplica nem reescreve a primeira evidência, mesmo com outra origem', async () => {
    sql.mockResolvedValueOnce([{ telefone: '5511987654321' }]).mockResolvedValueOnce([]);
    await POST(pedido({ texto: '5511987654321', consentimento: true, origem: 'primeiro-sim' }));
    const segunda = await POST(pedido({ texto: '551187654321', consentimento: true, origem: 'novo-sim' }));
    expect(await segunda.json()).toMatchObject({
      contagens: { cadastrados: 0, existentes: 1 },
      linhas: [{ telefone: '5511987654321', resultado: 'existente' }],
    });
    // O banco impõe a idempotência inclusive sob concorrência. Não há UPDATE
    // que possa trocar data/origem ou reativar um opt-out durante uma colagem.
    for (const indice of [0, 1]) {
      expect(consulta(indice).texto).toContain('on conflict (telefone) do nothing');
      expect(consulta(indice).texto).not.toMatch(/\bupdate\b/i);
    }
    expect(consulta(0).valores).toContain('primeiro-sim');
    expect(consulta(1).valores).toContain('novo-sim');
  });

  it('lista sem válidos não consulta o banco', async () => {
    const resposta = await POST(pedido({ texto: 'lixo\n\n', consentimento: true }));
    expect(await resposta.json()).toMatchObject({ contagens: { validos: 0, invalidos: 1, cadastrados: 0 } });
    expect(sql).not.toHaveBeenCalled();
  });

  it('limita a chamada a 1000 linhas e marca a 1001ª', async () => {
    const texto = Array.from({ length: 1001 }, (_, i) => `+1202555${String(i).padStart(4, '0')}`).join('\n');
    const resposta = await POST(pedido({ texto, consentimento: true }));
    const dados = await resposta.json();
    expect(dados.contagens).toMatchObject({ validos: 1000, invalidos: 1 });
    expect(dados.linhas[1000]).toMatchObject({ situacao: 'invalido', motivo: expect.stringContaining('1000') });
    expect(consulta().valores[1]).toHaveLength(1000);
  });

  it('mede o corpo inteiro em bytes, sem confiar em Content-Length', async () => {
    const corpo = JSON.stringify({ texto: '5511987654321', consentimento: true, origem: 'á'.repeat(52_000) });
    expect(corpo.length).toBeLessThan(100 * 1024);
    const resposta = await POST(new Request('http://localhost', {
      method: 'POST', body: corpo, headers: { 'content-length': '1' },
    }));
    expect(resposta.status).toBe(413);
    expect(sql).not.toHaveBeenCalled();
  });

  it('aceita exatamente 100 KB de corpo', async () => {
    const corpo = JSON.stringify({ texto: '', consentimento: true });
    const resposta = await POST(new Request('http://localhost', {
      method: 'POST', body: corpo.padEnd(100 * 1024, ' '),
    }));
    expect(resposta.status).toBe(200);
  });
});

describe('sessão e descadastro', () => {
  it.each([POST, DELETE])('sem sessão usa a mesma recusa de sites, sem acessar o banco', async (acao) => {
    isLoggedIn.mockResolvedValue(false);
    const resposta = await acao(pedido({ texto: '5511987654321', consentimento: true, id: 42 }));
    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual({ ok: false, erro: 'Sessão necessária.' });
    expect(sql).not.toHaveBeenCalled();
  });

  it('descadastra sem apagar consentimento antigo e cancela pendentes', async () => {
    expect((await DELETE(pedido({ id: 42 }, 'DELETE'))).status).toBe(200);
    const q = consulta();
    expect(q.valores).toEqual([42]);
    expect(q.texto).toContain("consentimento = 'unsubscribed'");
    expect(q.texto).toContain('descadastro_em = coalesce(descadastro_em, now())');
    expect(q.texto).toContain("estado = 'pendente'");
    expect(q.texto).not.toMatch(/delete from|consentimento_em\s*=/i);
  });

  it.each([undefined, null, '42', 0, -1, 1.5])('recusa id inválido %j', async (id) => {
    expect((await DELETE(pedido({ id }, 'DELETE'))).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });
});
