# Disparador de WhatsApp

Um painel para disparar campanhas por WhatsApp usando a **API oficial da Meta**.
Diagnóstico da conexão, contatos com consentimento, templates, campanhas e
estimativa de custo.

O código é gratuito. **A conta da Meta, o número, o banco e a hospedagem são
seus** — não existe conta nossa no meio, e nenhuma mensagem passa por servidor
nosso.

## Publicar agora

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frafaneaime%2Fdisparador-whatsapp&project-name=disparador-whatsapp&repository-name=disparador-whatsapp&env=PANEL_PASSWORD%2CWHATSAPP_ACCESS_TOKEN%2CWHATSAPP_PHONE_NUMBER_ID%2CWHATSAPP_BUSINESS_ACCOUNT_ID&envDescription=A+senha+do+seu+painel+e+as+tr%C3%AAs+credenciais+da+sua+conta+da+Meta.+Veja+onde+achar+cada+uma+na+se%C3%A7%C3%A3o+Antes+de+clicar.&envLink=https%3A%2F%2Fgithub.com%2Frafaneaime%2Fdisparador-whatsapp%23antes-de-clicar&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%5D)

Clicar cria a sua própria cópia, hospedada na sua conta. O banco vem junto, pela
integração do Neon.

## Antes de clicar

**Crie o aplicativo na Meta primeiro.** Os três valores que o botão pede saem de
lá, e nenhum deles depende do seu site existir.

Em [developers.facebook.com/apps](https://developers.facebook.com/apps): criar
aplicativo → caso de uso **Outro** → tipo **Empresa** → produto **WhatsApp** →
**Configurar**. Depois, na tela **Configuração da API**:

| campo | onde está |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | botão **Gerar**, no alto |
| `WHATSAPP_PHONE_NUMBER_ID` | "Identificação do número de telefone" |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | "Identificação da conta do WhatsApp Business" |

Nessa mesma tela, em **Para** → **Gerenciar lista de números**, adicione o seu
próprio número e **confirme o código** que chegar no WhatsApp. Adicionar sem
confirmar não vale, e é o erro mais comum.

O quarto campo é `PANEL_PASSWORD`: a senha do seu painel. Invente uma.

## Depois do deploy

Abra o painel e entre. A tela inicial é o **diagnóstico** — ele confere a
conexão com a Meta a cada abertura e diz o próximo passo.

1. **Templates** → *Sincronizar com a Meta* — traz o `hello_world`, já aprovado
2. **Contatos** → cole o seu número e marque a confirmação
3. **Campanhas** → nova → escolha o `hello_world` → **Disparar**

A mensagem chega no seu WhatsApp.

**Depois disso, faça o token permanente.** O que você copiou vence em horas. O
[guia](https://adeus-guia.vercel.app/disparador) tem o passo a passo — parte 5 —
e também como trocar o número de teste pelo seu.

## Duas coisas que vão te pegar

**O token temporário vence em horas, não em um dia.** O que a Meta te dá no
botão *Gerar* serve para provar que funciona hoje. Para o painel continuar de
pé, crie um token permanente por usuário do sistema — está no guia, parte 5.

**A Meta decide a categoria do seu template, não você.** Você pede utilidade, ela
pode devolver marketing — e cobra pela dela, que custa cerca de seis vezes mais.
A tela de templates mostra as duas lado a lado quando divergem.

## Se preferir rodar na sua máquina

```bash
npm ci
cp .env.example .env      # preencha DATABASE_URL e PANEL_PASSWORD
npm run db:setup
npm run dev
```

O `.env.example` traz só o que este painel usa, com uma linha dizendo onde achar
cada valor no painel da Meta.

## Custos

O código não custa nada. Hospedagem, banco e **as mensagens** são cobrados pelos
respectivos provedores, na sua conta. A tela de **Tarifas** existe para você
cadastrar os preços da sua conta e ver a estimativa antes de disparar — ela
nasce vazia de propósito, porque a Meta muda a tabela de preços a cada
trimestre.

Guarde token e senha apenas nas variáveis de ambiente.
