import { Cartao, Secao, TituloDaTela, Vazio } from '@/lib/painel/ui';
import { listarCampanhas } from '@/lib/repo/zap-disparo';
import { listarTemplates } from '@/lib/repo/zap-templates';
import { listarContatos } from '@/lib/repo/zap-contacts';
import { temVariaveis } from '@/lib/zap/campanhas';
import { ESTADOS_CAMPANHA } from '@/lib/zap/campanhas-ui';
import { tarifasVigentes } from '@/lib/repo/zap-tarifas';
import { CriarCampanha, SincronizarTemplates } from './acoes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function CampanhasPage() {
  const campanhas = await listarCampanhas();
  const templates = await listarTemplates('approved');
  const contatos = await listarContatos();
  const tarifas = await tarifasVigentes();
  return (
    <div>
      <a href="/disparador" className="mb-4 inline-block text-sm text-tinta-media hover:underline">Voltar ao disparador</a>
      <TituloDaTela titulo="Campanhas de WhatsApp" pergunta="Escolha uma mensagem aprovada e quem autorizou recebê-la." />
      <SincronizarTemplates />
      <CriarCampanha
        templates={templates.filter(t => t.estado === 'approved' && !temVariaveis(t.componentes))
          // `categoria_meta` é a que a Meta devolveu, e é por ela que ela cobra.
          // Usar a pedida daria uma estimativa menor que a fatura.
          .map(t => ({ id: t.id, nome: t.nome, idioma: t.idioma, categoria: t.categoria_meta }))}
        contatos={contatos.filter(c => c.consentimento === 'subscribed' && c.descadastro_em === null)
          .map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone }))}
        tarifas={tarifas}
      />
      <Secao titulo="Campanhas criadas">
        {campanhas.length === 0 ? <Vazio>Nenhuma campanha criada ainda.</Vazio> : (
          <Cartao><ul className="divide-y divide-linha">
            {campanhas.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <a href={`/disparador/campanhas/${c.id}`} className="font-medium hover:underline">{c.nome}</a>
              <span className="text-sm text-tinta-media">{ESTADOS_CAMPANHA[c.estado]} · {c.total} destinatários</span>
            </li>)}
          </ul></Cartao>
        )}
      </Secao>
    </div>
  );
}
