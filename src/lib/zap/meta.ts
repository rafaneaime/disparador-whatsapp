export type CredenciaisDaMeta = {
  token: string;
  numeroId: string;
  contaDoWhatsAppBusinessId: string;
  versao: string;
};

export type Falha = {
  tipo: 'transitorio' | 'permanente';
  codigo: string;
  /** O texto que a pessoa lê. Português quando a Meta mandar. */
  humano: string;
};

export type ResultadoDaMeta<T> = { ok: true; dados: T } | { ok: false; erro: Falha };

export type EnvioDeTemplate = {
  para: string;
  template: string;
  idioma: string;
  /** Só o envio sem variáveis foi observado; preenchidas são recusadas antes da rede. */
  variaveis?: readonly string[];
};

export type NumeroDaMeta = {
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  platform_type: string;
};

export type TemplateDaMeta = {
  name: string;
  language: string;
  status: string;
  category: string;
  /**
   * Opcionais porque template antigo pode não trazer.
   *
   * `rejected_reason` é o que faz uma rejeição ensinar alguma coisa. Sem pedir
   * este campo — que era o caso até 08/09 — a coluna `motivo_rejeicao` do banco
   * nunca era preenchida, e a pessoa via "rejeitado" sem saber por quê. Campo
   * ausente **não pode derrubar a listagem**: quem itera template precisa ver os
   * outros mesmo quando um vem incompleto.
   */
  id?: string;
  rejected_reason?: string;
};

// Só acrescentar códigos quando houver evidência observada em produção.
const CODIGOS_TRANSITORIOS: ReadonlySet<number> = new Set();

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function texto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Qual dos dois textos da Meta a pessoa lê.
 *
 * A Meta manda `error.message` e, às vezes, `error.error_data.details`. Qual
 * dos dois presta **muda por erro**, e as duas ordens fixas estão erradas:
 *
 * - no `131030`, o `details` vem em português e explica; o `message` é a sigla
 *   em inglês;
 * - num token vencido, o `message` diz "Session has expired on <data>" e o
 *   `details` diz só "Authentication Error".
 *
 * Observado nos dois casos contra a API real, em 07/09/2026. Preferir `details`
 * sempre — que foi a minha primeira regra — piorava o segundo caso.
 *
 * A regra que fica é grosseira de propósito: **fica o mais longo**. Texto mais
 * longo é o que carrega a circunstância — a data, o nome do campo, o que fazer.
 * Se um dia os dois forem igualmente inúteis, o problema é outro e este não é o
 * lugar de consertar.
 */
function escolherTexto(details: unknown, message: unknown, status: number): string {
  const candidatos = [details, message].filter(texto);
  if (candidatos.length === 0) return `A Meta recusou a requisição (HTTP ${status}).`;
  return candidatos.reduce((maior, atual) => (atual.length > maior.length ? atual : maior));
}

export function classificarErro(status: number, corpo: unknown): Falha {
  const erro = objeto(objeto(corpo).error);
  const codigo = typeof erro.code === 'number' ? erro.code : undefined;
  if (codigo === 131030) {
    return {
      tipo: 'permanente',
      codigo: '131030',
      humano: 'Este número não está confirmado na sua lista de teste. Adicione e confirme o código no painel da Meta antes de disparar.',
    };
  }

  const humano = escolherTexto(objeto(erro.error_data).details, erro.message, status);
  return {
    tipo: status === 429 || status >= 500 || (codigo !== undefined && CODIGOS_TRANSITORIOS.has(codigo))
      ? 'transitorio' : 'permanente',
    codigo: codigo === undefined ? `HTTP_${status}` : String(codigo),
    humano: humano.replace(/wamid\.[^\s"'<>]+/gi, '[id da mensagem omitido]'),
  };
}

async function requisitar(
  creds: CredenciaisDaMeta,
  caminho: string,
  opcoes: RequestInit,
  buscar: typeof fetch,
): Promise<ResultadoDaMeta<unknown>> {
  let resposta: Response;
  try {
    resposta = await buscar(`https://graph.facebook.com/${creds.versao}/${caminho}`, {
      ...opcoes,
      headers: { ...opcoes.headers, Authorization: `Bearer ${creds.token}` },
    });
  } catch {
    // A exceção de transporte pode conter a requisição e dados do destinatário.
    return {
      ok: false,
      erro: {
        tipo: 'transitorio', codigo: 'FALHA_DE_REDE',
        humano: 'Não foi possível conectar à Meta. Tente novamente.',
      },
    };
  }

  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }
  if (!resposta.ok) return { ok: false, erro: classificarErro(resposta.status, corpo) };
  return { ok: true, dados: corpo };
}

function respostaInvalida(humano: string): ResultadoDaMeta<never> {
  return { ok: false, erro: { tipo: 'permanente', codigo: 'RESPOSTA_INVALIDA', humano } };
}

/** O id retornado pertence à persistência de mensagens; não deve sair em diagnóstico. */
export async function enviarTemplate(
  creds: CredenciaisDaMeta,
  envio: EnvioDeTemplate,
  buscar: typeof fetch = fetch,
): Promise<ResultadoDaMeta<{ id: string; estado: string }>> {
  if (envio.variaveis?.length) {
    return {
      ok: false,
      erro: {
        tipo: 'permanente', codigo: 'VARIAVEIS_NAO_SUPORTADAS',
        humano: 'O envio com variáveis ainda não tem formato validado neste adaptador. Use um template sem variáveis.',
      },
    };
  }

  const resultado = await requisitar(creds, `${creds.numeroId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: envio.para,
      type: 'template',
      template: { name: envio.template, language: { code: envio.idioma } },
    }),
  }, buscar);
  if (!resultado.ok) return resultado;

  const mensagens = objeto(resultado.dados).messages;
  const mensagem = objeto(Array.isArray(mensagens) ? mensagens[0] : undefined);
  if (!texto(mensagem.id) || !texto(mensagem.message_status)) {
    return respostaInvalida('A Meta retornou uma resposta de envio sem id ou estado da mensagem.');
  }
  return { ok: true, dados: { id: mensagem.id, estado: mensagem.message_status } };
}

export async function consultarNumero(
  creds: CredenciaisDaMeta,
  buscar: typeof fetch = fetch,
): Promise<ResultadoDaMeta<NumeroDaMeta>> {
  const resultado = await requisitar(creds,
    `${creds.numeroId}?fields=display_phone_number,verified_name,quality_rating,platform_type`,
    { method: 'GET', cache: 'no-store' }, buscar);
  if (!resultado.ok) return resultado;

  const { display_phone_number, verified_name, quality_rating, platform_type } = objeto(resultado.dados);
  if (!texto(display_phone_number) || !texto(verified_name) || !texto(quality_rating) || !texto(platform_type)) {
    return respostaInvalida('A Meta retornou uma resposta de consulta do número incompleta.');
  }
  return { ok: true, dados: { display_phone_number, verified_name, quality_rating, platform_type } };
}

export async function listarTemplates(
  creds: CredenciaisDaMeta,
  buscar: typeof fetch = fetch,
): Promise<ResultadoDaMeta<TemplateDaMeta[]>> {
  const resultado = await requisitar(creds,
    `${creds.contaDoWhatsAppBusinessId}/message_templates?fields=id,name,language,status,category,rejected_reason`,
    { method: 'GET', cache: 'no-store' }, buscar);
  if (!resultado.ok) return resultado;

  const data = objeto(resultado.dados).data;
  const invalida = 'A Meta retornou uma lista de templates inválida.';
  if (!Array.isArray(data)) return respostaInvalida(invalida);

  const templates: TemplateDaMeta[] = [];
  for (const item of data) {
    const { id, name, language, status, category, rejected_reason } = objeto(item);
    if (!texto(name) || !texto(language) || !texto(status) || !texto(category)) {
      return respostaInvalida(invalida);
    }
    templates.push({
      name,
      language,
      status,
      category,
      ...(texto(id) ? { id } : {}),
      // A Meta manda "NONE" quando não houve rejeição. Guardar isso como motivo
      // faria a tela dizer que o template foi rejeitado por "NONE".
      ...(texto(rejected_reason) && rejected_reason.toUpperCase() !== 'NONE'
        ? { rejected_reason }
        : {}),
    });
  }
  return { ok: true, dados: templates };
}

/**
 * Cria um template na conta da pessoa e o submete para análise.
 *
 * O nome é **imutável depois disto**: a Meta não deixa corrigir um template
 * enviado, só criar outro. Quem itera — e iterar é o normal — precisa de um
 * nome novo a cada tentativa. Ver `sugerirNomeDeVersao` em `./template`.
 *
 * A categoria daqui é a **pedida**. A Meta pode devolver outra, e é a dela que
 * vale — inclusive na cobrança.
 */
export async function criarTemplate(
  creds: CredenciaisDaMeta,
  rascunho: { nome: string; idioma: string; categoria: string; componentes: unknown[] },
  buscar: typeof fetch = fetch,
): Promise<ResultadoDaMeta<{ id: string; estado: string; categoriaDaMeta: string | null }>> {
  const resultado = await requisitar(creds, `${creds.contaDoWhatsAppBusinessId}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: rascunho.nome,
      language: rascunho.idioma,
      category: rascunho.categoria,
      components: rascunho.componentes,
    }),
  }, buscar);
  if (!resultado.ok) return resultado;

  const corpo = objeto(resultado.dados);
  if (!texto(corpo.id)) {
    return respostaInvalida('A Meta aceitou o template mas não devolveu o identificador dele.');
  }
  return {
    ok: true,
    dados: {
      id: corpo.id,
      estado: texto(corpo.status) ? corpo.status : 'PENDING',
      categoriaDaMeta: texto(corpo.category) ? corpo.category : null,
    },
  };
}
