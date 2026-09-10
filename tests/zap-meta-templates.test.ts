import { describe, expect, it, vi } from 'vitest';
import { criarTemplate, listarTemplates } from '../src/lib/zap/meta';

const creds = {
  token: 'EAA_TOKEN_FICTICIO',
  numeroId: 'numero-id',
  contaDoWhatsAppBusinessId: 'conta-id',
  versao: 'v99.0',
};

const responder = (corpo: unknown, status = 200) =>
  vi.fn(async () => Response.json(corpo as object, { status }));

describe('listarTemplates e o motivo da rejeição', () => {
  it('traz o motivo quando a Meta manda', async () => {
    const r = await listarTemplates(creds, responder({
      data: [{
        id: '123', name: 'convite', language: 'pt_BR',
        status: 'REJECTED', category: 'MARKETING',
        rejected_reason: 'INVALID_FORMAT',
      }],
    }) as never);

    expect(r.ok && r.dados[0]).toEqual({
      id: '123', name: 'convite', language: 'pt_BR',
      status: 'REJECTED', category: 'MARKETING', rejected_reason: 'INVALID_FORMAT',
    });
  });

  // A Meta manda "NONE" quando não houve rejeição. Guardar isso faria a tela
  // dizer que o template foi rejeitado por "NONE".
  it.each(['NONE', 'none'])('descarta o motivo %j, que quer dizer "sem rejeição"', async (motivo) => {
    const r = await listarTemplates(creds, responder({
      data: [{ name: 'ok', language: 'pt_BR', status: 'APPROVED', category: 'UTILITY', rejected_reason: motivo }],
    }) as never);

    expect(r.ok && 'rejected_reason' in r.dados[0]).toBe(false);
  });

  // Template antigo pode não trazer os campos novos. Quem itera precisa ver os
  // outros mesmo quando um vem incompleto.
  it('não derruba a listagem quando faltam id e motivo', async () => {
    const r = await listarTemplates(creds, responder({
      data: [
        { name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY' },
        { id: '9', name: 'convite', language: 'pt_BR', status: 'PENDING', category: 'MARKETING' },
      ],
    }) as never);

    expect(r.ok && r.dados).toHaveLength(2);
  });
});

describe('criarTemplate', () => {
  it('manda nome, idioma, categoria e componentes, e devolve o id', async () => {
    const buscar = responder({ id: '555', status: 'PENDING', category: 'MARKETING' });
    const r = await criarTemplate(creds, {
      nome: 'convite_v2', idioma: 'pt_BR', categoria: 'UTILITY',
      componentes: [{ type: 'BODY', text: 'Oi {{1}}, tudo certo.' }],
    }, buscar as never);

    const [url, opcoes] = (buscar as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v99.0/conta-id/message_templates');
    expect(opcoes.method).toBe('POST');
    expect(JSON.parse(String(opcoes.body))).toEqual({
      name: 'convite_v2', language: 'pt_BR', category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Oi {{1}}, tudo certo.' }],
    });

    // A categoria devolvida difere da pedida — e é a devolvida que vale, na
    // análise e na cobrança.
    expect(r.ok && r.dados).toEqual({ id: '555', estado: 'PENDING', categoriaDaMeta: 'MARKETING' });
  });

  it('recusa com texto humano quando a Meta rejeita', async () => {
    const r = await criarTemplate(creds, {
      nome: 'convite', idioma: 'pt_BR', categoria: 'UTILITY', componentes: [],
    }, responder({
      error: {
        code: 100, type: 'OAuthException',
        message: 'Invalid parameter',
        error_data: { details: 'O nome do template já está em uso nesta conta.' },
      },
    }, 400) as never);

    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.humano).toContain('já está em uso');
    expect(!r.ok && r.erro.tipo).toBe('permanente');
  });

  it('resposta sem id não passa por aceita', async () => {
    const r = await criarTemplate(creds, {
      nome: 'convite', idioma: 'pt_BR', categoria: 'UTILITY', componentes: [],
    }, responder({ status: 'PENDING' }) as never);

    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe('RESPOSTA_INVALIDA');
  });
});
