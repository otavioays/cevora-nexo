# Cevora Nexo

Copiloto comercial para atendentes de clínicas. O produto será construído em iterações curtas, cada uma entregando uma capacidade utilizável.

## Iteração 1: fundação multi-clínica

Esta versão entrega:

- cadastro, login, confirmação de e-mail e recuperação de senha;
- criação do ambiente de uma clínica;
- papéis de proprietário, gestor e atendente;
- convites por link vinculados ao e-mail;
- ativação, desativação e alteração de papel com regras de segurança;
- isolamento entre clínicas com PostgreSQL Row Level Security;
- painel inicial, equipe e configurações básicas;
- fluxo preparado para Vercel + Supabase.

A inteligência SPIN ainda não faz parte desta entrega. O motor de respostas entra na Iteração 3, depois que a Iteração 2 cadastrar o contexto comercial da clínica.

## Stack

- Next.js com App Router e TypeScript
- React
- Supabase Auth + PostgreSQL + RLS
- CSS próprio, sem dependência de kit visual
- GitHub Actions para lint, tipagem e build

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Crie um projeto no Supabase.

3. Execute a migration abaixo no SQL Editor ou via Supabase CLI:

```text
supabase/migrations/202607140001_iteration_1_schema.sql
supabase/migrations/202607140002_iteration_1_functions.sql
```

4. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

5. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
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

Isso cria uma trilha segura para administração global futura sem transformar o campo de perfil em uma porta lateral.

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
```

## Próxima iteração

A Iteração 2 adicionará o perfil comercial da clínica: procedimentos, profissionais, diferenciais, regras de agendamento, tom de voz, informações financeiras permitidas e limites do que a IA pode afirmar.
