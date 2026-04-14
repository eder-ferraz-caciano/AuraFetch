# Fase 2 — Componentização do App.tsx — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Modelo preferido para agentes:** Haiku (`claude-haiku-4-5-20251001`)

**Goal:** Quebrar o monolito `src/App.tsx` (~3.940 linhas) em componentes isolados, reduzindo-o a ~100 linhas de orquestrador puro, sem alterar nenhum comportamento visível ao usuário.

**Architecture:** Extração incremental — cada task move código para um arquivo novo, atualiza os imports em App.tsx, e roda os 121 testes Cypress como gate obrigatório. Nenhuma lógica é alterada durante a extração — apenas movida. O estado global migra para `context/RequestContext.tsx` usando React Context puro (sem lib externa).

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tauri 2, Cypress 15, `@tauri-apps/api/core` (isTauri), `@tauri-apps/plugin-http/fs/dialog/websocket`

**Spec:** `docs/superpowers/specs/2026-03-30-devloid-evolution-design.md`

**Gate obrigatório após CADA task:** `npx cypress run --headless` deve retornar **121 passing, 0 failures**

---

## Mapa de arquivos

| Arquivo | Ação | O que contém |
|---------|------|-------------|
| `src/types/index.ts` | Criar | Todos os tipos e interfaces do projeto |
| `src/utils/safeFetch.ts` | Criar | `safeFetch`, `readFileWithSizeGuard`, constantes de tamanho |
| `src/components/ErrorBoundary/index.tsx` | Criar | Classe `ErrorBoundary` |
| `src/context/RequestContext.tsx` | Criar | React Context com estado global + Provider |
| `src/hooks/useCollection.ts` | Criar | CRUD de workspaces/pastas/requisições |
| `src/hooks/useEnvironment.ts` | Criar | Gerenciamento de environments e variáveis globais |
| `src/hooks/useRequest.ts` | Criar | Lógica de envio de requisição HTTP + pre-request scripts |
| `src/hooks/useWebSocket.ts` | Criar | Lógica de conexão/desconexão/envio WebSocket |
| `src/components/http/CollectionTree.tsx` | Criar | Sidebar com árvore de coleções e drag & drop |
| `src/components/http/RequestBuilder.tsx` | Criar | Barra de URL, seletor de método, botão disparo |
| `src/components/http/RequestTabs.tsx` | Criar | Tabs: Payload, Headers, Auth, Params (URL), Queries, Scripts |
| `src/components/http/ResponseViewer.tsx` | Criar | Status badge, body (JSON/HTML/img/binary), headers |
| `src/components/http/Console.tsx` | Criar | Painel de logs e timestamps |
| `src/components/http/WebSocketPanel.tsx` | Criar | UI de conexão e mensagens WS |
| `src/components/http/EnvironmentPanel.tsx` | Criar | Painel de ambientes e variáveis globais do workspace |
| `src/components/http/HistoryPanel.tsx` | Criar | Histórico de requisições |
| `src/components/http/CodeSnippet.tsx` | Criar | Modal de geração de snippets cURL/fetch/axios |
| `src/components/layout/Sidebar.tsx` | Criar | Wrapper da sidebar com seletor HTTP Client \| Dev Tools |
| `src/components/layout/SidebarModeSwitch.tsx` | Criar | Botões de alternância de modo no topo da sidebar |
| `src/styles/global.css` | Criar | Estilos globais (migrado de App.css + index.css) |
| `src/styles/themes.css` | Criar | Variáveis CSS de tema |
| `src/styles/animations.css` | Criar | Animações e transições |
| `src/App.tsx` | Modificar | Reduzir para ~100 linhas — só orquestrador |
| `src/main.tsx` | Modificar | Importar ErrorBoundary do novo path |

---

## Mapa completo de estado do App.tsx

### Estados GLOBAIS → vão para `RequestContext`

| useState | Linha App.tsx | Tipo | Descrição |
|----------|--------------|------|-----------|
| `collection / setCollection` | 423 | `CollectionNode[]` | Árvore principal de workspaces/pastas/requisições |
| `sidebarTab / setSidebarTab` | 428 | `'collection' \| 'history'` | Aba ativa da sidebar |
| `treeSearchQuery / setTreeSearchQuery` | 429 | `string` | Texto de busca na árvore |
| `globalVariables / setGlobalVariables` | 430 | `EnvVar[]` | Variáveis globais do usuário |
| `activeNodeId / setActiveNodeId` | 523 | `string \| null` | ID do nó selecionado na árvore |
| `activeResponse / setActiveResponse` | 535 | `SavedResponse \| null` | Response atual exibida no painel |
| `activeLogs / setActiveLogs` | 536 | `LogEntry[]` | Logs do console |
| `wsConnected / setWsConnected` | 541 | `boolean` | Status da conexão WebSocket |
| `wsInputMessage / setWsInputMessage` | 1341 | `string` | Texto do campo de envio WS |

### Estados LOCAIS → ficam no componente correspondente

| useState | Linha App.tsx | Componente destino |
|----------|--------------|-------------------|
| `activeReqTab / setActiveReqTab` | 526 | `RequestTabs` |
| `activeFolderSettingTab` | 527 | `EnvironmentPanel` |
| `activeWorkspaceTab` | 528 | `EnvironmentPanel` |
| `activeResTab / setActiveResTab` | 529 | `ResponseViewer` |
| `loading / setLoading` | 531 | `RequestBuilder` |
| `copiedRes / setCopiedRes` | 532 | `ResponseViewer` |
| `editingNodeId / setEditingNodeId` | 560 | `CollectionTree` |
| `openMenuNodeId / setOpenMenuNodeId` | 561 | `CollectionTree` |
| `editingName / setEditingName` | 562 | `CollectionTree` |
| `nodeToDelete / setNodeToDelete` | 563 | `CollectionTree` |
| `showNewWorkspaceInput` | 564 | `CollectionTree` |
| `newWorkspaceName / setNewWorkspaceName` | 565 | `CollectionTree` |
| `reqTimeoutMs / setReqTimeoutMs` | 568 | `RequestBuilder` |
| `showLoadingOverlay` | 570 | `RequestBuilder` |
| `isEnvModalOpen / setIsEnvModalOpen` | 593 | `EnvironmentPanel` |
| `editingEnvId / setEditingEnvId` | 594 | `EnvironmentPanel` |
| `isCodeModalOpen / setIsCodeModalOpen` | 595 | `CodeSnippet` |
| `codeSnippetLang / setCodeSnippetLang` | 596 | `CodeSnippet` |
| `intervalMs / setIntervalMs` | 599 | `RequestBuilder` |
| `isLooping / setIsLooping` | 600 | `RequestBuilder` |
| `leftPanelWidth / setLeftPanelWidth` | 604 | `App.tsx` (layout) |
| `dragOverInfo / setDragOverInfo` | 607 | `CollectionTree` |

### Refs → ficam no hook correspondente

| useRef | Linha | Destino |
|--------|-------|---------|
| `wsInstRef` | 539 | `useWebSocket` |
| `wsUnlistenRef` | 540 | `useWebSocket` |
| `abortControllerRef` | 569 | `useRequest` |
| `loadingOverlayTimer` | 571 | `useRequest` |
| `intervalRef` | 601 | `useRequest` |
| `isResizing` | 605 | `App.tsx` (layout) |
| `draggedNodeIdRef` | 606 | `CollectionTree` |
| `handleSendRef` | 779 | `useRequest` |
| `webBinaryFileRef` | 1342 | `RequestTabs` |

---

## Mapa de funções por hook/componente

### → `useCollection` (linhas no App.tsx)

| Função | Linha | Assinatura |
|--------|-------|-----------|
| `findParentWorkspace` | 442 | `(nodeId: string, nodes?: CollectionNode[]) => CollectionNode \| null` |
| `getWorkspaceHistory` | 482 | `(nodeId: string) => HistoryEntry[]` |
| `addWorkspaceHistoryEntry` | 487 | `(nodeId: string, entry: HistoryEntry) => void` |
| `addWorkspace` | 502 | `() => void` |
| `updateNodeInCollection` | 808 | `(nodeId: string, updater: (node: CollectionNode) => CollectionNode) => void` |
| `toggleFolder` | 865 | `(nodeId: string) => void` |
| `addFolderTo` | 874 | `(parentId: string) => void` |
| `addRequestToFolder` | 1033 | `(folderId: string) => void` |
| `addWebSocketToFolder` | 1049 | `(folderId: string) => void` |
| `cloneRequest` | 1073 | `(nodeId: string) => void` |
| `confirmDelete` | 1105 | `() => void` |
| `startRename` | 1129 | `(nodeId: string, currentName: string, e: React.MouseEvent) => void` |
| `commitRename` | 1135 | `(nodeId: string) => void` |
| `handleDrop` | 632 | `(targetId: string \| null, asChild: boolean, insertBefore?: boolean) => void` |
| `importCollection` | 1961 | `(e: React.ChangeEvent<HTMLInputElement>) => void` |
| `exportCollection` | 1932 | `() => Promise<void>` |

### → `useEnvironment` (linhas no App.tsx)

| Função | Linha | Assinatura |
|--------|-------|-----------|
| `getActiveEnvironment` | 456 | `(nodeId: string) => Environment \| null` |
| `getWorkspaceEnvironments` | 462 | `(nodeId: string) => Environment[]` |
| `getWorkspaceActiveEnvId` | 467 | `(nodeId: string) => string \| null` |
| `setWorkspaceActiveEnvId` | 472 | `(wsId: string, envId: string \| null) => void` |
| `applyVariables` | 1157 | `(text: string, targetNodeId: string) => string` |
| `addEnv` | 2307 | `() => void` |
| `removeEnv` | 2289 | `(eId: string) => void` |

### → `useRequest` (linhas no App.tsx)

| Função | Linha | Assinatura |
|--------|-------|-----------|
| `handleSend` | 1431 | `() => Promise<void>` |
| `cancelReq` | 573 | `() => void` |
| `resolveAuth` | 1214 | `(targetNodeId: string, nodes: CollectionNode[], currentParentAuth?: AuthConfig) => AuthConfig \| null` |
| `resolveHeaders` | 1237 | `(targetNodeId: string, nodes: CollectionNode[], currentParentHeaders?: RequestHeader[]) => RequestHeader[]` |
| `runFolderScript` | 1797 | `(nodeId: string) => Promise<void>` |
| `downloadBlobWeb` | 1922 | `(content: string, filename: string, mimeType?: string) => void` |
| `downloadResponse` | 1994 | `() => Promise<void>` |
| `copyResponse` | 1986 | `() => void` |
| `generateCrudExample` | 895 | `() => void` |

### → `useWebSocket` (linhas no App.tsx)

| Função | Linha | Assinatura |
|--------|-------|-----------|
| `connectWs` | 1344 | `() => Promise<void>` |
| `disconnectWs` | 1405 | `() => Promise<void>` |
| `sendWsMessage` | 1421 | `() => Promise<void>` |

### → Componentes de UI (render blocks no App.tsx)

| Componente | Função/render | Linha início | Linha fim (aprox.) |
|-----------|--------------|-------------|-------------------|
| `CollectionTree` | `renderTree()` | 2325 | 2490 |
| `RequestBuilder` | JSX da barra de URL | ~2560 | ~2700 |
| `RequestTabs` | JSX das tabs de request | ~2700 | ~3600 |
| `ResponseViewer` | JSX do painel de response | ~3600 | ~3830 |
| `Console` | `renderConsole()` | 2185 | 2228 |
| `WebSocketPanel` | JSX do painel WS | ~2810 | ~3090 |
| `EnvironmentPanel` | JSX do workspace config | ~3090 | ~3500 |
| `HistoryPanel` | JSX do histórico | ~2620 | ~2810 |
| `CodeSnippet` | JSX do modal de snippets | `isCodeModalOpen` block | — |
| `AuthFields` | `renderAuthFields()` | 2098 | 2183 |

---

## Task 1: Extrair tipos para `src/types/index.ts`

**Files:**
- Create: `src/types/index.ts`
- Modify: `src/App.tsx` (linhas 67-195)

- [ ] **Passo 1.1: Criar `src/types/index.ts`**

Copiar exatamente as linhas 67-195 do `App.tsx` para o novo arquivo, adicionando `export` em cada `type`, `interface` e `class`:

```typescript
// src/types/index.ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'inherit' | 'oauth2';
export interface RequestHeader { id: string; key: string; value: string; enabled: boolean; }
export interface EnvVar { id: string; key: string; value: string; }
export interface Environment { id: string; name: string; variables: EnvVar[]; }
export interface AuthConfig {
  type: AuthType;
  token?: string; username?: string; password?: string;
  apiKeyKey?: string; apiKeyValue?: string; apiKeyIn?: 'header' | 'query';
  oauth2Config?: { clientId: string; clientSecret: string; accessTokenUrl: string; authUrl: string; scope: string; accessToken: string; };
}
export type RequestBodyType = 'json' | 'form-data' | 'urlencoded' | 'binary' | 'none' | 'graphql' | 'ws';
export interface FormDataField { id: string; key: string; value: string; type: 'text' | 'file'; enabled: boolean; fileInfo?: { name: string; path: string }; webFile?: File; }
export interface RequestModel {
  id: string; name: string; method: HttpMethod; url: string; auth: AuthConfig;
  headers: RequestHeader[]; queryParams: RequestHeader[]; params: RequestHeader[];
  body: string; bodyType: RequestBodyType; formData: FormDataField[];
  graphqlQuery?: string; graphqlVariables?: string;
  wsMessages?: { id: string; type: 'sent' | 'received' | 'info' | 'error'; text: string; timestamp: number }[];
  binaryFile?: { name: string; path: string } | null; webBinaryFile?: File;
}
export interface SavedResponse { status: number; statusText: string; data: any; time: number; type?: 'json' | 'image' | 'pdf' | 'html' | 'text' | 'binary' | 'ws'; contentType?: string; headers?: Record<string, string>; }
export interface CollectionNode {
  id: string; name: string; type: 'folder' | 'request' | 'workspace';
  children?: CollectionNode[]; request?: RequestModel;
  folderConfig?: { auth: AuthConfig; variables?: EnvVar[]; setupScript?: string; headers?: RequestHeader[]; };
  workspaceConfig?: { environments: Environment[]; activeEnvironmentId: string | null; history: HistoryEntry[]; };
  expanded?: boolean;
}
export interface LogEntry { id: string; timestamp: Date; type: 'log' | 'error' | 'warn' | 'info' | 'success'; message: string; data?: any; }
export interface LegacyWorkspace { id: string; name: string; collection: CollectionNode[]; environments: Environment[]; activeEnvironmentId: string | null; history?: HistoryEntry[]; }
export interface HistoryEntry { id: string; requestId: string; requestName: string; method: HttpMethod; url: string; timestamp: string; status: number; }
```

- [ ] **Passo 1.2: Substituir bloco de tipos no App.tsx**

Remover linhas 67-195 e adicionar:
```typescript
import type { HttpMethod, AuthType, RequestHeader, EnvVar, Environment, AuthConfig, RequestBodyType, FormDataField, RequestModel, SavedResponse, CollectionNode, LogEntry, LegacyWorkspace, HistoryEntry } from './types';
```

- [ ] **Passo 1.3: Gate**
```bash
npx cypress run --headless
```
Esperado: **121 passing, 0 failures**

- [ ] **Passo 1.4: Commit**
```bash
git add src/types/index.ts src/App.tsx
git commit -m "refactor: extract types to src/types/index.ts"
```

---

## Task 2: Extrair utils para `src/utils/safeFetch.ts`

**Files:**
- Create: `src/utils/safeFetch.ts`
- Modify: `src/App.tsx` (linhas 43-65)

- [ ] **Passo 2.1: Criar `src/utils/safeFetch.ts`**

```typescript
// src/utils/safeFetch.ts
import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriHttpFetch } from '@tauri-apps/plugin-http';
import { readFile as tauriReadFile } from '@tauri-apps/plugin-fs';

export const MAX_FILE_UPLOAD_MB = 50;
export const MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024;

export const safeFetch = async (url: string, init?: RequestInit) => {
  if (isTauri()) return tauriHttpFetch(url, init);
  return fetch(url, init);
};

export const readFileWithSizeGuard = async (filePath: string, fileName: string): Promise<Uint8Array<ArrayBuffer>> => {
  if (!isTauri()) throw new Error(`Upload de arquivo não disponível na versão web. Use o aplicativo desktop para enviar arquivos.`);
  const bytes = await tauriReadFile(filePath);
  if (bytes.length > MAX_FILE_UPLOAD_BYTES) {
    throw new Error(`Arquivo "${fileName}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB (${(bytes.length / 1024 / 1024).toFixed(1)}MB). Reduza o tamanho do arquivo.`);
  }
  return bytes;
};
```

- [ ] **Passo 2.2: Atualizar App.tsx**

Remover linhas 43-65 (safeFetch, constantes, readFileWithSizeGuard) e adicionar:
```typescript
import { safeFetch, readFileWithSizeGuard, MAX_FILE_UPLOAD_MB, MAX_FILE_UPLOAD_BYTES } from './utils/safeFetch';
```
Remover do topo do App.tsx os imports de `@tauri-apps/plugin-http` e `@tauri-apps/plugin-fs` (agora em safeFetch.ts).

- [ ] **Passo 2.3: Gate + commit**
```bash
npx cypress run --headless
git add src/utils/safeFetch.ts src/App.tsx
git commit -m "refactor: extract safeFetch utils to src/utils/safeFetch.ts"
```

---

## Task 3: Extrair ErrorBoundary

**Files:**
- Create: `src/components/ErrorBoundary/index.tsx`
- Modify: `src/App.tsx` (remover linhas 20-40)
- Modify: `src/main.tsx`

- [ ] **Passo 3.1: Criar `src/components/ErrorBoundary/index.tsx`**

Copiar exatamente as linhas 20-40 do App.tsx (classe `ErrorBoundary`):
```typescript
// src/components/ErrorBoundary/index.tsx
import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'var(--text-primary)', textAlign: 'center' }}>
          <h2>Algo deu errado (Erro Renderização).</h2>
          <p style={{ color: 'var(--danger)' }}>{this.state.error?.message}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar App</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Passo 3.2: Atualizar App.tsx**

Remover linhas 20-40. Adicionar: `import { ErrorBoundary } from './components/ErrorBoundary';`

- [ ] **Passo 3.3: Atualizar main.tsx**

Verificar se `main.tsx` importa `ErrorBoundary` de `'./App'`. Atualizar para `'./components/ErrorBoundary'`.

- [ ] **Passo 3.4: Gate + commit**
```bash
npx cypress run --headless
git add src/components/ErrorBoundary/index.tsx src/App.tsx src/main.tsx
git commit -m "refactor: extract ErrorBoundary to src/components/ErrorBoundary"
```

---

## Task 4: Criar `src/context/RequestContext.tsx`

**Files:**
- Create: `src/context/RequestContext.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

> **Esta é a task mais crítica.** Os estados globais listados na tabela acima migram para cá. Os estados locais ficam nos componentes.

> **Nota sobre wrapping:** `<ErrorBoundary>` deve envolver `<RequestProvider>`. Se uma renderização dentro do Provider lançar erro, o ErrorBoundary o captura. O Provider não precisa estar dentro do ErrorBoundary para funcionar.

- [ ] **Passo 4.1: Criar `src/context/RequestContext.tsx`**

```typescript
// src/context/RequestContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CollectionNode, EnvVar, LogEntry, SavedResponse } from '../types';

// Inicializadores — copiar exatamente do App.tsx para manter compatibilidade com localStorage
// collection: linha 423-427 do App.tsx (usa migrateWorkspacesToTreeFormat())
// globalVariables: linha 430-438 do App.tsx (lê 'aurafetch_globals' do localStorage)

interface RequestContextValue {
  collection: CollectionNode[];
  setCollection: React.Dispatch<React.SetStateAction<CollectionNode[]>>;
  sidebarTab: 'collection' | 'history';
  setSidebarTab: React.Dispatch<React.SetStateAction<'collection' | 'history'>>;
  treeSearchQuery: string;
  setTreeSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  globalVariables: EnvVar[];
  setGlobalVariables: React.Dispatch<React.SetStateAction<EnvVar[]>>;
  activeNodeId: string | null;
  setActiveNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  activeResponse: SavedResponse | null;
  setActiveResponse: React.Dispatch<React.SetStateAction<SavedResponse | null>>;
  activeLogs: LogEntry[];
  setActiveLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  addLog: (type: LogEntry['type'], message: string, data?: any) => void;
  wsConnected: boolean;
  setWsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  wsInputMessage: string;
  setWsInputMessage: React.Dispatch<React.SetStateAction<string>>;
}

const RequestContext = createContext<RequestContextValue | null>(null);

export const RequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // IMPORTANTE: copiar os inicializadores exatamente como estão no App.tsx
  // para manter a leitura correta do localStorage
  const [collection, setCollection] = useState<CollectionNode[]>(/* copiar inicializador da linha 423 do App.tsx */);
  const [sidebarTab, setSidebarTab] = useState<'collection' | 'history'>('collection');
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
  const [globalVariables, setGlobalVariables] = useState<EnvVar[]>(/* copiar inicializador da linha 430 do App.tsx */);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] = useState<SavedResponse | null>(null);
  const [activeLogs, setActiveLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsInputMessage, setWsInputMessage] = useState('');

  // Copiar addLog exatamente da linha 716 do App.tsx (inclui o useCallback)
  const addLog = useCallback((type: LogEntry['type'], message: string, data?: any) => {
    setActiveLogs(prev => [...prev.slice(-199), { id: uuidv4(), timestamp: new Date(), type, message, data }]);
  }, []);

  return (
    <RequestContext.Provider value={{
      collection, setCollection,
      sidebarTab, setSidebarTab,
      treeSearchQuery, setTreeSearchQuery,
      globalVariables, setGlobalVariables,
      activeNodeId, setActiveNodeId,
      activeResponse, setActiveResponse,
      activeLogs, setActiveLogs, addLog,
      wsConnected, setWsConnected,
      wsInputMessage, setWsInputMessage,
    }}>
      {children}
    </RequestContext.Provider>
  );
};

export const useRequestContext = () => {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error('useRequestContext must be used within RequestProvider');
  return ctx;
};
```

- [ ] **Passo 4.2: Atualizar main.tsx**

```typescript
import { RequestProvider } from './context/RequestContext';
// ...
root.render(
  <ErrorBoundary>
    <RequestProvider>
      <App />
    </RequestProvider>
  </ErrorBoundary>
);
```

- [ ] **Passo 4.3: Substituir useState globais no App.tsx**

Remover os 9 useState globais (linhas 423, 428, 429, 430, 523, 535, 536, 541, 1341) e substituir por:
```typescript
const {
  collection, setCollection,
  sidebarTab, setSidebarTab,
  treeSearchQuery, setTreeSearchQuery,
  globalVariables, setGlobalVariables,
  activeNodeId, setActiveNodeId,
  activeResponse, setActiveResponse,
  activeLogs, setActiveLogs, addLog,
  wsConnected, setWsConnected,
  wsInputMessage, setWsInputMessage,
} = useRequestContext();
```
Remover também o `addLog` useCallback (linha 716) que foi movido para o Provider.

- [ ] **Passo 4.4: Gate + commit**
```bash
npx cypress run --headless
git add src/context/RequestContext.tsx src/App.tsx src/main.tsx
git commit -m "refactor: create RequestContext and move global state out of App.tsx"
```

---

## Task 5a: Hook `src/hooks/useCollection.ts`

**Files:**
- Create: `src/hooks/useCollection.ts`
- Modify: `src/App.tsx`

Funções a mover (ver tabela acima para assinaturas e linhas exatas):
`findParentWorkspace`, `getWorkspaceHistory`, `addWorkspaceHistoryEntry`, `addWorkspace`, `updateNodeInCollection`, `toggleFolder`, `addFolderTo`, `addRequestToFolder`, `addWebSocketToFolder`, `cloneRequest`, `confirmDelete`, `startRename`, `commitRename`, `handleDrop`, `importCollection`, `exportCollection`

- [ ] **Passo 5a.1: Criar `src/hooks/useCollection.ts`**

```typescript
// src/hooks/useCollection.ts
import { useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useRequestContext } from '../context/RequestContext';
import type { CollectionNode, HistoryEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
// imports de tauri dialog/fs/etc conforme necessário pelas funções movidas

export const useCollection = () => {
  const { collection, setCollection, activeNodeId, setActiveNodeId, addLog } = useRequestContext();

  // Mover cada função listada acima para cá
  // Copiar o corpo exato de cada função — sem alterar lógica
  // Funções que usam setCollection, activeNodeId, addLog já têm acesso via contexto

  return {
    findParentWorkspace,
    getWorkspaceHistory,
    addWorkspaceHistoryEntry,
    addWorkspace,
    updateNodeInCollection,
    toggleFolder,
    addFolderTo,
    addRequestToFolder,
    addWebSocketToFolder,
    cloneRequest,
    confirmDelete,
    startRename,
    commitRename,
    handleDrop,
    importCollection,
    exportCollection,
  };
};
```

- [ ] **Passo 5a.2: Substituir no App.tsx**

Remover as 16 funções do App.tsx. Adicionar:
```typescript
import { useCollection } from './hooks/useCollection';
const { findParentWorkspace, addWorkspace, /* ... todas */ } = useCollection();
```

- [ ] **Passo 5a.3: Gate + commit**
```bash
npx cypress run --headless
git add src/hooks/useCollection.ts src/App.tsx
git commit -m "refactor: extract useCollection hook"
```

---

## Task 5b: Hook `src/hooks/useEnvironment.ts`

Funções a mover: `getActiveEnvironment`, `getWorkspaceEnvironments`, `getWorkspaceActiveEnvId`, `setWorkspaceActiveEnvId`, `applyVariables`, `addEnv`, `removeEnv`

- [ ] **Passo 5b.1: Criar `src/hooks/useEnvironment.ts`**

```typescript
// src/hooks/useEnvironment.ts
import { useRequestContext } from '../context/RequestContext';
import type { Environment, EnvVar } from '../types';

export const useEnvironment = () => {
  const { collection, setCollection, globalVariables } = useRequestContext();

  // Mover as 7 funções listadas acima — copiar lógica exata das linhas indicadas
  // applyVariables (linha 1157) é a mais complexa — copiar integralmente sem alterar

  return {
    getActiveEnvironment,
    getWorkspaceEnvironments,
    getWorkspaceActiveEnvId,
    setWorkspaceActiveEnvId,
    applyVariables,
    addEnv,
    removeEnv,
  };
};
```

- [ ] **Passo 5b.2: Substituir no App.tsx + gate + commit**
```bash
npx cypress run --headless
git add src/hooks/useEnvironment.ts src/App.tsx
git commit -m "refactor: extract useEnvironment hook"
```

---

## Task 5c: Hook `src/hooks/useRequest.ts`

Funções a mover: `handleSend`, `cancelReq`, `resolveAuth`, `resolveHeaders`, `runFolderScript`, `downloadBlobWeb`, `downloadResponse`, `copyResponse`, `generateCrudExample`

- [ ] **Passo 5c.1: Criar `src/hooks/useRequest.ts`**

```typescript
// src/hooks/useRequest.ts
import { useRef, useState, useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useRequestContext } from '../context/RequestContext';
import { useEnvironment } from './useEnvironment';
import { safeFetch, readFileWithSizeGuard, MAX_FILE_UPLOAD_MB, MAX_FILE_UPLOAD_BYTES } from '../utils/safeFetch';
import type { RequestModel, AuthConfig, RequestHeader, SavedResponse } from '../types';

export const useRequest = () => {
  const { collection, activeNodeId, addLog, setActiveResponse, setActiveLogs } = useRequestContext();
  const { applyVariables } = useEnvironment();
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingOverlayTimer = useRef<number | null>(null);
  const handleSendRef = useRef<() => void>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mover handleSend (linha 1431), cancelReq (573), resolveAuth (1214),
  // resolveHeaders (1237), runFolderScript (1797), downloadBlobWeb (1922),
  // downloadResponse (1994), copyResponse (1986), generateCrudExample (895)
  // Copiar lógica exata — sem alterar

  return {
    loading,
    handleSend,
    cancelReq,
    resolveAuth,
    resolveHeaders,
    runFolderScript,
    downloadBlobWeb,
    downloadResponse,
    copyResponse,
    generateCrudExample,
    handleSendRef,
  };
};
```

- [ ] **Passo 5c.2: Substituir no App.tsx + gate + commit**
```bash
npx cypress run --headless
git add src/hooks/useRequest.ts src/App.tsx
git commit -m "refactor: extract useRequest hook"
```

---

## Task 5d: Hook `src/hooks/useWebSocket.ts`

Funções a mover: `connectWs` (linha 1344), `disconnectWs` (1405), `sendWsMessage` (1421)
Refs a mover: `wsInstRef` (539), `wsUnlistenRef` (540)

- [ ] **Passo 5d.1: Criar `src/hooks/useWebSocket.ts`**

```typescript
// src/hooks/useWebSocket.ts
import { useRef, useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import WebSocket from '@tauri-apps/plugin-websocket';
import { useRequestContext } from '../context/RequestContext';

export const useWebSocket = () => {
  const { addLog, setWsConnected, wsInputMessage, setWsInputMessage, collection, activeNodeId } = useRequestContext();
  const wsInstRef = useRef<WebSocket | null>(null);
  const wsUnlistenRef = useRef<(() => void) | null>(null);

  // Mover connectWs, disconnectWs, sendWsMessage
  // ATENÇÃO: manter o padrão de ref para evitar stale closure (já corrigido na Fase 1)
  // wsInstRef.current é usado dentro dos listeners para evitar stale closure

  return { connectWs, disconnectWs, sendWsMessage };
};
```

- [ ] **Passo 5d.2: Substituir no App.tsx + gate + commit**
```bash
npx cypress run --headless
git add src/hooks/useWebSocket.ts src/App.tsx
git commit -m "refactor: extract useWebSocket hook"
```

---

## Task 6: `src/components/http/CollectionTree.tsx`

**JSX block:** função `renderTree()` (linha 2325) + bloco da sidebar no return principal (~linhas 2494–2620)
**Estados locais:** `editingNodeId`, `openMenuNodeId`, `editingName`, `nodeToDelete`, `showNewWorkspaceInput`, `newWorkspaceName`, `draggedNodeIdRef`, `dragOverInfo`

- [ ] Criar componente com os estados locais e usando `useCollection()` + `useRequestContext()`
- [ ] Props: nenhuma (usa context direto)
- [ ] Substituir bloco da sidebar no App.tsx por `<CollectionTree />`
- [ ] Gate + commit: `"refactor: extract CollectionTree component"`

---

## Task 7: `src/components/http/RequestBuilder.tsx`

**JSX block:** barra de URL + método + botão disparo (~linhas 2620–2700)
**Estados locais:** `loading`, `reqTimeoutMs`, `showLoadingOverlay`, `intervalMs`, `isLooping`

- [ ] Criar componente usando `useRequest()` + `useRequestContext()`
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract RequestBuilder component"`

---

## Task 8: `src/components/http/RequestTabs.tsx`

**JSX block:** tabs de request (Payload/Body, Headers, Auth, Params URL, Queries, Scripts) (~linhas 2700–3090)
**Estados locais:** `activeReqTab`, `webBinaryFileRef`
**Funções:** `renderAuthFields()` (linha 2098) pode ir para sub-arquivo `AuthFields.tsx` se o componente ultrapassar 300 linhas

- [ ] Criar componente
- [ ] Se > 300 linhas: extrair `AuthFields.tsx` como sub-componente interno
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract RequestTabs component"`

---

## Task 9: `src/components/http/Console.tsx`

**JSX block:** função `renderConsole()` (linha 2185) + uso dentro do ResponseViewer
**Nota:** Console deve ser extraído ANTES do ResponseViewer, pois ResponseViewer importa Console.

- [ ] Criar componente recebendo `logs: LogEntry[]` e `onClear: () => void` como props
- [ ] Substituir chamadas a `renderConsole()` pelo componente
- [ ] Gate + commit: `"refactor: extract Console component"`

---

## Task 10: `src/components/http/ResponseViewer.tsx`

**JSX block:** painel de response com status, body (JSON/HTML/img/binary), headers (~linhas 3600–3830)
**Estados locais:** `activeResTab`, `copiedRes`
**Funções usa:** `downloadResponse`, `copyResponse` via `useRequest()`
**Importa:** `Console` (extraído na Task 9)

- [ ] Criar componente
- [ ] Importar `Console` de `../Console`
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract ResponseViewer component"`

---

## Task 11: `src/components/http/WebSocketPanel.tsx`

**JSX block:** painel WS quando `activeReq.method === 'WS'` (~linhas 2810–3090)
**Hooks usa:** `useWebSocket()` para `connectWs`, `disconnectWs`, `sendWsMessage`, `wsConnected`

- [ ] Criar componente
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract WebSocketPanel component"`

---

## Task 12: `src/components/http/EnvironmentPanel.tsx`

**JSX block:** workspace config panel (Ambientes, Variáveis Globais, Resumo) (~linhas 3090–3500)
**Estados locais:** `activeFolderSettingTab`, `activeWorkspaceTab`, `isEnvModalOpen`, `editingEnvId`
**Funções usa:** `useEnvironment()` para `addEnv`, `removeEnv`, etc.

- [ ] Criar componente
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract EnvironmentPanel component"`

---

## Task 13: `src/components/http/HistoryPanel.tsx`

**JSX block:** painel de histórico (~linhas 2620–2810, aba "Histórico" da sidebar)
**Funções usa:** `useCollection()` para leitura do histórico do workspace

- [ ] Criar componente
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract HistoryPanel component"`

---

## Task 14: `src/components/http/CodeSnippet.tsx`

**JSX block:** modal de code snippets (quando `isCodeModalOpen === true`)
**Estados locais:** `isCodeModalOpen`, `codeSnippetLang`
**Funções usa:** `generateCodeSnippet` (linha 1252) — mover para este componente

- [ ] Criar componente
- [ ] Mover `generateCodeSnippet` para dentro do componente
- [ ] Substituir no App.tsx
- [ ] Gate + commit: `"refactor: extract CodeSnippet component"`

---

## Task 15: Layout — Sidebar + SidebarModeSwitch

**Nota de escopo:** `SidebarModeSwitch` é criado aqui como shell estrutural (definido na arquitetura-alvo da Fase 2). O botão "Dev Tools" fica visível mas não exibe conteúdo até a Fase 3a. O modo `'http'` é o único funcional nesta fase.

**Files:**
- Create: `src/components/layout/SidebarModeSwitch.tsx`
- Create: `src/components/layout/Sidebar.tsx`

- [ ] **Passo 15.1: Criar SidebarModeSwitch.tsx**

```typescript
// src/components/layout/SidebarModeSwitch.tsx
import React from 'react';
type AppMode = 'http' | 'devtools';
interface Props { mode: AppMode; onChange: (mode: AppMode) => void; }
export const SidebarModeSwitch: React.FC<Props> = ({ mode, onChange }) => (
  <div className="sidebar-mode-switch">
    <button className={`mode-btn ${mode === 'http' ? 'active' : ''}`} onClick={() => onChange('http')}>HTTP Client</button>
    <button className={`mode-btn ${mode === 'devtools' ? 'active' : ''}`} onClick={() => onChange('devtools')}>Dev Tools</button>
  </div>
);
```

- [ ] **Passo 15.2: Criar Sidebar.tsx**

```typescript
// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import { SidebarModeSwitch } from './SidebarModeSwitch';
import { CollectionTree } from '../http/CollectionTree';
export const Sidebar: React.FC = () => {
  const [mode, setMode] = useState<'http' | 'devtools'>('http');
  return (
    <div className="sidebar">
      <SidebarModeSwitch mode={mode} onChange={setMode} />
      {mode === 'http' && <CollectionTree />}
      {mode === 'devtools' && <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Dev Tools — disponível na Fase 3</div>}
    </div>
  );
};
```

- [ ] **Passo 15.3: Substituir sidebar no App.tsx por `<Sidebar />`**

- [ ] **Passo 15.4: Adicionar estilos mínimos**

Em `src/App.css` adicionar:
```css
.sidebar-mode-switch { display: flex; gap: 4px; padding: 8px; border-bottom: 1px solid var(--border); }
.mode-btn { flex: 1; padding: 6px; border-radius: 4px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 12px; }
.mode-btn.active { background: var(--accent); color: white; }
```

- [ ] **Passo 15.5: Gate + commit**
```bash
npx cypress run --headless
git add src/components/layout/ src/App.tsx src/App.css
git commit -m "refactor: extract Sidebar + SidebarModeSwitch layout components"
```

---

## Task 16: Migração de estilos

**Files:**
- Create: `src/styles/global.css`
- Create: `src/styles/themes.css`
- Create: `src/styles/animations.css`
- Modify: `src/main.tsx` (atualizar imports CSS)
- Delete: conteúdo de `src/App.css` (mover para styles/)

- [ ] **Passo 16.1: Ler App.css e index.css, categorizar cada bloco:**
  - Variáveis CSS (`:root`) → `themes.css`
  - `@keyframes` → `animations.css`
  - Todo o resto → `global.css`

- [ ] **Passo 16.2: Criar os 3 arquivos em `src/styles/`**

- [ ] **Passo 16.3: Atualizar imports em main.tsx**
```typescript
import './styles/themes.css';
import './styles/global.css';
import './styles/animations.css';
```
Remover `import './index.css'` e `import './App.css'` de onde estiverem.

- [ ] **Passo 16.4: Verificar e limpar App.css**
Após migrar todo conteúdo, deletar `src/App.css`.

- [ ] **Passo 16.5: Gate + commit**
```bash
npx cypress run --headless
git add src/styles/ src/App.tsx src/main.tsx
git rm src/App.css
git commit -m "refactor: migrate styles to src/styles/ directory"
```

---

## Task 17: App.tsx reduzido a ~100 linhas

**Files:**
- Modify: `src/App.tsx`

- [ ] **Passo 17.1: Verificar o que restou**

O App.tsx após todas as extrações deve conter apenas:
- Import dos componentes
- Helpers de URL (`syncQueryParamsToUrl`, `syncUrlToQueryParams`, `syncUrlToPathParams`, `AutoScrollEnd`) — mover para `src/utils/urlHelpers.ts`
- `initialCollection` e `migrateWorkspacesToTreeFormat` — mover para `src/context/RequestContext.tsx` (junto ao inicializador)
- O componente `App()` montando a estrutura de layout

- [ ] **Passo 17.2: Criar `src/utils/urlHelpers.ts`** com as funções de sync de URL (linhas 346-417)

- [ ] **Passo 17.3: App.tsx final deve ser similar a:**

```typescript
import React from 'react';
import { useRequestContext } from './context/RequestContext';
import { Sidebar } from './components/layout/Sidebar';
import { RequestBuilder } from './components/http/RequestBuilder';
import { RequestTabs } from './components/http/RequestTabs';
import { ResponseViewer } from './components/http/ResponseViewer';
import { CodeSnippet } from './components/http/CodeSnippet';
import { EnvironmentPanel } from './components/http/EnvironmentPanel';

export default function App() {
  const { activeNodeId } = useRequestContext();
  // lógica mínima de layout (leftPanelWidth resize)
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {activeNodeId ? (
          <>
            <RequestBuilder />
            <RequestTabs />
            <ResponseViewer />
          </>
        ) : (
          <EnvironmentPanel />
        )}
      </main>
      <CodeSnippet />
    </div>
  );
}
```

- [ ] **Passo 17.4: Gate final completo**
```bash
npx cypress run --headless
npm run build
```
Esperado: **121 passing, 0 failures** + build sem erros TypeScript

- [ ] **Passo 17.5: Verificar tamanho dos arquivos**
```bash
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -20
```
Nenhum arquivo deve ter > 300 linhas.

- [ ] **Passo 17.6: Verificar importações cíclicas**
```bash
npx madge --circular src/App.tsx
```
Se `madge` não estiver instalado: `npx madge --circular src/App.tsx` (instala automaticamente via npx)

- [ ] **Passo 17.7: Commit final**
```bash
git add -A
git commit -m "refactor(fase2): App.tsx reduced to orchestrator — componentization complete"
```

---

## Checklist de conclusão da Fase 2

- [ ] `npx cypress run --headless` → 121 passing, 0 failures
- [ ] `npm run build` → sem erros TypeScript
- [ ] Nenhum arquivo em `src/` com mais de 300 linhas
- [ ] App funcional no browser: `npm run dev`
- [ ] App funcional no Tauri: `npx tauri dev`
- [ ] `src/App.tsx` tem ≤ 100 linhas
- [ ] Nenhum import cíclico (context → hooks → context)
- [ ] `TASKS.md` atualizado com todos os itens da Fase 2 marcados como `[x]`
