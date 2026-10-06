/**
 * Os avisos do Instagram, com o nome do que eles são.
 *
 * `messaging_postbacks` e `messaging_seen` são nomes de quem escreveu a API,
 * não de quem usa o painel. A tela de Logs existe para alguém entender por que
 * a automação não disparou — e uma lista de palavras em inglês no meio do
 * diagnóstico é mais uma coisa para traduzir na hora errada.
 */
export const NOME_DO_CAMPO: Readonly<Record<string, string>> = {
  comments: 'comentário em post',
  live_comments: 'comentário em live',
  mentions: 'menção',
  messages: 'mensagem na DM',
  messaging_postbacks: 'clique em botão da DM',
  messaging_seen: 'confirmação de leitura',
  message_reactions: 'reação a mensagem',
  messaging_referral: 'entrada por link',
  story_insights: 'números de Story',
};
