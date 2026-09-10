'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Botao, Cartao, ESTILO_CAMPO } from '@/lib/painel/ui';
import {
  previa,
  sugerirNomeDeVersao,
  validarRascunho,
  variaveisDoCorpo,
} from '@/lib/zap/template';

export type TemplateExistente = {
  id: number;
  nome: string;
  idioma: string;
  estado: string;
  categoria_pedida: string | null;
  categoria_meta: string | null;
  corpo: string;
};

const CATEGORIAS = [
  { valor: 'UTILITY', rotulo: 'Utilidade — responde a algo que a pessoa fez' },
  { valor: 'MARKETING', rotulo: 'Marketing — oferece, convida ou promove' },
  { valor: 'AUTHENTICATION', rotulo: 'Autenticação — códigos de verificação' },
];

const IDIOMAS = ['pt_BR', 'en_US', 'es_ES'];

type Resposta = {
  ok?: boolean;
  erro?: string;
  categoriaPedida?: string;
  categoriaDaMeta?: string | null;
  reclassificado?: boolean;
};

export function EditorDeTemplate({
  existentes,
  partirDe,
}: {
  existentes: readonly TemplateExistente[];
  partirDe?: TemplateExistente;
}) {
  const router = useRouter();
  const nomesUsados = useMemo(() => existentes.map((t) => t.nome), [existentes]);

  const [nome, setNome] = useState(
    partirDe ? sugerirNomeDeVersao(partirDe.nome, nomesUsados) : '',
  );
  const [idioma, setIdioma] = useState(partirDe?.idioma ?? 'pt_BR');
  const [categoria, setCategoria] = useState(partirDe?.categoria_pedida ?? 'UTILITY');
  const [corpo, setCorpo] = useState(partirDe?.corpo ?? '');
  const [exemplos, setExemplos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  const quantasVariaveis = useMemo(() => variaveisDoCorpo(corpo).length, [corpo]);
  const rascunho = { nome, idioma, categoria, corpo, exemplos };
  const problemas = useMemo(() => validarRascunho(rascunho), [nome, idioma, categoria, corpo, exemplos]);

  async function submeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (problemas.length > 0 || carregando) return;
    setCarregando(true);
    setErro(null);
    setResposta(null);
    try {
      const r = await fetch('/api/painel/zap/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rascunho),
      });
      const dados = (await r.json()) as Resposta;
      if (!r.ok || !dados.ok) throw new Error(dados.erro ?? 'Não foi possível criar o template.');
      setResposta(dados);
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível criar o template.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Cartao destaque className="p-5">
      <h2 className="text-base font-semibold tracking-tight">
        {partirDe ? `Nova versão de ${partirDe.nome}` : 'Criar template'}
      </h2>
      <p className="mt-1 text-sm text-tinta-media">
        A Meta analisa cada template antes de liberar o envio. O nome não pode ser reaproveitado
        depois de enviado — para corrigir, cria-se uma versão nova.
      </p>

      <form onSubmit={submeter} className="mt-5 flex flex-col gap-4">
        <label className="text-sm font-medium">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="convite_imersao"
            className={ESTILO_CAMPO}
          />
          <span className="mt-1 block text-xs font-normal text-tinta-media">
            Só minúsculas, números e _
          </span>
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-medium">
            Idioma
            <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className={ESTILO_CAMPO}>
              {IDIOMAS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="flex-1 text-sm font-medium">
            Categoria pedida
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={ESTILO_CAMPO}>
              {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-tinta-media">
              A Meta decide a categoria final, e cobra pela dela. Marketing custa cerca de seis vezes
              mais que utilidade.
            </span>
          </label>
        </div>

        <label className="text-sm font-medium">
          Mensagem
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={4}
            placeholder="Oi {{1}}, sua vaga na turma de {{2}} está reservada."
            className={ESTILO_CAMPO}
          />
          <span className="mt-1 block text-xs font-normal text-tinta-media">
            Use {'{{1}}'}, {'{{2}}'} para o que muda a cada pessoa.
          </span>
        </label>

        {quantasVariaveis > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Exemplos</legend>
            <span className="text-xs text-tinta-media">
              A Meta exige um exemplo por variável — é com ele que ela analisa.
            </span>
            {Array.from({ length: quantasVariaveis }, (_, indice) => (
              <label key={indice} className="text-sm">
                {`{{${indice + 1}}}`}
                <input
                  value={exemplos[indice] ?? ''}
                  onChange={(e) => {
                    const proximos = [...exemplos];
                    proximos[indice] = e.target.value;
                    setExemplos(proximos.slice(0, quantasVariaveis));
                  }}
                  className={ESTILO_CAMPO}
                />
              </label>
            ))}
          </fieldset>
        )}

        {corpo.trim() !== '' && (
          <div className="rounded-lg bg-superficie p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-tinta-media">Prévia</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{previa({ corpo, exemplos })}</p>
          </div>
        )}

        {problemas.length > 0 && (
          <ul aria-live="polite" className="flex flex-col gap-1 text-sm text-tinta-media">
            {problemas.map((p) => <li key={`${p.campo}-${p.texto}`}>• {p.texto}</li>)}
          </ul>
        )}

        <Botao type="submit" disabled={problemas.length > 0 || carregando}>
          {carregando ? 'Enviando para análise…' : 'Enviar para análise'}
        </Botao>
      </form>

      {erro && <p className="mt-4 text-sm text-tinta-media">{erro}</p>}

      {resposta?.ok && (
        <div className="mt-4 rounded-lg bg-superficie p-4 text-sm">
          <p>Template enviado. A Meta vai analisar e o estado aparece na lista abaixo.</p>
          {resposta.reclassificado && (
            <p className="mt-2">
              <strong>Atenção:</strong> você pediu {resposta.categoriaPedida} e a Meta classificou
              como {resposta.categoriaDaMeta}. A cobrança segue a categoria dela.
            </p>
          )}
        </div>
      )}
    </Cartao>
  );
}
