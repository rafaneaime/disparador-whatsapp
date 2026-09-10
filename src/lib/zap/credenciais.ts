import type { CredenciaisDaMeta } from './meta';

export type EstadoDasCredenciais = {
  faltando: string[];
  credenciais: CredenciaisDaMeta | null;
};

/** Ausência é estado de instalação, nunca uma exceção nem leitura no import. */
export function lerCredenciais(ambiente: NodeJS.ProcessEnv): EstadoDasCredenciais {
  const token = ambiente.WHATSAPP_ACCESS_TOKEN?.trim() ?? '';
  const numeroId = ambiente.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? '';
  const contaDoWhatsAppBusinessId = ambiente.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? '';
  const faltando = [
    ['WHATSAPP_ACCESS_TOKEN', token],
    ['WHATSAPP_PHONE_NUMBER_ID', numeroId],
    ['WHATSAPP_BUSINESS_ACCOUNT_ID', contaDoWhatsAppBusinessId],
  ].filter(([, valor]) => !valor).map(([nome]) => nome);

  return {
    faltando,
    credenciais: faltando.length ? null : {
      token, numeroId, contaDoWhatsAppBusinessId,
      versao: ambiente.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v23.0',
    },
  };
}
