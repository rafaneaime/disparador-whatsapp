import { randomUUID } from 'node:crypto';
import { criarCampanha } from '../repo/zap-campaigns';
import { enfileirarCampanha, reivindicarLote, marcarResultado, type ResultadoEnvio } from '../repo/zap-messages';
import { acharTemplate, acharTemplatePorId, gravarTemplateCriado, sincronizarResumoTemplates, type EstadoTemplate } from '../repo/zap-templates';
import { acharCampanha, iniciarCampanha, telefoneDoContato, devolverPendente, concluirSeTerminou, contarMensagens } from '../repo/zap-disparo';
import { lerCredenciais } from './credenciais';
import { componentesParaMeta, validarRascunho } from './template';
import { criarTemplate, enviarTemplate, listarTemplates } from './meta';

/** Os estados que a Meta usa, em minúsculas. Fora desta lista, tratamos como desativado. */
const ESTADOS_DE_TEMPLATE = new Set<EstadoTemplate>([
  'draft', 'submitting', 'pending', 'approved', 'rejected', 'paused', 'disabled',
]);

export class ErroCampanha extends Error {
  constructor(message: string, public status = 400, public estado?: string) { super(message); }
}

export function idValido(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;
}

export function temVariaveis(componentes: unknown[]): boolean {
  return /\{\{[^}]+\}\}/.test(JSON.stringify(componentes));
}

function credenciais() {
  const { credenciais: creds } = lerCredenciais(process.env);
  if (!creds) throw new ErroCampanha('Configure a conexão com a Meta antes de continuar.');
  return creds;
}

// Cinco envios de até oito segundos cabem no orçamento de 60s da rota.
const buscar: typeof fetch = (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(8_000) });

/**
 * Cria o template na Meta e guarda o que ela devolveu.
 *
 * A validação local roda **antes** da rede: cada submissão inválida gasta uma
 * rodada de análise da Meta, e quem itera para tentar a categoria de utilidade
 * já gasta rodadas demais com o que só a Meta sabe julgar.
 */
export async function criarTemplateDoPainel(corpo: unknown) {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const rascunho = {
    nome: String(c.nome ?? '').trim().toLowerCase(),
    idioma: String(c.idioma ?? '').trim(),
    categoria: String(c.categoria ?? '').trim().toUpperCase(),
    corpo: String(c.corpo ?? ''),
    exemplos: Array.isArray(c.exemplos) ? c.exemplos.map((e) => String(e ?? '')) : [],
  };

  const problemas = validarRascunho(rascunho);
  if (problemas.length > 0) {
    throw new ErroCampanha(problemas.map((p) => p.texto).join(' '), 400);
  }

  // O nome é imutável na Meta: se já existe, não há o que corrigir — duplica-se
  // com outro nome. Barrar aqui evita o erro dela, que vem em inglês e sem dizer
  // o que fazer.
  if (await acharTemplate(rascunho.nome, rascunho.idioma)) {
    throw new ErroCampanha(
      `Já existe um template chamado "${rascunho.nome}" nesse idioma. Nome de template não pode ser reaproveitado na Meta — use "duplicar e corrigir" para criar a próxima versão.`,
      409,
    );
  }

  const componentes = componentesParaMeta(rascunho);
  const resposta = await criarTemplate(
    credenciais(),
    { nome: rascunho.nome, idioma: rascunho.idioma, categoria: rascunho.categoria, componentes },
    buscar,
  );
  if (!resposta.ok) throw new ErroCampanha(resposta.erro.humano, 502);

  const estado = resposta.dados.estado.toLowerCase();
  const id = await gravarTemplateCriado({
    meta_id: resposta.dados.id,
    nome: rascunho.nome,
    idioma: rascunho.idioma,
    categoria_pedida: rascunho.categoria,
    categoria_meta: resposta.dados.categoriaDaMeta,
    componentes,
    estado: ESTADOS_DE_TEMPLATE.has(estado as EstadoTemplate)
      ? (estado as EstadoTemplate)
      : 'pending',
  });

  return {
    ok: true,
    id,
    estado,
    categoriaPedida: rascunho.categoria,
    categoriaDaMeta: resposta.dados.categoriaDaMeta,
    // Quem pediu utilidade e recebeu marketing precisa saber agora, não na
    // fatura: a diferença é de cerca de seis vezes por mensagem.
    reclassificado:
      resposta.dados.categoriaDaMeta !== null &&
      resposta.dados.categoriaDaMeta !== rascunho.categoria,
  };
}

export async function criarCampanhaDoPainel(corpo: unknown) {
  const c = corpo as Record<string, unknown> | null;
  if (!c || typeof c.nome !== 'string' || !c.nome.trim() || c.nome.trim().length > 200 ||
      !idValido(c.templateId) || !Array.isArray(c.contatos) || !c.contatos.length ||
      c.contatos.length > 1000 || !c.contatos.every(idValido)) {
    throw new ErroCampanha('Informe nome (até 200 caracteres), template e de 1 a 1000 contatos válidos.');
  }
  const template = await acharTemplatePorId(c.templateId);
  if (!template) throw new ErroCampanha('Template não encontrado.', 404);
  if (template.estado !== 'approved') {
    throw new ErroCampanha(`O template não está aprovado (${template.estado}). ${template.motivo_rejeicao || 'Sincronize os templates e confira a aprovação na Meta.'}`);
  }
  if (temVariaveis(template.componentes)) throw new ErroCampanha('Escolha um template sem variáveis.');
  const contatos = [...new Set(c.contatos as number[])];
  const id = await criarCampanha({ nome: c.nome.trim(), template_id: template.id, variaveis: {} });
  const enfileirados = await enfileirarCampanha(id, contatos);
  return { ok: true, id, enfileirados, recusadosPorConsentimento: contatos.length - enfileirados };
}

export async function sincronizarTemplatesDoPainel() {
  const resultado = await listarTemplates(credenciais(), buscar);
  if (!resultado.ok) throw new ErroCampanha(resultado.erro.humano, 502);
  const templates = resultado.dados.map(t => {
    const estado = t.status.toLowerCase() as EstadoTemplate;
    return {
      nome: t.name, idioma: t.language, categoria_meta: t.category,
      estado: ESTADOS_DE_TEMPLATE.has(estado) ? estado : 'disabled' as const,
      meta_id: t.id ?? null,
      // Só quem foi rejeitado carrega motivo. Um template que voltou aprovado
      // depois de uma rejeição precisa perder o motivo antigo, senão a tela
      // continua mostrando a reprovação de uma versão que já passou.
      motivo_rejeicao: estado === 'rejected' ? t.rejected_reason ?? null : null,
    };
  });
  await sincronizarResumoTemplates(templates);
  return { ok: true, sincronizados: new Set(templates.map(t => JSON.stringify([t.nome, t.idioma]))).size };
}

/** Uma chamada, uma reivindicação, um resultado por mensagem. Sem reencadeamento. */
export async function dispararLote(id: number) {
  const campanha = await acharCampanha(id);
  if (!campanha) throw new ErroCampanha('Campanha não encontrada.', 404);
  if (!['draft', 'queued', 'running'].includes(campanha.estado)) {
    const motivos: Record<string, string> = {
      paused: 'A campanha está pausada.', cancelled: 'A campanha está cancelada.',
      completed: 'A campanha já foi concluída.', failed: 'A campanha está interrompida por falha.',
    };
    throw new ErroCampanha(motivos[campanha.estado], 409, campanha.estado);
  }
  const creds = credenciais();
  if (campanha.template_estado !== 'approved') throw new ErroCampanha('O template não está aprovado. Sincronize os templates antes de disparar.');
  if (temVariaveis(campanha.componentes) || Object.keys(campanha.variaveis).length) {
    throw new ErroCampanha('Escolha um template sem variáveis.');
  }
  if (!await iniciarCampanha(id)) throw new ErroCampanha('O estado da campanha mudou. Atualize a página.', 409);
  const lote = randomUUID();
  const mensagens = await reivindicarLote(id, lote, 5);
  let enviadas = 0;
  let falhas = 0;
  const gravacoesPendentes: (() => Promise<void>)[] = [];
  for (const mensagem of mensagens) {
    let resultado: ResultadoEnvio | { estado: 'pendente'; erro_codigo: string; erro_texto: string };
    try {
      const telefone = await telefoneDoContato(mensagem.contact_id);
      if (!telefone) {
        resultado = { estado: 'falhou', erro_codigo: 'CONTATO_AUSENTE', erro_texto: 'O contato não está mais disponível para envio.' };
      } else {
        const envio = await enviarTemplate(creds, { para: telefone, template: campanha.template_nome, idioma: campanha.idioma }, buscar);
        resultado = envio.ok ? { estado: 'enviada', meta_message_id: envio.dados.id }
          : { estado: envio.erro.tipo === 'transitorio' ? 'pendente' : 'falhou',
            erro_codigo: envio.erro.codigo, erro_texto: envio.erro.humano.replace(/wamid\.[^\s"'<>]+/gi, '[id omitido]') };
      }
    } catch {
      // A exceção original pode conter telefone, requisição ou credenciais.
      resultado = { estado: 'falhou', erro_codigo: 'ENVIO_INESPERADO',
        erro_texto: 'Ocorreu uma falha inesperada ao preparar ou enviar esta mensagem. Confira a conexão antes de criar outro envio.' };
    }
    const gravar = async () => {
      const gravou = resultado.estado === 'pendente'
        ? await devolverPendente(mensagem.id, lote, resultado.erro_codigo, resultado.erro_texto)
        : await marcarResultado(mensagem.id, lote, resultado);
      if (gravou && resultado.estado === 'enviada') enviadas++;
      if (gravou && resultado.estado === 'falhou') falhas++;
    };
    try { await gravar(); }
    catch { gravacoesPendentes.push(gravar); }
  }
  // Falha do banco não abandona as demais reivindicadas. Repetir somente a
  // persistência idempotente, conservando o resultado original, nunca o envio.
  let semPersistencia = false;
  for (const gravar of gravacoesPendentes) {
    try { await gravar(); }
    catch { semPersistencia = true; }
  }
  if (semPersistencia) throw new ErroCampanha('O banco não confirmou todos os resultados. Confira a campanha antes de continuar.', 503);
  await concluirSeTerminou(id);
  const { pendentes } = await contarMensagens(id);
  return { enviadas, falhas, pendentes };
}

