# Iteração 4 · Conversas com memória comercial

## Capacidade entregue

A Iteração 4 transforma análises independentes em conversas persistentes. Cada conversa mantém uma linha do tempo confirmada, o estado comercial acumulado e o próximo movimento recomendado.

## Regra central de memória

Uma resposta gerada pela IA começa como `draft`.

Ela só passa a fazer parte do histórico consultado pela próxima análise quando a atendente:

1. revisa ou edita o texto;
2. envia pelo canal real;
3. marca a resposta como enviada no Nexo.

Isso impede que a IA trate como fato uma mensagem que nunca chegou ao contato.

## Fluxo

```text
Criar conversa
  ↓
Registrar mensagem recebida
  ↓
Consultar histórico confirmado + estado acumulado
  ↓
Gerar diagnóstico, plano e rascunho
  ↓
Atendente revisa
  ↓
Marcar como enviada
  ↓
Resposta entra na memória da próxima análise
```

## Estruturas novas

### `sales_conversations`

Guarda:

- clínica;
- referência interna do contato;
- canal;
- procedimento;
- status da conversa;
- etapa da interação;
- etapa SPIN;
- resumo acumulado;
- necessidades explícitas e implícitas;
- objeções;
- estado emocional;
- informações ausentes;
- risco;
- próximo objetivo;
- estratégia recomendada.

### `conversation_messages`

Guarda:

- conversa;
- direção da mensagem;
- conteúdo;
- estado `received`, `draft` ou `sent`;
- interação que originou a mensagem;
- usuário responsável;
- horário de envio confirmado.

## Estados da conversa

- `open`: atendimento em andamento;
- `won`: conversa convertida;
- `lost`: encerrada sem conversão;
- `archived`: retirada da fila ativa.

## Funções atômicas

- `create_sales_conversation`;
- `start_conversation_turn`;
- `complete_conversation_turn`;
- `mark_conversation_message_sent`;
- `update_sales_conversation_status`.

Todas verificam autenticação e vínculo com a clínica antes de alterar dados.

## Segurança e isolamento

- todas as estruturas carregam `clinic_id`;
- leitura protegida por Row Level Security;
- escritas diretas revogadas;
- mutações passam por funções `security definer` com verificações explícitas;
- respostas não confirmadas ficam fora do histórico enviado ao modelo;
- identificadores óbvios continuam sendo removidos antes da chamada externa.

## Critérios de conclusão

- criar uma conversa por referência interna;
- selecionar canal e procedimento;
- registrar várias mensagens recebidas;
- analisar cada turno usando o histórico confirmado;
- editar o rascunho sugerido;
- marcar o texto como enviado;
- impedir que rascunhos entrem prematuramente na memória;
- atualizar o estado comercial acumulado;
- marcar conversa como aberta, convertida, perdida ou arquivada;
- manter isolamento entre clínicas;
- passar lint, tipagem e build.

## Fora desta iteração

- integração automática com WhatsApp ou Instagram;
- captura automática de mensagens;
- cadastro clínico completo de pacientes;
- anexos, áudios e imagens;
- Central de Documentos do Paciente;
- métricas avançadas de conversão por atendente.
