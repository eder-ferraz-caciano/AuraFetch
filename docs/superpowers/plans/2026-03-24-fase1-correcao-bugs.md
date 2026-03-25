# Fase 1 — Correção de Bugs: Plano de Implementação

> **Para agentes:** SKILL OBRIGATÓRIA: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam a sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Corrigir todos os bugs críticos e de alta prioridade identificados na auditoria completa do `App.tsx`, sem refatorar a estrutura do arquivo.

**Arquitetura:** Todas as correções são pontuais no `src/App.tsx` (3.741 linhas) e `src/main.tsx`. Nenhum arquivo novo é criado. Cada tarefa é um commit independente. A ordem segue prioridade: P0 primeiro, P1 depois, P2 por último.

**Stack:** React 19, TypeScript, Tauri 2, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-websocket` (`addListener` retorna `() => void` — função de cleanup), `@tauri-apps/api/core`

---

## Resultados da Auditoria (Fase 0)

### P0 — Críticos (causam crashes para usuários)

| # | Bug | Linha(s) | Causa raiz |
|---|---|---|---|
| B1 | Tela branca no carregamento | 240-281, 392-395 | `JSON.parse()` sem try/catch nos inicializadores do `useState`. Se o localStorage tiver JSON corrompido, o app trava ANTES da ErrorBoundary ser montada |
| B2 | ErrorBoundary não envolve a árvore completa | 3721 | A `ErrorBoundary` está dentro do `<main>`, mas os `useState` que podem lançar erros rodam fora dela. Deve envolver o `<App>` inteiro em `main.tsx` |
| B3 | Travamento ao enviar arquivo binário | 1492-1496 | `tauriReadFile` lê o arquivo inteiro na memória de uma vez, sem limite de tamanho. Na versão web, não há guard e lança erro não tratado |
| B4 | Travamento ao enviar form-data com arquivo | 1505-1507 | Mesmo problema do B3, para campos de arquivo no form-data |
| B5 | Travamento com resposta grande | 677-680, 1579-1581 | Dois bloqueios: (1) `JSON.parse` do payload na thread principal; (2) o `useEffect` de persistência serializa a coleção INTEIRA (incluindo a resposta) para o localStorage a cada mudança de estado |
| B6 | Imagem/PDF corrompem o localStorage | 1553-1557 | Imagens e PDFs viram base64 e são salvos em `savedResponse.data` dentro da coleção. O localStorage tem limite de ~5MB — uma única imagem pode corromper todo o storage |

### P1 — Altos (causam mau funcionamento)

| # | Bug | Linha(s) | Causa raiz |
|---|---|---|---|
| B7 | Memory leak: listener WebSocket acumula | 1311 | `ws.addListener(...)` retorna uma função de cleanup `() => void` que nunca é chamada. Cada nova conexão registra um listener novo sem remover o anterior |
| B8 | Performance: cada log grava o localStorage | 643-674, 677-680 | `addLog` chama `setCollection`, que dispara o `useEffect` de persistência. Cada log = serialização completa da coleção |
| B9 | Stale closure no listener WS | 1317 | O listener fecha sobre `activeReq.wsMessages` no momento da conexão. Cada mensagem recebida acumula apenas a partir do snapshot inicial, perdendo mensagens intermediárias |
| B10 | Funções Tauri chamadas sem guard no browser | 1826-1960 | `exportCollection`, `downloadResponse`, `pickBinaryFile`, `pickFormDataFile` chamam APIs do Tauri sem verificar `isTauri()` |

### P2 — Médios (qualidade)

| # | Bug | Linha(s) | Causa raiz |
|---|---|---|---|
| B11 | `console.warn` e `console.error` em produção | 1127, 1820 | Logs de debug não removidos |
| B12 | `prompt()` usado para criar workspace | 459 | `window.prompt()` bloqueia a thread e não funciona em Tauri |
| B13 | Estado WS não resetado ao trocar de nó | 1293-1294 | `wsConnected` não é resetado ao mudar `activeNodeId` |
| B14 | `import './index.css'` no meio do arquivo | 48 | Import de CSS colocado após a classe `ErrorBoundary`, deve ir no topo |

---

## Arquivos Modificados

- Modificar: `src/App.tsx`
- Modificar: `src/main.tsx`

---

## Tarefa 1: Corrigir tela branca — proteger inicializadores com try/catch e mover ErrorBoundary

**Bugs corrigidos:** B1, B2

**Por que:** Os inicializadores de `useState` nas linhas 240-281 e 392-395 chamam `JSON.parse()` sem try/catch. Se o localStorage tiver dados corrompidos (pode ocorrer pelo bug B6), isso lança um erro antes da `ErrorBoundary` estar montada — tela branca irrecuperável. Além disso, a `ErrorBoundary` está dentro do `<main>` (linha 3721), não na raiz.

**Arquivos:** `src/App.tsx`, `src/main.tsx`

- [ ] **Passo 1: Adicionar `export` à classe `ErrorBoundary` (linha 19)**

  Localizar linha 19 em `src/App.tsx`:
  ```typescript
  // ANTES (linha 19):
  class ErrorBoundary extends React.Component<...>

  // DEPOIS — apenas adicionar a palavra 'export':
  export class ErrorBoundary extends React.Component<...>
  ```
  Não alterar mais nada na classe.

- [ ] **Passo 2: Envolver `<App>` com `<ErrorBoundary>` em `main.tsx`**

  Abrir `src/main.tsx`. Adicionar o import e envolver:
  ```typescript
  import { StrictMode } from 'react'
  import { createRoot } from 'react-dom/client'
  import App, { ErrorBoundary } from './App.tsx'
  import './index.css'

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  ```

- [ ] **Passo 3: Remover a `<ErrorBoundary>` interna do `App.tsx` (linha ~3721)**

  Localizar `<ErrorBoundary>` dentro do JSX do `App` e remover as tags de abertura e fechamento. O conteúdo interno permanece.

- [ ] **Passo 4: Proteger `migrateWorkspacesToTreeFormat` com try/catch individual por bloco**

  Substituir a função completa (linhas 240-281) por:

  ```typescript
  const migrateWorkspacesToTreeFormat = (): CollectionNode[] | null => {
    try {
      const savedV2 = localStorage.getItem('aurafetch_collection_v2');
      if (savedV2) return JSON.parse(savedV2);
    } catch (e) {
      console.warn('[AuraFetch] Coleção v2 corrompida, limpando...', e);
      localStorage.removeItem('aurafetch_collection_v2');
    }

    try {
      const savedOldWs = localStorage.getItem('aurafetch_workspaces');
      if (savedOldWs) {
        const oldWorkspaces: LegacyWorkspace[] = JSON.parse(savedOldWs);
        return oldWorkspaces.map(ws => ({
          id: ws.id,
          name: ws.name,
          type: 'workspace' as const,
          expanded: true,
          workspaceConfig: {
            environments: ws.environments || [],
            activeEnvironmentId: ws.activeEnvironmentId,
            history: ws.history || []
          },
          children: ws.collection || []
        }));
      }
    } catch (e) {
      console.warn('[AuraFetch] Workspaces legados corrompidos, limpando...', e);
      localStorage.removeItem('aurafetch_workspaces');
    }

    try {
      const oldCol = localStorage.getItem('aurafetch_collection');
      if (oldCol) {
        let parsedEnvs: Environment[] = [];
        try {
          const oldEnvs = localStorage.getItem('aurafetch_envs');
          parsedEnvs = oldEnvs ? JSON.parse(oldEnvs) : [];
        } catch { /* envs corrompidos, usar vazio */ }

        return [{
          id: 'ws_default',
          name: 'Workspace Padrão',
          type: 'workspace' as const,
          expanded: true,
          workspaceConfig: {
            environments: parsedEnvs,
            activeEnvironmentId: localStorage.getItem('aurafetch_env_active') || null,
            history: []
          },
          children: JSON.parse(oldCol)
        }];
      }
    } catch (e) {
      console.warn('[AuraFetch] Coleção legada corrompida, limpando...', e);
      localStorage.removeItem('aurafetch_collection');
      localStorage.removeItem('aurafetch_envs');
      localStorage.removeItem('aurafetch_env_active');
    }

    return null;
  };
  ```

- [ ] **Passo 5: Proteger o inicializador de `globalVariables` (linha ~392)**

  ```typescript
  // ANTES:
  const [globalVariables, setGlobalVariables] = useState<EnvVar[]>(() => {
    const saved = localStorage.getItem('aurafetch_globals');
    return saved ? JSON.parse(saved) : [];
  });

  // DEPOIS:
  const [globalVariables, setGlobalVariables] = useState<EnvVar[]>(() => {
    try {
      const saved = localStorage.getItem('aurafetch_globals');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('[AuraFetch] Variáveis globais corrompidas, limpando...', e);
      localStorage.removeItem('aurafetch_globals');
      return [];
    }
  });
  ```

- [ ] **Passo 6: Verificar manualmente**

  1. Abrir `npm run dev`
  2. No DevTools → Application → Local Storage, inserir:
     ```
     aurafetch_collection_v2 = "isto_nao_e_json"
     ```
  3. Recarregar a página — deve mostrar a tela inicial limpa, não tela branca

- [ ] **Passo 7: Rodar testes Cypress**

  ```bash
  npm run cypress:run
  ```
  Esperado: todos passando.

- [ ] **Passo 8: Commit**

  ```bash
  git add src/App.tsx src/main.tsx
  git commit -m "fix(core): protect localStorage JSON.parse with try/catch to prevent white screen on corrupt data"
  ```

---

## Tarefa 2: Corrigir travamento com resposta grande — mover resposta para fora da coleção

**Bugs corrigidos:** B5, B6, B8 (parcial)

**Por que:** O `useEffect` de persistência (linha 677) serializa a coleção inteira, incluindo `savedResponse.data` e `savedLogs`, para o localStorage a cada mudança de estado. Uma resposta grande ou uma imagem em base64 pode bloquear a thread ou exceder os 5MB do localStorage corrompendo tudo.

**Solução:** Mover `savedResponse` e `savedLogs` para um estado React separado, fora da coleção. `addLog` também precisa ser atualizado para escrever nesse estado separado.

**Arquivo:** `src/App.tsx`

- [ ] **Passo 1: Adicionar estados separados para resposta e logs**

  Localizar a área de declarações de estado, próximo à linha 485 (após `const [loading, ...]`). Adicionar:

  ```typescript
  // Resposta e logs ficam FORA da coleção — não são persistidos no localStorage
  const [activeResponse, setActiveResponse] = useState<RequestModel['savedResponse']>(null);
  const [activeLogs, setActiveLogs] = useState<LogEntry[]>([]);
  ```

- [ ] **Passo 2: Reescrever `addLog` para usar `setActiveLogs`**

  Localizar `addLog` (linha 643). Substituir completamente:

  ```typescript
  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const newLog: LogEntry = { id: uuidv4(), timestamp: new Date(), type, message, data };
    setActiveLogs(prev => [...prev, newLog]);
  };
  ```

  **Nota:** A lógica antiga de `addLog` escrevia em `collection` (para nós do tipo `request` e `folder`). Essa responsabilidade agora é do estado `activeLogs`. Os logs deixam de ser persistidos entre sessões — comportamento intencional para evitar o bloqueio do localStorage.

- [ ] **Passo 3: Criar função `switchActiveNode` para centralizar troca de nó**

  Localizar a declaração `const [activeNodeId, ...]` (linha ~477). Logo abaixo, substituir chamadas diretas a `setActiveNodeId` por uma função helper:

  ```typescript
  const switchActiveNode = (nodeId: string | null) => {
    setActiveNodeId(nodeId);
    setActiveResponse(null);
    setActiveLogs([]);
  };
  ```

  Buscar no arquivo todas as chamadas `setActiveNodeId(` e substituir por `switchActiveNode(`. Ocorrências esperadas: ~8-10 (em `addFolderTo`, `addRequestToFolder`, `addWebSocketToFolder`, `cloneRequest`, `confirmDelete`, etc.).

- [ ] **Passo 4: Modificar `handleActiveReqChange` para redirecionar `savedResponse` e `savedLogs`**

  Localizar `handleActiveReqChange` (linha 778). Substituir:

  ```typescript
  const handleActiveReqChange = (updates: Partial<RequestModel>) => {
    if (!activeNodeId) return;

    // Resposta e logs ficam em estado separado, não na coleção
    if ('savedResponse' in updates) {
      setActiveResponse(updates.savedResponse ?? null);
    }
    if ('savedLogs' in updates && updates.savedLogs !== undefined) {
      setActiveLogs(updates.savedLogs);
    }

    // Remover do objeto de updates para não persistir na coleção
    const collectionUpdates = { ...updates };
    delete collectionUpdates.savedResponse;
    delete collectionUpdates.savedLogs;

    if (Object.keys(collectionUpdates).length === 0) return;

    updateNodeInCollection(activeNodeId, (node) => {
      if (node.type !== 'request' || !node.request) return node;
      let nextReq = { ...node.request, ...collectionUpdates };
      if (collectionUpdates.url !== undefined) {
        nextReq.queryParams = syncUrlToQueryParams(collectionUpdates.url, nextReq.queryParams);
        nextReq.params = syncUrlToPathParams(collectionUpdates.url, nextReq.params);
      } else if (collectionUpdates.queryParams !== undefined) {
        nextReq.url = syncQueryParamsToUrl(nextReq.url, collectionUpdates.queryParams);
      }
      return { ...node, request: nextReq };
    });
  };
  ```

- [ ] **Passo 5: Atualizar referências de `activeReq.savedResponse` e `activeReq.savedLogs` no JSX**

  Buscar no arquivo e substituir **todas** as ocorrências abaixo:

  | Buscar | Substituir por |
  |---|---|
  | `activeReq?.savedResponse` | `activeResponse` |
  | `activeReq.savedResponse` | `activeResponse` |
  | `activeReq?.savedLogs` | `activeLogs` |
  | `activeReq.savedLogs` | `activeLogs` |

  Localizações específicas a verificar:
  - `copyResponse()` (linha ~1875): `activeReq.savedResponse` → `activeResponse`
  - `downloadResponse()` (linha ~1883): `activeReq?.savedResponse` → `activeResponse`
  - Botão "Limpar" no JSX (linha ~3626): `handleActiveReqChange({ savedResponse: null, savedLogs: [] })` → `setActiveResponse(null); setActiveLogs([]);`
  - Badge de status na aba "Resposta Renderizada" (linha ~3593): `activeReq?.savedResponse` → `activeResponse`
  - Badge de logs no Console (linha ~3601): `activeReq?.savedLogs` → `activeLogs`
  - `renderConsole` sendo chamado com `activeReq?.savedLogs` (linha ~3608, 3712)
  - CodeMirror no painel de resposta (linha ~3659): `activeReq.savedResponse.data` → `activeResponse?.data`

- [ ] **Passo 6: Verificar manualmente**

  1. Fazer uma requisição para `https://jsonplaceholder.typicode.com/posts`
  2. A resposta deve aparecer no painel normalmente
  3. Abrir DevTools → Local Storage — confirmar que `aurafetch_collection_v2` NÃO contém `savedResponse`
  4. Recarregar a página — a resposta sumiu (esperado e correto)
  5. Botão "Limpar" no painel de resposta deve funcionar
  6. Botão "Clipboard" deve copiar a resposta
  7. Console deve mostrar os logs da requisição

- [ ] **Passo 7: Rodar testes Cypress**

  ```bash
  npm run cypress:run
  ```

- [ ] **Passo 8: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "fix(core): move savedResponse and logs out of collection state to prevent large-response freeze and localStorage overflow"
  ```

---

## Tarefa 3: Corrigir travamento ao enviar arquivo — guard de tamanho e fallback web

**Bugs corrigidos:** B3, B4

**Por que:** `tauriReadFile` lê o arquivo inteiro na memória sem limite. Na versão web não há Tauri e a chamada falha com erro confuso.

**Arquivo:** `src/App.tsx`

- [ ] **Passo 1: Adicionar constante de limite de tamanho**

  Logo após as declarações de tipos (linha ~200):

  ```typescript
  const MAX_FILE_UPLOAD_MB = 50;
  const MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024;
  ```

- [ ] **Passo 2: Adicionar helper `readFileWithSizeGuard`**

  Antes de `handleSend` (linha ~1350):

  ```typescript
  const readFileWithSizeGuard = async (filePath: string, fileName: string): Promise<Uint8Array> => {
    if (!isTauri()) {
      throw new Error(`Upload de arquivo não disponível na versão web. Use o aplicativo desktop para enviar arquivos.`);
    }
    const bytes = await tauriReadFile(filePath);
    if (bytes.length > MAX_FILE_UPLOAD_BYTES) {
      throw new Error(
        `Arquivo "${fileName}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB ` +
        `(${(bytes.length / 1024 / 1024).toFixed(1)}MB). Reduza o tamanho do arquivo.`
      );
    }
    return bytes;
  };
  ```

  **Nota:** Usar `.length` em `Uint8Array` (não `.byteLength`) para checar o número de bytes.

- [ ] **Passo 3: Substituir `tauriReadFile` pelo helper no body binary (linha ~1493)**

  ```typescript
  // ANTES:
  const bytes = await tauriReadFile(activeReq.binaryFile.path);

  // DEPOIS:
  const bytes = await readFileWithSizeGuard(activeReq.binaryFile.path, activeReq.binaryFile.name);
  ```

- [ ] **Passo 4: Substituir `tauriReadFile` pelo helper no form-data (linha ~1506)**

  ```typescript
  // ANTES:
  const bytes = await tauriReadFile(f.fileInfo.path);

  // DEPOIS:
  const bytes = await readFileWithSizeGuard(f.fileInfo.path, f.fileInfo.name);
  ```

- [ ] **Passo 5: Verificar manualmente**

  1. Na versão web (`npm run dev`): tentar enviar uma requisição com body binary → deve aparecer log de erro: "Upload de arquivo não disponível na versão web."
  2. Na versão desktop (se disponível): testar com arquivo pequeno — deve funcionar normalmente.

- [ ] **Passo 6: Rodar testes Cypress**

  ```bash
  npm run cypress:run
  ```

- [ ] **Passo 7: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "fix(core): add file size guard and web fallback for binary/form-data upload to prevent freeze"
  ```

---

## Tarefa 4: Corrigir memory leak e stale closure do WebSocket

**Bugs corrigidos:** B7, B9, B13

**Nota:** `@tauri-apps/plugin-websocket` — `ws.addListener(cb)` retorna `() => void` (função de unlisten). Chamar essa função remove o listener.

**Arquivo:** `src/App.tsx`

- [ ] **Passo 1: Adicionar ref para a função de unlisten**

  Localizar `const wsInstRef = useRef<WebSocket | null>(null)` (linha ~1292). Adicionar logo abaixo:

  ```typescript
  const wsUnlistenRef = useRef<(() => void) | null>(null);
  ```

- [ ] **Passo 2: Reescrever `connectWs` com cleanup e sem stale closure**

  Substituir `connectWs` (linha ~1296-1326) completamente:

  ```typescript
  const connectWs = async () => {
    if (!activeReq || !activeNodeId) return;
    setLoading(true);
    const targetUrl = applyVariables(activeReq.url, activeReq.id);
    addLog('info', `🔌 Tentando conectar WebSocket em: ${targetUrl}`);

    try {
      // Remover listener anterior se existir
      if (wsUnlistenRef.current) {
        wsUnlistenRef.current();
        wsUnlistenRef.current = null;
      }

      const ws = await WebSocket.connect(targetUrl);
      wsInstRef.current = ws;
      setWsConnected(true);

      const nodeId = activeNodeId;

      handleActiveReqChange({
        wsMessages: [{ id: uuidv4(), type: 'info', text: 'Conectado a ' + targetUrl, timestamp: Date.now() }]
      });

      // addListener retorna () => void — a função de cleanup
      wsUnlistenRef.current = ws.addListener((msg) => {
        let textData = '';
        if (msg.type === 'Text') textData = msg.data as string;
        else if (msg.type === 'Binary') textData = '[Binary Message]';

        // Usar setCollection com updater funcional para evitar stale closure
        setCollection(prev => {
          const update = (nodes: CollectionNode[]): CollectionNode[] =>
            nodes.map(node => {
              if (node.id === nodeId && node.type === 'request' && node.request) {
                return {
                  ...node,
                  request: {
                    ...node.request,
                    wsMessages: [
                      ...(node.request.wsMessages || []),
                      { id: uuidv4(), type: 'received' as const, text: textData, timestamp: Date.now() }
                    ]
                  }
                };
              }
              if (node.children) return { ...node, children: update(node.children) };
              return node;
            });
          return update(prev);
        });

        addLog('info', `📨 WS recebido: ${textData.substring(0, 100)}${textData.length > 100 ? '...' : ''}`);
      });

    } catch (err: any) {
      addLog('error', `❌ Falha ao conectar WS: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  };
  ```

- [ ] **Passo 3: Atualizar `disconnectWs` para chamar unlisten**

  Localizar `disconnectWs` (linha ~1328). Adicionar cleanup no início:

  ```typescript
  const disconnectWs = async () => {
    if (wsUnlistenRef.current) {
      wsUnlistenRef.current();
      wsUnlistenRef.current = null;
    }
    if (wsInstRef.current) {
      await wsInstRef.current.disconnect();
      wsInstRef.current = null;
      setWsConnected(false);
      handleActiveReqChange({
        wsMessages: [...(activeReq!.wsMessages || []), { id: uuidv4(), type: 'info', text: 'Desconectado', timestamp: Date.now() }]
      });
      addLog('info', '🔌 WebSocket Desconectado');
    }
  };
  ```

- [ ] **Passo 4: Atualizar `switchActiveNode` para desconectar WS ao trocar de nó**

  Na função `switchActiveNode` criada na Tarefa 2, adicionar:

  ```typescript
  const switchActiveNode = (nodeId: string | null) => {
    // Desconectar WS ao trocar de nó
    if (wsUnlistenRef.current) {
      wsUnlistenRef.current();
      wsUnlistenRef.current = null;
    }
    if (wsInstRef.current) {
      wsInstRef.current.disconnect().catch(() => {});
      wsInstRef.current = null;
    }
    setWsConnected(false);
    setActiveNodeId(nodeId);
    setActiveResponse(null);
    setActiveLogs([]);
  };
  ```

- [ ] **Passo 5: Rodar testes WebSocket**

  ```bash
  npm run cypress:run -- --spec "cypress/e2e/websocket_ui.cy.ts"
  ```

- [ ] **Passo 6: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "fix(websocket): fix stale closure in message listener and cleanup unlisten on disconnect and node switch"
  ```

---

## Tarefa 5: Adicionar guards Tauri para funções de arquivo na versão web

**Dependência:** Esta tarefa depende da Tarefa 2 (que move `savedResponse` para `activeResponse`). Executar depois da Tarefa 2.

**Bug corrigido:** B10

**Arquivo:** `src/App.tsx`

- [ ] **Passo 1: Adicionar helper de download web**

  Antes de `exportCollection` (linha ~1826):

  ```typescript
  const downloadBlobWeb = (content: string, filename: string, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  ```

- [ ] **Passo 2: Adicionar guard em `exportCollection`**

  Localizar `exportCollection` (linha ~1826). Adicionar guard no início da função:

  ```typescript
  const exportCollection = async () => {
    try {
      const db = { collection, globals: globalVariables };
      const content = JSON.stringify(db, null, 2);

      if (!isTauri()) {
        downloadBlobWeb(content, 'aurafetch_workspace.json');
        addLog('success', '💾 Workspace exportado (download iniciado).');
        return;
      }

      // Versão desktop — código original:
      const filePath = await tauriSave({
        filters: [{ name: 'AuraFetch Workspace', extensions: ['json'] }],
        defaultPath: 'aurafetch_workspace.json'
      });
      if (filePath) {
        const encoder = new TextEncoder();
        await tauriWriteFile(filePath, encoder.encode(content));
        addLog('success', `💾 Workspace exportado com sucesso em: ${filePath}`);
      }
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown Error';
      addLog('error', `❌ Falha ao exportar workspace: ${msg}`);
    }
  };
  ```

- [ ] **Passo 3: Adicionar guard em `downloadResponse`**

  Localizar `downloadResponse` (linha ~1882). A primeira linha da função deve ser `if (!activeResponse) return;` (não `activeReq?.savedResponse` — já atualizado na Tarefa 2). Adicionar fallback web antes da lógica Tauri:

  ```typescript
  const downloadResponse = async () => {
    if (!activeResponse) return;
    try {
      const { data, type, contentType } = activeResponse;
      let extension = 'txt';
      if (type === 'json') extension = 'json';
      else if (type === 'image') extension = contentType?.split('/')[1]?.split(';')[0] || 'png';
      else if (type === 'pdf') extension = 'pdf';
      else if (type === 'html') extension = 'html';

      const safeName = activeReq!.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      if (!isTauri()) {
        if (type === 'image' || type === 'pdf') {
          // data já é uma data URL — criar link de download direto
          const a = document.createElement('a');
          a.href = data as string;
          a.download = `response_${safeName}.${extension}`;
          a.click();
        } else {
          const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
          downloadBlobWeb(content, `response_${safeName}.${extension}`, contentType || 'text/plain');
        }
        addLog('success', `📂 Download iniciado.`);
        return;
      }

      // Versão desktop — código original a partir daqui (sem alteração)
      const filePath = await tauriSave({ ... });
      // ... resto do código original
    } catch (err: any) {
      addLog('error', `❌ Falha ao salvar arquivo: ${err.message}`);
    }
  };
  ```

- [ ] **Passo 4: Adicionar guard em `pickBinaryFile` e `pickFormDataFile`**

  ```typescript
  const pickBinaryFile = async () => {
    if (!isTauri()) {
      addLog('error', '❌ Seleção de arquivo binário disponível apenas na versão desktop.');
      return;
    }
    // ... código original
  };

  const pickFormDataFile = async (fieldId: string) => {
    if (!isTauri()) {
      addLog('error', '❌ Seleção de arquivo para form-data disponível apenas na versão desktop.');
      return;
    }
    // ... código original
  };
  ```

- [ ] **Passo 5: Verificar manualmente na versão web**

  1. `npm run dev`
  2. Exportar workspace → deve iniciar download do JSON
  3. Fazer uma requisição e clicar em Download → deve iniciar download
  4. Tentar selecionar arquivo binário → deve aparecer log de erro claro

- [ ] **Passo 6: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "fix(web): add Tauri guards and web fallbacks for file export, download, and file picker"
  ```

---

## Tarefa 6: Corrigir P2 — console leaks, prompt() e import CSS

**Bugs corrigidos:** B11, B12, B14

**Arquivo:** `src/App.tsx`

- [ ] **Passo 1: Mover `import './index.css'` para o topo**

  Localizar linha 48: `import './index.css';`
  Mover para linha 1, antes de todos os outros imports. O resultado deve ser:
  ```typescript
  import './index.css';
  import React, { useState, useRef, useEffect, Fragment } from 'react';
  // ... restante dos imports
  ```

- [ ] **Passo 2: Remover `console.warn` de produção (linha ~1127)**

  ```typescript
  // REMOVER esta linha inteira:
  console.warn(`[Variables] No path found for node ${targetNodeId}. Variable resolution might fail.`);
  ```

- [ ] **Passo 3: Remover `console.error` de produção (linha ~1820)**

  ```typescript
  // REMOVER esta linha inteira:
  console.error('Folder Script Error:', err);
  ```

- [ ] **Passo 4: Substituir `prompt()` por input inline em `addWorkspace`**

  Localizar linha ~459. Primeiro adicionar os estados necessários perto das outras declarações de estado:

  ```typescript
  const [showNewWorkspaceInput, setShowNewWorkspaceInput] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  ```

  Reescrever `addWorkspace`:
  ```typescript
  const addWorkspace = () => {
    if (!newWorkspaceName.trim()) return;
    const name = newWorkspaceName.trim();
    const newWs: CollectionNode = {
      id: uuidv4(),
      name,
      type: 'workspace',
      expanded: true,
      workspaceConfig: {
        environments: [{ id: uuidv4(), name: 'Produção', variables: [] }],
        activeEnvironmentId: null,
        history: []
      },
      children: [{ id: uuidv4(), name: 'Nova Pasta', type: 'folder', children: [], folderConfig: { auth: { type: 'none' } } }]
    };
    setCollection(prev => [...prev, newWs]);
    setNewWorkspaceName('');
    setShowNewWorkspaceInput(false);
  };
  ```

  No JSX da sidebar, localizar onde o botão de "Novo Workspace" é renderizado e adicionar o input inline:
  ```tsx
  {showNewWorkspaceInput ? (
    <div style={{ display: 'flex', gap: '4px', padding: '4px 8px' }}>
      <input
        className="text-input"
        placeholder="Nome do workspace..."
        value={newWorkspaceName}
        autoFocus
        onChange={e => setNewWorkspaceName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') addWorkspace();
          if (e.key === 'Escape') { setShowNewWorkspaceInput(false); setNewWorkspaceName(''); }
        }}
        style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
      />
      <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addWorkspace}>OK</button>
    </div>
  ) : (
    <button ... onClick={() => setShowNewWorkspaceInput(true)}>+ Novo Workspace</button>
  )}
  ```

- [ ] **Passo 5: Rodar todos os testes Cypress**

  ```bash
  npm run cypress:run
  ```
  Esperado: todos os 5 suites passando.

- [ ] **Passo 6: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "fix(polish): remove console leaks, replace prompt() with inline input, fix CSS import position"
  ```

---

## Tarefa 7: Verificação Final e Deploy

- [ ] **Passo 1: Build de produção**

  ```bash
  npm run build
  ```
  Esperado: sem erros TypeScript, sem erros de build.

- [ ] **Passo 2: Rodar suite completa de testes**

  ```bash
  npm run cypress:run
  ```
  Esperado: todos os 5 suites passando.

- [ ] **Passo 3: Checklist de testes manuais**

  Abrir `npm run preview` (build local):
  - [ ] Fazer requisição para `https://jsonplaceholder.typicode.com/posts` → resposta aparece sem travar
  - [ ] Verificar que o localStorage NÃO contém `savedResponse` nos dados da coleção
  - [ ] Corromper localStorage (`aurafetch_collection_v2 = "invalido"`) e recarregar → app abre limpo, sem tela branca
  - [ ] Exportar workspace → arquivo JSON é baixado
  - [ ] Tentar enviar body binary → erro claro "disponível apenas na versão desktop"
  - [ ] Criar novo workspace via input inline (sem `prompt()`)
  - [ ] Abrir console do browser → nenhum `console.warn`/`console.error` visível

- [ ] **Passo 4: Push**

  ```bash
  git push origin main
  ```

---

## Resumo dos Commits

```
fix(core): protect localStorage JSON.parse with try/catch to prevent white screen on corrupt data
fix(core): move savedResponse and logs out of collection state to prevent large-response freeze and localStorage overflow
fix(core): add file size guard and web fallback for binary/form-data upload to prevent freeze
fix(websocket): fix stale closure in message listener and cleanup unlisten on disconnect and node switch
fix(web): add Tauri guards and web fallbacks for file export, download, and file picker
fix(polish): remove console leaks, replace prompt() with inline input, fix CSS import position
```
