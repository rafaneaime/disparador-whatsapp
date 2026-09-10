import { describe, expect, it } from 'vitest';
import { lerColagem } from '../src/lib/zap/colar';

describe('lerColagem', () => {
  it('deduplica pelo canônico, inclusive o nono dígito', () => {
    const resultado = lerColagem('5511987654321\n551187654321\n(11) 98765-4321', 1000);
    expect(resultado.validos).toEqual(['5511987654321']);
    expect(resultado.linhas).toEqual([
      { situacao: 'valido', original: '5511987654321', telefone: '5511987654321' },
      { situacao: 'repetido', original: '551187654321', telefone: '5511987654321' },
      { situacao: 'repetido', original: '(11) 98765-4321', telefone: '5511987654321' },
    ]);
  });

  it('ignora linhas vazias sem gastar o teto e preserva o original', () => {
    expect(lerColagem('\r\n  \t\n  (11) 98765-4321  \r\n\n', 1)).toEqual({
      validos: ['5511987654321'],
      linhas: [{ situacao: 'valido', original: '  (11) 98765-4321  ', telefone: '5511987654321' }],
    });
  });

  it('mantém as linhas boas ao redor do lixo e a ordem de entrada', () => {
    const resultado = lerColagem('+1 202 555 0123\nlixo\n123\n(11) 2345-6789', 1000);
    expect(resultado.validos).toEqual(['12025550123', '551123456789']);
    expect(resultado.linhas.map((linha) => linha.situacao)).toEqual(['valido', 'invalido', 'invalido', 'valido']);
    expect(resultado.linhas[1]).toEqual({ situacao: 'invalido', original: 'lixo', motivo: 'não parece telefone' });
    expect(resultado.linhas[2]).toEqual({ situacao: 'invalido', original: '123', motivo: 'faltam dígitos' });
  });

  it('marca todo excedente, inclusive números bons, sem incluí-lo nos válidos', () => {
    const resultado = lerColagem('lixo\n(11) 98765-4321\n(21) 98765-4321\n123', 2);
    expect(resultado.validos).toEqual(['5511987654321']);
    expect(resultado.linhas).toHaveLength(4);
    expect(resultado.linhas.slice(2)).toEqual([
      { situacao: 'invalido', original: '(21) 98765-4321', motivo: 'limite de 2 linhas; cole o restante em outra vez' },
      { situacao: 'invalido', original: '123', motivo: 'limite de 2 linhas; cole o restante em outra vez' },
    ]);
  });

  it.each([null, undefined, 42, {}, [], true].map((texto) => ({ texto })))('entrada não textual não estoura: $texto', ({ texto }) => {
    expect(lerColagem(texto, 1000)).toEqual({ linhas: [], validos: [] });
  });

  it('orienta a informar DDI quando não cabe no padrão brasileiro', () => {
    expect(lerColagem('123456789', 1).linhas).toEqual([
      { situacao: 'invalido', original: '123456789', motivo: 'sem DDI e fora do padrão brasileiro' },
    ]);
  });

  it.each([0, -1, NaN, Infinity])('teto inválido ou zero não libera entradas: %s', (teto) => {
    const resultado = lerColagem('(11) 98765-4321', teto);
    expect(resultado.validos).toEqual([]);
    expect(resultado.linhas[0].situacao).toBe('invalido');
  });
});
