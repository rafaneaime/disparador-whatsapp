'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Botao } from '@/lib/painel/ui';

/**
 * Sem webhook de template, é este botão que tira um template de "em análise".
 *
 * A Meta não nos avisa quando termina de analisar. Enquanto não existir o
 * webhook, o estado só muda quando alguém pergunta — e por isso o botão precisa
 * estar onde a pessoa está esperando a resposta, não escondido nas
 * configurações.
 */
export function SincronizarTemplates() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function sincronizar() {
    setCarregando(true);
    setMensagem(null);
    try {
      const r = await fetch('/api/painel/zap/templates/sincronizar', { method: 'POST' });
      const dados = (await r.json()) as { ok?: boolean; erro?: string; sincronizados?: number };
      if (!r.ok || !dados.ok) throw new Error(dados.erro ?? 'Não foi possível sincronizar.');
      setMensagem(
        dados.sincronizados === 1
          ? '1 template trazido da Meta.'
          : `${dados.sincronizados ?? 0} templates trazidos da Meta.`,
      );
      router.refresh();
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Não foi possível sincronizar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Botao onClick={sincronizar} disabled={carregando}>
        {carregando ? 'Sincronizando…' : 'Sincronizar com a Meta'}
      </Botao>
      {mensagem && <span aria-live="polite" className="text-sm text-tinta-media">{mensagem}</span>}
    </div>
  );
}
