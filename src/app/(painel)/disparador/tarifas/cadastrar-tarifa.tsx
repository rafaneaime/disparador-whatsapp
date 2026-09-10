'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Botao, Cartao, ESTILO_CAMPO } from '@/lib/painel/ui';

const CATEGORIAS = [
  { valor: 'MARKETING', rotulo: 'Marketing' },
  { valor: 'UTILITY', rotulo: 'Utilidade' },
  { valor: 'AUTHENTICATION', rotulo: 'Autenticação' },
];

export function CadastrarTarifa() {
  const router = useRouter();
  const [pais, setPais] = useState('55');
  const [categoria, setCategoria] = useState('MARKETING');
  const [valor, setValor] = useState('');
  const [moeda, setMoeda] = useState('USD');
  const [vigenteDesde, setVigenteDesde] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/painel/zap/tarifas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pais, categoria, valor: Number(valor), moeda, vigente_desde: vigenteDesde,
        }),
      });
      const dados = (await r.json()) as { ok?: boolean; erro?: string };
      if (!r.ok || !dados.ok) throw new Error(dados.erro ?? 'Não foi possível salvar a tarifa.');
      setValor('');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a tarifa.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Cartao destaque className="p-5">
      <h2 className="text-base font-semibold tracking-tight">Cadastrar tarifa</h2>
      <p className="mt-1 text-sm text-tinta-media">
        Copie os valores da página de preços da Meta. Ela atualiza a tabela todo início de
        trimestre — por isso guardamos a data em que a tarifa passou a valer, e avisamos quando
        ficar velha.
      </p>

      <form onSubmit={salvar} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          DDI
          <input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="55" className={ESTILO_CAMPO} />
        </label>
        <label className="text-sm font-medium">
          Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={ESTILO_CAMPO}>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Por mensagem
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="0.0625"
            className={ESTILO_CAMPO}
          />
        </label>
        <label className="text-sm font-medium">
          Moeda
          <input value={moeda} onChange={(e) => setMoeda(e.target.value)} placeholder="USD" className={ESTILO_CAMPO} />
        </label>
        <label className="text-sm font-medium">
          Vigente desde
          <input
            type="date"
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className={ESTILO_CAMPO}
          />
        </label>
        <Botao type="submit" disabled={carregando}>{carregando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>

      {erro && <p className="mt-3 text-sm text-tinta-media">{erro}</p>}
    </Cartao>
  );
}

export function BotaoApagarTarifa({ id }: { id: number }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  return (
    <button
      type="button"
      disabled={carregando}
      onClick={async () => {
        setCarregando(true);
        await fetch('/api/painel/zap/tarifas', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        setCarregando(false);
        router.refresh();
      }}
      className="text-sm text-tinta-media hover:underline"
    >
      {carregando ? 'Apagando…' : 'apagar'}
    </button>
  );
}
