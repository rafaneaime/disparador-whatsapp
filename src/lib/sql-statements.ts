/**
 * Separa um arquivo .sql nos comandos individuais que o cliente do Neon
 * precisa receber um a um.
 *
 * Existe porque `split(';')` corta no meio de string, comentário e corpo de
 * função. Enquanto o schema só tinha `create table`, isso nunca apareceu; a
 * primeira migração com um ponto e vírgula dentro de aspas mandaria metade de
 * um comando para o banco — durante o `npm run build`, ou seja, no deploy de
 * todo aluno, sem ninguém olhando.
 */

const TAG_DOLAR = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/;

export type ComandoSql = {
  /** O texto original, com comentário e tudo, que vai para o banco. */
  raw: string;
  /** O mesmo comando sem comentário e sem o conteúdo das strings. */
  codigo: string;
};

/**
 * Percorre o arquivo uma vez e devolve, para cada comando, o texto cru e uma
 * versão só com código. A segunda existe para a checagem de segurança: sem
 * ela, um comentário dizendo "nunca use drop table aqui" seria lido como um
 * drop table.
 */
export function analisarSql(sql: string): ComandoSql[] {
  const comandos: ComandoSql[] = [];
  let buffer = '';
  let codigo = '';
  // Distingue "comando de verdade" de trecho que só tem espaço e comentário —
  // o rabo de comentário depois do último ponto e vírgula não é um comando.
  let temConteudo = false;
  let i = 0;

  const guardar = () => {
    if (temConteudo) comandos.push({ raw: buffer.trim(), codigo: codigo.trim() });
    buffer = '';
    codigo = '';
    temConteudo = false;
  };

  while (i < sql.length) {
    const atual = sql[i];
    const proximo = sql[i + 1];

    // Comentário de linha: vai até a quebra, que é copiada no próximo giro.
    if (atual === '-' && proximo === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        buffer += sql[i];
        i++;
      }
      codigo += ' ';
      continue;
    }

    // Comentário de bloco. No Postgres ele aninha, diferente da maioria das
    // linguagens: /* a /* b */ c */ só fecha no último.
    if (atual === '/' && proximo === '*') {
      let profundidade = 0;
      while (i < sql.length) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          profundidade++;
          buffer += '/*';
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          profundidade--;
          buffer += '*/';
          i += 2;
          if (profundidade === 0) break;
          continue;
        }
        buffer += sql[i];
        i++;
      }
      codigo += ' ';
      continue;
    }

    // String literal. Aspa simples duplicada ('') é escape, não fechamento.
    if (atual === "'" || atual === '"') {
      const aspa = atual;
      buffer += aspa;
      i++;
      let fechou = false;
      while (i < sql.length) {
        if (sql[i] === aspa) {
          if (sql[i + 1] === aspa) {
            buffer += aspa + aspa;
            i += 2;
            continue;
          }
          buffer += aspa;
          i++;
          fechou = true;
          break;
        }
        buffer += sql[i];
        i++;
      }
      if (!fechou) {
        throw new Error(
          `SQL inválido: aspa ${aspa} não fechada. Confira o arquivo de migração.`,
        );
      }
      // O conteúdo da string não é código: só as aspas ficam, para o comando
      // continuar reconhecível sem carregar o texto de dentro.
      codigo += aspa + aspa;
      temConteudo = true;
      continue;
    }

    // Dollar quoting: $$corpo$$ ou $tag$corpo$tag$. O regex exige o $ final,
    // então placeholder ($1, $2) não entra aqui por engano.
    if (atual === '$') {
      const abertura = TAG_DOLAR.exec(sql.slice(i))?.[0];
      if (abertura) {
        buffer += abertura;
        i += abertura.length;
        const fim = sql.indexOf(abertura, i);
        if (fim === -1) {
          throw new Error(
            `SQL inválido: marcação ${abertura} não fechada. Confira o arquivo de migração.`,
          );
        }
        buffer += sql.slice(i, fim) + abertura;
        i = fim + abertura.length;
        codigo += `${abertura}${abertura}`;
        temConteudo = true;
        continue;
      }
    }

    if (atual === ';') {
      guardar();
      i++;
      continue;
    }

    buffer += atual;
    codigo += atual;
    if (!/\s/.test(atual)) temConteudo = true;
    i++;
  }

  guardar();
  return comandos;
}

export function splitSqlStatements(sql: string): string[] {
  return analisarSql(sql).map((c) => c.raw);
}

const DESTRUTIVOS: [RegExp, string][] = [
  [/\bdrop\s+table\b/, 'apaga uma tabela'],
  [/\bdrop\s+column\b/, 'apaga uma coluna'],
  [/\bdrop\s+schema\b/, 'apaga um schema'],
  [/\bdrop\s+database\b/, 'apaga o banco inteiro'],
  [/\btruncate\b/, 'esvazia uma tabela'],
  [/\balter\s+column\b[\s\S]*\btype\b/, 'troca o tipo de uma coluna'],
];

/**
 * Diz por que um comando é destrutivo, ou null se ele for seguro.
 *
 * Recebe a versão `codigo` de analisarSql, não o texto cru — ver o comentário
 * de ComandoSql.
 *
 * A regra de "migração sempre aditiva" está escrita no ARCHITECTURE.md, mas
 * regra escrita não impede nada: quem aplicaria a migração destrutiva é o
 * build do aluno, sem ninguém olhando e sem backup. Esta função é o lugar
 * onde a regra vira obstáculo de verdade.
 */
export function motivoDestrutivo(codigo: string): string | null {
  const normalizado = codigo.toLowerCase().replace(/\s+/g, ' ');
  for (const [padrao, motivo] of DESTRUTIVOS) {
    if (padrao.test(normalizado)) return motivo;
  }
  return null;
}
