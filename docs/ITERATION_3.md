# Iteração 3 · Motor SPIN por texto

## Capacidade entregue

Ao terminar esta iteração, uma atendente consegue colar uma mensagem recebida, selecionar o procedimento relacionado e adicionar contexto opcional. O Nexo consulta os dados permitidos da clínica e devolve:

1. diagnóstico comercial;
2. planejamento do próximo movimento;
3. resposta principal e alternativa;
4. validação e alertas antes do envio.

A resposta não é enviada automaticamente. A atendente permanece no controle.

## Pipeline

```text
Mensagem recebida
  ↓
Carregamento do perfil comercial da clínica
  ↓
Diagnóstico: intenção, necessidade, objeções, emoção e estágio
  ↓
Plano: objetivo, estratégia SPIN e ações a evitar
  ↓
Resposta: texto pronto, alternativa e orientação
  ↓
Validação: regras, preço, promessas e palavras proibidas
  ↓
Persistência separada no Supabase
```

## Tabelas

- `spin_interactions`: entrada original, usuário, procedimento, modelo e estado da execução;
- `spin_analyses`: leitura comercial da interação;
- `spin_plans`: decisão do próximo movimento;
- `spin_responses`: respostas e validação final.

Todas carregam `clinic_id` e possuem Row Level Security.

## Segurança

- a chave da OpenAI existe somente no servidor;
- a rota valida a sessão e deriva a clínica pelo usuário autenticado;
- o cliente não escolhe livremente um `clinic_id`;
- o procedimento selecionado precisa pertencer à clínica ativa;
- o provedor recebe `store: false`;
- mensagens são tratadas como dados, não como instruções de sistema;
- resultados são submetidos a Structured Outputs e a validações determinísticas locais.

## Variáveis

```env
OPENAI_API_KEY=SUA_CHAVE_PRIVADA
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_MODEL` é opcional. Sem ele, o sistema usa `gpt-5-mini`.

## Critérios de conclusão

- mensagem válida gera diagnóstico, plano e resposta;
- resposta pode ser copiada;
- alternativa pode ser copiada;
- política de preço e palavras proibidas geram alertas;
- falhas do provedor ficam registradas como `failed`;
- histórico recente aparece somente para membros da clínica;
- lint, tipos e build passam no CI.

## Fora desta iteração

- múltiplas mensagens em uma conversa persistente;
- leitura de prints;
- áudio;
- integração direta com WhatsApp ou Instagram;
- envio automático;
- feedback de resultado e métricas por atendente.
