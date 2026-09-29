import { describe, expect, it } from 'vitest';
import {
  contarVariaveis,
  lerVariaveis,
  limparValor,
  resolverVariaveis,
} from '../src/lib/zap/variaveis';

describe('contarVariaveis', () => {
  it.each([
    [[{ type: 'BODY', text: 'Sem variável nenhuma.' }], 0],
    [[{ type: 'BODY', text: 'Oi {{1}}' }], 1],
    [[{ type: 'BODY', text: 'Oi {{1}}, turma de {{2}}' }], 2],
    // A mesma posição repetida é uma variável só — a Meta manda um valor.
    [[{ type: 'BODY', text: 'Oi {{1}}, até logo {{1}}' }], 1],
    // A conta é pela maior posição: um template com {{2}} sem {{1}} é torto,
    // mas a Meta cobra dois valores.
    [[{ type: 'BODY', text: 'Turma de {{2}}' }], 2],
    [[], 0],
    [null, 0],
  ])('%j -> %i', (componentes, esperado) => {
    expect(contarVariaveis(componentes)).toBe(esperado);
  });
});

/**
 * A Cloud API recusa quebra de linha, tabulação e quatro espaços seguidos
 * dentro de uma variável — e nome colado de planilha traz os três.
 */
describe('limparValor', () => {
  it.each([
    ['Maria\nSilva', 'Maria Silva'],
    ['Maria\tSilva', 'Maria Silva'],
    ['Maria     Silva', 'Maria   Silva'],
    ['  Maria  ', 'Maria'],
    ['   ', ''],
  ])('%j -> %j', (entrada, esperado) => {
    expect(limparValor(entrada)).toBe(esperado);
  });
});

describe('lerVariaveis', () => {
  it('lê as duas origens e limpa o texto', () => {
    expect(lerVariaveis([
      { origem: 'nome', padrao: ' tudo bem ' },
      { origem: 'fixo', texto: 'terça\n19h' },
    ])).toEqual([
      { origem: 'nome', padrao: 'tudo bem' },
      { origem: 'fixo', texto: 'terça 19h' },
    ]);
  });

  it('lista vazia é lista vazia, e não erro', () => {
    expect(lerVariaveis([])).toEqual([]);
  });

  it.each([
    ['origem inventada', [{ origem: 'sorteio' }]],
    ['nome sem reserva', [{ origem: 'nome' }]],
    ['fixo sem texto', [{ origem: 'fixo' }]],
    ['não é lista', { origem: 'nome', padrao: 'x' }],
    ['item nulo', [null]],
    ['texto solto', ['Maria']],
  ])('%s vira null', (_caso, entrada) => {
    expect(lerVariaveis(entrada)).toBeNull();
  });
});

describe('resolverVariaveis', () => {
  it('nome do contato preenche a posição', () => {
    expect(resolverVariaveis([{ origem: 'nome', padrao: 'tudo bem' }], { nome: 'Maria' }))
      .toEqual({ ok: true, valores: ['Maria'] });
  });

  // Contato sem nome é comum: colagem só com telefone, compra sem nome.
  it('sem nome, entra a reserva', () => {
    expect(resolverVariaveis([{ origem: 'nome', padrao: 'tudo bem' }], { nome: null }))
      .toEqual({ ok: true, valores: ['tudo bem'] });
  });

  it('nome só com espaços conta como sem nome', () => {
    expect(resolverVariaveis([{ origem: 'nome', padrao: 'tudo bem' }], { nome: '   ' }))
      .toEqual({ ok: true, valores: ['tudo bem'] });
  });

  it('texto fixo é igual para todo mundo', () => {
    expect(resolverVariaveis([{ origem: 'fixo', texto: 'terça' }], { nome: 'Maria' }))
      .toEqual({ ok: true, valores: ['terça'] });
  });

  it('mantém a ordem das posições', () => {
    expect(resolverVariaveis(
      [{ origem: 'nome', padrao: 'tudo bem' }, { origem: 'fixo', texto: 'terça' }],
      { nome: 'Maria' },
    )).toEqual({ ok: true, valores: ['Maria', 'terça'] });
  });

  it('limpa o nome antes de mandar', () => {
    expect(resolverVariaveis([{ origem: 'nome', padrao: 'x' }], { nome: 'Maria\n\tSilva' }))
      .toEqual({ ok: true, valores: ['Maria Silva'] });
  });

  // Uma mensagem falha sozinha, com motivo; as outras da campanha seguem.
  it('sem nome e sem reserva: falha dizendo qual posição', () => {
    expect(resolverVariaveis([{ origem: 'nome', padrao: '' }], { nome: null }))
      .toEqual({ ok: false, erro: 'Este contato está sem nome, e a variável {{1}} ficou sem texto de reserva.' });
  });

  it('texto fixo vazio também falha nomeando a posição', () => {
    expect(resolverVariaveis(
      [{ origem: 'nome', padrao: 'ok' }, { origem: 'fixo', texto: '' }],
      { nome: 'Maria' },
    )).toEqual({ ok: false, erro: 'A variável {{2}} está sem texto.' });
  });

  it('sem variáveis, lista vazia', () => {
    expect(resolverVariaveis([], { nome: null })).toEqual({ ok: true, valores: [] });
  });
});
