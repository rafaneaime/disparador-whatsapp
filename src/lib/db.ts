import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env';

/**
 * A conexão nasce no primeiro uso, não na importação do módulo.
 *
 * Parece detalhe, e é a diferença entre um deploy verde e um vermelho. Antes,
 * `neon(env.databaseUrl())` rodava assim que alguém importava este arquivo — e
 * o `next build` importa, ao coletar os dados das páginas. Sem `DATABASE_URL`
 * o build inteiro morria com "Failed to collect page data", que não diz a
 * ninguém que faltou uma variável de ambiente.
 *
 * Quem instala pelo botão de deploy recebe o banco pela integração do Neon, e
 * normalmente a variável está lá antes da primeira construção. Normalmente. Se
 * um dia não estiver — integração lenta, plano esgotado, variável renomeada —
 * o certo é o site subir e a tela de diagnóstico dizer o que falta, e não o
 * deploy falhar antes de existir tela alguma. Numa sala instalando ao vivo,
 * essa é a diferença entre "está escrito o que fazer" e "deu erro".
 */
/** O mesmo tipo que `neon(url)` devolve com as opções padrão. */
type Cliente = NeonQueryFunction<false, false>;

let cliente: Cliente | undefined;

function conectar(): Cliente {
  cliente ??= neon(env.databaseUrl());
  return cliente;
}

export const sql = ((...partes: Parameters<Cliente>) =>
  conectar()(...partes)) as Cliente;
