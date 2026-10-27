import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  VERSAO_INSTALADA,
  comoData,
  estaAtrasada,
  fraseDaVersao,
  situacaoDaVersao,
} from '../src/lib/versao';

describe('comparação de versão', () => {
  it('avisa quando a instalada é mais velha', () => {
    expect(estaAtrasada('2026-10-03', '2026-10-14')).toBe(true);
    expect(estaAtrasada('2026-09-30', '2026-10-01')).toBe(true);
  });

  it('fica calada quando está em dia ou na frente', () => {
    expect(estaAtrasada('2026-10-14', '2026-10-14')).toBe(false);
    // Acontece no painel do próprio Rafa, que publica antes de exportar.
    expect(estaAtrasada('2026-10-15', '2026-10-14')).toBe(false);
  });

  /*
   * Na dúvida, calada.
   *
   * Um aviso errado custa mais do que um aviso que falta: quem instalou não
   * tem como saber que quem está enganado é o aviso. Ela roda o atualizador
   * à toa, ou pior, acha que o painel está mentindo.
   */
  it('não avisa quando não sabe', () => {
    expect(estaAtrasada('2026-10-03', null)).toBe(false);
    expect(estaAtrasada('2026-10-03', 'ontem')).toBe(false);
    expect(estaAtrasada('qualquer coisa', '2026-10-14')).toBe(false);
    expect(estaAtrasada('', '')).toBe(false);
  });

  it('mostra a data do jeito que se lê aqui, sem a hora', () => {
    expect(comoData('2026-10-14')).toBe('14/10/2026');
    expect(comoData('2026-10-14T16:45')).toBe('14/10/2026');
    expect(comoData('lixo')).toBe('lixo');
  });

  // Publicação acontece mais de uma vez no mesmo dia, e a correção da tarde
  // costuma ser a do problema que a pessoa acabou de ter.
  it('enxerga duas publicações do mesmo dia', () => {
    expect(estaAtrasada('2026-10-14T09:00', '2026-10-14T16:45')).toBe(true);
    expect(estaAtrasada('2026-10-14T16:45', '2026-10-14T09:00')).toBe(false);
    expect(estaAtrasada('2026-10-14', '2026-10-14T09:00')).toBe(true);
  });

  it('não escreve a mesma data duas vezes na frase', () => {
    expect(fraseDaVersao('2026-10-14T09:00', '2026-10-14T16:45')).toBe(
      'Saiu uma versão nova hoje, depois da que você instalou.',
    );
    expect(fraseDaVersao('2026-10-03', '2026-10-14T16:45')).toBe(
      'Seu painel está na versão de 03/10/2026, e a de 14/10/2026 já saiu.',
    );
  });
});

describe('versao.json', () => {
  it('viaja com o pacote e está no formato que a comparação entende', () => {
    const arquivo = JSON.parse(readFileSync('versao.json', 'utf8')) as Record<string, unknown>;
    expect(arquivo.versao).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);
    expect(VERSAO_INSTALADA).toBe(arquivo.versao);
    expect(typeof arquivo.novidades).toBe('string');
  });
});

describe('consulta da versão mais nova', () => {
  const original = globalThis.fetch;
  const comResposta = (resposta: unknown) => {
    globalThis.fetch = (async () => resposta) as typeof fetch;
  };
  const restaurar = () => {
    globalThis.fetch = original;
  };

  it('lê a data e as novidades', async () => {
    comResposta({
      ok: true,
      json: async () => ({ versao: '2099-01-01', novidades: 'coisas novas' }),
    });
    try {
      const situacao = await situacaoDaVersao('https://exemplo/versao.json');
      expect(situacao.maisNova).toBe('2099-01-01');
      expect(situacao.atrasada).toBe(true);
      expect(situacao.novidades).toBe('coisas novas');
    } finally {
      restaurar();
    }
  });

  // A consulta sai para fora da instalação, e fora dela nada é garantido.
  it('não derruba nem alarma quando a consulta falha', async () => {
    for (const resposta of [
      { ok: false, json: async () => ({}) },
      { ok: true, json: async () => ({ versao: 42 }) },
      { ok: true, json: async () => ({ versao: 'ontem' }) },
      { ok: true, json: async () => { throw new Error('não é json'); } },
    ]) {
      comResposta(resposta);
      try {
        const situacao = await situacaoDaVersao('https://exemplo/versao.json');
        expect(situacao.atrasada).toBe(false);
        expect(situacao.maisNova).toBeNull();
        expect(situacao.instalada).toBe(VERSAO_INSTALADA);
      } finally {
        restaurar();
      }
    }

    globalThis.fetch = (async () => {
      throw new Error('rede fora');
    }) as typeof fetch;
    try {
      expect((await situacaoDaVersao('https://exemplo/versao.json')).atrasada).toBe(false);
    } finally {
      restaurar();
    }
  });
});
