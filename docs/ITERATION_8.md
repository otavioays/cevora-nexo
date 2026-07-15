# Iteração 8 · Fila Operacional e Alertas de Pendência

## Objetivo

Transformar pendências dispersas em trabalho explícito. A clínica passa a enxergar o que precisa acontecer, quem é responsável, qual é o prazo e quais conversas ou documentos estão parados.

## Entregas

- tarefas manuais ligadas opcionalmente a paciente, conversa e documento;
- responsável, prioridade, prazo e status;
- filtros para tarefas ativas, próprias, atrasadas, concluídas e todas;
- estados `open`, `in_progress`, `completed` e `cancelled`;
- cancelamento e reabertura de canceladas restritos a proprietário e gestor;
- notas e histórico auditável de alterações;
- eventos resumidos na linha do tempo do paciente quando existe vínculo;
- radar de conversas abertas sem atividade há mais de 24 horas;
- radar de documentos pendentes sem avanço há mais de 24 horas;
- prioridade alta após 24 horas e urgente após 72 horas;
- transformação explícita de um alerta em tarefa;
- prevenção de tarefas ativas duplicadas ao assumir o mesmo alerta;
- isolamento entre clínicas com RLS e mutações somente por funções seguras.

## Princípio do radar

O radar não cria tarefas automaticamente. Ele mostra situações que podem exigir atenção. Uma pessoa da equipe decide se o alerta deve entrar na fila e, ao assumir o item, torna-se responsável com prazo inicial de 24 horas.

## Vínculos

Uma tarefa pode ser geral ou estar ligada a:

- um paciente ou lead;
- uma conversa comercial;
- um documento;
- uma combinação coerente desses itens.

O banco valida que todos os vínculos pertencem à mesma clínica. Quando uma conversa ou documento já possui paciente, esse vínculo é herdado pela tarefa.

## Auditoria

A trilha registra:

- criação;
- edição de título, descrição, responsável, prioridade ou prazo;
- mudança de status;
- notas internas;
- autor e horário de cada evento.

## Migrations

```text
supabase/migrations/202607140014_iteration_8_operational_queue.sql
supabase/migrations/202607140015_iteration_8_functions.sql
```

## Limites desta etapa

- não existe cron externo nem notificação push;
- o radar é calculado quando a página ou o painel são carregados;
- o limite de 24 horas é fixo nesta versão;
- alertas não representam urgência clínica;
- a fila não substitui agenda médica, prontuário ou sistema de emergência.

## Próxima evolução possível

A próxima iteração pode adicionar regras configuráveis de SLA, lembretes por horário, modelos de tarefa e métricas de tempo até primeira resposta, conclusão e conversão.
