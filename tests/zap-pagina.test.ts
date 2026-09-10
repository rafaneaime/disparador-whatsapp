import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as meta from '../src/lib/zap/meta';
import Pagina from '../src/app/(painel)/disparador/page';
import { LINKS_DO_PAINEL } from '../src/lib/painel/navegacao';
import type { EstadoDoBanco } from '../src/lib/repo/zap-banco';

// Só o contexto de requisição do Next é substituído; página e adaptador são reais.
vi.mock('next/server', () => ({ connection: async () => {} }));

// O banco é o único trecho substituído por decisão: aqui se testa o que a tela
// mostra em cada estado, não como o estado é descoberto — isso é assunto de
// `zap-banco.test.ts`, com o `sql` real por baixo.
const banco = vi.hoisted(() => ({ estado: 'ok' as EstadoDoBanco['estado'] }));
vi.mock('../src/lib/repo/zap-banco', () => ({ conferirBanco: async () => ({ estado: banco.estado }) }));

const token = 'EAA_PREFIXOSECRETO_MIOL0SECRETO_SUFIXOSECRETO';
const segredo = 'CHAVE_FICTICIA_SECRETA';
const numero = { display_phone_number: '+55 11 99999-9999', verified_name: 'Loja de teste', quality_rating: 'GREEN', platform_type: 'CLOUD_API' };
const template = { name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY' };

function configurar() {
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', token);
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'numero-id');
  vi.stubEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', 'conta-id');
}

beforeEach(() => {
  banco.estado = 'ok';
  for (const nome of Object.keys(process.env).filter((nome) => /^(WHATSAPP_|META_|IG_|ACCESS_TOKEN$|VERIFY_TOKEN$)/.test(nome))) vi.stubEnv(nome, undefined);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede não esperada'); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('página do disparador', () => {
  /**
   * O rótulo muda com o pacote, o destino não.
   *
   * Na Plataforma o item se chama "Disparador", porque divide o menu com o
   * resto. No pacote do disparador ele se chama "Diagnóstico", porque ali o
   * painel inteiro é o disparador. Prender o teste ao texto fazia ele passar
   * aqui e falhar no repositório publicado — onde a navegação é substituída —,
   * e quem clona só descobre isso rodando `npm test` e vendo vermelho.
   *
   * O que vale nos dois: existe entrada de menu que leva à tela.
   */
  it('pode ser aberta pelo menu do painel', () => {
    const link = LINKS_DO_PAINEL.find((link) => link.href === '/disparador');
    expect(link?.label).toBeTruthy();
  });
  it('abre sem nenhuma credencial Meta e sem consultar rede', async () => {
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Não configurado');
    expect(html).toContain('WHATSAPP_ACCESS_TOKEN');
    expect(html).toContain('WHATSAPP_PHONE_NUMBER_ID');
    expect(html).toContain('WHATSAPP_BUSINESS_ACCOUNT_ID');
    expect(html).toContain('href="/disparador/contatos"');
    expect(html.match(/<li[ >]/g)).toHaveLength(7);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['sem_variavel', 'O painel não tem banco de dados'],
    ['sem_tabelas', 'o banco existe mas está vazio'],
    ['inacessivel', 'Não foi possível falar com o banco'],
  ] as const)('banco %s aparece como primeiro passo e impede dizer Conectado', async (estado, trecho) => {
    banco.estado = estado;
    configurar();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates')
      ? { data: [template] } : numero)));
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Desconectado');
    expect(html).not.toContain('>Conectado<');
    expect(html).toMatch(new RegExp(`1\\. Banco de dados`));
    expect(html.toLowerCase()).toContain(trecho.toLowerCase());
  });

  it('banco em ordem não acrescenta ruído: a tela segue falando da Meta', async () => {
    configurar();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates')
      ? { data: [template] } : numero)));
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('1. Banco de dados');
    expect(html).toContain('Conectado');
    // Passo pronto não repete instrução: o texto de conserto só aparece quando falha.
    expect(html).not.toContain('Vercel → Storage');
  });

  it('mostra número, nome e qualidade e confere novamente a cada abertura', async () => {
    configurar();
    let aprovado = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates')
      ? { data: aprovado ? [template] : [] } : numero)));
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Conectado');
    expect(html).toContain('+55 11 99999-9999');
    expect(html).toContain('Loja de teste');
    expect(html).toContain('Boa');
    expect(html).toContain('href="/disparador"');
    aprovado = false;
    expect(renderToStaticMarkup(await Pagina())).toContain('Conexão com pendências');
  });

  it.each(['consultarNumero', 'listarTemplates'] as const)('exceção inesperada em %s vira passo legível e preserva o outro resultado', async (consulta) => {
    configurar();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates') ? { data: [template] } : numero)));
    vi.spyOn(meta, consulta).mockImplementation(() => { throw new Error(`${token} ${segredo} wamid.PRIVADO==`); });
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Não foi possível conferir');
    expect(html).toContain('Precisa de atenção');
    if (consulta === 'listarTemplates') {
      expect(html).toContain('Loja de teste');
      expect(html).not.toContain('Falta template aprovado');
    }
    expect(html).not.toMatch(/EAA_|PREFIXOSECRETO|MIOL0SECRETO|SUFIXOSECRETO|CHAVE_FICTICIA|wamid|PRIVADO/);
  });

  it('erro de rede real vira orientação sem estourar', async () => {
    configurar();
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Desconectado');
    expect(html).toContain('Conferir novamente');
  });

  it('qualidade desconhecida não pode derrubar a renderização', async () => {
    configurar();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates')
      ? { data: [template] } : { ...numero, quality_rating: '__proto__' })));
    expect(renderToStaticMarkup(await Pagina())).toContain('Ainda não informada');
  });

  it('erro 190 da API chega traduzido na tela sem texto cru', async () => {
    configurar();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 190, message: `Session expired ${token} wamid.PRIVADO==` } }, { status: 400 })));
    const html = renderToStaticMarkup(await Pagina());
    expect(html).toContain('Seu token da Meta venceu');
    expect(html).not.toMatch(/Session expired|EAA_|wamid|PRIVADO/);
  });

  it.each([token, 'PREFIXOSECRETO', 'MIOL0SECRETO', 'SUFIXOSECRETO', segredo, 'wamid.PRIVADO=='])('não mostra segredo nem fragmento devolvido nos campos do número: %s', async (sensivel) => {
    configurar();
    vi.stubEnv('META_APP_SECRET', segredo);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('message_templates')
      ? { data: [{ ...template, name: sensivel }] }
      : { ...numero, display_phone_number: sensivel, verified_name: `Loja ${sensivel}`, quality_rating: sensivel })));
    const html = renderToStaticMarkup(await Pagina());
    expect(html).not.toContain(sensivel);
    expect(html).not.toMatch(/PREFIXOSECRETO|MIOL0SECRETO|SUFIXOSECRETO|wamid|PRIVADO/);
  });
});
