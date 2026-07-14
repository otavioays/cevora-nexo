# Iteração 2 · Perfil comercial da clínica

## Capacidade entregue

Ao final desta iteração, cada clínica possui uma fonte de verdade própria para orientar a futura inteligência comercial. Proprietários e gestores podem estruturar o contexto; atendentes podem consultá-lo.

## Dados cadastráveis

- descrição, localização, contatos e horários;
- formas de pagamento e regras de agendamento;
- tom de voz, objetivo principal e política de preços;
- afirmações proibidas, palavras a evitar e instruções adicionais;
- procedimentos e critérios de exposição de preço;
- profissionais, especialidades e diferenciais;
- regras operacionais com severidade de orientação, alerta ou bloqueio;
- perguntas frequentes com respostas factuais aprovadas;
- exemplos de respostas aprovadas pela clínica.

## Segurança

Todas as tabelas carregam `clinic_id` e usam Row Level Security.

- membros ativos podem consultar os dados da própria clínica;
- proprietários e gestores podem inserir, editar, ativar, desativar e excluir;
- atendentes não recebem permissão de escrita;
- referências entre FAQ, resposta e procedimento preservam o vínculo da mesma clínica.

## Interface

A página `/app/perfil-comercial` oferece:

- indicador de completude;
- formulário central de identidade e operação;
- catálogo de procedimentos;
- cadastro de profissionais;
- regras e limites;
- FAQs;
- respostas aprovadas;
- estados ativos e inativos;
- comportamento somente leitura para atendentes.

## Ativação no Supabase

Execute depois das migrations da Iteração 1:

```text
supabase/migrations/202607140003_iteration_2_commercial_profile.sql
```

## Critério de conclusão

A iteração está validada quando um proprietário consegue:

1. salvar o perfil da clínica;
2. cadastrar ao menos um procedimento e um profissional;
3. registrar uma regra, uma FAQ e uma resposta aprovada;
4. recarregar a página e encontrar os dados persistidos;
5. confirmar que um atendente consegue ler, mas não alterar o conteúdo.

## Próxima iteração

A Iteração 3 usará esse contexto em três etapas separadas: diagnóstico da conversa, planejamento do próximo movimento SPIN e geração da resposta.
