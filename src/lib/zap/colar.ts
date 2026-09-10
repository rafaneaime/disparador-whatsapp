import { normalizarTelefone } from './telefone';

export type LinhaColada =
  | { situacao: 'valido'; original: string; telefone: string }
  | { situacao: 'invalido'; original: string; motivo: string }
  | { situacao: 'repetido'; original: string; telefone: string };

export type Colagem = { linhas: LinhaColada[]; validos: string[] };

export type ResultadoColagem = {
  contagens: { validos: number; repetidos: number; invalidos: number; cadastrados: number; existentes: number };
  linhas: (LinhaColada & { resultado?: 'cadastrado' | 'existente' })[];
};

export function lerColagem(texto: unknown, teto: number): Colagem {
  const resultado: Colagem = { linhas: [], validos: [] };
  if (typeof texto !== 'string') return resultado;
  const limite = Number.isFinite(teto) ? Math.max(0, Math.floor(teto)) : 0;
  const vistos = new Set<string>();

  for (const original of texto.split(/\r\n|\n|\r/)) {
    if (!original.trim()) continue;
    if (resultado.linhas.length >= limite) {
      resultado.linhas.push({ situacao: 'invalido', original,
        motivo: `limite de ${limite} linhas; cole o restante em outra vez` });
      continue;
    }
    const telefone = normalizarTelefone(original);
    if (!telefone) {
      // Estas pistas só explicam a recusa. A validação é exclusivamente a
      // de normalizarTelefone, compartilhada com o restante do disparador.
      const digitos = original.replace(/\D/g, '');
      const motivo = /[^\d\s+().-]/.test(original) || !digitos
        ? 'não parece telefone'
        : digitos.length < 8 ? 'faltam dígitos'
          : !original.trim().startsWith('+') ? 'sem DDI e fora do padrão brasileiro'
            : 'não parece telefone; confira o DDI e os dígitos';
      resultado.linhas.push({ situacao: 'invalido', original, motivo });
    } else if (vistos.has(telefone)) {
      resultado.linhas.push({ situacao: 'repetido', original, telefone });
    } else {
      vistos.add(telefone);
      resultado.validos.push(telefone);
      resultado.linhas.push({ situacao: 'valido', original, telefone });
    }
  }
  return resultado;
}
