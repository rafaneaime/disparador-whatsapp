'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Botao, Cartao, ESTILO_CAMPO } from '@/lib/painel/ui';
import type { EstadoCampanha } from '@/lib/repo/zap-campaigns';
import { ESTADOS_CAMPANHA } from '@/lib/zap/campanhas-ui';
import { estimarCusto, trimestresDesde, type Tarifa } from '@/lib/zap/custo';

type Criada = { id: number; enfileirados: number; recusadosPorConsentimento: number };

export function ResultadoCriacao({ resultado }: { resultado: Criada }) {
  return <div role="status" className="mt-4 text-sm">
    <p>{resultado.enfileirados} enfileirados · {resultado.recusadosPorConsentimento} recusados por consentimento.</p>
    <a className="mt-2 inline-block font-medium underline" href={`/disparador/campanhas/${resultado.id}`}>Abrir campanha</a>
  </div>;
}

export function SincronizarTemplates() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  async function sincronizar() {
    setOcupado(true);
    setMensagem('');
    try {
      const r = await fetch('/api/painel/zap/templates/sincronizar', { method: 'POST' });
      const dados = await r.json();
      setMensagem(r.ok ? `${dados.sincronizados} templates sincronizados.` : dados.erro || 'Não foi possível sincronizar.');
      if (r.ok) router.refresh();
    } catch { setMensagem('Não foi possível sincronizar. Confira a conexão e tente novamente.'); }
    finally { setOcupado(false); }
  }
  return <Cartao className="mb-5 p-5">
    <p className="mb-3 text-sm text-tinta-media">Traga os templates da Meta, incluindo o hello_world da conta de teste. Use templates sem variáveis.</p>
    <Botao tipo="secundario" onClick={sincronizar} disabled={ocupado}>{ocupado ? 'Sincronizando…' : 'Sincronizar templates'}</Botao>
    {mensagem && <p role="status" className="mt-3 text-sm">{mensagem}</p>}
  </Cartao>;
}

/**
 * Quanto isto deve custar, antes do botão.
 *
 * Sempre com o `≈`: quem cobra é a Meta, e só a fatura dela é verdade. O que
 * esta caixa evita é a surpresa — nunca promete o valor.
 */
function CustoEstimado({ telefones, categoria, tarifas }: {
  telefones: string[];
  categoria: string | null;
  tarifas: readonly Tarifa[];
}) {
  const estimativa = useMemo(
    () => estimarCusto({ telefones, categoria, tarifas }),
    [telefones.join(','), categoria, tarifas],
  );

  if (telefones.length === 0) return null;

  if (tarifas.length === 0) {
    return (
      <p className="text-sm text-tinta-media">
        Sem estimativa de custo: nenhuma tarifa cadastrada.{' '}
        <a className="underline" href="/disparador/tarifas">Cadastrar tarifas</a> — os valores
        estão na página de preços da Meta.
      </p>
    );
  }

  const trimestres = trimestresDesde(estimativa.tarifaMaisAntiga, new Date());
  const fora = estimativa.semTarifa.reduce((total, g) => total + g.quantos, 0);

  return (
    <div aria-live="polite" className="rounded-lg bg-superficie p-4 text-sm">
      <p>
        {telefones.length} destinatário(s){categoria ? ` · ${categoria.toLowerCase()}` : ''}
      </p>
      {estimativa.totalPorMoeda.length === 0 ? (
        <p className="mt-1 text-tinta-media">
          {categoria === null
            ? 'Escolha o template para ver a estimativa — o preço muda com a categoria.'
            : 'Nenhum destinatário tem tarifa cadastrada para este país.'}
        </p>
      ) : (
        <p className="mt-1">
          <strong>
            ≈ {estimativa.totalPorMoeda.map(t => `${t.moeda} ${t.valor.toFixed(2)}`).join(' + ')}
          </strong>
          {estimativa.tarifaMaisAntiga && (
            <span className="text-tinta-media"> · tarifa de {estimativa.tarifaMaisAntiga}</span>
          )}
        </p>
      )}
      {fora > 0 && (
        <p className="mt-1">
          {fora} destinatário(s) ficaram de fora da conta por não haver tarifa do país deles
          {estimativa.semTarifa.length > 0 &&
            ` (começam com ${estimativa.semTarifa.map(g => g.prefixo).join(', ')})`}
          .
        </p>
      )}
      {trimestres >= 1 && (
        <p className="mt-1">
          A Meta já atualizou a tabela de preços desde essa data. Confira se a tarifa ainda vale.
        </p>
      )}
      <p className="mt-1 text-tinta-media">Estimativa. Quem cobra é a Meta.</p>
    </div>
  );
}

export function CriarCampanha({ templates, contatos, tarifas = [] }: {
  templates: { id: number; nome: string; idioma: string; categoria?: string | null }[];
  contatos: { id: number; nome: string | null; telefone: string }[];
  tarifas?: readonly Tarifa[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<Criada | null>(null);
  const trava = useRef(false);
  async function criar(event: FormEvent) {
    event.preventDefault();
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro('');
    try {
      const r = await fetch('/api/painel/zap/campanhas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, templateId: Number(templateId), contatos: selecionados }) });
      const dados = await r.json();
      if (!r.ok) { setErro(dados.erro || 'Não foi possível criar a campanha.'); return; }
      setResultado(dados);
      router.refresh();
    } catch { setErro('Não foi possível confirmar a criação. Confira a lista de campanhas antes de tentar novamente.'); }
    finally { setOcupado(false); trava.current = false; }
  }
  return <Cartao className="p-5">
    <h2 className="mb-4 font-semibold">Nova campanha</h2>
    <form onSubmit={criar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">Nome da campanha
        <input className={ESTILO_CAMPO} value={nome} maxLength={200} required onChange={e => setNome(e.target.value)} disabled={ocupado || !!resultado} />
      </label>
      <label className="flex flex-col gap-1 text-sm">Template
        <select className={ESTILO_CAMPO} value={templateId} required onChange={e => setTemplateId(e.target.value)} disabled={ocupado || !!resultado}>
          <option value="">Selecione um template aprovado</option>
          {templates.map(t => <option value={t.id} key={t.id}>{t.nome} ({t.idioma})</option>)}
        </select>
      </label>
      {templates.length === 0 && <p className="text-sm text-tinta-media">Sincronize os templates acima para carregar as mensagens aprovadas.</p>}
      <CustoEstimado
        telefones={contatos.filter(c => selecionados.includes(c.id)).map(c => c.telefone)}
        categoria={templates.find(t => String(t.id) === templateId)?.categoria ?? null}
        tarifas={tarifas}
      />
      <fieldset disabled={ocupado || !!resultado}>
        <legend className="mb-2 text-sm font-medium">Contatos autorizados</legend>
        {contatos.length === 0 ? <p className="text-sm text-tinta-media">Nenhum contato elegível. <a className="underline" href="/disparador/contatos">Cadastrar contatos</a></p> : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-linha p-3">
            {contatos.map(c => <label key={c.id} className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" checked={selecionados.includes(c.id)} onChange={e => setSelecionados(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} />
              {c.nome || 'Sem nome'} · {c.telefone}
            </label>)}
          </div>
        )}
      </fieldset>
      <p className="text-sm text-tinta-media" aria-live="polite">{selecionados.length} contatos selecionados. O consentimento será conferido novamente ao enfileirar.</p>
      <Botao type="submit" disabled={ocupado || !!resultado || !nome.trim() || !templateId || !selecionados.length || selecionados.length > 1000}>
        {ocupado ? 'Criando…' : 'Criar campanha'}
      </Botao>
    </form>
    {erro && <p role="alert" className="mt-3 text-sm text-caindo-forte">{erro}</p>}
    {resultado && <ResultadoCriacao resultado={resultado} />}
  </Cartao>;
}

export function DispararCampanha({ id, estado, pendentes }: { id: number; estado: EstadoCampanha; pendentes: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const trava = useRef(false);
  async function disparar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setMensagem('');
    try {
      const r = await fetch(`/api/painel/zap/campanhas/${id}/disparar`, { method: 'POST' });
      const dados = await r.json();
      setMensagem(r.ok ? `${dados.enviadas} enviadas · ${dados.falhas} falhas · ${dados.pendentes} pendentes.` : dados.erro || 'Não foi possível disparar.');
    } catch { setMensagem('Não foi possível confirmar o resultado. Atualize o detalhe antes de tentar novamente.'); }
    finally { router.refresh(); setOcupado(false); trava.current = false; }
  }
  return <div className="mt-4">
    {['draft', 'queued', 'running'].includes(estado) ? <>
      <Botao onClick={disparar} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Disparar lote'}</Botao>
      <p className="mt-2 text-sm text-tinta-media">{pendentes} pendentes. Cada clique envia até 5 mensagens. Se sobrarem pendentes, aguarde e dispare outro lote.</p>
    </> : <p className="text-sm text-tinta-media">{ESTADOS_CAMPANHA[estado]}. Esta campanha não permite disparos no estado atual.</p>}
    {mensagem && <p role="status" className="mt-3 text-sm">{mensagem}</p>}
  </div>;
}
