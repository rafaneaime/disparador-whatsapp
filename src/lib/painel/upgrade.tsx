'use client';

import { useId, useRef, useState } from 'react';

// Somente conteúdo demonstrativo: não importa serviços nem dados do Radar.
const RECURSOS = [
  { nome: 'Radar de oportunidades', simbolo: '◎', titulo: 'Saiba com quem falar agora', descricao: 'Encontre quem chegou ao checkout, voltou ao site ou demonstrou mais interesse. Organize seus próximos contatos.', exemplos: ['Ana · Chegou ao checkout', 'Bruno · Voltou ao site', 'Carla · Clicou na oferta'], tipo: 'lista' },
  { nome: 'Funis de vendas', simbolo: '▥', titulo: 'Veja a jornada até a compra', descricao: 'Personalize as etapas de cada produto e acompanhe os eventos registrados, com upsell opcional e histórico preservado.', exemplos: ['Comentou', 'Visitou o site', 'Checkout', 'Comprou'], tipo: 'funil' },
  { nome: 'Temperatura dos leads', simbolo: '♨', titulo: 'Reconheça os contatos mais interessados', descricao: 'Priorize pessoas pelos sinais de interesse e entenda os motivos da temperatura. Temperatura não é uma probabilidade de compra.', exemplos: ['Ana · Quente 🔥', 'Bruno · Esquentando', 'Carla · Primeiro contato'], tipo: 'lista' },
  { nome: 'Ficha e histórico', simbolo: '◉', titulo: 'Tenha contexto antes de conversar', descricao: 'Reúna a jornada, anotações e retornos. Abra Instagram ou WhatsApp quando o contato tiver esses dados disponíveis.', exemplos: ['Visitou a página do produto', 'Nota: prefere conversar à tarde', 'Próxima ação: retomar o contato'], tipo: 'lista' },
  { nome: 'Segmentos e audiência', simbolo: '◷', titulo: 'Encontre o público de cada ação', descricao: 'Agrupe contatos por regras e acompanhe sua audiência para preparar abordagens mais relevantes.', exemplos: ['Interessados no produto', 'Contatos que voltaram', 'Pessoas que já compraram'], tipo: 'lista' },
  { nome: 'Vendas e produtos', simbolo: '↗', titulo: 'Conecte interesse e resultado', descricao: 'Acompanhe compras e produtos com a integração Hotmart. Consulte as evidências disponíveis de origem das vendas.', exemplos: ['Produto: Curso de fotografia', 'Compra registrada pela Hotmart', 'Jornada disponível no contato'], tipo: 'lista' },
  { nome: 'Campanhas de WhatsApp', simbolo: '✉', titulo: 'Prepare uma abordagem com template', descricao: 'Prepare campanhas com templates aprovados e revise antes de enviar. Requer número habilitado na API oficial e consentimento; tarifas da Meta podem se aplicar.', exemplos: ['Selecionar template aprovado', 'Revisar público e consentimento', 'Confirmar o envio no Disparador'], tipo: 'lista' },
  { nome: 'Sites e integrações', simbolo: '⊕', titulo: 'Traga os sinais do site para o Radar', descricao: 'Conecte visitas, cliques e checkout à jornada. Configure sites rastreados e chaves de API conforme suas integrações.', exemplos: ['Site conectado', 'Visita registrada', 'Clique no checkout identificado'], tipo: 'lista' },
] as const;

export function Cadeado() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

export function RecursosRadar({ href, compacto = false }: { href: string; compacto?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descricaoId = useId();
  const [indice, setIndice] = useState(0);
  const recurso = RECURSOS[indice];
  function abrir(i: number) {
    setIndice(i);
    dialog.current?.showModal();
  }
  return <>
    <section className={compacto ? 'upgrade-menu' : 'upgrade-vitrine'} aria-label="Recursos disponíveis no Radar">
      {compacto ? <p className="upgrade-legenda">Explore o Radar</p> : <div className="upgrade-intro">
        <div><span className="upgrade-selo">Seu próximo passo</span><h2>Da conversa à oportunidade de venda.</h2><p>O MeuChat inicia a conversa. Com o Radar, você acompanha o interesse e decide com quem falar depois.</p></div>
        <a className="upgrade-cta" href={href} target="_blank" rel="noopener noreferrer">Conhecer o upgrade</a>
      </div>}
      <div className={compacto ? 'upgrade-links' : 'upgrade-grade'}>
        {RECURSOS.map((item, i) => <button type="button" key={item.nome} onClick={() => abrir(i)} aria-haspopup="dialog" aria-label={`${item.nome} — bloqueado, ver prévia do Radar`}>
          <span className="upgrade-icone" aria-hidden="true">{item.simbolo}</span><span className="upgrade-nome">{item.nome}{!compacto && <small>{item.titulo}</small>}</span><span className="upgrade-trava"><Cadeado/>{!compacto && 'Radar'}</span>
        </button>)}
      </div>
      {!compacto && <p className="upgrade-rodape">Recursos exclusivos do Radar. Clique para ver uma demonstração. Suas automações do MeuChat continuam disponíveis.</p>}
    </section>
    <dialog ref={dialog} className="upgrade-dialog" aria-labelledby={tituloId} aria-describedby={descricaoId} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="upgrade-dialog-conteudo">
        <div className="upgrade-dialog-topo"><span className="upgrade-selo"><Cadeado/> Exclusivo do Radar</span><button type="button" className="upgrade-fechar" onClick={() => dialog.current?.close()} aria-label="Fechar prévia" autoFocus>Fechar ×</button></div>
        <h2 id={tituloId}>{recurso.titulo}</h2><p id={descricaoId}>{recurso.descricao}</p>
        <div className="upgrade-demo"><p className="upgrade-demo-aviso">Demonstração · Dados fictícios</p>
          <div className={recurso.tipo === 'funil' ? 'upgrade-demo-funil' : 'upgrade-demo-lista'}>{recurso.exemplos.map((exemplo, i) => <div key={exemplo}><span className="upgrade-demo-marca" aria-hidden="true">{recurso.tipo === 'funil' ? i + 1 : '•'}</span><span>{exemplo}</span>{recurso.tipo === 'funil' && <small>{['Ana', 'Bruno', 'Carla', 'Daniel'][i]}</small>}</div>)}</div>
        </div>
        <div className="upgrade-dialog-final"><a className="upgrade-cta" href={href} target="_blank" rel="noopener noreferrer">Desbloquear no Radar</a><span>Abre a página do upgrade. Nenhuma compra é feita aqui.</span></div>
      </div>
    </dialog>
  </>;
}
