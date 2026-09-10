import { sql } from '../db';

/**
 * Estado do banco, para a tela de diagnóstico.
 *
 * O diagnóstico do disparador confere a Meta a cada abertura, mas nunca
 * conferiu o banco — e por isso podia dizer "Conectado" num painel onde todas
 * as outras telas dão erro. As duas falhas silenciosas são a variável ausente
 * (o build agora pula o schema em vez de morrer) e o schema não aplicado
 * (banco novo, deploy antes da integração terminar).
 */
export type EstadoDoBanco =
  | { estado: 'ok' }
  | { estado: 'sem_variavel' }
  | { estado: 'sem_tabelas' }
  | { estado: 'inacessivel' };

/**
 * A `DATABASE_URL` traz usuário e senha. Nada do que sai daqui pode carregar a
 * mensagem de erro original: uma falha de conexão do driver costuma citar a
 * URL inteira, e esta tela é a que a pessoa fotografa para pedir ajuda.
 */
export async function conferirBanco(): Promise<EstadoDoBanco> {
  if (!process.env.DATABASE_URL?.trim()) return { estado: 'sem_variavel' };

  try {
    const linhas = await sql`select to_regclass('public.zap_campaigns') as tabela`;
    return linhas[0]?.tabela ? { estado: 'ok' } : { estado: 'sem_tabelas' };
  } catch {
    return { estado: 'inacessivel' };
  }
}
