'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Botao, Cartao, ESTILO_CAMPO } from '@/lib/painel/ui';
import { lerColagem, type ResultadoColagem } from '@/lib/zap/colar';

export function ContagemColagem({ texto }: { texto: string }) {
  const colagem = useMemo(() => lerColagem(texto, 1000), [texto]);
  const repetidos = colagem.linhas.filter((linha) => linha.situacao === 'repetido').length;
  const invalidos = colagem.linhas.filter((linha) => linha.situacao === 'invalido').length;
  return (
    <p aria-live="polite" className="text-sm text-tinta-media">
      {colagem.validos.length} válidos · {repetidos} repetidos · {invalidos} inválidos
    </p>
  );
}

export function ColarContatos() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoColagem | null>(null);

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!consentimento || carregando) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const resposta = await fetch('/api/painel/zap/contatos', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto, consentimento }),
      });
      const dados = await resposta.json() as ResultadoColagem & { ok?: boolean; erro?: string };
      if (!resposta.ok || !dados.ok) throw new Error(dados.erro ?? 'Não foi possível cadastrar os contatos.');
      setResultado(dados);
      setConsentimento(false);
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar os contatos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Cartao destaque className="p-5">
      <h2 className="text-base font-semibold tracking-tight">Colar números</h2>
      <p className="mt-1 text-sm text-tinta-media">Para começar, cole seu próprio número. Um basta.</p>
      <form onSubmit={cadastrar} className="mt-5 flex flex-col gap-3">
        <label className="text-sm font-medium">
          Telefones, um por linha
          <textarea value={texto} onChange={(evento) => { setTexto(evento.target.value); setResultado(null); }}
            rows={7} placeholder={'(11) 98765-4321\n+1 202 555 0123'}
            disabled={carregando} className={`mt-1 w-full ${ESTILO_CAMPO}`} aria-describedby="limite-colagem" />
        </label>
        <p id="limite-colagem" className="text-xs text-tinta-fraca">Até 1.000 linhas por vez. Para números de fora do Brasil, inclua + e o DDI.</p>
        <ContagemColagem texto={texto} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consentimento} disabled={carregando} className="mt-1"
            onChange={(evento) => setConsentimento(evento.target.checked)} />
          <span>Confirmo que as pessoas destes números autorizaram receber minhas mensagens pelo WhatsApp. Esta confirmação terá origem e data registradas.</span>
        </label>
        <Botao type="submit" disabled={!consentimento || carregando || !texto.trim()} className="self-start">
          {carregando ? 'Cadastrando...' : 'Cadastrar contatos'}
        </Botao>
      </form>
      {erro && <p role="alert" className="mt-3 text-sm text-caindo-forte">{erro}</p>}
      {resultado && (
        <div className="mt-5 rounded-xl border border-linha-forte p-4">
          <h3 className="font-semibold">Resultado da colagem</h3>
          <p role="status" className="mt-2 text-sm text-tinta-media">
            {resultado.contagens.cadastrados} cadastrados · {resultado.contagens.existentes} já existentes · {resultado.contagens.repetidos} repetidos · {resultado.contagens.invalidos} inválidos
          </p>
          <p className="mt-2 text-xs text-tinta-fraca">Contatos existentes mantêm o consentimento anterior. Colar novamente não reativa descadastrados.</p>
          <ol className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {resultado.linhas.map((linha, indice) => (
              <li key={indice} className="break-words rounded-lg bg-papel p-2">
                <span className="font-medium">{linha.original}</span>{' — '}
                {linha.situacao === 'invalido' ? `Inválido: ${linha.motivo}`
                  : linha.situacao === 'repetido' ? `Repetido nesta colagem: ${linha.telefone}`
                    : `${linha.resultado === 'cadastrado' ? 'Cadastrado' : 'Já existente, preservado'}: ${linha.telefone}`}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Cartao>
  );
}

export function BotaoDescadastrar({ id }: { id: number }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function descadastrar() {
    if (carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/painel/zap/contatos', {
        method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const dados = await resposta.json() as { ok?: boolean; erro?: string };
      if (!resposta.ok || !dados.ok) throw new Error(dados.erro ?? 'Não foi possível descadastrar.');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível descadastrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-3">
      <Botao tipo="perigo" onClick={descadastrar} disabled={carregando}>
        {carregando ? 'Descadastrando...' : 'Descadastrar'}
      </Botao>
      {erro && <p role="alert" className="mt-2 text-sm text-caindo-forte">{erro}</p>}
    </div>
  );
}
