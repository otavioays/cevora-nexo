# Iteração 6 · Central de Documentos do Paciente

## Objetivo

Conectar documentos operacionais ao paciente sem misturar o cadastro comercial, o arquivo privado e o histórico de auditoria.

## Entregas

- central única de documentos da clínica;
- vínculo obrigatório com paciente ou lead;
- tipos de documento: receita/prescrição, solicitação de exame, atestado, consentimento, orientações, relatório e outros;
- profissional, procedimento e responsável opcionais;
- upload privado de PDF, JPG e PNG com limite de 15 MB;
- download por URL assinada com duração de 60 segundos;
- registro de cada acesso ao arquivo;
- estados `created`, `awaiting_signature`, `ready_to_send`, `sent`, `viewed` e `cancelled`;
- notas internas e histórico imutável de mudanças;
- eventos resumidos na linha do tempo do paciente;
- isolamento entre clínicas por RLS;
- mutações feitas somente por funções `security definer` com validação de equipe e transições.

## Fluxo

```text
Criado
├── Aguardando assinatura
│   ├── Pronto para envio
│   └── Voltar para correção
├── Pronto para envio
│   ├── Enviado
│   └── Voltar para correção
└── Cancelado

Enviado
└── Visualizado
```

O documento precisa possuir arquivo antes de entrar em assinatura, liberação ou envio.

## Permissões

Todos os membros ativos podem:

- criar documentos;
- anexar o primeiro arquivo;
- solicitar assinatura;
- marcar um documento pronto como enviado;
- confirmar visualização;
- adicionar notas;
- abrir arquivos aos quais a clínica possui acesso.

Somente proprietários e gestores podem:

- confirmar que um documento está pronto para envio;
- confirmar assinatura;
- devolver o documento para correção;
- cancelar documentos;
- remover objetos diretamente do bucket privado.

## Armazenamento

O bucket `patient-documents` é privado. Os caminhos seguem:

```text
<clinic_id>/<patient_id>/<document_id>/<uuid>-<arquivo>
```

As políticas do Storage verificam o primeiro segmento do caminho contra as clínicas ativas do usuário.

## Limite jurídico e clínico

Esta iteração controla o fluxo interno. Ela não:

- aplica certificado digital;
- valida assinatura ICP-Brasil;
- emite receita eletrônica oficial;
- substitui prontuário;
- interpreta o conteúdo do documento;
- envia o arquivo automaticamente ao paciente.

Os estados “aguardando assinatura” e “pronto para envio” são confirmações operacionais feitas pela equipe.

## Ativação

Execute em ordem:

```text
supabase/migrations/202607140010_iteration_6_document_center.sql
supabase/migrations/202607140011_iteration_6_functions.sql
```

Depois publique a aplicação.

## Próxima iteração

A Iteração 7 adicionará inteligência documental: classificação, alerta de foto/scan, checagem aparente de campos e preparação da mensagem de envio, sem permitir que a IA assine, prescreva ou declare validade do documento.