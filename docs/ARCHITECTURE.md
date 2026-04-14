# AuraFetch — Architecture

> **Este documento é lido no início de cada sessão de desenvolvimento com IA.**
> Última atualização: 2026-03-30 | Versão: 1.3.2

---

## Estrutura de diretórios

```
AuraFetch/
├── src/
│   ├── App.tsx              # Monolito principal (~3.940 linhas) — TODO: componentizar na Fase 2
│   ├── App.css              # Estilos do App
│   ├── main.tsx             # Entry point — ErrorBoundary envolve <App/>
│   ├── index.css            # Estilos globais
│   └── assets/
│       └── react.svg
├── src-tauri/               # Backend Rust (Tauri 2)
│   ├── src/                 # Código Rust
│   ├── tauri.conf.json      # Config: nome, versão, janela, CSP, bundler
│   ├── capabilities/        # Permissões Tauri
│   ├── icons/               # Ícones do app
│   └── target/              # Build output (ignorado no git)
├── cypress/
│   ├── e2e/                 # 10 spec files, 121 testes
│   ├── fixtures/            # sample-collection.json, sample-image.png, small-file.txt
│   ├── tasks/               # file-tasks.ts (geração de arquivos grandes em runtime)
│   └── support/             # commands.ts, e2e.ts
├── docs/
│   ├── PROJECT_OVERVIEW.md  # O que é o projeto, estado atual
│   ├── ARCHITECTURE.md      # Este arquivo
│   ├── TASKS.md             # Backlog e progresso
│   └── superpowers/         # Specs e plans para execução com agentes
│       ├── specs/           # Design documents
│       └── plans/           # Implementation plans (checkbox format)
├── public/                  # Assets estáticos
├── .github/workflows/       # CI/CD (deploy.yml)
└── configs raiz             # package.json, vite.config.ts, tsconfig.json, cypress.config.ts, etc.
```

## App.tsx — Mapa do monolito

O `App.tsx` é o arquivo central com ~3.940 linhas. Aqui está o mapa das seções:

| Linhas | Seção | Responsabilidade |
|--------|-------|-----------------|
| 1-18 | Imports | React, Tauri plugins, CodeMirror, Lucide icons |
| 20-40 | `ErrorBoundary` | Classe React para capturar erros de renderização |
| 43-48 | `safeFetch()` | Detecta Tauri vs browser, usa fetch nativo ou plugin |
| 50-65 | `readFileWithSizeGuard()` | Lê arquivo com limite de 50MB |
| 67-175 | Types | `HttpMethod`, `AuthType`, `RequestModel`, `CollectionNode`, etc. |
| 177-340 | Migração & dados iniciais | Migração de localStorage legado, estado inicial |
| 345-418 | Helpers de URL | Sincronização de URL com params |
| 419+ | `App()` component | Componente principal (~3.500 linhas) |

### Dentro de `App()`:

| Área | O que faz |
|------|-----------|
| useState hooks (28x) | Estado global: collection, activeNodeId, environments, auth, loading, etc. |
| `addLog()` | Adiciona log ao console (`.log-line.log-${type}` dentro de `.console-panel`) |
| `workspaceConfig.history` | Histórico de requisições, persistido em localStorage como parte da coleção |
| `sendRequest()` | Executa a requisição HTTP/WebSocket |
| WebSocket logic | Connect/disconnect/send com `@tauri-apps/plugin-websocket` |
| Pre-request scripts | `new AsyncFunction('aurafetch', 'fetch', 'tauriFetch', scriptBody)` |
| Render: sidebar | Árvore de coleções com drag & drop |
| Render: request builder | Método, URL, tabs (Body, Headers, Auth, Params, Scripts) |
| Render: response viewer | Status, tabs (Body, Headers, Console), renderização condicional |
| Render: modals | Import/export, workspace config, environments |

## Persistência

| Dado | Chave localStorage | Formato |
|------|-------------------|---------|
| Coleções (principal) | `aurafetch_collection_v2` | JSON: array de `CollectionNode` |
| Variáveis globais | `aurafetch_globals` | JSON: array de `EnvVar` |
| Environments | `aurafetch_envs` | JSON |
| Environment ativo | `aurafetch_env_active` | string |

> **Atenção:** Na Fase 4 (renomeação para DevLoid), todas as chaves serão migradas para prefixo `devloid_`. As chaves antigas são mantidas por 1 release para rollback seguro.

## Padrões de teste (Cypress)

- **`cy.intercept()`** para controlar payloads de response sem servidor externo
- **`cy.task()`** para gerar/limpar arquivos grandes em runtime (nunca commitados)
- **`selectFile()`** para upload real de arquivos
- **`cy.window()`** para manipular localStorage e criar spies
- **Guard `isTauri()`**: testes de WebSocket e funcionalidades Tauri-only usam skip automático no browser
- **Seletores**: usar placeholders exatos do app (PT-BR), `.should('exist')` em vez de `.should('be.visible')` para elementos em containers com `overflow: hidden`

## Arquitetura-alvo (após Fase 2)

A Fase 2 vai decompor o monolito em:

```
src/
├── App.tsx                        # ~100 linhas — orquestrador
├── main.tsx                       # ErrorBoundary envolve <App/>
├── index.css
├── types/
│   └── index.ts                   # Todos os tipos TypeScript
├── context/
│   └── RequestContext.tsx         # Estado global (React Context, sem lib externa)
├── hooks/
│   ├── useRequest.ts              # Lógica de envio de requisição HTTP
│   ├── useWebSocket.ts            # Lógica de conexão WebSocket
│   ├── useCollection.ts           # CRUD de workspaces/pastas/requisições
│   └── useEnvironment.ts          # Gerenciamento de environments e variáveis
├── utils/
│   └── safeFetch.ts               # isTauri(), readFileWithSizeGuard()
├── styles/
│   ├── global.css                 # Estilos globais (migrado de App.css + index.css)
│   ├── themes.css                 # Variáveis CSS de tema
│   └── animations.css             # Animações e transições
└── components/
    ├── ErrorBoundary/
    │   └── index.tsx              # Extraído do App.tsx, importado pelo main.tsx
    ├── layout/
    │   ├── Sidebar.tsx            # Seletor HTTP Client | Dev Tools no topo
    │   └── SidebarModeSwitch.tsx
    ├── http/                      # Componentes do cliente HTTP
    │   ├── CollectionTree.tsx
    │   ├── RequestBuilder.tsx
    │   ├── RequestTabs.tsx
    │   ├── ResponseViewer.tsx
    │   ├── Console.tsx
    │   ├── WebSocketPanel.tsx
    │   ├── EnvironmentPanel.tsx
    │   ├── HistoryPanel.tsx
    │   └── CodeSnippet.tsx
    └── devtools/                  # NOVO — Fase 3a/3b
        ├── DevToolsHome.tsx
        ├── generators/
        ├── converters/
        ├── validators/
        └── network/
```

**Regra:** nenhum arquivo > 300 linhas. `RequestContext.tsx` é o único ponto de estado global.
