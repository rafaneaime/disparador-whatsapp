import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../src/lib/db', () => ({ sql }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
import Pagina from '../src/app/(painel)/disparador/contatos/page';
import { ColarContatos, ContagemColagem, BotaoDescadastrar } from '../src/app/(painel)/disparador/contatos/colar-contatos';

beforeEach(() => { sql.mockReset().mockResolvedValue([]); });

describe('tela de contatos colados', () => {
  it('abre com caixa desmarcada, texto explícito e botão de cadastro desabilitado', () => {
    const html = renderToStaticMarkup(createElement(ColarContatos));
    expect(html).toContain('<textarea');
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toMatch(/checked=""/);
    expect(html).toMatch(/autorizaram.*WhatsApp/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cadastrar contatos/);
  });

  it('recalcula a contagem com o texto atual, inclusive números sem nono dígito', () => {
    const render = (texto: string) => renderToStaticMarkup(createElement(ContagemColagem, { texto }));
    expect(render('')).toContain('0 válidos · 0 repetidos · 0 inválidos');
    const html = render('(11) 98765-4321\n551187654321\nlixo\n\n');
    expect(html).toContain('1 válidos · 1 repetidos · 1 inválidos');
    expect(html).toContain('aria-live="polite"');
  });

  it('explica o estado vazio e disponibiliza a colagem', async () => {
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Nenhum contato cadastrado ainda');
    expect(html).toContain('Cadastrar contatos');
  });

  it('lista telefone, nome, estado e evidência de consentimento e descadastro', async () => {
    sql.mockResolvedValue([
      { id: 1, telefone: '5511987654321', nome: 'Ana', email: null, etiquetas: [],
        consentimento: 'subscribed', consentimento_origem: 'colado-no-painel',
        consentimento_em: new Date('2026-09-01T12:00:00Z'), descadastro_em: null, criado_em: new Date('2026-09-01T12:00:00Z') },
      { id: 2, telefone: '5521987654321', nome: null, email: null, etiquetas: [],
        consentimento: 'unsubscribed', consentimento_origem: 'formulário',
        consentimento_em: new Date('2026-08-31T12:00:00Z'), descadastro_em: new Date('2026-09-02T12:00:00Z'), criado_em: new Date('2026-08-31T12:00:00Z') },
    ]);
    const html = renderToStaticMarkup(await Pagina());
    for (const texto of ['5511987654321', 'Ana', 'Autorizado', '01/09/2026', '5521987654321', 'Sem nome', 'Descadastrado', '31/08/2026', '02/09/2026']) {
      expect(html).toContain(texto);
    }
    expect(html.match(/>Descadastrar<\/button>/g)).toHaveLength(1);
  });

  it('oferece descadastro com botão próprio, sem apagar o contato', () => {
    expect(renderToStaticMarkup(createElement(BotaoDescadastrar, { id: 1 }))).toContain('Descadastrar');
  });
});
