# Iteração 9 · Ambientes por Função e Encaminhamento Médico

## Objetivo

Separar execução de atendimento, revisão médica e administração sem criar contas compartilhadas nem depender apenas de botões escondidos.

## Modelo de acesso

O acesso administrativo continua definido por `owner`, `manager` e membro. Uma segunda dimensão, `operational_role`, define onde a pessoa trabalha:

- `attendant`: ambiente de Atendimento;
- `doctor`: ambiente Médico;
- `administrative`: função administrativa sem identidade médica.

Um proprietário ou gestor pode também receber a função `doctor` e alternar entre Gestão e Médico.

## Ambientes

### Atendimento

Mostra tarefas próprias, conversas, pacientes, documentos e encaminhamentos. Configurações, equipe e perfil comercial não aparecem e suas rotas exigem papel de gestão.

### Médico

Mostra encaminhamentos atribuídos, documentos relacionados, pacientes encaminhados e tarefas. O médico pode iniciar revisão, devolver com orientação, aprovar operacionalmente ou registrar que uma assinatura ocorreu.

### Gestão

Mostra a operação completa, equipe, configuração de funções, perfil comercial e configurações da clínica.

## Encaminhamento médico

Um encaminhamento contém paciente obrigatório, médico responsável, título operacional, contexto, prioridade, prazo e vínculos opcionais com documento e conversa.

Estados:

- `pending`;
- `in_review`;
- `returned`;
- `approved_operationally`;
- `signed`;
- `cancelled`.

A gestão visualiza todos os encaminhamentos. Solicitante, médico atribuído e responsável pelo retorno visualizam somente os registros relacionados a eles.

## Guarda-corpos

- aprovação operacional não representa correção clínica;
- o estado `signed` apenas registra que uma pessoa confirmou a assinatura no fluxo;
- o Nexo não aplica certificado digital nesta iteração;
- encaminhamentos não substituem prontuário;
- a tela não diagnostica, prescreve nem valida conformidade jurídica;
- todas as mudanças passam por funções seguras e são auditadas.

## Ativação

Execute na ordem:

```text
supabase/migrations/202607150016_iteration_9_role_workspaces.sql
supabase/migrations/202607150017_iteration_9_functions.sql
```

Depois configure ao menos um profissional ativo e vincule um membro da equipe à função Médico.

## Verificação manual

1. Entre como proprietário ou gestor.
2. Abra Equipe e defina um membro como Médico, vinculando o profissional correspondente.
3. Confirme que esse usuário possui o ambiente Médico.
4. Entre pelo ambiente de Atendimento e crie um encaminhamento fictício.
5. Entre como médico, inicie a revisão e devolva uma orientação.
6. Volte ao solicitante e confirme que o retorno aparece.
7. Verifique o histórico do encaminhamento e a linha do tempo do paciente.

## Próxima iteração sugerida

SLAs configuráveis por tipo de trabalho, modelos de tarefas, lembretes e métricas de tempo entre solicitação, primeira ação, devolução e conclusão.
