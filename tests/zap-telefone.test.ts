import { describe, expect, it } from 'vitest';
import { mesmaPessoa, normalizarTelefone } from '../src/lib/zap/telefone';

describe('normalizarTelefone', () => {
  it.each([
    ['(11) 98765-4321', '5511987654321'],
    ['+55 11 98765 4321', '5511987654321'],
    ['5511987654321', '5511987654321'],
    ['551187654321', '5511987654321'],
    ['(11) 8765-4321', '5511987654321'],
    ['(11) 3456-7890', '551134567890'],
    ['+55 11 3456 7890', '551134567890'],
    ['(55) 98765-4321', '5555987654321'],
    ['+1 (202) 555-0123', '12025550123'],
    ['+44 20 7946 0958', '442079460958'],
    ['442079460958', '442079460958'],
  ])('normaliza %s para %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it.each([
    '123', 'telefone', null, undefined, '', '   ', {}, 5511987654321,
    'ligue 11987654321', '+551198765432199', '0000000000', '1111234567',
    '+012345678901', '1234567890123456', '123456789',
  ])('recusa entrada inválida %j sem inventar DDI', (entrada) => {
    expect(normalizarTelefone(entrada)).toBeNull();
  });
});

describe('mesmaPessoa', () => {
  it.each([
    ['5511987654321', '551187654321', true],
    ['551187654321', '5511987654321', true],
    ['(11) 98765-4321', '+55 11 98765 4321', true],
    ['5511987654321', '5511987654322', false],
    [null, null, false],
    ['inválido', '123', false],
    ['5511987654321', null, false],
  ])('compara %j e %j: %s', (a, b, esperado) => {
    expect(mesmaPessoa(a, b)).toBe(esperado);
  });
});

describe('o telefone que o formulário do site aceita', () => {
  /*
   * A identidade guarda qualquer coisa com dez dígitos ou mais; o WhatsApp
   * exige um número brasileiro completo. As duas regras discordando fizeram a
   * ficha de um contato dizer "Telefone: 55519818222" e, logo abaixo, "ainda
   * não há telefone identificado" — na mesma tela.
   *
   * A regra do WhatsApp está certa, e estes casos travam isso: o número que
   * motivou a investigação não existe, e o DDD 55 continua passando.
   */
  it('recusa número incompleto, que é o que o formulário deixa passar', () => {
    expect(normalizarTelefone('55519818222')).toBe(null);
  });

  it('não confunde o DDD 55 com o código do país', () => {
    expect(normalizarTelefone('55998182222')).toBe('5555998182222');
    expect(normalizarTelefone('5555998182222')).toBe('5555998182222');
  });

  it('o mesmo celular, com e sem o código do país, vira o mesmo número', () => {
    expect(normalizarTelefone('51998182222')).toBe(normalizarTelefone('5551998182222'));
  });
});
