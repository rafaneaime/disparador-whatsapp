/**
 * O nono dígito, que é onde a mesma pessoa vira duas.
 *
 * O WhatsApp guarda números brasileiros antigos **sem** o 9 depois do DDD,
 * mesmo quando a agenda, a operadora e a própria pessoa mostram com ele.
 * `5511987654321` e `551187654321` são o mesmo telefone. Numa lista de verdade
 * as duas formas convivem — vieram de cadastros feitos em épocas diferentes —,
 * e sem canonizar isso a mesma pessoa vira dois contatos e **recebe duas
 * vezes**: cobrado duas vezes na conta de quem instalou, e com uma chance a
 * mais de ser denunciado.
 *
 * A forma canônica é COM o 9, porque é o que a operadora usa hoje.
 *
 * O que separa celular antigo de fixo é o primeiro dígito do número, não o
 * tamanho: fixo começa em 2–5, celular antigo em 6–9. Acrescentar 9 a um fixo
 * criaria um número que não existe, e o envio falharia sem ninguém entender por
 * quê.
 *
 * Fora do Brasil não se adivinha nada: sem `+`, 10 ou 11 dígitos são tratados
 * como nacionais; qualquer outra coisa precisa trazer o DDI, ou volta `null`.
 * Chutar país é pior que recusar — recusar aparece na tela de importação,
 * chutar aparece como mensagem que não chegou.
 */
export function normalizarTelefone(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (!/^\+?[\d\s().-]+$/.test(texto)) return null;
  let digitos = texto.replace(/\D/g, '');
  if (!texto.startsWith('+') && (digitos.length === 10 || digitos.length === 11)) {
    digitos = `55${digitos}`;
  }

  if (digitos.startsWith('55')) {
    const nacional = digitos.slice(2);
    if (!/^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(nacional)) return null;
    // Fixo (2–5) mantém oito dígitos; celular antigo (6–9) ganha o nono.
    if (nacional.length === 10 && /^[6-9]/.test(nacional.slice(2))) {
      return `55${nacional.slice(0, 2)}9${nacional.slice(2)}`;
    }
    return digitos;
  }

  const minimo = texto.startsWith('+') ? 8 : 12;
  return /^[1-9]\d+$/.test(digitos) && digitos.length >= minimo && digitos.length <= 15
    ? digitos
    : null;
}

export function mesmaPessoa(a: unknown, b: unknown): boolean {
  const telefone = normalizarTelefone(a);
  return telefone !== null && telefone === normalizarTelefone(b);
}
