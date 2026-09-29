'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ConviteDeUpgrade, LinkDoPainel } from '@/lib/painel/navegacao';
import { indiceAtivo } from '@/lib/painel/item-ativo';
import { RecursosRadar } from '@/lib/painel/upgrade';

export function MenuDoPainel({ links, upgrade = null }: {
  links: readonly LinkDoPainel[];
  upgrade?: ConviteDeUpgrade | null;
}) {
  const caminho = usePathname();
  const selecionado = indiceAtivo(caminho, links);
  return (
    <nav className="painel-menu" aria-label="Menu principal">
      <ul>
        {links.map((link, indice) => {
          const ativo = selecionado === indice;
          return <li key={link.href}><Link href={link.href} aria-current={ativo ? 'page' : undefined}>
            <span aria-hidden="true">{link.icone}</span>{link.label}
          </Link></li>;
        })}
        <li><Link href="/login">Sessão / sair</Link></li>
      </ul>
      {upgrade && <><RecursosRadar href={upgrade.href} compacto/><div className="painel-upgrade"><a href={upgrade.href} target="_blank" rel="noopener noreferrer">Desbloquear o Radar</a></div></>}
    </nav>
  );
}
