import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('../src/lib/db', () => ({ sql }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), notFound: () => { throw new Error('NOT_FOUND'); } }));
import Pagina from '../src/app/(painel)/disparador/campanhas/page';
import Detalhe from '../src/app/(painel)/disparador/campanhas/[id]/page';
import { CriarCampanha, DispararCampanha, ResultadoCriacao } from '../src/app/(painel)/disparador/campanhas/acoes';

beforeEach(() => { sql.mockReset().mockResolvedValue([]); });

it('lista vazia oferece sincronização e criação com orientação para contatos', async () => {
  const html = renderToStaticMarkup(await Pagina());
  expect(html).toContain('Nenhuma campanha');
  expect(html).toContain('Sincronizar templates');
  expect(html).toContain('Criar campanha');
  expect(html).toContain('/disparador/contatos');
});

it('formulário recebe só templates aprovados e contatos elegíveis da página', async () => {
  sql.mockResolvedValueOnce([{ id: 8, nome: 'Campanha da palestra', estado: 'draft', total: 1 }])
    .mockResolvedValueOnce([
      { id: 7, nome: 'hello_world', idioma: 'en_US', estado: 'approved', componentes: [] },
      { id: 9, nome: 'rejeitado', idioma: 'pt_BR', estado: 'rejected', componentes: [] },
      { id: 10, nome: 'com_variavel', idioma: 'pt_BR', estado: 'approved', componentes: [{ text: '{{1}}' }] },
    ]).mockResolvedValueOnce([
      { id: 1, nome: 'Ana elegível', telefone: '5511987654321', consentimento: 'subscribed', descadastro_em: null },
      { id: 2, nome: 'Bia sem consentimento', telefone: '5521987654321', consentimento: 'unknown', descadastro_em: null },
      { id: 3, nome: 'Caio descadastrado', telefone: '5531987654321', consentimento: 'subscribed', descadastro_em: new Date() },
    ]);
  const html = renderToStaticMarkup(await Pagina());
  expect(html).toContain('Campanha da palestra');
  expect(html).toContain('/disparador/campanhas/8');
  expect(html).toContain('hello_world');
  expect(html).toContain('Ana elegível');
  expect(html).not.toMatch(/rejeitado|com_variavel|Bia sem consentimento|Caio descadastrado/);
});

it('criação começa desabilitada até informar nome, template e contatos', () => {
  const html = renderToStaticMarkup(createElement(CriarCampanha, { templates: [], contatos: [] }));
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Criar campanha/);
  expect(html).toContain('Nome da campanha');
  expect(html).toContain('Template');
});

it('resultado da criação informa recusas de consentimento antes do detalhe', () => {
  const html = renderToStaticMarkup(createElement(ResultadoCriacao, { resultado: { id: 8, enfileirados: 7, recusadosPorConsentimento: 3 } }));
  expect(html).toContain('7 enfileirados');
  expect(html).toContain('3 recusados por consentimento');
  expect(html).toContain('/disparador/campanhas/8');
});

it('detalhe aguarda params e mostra contagens e falha humana sem id da Meta', async () => {
  sql.mockResolvedValueOnce([{ id: 8, nome: 'Palestra', estado: 'running', template_nome: 'hello_world', idioma: 'en_US' }])
    .mockResolvedValueOnce([{ pendentes: 2, enviando: 1, enviadas: 7, falhas: 3 }])
    .mockResolvedValueOnce([{ id: 90, erro_codigo: '131030', erro_texto: 'Confirme o número no painel da Meta. wamid.PRIVADO' }]);
  const html = renderToStaticMarkup(await Detalhe({ params: Promise.resolve({ id: '8' }) }));
  for (const texto of ['Palestra', '2 pendentes', '7 enviadas', '3 falhas', '1 em envio', 'Confirme o número no painel da Meta.', 'Disparar lote']) expect(html).toContain(texto);
  expect(html).not.toContain('wamid.PRIVADO');
  const falhasSql = sql.mock.calls[2][0].join('?');
  expect(falhasSql).not.toMatch(/meta_message_id|telefone|select \*/);
});

it.each(['paused', 'cancelled', 'completed', 'failed'] as const)('não oferece envio em campanha %s', (estado) => {
  const html = renderToStaticMarkup(createElement(DispararCampanha, { id: 8, estado, pendentes: 1 }));
  expect(html).not.toContain('Disparar lote');
});

it('campanha inexistente usa notFound', async () => {
  await expect(Detalhe({ params: Promise.resolve({ id: '8' }) })).rejects.toThrow('NOT_FOUND');
});
