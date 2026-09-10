import { Cartao, Secao, TituloDaTela, Vazio } from '@/lib/painel/ui';
import { listarTarifas } from '@/lib/repo/zap-tarifas';
import { trimestresDesde } from '@/lib/zap/custo';
import { BotaoApagarTarifa, CadastrarTarifa } from './cadastrar-tarifa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIAS: Record<string, string> = {
  MARKETING: 'marketing',
  UTILITY: 'utilidade',
  AUTHENTICATION: 'autenticação',
};

export default async function TarifasPage() {
  const tarifas = await listarTarifas();
  const agora = new Date();

  return (
    <div>
      <a href="/disparador" className="mb-4 inline-block text-sm text-tinta-media hover:underline">
        Voltar ao disparador
      </a>
      <TituloDaTela
        titulo="Tarifas da Meta"
        pergunta="Quanto custa cada mensagem, para o painel poder estimar antes do disparo."
      />

      <CadastrarTarifa />

      <Secao
        titulo="Tarifas cadastradas"
        descricao="Sem tarifa para um país, os destinatários dele ficam de fora da estimativa — e a tela diz quantos, em vez de contá-los como zero."
      >
        {tarifas.length === 0 ? (
          <Vazio>
            Nenhuma tarifa cadastrada. Enquanto não houver, a tela de campanha não mostra
            estimativa — preferimos não mostrar número nenhum a mostrar um número inventado.
          </Vazio>
        ) : (
          <Cartao>
            <ul className="divide-y divide-linha">
              {tarifas.map((t) => {
                const trimestres = trimestresDesde(t.vigente_desde, agora);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 p-5">
                    <strong className="font-medium">+{t.pais}</strong>
                    <span className="text-sm text-tinta-media">
                      {CATEGORIAS[t.categoria] ?? t.categoria.toLowerCase()}
                    </span>
                    <span className="text-sm">
                      {t.moeda} {t.valor} por mensagem
                    </span>
                    <span className="text-sm text-tinta-media">desde {t.vigente_desde}</span>
                    {trimestres >= 1 && (
                      <span className="text-sm">
                        A Meta já atualizou a tabela {trimestres === 1 ? 'uma vez' : `${trimestres} vezes`} desde
                        essa data. Confira se ainda vale.
                      </span>
                    )}
                    <BotaoApagarTarifa id={t.id} />
                  </li>
                );
              })}
            </ul>
          </Cartao>
        )}
      </Secao>
    </div>
  );
}
