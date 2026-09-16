import type { ReactNode } from 'react';
import { IconeChave, IconePessoas, IconeMegafone, IconeGlobo, IconeCarrinho } from './icones';

export type LinkDoPainel = {
  href: string;
  label: string;
  icone: ReactNode;
};

export const LINKS_DO_PAINEL: readonly LinkDoPainel[] = [
  { href: '/disparador', label: 'Diagnóstico', icone: <IconeChave /> },
  { href: '/disparador/contatos', label: 'Contatos', icone: <IconePessoas /> },
  { href: '/disparador/campanhas', label: 'Campanhas', icone: <IconeMegafone /> },
  { href: '/disparador/templates', label: 'Templates', icone: <IconeGlobo /> },
  { href: '/disparador/tarifas', label: 'Tarifas', icone: <IconeCarrinho /> },
];

export type ConviteDeUpgrade = { href: string; label: string };

/** Produto gratuito do Fluxo: sai sem oferta, por decisão. */
export const CONVITE_DE_UPGRADE: ConviteDeUpgrade | null = null;
