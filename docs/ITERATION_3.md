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
Remoção local de e-mail, telefone, CPF, CNPJ e links
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

## Provedores de IA

O motor usa uma camada substituível de provedores:

- `gemini`: padrão atual, adequado ao MVP no plano gratuito;
- `openai`: alternativa opcional para operação paga.

A troca é feita por variável de ambiente e não exige alterar o motor SPIN ou o banco de dados. O plano gratuito possui limites de requisições; quando eles forem atingidos, o Nexo informa a atendente para tentar novamente mais tarde.

## Tabelas

- `spin_interactions`: entrada original, usuário, procedimento, modelo e estado da execução;
- `spin_analyses`: leitura comercial da interação;
- `spin_plans`: decisão do próximo movimento;
- `spin_responses`: respostas e validação final.

Todas carregam `clinic_id` e possuem Row Level Security.

## Segurança e privacidade

- as chaves dos provedores existem somente no servidor;
- a rota valida a sessão e deriva a clínica pelo usuário autenticado;
- o cliente não escolhe livremente um `clinic_id`;
- o procedimento selecionado precisa pertencer à clínica ativa;
- e-mails, telefones, CPF, CNPJ e links são removidos antes da chamada externa;
- mensagens são tratadas como dados, não como instruções de sistema;
- resultados usam JSON Schema e passam por validações determinísticas locais;
- nomes próprios e outros identificadores difíceis de detectar automaticamente não devem ser enviados.

No plano gratuito do Gemini, o conteúdo pode ser usado pelo Google para melhorar seus produtos. Por isso, esta configuração serve para validação do MVP e não deve receber dados médicos identificáveis.

## Variáveis

### Gemini gratuito, padrão

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=SUA_CHAVE_PRIVADA
GEMINI_MODEL=gemini-3.5-flash
```

`AI_PROVIDER` e `GEMINI_MODEL` são opcionais. Sem eles, o sistema usa Gemini e `gemini-3.5-flash`.

### OpenAI opcional

```env
AI_PROVIDER=openai
OPENAI_API_KEY=SUA_CHAVE_PRIVADA
OPENAI_MODEL=gpt-5-mini
```

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
