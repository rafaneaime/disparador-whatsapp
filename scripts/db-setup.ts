import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { analisarSql, motivoDestrutivo, type ComandoSql } from '@/lib/sql-statements';

const DIR_MIGRACOES = 'db/migrations';

type Arquivo = { nome: string; comandos: ComandoSql[] };

function lerArquivos(): Arquivo[] {
  const arquivos: Arquivo[] = [];
  if (existsSync('db/schema.sql')) {
    arquivos.push({ nome: 'db/schema.sql', comandos: analisarSql(readFileSync('db/schema.sql', 'utf8')) });
  } else {
    console.log('Não há schema base neste pacote; seguindo para as migrações.');
  }

  if (!existsSync(DIR_MIGRACOES)) return arquivos;

  // Ordem lexical. O prefixo numérico dos arquivos (001-, 002-) é o que
  // garante que a ordem seja a mesma em todas as instalações.
  const nomes = readdirSync(DIR_MIGRACOES)
    .filter((n) => n.endsWith('.sql'))
    .sort();

  for (const nome of nomes) {
    const caminho = join(DIR_MIGRACOES, nome);
    arquivos.push({
      nome: caminho,
      comandos: analisarSql(readFileSync(caminho, 'utf8')),
    });
  }

  return arquivos;
}

// Confere tudo antes de executar qualquer coisa. Metade das migrações
// aplicadas é pior do que nenhuma: o banco fica num estado que ninguém
// escreveu e que nenhuma execução seguinte espera encontrar.
function conferir(arquivos: Arquivo[]): void {
  const problemas: string[] = [];

  for (const arquivo of arquivos) {
    for (const comando of arquivo.comandos) {
      const motivo = motivoDestrutivo(comando.codigo);
      if (motivo) {
        problemas.push(
          `  ${arquivo.nome}\n    ${motivo}\n    > ${comando.raw.split('\n')[0].slice(0, 90)}`,
        );
      }
    }
  }

  if (problemas.length === 0) return;

  console.error(
    '\nMigração recusada: comando destrutivo encontrado.\n\n' +
      problemas.join('\n\n') +
      '\n\nMigração neste projeto é sempre aditiva. Quem aplica é o build do\n' +
      'cliente, no deploy dele, sem backup e sem ninguém olhando — um comando\n' +
      'destrutivo aqui apaga os dados de quem instalou e não há como desfazer.\n' +
      'Se a mudança for mesmo necessária, ela precisa de um caminho próprio,\n' +
      'não do db:setup. Ver ARCHITECTURE.md, seção 4.\n',
  );
  process.exit(1);
}

/**
 * Com `--se-houver`, faltar banco é aviso, não morte.
 *
 * Quem roda `npm run db:setup` na mão pediu para aplicar o schema: se não há
 * banco, isso falhou, e falhar em silêncio esconderia o problema. Já o `build`
 * roda este script de passagem, antes do `next build`. Ali, faltar
 * `DATABASE_URL` não deve derrubar a construção inteira: é melhor o site subir
 * e a tela de diagnóstico dizer "falta o banco" do que a pessoa receber um
 * deploy vermelho e nenhuma tela onde ler o motivo.
 */
const SE_HOUVER = process.argv.includes('--se-houver');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (SE_HOUVER) {
      console.warn(
        'DATABASE_URL não está definida; pulando o schema.\n' +
          'O site vai subir, mas sem banco. Defina DATABASE_URL nas variáveis de\n' +
          'ambiente e faça um novo deploy — a tela inicial do painel repete isso.',
      );
      return;
    }
    console.error('DATABASE_URL não está definida. Preencha o .env antes de rodar.');
    process.exit(1);
  }

  const arquivos = lerArquivos();
  conferir(arquivos);

  const client = neon(url);
  let total = 0;

  for (const arquivo of arquivos) {
    for (const comando of arquivo.comandos) {
      try {
        await client.query(comando.raw);
      } catch (error) {
        console.error(
          `\nFalhou em ${arquivo.nome}:\n  ${comando.raw.slice(0, 200)}\n`,
        );
        throw error;
      }
    }
    total += arquivo.comandos.length;
    console.log(`  ${arquivo.nome}: ${arquivo.comandos.length} comandos`);
  }

  console.log(`Schema aplicado: ${total} comandos executados.`);
}

main().catch((error) => {
  console.error('Falha ao aplicar o schema:', error);
  process.exit(1);
});
