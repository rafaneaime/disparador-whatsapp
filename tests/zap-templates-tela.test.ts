import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { listarTemplates } = vi.hoisted(() => ({ listarTemplates: vi.fn() }));
vi.mock('../src/lib/repo/zap-templates', () => ({ listarTemplates }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));

import Pagina from '../src/app/(painel)/disparador/templates/page';

const base = {
  id: 1, meta_id: '9', nome: 'convite', idioma: 'pt_BR',
  categoria_pedida: 'UTILITY', categoria_meta: 'UTILITY',
  componentes: [{ type: 'BODY', text: 'Oi {{1}}, tudo certo.' }],
  estado: 'approved', motivo_rejeicao: null,
  sincronizado_em: null, criado_em: new Date(),
};

const renderizar = (busca: Record<string, string> = {}) =>
  Pagina({ searchParams: Promise.resolve(busca) }).then(renderToStaticMarkup);

beforeEach(() => listarTemplates.mockReset().mockResolvedValue([base]));
afterEach(() => vi.restoreAllMocks());

describe('tela de templates', () => {
  it('abre sem template nenhum, sem estourar', async () => {
    listarTemplates.mockResolvedValue([]);
    expect(await renderizar()).toContain('Nenhum template ainda');
  });

  /**
   * A razão de a tela existir: pede-se utilidade, a Meta devolve marketing, e a
   * diferença é de cerca de seis vezes por mensagem. Quem não vê a divergência
   * acha que economizou e descobre na fatura.
   */
  it('mostra as duas categorias quando a Meta reclassificou', async () => {
    listarTemplates.mockResolvedValue([{ ...base, categoria_meta: 'MARKETING' }]);
    const html = await renderizar();
    expect(html).toContain('utilidade');
    expect(html).toContain('marketing');
    expect(html).toContain('cobrança segue a dela');
  });

  it('não inventa divergência quando as categorias batem', async () => {
    expect(await renderizar()).not.toContain('cobrança segue a dela');
  });

  it('mostra o motivo da rejeição quando existe', async () => {
    listarTemplates.mockResolvedValue([
      { ...base, estado: 'rejected', motivo_rejeicao: 'INVALID_FORMAT' },
    ]);
    const html = await renderizar();
    expect(html).toContain('INVALID_FORMAT');
    expect(html).toContain('nome não pode ser reaproveitado');
  });

  // Nome de template é imutável na Meta: aprovado não se corrige, duplica-se.
  it('oferece duplicar só para o aprovado', async () => {
    expect(await renderizar()).toContain('duplicar e corrigir');
    listarTemplates.mockResolvedValue([{ ...base, estado: 'pending' }]);
    expect(await renderizar()).not.toContain('duplicar e corrigir');
  });

  it('duplicar abre o editor com nome de versão nova e o corpo do original', async () => {
    const html = await renderizar({ duplicar: '1' });
    expect(html).toContain('convite_v2');
    expect(html).toContain('Oi {{1}}, tudo certo.');
  });

  // Template vindo da sincronização não traz componentes — a listagem da Meta
  // não os manda. Melhor abrir vazio do que inventar um texto que não é o de lá.
  it('duplicar template sem corpo conhecido não inventa texto', async () => {
    listarTemplates.mockResolvedValue([{ ...base, nome: 'hello_world', componentes: [] }]);
    const html = await renderizar({ duplicar: '1' });
    expect(html).toContain('hello_world_v2');
  });
});
