'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ConviteDeUpgrade, LinkDoPainel } from '@/lib/painel/navegacao';

/**
 * O menu do painel.
 *
 * É componente de cliente por um motivo só: marcar onde a pessoa está. Com
 * quase dez itens numa linha, um menu sem estado ativo obriga a ler o título
 * da página para saber onde se está — e o título rola para fora da tela assim
 * que a pessoa desce.
 *
 * A lista em si continua vindo de `navegacao.ts`, que é o arquivo substituído
 * na exportação da base. Este componente não sabe quais rotas existem, e é
 * assim que ele pode ser base sem vazar a Plataforma.
 */
export function MenuDoPainel({
  links,
  upgrade = null,
}: {
  links: readonly LinkDoPainel[];
  upgrade?: ConviteDeUpgrade | null;
}) {
  const caminho = usePathname();

  return (
    <nav className="-mx-6 mb-8 overflow-x-auto border-b border-linha px-6">
      <ul className="flex min-w-max items-center gap-1 pb-px">
        {links.map((link) => {
          // A raiz casa exata; o resto casa por prefixo, para /contatos/12
          // continuar acendendo "Contatos".
          const ativo =
            link.href === '/'
              ? caminho === '/'
              : caminho === link.href || caminho.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={ativo ? 'page' : undefined}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm transition-colors ${
                  ativo
                    ? 'border-tinta font-medium text-tinta'
                    : 'border-transparent text-tinta-media hover:border-linha-forte hover:text-tinta'
                }`}
              >
                <span className={ativo ? 'text-tinta' : 'text-tinta-fraca'}>
                  {link.icone}
                </span>
                {link.label}
              </Link>
            </li>
          );
        })}
        {/*
          Botão, e não mais uma aba: aba é lugar dentro do painel, e isto leva
          para fora dele — a página de vendas, em outra aba do navegador, para
          a pessoa não perder o que estava fazendo. `ml-auto` o encosta à
          direita, longe das telas de trabalho.
        */}
        {upgrade && (
          <li className="ml-auto pl-4">
            <a
              href={upgrade.href}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-sm font-medium text-papel transition-opacity hover:opacity-85"
            >
              <span aria-hidden="true">↑</span>
              {upgrade.label}
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
