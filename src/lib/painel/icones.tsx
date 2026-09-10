/**
 * Os ícones do painel, desenhados aqui.
 *
 * Sem biblioteca de ícone, e a razão é a mesma que manteve o MCP sem SDK: o
 * produto é self-hosted e cada aluno roda a própria cópia. Uma dependência de
 * ícone traz centenas de arquivos, uma superfície de atualização e mais uma
 * coisa que pode quebrar a instalação de outra pessoa — para desenhar oito
 * formas de doze linhas cada.
 *
 * Todos partilham a mesma gramática: traço de 1.5, ponta e junta arredondadas,
 * grade de 24. Ícone que mistura preenchido com contornado numa mesma tela
 * parece colado de dois lugares diferentes, porque foi.
 *
 * `currentColor` sempre: quem decide a cor é o contexto, e é assim que o ícone
 * segue a escala de temperatura sem saber que ela existe.
 */

type PropsDoIcone = {
  className?: string;
  /** Rótulo para leitor de tela. Sem ele, o ícone é decorativo e some. */
  titulo?: string;
};

function Svg({
  className = 'h-4 w-4',
  titulo,
  children,
}: PropsDoIcone & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={titulo ? undefined : true}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      {children}
    </svg>
  );
}

/** Temperatura, calor, lead quente. */
export function IconeChama(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M12 3c.6 3 2.2 4.2 3.6 5.6A6.6 6.6 0 0 1 18 13a6 6 0 1 1-12 0c0-1.8.7-3 1.6-4" />
      <path d="M12 21a3 3 0 0 1-3-3c0-1.6 1.2-2.4 1.8-3.6.5 1 1.2 1.4 2 2.1.7.6 2.2 1 2.2 1.5a3 3 0 0 1-3 3Z" />
    </Svg>
  );
}

/** Checkout, compra. */
export function IconeCarrinho(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L20 7H6" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </Svg>
  );
}

/** Subiu, esquentou. */
export function IconeSubindo(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M3 17l5.5-5.5 3.5 3.5L21 6" />
      <path d="M15 6h6v6" />
    </Svg>
  );
}

/** Voltou depois de sumir. */
export function IconeRetorno(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M3 10a8 8 0 1 1 2 5.3" />
      <path d="M3 5v5h5" />
    </Svg>
  );
}

/** Clique num link. */
export function IconeClique(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M11 3v3M4.2 5.6l2.1 2.1M3 12h3M19.8 5.6l-2.1 2.1" />
      <path d="M10 10l9 4-4 1.4-1.6 4L10 10Z" />
    </Svg>
  );
}

/** Audiência, gente. */
export function IconePessoas(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 4.8M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
    </Svg>
  );
}

/** Credencial, chave de API. */
export function IconeChave(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <circle cx="7.5" cy="14.5" r="3.5" />
      <path d="M10 12L20 4M17.5 6.5l2 2M15 8.8l2 2" />
    </Svg>
  );
}

/** Site, domínio. */
export function IconeGlobo(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
    </Svg>
  );
}

/** Oferta, disparo. */
export function IconeMegafone(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <path d="M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1Z" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </Svg>
  );
}

/** Nada aqui ainda. */
export function IconeVazio(props: PropsDoIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <path d="M9 12h6" />
    </Svg>
  );
}
