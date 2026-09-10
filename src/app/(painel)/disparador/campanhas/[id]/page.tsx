import { notFound } from 'next/navigation';
import { Cartao, Secao, TituloDaTela } from '@/lib/painel/ui';
import { acharCampanha, contarMensagens, listarFalhas } from '@/lib/repo/zap-disparo';
import { idValido } from '@/lib/zap/campanhas';
import { ESTADOS_CAMPANHA } from '@/lib/zap/campanhas-ui';
import { DispararCampanha } from '../acoes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !idValido(Number(id))) notFound();
  const campanha = await acharCampanha(Number(id));
  if (!campanha) notFound();
  const contagens = await contarMensagens(campanha.id);
  const falhas = await listarFalhas(campanha.id);
  return <div>
    <a href="/disparador/campanhas" className="mb-4 inline-block text-sm text-tinta-media hover:underline">Voltar às campanhas</a>
    <TituloDaTela titulo={campanha.nome} pergunta={`${ESTADOS_CAMPANHA[campanha.estado]} · ${campanha.template_nome} (${campanha.idioma})`} />
    <Cartao className="p-5">
      <p className="text-sm">{contagens.pendentes} pendentes · {contagens.enviadas} enviadas · {contagens.falhas} falhas · {contagens.enviando} em envio</p>
      <p className="mt-2 text-sm text-tinta-media">Enviada significa aceita pela Meta. A confirmação de entrega e leitura depende do webhook.</p>
      <DispararCampanha id={campanha.id} estado={campanha.estado} pendentes={contagens.pendentes} />
    </Cartao>
    {falhas.length > 0 && <Secao titulo="Falhas e orientações" descricao="Falhas temporárias continuam pendentes e podem ser tentadas no próximo lote.">
      <Cartao><ul className="divide-y divide-linha">
        {falhas.map(f => <li key={f.id} className="p-5 text-sm">
          <p className="break-words">{(f.erro_texto || 'Não foi possível enviar esta mensagem.').replace(/wamid\.[^\s"'<>]+/gi, '[id omitido]')}</p>
        </li>)}
      </ul></Cartao>
    </Secao>}
  </div>;
}
