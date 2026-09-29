import { requirePanelSession } from '@/lib/auth';
import { CONVITE_DE_UPGRADE, LINKS_DO_PAINEL, NOME_DO_PAINEL } from '@/lib/painel/navegacao';
import { MenuDoPainel } from './menu';

export const runtime = 'nodejs';

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePanelSession();

  return (
    <div className="painel-app">
      <a className="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
      <header className="painel-marca"><span className="painel-simbolo" aria-hidden="true">◎</span><span>{NOME_DO_PAINEL}</span></header>
      <div className="painel-corpo">
        <MenuDoPainel links={LINKS_DO_PAINEL} upgrade={CONVITE_DE_UPGRADE} />
        <main id="conteudo" className="painel-conteudo">{children}</main>
      </div>
    </div>
  );
}
