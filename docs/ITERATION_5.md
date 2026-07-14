# Iteração 5 · Pacientes e linha do tempo

## Objetivo

Transformar conversas independentes em uma memória comercial organizada por pessoa. Um paciente ou lead pode ter várias conversas, interesses em diferentes procedimentos, um responsável e uma linha do tempo única.

## Entregas

- cadastro por referência interna;
- estágios `lead`, `qualified`, `scheduled`, `converted`, `inactive` e `lost`;
- origem e responsável da equipe;
- observações internas comerciais;
- procedimentos de interesse com estágio próprio;
- notas manuais na linha do tempo;
- vínculo e desvínculo de várias conversas;
- eventos automáticos para mudanças de estágio e desfechos de conversa;
- memória comercial anonimizada entre conversas da mesma pessoa;
- página dedicada de pacientes e leads;
- RLS multi-clínica e mutações somente por funções seguras.

## Regra de privacidade

A referência do cadastro, a origem, o responsável e as observações internas não são enviados ao provedor de IA. Quando uma conversa está vinculada, o motor pode receber apenas resumos comerciais anonimizados de outras conversas da mesma pessoa.

Este módulo não é prontuário. Não devem ser registrados diagnósticos, prescrições, documentos, exames ou dados clínicos sensíveis.

## Migrations

Execute nesta ordem:

```text
supabase/migrations/202607140008_iteration_5_patients.sql
supabase/migrations/202607140009_iteration_5_functions.sql
```

## Fluxo principal

1. Criar o paciente ou lead com uma referência interna.
2. Definir origem, responsável e estágio geral.
3. Associar procedimentos de interesse.
4. Vincular conversas existentes ou criar uma nova conversa já vinculada.
5. Registrar notas e acompanhar eventos na linha do tempo.
6. Usar a memória comercial de outras conversas como contexto secundário, nunca como prova de intenção atual.

## Fora desta iteração

- prontuário médico;
- receitas e documentos;
- anexos, imagens e áudios;
- integração automática com WhatsApp ou Instagram;
- agenda clínica;
- consentimentos e assinatura eletrônica.
