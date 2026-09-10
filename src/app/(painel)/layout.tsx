import { requirePanelSession } from '@/lib/auth';
import { LINKS_DO_PAINEL } from '@/lib/painel/navegacao';
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
      <MenuDoPainel links={LINKS_DO_PAINEL} />
      <main>{children}</main>
    </div>
  );
}
