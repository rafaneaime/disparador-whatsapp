import type { EstadoDoBanco } from '../repo/zap-banco';
import type { EstadoDasCredenciais } from './credenciais';
import { classificarErro, type Falha, type NumeroDaMeta, type ResultadoDaMeta, type TemplateDaMeta } from './meta';

export type Passo = {
  nome: string;
  estado: 'ok' | 'falta' | 'erro' | 'opcional';
  /** Vazio quando o passo está pronto. */
  oQueFazer: string;
  detalhe?: string;
};

export type Diagnostico = {
  estado: 'nao_configurado' | 'conectado' | 'degradado' | 'desconectado';
  passos: Passo[];
};

export type EntradaDoDiagnostico = {
  credenciais: EstadoDasCredenciais;
  numero?: ResultadoDaMeta<NumeroDaMeta>;
  templates?: ResultadoDaMeta<TemplateDaMeta[]>;
  webhookConfigurado: boolean;
  banco?: EstadoDoBanco;
};

/**
 * O caminho real, conferido na Vercel em 10/09/2026.
 *
 * Estava escrito "Settings → Environment Variables" em três lugares desta tela,
 * e não existe: a lista fica dentro do ambiente. Quem seguiu procurou uma aba
 * que não está lá — e esta tela existe justamente para tirar a pessoa do lugar
 * onde ela travou. Uma constante para os três, porque instrução de navegação
 * que a gente repete é instrução que envelhece em um lugar só.
 */
const VARIAVEIS = 'Settings → Environments → Production → Environment Variables';

const BANCO: Record<EstadoDoBanco['estado'], { estado: Passo['estado']; oQueFazer: string }> = {
  ok: { estado: 'ok', oQueFazer: '' },
  sem_variavel: {
    estado: 'erro',
    oQueFazer:
      `O painel não tem banco de dados. Em Vercel → Storage, crie um banco Neon e conecte-o a este projeto — isso cria a variável DATABASE_URL sozinho. Se você já tem um banco, salve a DATABASE_URL dele em ${VARIAVEIS}. Depois faça um novo deploy.`,
  },
  sem_tabelas: {
    estado: 'erro',
    oQueFazer:
      'O banco existe mas está vazio: as tabelas são criadas durante o deploy, e este subiu antes de o banco estar ligado. Faça um novo deploy na Vercel — em Deployments, nos três pontinhos do deploy mais recente, Redeploy. Nada se perde.',
  },
  inacessivel: {
    estado: 'erro',
    oQueFazer:
      `Não foi possível falar com o banco de dados. Confira em Vercel → Storage se o banco continua ligado a este projeto e se não está suspenso, e confira a DATABASE_URL em ${VARIAVEIS}. Depois faça um novo deploy.`,
  },
};

const ONDE_ENCONTRAR: Record<string, string> = {
  WHATSAPP_ACCESS_TOKEN: 'WHATSAPP_ACCESS_TOKEN: em WhatsApp → Configuração da API → Gerar, copie o token de acesso.',
  WHATSAPP_PHONE_NUMBER_ID: 'WHATSAPP_PHONE_NUMBER_ID: em WhatsApp → Configuração da API, copie a Identificação do número de telefone, abaixo do número de teste.',
  WHATSAPP_BUSINESS_ACCOUNT_ID: 'WHATSAPP_BUSINESS_ACCOUNT_ID: em WhatsApp → Configuração da API, copie a Identificação da conta do WhatsApp Business, abaixo da identificação do número.',
};
const TOKEN_VENCIDO = 'Seu token da Meta venceu. Gere outro em Configuração da API → Gerar, e atualize a variável WHATSAPP_ACCESS_TOKEN na Vercel. Enquanto for token temporário isso vai se repetir — o guia mostra como criar o permanente. Depois de salvar, faça um novo deploy na Vercel e confira novamente.';

function orientarFalha(erro: Falha | undefined, consulta: 'numero' | 'templates'): string {
  if (erro?.codigo === '190') return TOKEN_VENCIDO;
  if (erro?.codigo === '131030') {
    // Reutiliza a tradução canônica do adaptador, sem copiar texto livre da API.
    return classificarErro(400, { error: { code: 131030 } }).humano;
  }
  if (!erro || erro.tipo === 'transitorio' || erro.codigo === 'INESPERADO' || erro.codigo === 'RESPOSTA_INVALIDA') {
    return `Não foi possível conferir ${consulta === 'numero' ? 'o número' : 'os templates'} na Meta agora. Clique em Conferir novamente. Se continuar, confira a configuração e as permissões do aplicativo na Meta.`;
  }
  return consulta === 'numero'
    ? 'A Meta recusou a consulta do número. Confira WHATSAPP_PHONE_NUMBER_ID em WhatsApp → Configuração da API → Identificação do número de telefone e as permissões do token para esse número. Atualize na Vercel e faça um novo deploy.'
    : 'A Meta recusou a consulta dos templates. Confira WHATSAPP_BUSINESS_ACCOUNT_ID em WhatsApp → Configuração da API → Identificação da conta do WhatsApp Business e as permissões do token para essa conta. Atualize na Vercel e faça um novo deploy.';
}

/**
 * Uma causa, uma instrução.
 *
 * Sem isto, um token vencido faz os passos 2, 3 e 4 repetirem o mesmo parágrafo
 * de cinco linhas, três vezes — e faltar credencial faz o mesmo. Quem bate o
 * olho vê três muros de texto iguais e não sabe se tem três problemas ou um.
 * Numa sala com cinquenta pessoas instalando ao mesmo tempo, essa dúvida é a
 * diferença entre resolver sozinho e levantar a mão.
 *
 * A partir da segunda vez, o passo aponta para quem manda em vez de repetir.
 */
function naoRepetirInstrucao(passos: Passo[]): Passo[] {
  const primeiraVez = new Map<string, number>();

  return passos.map((passo, indice) => {
    if (!passo.oQueFazer) return passo;

    const anterior = primeiraVez.get(passo.oQueFazer);
    if (anterior === undefined) {
      primeiraVez.set(passo.oQueFazer, indice + 1);
      return passo;
    }

    return {
      ...passo,
      oQueFazer: `Mesma causa do passo ${anterior}. Resolva aquele e confira novamente.`,
    };
  });
}

/** Somente decisões e textos controlados: nunca devolve credenciais ou texto cru da Meta. */
export function montarDiagnostico(entrada: EntradaDoDiagnostico): Diagnostico {
  const { credenciais, numero, templates, webhookConfigurado, banco } = entrada;
  const faltaCredencial = credenciais.faltando.length > 0 || credenciais.credenciais === null;
  const erroNumero = numero?.ok === false ? numero.erro : undefined;
  const erroTemplates = templates?.ok === false ? templates.erro : undefined;
  const tokenVencido = erroNumero?.codigo === '190' || erroTemplates?.codigo === '190';
  const aprovado = templates?.ok === true && templates.dados.some((t) => t.status === 'APPROVED');
  const aguardar = 'Preencha as credenciais no ambiente da Vercel, faça um novo deploy e clique em Conferir novamente.';
  const bancoQuebrado = banco !== undefined && banco.estado !== 'ok';
  const passos: Passo[] = [
    // Primeiro passo de propósito: sem banco, nenhuma outra tela do painel
    // funciona, e conferir a Meta antes disso manda a pessoa consertar o que
    // não está quebrado.
    ...(banco ? [{ nome: 'Banco de dados', ...BANCO[banco.estado] }] : []),
    {
      nome: 'Credenciais no ambiente', estado: faltaCredencial ? 'falta' : 'ok',
      oQueFazer: faltaCredencial
        ? `${credenciais.faltando.map((nome) => ONDE_ENCONTRAR[nome]).filter(Boolean).join(' ')} Salve em Vercel → ${VARIAVEIS} e faça um novo deploy.`
        : '',
    },
    {
      nome: 'Token válido', estado: faltaCredencial ? 'falta' : tokenVencido || !numero?.ok ? 'erro' : 'ok',
      oQueFazer: faltaCredencial ? aguardar : tokenVencido ? TOKEN_VENCIDO : numero?.ok ? '' : orientarFalha(erroNumero, 'numero'),
    },
    {
      nome: 'Número conectado', estado: faltaCredencial ? 'falta' : numero?.ok ? 'ok' : 'erro',
      oQueFazer: faltaCredencial ? aguardar : numero?.ok ? '' : orientarFalha(erroNumero, 'numero'),
    },
    {
      nome: 'Template aprovado', estado: faltaCredencial ? 'falta' : !templates?.ok ? 'erro' : aprovado ? 'ok' : 'falta',
      oQueFazer: faltaCredencial ? aguardar : !templates?.ok ? orientarFalha(erroTemplates, 'templates') : aprovado ? ''
        : 'Em WhatsApp Manager → Modelos de mensagem, confira a aprovação. Para o primeiro teste, procure o hello_world na conta de teste; um template PENDING ainda aguarda análise da Meta. Depois, clique em Conferir novamente.',
    },
    {
      nome: 'Lista de teste', estado: 'opcional',
      oQueFazer: 'Se usar o número de teste, em Configuração da API → Para → Gerenciar lista de números, adicione o seu próprio número e confirme o código que chegar no seu WhatsApp. Um número basta para o primeiro disparo; o de teste aceita até cinco. Esta lista não é conferida automaticamente aqui.',
    },
    {
      nome: 'Webhook', estado: webhookConfigurado ? 'ok' : 'opcional',
      oQueFazer: webhookConfigurado ? '' : 'O envio funciona sem webhook; os estados entregue e lida não chegam sem ele. Para configurá-lo depois, encontre a chave em Configurações → Básico → Chave secreta do aplicativo e salve META_APP_SECRET na Vercel. Siga o guia para concluir a configuração.',
      ...(webhookConfigurado ? { detalhe: 'META_APP_SECRET presente. A entrega de eventos do webhook não é verificada nesta tela.' } : {}),
    },
  ];
  // Banco quebrado nunca pode aparecer como "Conectado": a Meta pode estar
  // perfeita e ainda assim nenhuma tela do painel abrir.
  const estado: Diagnostico['estado'] = bancoQuebrado ? 'desconectado'
    : faltaCredencial ? 'nao_configurado'
    : !numero?.ok || tokenVencido || erroTemplates?.tipo === 'permanente' ? 'desconectado'
      : !aprovado ? 'degradado' : 'conectado';
  return { estado, passos: naoRepetirInstrucao(passos) };
}
