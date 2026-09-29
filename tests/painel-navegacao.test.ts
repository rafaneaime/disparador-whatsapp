import { describe, expect, it } from 'vitest';
import { itemAtivo, indiceAtivo } from '../src/lib/painel/item-ativo';

describe('navegação agrupada', () => {
  it('prefere o destino específico no pacote Disparador e nos grupos Pro', () => {
    expect(indiceAtivo('/disparador/campanhas/5', [{href:'/disparador'}, {href:'/disparador/campanhas'}])).toBe(1);
    expect(indiceAtivo('/disparador/campanhas/5', [{href:'/ajustes', caminhos:['/disparador']}, {href:'/automacoes', caminhos:['/disparador/campanhas']}])).toBe(1);
  });
  it('não marca a raiz ao navegar em outra seção', () => {
    expect(itemAtivo('/contatos/123', { href: '/' })).toBe(false);
    expect(itemAtivo('/', { href: '/' })).toBe(true);
  });
  it('destaca a seção de páginas agrupadas e respeita fronteira do caminho', () => {
    const item = { href: '/ajustes', caminhos: ['/configuracao', '/sites', '/chaves'] };
    expect(itemAtivo('/sites/123', item)).toBe(true);
    expect(itemAtivo('/sites-falsos', item)).toBe(false);
    expect(itemAtivo('/ajustes', item)).toBe(true);
  });
});
