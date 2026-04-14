# CLAUDE.md — AuraFetch

## 1. MODO DE TRABALHO

- Uma tarefa por vez
- Confirmar abordagem antes de codar
- Mexer apenas no necessário, nunca refatorar além do pedido
- Perguntar antes de assumir
- Entregar arquivo completo, nunca trechos
- Não adicionar comentários em código não modificado
- **Nunca fazer commit automaticamente** — o usuário controla quando commitar
- Não adicionar emojis em código ou respostas (exceto se pedido)
- Respostas curtas e diretas, sem resumos ao final

## 2. INÍCIO DE SESSÃO

Ao iniciar qualquer sessão de desenvolvimento, ler obrigatoriamente:

1. `docs/PROJECT_OVERVIEW.md` — O que é o projeto, estado atual, decisões tomadas
2. `docs/ARCHITECTURE.md` — Como o código está organizado, mapa do monolito
3. `docs/TASKS.md` — O que já foi feito, o que está em andamento, o que falta

## 3. SKILLS OBRIGATÓRIAS

| Situação | Skill |
|----------|-------|
| Nova feature ou regra de negócio | `superpowers:brainstorming` |
| Tarefa com mais de 2 arquivos | `superpowers:writing-plans` |
| Executar um plano existente | `superpowers:executing-plans` |
| Tarefas independentes paralelizáveis | `superpowers:subagent-driven-development` |
| Bug ou comportamento inesperado | `superpowers:systematic-debugging` |
| Antes de declarar trabalho concluído | `superpowers:verification-before-completion` |
| Trabalho em frontend/UI | `frontend-design:frontend-design` |
| Implementar feature ou bugfix | `superpowers:test-driven-development` |

## 4. STACK DO PROJETO

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Desktop runtime | Tauri 2 (Rust) | 2.x |
| Frontend | React | 19.2 |
| Linguagem | TypeScript | 5.9 |
| Bundler | Vite | 7.3 |
| Editor de código | CodeMirror 6 | 6.x |
| Ícones | Lucide React | 0.575 |
| Testes E2E | Cypress | 15.11 |
| Versionamento | standard-version | 9.5 |

## 5. ESTRUTURA DE ARQUIVOS

```
AuraFetch/
├── src/
│   ├── App.tsx              # Monolito principal (~3.940 linhas)
│   ├── App.css              # Estilos do App
│   ├── main.tsx             # Entry point — ErrorBoundary envolve <App/>
│   └── index.css            # Estilos globais
├── src-tauri/               # Backend Rust (Tauri 2)
│   ├── src/lib.rs           # Plugins: http, dialog, fs, websocket
│   ├── tauri.conf.json      # Config: nome, versão, janela, CSP
│   └── capabilities/        # Permissões Tauri
├── cypress/
│   ├── e2e/                 # 10 spec files, 121 testes
│   ├── fixtures/            # Arquivos de teste
│   └── tasks/               # Geração de arquivos grandes em runtime
├── docs/
│   ├── PROJECT_OVERVIEW.md  # Resumo do projeto
│   ├── ARCHITECTURE.md      # Arquitetura técnica
│   └── TASKS.md             # Backlog e progresso
└── .claude/commands/        # Comandos customizados
```

## 6. PERSISTÊNCIA

| Dado | Chave localStorage |
|------|-------------------|
| Coleções (principal) | `aurafetch_collection_v2` |
| Variáveis globais | `aurafetch_globals` |
| Environments | `aurafetch_envs` |
| Environment ativo | `aurafetch_env_active` |

Sem banco de dados. Tudo em localStorage.

## 7. REGRAS DA UI

- Interface em **português brasileiro**
- Body type labels: `type.toUpperCase()` (ex: "BINARY", "FORM-DATA")
- Tabs: "Ambientes", "Variáveis Globais"
- Placeholders: `admin`, `••••••`, `x-api-key`, `A8F90x...`
- Toda funcionalidade Tauri precisa de guard `isTauri()` com fallback para browser
- API de scripts é contrato: `aurafetch.setEnv()`, `aurafetch.setVar()`, `aurafetch.log()` não podem quebrar

## 8. O QUE NUNCA FAZER

- Nunca commitar sem o usuário pedir
- Nunca refatorar código além do que foi pedido
- Nunca quebrar a API de scripts (`aurafetch.setEnv`, `aurafetch.setVar`, `aurafetch.log`)
- Nunca usar `any` sem justificativa
- Nunca chamar APIs do Tauri sem guard `isTauri()`
- Nunca salvar binários/imagens no localStorage (limite de 5MB)
- Nunca criar arquivos desnecessários
- Nunca usar `.should('be.visible')` em elementos dentro de `overflow: hidden` — usar `.should('exist')`

## 9. COMANDOS ÚTEIS

```bash
npm run dev              # Dev server (localhost:5173)
npx tauri dev            # Dev com Tauri (app desktop)
npm run build            # Build web
npx tauri build          # Build desktop (.exe + .msi)
npm run release          # Bump patch version (standard-version)
npm run release:minor    # Bump minor version
npm run release:major    # Bump major version
npm run cypress:open     # Cypress UI
npm run cypress:run      # Cypress headless
npm run lint             # ESLint
```

## 10. FLUXO DE RELEASE

1. `npm run release` (ou `:minor`/`:major`) — bump versão, CHANGELOG, tag
2. `git push --follow-tags origin main` — push código e tag
3. `npx tauri build` — gera `.exe` e `.msi`
4. `gh release create vX.Y.Z` ou `gh release upload` — publica instaladores
5. Atualizar `docs/PROJECT_OVERVIEW.md` com nova versão
6. Atualizar `docs/TASKS.md` se necessário

## 11. DOCUMENTAÇÃO DO PROJETO

| Documento | Propósito | Quando atualizar |
|-----------|-----------|-----------------|
| `docs/PROJECT_OVERVIEW.md` | O que é, estado atual | A cada release ou mudança significativa |
| `docs/ARCHITECTURE.md` | Como funciona | Quando estrutura de código mudar |
| `docs/TASKS.md` | O que fazer | A cada tarefa concluída ou nova tarefa |
| `docs/superpowers/specs/` | Design documents | Antes de features grandes |
| `docs/superpowers/plans/` | Planos de implementação | Antes de executar features |
