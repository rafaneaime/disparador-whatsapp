import { timingSafeEqual } from 'node:crypto';

export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado. Defina a variável no deploy para ativar os agendamentos.' },
      { status: 503 },
    );
  }
  const received = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  return null;
}
