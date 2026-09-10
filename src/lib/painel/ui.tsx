import type { ReactNode } from 'react';
import { IconeVazio } from './icones';

/**
 * As peças que todas as telas do painel usam.
 *
 * Existem para que uma decisão de forma — quanto respira um cartão, como é um
 * estado vazio, onde mora o título de uma seção — seja tomada **uma vez**. A
 * alternativa já está documentada no projeto: a tabela de cores das faixas
 * ficou copiada em três telas e divergiu no detalhe que ninguém revisa.
 */

/** Cabeçalho de tela: o que é, e a pergunta que responde. */
export function TituloDaTela({
  titulo,
  pergunta,
  icone,
}: {
  titulo: string;
  pergunta: string;
  icone?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-2">
        {icone && <span className="text-tinta-fraca">{icone}</span>}
        <h1 className="text-[1.375rem] font-semibold tracking-tight">{titulo}</h1>
      </div>
      <p className="mt-1 text-sm text-tinta-media">{pergunta}</p>
    </header>
  );
}

export function Secao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
          {descricao && (
            <p className="mt-0.5 text-sm text-tinta-media">{descricao}</p>
          )}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/**
 * A superfície branca sobre o papel.
 *
 * Sem sombra: o contraste entre o branco e o papel quente do fundo já cria a
 * elevação, e sombra empilhada em cartão pequeno vira sujeira.
 */
export function Cartao({
  children,
  className = '',
  destaque = false,
}: {
  children: ReactNode;
  className?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-superficie ${
        destaque ? 'border-linha-forte' : 'border-linha'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Chip de faixa, de leitura, de estado. A cor vem de quem chama. */
export function Chip({
  children,
  cor = 'bg-frio-tenue text-tinta-media',
}: {
  children: ReactNode;
  cor?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cor}`}
    >
      {children}
    </span>
  );
}

/**
 * Um número com rótulo.
 *
 * `.numero` dá Geist Mono com `tabular-nums`: número de painel é lido em
 * coluna, e com largura variável a coluna dança a cada atualização.
 */
export function Metrica({
  rotulo,
  valor,
  ajuda,
  tinta = '',
  tamanho = 'medio',
}: {
  rotulo: string;
  valor: ReactNode;
  ajuda?: string;
  tinta?: string;
  tamanho?: 'medio' | 'grande';
}) {
  return (
    <div>
      <dt className="text-xs text-tinta-fraca">{rotulo}</dt>
      <dd
        className={`numero mt-1 font-semibold ${tinta} ${
          tamanho === 'grande' ? 'text-4xl' : 'text-2xl'
        }`}
      >
        {valor}
      </dd>
      {ajuda && <p className="mt-1 text-xs text-tinta-media">{ajuda}</p>}
    </div>
  );
}

/**
 * O estado vazio.
 *
 * Ele é interface, não sobra. Este produto passa as primeiras semanas de cada
 * comprador quase todo vazio — é o que a pessoa mais vê. Um vazio que só diz
 * "0" parece defeito; um que diz o que falta acontecer parece um sistema
 * esperando, que é a verdade.
 */
export function Vazio({
  children,
  compacto = false,
}: {
  children: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 text-sm text-tinta-media ${
        compacto ? '' : 'rounded-xl border border-dashed border-linha-forte px-4 py-5'
      }`}
    >
      <IconeVazio className="h-4 w-4 shrink-0 text-tinta-fraca" />
      <span>{children}</span>
    </div>
  );
}

/**
 * A escala de temperatura desenhada.
 *
 * Cinco degraus, com o da pessoa aceso. Serve para o número ter referência:
 * "62" sozinho não diz nada a quem abriu o painel pela primeira vez; "62,
 * quarto degrau de cinco" diz.
 */
export function EscalaDeTemperatura({
  temperatura,
  className = '',
}: {
  temperatura: number;
  className?: string;
}) {
  const degraus = [
    { ate: 20, cor: 'bg-frio-forte' },
    { ate: 40, cor: 'bg-engajado-forte' },
    { ate: 60, cor: 'bg-interessado-forte' },
    { ate: 80, cor: 'bg-quente-forte' },
    { ate: 100, cor: 'bg-muito-quente-forte' },
  ];
  const aceso = degraus.findIndex((d) => temperatura <= d.ate);

  return (
    <div className={`flex items-end gap-1 ${className}`} aria-hidden>
      {degraus.map((degrau, indice) => (
        <span
          key={degrau.ate}
          className={`w-2 rounded-sm ${degrau.cor} ${
            indice <= aceso ? 'opacity-100' : 'opacity-15'
          }`}
          style={{ height: `${8 + indice * 4}px` }}
        />
      ))}
    </div>
  );
}

/**
 * Campo de formulário. String de classes, e não componente, porque `input`,
 * `select` e `textarea` recebem props diferentes demais para valer um invólucro
 * — o que precisa ser igual é a aparência.
 */
export const ESTILO_CAMPO =
  'rounded-lg border border-linha-forte bg-superficie px-3 py-2 text-sm ' +
  'placeholder:text-tinta-fraca focus:border-tinta focus:outline-none ' +
  'focus:ring-2 focus:ring-tinta/10';

const ESTILOS_DO_BOTAO = {
  primario: 'bg-tinta text-papel hover:bg-tinta/90',
  secundario:
    'border border-linha-forte bg-superficie text-tinta hover:border-tinta',
  perigo: 'bg-caindo-forte text-papel hover:bg-caindo-forte/90',
} as const;

export function Botao({
  children,
  tipo = 'primario',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tipo?: keyof typeof ESTILOS_DO_BOTAO;
}) {
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${ESTILOS_DO_BOTAO[tipo]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Nome de usuário do Instagram, clicável quando dá para clicar.
 *
 * O @ aparece em seis telas e em nenhuma delas dava para ir ao perfil — quem
 * queria olhar quem era a pessoa tinha que copiar o nome e colar no navegador.
 *
 * **O nome vem de fora**, pela API do Meta, e vai virar `href`. Por isso ele é
 * conferido contra o alfabeto que o Instagram realmente permite antes de virar
 * link: letras, números, ponto e sublinhado. Um nome com `/`, `:` ou `?`
 * montaria uma URL para outro lugar, e o link do painel levaria a pessoa para
 * onde alguém de fora escolheu. Fora do formato, mostra o texto e não linka —
 * a tela não perde nada e ninguém é levado a lugar nenhum.
 *
 * Sem `username` sobra o id numérico, que não forma endereço de perfil. Aí
 * também é só texto.
 */
const USUARIO_DO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

export function PerfilDoInstagram({
  username,
  igUserId,
  rotulo,
  className = '',
}: {
  username: string | null;
  igUserId: string;
  /** Texto do link. Padrão: o próprio @. A lista de contatos usa só um ícone,
   *  porque lá o nome já leva para o perfil interno. */
  rotulo?: string;
  className?: string;
}) {
  if (!username || !USUARIO_DO_INSTAGRAM.test(username)) {
    // Sem link, o ícone não significa nada e vira ruído na linha.
    if (rotulo !== undefined) return null;
    return <span className={className}>{username ? `@${username}` : igUserId}</span>;
  }

  return (
    <a
      href={`https://www.instagram.com/${username}/`}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={`Abrir @${username} no Instagram`}
      className={`underline decoration-linha underline-offset-2 hover:decoration-tinta ${className}`}
    >
      {rotulo ?? `@${username}`}
    </a>
  );
}
