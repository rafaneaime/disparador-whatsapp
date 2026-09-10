import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classificarErro, consultarNumero, enviarTemplate, listarTemplates,
  type CredenciaisDaMeta,
} from '../src/lib/zap/meta';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede proibida neste teste'); }));
});
afterEach(() => vi.unstubAllGlobals());

const creds: CredenciaisDaMeta = {
  token: 'token-de-teste', numeroId: 'numero-id',
  contaDoWhatsAppBusinessId: 'conta-id', versao: 'v99.0',
};
const envio = { para: '5511999999999', template: 'hello_world', idioma: 'en_US', variaveis: [] };
const aceito = {
  messaging_product: 'whatsapp',
  contacts: [{ input: '5511999999999', wa_id: '5511999999999' }],
  messages: [{ id: 'wamid....', message_status: 'accepted' }],
};
const numero = {
  display_phone_number: '+1 555-677-9122', verified_name: 'Test Number',
  quality_rating: 'UNKNOWN', platform_type: 'CLOUD_API',
};
const template = { name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY' };

function resposta(corpo: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockImplementation(async () => Response.json(corpo, { status }));
}

const foraDaLista = {
  error: {
    message: '(#131030) Recipient phone number not in allowed list',
    type: 'OAuthException',
    code: 131030,
    error_data: {
      details: 'O número de telefone do destinatário não está na lista de permissão...',
    },
  },
};

describe('classificarErro', () => {
  it.each([400, 429, 503])('mantém 131030 permanente em HTTP %s e explica a confirmação', (status) => {
    expect(classificarErro(status, foraDaLista)).toEqual({
      tipo: 'permanente',
      codigo: '131030',
      humano: 'Este número não está confirmado na sua lista de teste. Adicione e confirme o código no painel da Meta antes de disparar.',
    });
  });

  it('prefere details em português ao message', () => {
    expect(classificarErro(400, {
      error: {
        code: 123456,
        type: 'OAuthException',
        message: 'Request refused',
        error_data: { details: 'Não foi possível enviar este template.' },
      },
    })).toEqual({
      tipo: 'permanente', codigo: '123456', humano: 'Não foi possível enviar este template.',
    });
  });

  it('usa message quando não há details', () => {
    expect(classificarErro(400, { error: { code: 123456, message: 'Request refused' } }))
      .toEqual({ tipo: 'permanente', codigo: '123456', humano: 'Request refused' });
  });

  /**
   * O caso que derrubou a regra "details sempre vence".
   *
   * Corpo observado contra a API real em 07/09/2026, com o token vencido: o
   * `message` diz a hora exata em que a sessão expirou, e o `details` diz só
   * "Authentication Error". Preferir `details` aqui esconderia da pessoa a
   * única informação que resolve o problema dela.
   */
  it('usa message quando ele explica mais que o details', () => {
    const falha = classificarErro(401, {
      error: {
        code: 190,
        type: 'OAuthException',
        message:
          'Error validating access token: Session has expired on Monday, 07-Sep-26 09:00:00 PDT.',
        error_data: { details: 'Authentication Error' },
      },
    });

    expect(falha.codigo).toBe('190');
    expect(falha.humano).toContain('Session has expired');
    expect(falha.humano).not.toBe('Authentication Error');
  });

  it.each([
    [200, 'permanente'], [302, 'permanente'], [400, 'permanente'],
    [401, 'permanente'], [403, 'permanente'], [408, 'permanente'],
    [429, 'transitorio'], [499, 'permanente'], [500, 'transitorio'],
    [503, 'transitorio'], [599, 'transitorio'],
  ])('classifica HTTP %s sem adivinhar códigos da Meta', (status, tipo) => {
    expect(classificarErro(status, { error: { code: 123456, message: 'Falhou' } }))
      .toEqual({ tipo, codigo: '123456', humano: 'Falhou' });
  });

  it.each([null, undefined, '', '<html>erro</html>', [], {}, { error: null }].map((corpo) => [corpo]))(
    'tolera corpo inválido %j e informa o HTTP', (corpo) => {
      expect(classificarErro(400, corpo)).toEqual({
        tipo: 'permanente', codigo: 'HTTP_400', humano: 'A Meta recusou a requisição (HTTP 400).',
      });
    },
  );

  it.each(['details', 'message'])('não devolve wamid no texto de erro em %s', (campo) => {
    const texto = 'Não foi possível processar wamid.ABC123==.';
    const error = campo === 'details'
      ? { code: 123456, error_data: { details: texto } }
      : { code: 123456, message: texto };
    const falha = classificarErro(400, { error });
    expect(falha.humano).toContain('Não foi possível processar');
    expect(falha.humano).not.toContain('wamid.');
    expect(falha.humano).not.toContain('ABC123');
  });
});

describe('enviarTemplate', () => {
  it('envia exatamente o corpo observado e devolve somente id e estado', async () => {
    const buscar = resposta(aceito);
    expect(await enviarTemplate(creds, envio, buscar)).toEqual({
      ok: true, dados: { id: 'wamid....', estado: 'accepted' },
    });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v99.0/numero-id/messages');
    expect(opcoes?.method).toBe('POST');
    expect(new Headers(opcoes?.headers).get('Authorization')).toBe('Bearer token-de-teste');
    expect(new Headers(opcoes?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(opcoes?.body))).toEqual({
      messaging_product: 'whatsapp', to: '5511999999999', type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
  });

  it('traduz a recusa observada 131030 sem lançar', async () => {
    expect(await enviarTemplate(creds, envio, resposta(foraDaLista, 400))).toEqual({
      ok: false,
      erro: {
        tipo: 'permanente', codigo: '131030',
        humano: 'Este número não está confirmado na sua lista de teste. Adicione e confirme o código no painel da Meta antes de disparar.',
      },
    });
  });

  it('preserva details na falha HTTP do envio', async () => {
    expect(await enviarTemplate(creds, envio, resposta({
      error: { code: 123456, message: 'Request refused', error_data: { details: 'Envio recusado.' } },
    }, 400))).toEqual({
      ok: false, erro: { tipo: 'permanente', codigo: '123456', humano: 'Envio recusado.' },
    });
  });

  it.each([429, 503])('devolve falha transitória para HTTP %s sem retentar', async (status) => {
    const buscar = resposta({ error: { code: 123456, message: 'Indisponível' } }, status);
    expect(await enviarTemplate(creds, envio, buscar)).toEqual({
      ok: false, erro: { tipo: 'transitorio', codigo: '123456', humano: 'Indisponível' },
    });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('converte exceção de rede em falha transitória sem expor seu texto', async () => {
    const buscar = vi.fn<typeof fetch>().mockRejectedValue(new Error('5511999999999 wamid.ABC123=='));
    expect(await enviarTemplate(creds, envio, buscar)).toEqual({
      ok: false, erro: {
        tipo: 'transitorio', codigo: 'FALHA_DE_REDE',
        humano: 'Não foi possível conectar à Meta. Tente novamente.',
      },
    });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it.each([
    null, {}, { ...aceito, messages: undefined }, { ...aceito, messages: [] },
    { ...aceito, messages: [null] }, { ...aceito, messages: [{ id: 'wamid.ABC123==' }] },
    { ...aceito, messages: [{ id: '', message_status: 'accepted' }] },
    { ...aceito, messages: [{ id: 123, message_status: 'accepted' }] },
    { ...aceito, messages: [{ id: 'wamid.ABC123==', message_status: '' }] },
  ].map((corpo) => [corpo]))('recusa 200 malformado sem ecoar o corpo: %j', async (corpo) => {
    expect(await enviarTemplate(creds, envio, resposta(corpo))).toEqual({
      ok: false, erro: {
        tipo: 'permanente', codigo: 'RESPOSTA_INVALIDA',
        humano: 'A Meta retornou uma resposta de envio sem id ou estado da mensagem.',
      },
    });
  });

  it.each([
    [200, 'permanente', 'RESPOSTA_INVALIDA'],
    [400, 'permanente', 'HTTP_400'],
    [429, 'transitorio', 'HTTP_429'],
    [503, 'transitorio', 'HTTP_503'],
  ])('tolera corpo não JSON em HTTP %s preservando a classificação', async (status, tipo, codigo) => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>5511999999999 wamid.ABC123==</html>', { status }),
    );
    const resultado = await enviarTemplate(creds, envio, buscar);
    expect(resultado).toMatchObject({ ok: false, erro: { tipo, codigo, humano: expect.any(String) } });
    expect(JSON.stringify(resultado)).not.toMatch(/5511999999999|wamid\.|ABC123/);
  });

  it('recusa variáveis preenchidas sem inventar campos nem disparar envio incompleto', async () => {
    const buscar = resposta(aceito);
    expect(await enviarTemplate(creds, { ...envio, variaveis: ['Rafa'] }, buscar)).toEqual({
      ok: false, erro: {
        tipo: 'permanente', codigo: 'VARIAVEIS_NAO_SUPORTADAS',
        humano: 'O envio com variáveis ainda não tem formato validado neste adaptador. Use um template sem variáveis.',
      },
    });
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('consultarNumero', () => {
  it('consulta o número com os quatro campos observados e a versão recebida', async () => {
    const buscar = resposta(numero);
    expect(await consultarNumero(creds, buscar)).toEqual({ ok: true, dados: numero });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v99.0/numero-id?fields=display_phone_number,verified_name,quality_rating,platform_type');
    expect(opcoes?.method).toBe('GET');
    expect(opcoes?.body).toBeUndefined();
    expect(opcoes?.cache).toBe('no-store');
    expect(new Headers(opcoes?.headers).get('Authorization')).toBe('Bearer token-de-teste');
  });

  it.each([null, {}, { ...numero, quality_rating: undefined }, { ...numero, verified_name: 123 }]
    .map((corpo) => [corpo]))('recusa resposta incompleta do número: %j', async (corpo) => {
    expect(await consultarNumero(creds, resposta(corpo))).toEqual({
      ok: false, erro: {
        tipo: 'permanente', codigo: 'RESPOSTA_INVALIDA',
        humano: 'A Meta retornou uma resposta de consulta do número incompleta.',
      },
    });
  });
});

describe('listarTemplates', () => {
  it('lista os templates com os quatro campos observados e a conta Business recebida', async () => {
    const buscar = resposta({ data: [template] });
    expect(await listarTemplates(creds, buscar)).toEqual({ ok: true, dados: [template] });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0];
    // `rejected_reason` e `id` entraram em 08/09: sem pedi-los, a coluna
    // `motivo_rejeicao` nunca era preenchida e a rejeição não ensinava nada.
    expect(url).toBe(
      'https://graph.facebook.com/v99.0/conta-id/message_templates?fields=id,name,language,status,category,rejected_reason',
    );
    expect(opcoes?.method).toBe('GET');
    expect(opcoes?.body).toBeUndefined();
    expect(opcoes?.cache).toBe('no-store');
    expect(new Headers(opcoes?.headers).get('Authorization')).toBe('Bearer token-de-teste');
  });

  it('aceita uma lista vazia', async () => {
    expect(await listarTemplates(creds, resposta({ data: [] }))).toEqual({ ok: true, dados: [] });
  });

  it.each([
    null, {}, { data: {} }, { data: [null] },
    { data: [{ ...template, language: undefined }] },
    { data: [template, { ...template, status: 123 }] },
  ].map((corpo) => [corpo]))('recusa lista malformada sem sucesso parcial: %j', async (corpo) => {
    expect(await listarTemplates(creds, resposta(corpo))).toEqual({
      ok: false, erro: {
        tipo: 'permanente', codigo: 'RESPOSTA_INVALIDA',
        humano: 'A Meta retornou uma lista de templates inválida.',
      },
    });
  });
});

describe.each([
  { nome: 'consultarNumero', executar: (buscar: typeof fetch) => consultarNumero(creds, buscar) },
  { nome: 'listarTemplates', executar: (buscar: typeof fetch) => listarTemplates(creds, buscar) },
])('$nome: falhas', ({ executar }) => {
  it.each([[400, 'permanente'], [429, 'transitorio'], [503, 'transitorio']])(
    'preserva a classificação de HTTP %s', async (status, tipo) => {
      const buscar = resposta({ error: { code: 123456, message: 'Recusado', error_data: { details: 'Falha na consulta.' } } }, status);
      expect(await executar(buscar)).toEqual({
        ok: false, erro: { tipo, codigo: '123456', humano: 'Falha na consulta.' },
      });
      expect(buscar).toHaveBeenCalledTimes(1);
    },
  );

  it('não lança nem expõe a exceção de rede', async () => {
    const buscar = vi.fn<typeof fetch>().mockRejectedValue(new Error('5511999999999 wamid.ABC123=='));
    expect(await executar(buscar)).toEqual({
      ok: false, erro: {
        tipo: 'transitorio', codigo: 'FALHA_DE_REDE',
        humano: 'Não foi possível conectar à Meta. Tente novamente.',
      },
    });
  });

  it.each([[200, 'permanente'], [503, 'transitorio']])('tolera não JSON em HTTP %s', async (status, tipo) => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>erro</html>', { status }));
    expect(await executar(buscar)).toMatchObject({ ok: false, erro: { tipo, humano: expect.any(String) } });
  });
});

it('usa fetch padrão quando buscar é omitido, sempre simulado no teste', async () => {
  const buscar = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(aceito))
    .mockResolvedValueOnce(Response.json(numero))
    .mockResolvedValueOnce(Response.json({ data: [template] }));
  vi.stubGlobal('fetch', buscar);
  expect(await enviarTemplate(creds, { para: envio.para, template: envio.template, idioma: envio.idioma }))
    .toEqual({ ok: true, dados: { id: 'wamid....', estado: 'accepted' } });
  expect(await consultarNumero(creds)).toEqual({ ok: true, dados: numero });
  expect(await listarTemplates(creds)).toEqual({ ok: true, dados: [template] });
  expect(buscar).toHaveBeenCalledTimes(3);
});

it('o adaptador não escreve em console nem lê credenciais do ambiente', () => {
  const fonte = readFileSync('src/lib/zap/meta.ts', 'utf8');
  expect(fonte).not.toMatch(/console\s*\./);
  expect(fonte).not.toMatch(/process\s*\.\s*env/);
});
