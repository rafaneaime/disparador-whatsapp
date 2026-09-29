import { timingSafeEqual } from 'node:crypto';

/**
 * A rotina agendada continua rodando em quem nunca ouviu falar de CRON_SECRET.
 *
 * Exigir a variável fechava a porta: sem ela, as rotas respondiam 503, o
 * agendamento falhava, e a renovação do token do Instagram parava — em
 * silêncio, semanas depois, em toda instalação feita pelo guia, que não pede
 * essa variável em passo nenhum. Foi o que aconteceu com o painel da Amanda.
 *
 * Então: quem define o segredo ganha a porta trancada; quem não define
 * continua como antes, e o painel segue recomendando na tela de saúde. É a
 * mesma regra que valia antes do endurecimento, e a escolha é deliberada — o
 * que estas rotas fazem sem segredo é renovar um token que já é nosso e
 * recalcular pontuação, não vazar nem apagar nada.
 */
export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return null;
  const received = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  return null;
}
