import { describe, expect, it } from 'vitest';
import { lerCredenciais } from '../src/lib/zap/credenciais';
import { montarDiagnostico, type EntradaDoDiagnostico } from '../src/lib/zap/diagnostico';
import { classificarErro, type ResultadoDaMeta } from '../src/lib/zap/meta';

const configuradas = lerCredenciais({
  NODE_ENV: 'test',
  WHATSAPP_ACCESS_TOKEN: 'EAA_TOKEN_FICTICIO_PREFIXO_MIOL0_SUFIXO',
  WHATSAPP_PHONE_NUMBER_ID: 'numero-id', WHATSAPP_BUSINESS_ACCOUNT_ID: 'conta-id',
});
const entrada: EntradaDoDiagnostico = {
  credenciais: configuradas, webhookConfigurado: false,
  numero: { ok: true, dados: { display_phone_number: '+55 11 99999-9999', verified_name: 'Loja', quality_rating: 'GREEN', platform_type: 'CLOUD_API' } },
  templates: { ok: true, dados: [{ name: 'hello_world', language: 'en_US', status: 'APPROVED', category: 'UTILITY' }] },
};
const falha = (codigo: string): ResultadoDaMeta<never> => ({
  ok: false, erro: { codigo, tipo: 'permanente', humano: 'Texto cru EAA_TOKEN_FICTICIO_PREFIXO_MIOL0_SUFIXO PREFIXO_MIOL0 wamid.SEGREDO==' },
});

describe('montarDiagnostico', () => {
  it('ambiente vazio é não configurado, com seis passos ordenados e orientação exata', () => {
    const resultado = montarDiagnostico({ credenciais: lerCredenciais({} as NodeJS.ProcessEnv), webhookConfigurado: false });
    expect(resultado.estado).toBe('nao_configurado');
    expect(resultado.passos.map((p) => p.nome)).toEqual([
      'Credenciais no ambiente', 'Token válido', 'Número conectado', 'Template aprovado', 'Lista de teste', 'Webhook',
    ]);
    expect(resultado.passos.map((p) => p.estado)).toEqual(['falta', 'falta', 'falta', 'falta', 'opcional', 'opcional']);
    const texto = resultado.passos[0].oQueFazer;
    for (const nome of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID']) expect(texto).toContain(nome);
    expect(texto).toContain('Configuração da API');
    expect(texto).toContain('Identificação do número de telefone');
    expect(texto).toContain('Identificação da conta do WhatsApp Business');
    expect(texto).toContain('Vercel');
  });

  /**
   * Caminho de menu que não existe é pior que caminho nenhum.
   *
   * Três textos desta tela mandavam a pessoa em "Settings → Environment
   * Variables". Na Vercel a lista fica dentro do ambiente: Settings →
   * Environments → Production → Environment Variables. Quem seguiu procurou uma
   * aba que não está lá — e a tela existe justamente para tirar a pessoa do
   * lugar onde ela travou.
   */
  it('toda instrução que manda mexer em variável dá o caminho que existe', () => {
    const estados = ['sem_variavel', 'sem_tabelas', 'inacessivel', 'ok'] as const;
    const textos = [
      ...estados.flatMap((estado) =>
        montarDiagnostico({ ...entrada, banco: { estado } }).passos.map((p) => p.oQueFazer)),
      ...montarDiagnostico({ credenciais: lerCredenciais({} as NodeJS.ProcessEnv), webhookConfigurado: false })
        .passos.map((p) => p.oQueFazer),
    ].filter(Boolean);

    expect(textos.some((t) => t.includes('Environment Variables'))).toBe(true);
    for (const texto of textos) {
      if (!texto.includes('Environment Variables')) continue;
      expect(texto).toContain('Settings → Environments → Production → Environment Variables');
    }
  });

  it('falta isolada não pede variáveis que já existem', () => {
    const resultado = montarDiagnostico({ ...entrada, credenciais: { faltando: ['WHATSAPP_PHONE_NUMBER_ID'], credenciais: null } });
    expect(resultado.estado).toBe('nao_configurado');
    expect(resultado.passos[0].oQueFazer).toContain('WHATSAPP_PHONE_NUMBER_ID');
    expect(resultado.passos[0].oQueFazer).not.toMatch(/WHATSAPP_ACCESS_TOKEN|WHATSAPP_BUSINESS_ACCOUNT_ID/);
  });

  it('conecta com APPROVED sem exigir chave de webhook nem lista de teste', () => {
    const resultado = montarDiagnostico(entrada);
    expect(resultado.estado).toBe('conectado');
    expect(resultado.passos.map((p) => p.estado)).toEqual(['ok', 'ok', 'ok', 'ok', 'opcional', 'opcional']);
    expect(resultado.passos.filter((p) => p.estado === 'ok').every((p) => p.oQueFazer === '')).toBe(true);
    expect(resultado.passos[5].oQueFazer).toContain('META_APP_SECRET');
    expect(resultado.passos[5].oQueFazer).toMatch(/entregue.*lida/);
  });

  it('marca somente a presença da chave de webhook como pronta', () => {
    expect(montarDiagnostico({ ...entrada, webhookConfigurado: true }).passos[5]).toMatchObject({ estado: 'ok', oQueFazer: '' });
  });

  it.each([[], [{ name: 'aguardando', language: 'pt_BR', status: 'PENDING', category: 'UTILITY' }]].map((templates) => [templates]))('degrada quando não há APPROVED: %j', (templates) => {
    const resultado = montarDiagnostico({ ...entrada, templates: { ok: true, dados: templates } });
    expect(resultado.estado).toBe('degradado');
    expect(resultado.passos[3]).toMatchObject({ estado: 'falta', oQueFazer: expect.stringContaining('hello_world') });
  });

  it('traduz 190 com instruções para token vencido', () => {
    const resultado = montarDiagnostico({ ...entrada, numero: falha('190') });
    expect(resultado.estado).toBe('desconectado');
    expect(resultado.passos[1].estado).toBe('erro');
    expect(resultado.passos[1].oQueFazer).toMatch(/Seu token da Meta venceu/);
    expect(resultado.passos[1].oQueFazer).toContain('Configuração da API → Gerar');
    expect(resultado.passos[1].oQueFazer).toContain('WHATSAPP_ACCESS_TOKEN');
    expect(resultado.passos[1].oQueFazer).toContain('permanente');
    expect(resultado.passos[2].estado).toBe('erro');
  });

  it('reaproveita a tradução de 131030 do adaptador', () => {
    const erro = classificarErro(400, { error: { code: 131030 } });
    const resultado = montarDiagnostico({ ...entrada, numero: { ok: false, erro } });
    expect(resultado.estado).toBe('desconectado');
    // A tradução aparece no primeiro passo que a causa atinge; os seguintes
    // apontam para ele em vez de repetir o parágrafo. Ver `naoRepetirInstrucao`.
    expect(resultado.passos[1].oQueFazer).toBe(erro.humano);
    expect(resultado.passos[2].oQueFazer).toContain('Mesma causa do passo 2');
  });

  it('recusa da conta na consulta de templates não vira ausência de template', () => {
    const resultado = montarDiagnostico({ ...entrada, templates: falha('100') });
    expect(resultado.estado).toBe('desconectado');
    expect(resultado.passos[3]).toMatchObject({ estado: 'erro', oQueFazer: expect.stringContaining('WHATSAPP_BUSINESS_ACCOUNT_ID') });
  });

  it('190 nos templates também orienta trocar token', () => {
    const resultado = montarDiagnostico({ ...entrada, templates: falha('190') });
    expect(resultado.estado).toBe('desconectado');
    expect(resultado.passos[1].oQueFazer).toContain('Seu token da Meta venceu');
  });

  it('sem resultado da consulta não inventa sucesso', () => {
    const resultado = montarDiagnostico({ credenciais: configuradas, webhookConfigurado: false });
    expect(resultado.estado).toBe('desconectado');
    expect(resultado.passos[2].estado).toBe('erro');
  });

  it.each(['190', '131030', '100', 'FALHA_DE_REDE', 'INESPERADO'])('nenhuma saída ecoa segredos de resultados, códigos ou metadados (%s)', (codigo) => {
    for (const numero of [falha(codigo), entrada.numero]) {
      const resultado = montarDiagnostico({ ...entrada, numero, templates: falha(codigo) });
      expect(JSON.stringify(resultado)).not.toMatch(/EAA_TOKEN|PREFIXO_MIOL0|MIOL0_SUFIXO|wamid|SEGREDO|Texto cru/);
    }
  });

  /**
   * Uma causa, uma instrução.
   *
   * A primeira versão repetia o parágrafo inteiro do token vencido nos passos
   * 2, 3 e 4 — e o de credencial ausente nos passos 2, 3 e 4 também. Três muros
   * de texto idênticos não dizem à pessoa se ela tem três problemas ou um, e é
   * exatamente essa dúvida que faz alguém levantar a mão numa sala de cinquenta.
   */
  it('não repete parágrafo longo em passo nenhum', () => {
    const cenarios = [
      montarDiagnostico({
        credenciais: { faltando: ['WHATSAPP_ACCESS_TOKEN'], credenciais: null },
        webhookConfigurado: false,
      }),
      montarDiagnostico({ ...entrada, numero: falha('190'), templates: falha('190') }),
    ];

    for (const { passos } of cenarios) {
      // Dois passos apontando para o mesmo culpado dizem a mesma frase curta, e
      // isso é aceitável — o que não pode repetir é o muro de texto que a
      // pessoa precisa ler de novo para descobrir que já leu.
      const longas = passos
        .map((p) => p.oQueFazer)
        .filter((texto) => texto.length > 80);

      expect(longas).toEqual([...new Set(longas)]);
    }
  });

  it('o passo que depende de outro aponta para ele pelo número', () => {
    const { passos } = montarDiagnostico({
      ...entrada,
      numero: falha('190'),
      templates: falha('190'),
    });

    expect(passos[1].oQueFazer).toContain('Seu token da Meta venceu');
    expect(passos[2].oQueFazer).toBe('Mesma causa do passo 2. Resolva aquele e confira novamente.');
    expect(passos[3].oQueFazer).toBe('Mesma causa do passo 2. Resolva aquele e confira novamente.');
  });
});
