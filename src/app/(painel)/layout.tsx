import { requirePanelSession } from '@/lib/auth';
import { CONVITE_DE_UPGRADE, LINKS_DO_PAINEL } from '@/lib/painel/navegacao';
import { MenuDoPainel } from './menu';

export const runtime = 'nodejs';

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePanelSession();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <MenuDoPainel links={LINKS_DO_PAINEL} upgrade={CONVITE_DE_UPGRADE} />
      <main>{children}</main>
    </div>
  );
}
