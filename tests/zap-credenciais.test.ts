import { describe, expect, it } from 'vitest';
import { lerCredenciais } from '../src/lib/zap/credenciais';

const ambiente = {
  NODE_ENV: 'test' as const,
  WHATSAPP_ACCESS_TOKEN: 'token-ficticio',
  WHATSAPP_PHONE_NUMBER_ID: 'numero-id',
  WHATSAPP_BUSINESS_ACCOUNT_ID: 'conta-id',
};

describe('lerCredenciais', () => {
  it('aceita ambiente vazio sem lançar e lista os nomes exatos', () => {
    // O Next exige NODE_ENV no tipo global, mas o contrato também aceita {} em runtime.
    expect(lerCredenciais({} as NodeJS.ProcessEnv)).toEqual({
      faltando: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'],
      credenciais: null,
    });
  });

  it.each(['', '   ', undefined])('considera valor %j ausente e lista somente ele', (valor) => {
    expect(lerCredenciais({ ...ambiente, WHATSAPP_PHONE_NUMBER_ID: valor })).toEqual({
      faltando: ['WHATSAPP_PHONE_NUMBER_ID'], credenciais: null,
    });
  });

  it('usa v23.0 e não exige webhook', () => {
    expect(lerCredenciais(ambiente)).toEqual({
      faltando: [], credenciais: {
        token: 'token-ficticio', numeroId: 'numero-id', contaDoWhatsAppBusinessId: 'conta-id', versao: 'v23.0',
      },
    });
  });

  it.each([['v24.0', 'v24.0'], ['', 'v23.0'], ['  ', 'v23.0']])('resolve versão %j', (valor, versao) => {
    expect(lerCredenciais({ ...ambiente, WHATSAPP_GRAPH_API_VERSION: valor }).credenciais?.versao).toBe(versao);
  });
});
