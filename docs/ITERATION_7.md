# Iteração 7 · Inteligência Documental Assistida

## Objetivo

Adicionar uma camada de pré-análise operacional aos arquivos da Central de Documentos sem transformar a IA em médica, signatária, autoridade jurídica ou mecanismo automático de liberação.

## Fluxo

1. A equipe seleciona um documento que já possui arquivo privado.
2. A análise só é habilitada após a confirmação de que o arquivo é fictício ou foi anonimizado.
3. O servidor baixa o arquivo do bucket privado e o envia diretamente ao provedor configurado.
4. Nome do paciente, referência interna, descrição, responsável e demais dados do cadastro não entram no prompt.
5. O modelo devolve um objeto estruturado.
6. Guarda-corpos locais normalizam o resultado e forçam revisão humana.
7. O resultado é salvo em histórico próprio e registrado na auditoria do documento e na linha do tempo do paciente.
8. Nenhum status é alterado automaticamente.

## Resultado estruturado

A pré-análise contém:

- tipo documental sugerido e confiança aproximada;
- qualidade visual aparente;
- alertas de corte, desfoque, reflexo, orientação e páginas incompletas;
- checklist de campos marcados como aparentemente presentes, ausentes, pouco claros ou não aplicáveis;
- recomendação operacional;
- resumo sem transcrição de dados pessoais ou clínicos;
- mensagem neutra para revisão e cópia pela equipe;
- limitações explícitas e revisão humana obrigatória.

## Guarda-corpos

A IA é instruída e corrigida localmente para nunca:

- diagnosticar ou prescrever;
- interpretar conteúdo clínico;
- transcrever nomes, documentos, contatos, medicamentos, dosagens ou resultados;
- validar identidade, registro profissional, assinatura, carimbo, certificado ou QR code;
- declarar autenticidade, validade jurídica, regularidade ou conformidade;
- aprovar envio ou alterar o status do documento.

A mensagem sugerida é substituída por uma versão neutra quando contém linguagem de aprovação, validade ou conformidade.

## Privacidade do MVP

O modo gratuito do provedor externo não deve receber dados pessoais ou de saúde identificáveis. Por isso, o botão exige uma confirmação explícita de que o arquivo é fictício ou anonimizado.

A confirmação é registrada com a análise. Arquivos acima de 10 MB não são enviados ao motor de IA nesta versão e devem seguir para revisão manual ou ser comprimidos.

## Banco de dados

A tabela `patient_document_ai_analyses` mantém:

- documento, paciente e clínica;
- usuário que solicitou a análise;
- provedor e modelo;
- confirmação de privacidade;
- resultado estruturado em JSON;
- data da análise.

Escritas diretas são bloqueadas. O registro acontece pela função `save_patient_document_ai_analysis`, que valida sessão, vínculo com a clínica, presença do arquivo e confirmação de privacidade.

## Provedores

A camada estruturada passou a aceitar anexos PDF, JPG e PNG:

- Gemini recebe o arquivo como dado inline no `generateContent`;
- OpenAI recebe PDF como `input_file` e imagens como `input_image` na Responses API.

## Fora do escopo

Esta iteração não inclui:

- OCR determinístico certificado;
- assinatura digital;
- validação ICP-Brasil;
- emissão oficial de receita;
- prontuário eletrônico;
- verificação automática de legislação;
- envio automático ao paciente;
- aprovação automática do documento.

## Migrations

```text
supabase/migrations/202607140012_iteration_7_document_intelligence.sql
supabase/migrations/202607140013_iteration_7_functions.sql
```

## Próxima iteração sugerida

A Iteração 8 poderá criar uma fila operacional com tarefas, prazos, responsáveis e alertas de documentos parados, conectando conversas, pacientes e documentos a um painel diário de execução.
