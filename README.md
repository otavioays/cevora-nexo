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

## Iteração 3: motor SPIN por texto

- entrada manual da mensagem do paciente;
- procedimento e contexto adicional opcionais;
- diagnóstico comercial antes da escrita;
- identificação de estágio da interação e movimento SPIN;
- planejamento explícito do próximo objetivo;
- resposta principal e alternativa;
- explicação estratégica e próximo passo esperado;
- validação contra preço, promessas e palavras proibidas;
- persistência separada de interação, diagnóstico, plano e resposta;
- Gemini gratuito como provedor padrão e OpenAI como alternativa opcional;
- remoção local de e-mail, telefone, CPF, CNPJ e links antes da chamada externa.

## Iteração 4: conversas com memória

- criação de conversas por referência interna;
- canal e procedimento associados;
- linha do tempo de mensagens recebidas e respostas enviadas;
- rascunhos gerados separados do histórico confirmado;
- edição da resposta antes da confirmação;
- memória acumulada de necessidades, objeções, emoção e estágio SPIN;
- atualização do próximo objetivo a cada nova mensagem;
- desfechos `open`, `won`, `lost` e `archived`;
- funções atômicas para criação, análise, confirmação de envio e encerramento;
- isolamento multi-clínica preservado por RLS.

## Stack

- Next.js com App Router e TypeScript
- React
- Supabase Auth + PostgreSQL + RLS
- Gemini API com JSON Schema
- camada substituível de provedores de IA
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
supabase/migrations/202607140004_iteration_3_spin_engine.sql
supabase/migrations/202607140005_iteration_3_functions.sql
supabase/migrations/202607140006_iteration_4_conversations.sql
supabase/migrations/202607140007_iteration_4_functions.sql
```

4. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

5. Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICÁVEL
AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE_PRIVADA_DO_GEMINI
GEMINI_MODEL=gemini-3.5-flash
```

As chaves de IA são usadas somente em rotas do servidor. Nunca use o prefixo `NEXT_PUBLIC_` nelas.

Para usar OpenAI posteriormente:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=SUA_CHAVE_PRIVADA_DA_OPENAI
OPENAI_MODEL=gpt-5-mini
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

## Privacidade no modo gratuito

O Nexo remove alguns identificadores óbvios antes de chamar o provedor, mas nomes próprios e outros dados sensíveis podem escapar da detecção. O plano gratuito do Gemini pode usar o conteúdo para melhorar produtos do Google e possui limites de uso. Portanto, não envie dados médicos identificáveis nessa configuração de MVP.

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
- `docs/ITERATION_3.md`
- `docs/ITERATION_4.md`

## Próxima iteração

A Iteração 5 adicionará cadastro operacional de contatos e pacientes, responsáveis, origem do lead e uma linha do tempo unificada para tarefas e documentos.
