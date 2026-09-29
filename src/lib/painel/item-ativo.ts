export function itemAtivo(caminho: string, item: { href: string; caminhos?: readonly string[] }): boolean {
  return [item.href, ...(item.caminhos ?? [])].some((href) =>
    caminho === href || (href !== '/' && caminho.startsWith(`${href}/`)),
  );
}

/** Evita que /disparador esconda o destaque de /disparador/campanhas. */
export function indiceAtivo(caminho: string, itens: readonly { href: string; caminhos?: readonly string[] }[]): number {
  let indice = -1, tamanho = -1;
  itens.forEach((item, i) => {
    for (const href of [item.href, ...(item.caminhos ?? [])]) {
      if (href.length > tamanho && itemAtivo(caminho, {href})) {
        indice = i; tamanho = href.length;
      }
    }
  });
  return indice;
}
