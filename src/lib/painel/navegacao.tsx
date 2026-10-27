import type { ReactNode } from 'react';
import { IconeChave, IconePessoas, IconeMegafone, IconeGlobo, IconeCarrinho } from './icones';

export type LinkDoPainel = {
  href: string;
  label: string;
  icone: ReactNode;
  caminhos?: readonly string[];
};

export const LINKS_DO_PAINEL: readonly LinkDoPainel[] = [
  { href: '/disparador', label: 'Diagnóstico', icone: <IconeChave /> },
  { href: '/disparador/contatos', label: 'Contatos', icone: <IconePessoas /> },
  { href: '/disparador/campanhas', label: 'Campanhas', icone: <IconeMegafone /> },
  { href: '/disparador/templates', label: 'Templates', icone: <IconeGlobo /> },
  { href: '/disparador/tarifas', label: 'Tarifas', icone: <IconeCarrinho /> },
];

export type ConviteDeUpgrade = { href: string; label: string };
export const NOME_DO_PAINEL = 'Disparador';

/** Produto gratuito do Fluxo: sai sem oferta, por decisão. */
export const CONVITE_DE_UPGRADE: ConviteDeUpgrade | null = null;

/** O guia do disparador é aberto: ele é dado de graça numa palestra. */
export const COMO_ATUALIZAR = 'https://adeus-guia.vercel.app/disparador';

/**
 * Onde a instalação pergunta qual é a versão mais nova.
 *
 * O disparador tem publicacao propria: comparar com a base diria "saiu versao
 * nova" toda vez que o MEUCHAT mudasse, sem nada ter mudado aqui.
 */
export const ONDE_CONFERIR_VERSAO =
  'https://raw.githubusercontent.com/rafaneaime/disparador-whatsapp/main/versao.json';
