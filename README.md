# Cevora Nexo

Copiloto comercial para atendentes de clínicas, construído em iterações curtas que entregam capacidades utilizáveis.

## Iteração 1: fundação multi-clínica

- cadastro, login, confirmação e recuperação de acesso;
- criação do ambiente de uma clínica;
- papéis de proprietário, gestor e atendente;
- convites vinculados ao e-mail;
- isolamento entre clínicas com PostgreSQL Row Level Security;
- painel, equipe e configurações básicas.

## Iteração 2: perfil comercial

- identidade, localização, contatos e horários;
- formas de pagamento e regras de agendamento;
- procedimentos e profissionais;
- tom de voz, objetivo comercial e política de preços;
- regras com níveis de orientação, alerta e bloqueio;
- afirmações proibidas e palavras a evitar;
- perguntas frequentes e respostas aprovadas;
- consulta somente leitura para atendentes;
- indicador de completude do contexto disponível para a IA.

A inteligência SPIN entra na Iteração 3. Ela consultará o perfil comercial antes de diagnosticar a conversa, planejar o próximo movimento e redigir a resposta.

## Stack

- Next.js com App Router e TypeScript
- React
- Supabase Auth + PostgreSQL + RLS
- CSS próprio
- GitHub Actions para lint, tipagem e build
- Vercel para deploy

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Crie um projeto no Supabase.

3. Execute as migrations na ordem:

```text
supabase/migrations/202607140001_iteration_1_schema.sql
supabase/migrations/202607140002_iteration_1_functions.sql
supabase/migrations/202607140003_iteration_2_commercial_profile.sql
```

4. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

5. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICÁVEL
```

6. No Supabase Auth, adicione as URLs de redirecionamento:

```text
http://localhost:3000/auth/callback
https://SEU-DOMINIO/auth/callback
```

7. Rode o projeto:

```bash
npm run dev
```

## Primeiro administrador da plataforma

A tabela `platform_admins` não é editável pelo navegador. Depois de criar sua conta, localize seu UUID em `auth.users` e execute no SQL Editor:

```sql
insert into public.platform_admins (user_id)
values ('SEU-UUID-DE-USUARIO');
```

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
```

## Documentação das iterações

- `docs/ITERATION_1.md`
- `docs/ITERATION_2.md`

## Próxima iteração

A Iteração 3 entregará o primeiro motor utilizável por texto: diagnóstico comercial, planejamento SPIN, geração da resposta e validação contra as regras da clínica.
