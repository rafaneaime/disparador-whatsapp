import { Cartao, Chip, Secao, TituloDaTela, Vazio } from '@/lib/painel/ui';
import { listarContatos, type Consentimento } from '@/lib/repo/zap-contacts';
import { BotaoDescadastrar, ColarContatos } from './colar-contatos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESTADOS: Record<Consentimento, string> = {
  subscribed: 'Autorizado', unsubscribed: 'Descadastrado', unknown: 'Sem confirmação',
};

function dataPtBr(data: Date | null): string {
  return data ? new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não registrado';
}

export default async function ContatosPage() {
  const contatos = await listarContatos();
  return (
    <div>
      <a href="/disparador" className="mb-4 inline-block text-sm text-tinta-media hover:underline">Voltar ao disparador</a>
      <TituloDaTela titulo="Contatos do WhatsApp" pergunta="Quem autorizou receber suas mensagens, e quando." />
      <ColarContatos />
      <Secao titulo="Contatos cadastrados" descricao="Descadastrar interrompe os envios pendentes e mantém o registro do consentimento.">
        {contatos.length === 0 ? <Vazio>Nenhum contato cadastrado ainda.</Vazio> : (
          <Cartao>
            <ul className="divide-y divide-linha">
              {contatos.map((contato) => (
                <li key={contato.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-medium">{contato.telefone}</strong>
                    <span className="text-sm text-tinta-media">{contato.nome ?? 'Sem nome'}</span>
                    <Chip cor={contato.consentimento === 'subscribed' ? 'bg-subindo-tenue text-subindo-forte' : undefined}>
                      {ESTADOS[contato.consentimento]}
                    </Chip>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-tinta-fraca">
                    <div><dt className="inline">Consentimento em: </dt><dd className="inline">{dataPtBr(contato.consentimento_em)}</dd></div>
                    <div><dt className="inline">Origem: </dt><dd className="inline break-words">{contato.consentimento_origem ?? 'Não registrada'}</dd></div>
                    {contato.descadastro_em && <div><dt className="inline">Descadastro em: </dt><dd className="inline">{dataPtBr(contato.descadastro_em)}</dd></div>}
                  </dl>
                  {contato.consentimento !== 'unsubscribed' && <BotaoDescadastrar id={contato.id} />}
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </Secao>
    </div>
  );
}
