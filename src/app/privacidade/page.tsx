import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function PrivacidadeDisparador() {
  const email = env.emailContato();
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12 text-tinta">
      <h1 className="text-2xl font-semibold">Privacidade no disparador de WhatsApp</h1>
      {!email && <p>Falta configurar o e-mail de contato. Defina EMAIL_CONTATO nas variáveis de ambiente desta instalação.</p>}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Dados desta instalação</h2>
        <p>O operador cadastra ou importa contatos para organizar campanhas de WhatsApp. Os registros podem incluir telefone, nome, e-mail, etiquetas, consentimento e histórico de envios.</p>
        <p>Os dados ficam no banco de dados controlado pelo operador desta instalação. O envio de mensagens utiliza a API do WhatsApp da Meta.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contato com o operador</h2>
        <p>Para dúvidas sobre o uso dos seus dados, solicitar sua remoção ou deixar de receber mensagens, fale com o responsável por esta instalação: <strong>{email || '(e-mail de contato ainda não configurado)'}</strong>.</p>
      </section>
    </main>
  );
}
