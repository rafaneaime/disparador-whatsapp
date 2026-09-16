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
 *
 * **Por que um Proxy e não uma função.** O cliente do Neon não é só chamável:
 * ele tem `transaction`, e `saveAutomation` e `salvarScores` dependem dela. A
 * primeira versão deste arquivo era uma função que repassava só a chamada,
 * com um `as` por cima — e o `as` calou o compilador sobre exatamente o que
 * havia sumido. Tipo afirmado não é tipo conferido; o Proxy repassa tudo, e
 * não precisa ser lembrado quando o driver ganhar o próximo método.
 */
type Cliente = NeonQueryFunction<false, false>;

let cliente: Cliente | undefined;

function conectar(): Cliente {
  cliente ??= neon(env.databaseUrl());
  return cliente;
}

export const sql = new Proxy(function vazio() {} as unknown as Cliente, {
  apply: (_alvo, _isto, argumentos) =>
    (conectar() as (...partes: unknown[]) => unknown)(...argumentos),

  get: (_alvo, propriedade) => {
    // Símbolos e `then` são o runtime inspecionando o objeto — `await` num
    // valor thenable, um `console.log`, o formatador de erro do vitest.
    // Conectar por causa disso faria a falta da variável estourar em lugares
    // que não têm nada a ver com banco, e a mensagem apontaria para o lugar
    // errado.
    if (typeof propriedade === 'symbol' || propriedade === 'then') return undefined;

    const atual = conectar();
    const valor = Reflect.get(atual, propriedade);
    // `transaction` usa o próprio cliente por dentro: entregar solta quebraria.
    return typeof valor === 'function' ? valor.bind(atual) : valor;
  },
});
