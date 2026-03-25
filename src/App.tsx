import './index.css';
import React, { useState, useRef, useEffect, Fragment } from 'react';
import {
  Folder, FileText, Plus, Download, Upload,
  Play, Square, Trash2, Send, Clock, Edit2, FilePlus, Terminal, AlertTriangle,
  ChevronRight, ChevronDown, Copy, Check, CopyPlus, Globe, Layers, MoreHorizontal, Database
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { graphql } from 'cm6-graphql';
import { oneDark } from '@codemirror/theme-one-dark';
import { fetch as tauriHttpFetch } from '@tauri-apps/plugin-http';
import WebSocket from '@tauri-apps/plugin-websocket';
import { save as tauriSave, open as tauriOpen } from '@tauri-apps/plugin-dialog';
import { writeFile as tauriWriteFile, readFile as tauriReadFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
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


const safeFetch = async (url: string, init?: RequestInit) => {
  if (isTauri()) {
    return tauriHttpFetch(url, init);
  }
  return fetch(url, init);
};

// Types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';
type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'inherit' | 'oauth2';

interface RequestHeader {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
}

interface Environment {
  id: string;
  name: string;
  variables: EnvVar[];
}

interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    accessTokenUrl: string;
    authUrl: string;
    scope: string;
    accessToken: string;
  };
}

type RequestBodyType = 'json' | 'form-data' | 'urlencoded' | 'binary' | 'none' | 'graphql' | 'ws';

interface FormDataField {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  fileInfo?: { name: string; path: string };
}

interface RequestModel {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  auth: AuthConfig;
  headers: RequestHeader[];
  queryParams: RequestHeader[];
  params: RequestHeader[];
  body: string;
  bodyType: RequestBodyType;
  formData: FormDataField[];
  graphqlQuery?: string;
  graphqlVariables?: string;
  wsMessages?: { id: string; type: 'sent' | 'received' | 'info' | 'error'; text: string; timestamp: number }[];
  binaryFile?: { name: string; path: string } | null;
  savedResponse?: {
    status: number;
    statusText: string;
    data: any;
    time: number;
    type?: 'json' | 'image' | 'pdf' | 'html' | 'text' | 'binary' | 'ws';
    contentType?: string;
    headers?: Record<string, string>;
  } | null;
  savedLogs?: LogEntry[];
}

interface CollectionNode {
  id: string;
  name: string;
  type: 'folder' | 'request' | 'workspace';
  children?: CollectionNode[];
  request?: RequestModel;
  folderConfig?: {
    auth: AuthConfig;
    variables?: EnvVar[];
    setupScript?: string;
    headers?: RequestHeader[];
  };
  workspaceConfig?: {
    environments: Environment[];
    activeEnvironmentId: string | null;
    history: HistoryEntry[];
  };
  expanded?: boolean;
  savedLogs?: LogEntry[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'log' | 'error' | 'warn' | 'info' | 'success';
  message: string;
  data?: any;
}

// Legacy interface for migration
interface LegacyWorkspace {
  id: string;
  name: string;
  collection: CollectionNode[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history?: HistoryEntry[];
}

interface HistoryEntry {
  id: string;
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  timestamp: string;
  status: number;
}

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

const initialCollection: CollectionNode[] = [
  {
    id: 'ws_default',
    name: 'Workspace Padrão',
    type: 'workspace',
    expanded: true,
    workspaceConfig: {
      environments: [
        { id: 'env_dev', name: 'Ambiente DEV', variables: [{ id: uuidv4(), key: 'base_url', value: 'http://localhost:3000' }] },
        { id: 'env_prod', name: 'Ambiente PROD', variables: [{ id: uuidv4(), key: 'base_url', value: 'https://api.myapp.com' }] }
      ],
      activeEnvironmentId: 'env_dev',
      history: []
    },
    children: [
      {
        id: '1',
        name: 'Meu Servidor/Projeto',
        type: 'folder',
        expanded: true,
        folderConfig: {
          auth: { type: 'bearer', token: '{{token_acesso}}' },
          variables: []
        },
        children: [
          {
            id: '1a',
            name: 'Listar Dados (Rota GET)',
            type: 'request',
            request: { ...defaultRequest, id: '1a', name: 'Listar Dados (Rota GET)', headers: defaultRequest.headers.map(h => ({ ...h })) }
          }
        ]
      }
    ]
  }
];

// Migration helper: convert legacy workspace format to new tree format
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
  // COLLECTION ENGINE (Workspaces are root nodes in tree)
  // ---------------------------------------------------------
  const [collection, setCollection] = useState<CollectionNode[]>(() => {
    const migrated = migrateWorkspacesToTreeFormat();
    return migrated || initialCollection;
  });

  const [sidebarTab, setSidebarTab] = useState<'collection' | 'history'>('collection');
  const [treeSearchQuery, setTreeSearchQuery] = useState('');
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

  // --- Workspace Context Helpers ---
  const findParentWorkspace = (nodeId: string, nodes: CollectionNode[] = collection): CollectionNode | null => {
    for (const node of nodes) {
      if (node.type === 'workspace') {
        // Check if nodeId is this workspace or inside it
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = getActiveNode(node.children, nodeId);
          if (found) return node;
        }
      }
    }
    return null;
  };

  const getActiveEnvironment = (nodeId: string): Environment | null => {
    const ws = findParentWorkspace(nodeId);
    if (!ws?.workspaceConfig) return null;
    return ws.workspaceConfig.environments.find(e => e.id === ws.workspaceConfig!.activeEnvironmentId) || null;
  };

  const getWorkspaceEnvironments = (nodeId: string): Environment[] => {
    const ws = findParentWorkspace(nodeId);
    return ws?.workspaceConfig?.environments || [];
  };

  const getWorkspaceActiveEnvId = (nodeId: string): string | null => {
    const ws = findParentWorkspace(nodeId);
    return ws?.workspaceConfig?.activeEnvironmentId || null;
  };

  const setWorkspaceActiveEnvId = (wsId: string, envId: string | null) => {
    updateNodeInCollection(wsId, (node) => {
      if (node.type !== 'workspace' || !node.workspaceConfig) return node;
      return {
        ...node,
        workspaceConfig: { ...node.workspaceConfig, activeEnvironmentId: envId }
      };
    });
  };

  const getWorkspaceHistory = (nodeId: string): HistoryEntry[] => {
    const ws = findParentWorkspace(nodeId);
    return ws?.workspaceConfig?.history || [];
  };

  const addWorkspaceHistoryEntry = (nodeId: string, entry: HistoryEntry) => {
    const ws = findParentWorkspace(nodeId);
    if (!ws) return;
    updateNodeInCollection(ws.id, (node) => {
      if (node.type !== 'workspace' || !node.workspaceConfig) return node;
      return {
        ...node,
        workspaceConfig: {
          ...node.workspaceConfig,
          history: [entry, ...(node.workspaceConfig.history || [])].slice(0, 50)
        }
      };
    });
  };

  const addWorkspace = () => {
    const name = prompt('Nome do novo Workspace:', 'Novo Workspace');
    if (!name) return;
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
  };

  // Default to null to show welcome screen initially
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const switchActiveNode = (nodeId: string | null) => {
    setActiveNodeId(nodeId);
    setActiveResponse(null);
    setActiveLogs([]);
  };

  // Tabs
  const [activeReqTab, setActiveReqTab] = useState<'auth' | 'headers' | 'body' | 'params' | 'queries'>('auth');
  const [activeFolderSettingTab, setActiveFolderSettingTab] = useState<'auth' | 'vars' | 'headers'>('auth');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'environments' | 'globals' | 'summary'>('environments');
  const [activeResTab, setActiveResTab] = useState<'response' | 'headers' | 'console'>('response');

  const [loading, setLoading] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  // Response and logs live outside the collection — not persisted to localStorage
  const [activeResponse, setActiveResponse] = useState<RequestModel['savedResponse']>(null);
  const [activeLogs, setActiveLogs] = useState<LogEntry[]>([]);

  // Modals & States
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [openMenuNodeId, setOpenMenuNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<{ id: string, name: string } | null>(null);

  // Timeouts & Abort Controllers
  const [reqTimeoutMs, setReqTimeoutMs] = useState<number>(30000);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const loadingOverlayTimer = useRef<number | null>(null);

  const cancelReq = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('warn', '🚨 Requisição cancelada pelo usuário.');
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!openMenuNodeId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tree-dropdown-menu') && !target.closest('.tree-item-menu-trigger')) {
        setOpenMenuNodeId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuNodeId]);

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
  const draggedNodeIdRef = useRef<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ id: string, position: 'top' | 'bottom' | 'inside' } | null>(null);

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

  const handleDrop = (targetId: string | null, asChild: boolean, insertBefore: boolean = false) => {
    const draggedId = draggedNodeIdRef.current;
    if (!draggedId) {
      return;
    }

    if (draggedId === targetId) {
      draggedNodeIdRef.current = null;
      document.body.classList.remove('dragging-active');
      return;
    }



    setCollection(prev => {
      // 1. Clonagem Profunda
      const newCollection: CollectionNode[] = JSON.parse(JSON.stringify(prev));
      let draggedNode: CollectionNode | null = null;

      // 2. Auxiliar para remover o nó do lugar antigo
      const findAndRemove = (list: CollectionNode[]): boolean => {
        for (let i = 0; i < list.length; i++) {
          if (list[i].id === draggedId) {
            draggedNode = list.splice(i, 1)[0];
            return true;
          }
          if (list[i].children) if (findAndRemove(list[i].children!)) return true;
        }
        return false;
      };

      // 3. Auxiliar para verificar se o alvo está DENTRO do que está sendo arrastado (Evita loop infinito)
      const isTargetInsideDragged = (node: CollectionNode): boolean => {
        if (node.id === targetId) return true;
        if (node.children) {
          return node.children.some(child => isTargetInsideDragged(child));
        }
        return false;
      };

      // Pegamos o nó real que está sendo arrastado para o check de parentesco
      const sourceNode = getActiveNode(prev, draggedId);
      if (sourceNode && targetId && isTargetInsideDragged(sourceNode)) {
        addLog('error', "❌ Operação inválida: Não é possível mover uma pasta para dentro de si mesma ou de seus filhos.");
        return prev;
      }

      // Agora removemos e reinserimos
      findAndRemove(newCollection);
      if (!draggedNode) return prev;

      const nodeToMove: CollectionNode = draggedNode;

      // 4. Inserção no novo lugar
      if (!targetId) {
        newCollection.push(nodeToMove);
      } else {
        const findAndInsert = (list: CollectionNode[]): boolean => {
          for (let i = 0; i < list.length; i++) {
            if (list[i].id === targetId) {
              if (asChild && (list[i].type === 'folder' || list[i].type === 'workspace')) {
                list[i].children = [...(list[i].children || []), nodeToMove];
                list[i].expanded = true;
              } else {
                const index = insertBefore ? i : i + 1;
                list.splice(index, 0, nodeToMove);
              }
              return true;
            }
            if (list[i].children) if (findAndInsert(list[i].children!)) return true;
          }
          return false;
        };
        findAndInsert(newCollection);
      }

      addLog('success', `📦 Movido: ${nodeToMove.name} para ${targetId ? 'nova posição' : 'Raiz'}`);
      return newCollection;
    });

    draggedNodeIdRef.current = null;
    document.body.classList.remove('dragging-active');
  };

  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const newLog: LogEntry = { id: uuidv4(), timestamp: new Date(), type, message, data };
    setActiveLogs(prev => [...prev, newLog]);
  };

  // Persist State
  useEffect(() => {
    localStorage.setItem('aurafetch_collection_v2', JSON.stringify(collection));
    localStorage.setItem('aurafetch_globals', JSON.stringify(globalVariables));
  }, [collection, globalVariables]);

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
  }, [isLooping, intervalMs]);

  // Global Drag & Drop Fix for Tauri/Windows (WebView2)
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      if (draggedNodeIdRef.current) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      }
    };
    const handleGlobalDrop = (e: DragEvent) => {
      if (draggedNodeIdRef.current) {
        // Se cair fora de um alvo específico, o container da árvore ou o window limpam
        // Mas deixamos os handlers específicos cuidarem da lógica de negócio
        // Aqui apenas garantimos que o estado de arraste suma
        if (e.target === window || (e.target as HTMLElement).closest('.main-content')) {
          draggedNodeIdRef.current = null;
          document.body.classList.remove('dragging-active');
          document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
          document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

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

  const updateNodeInCollection = (nodeId: string, updater: (node: CollectionNode) => CollectionNode) => {
    setCollection(prev => {
      const update = (nodes: CollectionNode[]): CollectionNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return updater(node);
          }
          if (node.children) return { ...node, children: update(node.children) };
          return node;
        });
      };
      return update(prev);
    });
  };

  const handleActiveReqChange = (updates: Partial<RequestModel>) => {
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

  const toggleFolder = (nodeId: string) => {
    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.id === nodeId) return { ...node, expanded: !node.expanded };
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });
    setCollection(updateNode(collection));
  };

  const addFolderTo = (parentId: string) => {
    const newFolder: CollectionNode = {
      id: uuidv4(),
      name: 'Nova Pasta',
      type: 'folder',
      expanded: true,
      children: [],
      folderConfig: { auth: { ...defaultFolderAuth }, variables: [] }
    };
    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.id === parentId) {
        return { ...node, expanded: true, children: [...(node.children || []), newFolder] };
      }
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });
    setCollection(updateNode(collection));
    switchActiveNode(newFolder.id);
    addLog('info', '📁 Nova pasta criada');
  };

  const generateCrudExample = () => {
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
            variables: [], // Variáveis limpas na pasta para herdar do ambiente
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

    setCollection(prev => [...prev, newWorkspace]);
    switchActiveNode(workspaceId);
    addLog('success', '📦 Nova Workspace de Exemplo criada com ambientes Prod/Dev e CRUD completo');
  };

  const addRequestToFolder = (folderId: string) => {
    const req = { ...defaultRequest, id: uuidv4(), name: 'Nova Rota' };
    const newNode: CollectionNode = { id: req.id, name: req.name, type: 'request', request: req };

    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.id === folderId) {
        return { ...node, expanded: true, children: [...(node.children || []), newNode] };
      }
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });
    setCollection(updateNode(collection));
    switchActiveNode(req.id);
    addLog('success', '📄 Nova rota adicionada ao agrupador.');
  };

  const addWebSocketToFolder = (folderId: string) => {
    const wsReq = {
      ...defaultRequest,
      id: uuidv4(),
      name: 'Conexão WebSocket',
      method: 'WS' as HttpMethod,
      url: 'wss://echo.websocket.org',
      bodyType: 'ws' as RequestBodyType,
      wsMessages: []
    };
    const newNode: CollectionNode = { id: wsReq.id, name: wsReq.name, type: 'request', request: wsReq };

    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.id === folderId || node.id === folderId.replace('-ws', '')) {
        return { ...node, expanded: true, children: [...(node.children || []), newNode] };
      }
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });
    setCollection(updateNode(collection));
    switchActiveNode(wsReq.id);
    addLog('info', '🌐 Nova conexão WebSocket adicionada.');
  };

  const cloneRequest = (nodeId: string) => {
    const nodeToClone = getActiveNode(collection, nodeId);
    if (!nodeToClone || nodeToClone.type !== 'request' || !nodeToClone.request) return;

    const id = uuidv4();
    const clonedReq = { ...nodeToClone.request, id, name: `${nodeToClone.name} (Cópia)` };
    const newNode: CollectionNode = { id, name: clonedReq.name, type: 'request', request: clonedReq };

    let attached = false;
    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.children && node.children.some(c => c.id === nodeId)) {
        attached = true;
        const idx = node.children.findIndex(c => c.id === nodeId);
        const newChildren = [...node.children];
        newChildren.splice(idx + 1, 0, newNode);
        return { ...node, children: newChildren };
      }
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });

    const newColl = updateNode(collection);
    if (!attached) {
      const idx = newColl.findIndex(n => n.id === nodeId);
      newColl.splice(idx + 1, 0, newNode);
    }

    setCollection(newColl);
    switchActiveNode(id);
    addLog('success', `📄 Requisição clonada: ${clonedReq.name}`);
  };

  const confirmDelete = () => {
    if (!nodeToDelete) return;
    const nodeId = nodeToDelete.id;

    const removeNode = (nodes: CollectionNode[]): CollectionNode[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) return false;
        if (node.children) {
          node.children = removeNode(node.children);
        }
        return true;
      });
    };

    setCollection(removeNode(collection));
    addLog('warn', `🗑️ Item deletado: ${nodeToDelete.name}`);

    if (activeNodeId === nodeId) {
      switchActiveNode(null);
    }

    setNodeToDelete(null);
  };

  const startRename = (nodeId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(nodeId);
    setEditingName(currentName);
  };

  const commitRename = (nodeId: string) => {
    if (!editingName.trim()) {
      setEditingNodeId(null);
      return;
    }
    const updateNode = (nodes: CollectionNode[]): CollectionNode[] => nodes.map(node => {
      if (node.id === nodeId) {
        if (node.type === 'request' && node.request) {
          addLog('info', `✏️ Requisição renomeada para "${editingName.trim()}"`);
          return { ...node, name: editingName.trim(), request: { ...node.request, name: editingName.trim() } };
        }
        addLog('info', `✏️ Agrupador renomeado para "${editingName.trim()}"`);
        return { ...node, name: editingName.trim() };
      }
      if (node.children) return { ...node, children: updateNode(node.children) };
      return node;
    });
    setCollection(updateNode(collection));
    setEditingNodeId(null);
  };

  // --- VARIABLES ENGINE (HIERARCHY RESOLUTION) ---
  const applyVariables = (text: string, targetNodeId: string): string => {
    if (!text || typeof text !== 'string') return text;

    // Helper to find path to node
    const getPath = (current: CollectionNode[], id: string, currentPath: CollectionNode[]): CollectionNode[] | null => {
      for (const node of current) {
        if (node.id === id) return [...currentPath, node];
        if (node.children) {
          const path = getPath(node.children, id, [...currentPath, node]);
          if (path) return path;
        }
      }
      return null;
    };

    let result = text;
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    const path = getPath(collection, targetNodeId, []);
    const activeEnv = getActiveEnvironment(targetNodeId);

    // Debugging only if it's a request or if there's an issue
    if (result.includes('{{') && !path) {
       console.warn(`[Variables] No path found for node ${targetNodeId}. Variable resolution might fail.`);
    }

    while (result.includes('{{') && iterations < MAX_ITERATIONS) {
      const nextResult = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();

        // 1. Check Folder Hierarchy (Bottom-Up)
        if (path) {
          for (let i = path.length - 1; i >= 0; i--) {
            const node = path[i];
            if (node.type === 'folder' && node.folderConfig?.variables) {
              const v = node.folderConfig.variables.find(v => v.key === trimmedKey);
              if (v) return String(v.value ?? '');
            }
          }
        }

        // 2. Check Active Environment
        if (activeEnv) {
          const envVar = activeEnv.variables.find(v => v.key === trimmedKey);
          if (envVar) return String(envVar.value ?? '');
        }

        // 3. Check Global Variables
        const gv = globalVariables.find(v => v.key === trimmedKey);
        if (gv) return String(gv.value ?? '');

        return match;
      });

      if (nextResult === result) break;
      result = nextResult;
      iterations++;
    }
    return result;
  };

  const resolveAuth = (targetNodeId: string, nodes: CollectionNode[], currentParentAuth: AuthConfig = { type: 'none' }): AuthConfig | null => {
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
  };

  const resolveHeaders = (targetNodeId: string, nodes: CollectionNode[], currentParentHeaders: RequestHeader[] = []): RequestHeader[] => {
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
  };

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
        if (resolvedAuth.apiKeyIn === 'header') fetchHeaders[k] = v;
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
  const wsInstRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsInputMessage, setWsInputMessage] = useState('');

  const connectWs = async () => {
    if (!activeReq) return;
    setLoading(true);
    const targetUrl = applyVariables(activeReq.url, activeReq.id);
    addLog('info', `🔌 Tentando conectar WebSocket em: ${targetUrl}`);

    try {
      const ws = await WebSocket.connect(targetUrl);
      wsInstRef.current = ws;
      setWsConnected(true);

      handleActiveReqChange({
        wsMessages: [...(activeReq.wsMessages || []), { id: uuidv4(), type: 'info', text: 'Conectado a ' + targetUrl, timestamp: Date.now() }]
      });

      ws.addListener((msg) => {
        let textData = '';
        if (msg.type === 'Text') textData = msg.data as string;
        else if (msg.type === 'Binary') textData = '[Binary Message]';

        handleActiveReqChange({
          wsMessages: [...(activeReq.wsMessages || []), { id: uuidv4(), type: 'received', text: textData, timestamp: Date.now() }]
        });
      });

    } catch (err: any) {
      addLog('error', `❌ Falha ao conectar WS: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWs = async () => {
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

  const sendWsMessage = async () => {
    if (wsInstRef.current && wsConnected && wsInputMessage.trim()) {
      await wsInstRef.current.send(wsInputMessage);
      handleActiveReqChange({
        wsMessages: [...(activeReq!.wsMessages || []), { id: uuidv4(), type: 'sent', text: wsInputMessage, timestamp: Date.now() }]
      });
      setWsInputMessage('');
    }
  };

  const handleSend = async () => {
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
    
    // Configura um timer global na request para só exibir que tá carregando visualmente pesadão após 3 secs
    loadingOverlayTimer.current = window.setTimeout(() => {
      setShowLoadingOverlay(true);
    }, 3000);

    const startTime = Date.now();

    // Use activeNodeId which is more reliable for path finding in Tree
    const nodeId = activeNodeId || activeReq.id;
    const parentWs = findParentWorkspace(nodeId);
    const activeEnv = getActiveEnvironment(nodeId);
    
    if (activeEnv) {
      addLog('info', `🌍 [Ambiente: ${activeEnv.name}] resolvendo variáveis para o disparo...`);
    } else if (parentWs) {
      addLog('warn', `⚠️ [Aviso] Nenhum Ambiente ATIVO selecionado no Workspace "${parentWs.name}". Variáveis do ambiente não serão resolvidas.`);
    } else {
      addLog('error', `❌ [Erro de Escopo] Não foi possível localizar o Workspace para a requisição selecionada. As variáveis não serão carregadas.`);
    }

    // Apply Vars to URL
    let targetUrl = applyVariables(activeReq.url, nodeId);

    // 1. Resolve Path Params
    (activeReq.params || []).forEach(p => {
      if (p.enabled && p.key.trim()) {
        const key = p.key.trim();
        const value = applyVariables(p.value.trim(), activeReq.id);
        // Replace :key or {key}
        targetUrl = targetUrl.replace(new RegExp(`:${key}`, 'g'), value);
        targetUrl = targetUrl.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    });

      // 2. Resolve Query Params
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

      // 1. Resolve Inherited Headers from Folders
      const inheritedHeaders = resolveHeaders(activeReq.id, collection);
      inheritedHeaders.forEach(h => {
        if (h.enabled && h.key.trim() && h.value.trim()) {
          fetchHeaders[applyVariables(h.key.trim(), activeReq.id)] = applyVariables(h.value.trim(), activeReq.id);
        }
      });

      // 2. Apply Request Specific Headers (overwrites folder headers)
      activeReq.headers.forEach(h => {
        if (h.enabled && h.key.trim() && h.value.trim()) {
          fetchHeaders[applyVariables(h.key.trim(), activeReq.id)] = applyVariables(h.value.trim(), activeReq.id);
        }
      });

      const resolvedAuth = resolveAuth(activeReq.id, collection);
      let finalTargetUrl = targetUrl;

      if (resolvedAuth) {
        if (resolvedAuth.type === 'bearer' && resolvedAuth.token) {
          fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuth.token, activeReq.id)}`;
        }
        else if (resolvedAuth.type === 'oauth2' && resolvedAuth.oauth2Config?.accessToken) {
          fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuth.oauth2Config.accessToken, activeReq.id)}`;
        }
        else if (resolvedAuth.type === 'basic' && resolvedAuth.username) {
          const userStr = applyVariables(resolvedAuth.username, activeReq.id);
          const passStr = applyVariables(resolvedAuth.password || '', activeReq.id);
          const b64 = btoa(`${userStr}:${passStr}`);
          fetchHeaders['Authorization'] = `Basic ${b64}`;
        }
        else if (resolvedAuth.type === 'apikey' && resolvedAuth.apiKeyKey && resolvedAuth.apiKeyValue) {
          const keyStr = applyVariables(resolvedAuth.apiKeyKey, activeReq.id);
          const valStr = applyVariables(resolvedAuth.apiKeyValue, activeReq.id);
          if (resolvedAuth.apiKeyIn === 'header') {
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

      // 3. Construct Request Body based on bodyType
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
          const bytes = await tauriReadFile(activeReq.binaryFile.path);
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
              const bytes = await tauriReadFile(f.fileInfo.path);
              fd.append(key, new Blob([bytes]), f.fileInfo.name);
            }
          }
          opts.body = fd;
          // Note: Browser handles Content-Type with boundary for FormData
        }
      }

      if (!finalTargetUrl.startsWith('http') && !finalTargetUrl.includes('://')) {
        // Simple heuristic for URLs that might be missing protocol or variables not replaced correctly
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
        const b64 = btoa(
          new Uint8Array(buffer)
            .reduce((acc, byte) => acc + String.fromCharCode(byte), '')
        );
        data = `data:${contentType};base64,${b64}`;
        responseType = 'image';
      } else if (contentType.includes('application/pdf')) {
        const buffer = await res.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(buffer)
            .reduce((acc, byte) => acc + String.fromCharCode(byte), '')
        );
        data = `data:${contentType};base64,${b64}`;
        responseType = 'pdf';
      } else {
        const isText = contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/xml') ||
          contentType.includes('application/javascript');

        if (!isText && (contentType.includes('application/') || contentType.includes('font/'))) {
          // It's a binary file (ZIP, Font, EXE, etc.)
          data = "[Arquivo Binário]";
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

      // Registrar TODOS os disparos no histórico, incluindo falhas
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

      addLog('error', `❌ Falha no disparo. Erro: ${errData}`, errOutput);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setShowLoadingOverlay(false);
      if (loadingOverlayTimer.current) {
        clearTimeout(loadingOverlayTimer.current);
      }
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  const runFolderScript = async (nodeId: string) => {
    const node = getActiveNode(collection, nodeId);
    if (!node || node.type !== 'folder' || !node.folderConfig?.setupScript) return;

    setLoading(true);
    addLog('info', `⚙️ Rodando Script Livre da pasta...`);
    setActiveResTab('console');

    try {
      const scriptBody = node.folderConfig.setupScript;

      const aurafetchCtx = {
        setEnv: (key: string, value: any) => {
          if (value === undefined || value === null) {
            addLog('error', `⚠️ [aurafetch] Tentativa de salvar '${key}' com valor nulo ou indefinido! Verifique a resposta da API.`);
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
            addLog('success', `🧩 [aurafetch] Variável de Ambiente '${key}' salva! (Valor: ${finalVal.substring(0, 10)}...)`);
          } else {
            setGlobalVariables(globals => {
              const exists = globals.find(v => v.key === key);
              if (exists) return globals.map(v => v.key === key ? { ...v, value: finalVal } : v);
              return [...globals, { id: uuidv4(), key, value: finalVal }];
            });
            addLog('success', `🧩 [aurafetch] Variável Global '${key}' salva!`);
          }
        },
        setVar: (key: string, value: any) => {
          if (value === undefined || value === null) {
            addLog('error', `⚠️ [aurafetch] Tentativa de salvar '${key}' na PASTA com valor nulo ou indefinido!`);
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
          addLog('success', `🧩 [aurafetch] Variável da Pasta '${key}' setada para: ${finalVal.substring(0, 10)}...`);
        },
        log: (msg: any) => addLog('log', `📝 [aurafetch] ${typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg}`)
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

        addLog('info', `🌐 [fetch] Chamada externa: ${finalUrl}`, {
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
          addLog(statusLog, `🌐 [fetch] Resposta: ${res.status} ${res.statusText}`, parsed);

          // Re-create a fake response but with already read text 
          // because script might call res.json() again
          return {
            ...res,
            text: async () => txt,
            json: async () => typeof parsed === 'string' ? JSON.parse(parsed) : parsed
          } as any;
        } catch (e: any) {
          addLog('error', `❌ [fetch] Falha na rede: ${e.message}`);
          throw e;
        }
      };

      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
      const fn = new AsyncFunction('aurafetch', 'fetch', 'tauriFetch', scriptBody);

      await fn(aurafetchCtx, customFetch, customFetch);

      addLog('success', `✅ Script finalizado! Variáveis injetadas com sucesso.`);
    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Erro interno desconhecido';
      addLog('error', `❌ Falha no Script: ${errorMsg}`);
      console.error('Folder Script Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCollection = async () => {
    try {
      // Export collection (workspaces are inside), and globals
      const db = { collection, globals: globalVariables };
      const content = JSON.stringify(db, null, 2);

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
      console.error('Export error:', err);
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown Error';
      addLog('error', `❌ Falha ao exportar workspace: ${msg}`);
    }
  };

  const importCollection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const obj = JSON.parse(event.target?.result as string);
        if (obj.collection) {
          setCollection(obj.collection);
          if (obj.globals) setGlobalVariables(obj.globals);
        } else {
          // Legacy: raw collection array without wrapper
          setCollection(obj);
        }

        switchActiveNode(null);
        addLog('success', `📦 Importação de "${file.name}" feita 100%.`);
      } catch (err) {
        addLog('error', `❌ O arquivo JSON é inválido.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyResponse = () => {
    if (!activeResponse) return;
    const stringData = typeof activeResponse.data === 'object' ? JSON.stringify(activeResponse.data, null, 2) : String(activeResponse.data);
    navigator.clipboard.writeText(stringData);
    setCopiedRes(true);
    setTimeout(() => setCopiedRes(false), 2000);
  };

  const downloadResponse = async () => {
    if (!activeResponse) return;
    try {
      const { data, type, contentType } = activeResponse;
      let extension = 'txt';
      if (type === 'json') extension = 'json';
      else if (type === 'image') {
        const subType = contentType?.split('/')[1]?.split(';')[0] || 'png';
        extension = subType;
      }
      else if (type === 'pdf') extension = 'pdf';
      else if (type === 'html') extension = 'html';

      // Clean name for filename
      const safeName = (activeReq?.name ?? 'response').replace(/[^a-z0-9]/gi, '_').toLowerCase();

      const filePath = await tauriSave({
        filters: [{ name: 'Arquivo de Resposta', extensions: [extension] }],
        defaultPath: `response_${safeName}.${extension}`
      });

      if (filePath) {
        if (type === 'image' || type === 'pdf') {
          // Convert from Base64 Data URL to Uint8Array
          const b64Data = data.split(',')[1];
          const binaryString = window.atob(b64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await tauriWriteFile(filePath, bytes);
        } else {
          // Normal text/json
          const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
          const encoder = new TextEncoder();
          await tauriWriteFile(filePath, encoder.encode(content));
        }
        addLog('success', `📂 Arquivo salvo em: ${filePath}`);
      }
    } catch (err: any) {
      addLog('error', `❌ Falha ao salvar arquivo: ${err.message}`);
    }
  };

  const pickBinaryFile = async () => {
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
        addLog('info', `📎 Arquivo binário selecionado: ${selected}`);
      }
    } catch (err: any) {
      addLog('error', `❌ Erro ao selecionar arquivo: ${err.message}`);
    }
  };

  const pickFormDataFile = async (fieldId: string) => {
    try {
      const selected = await tauriOpen({ multiple: false, title: 'Selecionar arquivo para upload' });
      if (selected && typeof selected === 'string') {
        const newFormData = activeReq!.formData.map(f =>
          f.id === fieldId ? { ...f, fileInfo: { name: selected.split(/[\/\\]/).pop() || 'file', path: selected } } : f
        );
        handleActiveReqChange({ formData: newFormData });
        addLog('info', `📂 Arquivo para form-data selecionado: ${selected}`);
      }
    } catch (err: any) {
      addLog('error', `❌ Erro ao selecionar arquivo: ${err.message}`);
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

  const removeEnv = (eId: string) => {
    if (!activeNodeId) return;
    const ws = findParentWorkspace(activeNodeId);
    if (!ws) return;
    updateNodeInCollection(ws.id, (node) => {
      if (node.type !== 'workspace' || !node.workspaceConfig) return node;
      return {
        ...node,
        workspaceConfig: {
          ...node.workspaceConfig,
          environments: node.workspaceConfig.environments.filter(e => e.id !== eId),
          activeEnvironmentId: node.workspaceConfig.activeEnvironmentId === eId ? null : node.workspaceConfig.activeEnvironmentId
        }
      };
    });
    if (editingEnvId === eId) setEditingEnvId(null);
  };

  const addEnv = () => {
    if (!activeNodeId) return;
    const ws = findParentWorkspace(activeNodeId);
    if (!ws) return;
    const freshId = uuidv4();
    updateNodeInCollection(ws.id, (node) => {
      if (node.type !== 'workspace' || !node.workspaceConfig) return node;
      return {
        ...node,
        workspaceConfig: {
          ...node.workspaceConfig,
          environments: [...node.workspaceConfig.environments, { id: freshId, name: 'Novo Ambiente', variables: [] }]
        }
      };
    });
    setEditingEnvId(freshId);
  };

  const renderTree = (nodes: CollectionNode[], depth = 0) => {
    return nodes.map((node) => (
      <Fragment key={node.id}>
        <div
          className={`tree-item ${node.type === 'workspace' ? 'workspace-node' : ''} ${activeNodeId === node.id ? 'active-node' : ''} ${dragOverInfo?.id === node.id ? `drag-over-${dragOverInfo.position}` : ''}`}
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.id);
            e.dataTransfer.setData('text/uri-list', 'http://aurafetch.io/' + node.id);
            draggedNodeIdRef.current = node.id;
            document.body.classList.add('dragging-active');
            e.currentTarget.classList.add('is-dragging');
          }}
          onDragEnd={(e) => {
            draggedNodeIdRef.current = null;
            setDragOverInfo(null);
            document.body.classList.remove('dragging-active');
            e.currentTarget.classList.remove('is-dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
          }}
          onDragOver={(e) => {
            if (draggedNodeIdRef.current) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              let position: 'top' | 'bottom' | 'inside' = 'bottom';
              if (y < rect.height / 3) position = 'top';
              else if ((node.type === 'folder' || node.type === 'workspace') && y > rect.height / 3 && y < (rect.height * 2) / 3) position = 'inside';
              else position = 'bottom';
              if (dragOverInfo?.id !== node.id || dragOverInfo?.position !== position) {
                setDragOverInfo({ id: node.id, position });
              }
            }
          }}
          onDragEnter={(e) => {
            if (draggedNodeIdRef.current && draggedNodeIdRef.current !== node.id) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDragLeave={() => { if (dragOverInfo?.id === node.id) setDragOverInfo(null); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverInfo(null);
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const isTop = y < rect.height / 3;
            const isInside = node.type === 'folder' && y >= rect.height / 3 && y <= (rect.height * 2) / 3;
            const dId = e.dataTransfer.getData('text/plain') || draggedNodeIdRef.current;
            if (dId) handleDrop(node.id, isInside, isTop);
          }}
          onClick={() => { switchActiveNode(node.id); setOpenMenuNodeId(null); }}
          style={{ paddingLeft: `${depth * 14 + 8}px`, opacity: draggedNodeIdRef.current === node.id ? 0.3 : 1 }}
        >
          {/* ── Conteúdo ── */}
          <div className="tree-item-content">
            {(node.type === 'folder' || node.type === 'workspace') && (
              <span
                className="expander-icon"
                draggable={false}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); toggleFolder(node.id); }}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}

            {node.type === 'workspace' ? (
              <Database size={14} className="text-accent" style={{ opacity: 0.9, flexShrink: 0 }} />
            ) : node.type === 'folder' ? (
              <Folder size={14} className="text-accent" style={{ opacity: 0.8, flexShrink: 0 }} />
            ) : (
              <span className={`method-tag method-${node.request!.method}`}>
                {node.request!.method}
              </span>
            )}

            {/* Workspace env badge */}
            {node.type === 'workspace' && node.workspaceConfig && (() => {
              const activeEnv = node.workspaceConfig.environments.find(e => e.id === node.workspaceConfig!.activeEnvironmentId);
              return (
                <span className={`workspace-env-badge ${activeEnv ? '' : 'no-env'}`}>
                  <span className="env-dot" />
                  {activeEnv ? activeEnv.name : 'Sem Amb.'}
                </span>
              );
            })()}

            {editingNodeId === node.id ? (
              <input
                autoFocus
                className="rename-input"
                value={editingName}
                onClick={e => e.stopPropagation()}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(node.id);
                  if (e.key === 'Escape') setEditingNodeId(null);
                }}
                onBlur={() => commitRename(node.id)}
              />
            ) : (
              <span
                className={`node-name ${node.type === 'folder' ? 'folder-label' : ''}`}
                onDoubleClick={(e) => startRename(node.id, node.name, e as any)}
                title={node.name}
              >
                {node.name}
              </span>
            )}
          </div>

          {/* ── Menu trigger (único botão "⋮") ── */}
          <div className="tree-item-menu-trigger">
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuNodeId(openMenuNodeId === node.id ? null : node.id);
              }}
              title="Opções"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>

          {/* ── Dropdown Menu ── */}
          {openMenuNodeId === node.id && (
            <div className="tree-dropdown-menu" onClick={(e) => e.stopPropagation()}>
              {(node.type === 'folder' || node.type === 'workspace') && (
                <>
                  <button onClick={() => { addRequestToFolder(node.id); setOpenMenuNodeId(null); }}>
                    <FilePlus size={13} /> Nova Requisição
                  </button>
                  <button onClick={() => { addWebSocketToFolder(node.id); setOpenMenuNodeId(null); }}>
                    <Globe size={13} /> Nova Conexão WS
                  </button>
                  <button onClick={() => { addFolderTo(node.id); setOpenMenuNodeId(null); }}>
                    <Folder size={13} /> Nova Pasta
                  </button>
                </>
              )}
              {node.type === 'request' && (
                <button onClick={() => { cloneRequest(node.id); setOpenMenuNodeId(null); }}>
                  <CopyPlus size={13} /> Duplicar
                </button>
              )}
              <button onClick={(e) => { startRename(node.id, node.name, e); setOpenMenuNodeId(null); }}>
                <Edit2 size={12} /> Renomear
              </button>
              <button className="danger" onClick={() => { setNodeToDelete({ id: node.id, name: node.name }); setOpenMenuNodeId(null); }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          )}
        </div>
        {(node.type === 'folder' || node.type === 'workspace') && node.expanded && node.children && (
          <div className="tree-children-container" key={`${node.id}-children`}>
            {renderTree(node.children, depth + 1)}
          </div>
        )}
      </Fragment>
    ));
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

      {/* Modal Confirmation */}
      {nodeToDelete && (
        <div className="modal-overlay" onClick={() => setNodeToDelete(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--danger)', marginBottom: '16px' }}>
              <AlertTriangle size={28} />
              <h3 style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.3px' }}>Confirmar Eliminação</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: 1.6 }}>
              A deleção do item <strong style={{ color: 'var(--text-primary)' }}>"{nodeToDelete.name}"</strong> será irremovível. Pastas aninhadas também encontrarão seu fim. Prossigo?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setNodeToDelete(null)}>Repensar 🤔</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Deletar Logo 💥</button>
            </div>
          </div>
        </div>
      )}

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
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* 1. Header (Fixed Top) */}
        <div style={{ padding: '20px 16px 14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 className="app-title" onClick={() => switchActiveNode(null)} style={{ cursor: 'pointer', margin: 0 }}>
              <span className="highlight">Aura</span>Fetch
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: '2px' }}>Pesquisar</label>
            <input
              type="text"
              value={treeSearchQuery}
              onChange={e => setTreeSearchQuery(e.target.value)}
              placeholder="Buscar requisição, pasta..."
              className="text-input"
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-strong)', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}
            />
          </div>
        </div>

        {/* Sidebar Tabs for Coleção vs Histórico */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => setSidebarTab('collection')}
            style={{ flex: 1, padding: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: sidebarTab === 'collection' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: sidebarTab === 'collection' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            Coleções
          </button>
          <button
            onClick={() => setSidebarTab('history')}
            style={{ flex: 1, padding: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: sidebarTab === 'history' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: sidebarTab === 'history' ? '2px solid var(--accent-primary)' : 'none' }}
          >
            Histórico
          </button>
        </div>

        {sidebarTab === 'collection' ? (
          <>
            {/* 2. Collection Actions Bar (Fixed Below Sidebar Header) */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coleção</span>
              <div className="sidebar-actions" style={{ gap: '2px' }}>
                <button className="btn-icon" onClick={addWorkspace} title="Novo Workspace" style={{ padding: '5px' }}><Database size={14} /></button>
                <button className="btn-icon" onClick={exportCollection} title="Exportar" style={{ padding: '5px' }}><Download size={14} /></button>
                <label className="btn-icon" style={{ cursor: 'pointer', margin: 0, padding: '5px' }} title="Importar">
                  <Upload size={14} />
                  <input type="file" accept=".json" onChange={importCollection} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* 3. Scrollable Tree Area */}
            <div
              className="sidebar-tree-container"
              style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'auto', minHeight: '100px' }}
              onDragOver={(e) => {
                if (draggedNodeIdRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDragEnter={(e) => {
                if (draggedNodeIdRef.current) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedNodeIdRef.current) {
                  handleDrop(null, false);
                }
              }}
            >
              {(() => {
                if (!treeSearchQuery.trim()) return renderTree(collection);

                const query = treeSearchQuery.toLowerCase();
                const filterNodes = (nodes: CollectionNode[]): CollectionNode[] => {
                  return nodes.reduce((acc: CollectionNode[], node) => {
                    const matches = node.name.toLowerCase().includes(query);
                    const children = node.children ? filterNodes(node.children) : [];

                    if (matches || children.length > 0) {
                      acc.push({ ...node, children, expanded: children.length > 0 ? true : node.expanded });
                    }
                    return acc;
                  }, []);
                };

                const filtered = filterNodes(collection);
                return filtered.length > 0
                  ? renderTree(filtered)
                  : <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum resultado encontrado.</div>;
              })()}
              <div style={{ height: '80px', pointerEvents: 'none' }} />
            </div>
          </>
        ) : (
          <div className="sidebar-history-container" style={{ flex: 1, padding: '16px 14px', overflowY: 'auto', background: 'rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recentes</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {activeNodeId ? (findParentWorkspace(activeNodeId)?.name || '') : ''}
              </span>
            </div>
            {(() => {
              const wsHistory = activeNodeId ? getWorkspaceHistory(activeNodeId) : [];
              if (wsHistory.length === 0) return (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <Clock size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                  <p>Nenhuma requisição feita recentemente.</p>
                </div>
              );
              return wsHistory.map(entry => (
                <div
                  key={entry.id}
                  className="history-card"
                  onClick={() => switchActiveNode(entry.requestId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`method-${entry.method}`} style={{ fontSize: '10px', fontWeight: 900 }}>{entry.method}</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: entry.status >= 200 && entry.status < 300 ? 'var(--success)' : 'var(--text-error)' }}>
                      {entry.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.requestName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{entry.url}</span>
                    <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!activeNode ? (
          /* WELCOME SCREEN */
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <img src="/aurafetch_logo.png" alt="AuraFetch Logo" width={80} style={{ borderRadius: '16px', marginBottom: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} />
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>AuraFetch</h2>
            <p style={{ maxWidth: '400px', textAlign: 'center', lineHeight: 1.6, marginBottom: '32px' }}>
              Selecione uma requisição no menu lateral ou crie uma nova para começar.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="btn btn-primary" onClick={addWorkspace}><Database size={16} /> Novo Workspace</button>
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
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
                Gerencie ambientes, variáveis e configurações deste workspace.
              </p>
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
                      <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Nenhum ambiente.
                        <br />
                        Clique em <strong>+</strong> acima.
                      </div>
                    )}
                  </div>

                  {/* Right: env editor */}
                  <div className="ws-env-editor">
                    {!editingEnvId || !activeNode.workspaceConfig?.environments.find(e => e.id === editingEnvId) ? (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px', fontSize: '13px' }}>
                        <Layers size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                        <p>Selecione um ambiente na lista ao lado para editar suas variáveis.</p>
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
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>📊 Resumo do Workspace</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)' }}>{activeNode.children?.length || 0}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Itens na Raiz</div>
                      </div>
                      <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{activeNode.workspaceConfig?.environments.length || 0}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Ambientes</div>
                      </div>
                      <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{activeNode.workspaceConfig?.history?.length || 0}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>No Histórico</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>⚙️ Configurações Globais do App</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Timeout de Requisições (segundos)</label>
                        <input
                          type="number"
                          className="text-input"
                          value={reqTimeoutMs / 1000}
                          onChange={e => setReqTimeoutMs(Math.max(1, Number(e.target.value)) * 1000)}
                          style={{ width: '100%' }}
                        />
                        <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Tempo máximo de espera antes de cancelar automaticamente a requisição.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Active Env Info */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} /> Ambiente Ativo
                    </h3>
                    {(() => {
                      const wsActiveEnv = activeNode.workspaceConfig?.environments.find(e => e.id === activeNode.workspaceConfig?.activeEnvironmentId);
                      if (!wsActiveEnv) return (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum ambiente ativo. Vá para a aba "Ambientes" e ative um.</p>
                      );
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{wsActiveEnv.name}</span>
                            <span className="badge" style={{ fontSize: '10px' }}>{wsActiveEnv.variables.length} vars</span>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            {wsActiveEnv.variables.length === 0 ? (
                              <span style={{ color: 'var(--text-muted)' }}>Nenhuma variável definida neste ambiente.</span>
                            ) : wsActiveEnv.variables.map(v => (
                              <div key={v.id} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>{v.key}</span>
                                <span style={{ color: 'var(--text-muted)' }}>=</span>
                                <span style={{ color: 'var(--success)' }}>{v.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeNode.type === 'folder' ? (
          /* FOLDER CONFIGURATION */
          <div className="fade-in" style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', letterSpacing: '-0.5px', fontSize: '24px' }}>
              <Folder size={24} className="text-accent" style={{ opacity: 0.9 }} /> {activeNode.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', maxWidth: '800px', lineHeight: 1.5 }}>
              Agrupador de Rotas: Defina <b>Autenticação</b> e <b>Variáveis Locais</b> que serão herdadas por todas as requisições filhas desta pasta.
            </p>

            <div className="folder-tabs-container glass-panel" style={{ padding: '0', marginBottom: '20px', overflow: 'hidden' }}>
              <div className="tabs folder-settings-header" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
                <div
                  className={`tab ${activeFolderSettingTab === 'auth' ? 'active' : ''}`}
                  onClick={() => setActiveFolderSettingTab('auth')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '13px' }}
                >
                  <Edit2 size={14} className="text-success" /> Autenticação Herdável
                </div>
                <div
                  className={`tab ${activeFolderSettingTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setActiveFolderSettingTab('headers')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '13px' }}
                >
                  <Plus size={14} className="text-info" /> Headers Herdáveis
                </div>
                <div
                  className={`tab ${activeFolderSettingTab === 'vars' ? 'active' : ''}`}
                  onClick={() => setActiveFolderSettingTab('vars')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '13px' }}
                >
                  <Layers size={14} className="text-accent" /> Variáveis Locais (Pasta)
                </div>
              </div>

              <div className="tab-pane active" style={{ padding: '24px', minHeight: '180px' }}>
                {activeFolderSettingTab === 'auth' && (
                  <div className="fade-in">
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Esquema Central de Auth</label>
                      <select
                        value={activeNode.folderConfig?.auth.type || 'none'}
                        onChange={e => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), type: e.target.value as AuthType } })}
                        className="select-input"
                        style={{ width: '400px' }}
                      >
                        <option value="none">No Auth (Público)</option>
                        <option value="bearer">Bearer Token (JWT)</option>
                        <option value="oauth2">OAuth 2.0 (Flow)</option>
                        <option value="basic">Basic Auth</option>
                        <option value="apikey">API Key Headers</option>
                      </select>
                    </div>
                    <div style={{ maxWidth: '600px' }}>
                      {renderAuthFields(activeNode.folderConfig?.auth || defaultFolderAuth, (u) => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), ...u } }))}
                    </div>
                  </div>
                )}

                {activeFolderSettingTab === 'headers' && (
                  <div className="fade-in">
                    {renderVarTable(activeNode.folderConfig?.headers || [], (v) => handleActiveFolderConfigChange({ headers: v }), 'Headers Padrão da Pasta', true)}
                    <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Headers definidos aqui serão anexados a todas as requisições desta pasta.
                    </p>
                  </div>
                )}

                {activeFolderSettingTab === 'vars' && (
                  <div className="fade-in">
                    {renderVarTable(activeNode.folderConfig?.variables || [], (v) => handleActiveFolderConfigChange({ variables: v }), 'Variáveis Focadas da Pasta')}
                    <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Variáveis da pasta sobrescrevem o Ambiente Ativo e Globais.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SCRIPT PANEL (Always visible or toggle?) */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} className="text-accent" /> Script JS para Login/Setup da Pasta
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleActiveFolderConfigChange({
                      setupScript: '// Exemplo prático de Login Auth:\n\nconst res = await fetch("{{base_url}}/auth/login", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ email: "admin", pass: "123" })\n});\n\nconst data = await res.json();\n\n// Debug: Veja no console abaixo o que o servidor mandou\naurafetch.log(data);\n\n// Guarda no Ambiente ou Global\naurafetch.setEnv("token_acesso", data.token);\naurafetch.log("Token renovado com sucesso!");'
                    })}
                  >
                    <FileText size={14} /> Inserir Exemplo
                  </button>
                  <button className="btn btn-primary" onClick={() => runFolderScript(activeNode.id)} disabled={loading}>
                    <Play size={14} fill="currentColor" /> {loading ? 'Executando...' : 'Executar Script Manualmente'}
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px', lineHeight: 1.5 }}>
                Faça login e guarde o Token no Ambiente ou na Pasta! <br />
                Expostas: <code style={{ color: 'var(--accent-primary)' }}>fetch()</code>, <code style={{ color: 'var(--success)' }}>aurafetch.setEnv(k, v)</code>, <code style={{ color: 'var(--warning)' }}>aurafetch.setVar(k, v)</code>.
              </p>
              <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)', minHeight: '220px' }}>
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
            </div>

            {/* LOGS PANEL */}
            <div className="glass-panel" style={{ padding: '0', gridColumn: '1 / -1', overflow: 'hidden', borderTop: '1px solid var(--border-subtle)' }}>
              {renderConsole(activeLogs, () => setActiveLogs([]))}
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
                  <button className="btn btn-secondary" onClick={() => setIsCodeModalOpen(true)} title="Gerar Snippet de Código">
                    <Terminal size={16} />
                  </button>
                  {loading && !isLooping ? (
                    <button className="btn btn-danger btn-send" onClick={cancelReq} title="Cancelar Requisição">
                      <Square size={16} fill="currentColor" /> Cancelar
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-send" onClick={handleSend} disabled={isLooping}>
                      <Send size={16} /> Fazer Disparo
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
                      title={isLooping ? "Parar LOOP Automático" : "Derrubar a API (Loop Auto)"}
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
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Conecte a um WebSocket para começar a enviar mensagens.</div>
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
                          {m.type === 'sent' ? <span style={{ fontSize: '10px', opacity: 0.7, marginRight: '8px' }}>⇧ Enviado</span> : ''}
                          {m.type === 'received' ? <span style={{ fontSize: '10px', opacity: 0.5, marginRight: '8px', color: 'var(--success)' }}>⇩ Recebido</span> : ''}
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
                      <div className={`tab ${activeReqTab === 'params' ? 'active' : ''}`} onClick={() => setActiveReqTab('params')}>Params (URL)</div>
                      <div className={`tab ${activeReqTab === 'queries' ? 'active' : ''}`} onClick={() => setActiveReqTab('queries')}>Queries <span className="badge">{(activeReq!.queryParams || []).filter(q => q.key).length || ''}</span></div>
                      <div className={`tab ${activeReqTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveReqTab('auth')}>Autenticação</div>
                      <div className={`tab ${activeReqTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveReqTab('headers')}>Headers Custo. <span className="badge">{(activeReq!.headers || []).filter(h => h.key).length || ''}</span></div>
                      <div className={`tab ${activeReqTab === 'body' ? 'active' : ''}`} onClick={() => setActiveReqTab('body')}>Payload / Body</div>
                    </div>

                    <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                      {activeReqTab === 'params' && (
                        <div className="headers-container" style={{ marginTop: 0 }}>
                          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px' }}>Path Parameters</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>Reemplace <code>:id</code> o <code>{'{id}'}</code> en la URL.</p>
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
                            <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Sobrescrever Auth da Pasta</label>
                            <select
                              value={activeReq!.auth.type}
                              onChange={e => handleActiveReqChange({ auth: { ...activeReq!.auth, type: e.target.value as AuthType } })}
                              className="select-input"
                              style={{ width: '300px' }}
                            >
                              <option value="inherit">Inherit Auth (Herdar do Pai)</option>
                              <option value="none">No Auth (Deixar Vazio)</option>
                              <option value="bearer">Bearer Token Mestre</option>
                              <option value="oauth2">OAuth 2.0 (Token)</option>
                              <option value="basic">Basic Auth User</option>
                              <option value="apikey">API Key Custo.</option>
                            </select>

                            {activeReq!.auth.type === 'inherit' && (
                              <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '4px' }}>
                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', margin: 0 }}>
                                  Esta requisição herda a autenticação da pasta pai. Certifique-se que a pasta pai tem um Bearer Token configurado (pode ser {'{{var}}'}).
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
                            <div>Chave / Header Key</div>
                            <div>Valor da Chave</div>
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
                            style={{ marginTop: '16px' }}
                            onClick={() => {
                              handleActiveReqChange({ headers: [...activeReq!.headers, { id: uuidv4(), key: '', value: '', enabled: true }] });
                            }}
                          >
                            <Plus size={16} /> Nova Linha de Header
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
                                    ) : (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => pickFormDataFile(f.id)}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                        </button>
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
                              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '40px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Download size={32} className="text-accent" style={{ opacity: 0.6 }} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Corpo Binário (Binary Body)</h3>
                                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '300px' }}>Selecione um arquivo para ser enviado como o corpo bruto (raw byte array) desta requisição.</p>
                                </div>
                                <button className="btn btn-primary" onClick={pickBinaryFile}>
                                  <Upload size={16} /> {activeReq!.binaryFile ? 'Alterar Arquivo' : 'Selecionar Arquivo'}
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
                              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
                                <AlertTriangle size={32} style={{ opacity: 0.2 }} />
                                <span>Esta requisição não enviará corpo (body).</span>
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
                        Resposta Renderizada {activeResponse && <span className={`status-dot ${activeResponse.status >= 200 && activeResponse.status < 300 ? 'dot-success' : activeResponse.status === 0 ? 'dot-warn' : 'dot-error'}`}></span>}
                      </div>
                      <div className={`tab ${activeResTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveResTab('headers')}>
                        Response Headers <span className="badge">{activeResponse?.headers ? Object.keys(activeResponse.headers).length : ''}</span>
                      </div>
                    </>
                  )}
                  <div className={`tab ${activeResTab === 'console' || activeReq?.method === 'WS' ? 'active' : ''}`} onClick={() => setActiveResTab('console')}>
                    <Terminal size={14} /> Console / Timestamps <span className="badge">{activeLogs.length}</span>
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
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Ping: <span style={{ color: 'var(--info)' }}>{activeResponse.time} ms</span></span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => { setActiveResponse(null); setActiveLogs([]); }} style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                  <Trash2 size={14} /> Limpar
                                </button>
                                <button className="btn btn-secondary" onClick={copyResponse} style={{ padding: '6px 12px', fontSize: '12px' }}>
                                  {copiedRes ? <Check size={14} className="text-success" /> : <Copy size={14} />} {copiedRes ? 'Copiado!' : 'Clipboard'}
                                </button>
                                <button className="btn btn-secondary" onClick={downloadResponse} style={{ padding: '6px 12px', fontSize: '12px' }} title="Salvar resposta no Disco">
                                  <Download size={14} /> Download
                                </button>
                              </div>
                            </div>
                            <div style={{ flex: 1, marginTop: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: '#212121', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                              {activeResponse.type === 'image' ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '20px' }}>
                                  <img src={activeResponse.data} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} alt="Response" />
                                </div>
                              ) : activeResponse.type === 'pdf' ? (
                                <iframe src={activeResponse.data} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                              ) : activeResponse.type === 'html' ? (
                                <iframe srcDoc={activeResponse.data} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} title="HTML Preview" />
                              ) : activeResponse.type === 'binary' ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '15px' }}>
                                  <Database size={48} style={{ opacity: 0.3 }} />
                                  <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Arquivo Binário Detectado</p>
                                    <p style={{ fontSize: '12px' }}>Este conteúdo não pode ser renderizado como texto (Ex: ZIP, EXE, Fonte).</p>
                                  </div>
                                  <button className="btn btn-primary" onClick={downloadResponse}>
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
                          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)', flexDirection: 'column', gap: '20px' }}>
                            <Send size={64} style={{ opacity: 0.3 }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: '16px', letterSpacing: '0.5px' }}>Tiro de sniper aguardando... Aperte "Disparo".</span>
                          </div>
                        )}
                      </div>
                    )}

                    {activeResTab === 'headers' && (
                      <div className="response-panel body-content" style={{ padding: '24px' }}>
                        {activeResponse?.headers ? (
                          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="headers-grid header-row-title" style={{ gridTemplateColumns: 'minmax(200px, 1fr) 2fr', background: 'rgba(0,0,0,0.2)', padding: '12px 20px' }}>
                              <div>Header Key / Chave</div>
                              <div>Value / Valor</div>
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
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                            Aguardando disparo da requisição para capturar headers...
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
          <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}>Processando requisição...</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>Isso pode levar alguns segundos, ou o timeout será atingido.</div>
          <button className="btn btn-danger" style={{ padding: '8px 24px', fontSize: '14px' }} onClick={cancelReq}>Cancelar Requisição</button>
        </div>
      )}

    </div >
  );
}
