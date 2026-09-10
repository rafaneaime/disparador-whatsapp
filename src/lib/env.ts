function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Confira o seu .env (use .env.example como referência).`,
    );
  }
  return value;
}

export const env = {
  igAppId: () => required('IG_APP_ID'),
  igAppSecret: () => required('IG_APP_SECRET'),
  verifyToken: () => required('VERIFY_TOKEN'),
  accessToken: () => process.env.ACCESS_TOKEN ?? '',
  databaseUrl: () => required('DATABASE_URL'),
  panelPassword: () => required('PANEL_PASSWORD'),
  // Opcional de propósito: se faltar, a página de privacidade avisa em vez de
  // quebrar. Quem instala pelo botão de deploy preenche no formulário, sem
  // precisar editar código.
  emailContato: () => (process.env.EMAIL_CONTATO ?? '').trim(),
};
