# DevLoid — Especificação de Evolução: Componentização + Dev Utils

**Data:** 2026-03-30
**Autor:** Eder Ferraz Caciano
**Status:** Aprovado pelo usuário
**Versão atual:** AuraFetch 1.3.2

---

## Visão Geral

O AuraFetch será evoluído em 4 fases para se tornar o **DevLoid** — uma ferramenta desktop completa de utilidades para desenvolvedores, mantendo o cliente HTTP como funcionalidade principal.

### Motivação

- `App.tsx` monolítico com ~3.940 linhas dificulta manutenção e adição de novas features
- Oportunidade de expandir o produto para dev utils (QR Code, JWT, Base64, Cron, etc.)
- Renomeação para DevLoid após a estabilização das novas funcionalidades

---

## Fases de Desenvolvimento

| Fase | Nome | Objetivo |
|------|------|----------|
| **Fase 2** | Componentização | Quebrar App.tsx em componentes isolados |
| **Fase 3a** | Dev Tools Offline | Grid de ferramentas: geradores, conversores, validadores |
| **Fase 3b** | Dev Tools de Rede | IP info, DNS lookup, ping |
| **Fase 4** | Renomeação DevLoid | package, localStorage, Tauri, GitHub |

---

## Fase 2 — Componentização

### Objetivo
Reduzir `App.tsx` de ~3.940 linhas para ~100 linhas (orquestrador puro), extraindo cada responsabilidade em componente isolado.

### Estrutura de arquivos resultante

```
src/
├── App.tsx                        # ~100 linhas — orquestrador
├── main.tsx                       # Entry point — ErrorBoundary envolve <App/>
├── index.css
├── types/
│   └── index.ts                   # Todos os tipos TypeScript do projeto
├── context/
│   └── RequestContext.tsx         # Estado global compartilhado (React Context)
├── hooks/
│   ├── useRequest.ts              # Lógica de envio de requisição HTTP
│   ├── useWebSocket.ts            # Lógica de conexão WebSocket
│   ├── useCollection.ts           # CRUD de workspaces/pastas/requisições
│   └── useEnvironment.ts          # Gerenciamento de environments e variáveis
├── utils/
│   └── safeFetch.ts               # isTauri(), readFileWithSizeGuard()
├── styles/
│   ├── global.css                 # Estilos globais (migrado de index.css)
│   ├── themes.css                 # Variáveis CSS de tema
│   └── animations.css             # Animações e transições
├── components/
│   ├── ErrorBoundary/
│   │   └── index.tsx              # Classe ErrorBoundary (extraída do App.tsx)
│   ├── layout/
│   │   ├── Sidebar.tsx            # Inclui seletor HTTP Client | Dev Tools
│   │   └── SidebarModeSwitch.tsx  # Botões de alternância no topo da sidebar
│   └── http/
│       ├── CollectionTree.tsx     # Árvore de workspaces/pastas/requisições
│       ├── RequestBuilder.tsx     # Barra de URL, método, botão disparo
│       ├── RequestTabs.tsx        # Tabs: Payload, Headers, Auth, Params, Scripts
│       ├── ResponseViewer.tsx     # Status, body (JSON/HTML/img/binary), headers
│       ├── Console.tsx            # Logs e timestamps
│       ├── WebSocketPanel.tsx     # UI de conexão e mensagens WS
│       ├── EnvironmentPanel.tsx   # Ambientes e variáveis globais
│       ├── HistoryPanel.tsx       # Histórico de requisições
│       └── CodeSnippet.tsx        # Gerador de snippets cURL/fetch/axios
```

> **Nota sobre App.css:** o arquivo atual `App.css` será absorvido por `styles/global.css` durante a extração. Não será criado um novo `App.css`.

### Regras de extração
- `context/RequestContext.tsx` é o único arquivo de estado global (sem lib externa)
- Cada hook isola sua lógica: `useRequest` cuida do envio, `useCollection` cuida do CRUD de nós, etc.
- A API de scripts `aurafetch.setEnv()`, `aurafetch.setVar()`, `aurafetch.log()` não pode quebrar
- `ErrorBoundary` é extraído para `components/ErrorBoundary/index.tsx` — `main.tsx` continua importando-o
- Após cada extração: rodar os 121 testes Cypress — zero falhas obrigatório
- Nenhum arquivo resultante deve ter mais de 300 linhas

---

## Fase 3a — Dev Tools Offline

### Navegação

O topo da sidebar ganha um seletor de modo:

```
[ HTTP Client ]  [ Dev Tools ]
```

- Padrão ao abrir: **HTTP Client** ativo
- Ao clicar em **Dev Tools**: árvore de coleções é substituída pelo `DevToolsHome`
- Estado do HTTP Client é preservado ao alternar (não perde requisição aberta)

### DevToolsHome — Grid de cards

Tela de listagem com cards agrupados por categoria. Clicar num card abre a ferramenta no painel principal. Cada ferramenta tem botão de voltar ao grid.

```
Dev Tools

  Geradores
  [ QR Code ]  [ Barcode ]  [ UUID ]  [ Senha ]

  Conversores
  [ Base64 ]  [ JWT ]  [ JSON↔YAML ]  [ URL Encode ]  [ Cron ]

  Validadores
  [ Regex ]  [ CPF/CNPJ ]  [ Hash ]
```

### Estrutura de arquivos

```
src/components/devtools/
├── DevToolsHome.tsx               # Grid de cards com todas as tools
├── generators/
│   ├── QrCodeTool.tsx
│   ├── BarcodeTool.tsx
│   ├── UuidTool.tsx
│   └── PasswordTool.tsx
├── converters/
│   ├── Base64Tool.tsx
│   ├── JwtTool.tsx
│   ├── JsonYamlTool.tsx
│   ├── UrlEncodeTool.tsx
│   └── CronTool.tsx
└── validators/
    ├── RegexTool.tsx
    ├── CpfCnpjTool.tsx
    └── HashTool.tsx
```

### Especificação das ferramentas

#### Geradores

| Tool | Input | Output | Notas |
|------|-------|--------|-------|
| **QR Code** | Texto/URL, tamanho, cor de fundo/frente | Imagem QR renderizada + botão download PNG | lib: `qrcode` |
| **Barcode** | Texto, formato (EAN-13, Code128, Code39) | Imagem barcode SVG + botão download PNG | lib: `jsbarcode` — download PNG requer conversão canvas.toBlob() |
| **UUID** | Versão (v1/v4/v7), quantidade (1–100) | Lista de UUIDs + copiar tudo | usa `uuid` já presente no package.json |
| **Senha** | Tamanho, usar especiais/números/maiúsculas | Senha gerada + indicador de força + copiar | sem lib extra |

#### Conversores

| Tool | Input | Output | Notas |
|------|-------|--------|-------|
| **Base64** | Texto ou arquivo, modo encode/decode | Resultado + copiar | sem lib extra — `btoa/atob` nativo |
| **JWT** | Token JWT colado | Header + Payload decodificados, status expirado/válido | sem verificar assinatura; sem lib extra |
| **JSON ↔ YAML** | JSON ou YAML (auto-detectado) | Formato oposto + copiar | lib: `js-yaml` |
| **URL Encode** | Texto, modo encode/decode | Resultado + copiar | sem lib extra — `encodeURIComponent/decodeURIComponent` |
| **Cron** | Expressão cron (5 ou 6 campos) | Descrição em **português** + próximas 5 execuções | lib: `cronstrue` com `{ locale: "pt_BR" }` obrigatório |

#### Validadores

| Tool | Input | Output | Notas |
|------|-------|--------|-------|
| **Regex** | Expressão regex + texto de teste | Matches destacados em tempo real com grupos capturados | sem lib extra |
| **CPF/CNPJ** | Número (auto-detecta tipo) | Válido/Inválido + gerador de CPF ou CNPJ fake formatado | sem lib extra — algoritmo puro |
| **Hash** | Texto, algoritmo | Hash gerado + copiar | SHA-1/SHA-256/SHA-512 via Web Crypto API nativa; **MD5 requer lib `spark-md5`** (Web Crypto não suporta MD5) |

### Dependências novas

| Lib | Finalidade | Já no projeto? |
|-----|-----------|---------------|
| `qrcode` | Geração de QR Code | Não |
| `jsbarcode` | Geração de Barcode SVG | Não |
| `js-yaml` | Conversão JSON ↔ YAML | Não |
| `cronstrue` | Tradução de cron para texto (usar com `{ locale: "pt_BR" }`) | Não |
| `spark-md5` | Hash MD5 (Web Crypto não suporta) | Não |
| `uuid` | UUID v1/v4/v7 | **Já presente** (`^13.0.0`) |

Todas funcionam **100% offline** — sem requests externos.

### Gate de qualidade Fase 3a
- 121 testes existentes passando após cada tool adicionada
- Mínimo 3 testes Cypress por tool: (1) render correto, (2) output gerado, (3) botão copiar/download funciona

---

## Fase 3b — Dev Tools de Rede

```
src/components/devtools/network/
├── IpInfoTool.tsx
├── DnsLookupTool.tsx
└── PingTool.tsx
```

| Tool | Input | Output | API externa | Fallback browser |
|------|-------|--------|-------------|-----------------|
| **IP Info** | IP ou vazio (usa o IP do usuário) | País, cidade, ISP, ASN | `https://ip-api.com/json/{ip}` (gratuito, sem auth) | Funciona — usa fetch normal |
| **DNS Lookup** | Domínio, tipo (A, AAAA, MX, TXT, NS) | Registros retornados | `https://cloudflare-dns.com/dns-query` (DNS-over-HTTPS) | Funciona — usa fetch normal |
| **Ping** | Host, quantidade | Latência ms por resposta + média/min/max | N/A — Tauri only (ICMP via Rust) | Browser: exibe mensagem "Ping disponível apenas na versão desktop" |

---

## Fase 4 — Renomeação para DevLoid

### O que muda

| Item | De | Para |
|------|----|------|
| `package.json` name | `aurafetch` | `devloid` |
| `tauri.conf.json` productName | `aurafetch` | `devloid` |
| `tauri.conf.json` identifier | `com.aurafetch.desktop` | `com.devloid.desktop` |
| `vite.config.ts` base (web) | `/AuraFetch/` | `/DevLoid/` |
| Título da janela | `AuraFetch` | `DevLoid` |
| `index.html` title | `AuraFetch` | `DevLoid` |
| Script API global | `window.aurafetch` | `window.devloid` (alias `window.aurafetch` mantido por 1 release) |
| GitHub repo | `AuraFetch` | `DevLoid` (ação manual do usuário) |

### Migração de localStorage — todos os 4 keys

```ts
// Executado na inicialização do app (main.tsx ou AppContext)
const migrations: [string, string][] = [
  ['aurafetch_collection_v2', 'devloid_collection_v1'],
  ['aurafetch_globals',       'devloid_globals'],
  ['aurafetch_envs',          'devloid_envs'],
  ['aurafetch_env_active',    'devloid_env_active'],
];

migrations.forEach(([oldKey, newKey]) => {
  const value = localStorage.getItem(oldKey);
  if (value && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, value);
    // Manter a chave antiga por 1 release (remover na Fase 4.1)
  }
});
```

> **Estratégia de rollback:** as chaves antigas são mantidas por 1 release inteira. Apenas na release seguinte são removidas. Isso permite rollback seguro sem perda de dados.

---

## Princípios de Design

- **HTTP Client é principal** — Dev Tools é complementar, nunca substitui
- **Offline first** — todas as ferramentas da Fase 3a funcionam sem internet
- **Dados no dispositivo** — nenhum dado do usuário sai do computador sem ação explícita
- **Consistência visual** — Dev Tools usa os mesmos componentes visuais do HTTP Client (glass-panel, btn, inputs)
- **Zero regressão** — 121 testes Cypress passando após cada fase

---

## Fora do Escopo

- Colaboração em equipe
- Sincronização em nuvem
- Sistema de plugins
- Builds para macOS/Linux (backlog separado)
- Novo logo/branding (pode ser feito em paralelo pelo usuário)
