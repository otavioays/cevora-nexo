# Iteração 1 · Fundação, acesso e separação das clínicas

## Resultado prático

Ao finalizar esta iteração, uma clínica consegue criar seu ambiente, entrar com usuários individuais, convidar a equipe e restringir ações por papel. Duas clínicas cadastradas não conseguem consultar dados uma da outra, mesmo tentando acessar o banco diretamente com a chave pública.

## Fluxos entregues

### Proprietário

1. Cria uma conta.
2. Confirma o e-mail.
3. Cria a clínica no onboarding.
4. Torna-se proprietário automaticamente.
5. Gera convites para gestores ou atendentes.
6. Altera papéis e desativa acessos sem remover o histórico.

### Pessoa convidada

1. Recebe um link vinculado ao próprio e-mail.
2. Cria conta ou entra em uma conta existente.
3. O sistema confere se o e-mail autenticado corresponde ao convite.
4. Aceita o convite.
5. Passa a enxergar somente o ambiente daquela clínica.

### Atendente

- entra com acesso individual;
- visualiza o painel e a equipe;
- não altera membros, convites ou configurações administrativas.

### Gestor

- convida e administra atendentes;
- não transforma pessoas em proprietários;
- não administra proprietários ou outros gestores.

### Proprietário

- administra todos os papéis;
- não pode desativar a si mesmo;
- não pode remover o último proprietário ativo da clínica.

## Segurança

O isolamento usa Row Level Security no PostgreSQL. A interface não é a fronteira de segurança. Mesmo uma requisição manual precisa satisfazer as políticas do banco.

As alterações mais sensíveis são executadas por funções RPC que validam:

- identidade autenticada;
- vínculo com a clínica;
- papel do usuário que executa a ação;
- papel do membro afetado;
- preservação de pelo menos um proprietário ativo;
- correspondência entre convite e e-mail autenticado.

## Critérios de aceite

- [ ] Usuário cria conta, confirma e entra.
- [ ] Usuário sem clínica é levado ao onboarding.
- [ ] Criação da clínica registra o usuário como proprietário.
- [ ] Proprietário gera link de convite.
- [ ] Convite só pode ser aceito pelo e-mail correto.
- [ ] Atendente não consegue criar convites.
- [ ] Gestor não consegue administrar proprietários ou gestores.
- [ ] Último proprietário não pode ser desativado ou rebaixado.
- [ ] Clínica A não consulta registros da Clínica B.
- [ ] Build, lint e typecheck passam no CI.
