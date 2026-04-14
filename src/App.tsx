import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRequestContext } from './context/RequestContext';
import { useCollection } from './hooks/useCollection';
import { useEnvironment } from './hooks/useEnvironment';
import { useRequest } from './hooks/useRequest';
import { useWebSocket } from './hooks/useWebSocket';
import {
  Folder, FileText, Plus, Download, Upload,
  Play, Square, Trash2, Send, Clock, Terminal,
  Copy, Check, Globe, Layers, Database, BarChart3, Settings, Shield, Code, Network
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { graphql } from 'cm6-graphql';
import { oneDark } from '@codemirror/theme-one-dark';
import { open as tauriOpen } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { MAX_FILE_UPLOAD_MB, MAX_FILE_UPLOAD_BYTES, base64ToUint8Array } from './utils/safeFetch';
import { Sidebar } from './components/layout/Sidebar';
import { DevToolsPanel } from './components/devtools/DevToolsPanel';

import type { HttpMethod, AuthType, RequestHeader, AuthConfig, RequestBodyType, RequestModel, SavedResponse, CollectionNode, LogEntry } from './types';

// Initial Data
const defaultRequest: RequestModel = {
  id: uuidv4(),
  name: 'Nova Requisição',
  method: 'GET',
  url: '{{base_url}}/todos/1',
  auth: { type: 'inherit' },
  headers: [
    { id: uuidv4(), key: 'Content-Type', value: 'application/json', enabled: true },
    { id: uuidv4(), key: 'Accept', value: 'application/json', enabled: true }
  ],
  queryParams: [],
  params: [],
  body: '',
  bodyType: 'json',
  formData: [],
  binaryFile: null
};

const defaultFolderAuth: AuthConfig = {
  type: 'none'
};

const renderOAuth2Fields = (config: AuthConfig['oauth2Config'], onChange: (updates: Partial<AuthConfig['oauth2Config']>) => void) => {
  const c = config || { clientId: '', clientSecret: '', accessTokenUrl: '', authUrl: '', scope: '', accessToken: '' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>Access Token (Opcional se já tiver)</label>
        <input className="text-input" placeholder="eyJhbG..." value={c.accessToken} onChange={e => onChange({ accessToken: e.target.value })} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
      </div>
      <div>
        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>Client ID</label>
        <input className="text-input" value={c.clientId} onChange={e => onChange({ clientId: e.target.value })} style={{ width: '100%' }} />
      </div>
      <div>
        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>Client Secret</label>
        <input className="text-input" type="password" value={c.clientSecret} onChange={e => onChange({ clientSecret: e.target.value })} style={{ width: '100%' }} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>Access Token URL</label>
        <input className="text-input" placeholder="https://auth.example.com/token" value={c.accessTokenUrl} onChange={e => onChange({ accessTokenUrl: e.target.value })} style={{ width: '100%' }} />
      </div>
    </div>
  );
};

// URL Synchronization Helpers
const syncQueryParamsToUrl = (url: string, queryParams: RequestHeader[]) => {
  try {
    const baseUrl = url.split('?')[0];
    const searchParams = new URLSearchParams();
    (queryParams || []).forEach(q => {
      if (q.enabled && q.key.trim()) {
        searchParams.append(q.key.trim(), q.value);
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  } catch {
    return url;
  }
};

const syncUrlToQueryParams = (url: string, currentQueries: RequestHeader[]) => {
  try {
    const queryString = url.split('?')[1] || '';
    if (!queryString && url.indexOf('?') === -1) return (currentQueries || []).filter(q => !q.enabled);

    const params = new URLSearchParams(queryString);
    const newQueries: RequestHeader[] = [];
    const seen = new Set();

    params.forEach((value, key) => {
      const existing = (currentQueries || []).find(q => q.key === key && q.value === value && q.enabled && !seen.has(q.id));
      const id = existing?.id || uuidv4();
      newQueries.push({ id, key, value, enabled: true });
      seen.add(id);
    });

    (currentQueries || []).forEach(q => {
      if (!q.enabled) newQueries.push(q);
    });

    return newQueries;
  } catch {
    return currentQueries;
  }
};

const syncUrlToPathParams = (url: string, currentParams: RequestHeader[]) => {
  const matches = Array.from(url.matchAll(/(?:^|\/):([a-zA-Z0-9_-]+)(?=\/|$|\?|#)/g)).map(m => m[1]);
  const matches2 = Array.from(url.matchAll(/(?<!\{)\{([a-zA-Z0-9_-]+)\}(?!\})/g)).map(m => m[1]);
  const keys = [...new Set([
    ...matches,
    ...matches2
  ])];

  const newParams: RequestHeader[] = [];
  keys.forEach(key => {
    const existing = (currentParams || []).find(p => p.key === key);
    newParams.push({
      id: existing?.id || uuidv4(),
      key,
      value: existing?.value || '',
      enabled: true
    });
  });
  return newParams;
};

const AutoScrollEnd = ({ dependency }: { dependency: any }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dependency]);
  return <div ref={endRef} />;
};

export default function App() {
  // ---------------------------------------------------------
  // REQUEST CONTEXT (Global state from RequestProvider)
  // ---------------------------------------------------------
  const {
    collection, setCollection,
    globalVariables, setGlobalVariables,
    activeNodeId, setActiveNodeId,
    activeResponse, setActiveResponse,
    activeLogs, setActiveLogs, addLog,
    wsConnected, setWsConnected,
    wsInputMessage, setWsInputMessage,
  } = useRequestContext();

  // All state declarations BEFORE the hook

  // ---------------------------------------------------------
  // COLLECTION HOOK
  // ---------------------------------------------------------
  const { findParentWorkspace, addWorkspaceHistoryEntry,
    updateNodeInCollection, importCollection: importCollectionHook, exportCollection: exportCollectionHook,
    addRequestToFolder, addWebSocketToFolder, addFolderTo } = useCollection();

  // Wrappers for import/export that match the hook's parameter expectations
  const exportCollection = async () => {
    await exportCollectionHook(globalVariables);
  };

  const importCollection = (e: React.ChangeEvent<HTMLInputElement>) => {
    importCollectionHook(e, setGlobalVariables, setActiveNodeId);
  };

  // Environment hook
  const {
    getActiveEnvironment,
    getWorkspaceEnvironments,
    getWorkspaceActiveEnvId,
    setWorkspaceActiveEnvId,
    applyVariables,
    addEnv: addEnvHook,
    removeEnv: removeEnvHook,
  } = useEnvironment();

  // Mode (HTTP Client | DevTools)
  const [mode, setMode] = useState<'http' | 'devtools'>('http');

  // Tabs
  const [activeReqTab, setActiveReqTab] = useState<'auth' | 'headers' | 'body' | 'params' | 'queries'>('auth');
  const [activeFolderSettingTab, setActiveFolderSettingTab] = useState<'auth' | 'vars' | 'headers' | 'script'>('auth');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'environments' | 'globals' | 'summary'>('environments');
  const [activeResTab, setActiveResTab] = useState<'response' | 'headers' | 'console'>('response');

  const [loading, setLoading] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  const { wsInstRef, wsUnlistenRef } = useWebSocket();

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

  // Timeouts & Abort Controllers
  const [reqTimeoutMs, setReqTimeoutMs] = useState<number>(30000);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const loadingOverlayTimer = useRef<number | null>(null);



  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeSnippetLang, setCodeSnippetLang] = useState('curl');

  // Interval
  const [intervalMs, setIntervalMs] = useState(5000);
  const [isLooping, setIsLooping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Layout & Drag and Drop
  const [leftPanelWidth, setLeftPanelWidth] = useState(800);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setLeftPanelWidth(Math.max(400, e.clientX - 280)); // 280 sidebar width
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Loop Engine (Automation)
  useEffect(() => {
    if (isLooping) {
      addLog('info', `🔁 Automação Iniciada. Executando a cada ${intervalMs}ms.`);
      intervalRef.current = setInterval(() => {
        if (handleSendRef.current) handleSendRef.current();
      }, intervalMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        addLog('warn', '🛑 Automação Interrompida.');
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLooping, intervalMs, addLog]);


  const handleSendRef = useRef<() => void>(undefined);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (handleSendRef.current) handleSendRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const getActiveNode = (nodes: CollectionNode[], id: string | null): CollectionNode | null => {
    if (!id) return null;
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = getActiveNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeNode = getActiveNode(collection, activeNodeId);
  const activeReq = activeNode?.type === 'request' ? activeNode.request! : null;

  // Convert data-URL responses to Blob URLs for PDF/binary iframe preview.
  // Data URLs fail in WebView2/some browsers. Blob URLs are universally supported.
  const responseBlobUrl = useMemo(() => {
    if (!activeResponse) return null;
    const { data, type } = activeResponse;
    if ((type === 'pdf' || type === 'image' || type === 'binary') && typeof data === 'string' && data.startsWith('data:')) {
      try {
        const [header, b64] = data.split(',');
        const mime = header.split(':')[1]?.split(';')[0] || 'application/octet-stream';
        const bytes = base64ToUint8Array(b64);
        return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
      } catch {
        return null;
      }
    }
    return null;
  }, [activeResponse]);

  // Revoke previous Blob URL on change
  useEffect(() => {
    return () => {
      if (responseBlobUrl) URL.revokeObjectURL(responseBlobUrl);
    };
  }, [responseBlobUrl]);

  const handleActiveReqChange = (updates: Partial<RequestModel> & { savedResponse?: SavedResponse | null; savedLogs?: LogEntry[] }) => {
    if (!activeNodeId) return;

    // Redirect response and logs to separate state — not stored in collection
    if ('savedResponse' in updates) {
      setActiveResponse(updates.savedResponse ?? null);
    }
    if ('savedLogs' in updates && updates.savedLogs !== undefined) {
      setActiveLogs(updates.savedLogs);
    }

    // Remove from collection updates
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

  const handleActiveFolderConfigChange = (updates: Partial<CollectionNode['folderConfig']>) => {
    if (!activeNodeId) return;
    updateNodeInCollection(activeNodeId, (node) => {
      if (node.type !== 'folder') return node;
      return {
        ...node,
        folderConfig: { ...(node.folderConfig || { auth: defaultFolderAuth, variables: [] }), ...updates }
      };
    });
  };

  // Call useRequest hook with all dependencies
  const {
    handleSend,
    cancelReq,
    resolveAuth,
    resolveHeaders,
    runFolderScript,
    downloadResponse,
    copyResponse,
    generateCrudExample,
  } = useRequest({
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
    handleSendRef,
  });


  // --- VARIABLES ENGINE (HIERARCHY RESOLUTION) ---


  const generateCodeSnippet = (req: RequestModel, lang: string): string => {
    let targetUrl = applyVariables(req.url, req.id);

    // Apply Path Params first
    (req.params || []).forEach(p => {
      if (p.enabled && p.key.trim()) {
        const key = p.key.trim();
        const value = applyVariables(p.value.trim(), req.id);
        targetUrl = targetUrl.replace(new RegExp(`:${key}`, 'g'), value);
        targetUrl = targetUrl.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    });

    // Rebuild Query String to avoid duplication
    try {
      const parts = targetUrl.split('?');
      const baseUrlForSnip = parts[0];
      const urlObjForSnippet = new URL(baseUrlForSnip.includes('://') ? baseUrlForSnip : `http://localhost/${baseUrlForSnip}`);

      // Clear all existing search params
      urlObjForSnippet.search = '';

      (req.queryParams || []).forEach(q => {
        if (q.enabled && q.key.trim()) {
          urlObjForSnippet.searchParams.append(applyVariables(q.key.trim(), req.id), applyVariables(q.value.trim(), req.id));
        }
      });

      if (!targetUrl.includes('://')) {
        targetUrl = urlObjForSnippet.toString().replace('http://localhost/', '');
      } else {
        targetUrl = urlObjForSnippet.toString();
      }
    } catch (e) {
      // Fallback
    }

    const resolvedAuth = resolveAuth(req.id, collection);
    const fetchHeaders: Record<string, string> = {};

    const inheritedHeaders = resolveHeaders(req.id, collection);
    inheritedHeaders.forEach(h => {
      if (h.enabled && h.key && h.value) fetchHeaders[applyVariables(h.key, req.id)] = applyVariables(h.value, req.id);
    });

    req.headers.forEach(h => {
      if (h.enabled && h.key && h.value) fetchHeaders[applyVariables(h.key, req.id)] = applyVariables(h.value, req.id);
    });

    if (resolvedAuth) {
      if (resolvedAuth.type === 'bearer' && resolvedAuth.token) fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuth.token, req.id)}`;
      else if (resolvedAuth.type === 'oauth2' && resolvedAuth.oauth2Config?.accessToken) fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuth.oauth2Config.accessToken, req.id)}`;
      else if (resolvedAuth.type === 'basic' && resolvedAuth.username) {
        const u = applyVariables(resolvedAuth.username, req.id);
        const p = applyVariables(resolvedAuth.password || '', req.id);
        fetchHeaders['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
      }
      else if (resolvedAuth.type === 'apikey' && resolvedAuth.apiKeyKey && resolvedAuth.apiKeyValue) {
        const k = applyVariables(resolvedAuth.apiKeyKey, req.id);
        const v = applyVariables(resolvedAuth.apiKeyValue, req.id);
        if (resolvedAuth.apiKeyIn === 'header') {
          fetchHeaders[k] = v;
        } else {
          const sep = targetUrl.includes('?') ? '&' : '?';
          targetUrl += `${sep}${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        }
      }
    }

    if (lang === 'curl') {
      let snippet = `curl --location '${targetUrl}' \\\n--request ${req.method}`;
      Object.entries(fetchHeaders).forEach(([k, v]) => {
        snippet += ` \\\n--header '${k}: ${v}'`;
      });
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (req.bodyType === 'json' && req.body) {
          snippet += ` \\\n--data '${applyVariables(req.body, req.id).replace(/'/g, "'\\''")}'`;
        }
      }
      return snippet;
    }

    if (lang === 'fetch') {
      return `fetch("${targetUrl}", {\n  method: "${req.method}",\n  headers: ${JSON.stringify(fetchHeaders, null, 2)}${(['POST', 'PUT', 'PATCH'].includes(req.method) && req.bodyType === 'json' && req.body) ? `,\n  body: JSON.stringify(${applyVariables(req.body, req.id)})` : ''}\n});`;
    }

    if (lang === 'axios') {
      return `axios({\n  method: "${req.method.toLowerCase()}",\n  url: "${targetUrl}",\n  headers: ${JSON.stringify(fetchHeaders, null, 2)}${(['POST', 'PUT', 'PATCH'].includes(req.method) && req.bodyType === 'json' && req.body) ? `,\n  data: ${applyVariables(req.body, req.id)}` : ''}\n});`;
    }

    return "";
  };

  // WS State Reference
  const webBinaryFileRef = useRef<HTMLInputElement>(null);
  const { sendWsMessage: sendWsMessageRaw } = useWebSocket();

  const sendWsMessage = () => {
    if (activeReq) {
      sendWsMessageRaw(activeReq, handleActiveReqChange);
    }
  };


  useEffect(() => {
    handleSendRef.current = handleSend;
  });





  const pickBinaryFile = async () => {
    if (!isTauri()) {
      webBinaryFileRef.current?.click();
      return;
    }
    try {
      const selected = await tauriOpen({
        multiple: false,
        title: 'Selecionar Arquivo para Body Binary'
      });
      if (selected && typeof selected === 'string') {
        handleActiveReqChange({
          binaryFile: {
            name: selected.split(/[\/\\]/).pop() || 'file',
            path: selected
          }
        });
        addLog('info', `Arquivo binario selecionado: ${selected}`);
      }
    } catch (err: any) {
      addLog('error', `Erro ao selecionar arquivo: ${err.message}`);
    }
  };

  const pickFormDataFile = async (fieldId: string) => {
    if (!isTauri()) {
      addLog('error', 'Selecao de arquivo para form-data disponivel apenas na versao desktop.');
      return;
    }
    try {
      const selected = await tauriOpen({ multiple: false, title: 'Selecionar arquivo para upload' });
      if (selected && typeof selected === 'string') {
        const newFormData = activeReq!.formData.map(f =>
          f.id === fieldId ? { ...f, fileInfo: { name: selected.split(/[\/\\]/).pop() || 'file', path: selected } } : f
        );
        handleActiveReqChange({ formData: newFormData });
        addLog('info', `Arquivo para form-data selecionado: ${selected}`);
      }
    } catch (err: any) {
      addLog('error', `Erro ao selecionar arquivo: ${err.message}`);
    }
  };

  // UI Helpers
  const renderAuthFields = (auth: AuthConfig, onChange: (updates: Partial<AuthConfig>) => void) => {
    return (
      <div className="fade-in" style={{ marginTop: '16px' }}>
        {auth.type === 'bearer' && (
          <div>
            <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Bearer Token (aceita {'{{var}}'})</label>
            <input
              type="text"
              className="text-input"
              placeholder="Ex: {{meu_token_jwt}} ou valor fixo"
              value={auth.token || ''}
              onChange={e => onChange({ token: e.target.value })}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Dica: Se o script da pasta salvou a token, use <b>{"{{nome_da_variavel}}"}</b> aqui.
            </p>
          </div>
        )}

        {auth.type === 'basic' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Username</label>
              <input
                type="text"
                placeholder="admin"
                value={auth.username || ''}
                onChange={e => onChange({ username: e.target.value })}
                className="text-input"
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Password</label>
              <input
                type="text"
                placeholder="••••••"
                value={auth.password || ''}
                onChange={e => onChange({ password: e.target.value })}
                className="text-input"
              />
            </div>
          </div>
        )}

        {auth.type === 'apikey' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Header/Query Key</label>
              <input
                type="text"
                placeholder="x-api-key"
                value={auth.apiKeyKey || ''}
                onChange={e => onChange({ apiKeyKey: e.target.value })}
                className="text-input"
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Value Token</label>
              <input
                type="text"
                placeholder="A8F90x..."
                value={auth.apiKeyValue || ''}
                onChange={e => onChange({ apiKeyValue: e.target.value })}
                className="text-input"
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Location</label>
              <select
                value={auth.apiKeyIn || 'header'}
                onChange={e => onChange({ apiKeyIn: e.target.value as 'header' | 'query' })}
                className="select-input"
                style={{ width: '100%' }}
              >
                <option value="header">In Headers</option>
                <option value="query">In Query Params</option>
              </select>
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && renderOAuth2Fields(auth.oauth2Config, (u) => onChange({ oauth2Config: { ...(auth.oauth2Config || { clientId: '', clientSecret: '', accessTokenUrl: '', authUrl: '', scope: '', accessToken: '' }), ...u } }))}
      </div>
    );
  };

  const renderConsole = (logs: LogEntry[] | undefined, onClear: () => void) => {
    const list = logs || [];

    return (
      <div className="console-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="console-header" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', marginBottom: '0' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Saídas e Rastros do Script</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" onClick={() => {
              const logsText = list.map(l => {
                const timestamp = l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp);
                return `[${timestamp.toLocaleTimeString()}] ${l.message}\n${l.data ? (typeof l.data === 'string' ? l.data : JSON.stringify(l.data, null, 2)) : ''}`
              }).join('\n\n');
              navigator.clipboard.writeText(logsText);
              addLog('success', 'Logs copiados para a área de transferência!');
            }} title="Copiar Logs"><Copy size={14} /></button>
            <button className="btn-icon" onClick={onClear} title="Limpar Tudo"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="console-logs" style={{ height: '280px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-subtle)' }}>
          {list.map((log) => {
            const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
            return (
              <div key={log.id} className={`log-line log-${log.type}`}>
                <span className="log-time" style={{ width: '70px', display: 'inline-block' }}>[{timestamp.toLocaleTimeString()}]</span>
                <span className="log-msg" style={{ flex: 1 }}>{log.message}</span>
                {log.data && (
                  <pre style={{ width: '100%', overflowX: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginTop: '4px', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
          {list.length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px', fontStyle: 'italic', fontSize: '13px' }}>
              Nenhum log disponível.
            </div>
          )}
          <AutoScrollEnd dependency={list} />
        </div>
      </div>
    );
  };

  const renderVarTable = (vars: any[], onChange: (v: any[]) => void, title: string, showEnabled = false) => {
    return (
      <div className="headers-container" style={{ marginTop: '0' }}>
        {title && <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{title}</h3>}
        <div className="headers-grid header-row-title" style={{ gridTemplateColumns: showEnabled ? '30px 1fr 1fr 40px' : '1fr 1fr 40px' }}>
          {showEnabled && <div></div>}
          <div>{showEnabled ? 'Key' : "Nome na Variável {{nome}}"}</div>
          <div>{showEnabled ? 'Value' : "Valor Exato"}</div>
          <div></div>
        </div>
        {vars.map((v, i) => (
          <div key={v.id} className="headers-grid" style={{ gridTemplateColumns: showEnabled ? '30px 1fr 1fr 40px' : '1fr 1fr 40px', alignItems: 'center', opacity: showEnabled && !v.enabled ? 0.4 : 1 }}>
            {showEnabled && (
              <input
                type="checkbox"
                checked={v.enabled}
                onChange={e => {
                  const next = [...vars];
                  next[i].enabled = e.target.checked;
                  onChange(next);
                }}
              />
            )}
            <input
              className="text-input"
              value={v.key}
              placeholder="Chave"
              onChange={e => {
                const next = [...vars];
                next[i].key = showEnabled ? e.target.value : e.target.value.replace(/[{}]/g, '');
                onChange(next);
              }}
            />
            <input
              className="text-input"
              value={v.value}
              placeholder="Valor"
              onChange={e => {
                const next = [...vars];
                next[i].value = e.target.value;
                onChange(next);
              }}
            />
            <button className="btn-icon danger" onClick={() => onChange(vars.filter(vx => vx.id !== v.id))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-secondary"
          style={{ marginTop: '12px', fontSize: '11px' }}
          onClick={() => onChange([...vars, { id: uuidv4(), key: '', value: '', enabled: true }])}
        >
          <Plus size={14} /> Adicionar Linha
        </button>
      </div>
    );
  };

  // Wrapper functions to adapt hook API to App.tsx call sites
  const removeEnv = (eId: string) => {
    removeEnvHook(eId, activeNodeId, editingEnvId, setEditingEnvId);
  };

  const addEnv = () => {
    addEnvHook(activeNodeId, setEditingEnvId);
  };


  return (
    <div className="layout">
      {/* Code Snippet Modal */}
      {isCodeModalOpen && activeReq && (
        <div className="modal-overlay" onClick={() => setIsCodeModalOpen(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ width: '700px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} className="text-accent" /> Code Snippet Generator
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="select-input"
                    value={codeSnippetLang}
                    onChange={e => setCodeSnippetLang(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    <option value="curl">cURL</option>
                    <option value="fetch">Fetch API</option>
                    <option value="axios">Axios (JS)</option>
                  </select>
                  <button className="btn btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(generateCodeSnippet(activeReq, codeSnippetLang));
                    addLog('success', 'Snippet copiado!');
                  }}>
                    <Copy size={14} /> Copiar
                  </button>
                  <button className="btn-icon" onClick={() => setIsCodeModalOpen(false)}><Trash2 size={16} /></button>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Snippet gerado com variáveis resolvidas para o ambiente <b>{activeNodeId ? (getActiveEnvironment(activeNodeId)?.name || 'Global') : 'Global'}</b>.
              </p>
            </div>
            <div style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', maxHeight: '400px', overflow: 'auto' }}>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {generateCodeSnippet(activeReq, codeSnippetLang)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Web binary file picker (hidden — web mode only) */}
      {!isTauri() && (
        <input
          type="file"
          ref={webBinaryFileRef}
          data-testid="binary-file-input"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_FILE_UPLOAD_BYTES) {
              addLog('error', `Arquivo "${file.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB. Selecione um arquivo menor.`);
              return;
            }
            handleActiveReqChange({
              binaryFile: { name: file.name, path: `web::${file.name}` },
              webBinaryFile: file,
            });
            if (e.target) e.target.value = '';
          }}
        />
      )}

      {/* Modal Confirmation */}

      {/* Modal Management (Ambientes e Var. Globais) */}
      {isEnvModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEnvModalOpen(false)}>
          <div className="modal-content glass-panel hover-glow" onClick={e => e.stopPropagation()} style={{ width: '850px', maxWidth: '95vw', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-strong)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                <Layers size={28} />
                <h3 style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Gerenciador de Ambientes</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                Ambientes permitem alternar o valor das chaves dependendo do servidor (Dev/Prod) ou criar variáveis fixas em toda o App na aba Globais.
              </p>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: '400px', overflow: 'hidden' }}>

              {/* Left Selector Sidebar */}
              <div style={{ width: '250px', borderRight: '1px solid var(--border-strong)', background: 'rgba(18, 19, 28, 0.4)', padding: '16px 0', overflowY: 'auto' }}>
                <div style={{ padding: '0 16px', marginBottom: '16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Escopos</div>

                <div
                  className={`tree-item ${editingEnvId === 'GLOBAL' ? 'active-node' : ''}`}
                  onClick={() => setEditingEnvId('GLOBAL')}
                  style={{ margin: '0 8px', borderRadius: '4px' }}
                >
                  <Globe size={16} className={editingEnvId === 'GLOBAL' ? 'text-accent' : 'text-muted'} /> Variáveis Globais
                </div>

                <div style={{ padding: '24px 16px 8px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Ambientes <button className="btn-icon" onClick={addEnv} style={{ padding: '2px' }}><Plus size={14} /></button>
                </div>

                {(() => {
                  const wsEnvs = activeNodeId ? getWorkspaceEnvironments(activeNodeId) : [];
                  const wsEnvIdActive = activeNodeId ? getWorkspaceActiveEnvId(activeNodeId) : null;
                  return wsEnvs.map(env => (
                    <div
                      key={env.id}
                      className={`tree-item ${editingEnvId === env.id ? 'active-node' : ''}`}
                      onClick={() => setEditingEnvId(env.id)}
                      style={{ margin: '0 8px', borderRadius: '4px' }}
                    >
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsEnvIdActive === env.id ? 'var(--success)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{env.name}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Right Env Editor */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                {!editingEnvId ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px' }}>Selecione um ambiente ou o escopo Global ao lado.</div>
                ) : editingEnvId === 'GLOBAL' ? (
                  <div className="fade-in">
                    <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)', fontSize: '18px' }}>Chaves Globais <span className="badge">G</span></h3>
                    {renderVarTable(globalVariables, setGlobalVariables, '')}
                  </div>
                ) : (
                  <div className="fade-in">
                    {(() => {
                      const wsEnvs = activeNodeId ? getWorkspaceEnvironments(activeNodeId) : [];
                      const ws = activeNodeId ? findParentWorkspace(activeNodeId) : null;
                      return wsEnvs.map(env => {
                        if (env.id !== editingEnvId) return null;
                        return (
                          <div key={env.id}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
                              <input
                                className="text-input"
                                value={env.name}
                                onChange={e => {
                                  if (!ws) return;
                                  updateNodeInCollection(ws.id, (node) => {
                                    if (node.type !== 'workspace' || !node.workspaceConfig) return node;
                                    return { ...node, workspaceConfig: { ...node.workspaceConfig, environments: node.workspaceConfig.environments.map(ev => ev.id === env.id ? { ...ev, name: e.target.value } : ev) } };
                                  });
                                }}
                                style={{ fontSize: '18px', fontWeight: 600, background: 'rgba(0,0,0,0.5)', border: 'none', borderBottom: '2px solid var(--accent-primary)', borderRadius: '0' }}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-icon danger" onClick={() => removeEnv(env.id)} title="Excluir este ambiente"><Trash2 size={16} /></button>
                              </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                              {renderVarTable(env.variables, (newVars) => {
                                if (!ws) return;
                                updateNodeInCollection(ws.id, (node) => {
                                  if (node.type !== 'workspace' || !node.workspaceConfig) return node;
                                  return { ...node, workspaceConfig: { ...node.workspaceConfig, environments: node.workspaceConfig.environments.map(ev => ev.id === env.id ? { ...ev, variables: newVars } : ev) } };
                                });
                              }, 'Chaves Locais Deste Ambiente')}
                            </div>
                          </div>
                        )
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-strong)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsEnvModalOpen(false)}>Concluir Setup</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        exportCollection={exportCollection}
        importCollection={importCollection}
      />

      {/* Main Content */}
      <main className="main-content">
        {mode === 'devtools' ? (
          <DevToolsPanel />
        ) : !activeNode ? (
          /* WELCOME SCREEN */
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <img src="/aurafetch_logo.png" alt="AuraFetch Logo" width={80} style={{ borderRadius: '16px', marginBottom: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} />
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>AuraFetch</h2>
            <p style={{ maxWidth: '400px', textAlign: 'center', lineHeight: 1.6, marginBottom: '32px' }}>
              Selecione uma requisição no menu lateral ou crie uma nova para começar.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="btn btn-primary" title="Clique no botão 'Novo Workspace' na barra lateral"><Database size={16} /> Novo Workspace</button>
            </div>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--border-strong)', width: '100%', maxWidth: '400px', display: 'flex', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={generateCrudExample} style={{ background: 'var(--accent-gradient)', border: 'none', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
                <Database size={16} /> Gerar Template CRUD + Login Automático
              </button>
            </div>
          </div>
        ) : activeNode.type === 'workspace' ? (
          /* WORKSPACE CONFIGURATION */
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Workspace Header */}
            <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, letterSpacing: '-0.5px', fontSize: '22px' }}>
                  <Database size={22} className="text-accent" /> {activeNode.name}
                </h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => addRequestToFolder(activeNode.id)} style={{ padding: '8px 14px', fontSize: '12px' }}>
                    <Plus size={14} /> HTTP
                  </button>
                  <button className="btn btn-secondary" onClick={() => addWebSocketToFolder(activeNode.id)} style={{ padding: '8px 14px', fontSize: '12px' }}>
                    <Globe size={14} /> WS
                  </button>
                  <button className="btn btn-secondary" onClick={() => addFolderTo(activeNode.id)} style={{ padding: '8px 14px', fontSize: '12px' }}>
                    <Folder size={14} /> Pasta
                  </button>
                </div>
              </div>
            </div>

            {/* Workspace Tabs */}
            <div className="ws-config-tabs">
              <button
                className={`ws-config-tab ${activeWorkspaceTab === 'environments' ? 'active' : ''}`}
                onClick={() => setActiveWorkspaceTab('environments')}
              >
                <Layers size={14} /> Ambientes
                <span className="tab-count">{activeNode.workspaceConfig?.environments.length || 0}</span>
              </button>
              <button
                className={`ws-config-tab ${activeWorkspaceTab === 'globals' ? 'active' : ''}`}
                onClick={() => setActiveWorkspaceTab('globals')}
              >
                <Globe size={14} /> Variáveis Globais
                <span className="tab-count">{globalVariables.length}</span>
              </button>
              <button
                className={`ws-config-tab ${activeWorkspaceTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveWorkspaceTab('summary')}
              >
                <Database size={14} /> Resumo
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* ─── TAB: AMBIENTES ─── */}
              {activeWorkspaceTab === 'environments' && (
                <div className="ws-env-layout fade-in">
                  {/* Left: env list */}
                  <div className="ws-env-sidebar">
                    <div className="ws-env-sidebar-header">
                      <span>Ambientes</span>
                      <button className="btn-icon" onClick={addEnv} style={{ padding: '2px' }} title="Novo Ambiente"><Plus size={14} /></button>
                    </div>

                    {(activeNode.workspaceConfig?.environments || []).map(env => {
                      const isActive = env.id === activeNode.workspaceConfig?.activeEnvironmentId;
                      return (
                        <div
                          key={env.id}
                          className={`ws-env-item ${editingEnvId === env.id ? 'active' : ''}`}
                          onClick={() => setEditingEnvId(env.id)}
                        >
                          <div
                            className="env-active-dot"
                            style={{
                              background: isActive ? 'var(--success)' : 'var(--text-muted)',
                              boxShadow: isActive ? '0 0 6px var(--success)' : 'none',
                              cursor: 'pointer'
                            }}
                            title={isActive ? 'Ambiente ativo (clique p/ desativar)' : 'Clique p/ ativar'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkspaceActiveEnvId(activeNode.id, isActive ? null : env.id);
                            }}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                          {isActive && <Check size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                        </div>
                      );
                    })}

                    {(activeNode.workspaceConfig?.environments || []).length === 0 && (
                      <div style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.15)', border: '2px dashed var(--border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 8px',
                        }}>
                          <Layers size={16} style={{ opacity: 0.35 }} />
                        </div>
                        Nenhum ambiente criado.
                      </div>
                    )}
                  </div>

                  {/* Right: env editor */}
                  <div className="ws-env-editor">
                    {!editingEnvId || !activeNode.workspaceConfig?.environments.find(e => e.id === editingEnvId) ? (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px', fontSize: '12px' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.15)', border: '2px dashed var(--border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 10px',
                        }}>
                          <Layers size={20} style={{ opacity: 0.35 }} />
                        </div>
                        <p style={{ margin: 0 }}>Selecione um ambiente para editar variaveis.</p>
                      </div>
                    ) : (() => {
                      const env = activeNode.workspaceConfig!.environments.find(e => e.id === editingEnvId)!;
                      const isActive = env.id === activeNode.workspaceConfig!.activeEnvironmentId;
                      return (
                        <div className="fade-in">
                          <div className="ws-env-editor-header">
                            <input
                              className="text-input"
                              value={env.name}
                              onChange={e => {
                                updateNodeInCollection(activeNode.id, (node) => {
                                  if (node.type !== 'workspace' || !node.workspaceConfig) return node;
                                  return { ...node, workspaceConfig: { ...node.workspaceConfig, environments: node.workspaceConfig.environments.map(ev => ev.id === env.id ? { ...ev, name: e.target.value } : ev) } };
                                });
                              }}
                            />
                            <button
                              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setWorkspaceActiveEnvId(activeNode.id, isActive ? null : env.id)}
                              style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              {isActive ? <><Check size={13} /> Ativo</> : 'Ativar'}
                            </button>
                            <button className="btn-icon danger" onClick={() => removeEnv(env.id)} title="Excluir este ambiente">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {renderVarTable(env.variables, (newVars) => {
                            updateNodeInCollection(activeNode.id, (node) => {
                              if (node.type !== 'workspace' || !node.workspaceConfig) return node;
                              return { ...node, workspaceConfig: { ...node.workspaceConfig, environments: node.workspaceConfig.environments.map(ev => ev.id === env.id ? { ...ev, variables: newVars } : ev) } };
                            });
                          }, 'Variáveis do Ambiente')}

                          <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Use <code style={{ color: 'var(--accent-primary)' }}>{'{{chave}}'}</code> nas URLs, headers e body para referenciar variáveis.<br />
                            Variáveis do ambiente sobrescrevem as globais.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ─── TAB: VARIÁVEIS GLOBAIS ─── */}
              {activeWorkspaceTab === 'globals' && (
                <div className="fade-in" style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ maxWidth: '800px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={16} className="text-accent" /> Variáveis Globais <span className="badge">G</span>
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                        Variáveis globais são acessíveis em todos os workspaces e ambientes. Ambientes específicos podem sobrescrever estas chaves.
                      </p>
                    </div>
                    {renderVarTable(globalVariables, setGlobalVariables, '')}
                  </div>
                </div>
              )}

              {/* ─── TAB: RESUMO/CONFIG ─── */}
              {activeWorkspaceTab === 'summary' && (
                <div className="fade-in" style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
                  <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={16} className="text-accent" /> Resumo do Workspace
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {[
                        { value: activeNode.children?.length || 0, label: 'Itens na Raiz', color: 'var(--accent-primary)' },
                        { value: activeNode.workspaceConfig?.environments.length || 0, label: 'Ambientes', color: 'var(--success)' },
                        { value: activeNode.workspaceConfig?.history?.length || 0, label: 'No Historico', color: 'var(--text-muted)' },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          padding: '16px', background: 'rgba(0,0,0,0.15)',
                          border: '1px solid var(--border-subtle)', borderRadius: '8px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            {stat.label}
                          </div>
                          <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: stat.color }}>
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Settings size={14} className="text-accent" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>Timeout de requisicoes</span>
                      <input
                        type="number"
                        className="text-input"
                        value={reqTimeoutMs / 1000}
                        onChange={e => setReqTimeoutMs(Math.max(1, Number(e.target.value)) * 1000)}
                        style={{ width: '70px', textAlign: 'center', fontSize: '13px', padding: '4px 8px' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>seg</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeNode.type === 'folder' ? (
          /* FOLDER CONFIGURATION */
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Folder Header — matches workspace style */}
            <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, letterSpacing: '-0.5px', fontSize: '22px' }}>
                  <Folder size={22} className="text-accent" /> {activeNode.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {[
                    { label: 'Auth', value: activeNode.folderConfig?.auth.type || 'none', color: activeNode.folderConfig?.auth.type && activeNode.folderConfig.auth.type !== 'none' ? 'var(--success)' : 'var(--text-muted)' },
                    { label: 'Headers', value: String(activeNode.folderConfig?.headers?.length || 0), color: (activeNode.folderConfig?.headers?.length || 0) > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' },
                    { label: 'Vars', value: String(activeNode.folderConfig?.variables?.length || 0), color: (activeNode.folderConfig?.variables?.length || 0) > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' },
                  ].map(s => (
                    <span key={s.label} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: s.color }}>
                      {s.label}: <b>{s.value}</b>
                    </span>
                  ))}
                </div>
              </div>

              {/* Folder Tabs */}
              <div style={{ display: 'flex', gap: '0' }}>
                {([
                  { key: 'auth', icon: <Shield size={13} />, label: 'Autenticacao', count: activeNode.folderConfig?.auth.type && activeNode.folderConfig.auth.type !== 'none' ? 1 : 0 },
                  { key: 'headers', icon: <Network size={13} />, label: 'Headers', count: activeNode.folderConfig?.headers?.length || 0 },
                  { key: 'vars', icon: <Layers size={13} />, label: 'Variaveis', count: activeNode.folderConfig?.variables?.length || 0 },
                  { key: 'script', icon: <Terminal size={13} />, label: 'Script', count: activeNode.folderConfig?.setupScript ? 1 : 0 },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFolderSettingTab(tab.key as typeof activeFolderSettingTab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 18px', fontSize: '12px', fontWeight: 500,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: activeFolderSettingTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                      borderBottom: activeFolderSettingTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.icon} {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        fontSize: '10px', fontFamily: 'var(--font-mono)',
                        padding: '1px 5px', borderRadius: '3px', lineHeight: '1.4',
                        background: activeFolderSettingTab === tab.key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                        color: activeFolderSettingTab === tab.key ? '#000' : 'var(--text-muted)',
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

              {/* Auth Tab */}
              {activeFolderSettingTab === 'auth' && (
                <div className="fade-in">
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Esquema de Auth</label>
                    <select
                      value={activeNode.folderConfig?.auth.type || 'none'}
                      onChange={e => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), type: e.target.value as AuthType } })}
                      className="select-input"
                      style={{ width: '360px' }}
                    >
                      <option value="none">Nenhum (Publico)</option>
                      <option value="bearer">Bearer Token (JWT)</option>
                      <option value="oauth2">OAuth 2.0 (Flow)</option>
                      <option value="basic">Basic Auth</option>
                      <option value="apikey">API Key</option>
                    </select>
                  </div>
                  <div style={{ maxWidth: '600px' }}>
                    {renderAuthFields(activeNode.folderConfig?.auth || defaultFolderAuth, (u) => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), ...u } }))}
                  </div>
                  {activeNode.folderConfig?.auth.type === 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                        <Shield size={22} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Selecione um esquema de autenticacao acima</span>
                    </div>
                  )}
                </div>
              )}

              {/* Headers Tab */}
              {activeFolderSettingTab === 'headers' && (
                <div className="fade-in">
                  {renderVarTable(activeNode.folderConfig?.headers || [], (v) => handleActiveFolderConfigChange({ headers: v }), '', true)}
                  <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Headers herdados por todas as requisicoes filhas desta pasta.
                  </p>
                </div>
              )}

              {/* Vars Tab */}
              {activeFolderSettingTab === 'vars' && (
                <div className="fade-in">
                  {renderVarTable(activeNode.folderConfig?.variables || [], (v) => handleActiveFolderConfigChange({ variables: v }), '')}
                  <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Variaveis da pasta sobrescrevem Ambiente Ativo e Globais.
                  </p>
                </div>
              )}

              {/* Script Tab */}
              {activeFolderSettingTab === 'script' && (
                <div className="fade-in">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        API: <code style={{ color: 'var(--accent-primary)', fontSize: '11px' }}>fetch()</code> <code style={{ color: 'var(--success)', fontSize: '11px' }}>setEnv(k,v)</code> <code style={{ color: 'var(--warning)', fontSize: '11px' }}>setVar(k,v)</code>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '11px' }}
                        onClick={() => handleActiveFolderConfigChange({
                          setupScript: '// Exemplo pratico de Login Auth:\n\nconst res = await fetch("{{base_url}}/auth/login", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ email: "admin", pass: "123" })\n});\n\nconst data = await res.json();\n\n// Debug: Veja no console abaixo o que o servidor mandou\naurafetch.log(data);\n\n// Guarda no Ambiente ou Global\naurafetch.setEnv("token_acesso", data.token);\naurafetch.log("Token renovado com sucesso!");'
                        })}
                      >
                        <Code size={12} /> Exemplo
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '5px 12px', fontSize: '11px' }}
                        onClick={() => runFolderScript(activeNode.id)}
                        disabled={loading}
                      >
                        <Play size={12} fill="currentColor" /> {loading ? 'Executando...' : 'Executar'}
                      </button>
                    </div>
                  </div>
                  <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <CodeMirror
                      value={activeNode.folderConfig?.setupScript || ''}
                      height="auto"
                      minHeight="180px"
                      theme={oneDark}
                      extensions={[javascript({ jsx: true })]}
                      onChange={(val) => handleActiveFolderConfigChange({ setupScript: val })}
                      basicSetup={{
                        lineNumbers: true,
                        tabSize: 2,
                        autocompletion: true,
                        foldGutter: true
                      }}
                    />
                  </div>

                  {/* Inline Console */}
                  <div style={{ marginTop: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>Console</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-icon" style={{ padding: '2px' }} onClick={() => {
                          const list = activeLogs || [];
                          const logsText = list.map(l => {
                            const timestamp = l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp);
                            return `[${timestamp.toLocaleTimeString()}] ${l.message}${l.data ? '\n' + (typeof l.data === 'string' ? l.data : JSON.stringify(l.data, null, 2)) : ''}`;
                          }).join('\n\n');
                          navigator.clipboard.writeText(logsText);
                        }} title="Copiar"><Copy size={12} /></button>
                        <button className="btn-icon" style={{ padding: '2px' }} onClick={() => setActiveLogs([])} title="Limpar"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ height: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {(activeLogs || []).map((log) => {
                        const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                        return (
                          <div key={log.id} className={`log-line log-${log.type}`}>
                            <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{timestamp.toLocaleTimeString()}]</span>
                            <span>{log.message}</span>
                            {log.data && (
                              <pre style={{ width: '100%', overflowX: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginTop: '4px', fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                      {(!activeLogs || activeLogs.length === 0) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Terminal size={14} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sem logs</span>
                        </div>
                      )}
                      <AutoScrollEnd dependency={activeLogs || []} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* REQUEST CONFIGURATION */
          <>
            {/* Header URL Bar */}
            <div className="workspace-header">
              <div className="url-bar-container" style={{ margin: 0, height: '44px', paddingLeft: '2px' }}>
                {activeReq!.method === 'WS' ? (
                  <div style={{ padding: '0 16px', fontWeight: 900, fontSize: '14px', color: 'var(--accent-primary)', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={16} /> WS
                  </div>
                ) : (
                  <>
                    <select
                      value={activeReq!.method}
                      onChange={e => handleActiveReqChange({ method: e.target.value as HttpMethod })}
                      className={`method-select method-${activeReq!.method}`}
                      style={{ flexShrink: 0, width: '110px' }}
                    >
                      <option value="GET" className="method-GET">GET</option>
                      <option value="POST" className="method-POST">POST</option>
                      <option value="PUT" className="method-PUT">PUT</option>
                      <option value="PATCH" className="method-PATCH">PATCH</option>
                      <option value="DELETE" className="method-DELETE">DELETE</option>
                    </select>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)' }} />
                  </>
                )}
                <input
                  type="text"
                  value={activeReq!.url}
                  onChange={e => handleActiveReqChange({ url: e.target.value })}
                  placeholder={activeReq!.method === 'WS' ? "wss://echo.websocket.org..." : "{{base_url}}/api/..."}
                  style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', letterSpacing: '0.3px', flex: 1, background: 'transparent' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSend();
                  }}
                />
              </div>

              {activeReq!.method === 'WS' ? (
                <button
                  className={`btn ${wsConnected ? 'btn-danger' : 'btn-primary'} btn-send`}
                  onClick={handleSend}
                  disabled={loading}
                >
                  <Globe size={16} /> {wsConnected ? 'Desconectar' : (loading ? 'Conectando...' : 'Conectar WS')}
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setIsCodeModalOpen(true)} title="Gerar snippet">
                    <Terminal size={16} />
                  </button>
                  {loading && !isLooping ? (
                    <button className="btn btn-danger btn-send" onClick={cancelReq} title="Cancelar">
                      <Square size={16} fill="currentColor" /> Cancelar
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-send" onClick={handleSend} disabled={isLooping}>
                      <Send size={16} /> Enviar
                    </button>
                  )}

                  <div className="loop-controls">
                    <span title="Disparo agendado / loop automático"><Clock size={16} className="text-muted" /></span>
                    <input
                      type="number"
                      value={intervalMs}
                      onChange={e => setIntervalMs(Math.max(100, Number(e.target.value)))}
                      className="interval-input"
                      title="Intervalo milissegundos"
                      disabled={isLooping}
                    />
                    <button
                      className={`btn ${isLooping ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ padding: '10px 14px' }}
                      onClick={() => setIsLooping(!isLooping)}
                      title={isLooping ? "Parar loop" : "Iniciar loop automatico"}
                    >
                      {isLooping ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Request Settings Tab Content */}
            <div className="editor-layout">
              <div className="request-panel" style={{ width: leftPanelWidth, flex: 'none' }}>
                {activeReq!.method === 'WS' ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel-solid)', height: '100%' }}>
                    {/* WS Chat interface */}
                    <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.1)' }}>
                      {activeReq!.wsMessages?.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Globe size={22} style={{ color: 'var(--text-muted)' }} />
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Conecte ao WebSocket para enviar mensagens</span>
                        </div>
                      )}
                      {activeReq!.wsMessages?.map(m => (
                        <div key={m.id} style={{
                          alignSelf: m.type === 'sent' ? 'flex-end' : (m.type === 'received' ? 'flex-start' : 'center'),
                          background: m.type === 'sent' ? 'var(--accent-primary)' : (m.type === 'received' ? 'rgba(255,255,255,0.05)' : 'transparent'),
                          color: m.type === 'info' ? 'var(--text-muted)' : (m.type === 'error' ? 'var(--danger)' : '#fff'),
                          padding: m.type === 'info' || m.type === 'error' ? '4px' : '10px 14px',
                          borderRadius: '8px',
                          maxWidth: '80%',
                          fontSize: '13px',
                          border: m.type === 'received' ? '1px solid var(--border-strong)' : 'none',
                          boxShadow: m.type === 'sent' ? '0 4px 10px rgba(99,102,241,0.2)' : 'none'
                        }}>
                          {m.type === 'sent' ? <span style={{ fontSize: '10px', opacity: 0.7, marginRight: '8px', fontFamily: 'var(--font-mono)' }}>SENT</span> : ''}
                          {m.type === 'received' ? <span style={{ fontSize: '10px', opacity: 0.5, marginRight: '8px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>RECV</span> : ''}
                          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>{m.text}</pre>
                        </div>
                      ))}
                      <AutoScrollEnd dependency={activeReq!.wsMessages} />
                    </div>
                    {/* Message input bar */}
                    <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '12px' }}>
                      <textarea
                        value={wsInputMessage}
                        onChange={e => setWsInputMessage(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendWsMessage(); }
                        }}
                        placeholder="Escreva a mensagem (Enter para enviar)..."
                        className="text-input"
                        style={{ minHeight: '44px', height: '44px', resize: 'none' }}
                      />
                      <button className="btn btn-primary" onClick={sendWsMessage} disabled={!wsConnected || !wsInputMessage.trim()}>
                        <Send size={16} />
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleActiveReqChange({ wsMessages: [] })}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tabs">
                      <div className={`tab ${activeReqTab === 'params' ? 'active' : ''}`} onClick={() => setActiveReqTab('params')}>Params</div>
                      <div className={`tab ${activeReqTab === 'queries' ? 'active' : ''}`} onClick={() => setActiveReqTab('queries')}>Query <span className="badge">{(activeReq!.queryParams || []).filter(q => q.key).length || ''}</span></div>
                      <div className={`tab ${activeReqTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveReqTab('auth')}>Auth</div>
                      <div className={`tab ${activeReqTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveReqTab('headers')}>Headers <span className="badge">{(activeReq!.headers || []).filter(h => h.key).length || ''}</span></div>
                      <div className={`tab ${activeReqTab === 'body' ? 'active' : ''}`} onClick={() => setActiveReqTab('body')}>Body</div>
                    </div>

                    <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                      {activeReqTab === 'params' && (
                        <div className="headers-container" style={{ marginTop: 0 }}>
                          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px' }}>Path Parameters</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>Substitua <code style={{ color: 'var(--accent-primary)' }}>:id</code> ou <code style={{ color: 'var(--accent-primary)' }}>{'{id}'}</code> na URL.</p>
                          {renderVarTable(activeReq!.params || [], (v) => handleActiveReqChange({ params: v }), '', true)}
                        </div>
                      )}

                      {activeReqTab === 'queries' && (
                        <div className="headers-container" style={{ marginTop: 0 }}>
                          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px' }}>Query Parameters</h3>
                          {renderVarTable(activeReq!.queryParams || [], (v) => handleActiveReqChange({ queryParams: v }), '', true)}
                        </div>
                      )}

                      {activeReqTab === 'auth' && (
                        <div className="glass-panel" style={{ padding: '24px 32px' }}>
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Esquema de Auth</label>
                            <select
                              value={activeReq!.auth.type}
                              onChange={e => handleActiveReqChange({ auth: { ...activeReq!.auth, type: e.target.value as AuthType } })}
                              className="select-input"
                              style={{ width: '300px' }}
                            >
                              <option value="inherit">Herdar da Pasta</option>
                              <option value="none">Nenhum</option>
                              <option value="bearer">Bearer Token</option>
                              <option value="oauth2">OAuth 2.0</option>
                              <option value="basic">Basic Auth</option>
                              <option value="apikey">API Key</option>
                            </select>

                            {activeReq!.auth.type === 'inherit' && (
                              <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', borderLeft: '2px solid var(--accent-primary)', borderRadius: '4px' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, fontFamily: 'var(--font-mono)' }}>
                                  Herda autenticacao da pasta pai. Configure auth na pasta para que seja aplicada aqui.
                                </p>
                              </div>
                            )}
                          </div>

                          {renderAuthFields(activeReq!.auth, (updates) => handleActiveReqChange({ auth: { ...activeReq!.auth, ...updates } }))}
                        </div>
                      )}

                      {activeReqTab === 'headers' && (
                        <div className="headers-container">
                          <div className="headers-grid header-row-title" style={{ gridTemplateColumns: '30px 1fr 1fr 40px' }}>
                            <div></div>
                            <div>Chave</div>
                            <div>Valor</div>
                            <div></div>
                          </div>
                          {activeReq!.headers.map((h, i) => (
                            <div key={h.id} className="headers-grid" style={{ gridTemplateColumns: '30px 1fr 1fr 40px', alignItems: 'center', opacity: h.enabled ? 1 : 0.4 }}>
                              <input
                                type="checkbox"
                                checked={h.enabled}
                                onChange={e => {
                                  const newHeaders = [...activeReq!.headers];
                                  newHeaders[i].enabled = e.target.checked;
                                  handleActiveReqChange({ headers: newHeaders });
                                }}
                              />
                              <input
                                className="text-input"
                                placeholder="Ex: Content-Type"
                                value={h.key}
                                list="common-headers"
                                onChange={e => {
                                  const newHeaders = [...activeReq!.headers];
                                  newHeaders[i].key = e.target.value;
                                  handleActiveReqChange({ headers: newHeaders });
                                }}
                              />
                              <input
                                className="text-input"
                                placeholder="Ex: application/json ou {{var}}"
                                value={h.value}
                                onChange={e => {
                                  const newHeaders = [...activeReq!.headers];
                                  newHeaders[i].value = e.target.value;
                                  handleActiveReqChange({ headers: newHeaders });
                                }}
                              />
                              <button
                                className="btn-icon danger" style={{ border: '1px solid var(--border-subtle)' }}
                                onClick={() => {
                                  const newHeaders = activeReq!.headers.filter(hx => hx.id !== h.id);
                                  handleActiveReqChange({ headers: newHeaders });
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="btn btn-secondary"
                            style={{ marginTop: '12px', fontSize: '11px' }}
                            onClick={() => {
                              handleActiveReqChange({ headers: [...activeReq!.headers, { id: uuidv4(), key: '', value: '', enabled: true }] });
                            }}
                          >
                            <Plus size={14} /> Adicionar Header
                          </button>

                          <datalist id="common-headers">
                            <option value="Content-Type" />
                            <option value="Accept" />
                            <option value="Authorization" />
                            <option value="Cache-Control" />
                            <option value="User-Agent" />
                            <option value="X-Requested-With" />
                            <option value="Origin" />
                            <option value="Referer" />
                          </datalist>
                        </div>
                      )}

                      {activeReqTab === 'body' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div className="body-type-selector" style={{ display: 'flex', gap: '12px', padding: '0 4px', marginBottom: '8px' }}>
                            {(['none', 'json', 'graphql', 'form-data', 'urlencoded', 'binary'] as RequestBodyType[]).map(type => (
                              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: activeReq!.bodyType === type ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                <input
                                  type="radio"
                                  name="bodyType"
                                  checked={activeReq!.bodyType === type}
                                  onChange={() => handleActiveReqChange({ bodyType: type })}
                                  style={{ accentColor: 'var(--accent-primary)', width: '12px', height: '12px' }}
                                />
                                {type === 'urlencoded' ? 'x-www-form-urlencoded' : type.toUpperCase()}
                              </label>
                            ))}
                          </div>

                          <div style={{ flex: 1, borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#282c34', minHeight: '200px' }}>
                            {activeReq!.bodyType === 'json' && (
                              <CodeMirror
                                value={activeReq!.body}
                                style={{ height: '100%' }}
                                height="100%"
                                theme={oneDark}
                                extensions={[json()]}
                                onChange={(val) => handleActiveReqChange({ body: val })}
                                basicSetup={{ lineNumbers: true, tabSize: 2, autocompletion: true, foldGutter: true }}
                              />
                            )}

                            {activeReq!.bodyType === 'graphql' && (
                              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ flex: 2, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent-primary)', background: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>Query</div>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <CodeMirror
                                      value={activeReq!.graphqlQuery || ''}
                                      style={{ height: '100%' }}
                                      height="100%"
                                      theme={oneDark}
                                      extensions={[graphql()]}
                                      onChange={(val) => handleActiveReqChange({ graphqlQuery: val })}
                                      basicSetup={{ lineNumbers: true, tabSize: 2, autocompletion: true, foldGutter: true }}
                                    />
                                  </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--success)', background: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>Variables (JSON)</div>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <CodeMirror
                                      value={activeReq!.graphqlVariables || ''}
                                      style={{ height: '100%' }}
                                      height="100%"
                                      theme={oneDark}
                                      extensions={[json()]}
                                      onChange={(val) => handleActiveReqChange({ graphqlVariables: val })}
                                      basicSetup={{ lineNumbers: true, tabSize: 2, autocompletion: false, foldGutter: true }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {activeReq!.bodyType === 'form-data' && (
                              <div className="headers-container" style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
                                <div className="headers-grid header-row-title" style={{ gridTemplateColumns: '30px 1fr 1fr 100px 40px' }}>
                                  <div></div>
                                  <div>Key</div>
                                  <div>Value / File</div>
                                  <div>Type</div>
                                  <div></div>
                                </div>
                                {activeReq!.formData.map((f) => (
                                  <div key={f.id} className="headers-grid" style={{ gridTemplateColumns: '30px 1fr 1fr 100px 40px', alignItems: 'center', opacity: f.enabled ? 1 : 0.4 }}>
                                    <input
                                      type="checkbox"
                                      checked={f.enabled}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        const idx = next.findIndex(x => x.id === f.id);
                                        next[idx].enabled = e.target.checked;
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    />
                                    <input
                                      className="text-input"
                                      placeholder="Key"
                                      value={f.key}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        next.find(x => x.id === f.id)!.key = e.target.value;
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    />
                                    {f.type === 'text' ? (
                                      <input
                                        className="text-input"
                                        placeholder="Value"
                                        value={f.value}
                                        onChange={e => {
                                          const next = [...activeReq!.formData];
                                          next.find(x => x.id === f.id)!.value = e.target.value;
                                          handleActiveReqChange({ formData: next });
                                        }}
                                      />
                                    ) : isTauri() ? (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => pickFormDataFile(f.id)}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                        </button>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {f.fileInfo?.name || 'Nenhum arquivo'}
                                        </span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <label className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                          <input
                                            type="file"
                                            data-testid="formdata-file-input"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              if (file.size > MAX_FILE_UPLOAD_BYTES) {
                                                addLog('error', `Arquivo "${file.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB. Selecione um arquivo menor.`);
                                                return;
                                              }
                                              const next = activeReq!.formData.map(x =>
                                                x.id === f.id
                                                  ? { ...x, fileInfo: { name: file.name, path: `web::${file.name}` }, webFile: file }
                                                  : x
                                              );
                                              handleActiveReqChange({ formData: next });
                                            }}
                                          />
                                        </label>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {f.fileInfo?.name || 'Nenhum arquivo'}
                                        </span>
                                      </div>
                                    )}
                                    <select
                                      value={f.type}
                                      className="select-input"
                                      style={{ fontSize: '11px', padding: '4px' }}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        const idx = next.findIndex(x => x.id === f.id);
                                        next[idx].type = e.target.value as 'text' | 'file';
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    >
                                      <option value="text">Text</option>
                                      <option value="file">File</option>
                                    </select>
                                    <button className="btn-icon danger" onClick={() => {
                                      handleActiveReqChange({ formData: activeReq!.formData.filter(fx => fx.id !== f.id) });
                                    }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                <button className="btn btn-secondary" style={{ marginTop: '12px', fontSize: '11px' }} onClick={() => {
                                  handleActiveReqChange({ formData: [...activeReq!.formData, { id: uuidv4(), key: '', value: '', type: 'text', enabled: true }] });
                                }}>
                                  <Plus size={14} /> Adicionar Campo
                                </button>
                              </div>
                            )}

                            {activeReq!.bodyType === 'urlencoded' && (
                              <div className="headers-container" style={{ padding: '12px', overflowY: 'auto', height: '100%' }}>
                                <div className="headers-grid header-row-title" style={{ gridTemplateColumns: '30px 1fr 1fr 40px' }}>
                                  <div></div>
                                  <div>Key</div>
                                  <div>Value</div>
                                  <div></div>
                                </div>
                                {/* Reusing common logic for urlencoded pairs */}
                                {activeReq!.formData.filter(f => f.type === 'text').map((f) => (
                                  <div key={f.id} className="headers-grid" style={{ gridTemplateColumns: '30px 1fr 1fr 40px', alignItems: 'center', opacity: f.enabled ? 1 : 0.4 }}>
                                    <input
                                      type="checkbox"
                                      checked={f.enabled}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        const idx = next.findIndex(x => x.id === f.id);
                                        next[idx].enabled = e.target.checked;
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    />
                                    <input
                                      className="text-input"
                                      placeholder="Key"
                                      value={f.key}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        const idx = next.findIndex(x => x.id === f.id);
                                        next[idx].key = e.target.value;
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    />
                                    <input
                                      className="text-input"
                                      placeholder="Value"
                                      value={f.value}
                                      onChange={e => {
                                        const next = [...activeReq!.formData];
                                        const idx = next.findIndex(x => x.id === f.id);
                                        next[idx].value = e.target.value;
                                        handleActiveReqChange({ formData: next });
                                      }}
                                    />
                                    <button className="btn-icon danger" onClick={() => {
                                      handleActiveReqChange({ formData: activeReq!.formData.filter(fx => fx.id !== f.id) });
                                    }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                <button className="btn btn-secondary" style={{ marginTop: '12px', fontSize: '11px' }} onClick={() => {
                                  handleActiveReqChange({ formData: [...activeReq!.formData, { id: uuidv4(), key: '', value: '', type: 'text', enabled: true }] });
                                }}>
                                  <Plus size={14} /> Adicionar Par Chave/Valor
                                </button>
                              </div>
                            )}

                            {activeReq!.bodyType === 'binary' && (
                              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Upload size={22} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', maxWidth: '280px' }}>Selecione um arquivo binario para enviar como corpo da requisicao</span>
                                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={pickBinaryFile}>
                                  <Upload size={14} /> {activeReq!.binaryFile ? 'Alterar Arquivo' : 'Selecionar Arquivo'}
                                </button>
                                {activeReq!.binaryFile && (
                                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <FileText size={18} className="text-info" />
                                    <div style={{ textAlign: 'left' }}>
                                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{activeReq!.binaryFile.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{activeReq!.binaryFile.path}</div>
                                    </div>
                                    <button className="btn-icon danger" onClick={() => handleActiveReqChange({ binaryFile: null })}>
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {activeReq!.bodyType === 'none' && (
                              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sem corpo nesta requisicao</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div
                className="resizer"
                onMouseDown={() => {
                  isResizing.current = true;
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              />

              {/* Bottom Panel Wrapper */}
              <div className="bottom-panel-wrapper">

                <div className="tabs bottom-tabs">
                  {activeReq?.method !== 'WS' && (
                    <>
                      <div className={`tab ${activeResTab === 'response' ? 'active' : ''}`} onClick={() => setActiveResTab('response')}>
                        Resposta {activeResponse && <span className={`status-dot ${activeResponse.status >= 200 && activeResponse.status < 300 ? 'dot-success' : activeResponse.status === 0 ? 'dot-warn' : 'dot-error'}`}></span>}
                      </div>
                      <div className={`tab ${activeResTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveResTab('headers')}>
                        Headers <span className="badge">{activeResponse?.headers ? Object.keys(activeResponse.headers).length : ''}</span>
                      </div>
                    </>
                  )}
                  <div className={`tab ${activeResTab === 'console' || activeReq?.method === 'WS' ? 'active' : ''}`} onClick={() => setActiveResTab('console')}>
                    <Terminal size={14} /> Console <span className="badge">{activeLogs.length || ''}</span>
                  </div>
                </div>

                {/* WS Specific Right Panel Override */}
                {activeReq?.method === 'WS' ? (
                  <div className="console-panel body-content">
                    {renderConsole(activeLogs, () => setActiveLogs([]))}
                  </div>
                ) : (
                  <>
                    {/* Response Panel Content */}
                    {activeResTab === 'response' && (
                      <div className="response-panel body-content">
                        {activeResponse ? (
                          <>
                            <div className="response-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <span className={`status-badge ${activeResponse.status >= 200 && activeResponse.status < 300 ? 'status-success' : activeResponse.status === 0 ? 'status-warning' : 'status-error'}`}>
                                  {activeResponse.status === 0 ? 'ERR/000' : `${activeResponse.status} ${activeResponse.statusText}`}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}><span style={{ color: 'var(--info)' }}>{activeResponse.time}ms</span></span>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary" onClick={() => { setActiveResponse(null); setActiveLogs([]); }} style={{ padding: '5px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }} title="Limpar">
                                  <Trash2 size={13} />
                                </button>
                                <button className="btn btn-secondary" onClick={copyResponse} style={{ padding: '5px 10px', fontSize: '11px' }} title="Copiar">
                                  {copiedRes ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                </button>
                                <button className="btn btn-secondary" onClick={downloadResponse} style={{ padding: '5px 10px', fontSize: '11px' }} title="Download">
                                  <Download size={13} />
                                </button>
                              </div>
                            </div>
                            <div style={{ flex: 1, marginTop: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: '#212121', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                              {activeResponse.type === 'image' ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '20px' }}>
                                  <img src={responseBlobUrl || activeResponse.data} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} alt="Response" />
                                </div>
                              ) : activeResponse.type === 'pdf' ? (
                                responseBlobUrl
                                  ? <iframe src={responseBlobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                                  : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Falha ao renderizar PDF</div>
                              ) : activeResponse.type === 'html' ? (
                                <iframe srcDoc={activeResponse.data} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} title="HTML Preview" />
                              ) : activeResponse.type === 'binary' ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Database size={22} style={{ color: 'var(--text-muted)' }} />
                                  </div>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    Conteudo binario ({activeResponse.contentType?.split(';')[0] || 'desconhecido'})
                                  </span>
                                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={downloadResponse}>
                                    <Download size={14} /> Baixar Arquivo
                                  </button>
                                </div>
                              ) : (
                                <CodeMirror
                                  value={typeof activeResponse.data === 'object' ? JSON.stringify(activeResponse.data, null, 2) : String(activeResponse.data || "(Nenhum conteúdo renderizável)")}
                                  extensions={[json()]}
                                  theme={oneDark}
                                  readOnly={true}
                                  height="100%"
                                  style={{ flex: 1, height: '100%' }}
                                  basicSetup={{
                                    lineNumbers: true,
                                    tabSize: 2,
                                    autocompletion: false,
                                    foldGutter: true
                                  }}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Send size={22} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Envie uma requisicao para ver a resposta</span>
                          </div>
                        )}
                      </div>
                    )}

                    {activeResTab === 'headers' && (
                      <div className="response-panel body-content" style={{ padding: '24px' }}>
                        {activeResponse?.headers ? (
                          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="headers-grid header-row-title" style={{ gridTemplateColumns: 'minmax(200px, 1fr) 2fr', background: 'rgba(0,0,0,0.2)', padding: '12px 20px' }}>
                              <div>Chave</div>
                              <div>Valor</div>
                            </div>
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                              {Object.entries(activeResponse.headers).map(([key, value]) => (
                                <div key={key} className="headers-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) 2fr', borderTop: '1px solid var(--border-subtle)', padding: '10px 20px', fontSize: '13px' }}>
                                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{key}</div>
                                  <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>{value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Network size={22} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Headers aparecem apos enviar a requisicao</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Console Panel Content */}
                    {activeResTab === 'console' && (
                      <div className="console-panel body-content">
                        {renderConsole(activeLogs, () => setActiveLogs([]))}
                      </div>
                    )}
                  </>
                )}
              </div> {/* End of bottom-panel-wrapper */}
            </div> {/* End of editor-layout */}
          </>
        )}
      </main>

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-primary)', zIndex: 9999
        }}>
          <div style={{ fontSize: '48px', animation: 'spin 1.5s linear infinite', marginBottom: '16px' }}><Globe /></div>
          <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '0.5px' }}>Processando...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: '20px' }}>Aguardando resposta do servidor</div>
          <button className="btn btn-danger" style={{ padding: '6px 20px', fontSize: '13px' }} onClick={cancelReq}>Cancelar</button>
        </div>
      )}

    </div >
  );
}
