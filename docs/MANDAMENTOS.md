# MANDAMENTOS DO PROJETO

> **ATENÇÃO:** Este arquivo contém as regras fundamentais de processo. Deve ser seguido estritamente em todas as sessões de desenvolvimento com IA.

---

## 📜 OS MANDAMENTOS

### 1️⃣ SEMPRE SIGA O ARQUIVO DE MANDAMENTOS
- Este arquivo (`MANDAMENTOS.md`) é a fonte da verdade do processo
- Todas as decisões devem estar alinhadas com os princípios aqui definidos
- Em caso de dúvida, consulte este arquivo primeiro

### 2️⃣ MEMÓRIA PERSISTENTE E FIDELIDADE ABSOLUTA
- Sempre consulte `MEMORIA-PROJETO.md` antes de fazer mudanças
- Guarde todas as decisões importantes na memória
- Nunca desvie do que está documentado sem discussão explícita com o dono do projeto
- A memória do projeto é sagrada

### 3️⃣ DOCUMENTAÇÃO DE SESSÕES
- Cada sessão de desenvolvimento deve ser documentada em `docs/sessao-NN.md`
- O arquivo deve conter: o que foi feito, decisões tomadas, bugs corrigidos, resultado
- Ao final da sessão, adicionar o link na tabela de sessões em `MEMORIA-PROJETO.md`
- Detalhes ficam nas sessões; `MEMORIA-PROJETO.md` fica enxuto com decisões e status

### 4️⃣ DOCUMENTAÇÃO CONTÍNUA
- Toda decisão técnica relevante DEVE ser documentada em `MEMORIA-PROJETO.md`
- Todo código DEVE ter comentários explicando o "por quê", não apenas o "o quê"
- `README.md` DEVE estar sempre atualizado com setup e arquitetura atual
- Commits DEVEM ser descritivos usando Conventional Commits
- **JAMAIS** assuma que "o próximo dev vai entender"

### 5️⃣ TESTES UNITÁRIOS OBRIGATÓRIOS
- Todo novo módulo com lógica de negócio DEVE ter testes unitários
- Cobertura mínima de **95%** enforced por CI — PR é bloqueado se a cobertura cair
- Use mocks para dependências externas (APIs, browser APIs, banco de dados)
- Prefira testes que exercitem comportamento, não implementação
- Detalhes de ferramentas e configuração ficam na memória do projeto

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

### Início de cada sessão
1. Ler `MANDAMENTOS.md` (este arquivo)
2. Ler `MEMORIA-PROJETO.md`

### Durante o desenvolvimento
- Atualizar `MEMORIA-PROJETO.md` com decisões importantes
- Escrever testes junto com o código, não depois
- Manter simplicidade — evitar over-engineering

### Ao final da sessão
- Criar/atualizar `docs/sessao-NN.md` com o que foi feito
- Atualizar tabela de sessões em `MEMORIA-PROJETO.md`

### A cada commit/PR
- Commits descritivos com Conventional Commits
- PRs com descrição clara do que muda e por quê
- Garantir que CI passa antes de solicitar review

---

## 🧭 PRINCÍPIOS UNIVERSAIS

### Simplicidade primeiro
- MVP focado e funcional antes de features extras
- Três linhas similares são melhores que uma abstração prematura
- Só adicione complexidade quando o problema exigir

### Código para humanos
- Escreva para o dev que lerá isso daqui 6 meses
- Documente o "por quê", não o "o quê" — o código já diz o quê
- Decisões não-óbvias merecem comentário no próprio código

### CI como guardião
- Nenhum código quebrado chega ao `main`
- Build, testes e coverage são gates obrigatórios
- Falha no CI é sinal a investigar, não inconveniência a ignorar

---

**Última atualização:** 2026-03-01
**Versão:** 3.0
