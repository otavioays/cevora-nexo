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

## Iteração 5: pacientes e linha do tempo

- cadastro de pacientes e leads por referência interna;
- origem, responsável e estágio geral do relacionamento;
- procedimentos de interesse com estágio próprio;
- notas e eventos em linha do tempo consolidada;
- várias conversas vinculadas à mesma pessoa;
- associação e desvinculação diretamente nas telas de pacientes e conversas;
- memória comercial anonimizada entre conversas vinculadas;
- referência do cadastro mantida fora do prompt da IA;
- mutações somente por funções seguras e isolamento por RLS.

## Iteração 6: Central de Documentos

- documentos ligados obrigatoriamente ao paciente;
- tipos operacionais para receita, exame, atestado, consentimento, orientações, relatório e outros;
- arquivo privado em PDF, JPG ou PNG, com limite de 15 MB;
- links temporários de download e auditoria de acesso;
- fluxo `created`, `awaiting_signature`, `ready_to_send`, `sent`, `viewed` e `cancelled`;
- confirmação de assinatura e liberação restritas a proprietários e gestores;
- notas e histórico interno de cada mudança;
- eventos resumidos na linha do tempo do paciente;
- armazenamento privado, RLS e funções seguras.

## Iteração 7: Inteligência Documental Assistida

- classificação sugerida do tipo documental;
- análise aparente de legibilidade, corte, desfoque, reflexo, orientação e páginas incompletas;
- checklist de campos sem transcrever valores pessoais ou clínicos;
- recomendações para revisão humana, novo arquivo ou revisão especializada;
- mensagem neutra preparada para edição e cópia;
- histórico de análises ligado ao documento e ao paciente;
- suporte multimodal a PDF, JPG e PNG nos provedores;
- confirmação obrigatória de que o arquivo é fictício ou anonimizado;
- limite de 10 MB para análise por IA nesta versão;
- nenhum avanço de status, aprovação, assinatura ou validação automática.

## Stack

- Next.js com App Router e TypeScript
- React
- Supabase Auth + PostgreSQL + RLS
- Supabase Storage privado
- Gemini API com JSON Schema
- OpenAI Responses API como alternativa opcional
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
supabase/migrations/202607140008_iteration_5_patients.sql
supabase/migrations/202607140009_iteration_5_functions.sql
supabase/migrations/202607140010_iteration_6_document_center.sql
supabase/migrations/202607140011_iteration_6_functions.sql
supabase/migrations/202607140012_iteration_7_document_intelligence.sql
supabase/migrations/202607140013_iteration_7_functions.sql
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

## Privacidade e limites do MVP

O Nexo remove alguns identificadores óbvios das conversas antes de chamar o provedor, mas nomes próprios e outros dados sensíveis podem escapar da detecção. O plano gratuito do Gemini pode usar o conteúdo para melhorar produtos do Google e possui limites de uso. Portanto, não envie dados médicos identificáveis ao motor de IA nessa configuração de MVP.

Os arquivos da Central de Documentos permanecem privados no Supabase. Na Iteração 7, um arquivo só é enviado ao provedor externo quando a pessoa confirma explicitamente que ele é fictício ou foi anonimizado. Essa confirmação não torna seguro enviar dados reais identificáveis e não substitui uma configuração contratual adequada para produção.

A pré-análise não verifica autenticidade, autoria, assinatura, registro profissional, certificado, validade jurídica, conformidade ou correção clínica. Todo resultado exige revisão humana e nenhum status é alterado automaticamente.

Os estados de assinatura são controles operacionais. O Nexo ainda não aplica certificado digital, não valida ICP-Brasil e não emite receita eletrônica oficial.

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
- `docs/ITERATION_5.md`
- `docs/ITERATION_6.md`
- `docs/ITERATION_7.md`

## Próxima iteração

A Iteração 8 poderá criar uma fila operacional com tarefas, prazos, responsáveis e alertas para conversas e documentos parados.
