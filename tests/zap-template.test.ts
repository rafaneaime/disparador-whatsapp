import { describe, expect, it } from 'vitest';
import {
  componentesParaMeta,
  previa,
  sugerirNomeDeVersao,
  validarRascunho,
  variaveisDoCorpo,
  type Rascunho,
} from '../src/lib/zap/template';

const bom: Rascunho = {
  nome: 'convite_imersao',
  idioma: 'pt_BR',
  categoria: 'MARKETING',
  corpo: 'Oi {{1}}, sua vaga na turma de {{2}} está reservada.',
  exemplos: ['Rafael', 'setembro'],
};

const campos = (r: Rascunho) => validarRascunho(r).map((p) => p.campo);

describe('validarRascunho', () => {
  it('aceita um rascunho completo', () => {
    expect(validarRascunho(bom)).toEqual([]);
  });

  it.each([
    ['Convite', 'maiúscula'],
    ['convite imersao', 'espaço'],
    ['convite-imersao', 'hífen'],
    ['convite_imersão', 'acento'],
    ['', 'vazio'],
  ])('recusa o nome %j (%s)', (nome) => {
    expect(campos({ ...bom, nome })).toContain('nome');
  });

  it('aceita nome com número e underscore', () => {
    expect(campos({ ...bom, nome: 'convite_2026_v3' })).not.toContain('nome');
  });

  it('recusa corpo vazio sem reclamar de mais nada', () => {
    const problemas = validarRascunho({ ...bom, corpo: '   ', exemplos: [] });
    expect(problemas.map((p) => p.campo)).toEqual(['corpo']);
  });

  // A Meta numera pela posição: {{1}} ... {{3}} não é "faltou a 2", é inválido.
  it.each([
    ['Oi {{2}}, tudo bem por aí?', 'começa na 2'],
    ['Oi {{1}}, veja {{3}} agora mesmo.', 'pula a 2'],
    ['Oi {{2}}, aqui é {{1}} falando.', 'fora de ordem'],
  ])('recusa variáveis não sequenciais: %j (%s)', (corpo) => {
    expect(campos({ ...bom, corpo, exemplos: ['a', 'b', 'c'] })).toContain('corpo');
  });

  it('recusa variável no começo da mensagem', () => {
    expect(campos({ ...bom, corpo: '{{1}}, sua vaga está reservada.', exemplos: ['Rafael'] }))
      .toContain('corpo');
  });

  it('recusa variável no fim da mensagem', () => {
    expect(campos({ ...bom, corpo: 'Sua vaga está reservada, {{1}}', exemplos: ['Rafael'] }))
      .toContain('corpo');
  });

  it('recusa duas variáveis coladas', () => {
    expect(campos({ ...bom, corpo: 'Oi {{1}} {{2}} tudo certo.', exemplos: ['a', 'b'] }))
      .toContain('corpo');
  });

  it.each([
    [['Rafael'], 'faltando um'],
    [[], 'nenhum'],
    [['Rafael', '   '], 'um em branco'],
  ])('recusa exemplos incompletos (%s)', (exemplos) => {
    expect(campos({ ...bom, exemplos })).toContain('exemplos');
  });

  it('recusa categoria que a Meta não conhece', () => {
    expect(campos({ ...bom, categoria: 'PROMOCAO' })).toContain('categoria');
  });

  it('corpo sem variável nenhuma dispensa exemplos', () => {
    expect(validarRascunho({
      ...bom,
      corpo: 'A turma de setembro abriu. Responda para garantir a sua vaga.',
      exemplos: [],
    })).toEqual([]);
  });
});

describe('variaveisDoCorpo', () => {
  it('lê na ordem em que aparecem, tolerando espaço dentro das chaves', () => {
    expect(variaveisDoCorpo('a {{1}} b {{ 2 }} c')).toEqual([1, 2]);
  });
});

describe('previa', () => {
  it('troca as variáveis pelos exemplos', () => {
    expect(previa(bom)).toBe('Oi Rafael, sua vaga na turma de setembro está reservada.');
  });

  it('deixa a variável à mostra quando o exemplo falta', () => {
    expect(previa({ corpo: 'Oi {{1}}, veja {{2}}.', exemplos: ['Rafael'] }))
      .toBe('Oi Rafael, veja {{2}}.');
  });
});

describe('sugerirNomeDeVersao', () => {
  it('começa na v2', () => {
    expect(sugerirNomeDeVersao('convite', [])).toBe('convite_v2');
  });

  it('pula as versões já usadas', () => {
    expect(sugerirNomeDeVersao('convite', ['convite_v2', 'convite_v3'])).toBe('convite_v4');
  });

  // Sem isto, a terceira tentativa vira `convite_v2_v2`.
  it('não empilha sufixo sobre sufixo', () => {
    expect(sugerirNomeDeVersao('convite_v2', ['convite_v2'])).toBe('convite_v3');
  });
});

describe('componentesParaMeta', () => {
  it('manda o corpo com os exemplos no formato que a Meta espera', () => {
    expect(componentesParaMeta(bom)).toEqual([
      {
        type: 'BODY',
        text: bom.corpo,
        example: { body_text: [['Rafael', 'setembro']] },
      },
    ]);
  });

  it('omite o exemplo quando não há variável', () => {
    expect(componentesParaMeta({ corpo: 'Texto fixo.', exemplos: [] }))
      .toEqual([{ type: 'BODY', text: 'Texto fixo.' }]);
  });
});
