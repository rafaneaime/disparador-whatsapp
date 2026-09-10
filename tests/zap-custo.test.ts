import { describe, expect, it } from 'vitest';
import { estimarCusto, trimestresDesde, type Tarifa } from '../src/lib/zap/custo';

const brasilMarketing: Tarifa = {
  pais: '55', categoria: 'MARKETING', valor: 0.0625, moeda: 'USD', vigente_desde: '2026-10-01',
};
const brasilUtilidade: Tarifa = {
  pais: '55', categoria: 'UTILITY', valor: 0.008, moeda: 'USD', vigente_desde: '2026-10-01',
};
const portugalMarketing: Tarifa = {
  pais: '351', categoria: 'MARKETING', valor: 0.11, moeda: 'EUR', vigente_desde: '2026-07-01',
};

const brasileiros = ['5511900000001', '5511900000002', '5511900000003'];
const portugueses = ['351910000001', '351910000002'];

describe('estimarCusto', () => {
  it('multiplica pela tarifa do país e da categoria devolvida', () => {
    const e = estimarCusto({
      telefones: brasileiros,
      categoria: 'MARKETING',
      tarifas: [brasilMarketing, brasilUtilidade],
    });

    expect(e.linhas).toEqual([
      { pais: '55', quantos: 3, valorUnitario: 0.0625, moeda: 'USD', total: 0.1875 },
    ]);
    expect(e.totalPorMoeda).toEqual([{ moeda: 'USD', valor: 0.1875 }]);
    expect(e.semTarifa).toEqual([]);
  });

  /**
   * Marketing custa cerca de seis vezes utilidade. Usar a categoria pedida em
   * vez da devolvida daria um número menor — o erro que só aparece na fatura.
   */
  it('a categoria muda o preço', () => {
    const utilidade = estimarCusto({
      telefones: brasileiros, categoria: 'UTILITY', tarifas: [brasilMarketing, brasilUtilidade],
    });
    expect(utilidade.totalPorMoeda).toEqual([{ moeda: 'USD', valor: 0.024 }]);
  });

  // Somar real com dólar produz um número que não existe.
  it('nunca soma moedas diferentes', () => {
    const e = estimarCusto({
      telefones: [...brasileiros, ...portugueses],
      categoria: 'MARKETING',
      tarifas: [brasilMarketing, portugalMarketing],
    });

    expect(e.totalPorMoeda).toEqual([
      { moeda: 'EUR', valor: 0.22 },
      { moeda: 'USD', valor: 0.1875 },
    ]);
  });

  /**
   * Zero mentiria para menos, que é o pior lado para errar numa estimativa de
   * custo: a pessoa dispara achando que é de graça.
   */
  it('país sem tarifa não entra como zero — fica visível à parte', () => {
    const e = estimarCusto({
      telefones: [...brasileiros, ...portugueses],
      categoria: 'MARKETING',
      tarifas: [brasilMarketing],
    });

    expect(e.totalPorMoeda).toEqual([{ moeda: 'USD', valor: 0.1875 }]);
    expect(e.semTarifa).toEqual([{ prefixo: '351', quantos: 2 }]);
    expect(e.linhas.some((l) => l.total === 0)).toBe(false);
  });

  it('sem tarifa nenhuma cadastrada, todos ficam de fora e nada estoura', () => {
    const e = estimarCusto({ telefones: brasileiros, categoria: 'MARKETING', tarifas: [] });
    expect(e.linhas).toEqual([]);
    expect(e.totalPorMoeda).toEqual([]);
    expect(e.semTarifa).toEqual([{ prefixo: '551', quantos: 3 }]);
  });

  // Chutar entre marketing e utilidade é escolher entre dois preços que diferem
  // em seis vezes.
  it('sem saber a categoria, não estima', () => {
    const e = estimarCusto({ telefones: brasileiros, categoria: null, tarifas: [brasilMarketing] });
    expect(e.totalPorMoeda).toEqual([]);
    expect(e.semTarifa).toEqual([{ prefixo: '551', quantos: 3 }]);
  });

  it('sem destinatário, devolve estimativa vazia', () => {
    expect(estimarCusto({ telefones: [], categoria: 'MARKETING', tarifas: [brasilMarketing] }))
      .toEqual({ linhas: [], totalPorMoeda: [], semTarifa: [], tarifaMaisAntiga: null });
  });

  it('o DDI mais específico vence o mais curto', () => {
    const saoPaulo: Tarifa = { ...brasilMarketing, pais: '5511', valor: 0.09 };
    const e = estimarCusto({
      telefones: ['5511900000001', '5521900000002'],
      categoria: 'MARKETING',
      tarifas: [brasilMarketing, saoPaulo],
    });

    expect(e.linhas).toEqual([
      { pais: '55', quantos: 1, valorUnitario: 0.0625, moeda: 'USD', total: 0.0625 },
      { pais: '5511', quantos: 1, valorUnitario: 0.09, moeda: 'USD', total: 0.09 },
    ]);
  });

  it('devolve a data da tarifa mais antiga que usou', () => {
    const e = estimarCusto({
      telefones: [...brasileiros, ...portugueses],
      categoria: 'MARKETING',
      tarifas: [brasilMarketing, portugalMarketing],
    });
    expect(e.tarifaMaisAntiga).toBe('2026-07-01');
  });
});

describe('trimestresDesde', () => {
  it.each([
    ['2026-10-01', '2026-11-15', 0],
    ['2026-10-01', '2027-01-02', 1],
    ['2026-01-01', '2026-12-31', 3],
    [null, '2026-12-31', 0],
    ['data inválida', '2026-12-31', 0],
  ])('de %s até %s são %i trimestres', (desde, agora, esperado) => {
    expect(trimestresDesde(desde, new Date(`${agora}T00:00:00Z`))).toBe(esperado);
  });
});
