import { useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useRequestContext } from '../context/RequestContext';
import { useEnvironment } from './useEnvironment';
import { useWebSocket } from './useWebSocket';
import { safeFetch, readFileWithSizeGuard, arrayBufferToBase64, base64ToUint8Array, MAX_FILE_UPLOAD_MB, MAX_FILE_UPLOAD_BYTES } from '../utils/safeFetch';
import { save as tauriSave } from '@tauri-apps/plugin-dialog';
import { writeFile as tauriWriteFile } from '@tauri-apps/plugin-fs';
import type { RequestModel, AuthConfig, RequestHeader, SavedResponse, CollectionNode, HistoryEntry, LogEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface UseRequestProps {
  collection: CollectionNode[];
  activeNodeId: string | null;
  activeReq: RequestModel | null;
  getActiveNode: (nodes: CollectionNode[], id: string) => CollectionNode | null;
  handleActiveReqChange: (updates: Partial<RequestModel> & { savedResponse?: SavedResponse | null; savedLogs?: LogEntry[] }) => void;
  setLoading: (loading: boolean) => void;
  setShowLoadingOverlay: (show: boolean) => void;
  reqTimeoutMs: number;
  setActiveResTab: (tab: 'response' | 'headers' | 'console') => void;
  setCopiedRes: (copied: boolean) => void;
  findParentWorkspace: (nodeId: string) => CollectionNode | null;
  getActiveEnvironment: (nodeId: string) => any;
  updateNodeInCollection: (nodeId: string, updater: (node: CollectionNode) => CollectionNode) => void;
  setGlobalVariables: (updater: (globals: any[]) => any[]) => void;
  switchActiveNode: (nodeId: string | null) => void;
  setCollection: (updater: (prev: CollectionNode[]) => CollectionNode[]) => void;
  addWorkspaceHistoryEntry: (nodeId: string, entry: HistoryEntry) => void;
  defaultRequest: RequestModel;
  defaultFolderAuth: AuthConfig;
  activeResponse: SavedResponse | null;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  loadingOverlayTimer: React.MutableRefObject<number | null>;
  handleSendRef: React.MutableRefObject<(() => void) | undefined>;
}

export const useRequest = ({
  collection,
  activeNodeId,
  activeReq,
  getActiveNode,
  handleActiveReqChange,
  setLoading,
  setShowLoadingOverlay,
  reqTimeoutMs,
  setActiveResTab,
  setCopiedRes,
  findParentWorkspace,
  getActiveEnvironment,
  updateNodeInCollection,
  setGlobalVariables,
  switchActiveNode,
  setCollection,
  addWorkspaceHistoryEntry,
  defaultRequest,
  defaultFolderAuth,
  activeResponse,
  abortControllerRef,
  loadingOverlayTimer,
  handleSendRef: _handleSendRef,
}: UseRequestProps) => {
  const { addLog, wsConnected } = useRequestContext();
  const { applyVariables } = useEnvironment();

  const { connectWs, disconnectWs } = useWebSocket({
    activeReq,
    activeNodeId,
    handleActiveReqChange,
    setLoading,
    setCollection,
  });

  // ========== FUNCTION 1: cancelReq ==========
  const cancelReq = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('warn', '🚨 Requisição cancelada pelo usuário.');
    }
  }, [addLog]);

  // ========== FUNCTION 2: generateCrudExample ==========
  const generateCrudExample = useCallback(() => {
    const authSetupScript = `// Exemplo prático de Login na API:
const res = await tauriFetch("{{base_url}}/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@empresa.com", password: "senha123" })
});
const data = await res.json();
aurafetch.setEnv("token_acesso", data.token);
aurafetch.log("Token renovado e salvo na pasta!");`;

    const envDevId = uuidv4();
    const envProdId = uuidv4();

    const workspaceId = uuidv4();
    const folderId = uuidv4();

    const newWorkspace: CollectionNode = {
      id: workspaceId,
      name: 'Workspace de Exemplo (CRUD)',
      type: 'workspace',
      expanded: true,
      workspaceConfig: {
        activeEnvironmentId: envDevId,
        history: [],
        environments: [
          {
            id: envDevId,
            name: 'DEV (LocalHost)',
            variables: [
              { id: uuidv4(), key: 'base_url', value: 'http://127.0.0.1:3333' },
              { id: uuidv4(), key: 'token_acesso', value: '' }
            ]
          },
          {
            id: envProdId,
            name: 'PROD (Nuvem)',
            variables: [
              { id: uuidv4(), key: 'base_url', value: 'https://api.empresa.com.br' },
              { id: uuidv4(), key: 'token_acesso', value: '' }
            ]
          }
        ]
      },
      children: [
        {
          id: folderId,
          name: 'API (Módulo de Usuários)',
          type: 'folder',
          expanded: true,
          folderConfig: {
            auth: {
              type: 'bearer',
              token: '{{token_acesso}}',
              username: '',
              password: ''
            },
            variables: [],
            setupScript: authSetupScript
          },
          children: [
            {
              id: uuidv4(),
              name: '1. Listar (GET)',
              type: 'request',
              request: {
                ...defaultRequest,
                id: uuidv4(),
                name: '1. Listar (GET)',
                method: 'GET',
                url: '{{base_url}}/users'
              }
            },
            {
              id: uuidv4(),
              name: '2. Exibir por ID (GET)',
              type: 'request',
              request: {
                ...defaultRequest,
                id: uuidv4(),
                name: '2. Exibir por ID (GET)',
                method: 'GET',
                url: '{{base_url}}/users/:id',
                params: [{ id: uuidv4(), key: 'id', value: '1', enabled: true }]
              }
            },
            {
              id: uuidv4(),
              name: '3. Salvar (POST)',
              type: 'request',
              request: {
                ...defaultRequest,
                id: uuidv4(),
                name: '3. Salvar (POST)',
                method: 'POST',
                url: '{{base_url}}/users',
                bodyType: 'json',
                body: '{\n  "name": "João Silva",\n  "email": "joao@email.com",\n  "role": "admin"\n}'
              }
            },
            {
              id: uuidv4(),
              name: '4. Editar (PUT)',
              type: 'request',
              request: {
                ...defaultRequest,
                id: uuidv4(),
                name: '4. Editar (PUT)',
                method: 'PUT',
                url: '{{base_url}}/users/:id',
                params: [{ id: uuidv4(), key: 'id', value: '1', enabled: true }],
                bodyType: 'json',
                body: '{\n  "role": "manager"\n}'
              }
            },
            {
              id: uuidv4(),
              name: '5. Deletar (DELETE)',
              type: 'request',
              request: {
                ...defaultRequest,
                id: uuidv4(),
                name: '5. Deletar (DELETE)',
                method: 'DELETE',
                url: '{{base_url}}/users/:id',
                params: [{ id: uuidv4(), key: 'id', value: '1', enabled: true }]
              }
            }
          ]
        }
      ]
    };

    setCollection((prev: CollectionNode[]) => [...prev, newWorkspace]);
    switchActiveNode(workspaceId);
    addLog('success', '📦 Nova Workspace de Exemplo criada com ambientes Prod/Dev e CRUD completo');
  }, [setCollection, switchActiveNode, addLog, defaultRequest]);

  // ========== FUNCTION 3: resolveAuth ==========
  const resolveAuth = useCallback((targetNodeId: string, nodes: CollectionNode[], currentParentAuth: AuthConfig = { type: 'none' }): AuthConfig | null => {
    for (const node of nodes) {
      if (node.id === targetNodeId) {
        if (node.type === 'request') {
          const reqAuth = node.request?.auth;
          if (reqAuth?.type === 'inherit') return currentParentAuth;
          return reqAuth || { type: 'none' };
        }
        return node.folderConfig?.auth || currentParentAuth;
      }
      if (node.children) {
        const folderAuth = node.folderConfig?.auth;
        let nextAuth = currentParentAuth;
        if (folderAuth && folderAuth.type !== 'none' && folderAuth.type !== 'inherit') {
          nextAuth = folderAuth;
        }
        const found = resolveAuth(targetNodeId, node.children, nextAuth);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // ========== FUNCTION 4: resolveHeaders ==========
  const resolveHeaders = useCallback((targetNodeId: string, nodes: CollectionNode[], currentParentHeaders: RequestHeader[] = []): RequestHeader[] => {
    for (const node of nodes) {
      if (node.id === targetNodeId) {
        return [...currentParentHeaders, ...(node.type === 'folder' ? (node.folderConfig?.headers || []) : [])];
      }
      if (node.children) {
        const folderHeaders = node.folderConfig?.headers || [];
        const nextHeaders = [...currentParentHeaders, ...folderHeaders];
        const found = resolveHeaders(targetNodeId, node.children, nextHeaders);
        if (found) return found;
      }
    }
    return [];
  }, []);

  // ========== WEBSOCKET HELPERS (moved to useWebSocket hook) ==========

  // ========== FUNCTION 5: handleSend ==========
  const handleSend = useCallback(async () => {
    if (!activeReq) return;
    if (activeReq.method === 'WS') {
      if (wsConnected) await disconnectWs();
      else await connectWs();
      return;
    }

    setLoading(true);
    setCopiedRes(false);

    abortControllerRef.current = new AbortController();
    setShowLoadingOverlay(false);
    if (loadingOverlayTimer.current) clearTimeout(loadingOverlayTimer.current);

    loadingOverlayTimer.current = window.setTimeout(() => {
      setShowLoadingOverlay(true);
    }, 3000);

    const startTime = Date.now();

    const nodeId = activeNodeId || activeReq.id;
    const parentWs = findParentWorkspace(nodeId);
    const activeEnv = getActiveEnvironment(nodeId);

    if (activeEnv) {
      addLog('info', `[Ambiente: ${activeEnv.name}] resolvendo variaveis para o disparo...`);
    } else if (parentWs) {
      addLog('warn', `[Aviso] Nenhum Ambiente ativo no Workspace "${parentWs.name}". Variaveis do ambiente nao serao resolvidas.`);
    } else {
      addLog('error', `[Erro de Escopo] Nao foi possivel localizar o Workspace para a requisicao selecionada.`);
    }

    let targetUrl = applyVariables(activeReq.url, nodeId);

    (activeReq.params || []).forEach(p => {
      if (p.enabled && p.key.trim()) {
        const key = p.key.trim();
        const value = applyVariables(p.value.trim(), activeReq.id);
        targetUrl = targetUrl.replace(new RegExp(`:${key}`, 'g'), value);
        targetUrl = targetUrl.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    });

    try {
      const queryParts = (activeReq.queryParams || [])
        .filter(q => q.enabled && q.key.trim())
        .map(q => `${encodeURIComponent(applyVariables(q.key.trim(), activeReq.id))}=${encodeURIComponent(applyVariables(q.value.trim(), activeReq.id))}`);

      if (queryParts.length > 0) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl += separator + queryParts.join('&');
      }
    } catch (e) {
      // Fallback
    }

    addLog('info', ` INICIANDO REQUISIÇÃO: ${activeReq.method} ${targetUrl}`);

    try {
      const fetchHeaders: HeadersInit = {};

      const inheritedHeaders = resolveHeaders(activeReq.id, collection);
      inheritedHeaders.forEach(h => {
        if (h.enabled && h.key.trim() && h.value.trim()) {
          fetchHeaders[applyVariables(h.key.trim(), activeReq.id)] = applyVariables(h.value.trim(), activeReq.id);
        }
      });

      activeReq.headers.forEach(h => {
        if (h.enabled && h.key.trim() && h.value.trim()) {
          fetchHeaders[applyVariables(h.key.trim(), activeReq.id)] = applyVariables(h.value.trim(), activeReq.id);
        }
      });

      const resolvedAuthConfig = resolveAuth(activeReq.id, collection);
      let finalTargetUrl = targetUrl;

      if (resolvedAuthConfig) {
        if (resolvedAuthConfig.type === 'bearer' && resolvedAuthConfig.token) {
          fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuthConfig.token, activeReq.id)}`;
        }
        else if (resolvedAuthConfig.type === 'oauth2' && resolvedAuthConfig.oauth2Config?.accessToken) {
          fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuthConfig.oauth2Config.accessToken, activeReq.id)}`;
        }
        else if (resolvedAuthConfig.type === 'basic' && resolvedAuthConfig.username) {
          const userStr = applyVariables(resolvedAuthConfig.username, activeReq.id);
          const passStr = applyVariables(resolvedAuthConfig.password || '', activeReq.id);
          const b64 = btoa(`${userStr}:${passStr}`);
          fetchHeaders['Authorization'] = `Basic ${b64}`;
        }
        else if (resolvedAuthConfig.type === 'apikey' && resolvedAuthConfig.apiKeyKey && resolvedAuthConfig.apiKeyValue) {
          const keyStr = applyVariables(resolvedAuthConfig.apiKeyKey, activeReq.id);
          const valStr = applyVariables(resolvedAuthConfig.apiKeyValue, activeReq.id);
          if (resolvedAuthConfig.apiKeyIn === 'header') {
            fetchHeaders[keyStr] = valStr;
          } else {
            const separator = finalTargetUrl.includes('?') ? '&' : '?';
            finalTargetUrl += `${separator}${encodeURIComponent(keyStr)}=${encodeURIComponent(valStr)}`;
          }
        }
      }

      const opts: RequestInit & { signal?: AbortSignal } = {
        method: activeReq.method,
        headers: fetchHeaders,
        signal: abortControllerRef.current?.signal
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeReq.method) && activeReq.bodyType !== 'none') {
        if (activeReq.bodyType === 'json' && activeReq.body) {
          opts.body = applyVariables(activeReq.body, activeReq.id);
          const hasContentType = Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type');
          if (!hasContentType) fetchHeaders['Content-Type'] = 'application/json';
        }
        else if (activeReq.bodyType === 'graphql' && activeReq.graphqlQuery) {
          const bodyPayload = {
            query: applyVariables(activeReq.graphqlQuery, activeReq.id),
            variables: activeReq.graphqlVariables ? JSON.parse(applyVariables(activeReq.graphqlVariables, activeReq.id)) : {}
          };
          opts.body = JSON.stringify(bodyPayload);
          const hasContentType = Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type');
          if (!hasContentType) fetchHeaders['Content-Type'] = 'application/json';
        }
        else if (activeReq.bodyType === 'urlencoded') {
          const params = new URLSearchParams();
          activeReq.formData.forEach(f => {
            if (f.enabled && f.key) params.append(applyVariables(f.key, activeReq.id), applyVariables(f.value, activeReq.id));
          });
          opts.body = params.toString();
          const hasContentType = Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type');
          if (!hasContentType) fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        else if (activeReq.bodyType === 'binary' && activeReq.binaryFile) {
          let bytes: Uint8Array<ArrayBuffer>;
          if (!isTauri() && activeReq.webBinaryFile) {
            if (activeReq.webBinaryFile.size > MAX_FILE_UPLOAD_BYTES) {
              throw new Error(`Arquivo "${activeReq.webBinaryFile.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB`);
            }
            bytes = new Uint8Array(await activeReq.webBinaryFile.arrayBuffer()) as Uint8Array<ArrayBuffer>;
          } else if (!isTauri() && !activeReq.webBinaryFile) {
            throw new Error(
              `Arquivo "${activeReq.binaryFile.name}" precisa ser selecionado novamente. ` +
              `Clique em "Alterar Arquivo" para re-selecionar.`
            );
          } else {
            bytes = await readFileWithSizeGuard(activeReq.binaryFile.path, activeReq.binaryFile.name);
          }
          opts.body = bytes;
          const hasContentType = Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type');
          if (!hasContentType) fetchHeaders['Content-Type'] = 'application/octet-stream';
        }
        else if (activeReq.bodyType === 'form-data') {
          const fd = new FormData();
          for (const f of activeReq.formData) {
            if (!f.enabled || !f.key) continue;
            const key = applyVariables(f.key, activeReq.id);
            if (f.type === 'text') {
              fd.append(key, applyVariables(f.value, activeReq.id));
            } else if (f.fileInfo) {
              let bytes: Uint8Array<ArrayBuffer>;
              if (!isTauri() && f.webFile) {
                if (f.webFile.size > MAX_FILE_UPLOAD_BYTES) {
                  throw new Error(`Arquivo "${f.webFile.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB`);
                }
                bytes = new Uint8Array(await f.webFile.arrayBuffer()) as Uint8Array<ArrayBuffer>;
              } else if (!isTauri() && !f.webFile) {
                throw new Error(
                  `Arquivo "${f.fileInfo.name}" precisa ser selecionado novamente. ` +
                  `Clique em "Trocar" para re-selecionar.`
                );
              } else {
                bytes = await readFileWithSizeGuard(f.fileInfo.path, f.fileInfo.name);
              }
              fd.append(key, new Blob([bytes], { type: 'application/octet-stream' }), f.fileInfo.name);
            }
          }
          opts.body = fd;
          const contentHeader = Object.keys(fetchHeaders).find(k => k.toLowerCase() === 'content-type');
          if (contentHeader) delete fetchHeaders[contentHeader];
        }
      }

      if (!finalTargetUrl.startsWith('http') && !finalTargetUrl.includes('://')) {
        if (!finalTargetUrl.startsWith('{{')) {
          throw new Error('A URL resolvida aparentemente é inválida: ' + finalTargetUrl);
        }
      }

      const reqOutput: any = {
        Method: activeReq.method,
        URL: finalTargetUrl,
        Headers: fetchHeaders
      };

      if (opts.body) {
        let parsedBody = opts.body;
        try { parsedBody = JSON.parse(opts.body as string); } catch { }
        reqOutput.Body = parsedBody;
      }

      addLog('log', `▶️ REQ OUT: Request Packet -> ${finalTargetUrl}`, reqOutput);

      const fetchTimeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort('Timeout configurável excedido');
        }
      }, reqTimeoutMs);

      const res = await safeFetch(finalTargetUrl, opts);
      clearTimeout(fetchTimeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data: any;
      let responseType: 'json' | 'image' | 'pdf' | 'html' | 'text' | 'binary' = 'text';

      if (contentType.includes('image/')) {
        const buffer = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buffer);
        data = `data:${contentType.split(';')[0]};base64,${b64}`;
        responseType = 'image';
      } else if (contentType.includes('application/pdf')) {
        const buffer = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buffer);
        data = `data:application/pdf;base64,${b64}`;
        responseType = 'pdf';
      } else {
        const isText = contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/xml') ||
          contentType.includes('application/javascript');

        if (!isText && (contentType.includes('application/') || contentType.includes('font/'))) {
          const buffer = await res.arrayBuffer();
          const b64 = arrayBufferToBase64(buffer);
          const mime = contentType.split(';')[0] || 'application/octet-stream';
          data = `data:${mime};base64,${b64}`;
          responseType = 'binary';
        } else {
          const text = await res.text();
          if (contentType.includes('application/json')) {
            try {
              data = JSON.parse(text);
              responseType = 'json';
            } catch {
              data = text;
              responseType = 'text';
            }
          } else if (contentType.includes('text/html')) {
            data = text;
            responseType = 'html';
          } else {
            try {
              data = JSON.parse(text);
              responseType = 'json';
            } catch {
              data = text || "(Sem corpo / Resposta vazia)";
              responseType = 'text';
            }
          }
        }
      }

      const timeMs = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => responseHeaders[key] = val);

      const savedResponse = {
        status: res.status,
        statusText: res.statusText,
        data,
        time: timeMs,
        type: responseType,
        contentType,
        headers: responseHeaders
      };

      handleActiveReqChange({ savedResponse });

      const newHistoryEntry: HistoryEntry = {
        id: uuidv4(),
        requestId: activeReq.id,
        requestName: activeReq.name,
        method: activeReq.method,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        status: res.status
      };
      addWorkspaceHistoryEntry(activeReq.id, newHistoryEntry);

      const resOutput: any = {
        Status: `${res.status} ${res.statusText || ''}`.trim(),
        Time: `${timeMs}ms`,
        Headers: responseHeaders,
        Type: responseType,
        Body: responseType === 'image' || responseType === 'pdf' ? '[Binary Content]' : data
      };

      const statusLog = res.status >= 200 && res.status < 300 ? 'success' : 'warn';
      const statusText = res.statusText ? ` ${res.statusText}` : '';
      addLog(statusLog, `◀️ RES IN: HTTP ${res.status}${statusText} [Tempo: ${timeMs}ms]`, resOutput);

    } catch (err: any) {
      const timeMs = Date.now() - startTime;
      let errData = "Erro Desconhecido";
      let errName = "Network Error";

      if (err) {
        errData = err.message || err.toString?.() || JSON.stringify(err) || "Erro Desconhecido";
        if (err.name === 'AbortError') {
           errName = 'Abortado';
           errData = typeof err.message === 'string' && err.message.includes('Timeout') ? 'Timeout excedido (Cancelado)' : 'Requisição abortada pelo usuário';
        } else if (err.name) {
           errName = err.name;
        }
      }

      handleActiveReqChange({
        savedResponse: {
          status: 0,
          statusText: errName,
          data: errData,
          time: timeMs
        }
      });

      const errHistoryEntry: HistoryEntry = {
        id: uuidv4(),
        requestId: activeReq.id,
        requestName: activeReq.name,
        method: activeReq.method,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        status: 0
      };
      addWorkspaceHistoryEntry(activeReq.id, errHistoryEntry);

      const errOutput = {
        Status: "0 Network Error",
        Time: `${timeMs}ms`,
        Error: errData,
        Note: "Possible CORS, DNS issue, timeout, connection refused or manual abort."
      };

      addLog('error', `Falha no disparo. Erro: ${errData}`, errOutput);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setShowLoadingOverlay(false);
      if (loadingOverlayTimer.current) {
        clearTimeout(loadingOverlayTimer.current);
      }
    }
  }, [activeReq, activeNodeId, collection, applyVariables, resolveHeaders, resolveAuth, setLoading, setCopiedRes, setShowLoadingOverlay, findParentWorkspace, getActiveEnvironment, addLog, handleActiveReqChange, addWorkspaceHistoryEntry, reqTimeoutMs, connectWs, disconnectWs, wsConnected]);

  // ========== FUNCTION 6: runFolderScript ==========
  const runFolderScript = useCallback(async (nodeId: string) => {
    const node = getActiveNode(collection, nodeId);
    if (!node || node.type !== 'folder' || !node.folderConfig?.setupScript) return;

    setLoading(true);
    addLog('info', `Executando script da pasta...`);
    setActiveResTab('console');

    try {
      const scriptBody = node.folderConfig.setupScript;

      const aurafetchCtx = {
        setEnv: (key: string, value: any) => {
          if (value === undefined || value === null) {
            addLog('error', `[aurafetch] Tentativa de salvar '${key}' com valor nulo ou indefinido.`);
            return;
          }
          const finalVal = String(value);
          const wsNode = findParentWorkspace(nodeId);
          const wsEnvId = wsNode?.workspaceConfig?.activeEnvironmentId;
          if (wsNode && wsEnvId) {
            updateNodeInCollection(wsNode.id, (wsN) => {
              if (wsN.type !== 'workspace' || !wsN.workspaceConfig) return wsN;
              return {
                ...wsN,
                workspaceConfig: {
                  ...wsN.workspaceConfig,
                  environments: wsN.workspaceConfig.environments.map(env => {
                    if (env.id !== wsEnvId) return env;
                    const exists = env.variables.find(v => v.key === key);
                    if (exists) return { ...env, variables: env.variables.map(v => v.key === key ? { ...v, value: finalVal } : v) };
                    return { ...env, variables: [...env.variables, { id: uuidv4(), key, value: finalVal }] };
                  })
                }
              };
            });
            addLog('success', `[aurafetch] Variavel de Ambiente '${key}' salva (${finalVal.substring(0, 10)}...)`);
          } else {
            setGlobalVariables((globals: any[]) => {
              const exists = globals.find((v: any) => v.key === key);
              if (exists) return globals.map((v: any) => v.key === key ? { ...v, value: finalVal } : v);
              return [...globals, { id: uuidv4(), key, value: finalVal }];
            });
            addLog('success', `[aurafetch] Variavel Global '${key}' salva`);
          }
        },
        setVar: (key: string, value: any) => {
          if (value === undefined || value === null) {
            addLog('error', `[aurafetch] Tentativa de salvar '${key}' na pasta com valor nulo ou indefinido.`);
            return;
          }
          const finalVal = String(value);
          updateNodeInCollection(nodeId, (folder) => {
            if (folder.type !== 'folder') return folder;
            const vars = folder.folderConfig?.variables || [];
            const exists = vars.find(v => v.key === key);
            const newVars = exists
              ? vars.map(v => v.key === key ? { ...v, value: finalVal } : v)
              : [...vars, { id: uuidv4(), key, value: finalVal }];
            return {
              ...folder,
              folderConfig: { ...(folder.folderConfig || { auth: defaultFolderAuth, variables: [] }), variables: newVars }
            };
          });
          addLog('success', `[aurafetch] Variavel da Pasta '${key}' = ${finalVal.substring(0, 10)}...`);
        },
        log: (msg: any) => addLog('log', `[aurafetch] ${typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg}`)
      };

      const customFetch = async (url: string, options?: RequestInit) => {
        const finalUrl = applyVariables(url, node.id);
        const finalOpts = { ...options };
        if (finalOpts && finalOpts.headers) {
          const newHeaders: any = {};
          for (const [k, v] of Object.entries(finalOpts.headers)) {
            newHeaders[applyVariables(k, node.id)] = applyVariables(v as string, node.id);
          }
          finalOpts.headers = newHeaders;
        }
        if (finalOpts && typeof finalOpts.body === 'string') {
          finalOpts.body = applyVariables(finalOpts.body, node.id);
        }

        addLog('info', `[fetch] Chamada externa: ${finalUrl}`, {
          method: finalOpts.method || 'GET',
          headers: finalOpts.headers,
          body: finalOpts.body
        });

        try {
          const res = await safeFetch(finalUrl, finalOpts);
          const txt = await res.text();
          let parsed: any = txt;
          try { parsed = JSON.parse(txt); } catch { }

          const statusLog = res.status >= 200 && res.status < 300 ? 'success' : 'warn';
          addLog(statusLog, `[fetch] Resposta: ${res.status} ${res.statusText}`, parsed);

          return {
            ...res,
            text: async () => txt,
            json: async () => typeof parsed === 'string' ? JSON.parse(parsed) : parsed
          } as any;
        } catch (e: any) {
          addLog('error', `[fetch] Falha na rede: ${e.message}`);
          throw e;
        }
      };

      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
      const fn = new AsyncFunction('aurafetch', 'fetch', 'tauriFetch', scriptBody);

      await fn(aurafetchCtx, customFetch, customFetch);

      addLog('success', `Script finalizado. Variaveis injetadas com sucesso.`);
    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Erro interno desconhecido';
      addLog('error', `Falha no Script: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [collection, getActiveNode, setLoading, addLog, setActiveResTab, findParentWorkspace, updateNodeInCollection, setGlobalVariables, applyVariables, defaultFolderAuth]);

  // ========== FUNCTION 7: downloadBlobWeb ==========
  const downloadBlobWeb = useCallback((content: string, filename: string, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ========== FUNCTION 8: copyResponse ==========
  const copyResponse = useCallback(() => {
    if (!activeResponse) return;
    const stringData = typeof activeResponse.data === 'object' ? JSON.stringify(activeResponse.data, null, 2) : String(activeResponse.data);
    navigator.clipboard.writeText(stringData);
    setCopiedRes(true);
    setTimeout(() => setCopiedRes(false), 2000);
  }, [activeResponse, setCopiedRes]);

  // ========== FUNCTION 9: downloadResponse ==========
  const downloadResponse = useCallback(async () => {
    if (!activeResponse) return;
    try {
      const { data, type, contentType } = activeResponse;
      const isBinaryDataUrl = typeof data === 'string' && data.startsWith('data:');

      const mimeToExt: Record<string, string> = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
        'image/tiff': 'tiff', 'image/x-icon': 'ico', 'image/avif': 'avif',
        'application/pdf': 'pdf', 'application/json': 'json',
        'application/xml': 'xml', 'text/xml': 'xml',
        'application/zip': 'zip', 'application/gzip': 'gz',
        'application/x-gzip': 'gz', 'application/x-tar': 'tar',
        'application/x-7z-compressed': '7z', 'application/x-rar-compressed': 'rar',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.ms-excel': 'xls', 'application/msword': 'doc',
        'application/vnd.ms-powerpoint': 'ppt',
        'text/html': 'html', 'text/css': 'css', 'text/javascript': 'js',
        'text/csv': 'csv', 'text/plain': 'txt',
        'application/javascript': 'js', 'application/typescript': 'ts',
        'application/wasm': 'wasm',
        'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
        'video/mp4': 'mp4', 'video/webm': 'webm',
        'font/woff': 'woff', 'font/woff2': 'woff2', 'font/ttf': 'ttf', 'font/otf': 'otf',
      };

      const mime = contentType?.split(';')[0]?.trim().toLowerCase() || '';
      let extension = mimeToExt[mime] || '';
      if (!extension) {
        if (type === 'json') extension = 'json';
        else if (type === 'image') extension = 'png';
        else if (type === 'pdf') extension = 'pdf';
        else if (type === 'html') extension = 'html';
        else if (type === 'binary') extension = 'bin';
        else extension = 'txt';
      }

      const safeName = (activeReq?.name ?? 'response').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `response_${safeName}.${extension}`;

      if (!isTauri()) {
        if (isBinaryDataUrl) {
          const b64 = (data as string).split(',')[1];
          const bytes = base64ToUint8Array(b64);
          const mime = contentType?.split(';')[0] || 'application/octet-stream';
          const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
          downloadBlobWeb(content, fileName, contentType || 'text/plain');
        }
        addLog('success', `Download iniciado.`);
        return;
      }

      const filePath = await tauriSave({
        filters: [{ name: 'Arquivo de Resposta', extensions: [extension] }],
        defaultPath: fileName
      });

      if (filePath) {
        if (isBinaryDataUrl) {
          const b64Data = (data as string).split(',')[1];
          const bytes = base64ToUint8Array(b64Data);
          await tauriWriteFile(filePath, bytes);
        } else {
          const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
          const encoder = new TextEncoder();
          await tauriWriteFile(filePath, encoder.encode(content));
        }
        addLog('success', `Arquivo salvo em: ${filePath}`);
      }
    } catch (err: any) {
      addLog('error', `Falha ao salvar arquivo: ${err.message}`);
    }
  }, [activeResponse, activeReq, downloadBlobWeb, addLog]);

  return {
    handleSend,
    cancelReq,
    resolveAuth,
    resolveHeaders,
    runFolderScript,
    downloadBlobWeb,
    downloadResponse,
    copyResponse,
    generateCrudExample,
  };
};
