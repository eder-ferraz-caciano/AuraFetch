import { useState, useRef, useEffect } from 'react';
import {
  Folder, FileText, Plus, Download, Upload,
  Play, Square, Trash2, Send, Clock, Edit2, FilePlus, Terminal, AlertTriangle,
  ChevronRight, ChevronDown, Copy, Check, MousePointer2, CopyPlus, Globe, Layers
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import './index.css';

// Types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'inherit';

interface RequestHeader {
  id: string;
  key: string;
  value: string;
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
}

interface RequestModel {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  auth: AuthConfig;
  headers: RequestHeader[];
  body: string;
}

interface CollectionNode {
  id: string;
  name: string;
  type: 'folder' | 'request';
  children?: CollectionNode[];
  request?: RequestModel;
  folderConfig?: {
    auth: AuthConfig;
    variables?: EnvVar[];
    setupScript?: string;
  };
  expanded?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'log' | 'error' | 'warn' | 'info' | 'success';
  message: string;
  data?: any;
}

// Initial Data
const defaultRequest: RequestModel = {
  id: uuidv4(),
  name: 'Nova Requisição',
  method: 'GET',
  url: '{{base_url}}/todos/1',
  auth: { type: 'inherit' },
  headers: [],
  body: ''
};

const defaultFolderAuth: AuthConfig = {
  type: 'none'
};

const initialCollection: CollectionNode[] = [
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
        request: { ...defaultRequest, id: '1a', name: 'Listar Dados (Rota GET)' }
      }
    ]
  }
];

export default function App() {
  const [collection, setCollection] = useState<CollectionNode[]>(() => {
    const saved = localStorage.getItem('getman_collection');
    return saved ? JSON.parse(saved) : initialCollection;
  });
  const [globalVariables, setGlobalVariables] = useState<EnvVar[]>(() => {
    const saved = localStorage.getItem('getman_globals');
    return saved ? JSON.parse(saved) : [];
  });

  // Environments Logic
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const saved = localStorage.getItem('getman_envs');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'env_dev', name: 'Ambiente DEV', variables: [
          { id: uuidv4(), key: 'base_url', value: 'http://localhost:3000/api' },
          { id: uuidv4(), key: 'token_acesso', value: 'token-secreto-meu-pc' }
        ]
      },
      {
        id: 'env_prod', name: 'Ambiente PROD', variables: [
          { id: uuidv4(), key: 'base_url', value: 'https://api.projeto.com/v1' },
          { id: uuidv4(), key: 'token_acesso', value: 'token-producao-master-777' }
        ]
      }
    ];
  });
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>('env_dev');

  // Default to null to show welcome screen initially
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Tabs
  const [activeReqTab, setActiveReqTab] = useState<'auth' | 'headers' | 'body'>('auth');
  const [activeResTab, setActiveResTab] = useState<'response' | 'console'>('response');

  const [response, setResponse] = useState<{ status: number; statusText: string; data: any; time: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  // Console Logs
  const [logs, setLogs] = useState<LogEntry[]>([{
    id: uuidv4(),
    timestamp: new Date(),
    type: 'info',
    message: 'GET MAN | Motor de Ambientes & Variáveis Ativado!'
  }]);

  // Modals & States
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<{ id: string, name: string } | null>(null);

  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);

  // Interval
  const [intervalMs, setIntervalMs] = useState(5000);
  const [isLooping, setIsLooping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper to add logs to console
  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    setLogs(prev => [...prev, { id: uuidv4(), timestamp: new Date(), type, message, data }]);
  };

  const exportLogs = () => {
    let content = "=== GET MAN: SYSTEM LOGS ===\n\n";
    logs.forEach(l => {
      content += `[${l.timestamp.toLocaleTimeString()}] [${l.type.toUpperCase()}] ${l.message}\n`;
      if (l.data) {
        content += `${JSON.stringify(l.data, null, 2)}\n`;
      }
      content += `----------------------------------------\n`;
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `getman_logs_${new Date().getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Persist State
  useEffect(() => {
    localStorage.setItem('getman_collection', JSON.stringify(collection));
  }, [collection]);

  useEffect(() => {
    localStorage.setItem('getman_globals', JSON.stringify(globalVariables));
  }, [globalVariables]);

  useEffect(() => {
    localStorage.setItem('getman_envs', JSON.stringify(environments));
  }, [environments]);

  useEffect(() => {
    if (isLooping) {
      addLog('info', `🔁 Automação Iniciada. Executando a cada ${intervalMs}ms.`);
      intervalRef.current = setInterval(() => {
        handleSend();
      }, intervalMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        addLog('warn', '🛑 Automação Interrompida.');
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLooping, intervalMs, activeNodeId, collection, activeEnvironmentId, environments, globalVariables]);

  const handleSendRef = useRef<() => void>(undefined);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (handleSendRef.current) handleSendRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const updateNodeInCollection = (updatedNode: CollectionNode) => {
    const update = (nodes: CollectionNode[]): CollectionNode[] => {
      return nodes.map(node => {
        if (node.id === updatedNode.id) {
          return updatedNode;
        }
        if (node.children) return { ...node, children: update(node.children) };
        return node;
      });
    };
    setCollection(update(collection));
  };

  const handleActiveReqChange = (updates: Partial<RequestModel>) => {
    if (!activeNode || activeNode.type !== 'request' || !activeNode.request) return;
    updateNodeInCollection({
      ...activeNode,
      request: { ...activeNode.request, ...updates }
    });
  };

  const handleActiveFolderConfigChange = (updates: Partial<CollectionNode['folderConfig']>) => {
    if (!activeNode || activeNode.type !== 'folder') return;
    updateNodeInCollection({
      ...activeNode,
      folderConfig: { ...(activeNode.folderConfig || { auth: defaultFolderAuth, variables: [] }), ...updates }
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

  const addFolder = () => {
    const newFolder: CollectionNode = {
      id: uuidv4(),
      name: 'Novo Servidor/Pasta',
      type: 'folder',
      expanded: true,
      children: [],
      folderConfig: { auth: { ...defaultFolderAuth }, variables: [] }
    };
    setCollection([...collection, newFolder]);
    addLog('info', '📁 Nova pasta raiz criada');
  };

  const addRequestToRoot = () => {
    const req = { ...defaultRequest, id: uuidv4(), name: 'Nova Rota Solta' };
    const newNode: CollectionNode = { id: req.id, name: req.name, type: 'request', request: req };
    setCollection([...collection, newNode]);
    setActiveNodeId(req.id);
    addLog('success', '📄 Nova rota criada');
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
    setActiveNodeId(req.id);
    addLog('success', '📄 Nova rota adicionada ao agrupador.');
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

    let newColl = updateNode(collection);
    if (!attached) {
      const idx = newColl.findIndex(n => n.id === nodeId);
      newColl.splice(idx + 1, 0, newNode);
    }

    setCollection(newColl);
    setActiveNodeId(id);
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
      setActiveNodeId(null);
      setResponse(null);
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
    if (!text) return text;

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

    const path = getPath(collection, targetNodeId, []);
    const activeEnv = environments.find(e => e.id === activeEnvironmentId);

    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();

      // 1. Check Folder Hierarchy (Bottom-Up)
      if (path) {
        for (let i = path.length - 1; i >= 0; i--) {
          const node = path[i];
          if (node.type === 'folder' && node.folderConfig?.variables) {
            const v = node.folderConfig.variables.find(v => v.key === trimmedKey);
            if (v) return v.value;
          }
        }
      }

      // 2. Check Active Environment (DEV / PROD)
      if (activeEnv) {
        const envVar = activeEnv.variables.find(v => v.key === trimmedKey);
        if (envVar) return envVar.value;
      }

      // 3. Check Global Variables
      const gv = globalVariables.find(v => v.key === trimmedKey);
      if (gv) return gv.value;

      // Unresolved
      return match;
    });
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

  const handleSend = async () => {
    if (!activeReq) return;
    setLoading(true);
    setCopiedRes(false);
    const startTime = Date.now();

    // Apply Vars to URL
    const targetUrl = applyVariables(activeReq.url, activeReq.id);

    addLog('log', `🚀 Disparando: ${activeReq.method} ${targetUrl}`);

    try {
      const fetchHeaders: HeadersInit = {};

      activeReq.headers.forEach(h => {
        if (h.key.trim() && h.value.trim()) {
          fetchHeaders[applyVariables(h.key.trim(), activeReq.id)] = applyVariables(h.value.trim(), activeReq.id);
        }
      });

      const resolvedAuth = resolveAuth(activeReq.id, collection);
      let finalTargetUrl = targetUrl;

      if (resolvedAuth) {
        if (resolvedAuth.type === 'bearer' && resolvedAuth.token) {
          fetchHeaders['Authorization'] = `Bearer ${applyVariables(resolvedAuth.token, activeReq.id)}`;
          addLog('log', `🔑 Auth Injetado: Bearer Token.`);
        }
        else if (resolvedAuth.type === 'basic' && resolvedAuth.username) {
          const userStr = applyVariables(resolvedAuth.username, activeReq.id);
          const passStr = applyVariables(resolvedAuth.password || '', activeReq.id);
          const b64 = btoa(`${userStr}:${passStr}`);
          fetchHeaders['Authorization'] = `Basic ${b64}`;
          addLog('log', `🔑 Auth Injetado: Basic Base64.`);
        }
        else if (resolvedAuth.type === 'apikey' && resolvedAuth.apiKeyKey && resolvedAuth.apiKeyValue) {
          const keyStr = applyVariables(resolvedAuth.apiKeyKey, activeReq.id);
          const valStr = applyVariables(resolvedAuth.apiKeyValue, activeReq.id);
          if (resolvedAuth.apiKeyIn === 'header') {
            fetchHeaders[keyStr] = valStr;
            addLog('log', `🔑 Auth Injetado: API Key (Header).`);
          } else {
            const urlObj = new URL(finalTargetUrl);
            urlObj.searchParams.append(keyStr, valStr);
            finalTargetUrl = urlObj.toString();
            addLog('log', `🔑 Auth Injetado: API Key (URL Query).`);
          }
        }
      }

      const opts: RequestInit = {
        method: activeReq.method,
        headers: fetchHeaders,
      };

      if (['POST', 'PUT', 'PATCH'].includes(activeReq.method) && activeReq.body) {
        opts.body = applyVariables(activeReq.body, activeReq.id);
        const hasContentType = Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type');
        if (!hasContentType) {
          fetchHeaders['Content-Type'] = 'application/json';
        }
      }

      if (!finalTargetUrl.startsWith('http')) {
        throw new Error('A URL resolvida aparentemente é inválida: ' + finalTargetUrl);
      }

      const urlObj = new URL(finalTargetUrl);
      addLog('info', `📡 Executando Rota: ${urlObj.origin}${urlObj.pathname}`);

      const queryParams: any = {};
      urlObj.searchParams.forEach((val, key) => queryParams[key] = val);
      if (Object.keys(queryParams).length > 0) {
        addLog('info', `🔗 Query Params:`, queryParams);
      }

      if (Object.keys(fetchHeaders).length > 0) {
        addLog('info', `🪪 Headers Injetados:`, fetchHeaders);
      }

      if (opts.body) {
        let parsedBody = opts.body;
        try { parsedBody = JSON.parse(opts.body as string); } catch { }
        addLog('info', `📦 Payload / Body:`, parsedBody);
      }

      const res = await fetch(finalTargetUrl, opts);
      const text = await res.text();
      let data = text;

      try {
        data = JSON.parse(text);
      } catch { }

      const timeMs = Date.now() - startTime;

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        time: timeMs
      });

      const statusLog = res.status >= 200 && res.status < 300 ? 'success' : 'warn';
      addLog(statusLog, `✅ Status Recebido: ${res.status} ${res.statusText} (${timeMs}ms)`);
      setActiveResTab('response');

    } catch (err: any) {
      const timeMs = Date.now() - startTime;
      setResponse({
        status: 0,
        statusText: 'Network Error (CORS/Failed)',
        data: err.message || err.toString(),
        time: timeMs
      });
      addLog('error', `❌ Falha no disparo. Erro: ${err.message || err.toString()}`);
      setActiveResTab('console');
    } finally {
      setLoading(false);
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

      const getmanCtx = {
        setEnv: (key: string, value: string) => {
          if (activeEnvironmentId) {
            setEnvironments(envs => envs.map(env => {
              if (env.id === activeEnvironmentId) {
                const exists = env.variables.find(v => v.key === key);
                if (exists) return { ...env, variables: env.variables.map(v => v.key === key ? { ...v, value } : v) };
                return { ...env, variables: [...env.variables, { id: uuidv4(), key, value }] };
              }
              return env;
            }));
            addLog('success', `🧩 [getman] Variável de Ambiente '${key}' salva!`);
          } else {
            setGlobalVariables(globals => {
              const exists = globals.find(v => v.key === key);
              if (exists) return globals.map(v => v.key === key ? { ...v, value } : v);
              return [...globals, { id: uuidv4(), key, value }];
            });
            addLog('success', `🧩 [getman] Variável Global '${key}' salva!`);
          }
        },
        log: (msg: any) => addLog('log', `📝 [getman] ${typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg}`)
      };

      const customFetch = async (url: string, options?: RequestInit) => {
        const finalUrl = applyVariables(url, node.id);
        let finalOpts = { ...options };
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
        return window.fetch(finalUrl, finalOpts);
      };

      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
      const fn = new AsyncFunction('getman', 'fetch', scriptBody);

      await fn(getmanCtx, customFetch);

      addLog('success', `✅ Script finalizado! Variáveis injetadas com sucesso.`);
    } catch (err: any) {
      addLog('error', `❌ Falha no Script: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCollection = () => {
    // Export collection, environments, globals
    const db = { collection, globals: globalVariables, environments };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const fnNode = document.createElement('a');
    fnNode.setAttribute("href", dataStr);
    fnNode.setAttribute("download", "getman_workspace.json");
    document.body.appendChild(fnNode);
    fnNode.click();
    fnNode.remove();
    addLog('success', '💾 Workspace exportado com sucesso (.json)');
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
          if (obj.environments) setEnvironments(obj.environments);
        } else {
          setCollection(obj);
        }

        setActiveNodeId(null);
        setResponse(null);
        addLog('success', `📦 Importação de "${file.name}" feita 100%.`);
      } catch (err) {
        addLog('error', `❌ O arquivo JSON é inválido.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyResponse = () => {
    if (!response) return;
    const stringData = typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data);
    navigator.clipboard.writeText(stringData);
    setCopiedRes(true);
    setTimeout(() => setCopiedRes(false), 2000);
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
              placeholder="eyJhbGciOiJ..."
              value={auth.token || ''}
              onChange={e => onChange({ token: e.target.value })}
              className="text-input"
            />
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
                type="password"
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
      </div>
    );
  };

  const renderVarTable = (vars: EnvVar[], onChange: (v: EnvVar[]) => void, title: string) => {
    return (
      <div className="headers-container" style={{ marginTop: '0' }}>
        {title && <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{title}</h3>}
        <div className="headers-grid header-row-title">
          <div>Nome na Variável {'{{nome}}'}</div>
          <div>Valor Exato</div>
          <div></div>
        </div>
        {vars.map((v, i) => (
          <div key={v.id} className="headers-grid">
            <input
              className="text-input"
              placeholder="Ex: url_dev"
              value={v.key}
              onChange={e => {
                const copy = [...vars];
                copy[i].key = e.target.value.replace(/[{}]/g, '');
                onChange(copy);
              }}
            />
            <input
              className="text-input"
              placeholder="Ex: https://api.com"
              value={v.value}
              onChange={e => {
                const copy = [...vars];
                copy[i].value = e.target.value;
                onChange(copy);
              }}
            />
            <button
              className="btn-icon danger" style={{ border: '1px solid var(--border-subtle)' }}
              onClick={() => onChange(vars.filter(x => x.id !== v.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-secondary"
          style={{ marginTop: '16px' }}
          onClick={() => onChange([...vars, { id: uuidv4(), key: '', value: '' }])}
        >
          <Plus size={16} /> Nova Variável
        </button>
      </div>
    )
  };

  const removeEnv = (eId: string) => {
    setEnvironments(envs => envs.filter(e => e.id !== eId));
    if (activeEnvironmentId === eId) setActiveEnvironmentId(null);
    if (editingEnvId === eId) setEditingEnvId(null);
  };

  const addEnv = () => {
    const freshId = uuidv4();
    setEnvironments([...environments, { id: freshId, name: 'Novo Ambiente', variables: [] }]);
    setEditingEnvId(freshId);
  };

  const renderTree = (nodes: CollectionNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`tree-item ${activeNodeId === node.id ? 'active-node' : ''}`}
          onClick={() => {
            setActiveNodeId(node.id);
            if (node.type !== 'request') setResponse(null);
          }}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            {node.type === 'folder' && (
              <span
                onClick={(e) => { e.stopPropagation(); toggleFolder(node.id); }}
                style={{ cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}

            {node.type === 'folder' ? (
              <Folder size={14} className="text-accent" style={{ opacity: 0.8 }} />
            ) : (
              <span className={`method-${node.request!.method}`} style={{ fontSize: '11px', fontWeight: 800, minWidth: '40px', marginLeft: depth > 0 ? '6px' : '0' }}>
                {node.request!.method}
              </span>
            )}

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
              <span className={`node-name ${node.type === 'folder' ? 'folder-label' : ''}`}>{node.name}</span>
            )}
          </div>

          <div className="node-actions">
            {node.type === 'folder' && (
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); addRequestToFolder(node.id); }} title="Nova Req na Pasta"><FilePlus size={14} /></button>
            )}
            {node.type === 'request' && (
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); cloneRequest(node.id); }} title="Clonar/"><CopyPlus size={14} /></button>
            )}
            <button className="icon-btn" onClick={(e) => startRename(node.id, node.name, e)} title="Renomear"><Edit2 size={13} /></button>
            <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); setNodeToDelete({ id: node.id, name: node.name }); }} title="Deletar"><Trash2 size={14} /></button>
          </div>

        </div>
        {node.type === 'folder' && node.expanded && node.children && (
          <div className="tree-children-container">
            {renderTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="layout">
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

                {environments.map(env => (
                  <div
                    key={env.id}
                    className={`tree-item ${editingEnvId === env.id ? 'active-node' : ''}`}
                    onClick={() => setEditingEnvId(env.id)}
                    style={{ margin: '0 8px', borderRadius: '4px' }}
                  >
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeEnvironmentId === env.id ? 'var(--success)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{env.name}</span>
                    </div>
                  </div>
                ))}
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
                    {environments.map(env => {
                      if (env.id !== editingEnvId) return null;
                      return (
                        <div key={env.id}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
                            <input
                              className="text-input"
                              value={env.name}
                              onChange={e => {
                                setEnvironments(envs => envs.map(ev => ev.id === env.id ? { ...ev, name: e.target.value } : ev));
                              }}
                              style={{ fontSize: '18px', fontWeight: 600, background: 'rgba(0,0,0,0.5)', border: 'none', borderBottom: '2px solid var(--accent-primary)', borderRadius: '0' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn-icon danger" onClick={() => removeEnv(env.id)} title="Excluir este ambiente"><Trash2 size={16} /></button>
                            </div>
                          </div>

                          <div style={{ marginBottom: '24px' }}>
                            {renderVarTable(env.variables, (newVars) => {
                              setEnvironments(envs => envs.map(ev => ev.id === env.id ? { ...ev, variables: newVars } : ev));
                            }, 'Chaves Locais Deste Ambiente')}
                          </div>
                        </div>
                      )
                    })}
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
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="app-title">
            <span className="highlight">GET</span> MAN
          </h2>
          <div className="sidebar-actions">
            <button className="btn-icon" onClick={addFolder} title="Nova Pasta da Raiz"><Folder size={16} /></button>
            <button className="btn-icon" onClick={addRequestToRoot} title="Nova Req na Raiz"><Plus size={16} /></button>
            <button className="btn-icon" onClick={exportCollection} title="Exportar Local"><Download size={16} /></button>
            <label className="btn-icon" style={{ cursor: 'pointer', margin: 0 }} title="Importar">
              <Upload size={16} />
              <input type="file" accept=".json" onChange={importCollection} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div style={{ padding: '16px 16px 0 16px', position: 'relative' }}>
          <div className="env-select-container">
            <div
              className="env-select"
              onClick={() => setIsEnvDropdownOpen(!isEnvDropdownOpen)}
              style={{ flex: 1, color: activeEnvironmentId ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              {activeEnvironmentId ? environments.find(e => e.id === activeEnvironmentId)?.name : 'Sem Ambiente Selecionado'}
            </div>

            <button className="btn-icon" onClick={() => { setEditingEnvId(activeEnvironmentId || 'GLOBAL'); setIsEnvModalOpen(true); }} title="Gerenciar Ambientes" style={{ padding: '6px', marginRight: '4px' }}>
              <Layers size={14} className="text-accent" />
            </button>
          </div>

          {isEnvDropdownOpen && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} onClick={() => setIsEnvDropdownOpen(false)} />
              <div className="glass-panel fade-in" style={{ position: 'absolute', top: '100%', left: '16px', right: '16px', marginTop: '8px', zIndex: 100, padding: '8px 0', border: '1px solid var(--border-strong)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                <div
                  className="dropdown-item"
                  style={{ padding: '10px 16px', cursor: 'pointer', color: !activeEnvironmentId ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                  onClick={() => { setActiveEnvironmentId(null); setIsEnvDropdownOpen(false); }}
                >
                  Sem Ambiente Selecionado
                </div>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                <div style={{ padding: '4px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px' }}>Ambientes</div>
                {environments.map(e => (
                  <div
                    key={e.id}
                    className="dropdown-item"
                    style={{ padding: '10px 16px', cursor: 'pointer', color: activeEnvironmentId === e.id ? 'var(--accent-primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => { setActiveEnvironmentId(e.id); setIsEnvDropdownOpen(false); }}
                  >
                    🌍 {e.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
          {renderTree(collection)}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!activeNode ? (
          /* WELCOME SCREEN */
          <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <MousePointer2 size={64} style={{ opacity: 0.1, marginBottom: '24px' }} />
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>Workspace Vazio</h2>
            <p style={{ maxWidth: '400px', textAlign: 'center', lineHeight: 1.6, marginBottom: '32px' }}>
              Selecione ou crie uma requisição HTTP no menu lateral ou conecte um Ambiente do seu Servidor para começar.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="btn btn-primary" onClick={addRequestToRoot}><Plus size={16} /> Nova Requisição Rápida</button>
              <button className="btn btn-secondary" onClick={() => { setEditingEnvId('GLOBAL'); setIsEnvModalOpen(true); }}><Layers size={16} /> Gerenciar Ambientes</button>
            </div>
          </div>
        ) : activeNode.type === 'folder' ? (
          /* FOLDER CONFIGURATION */
          <div className="fade-in" style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', letterSpacing: '-0.5px', fontSize: '32px' }}>
              <Folder size={32} className="text-accent" style={{ opacity: 0.9 }} /> {activeNode.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '15px', maxWidth: '800px', lineHeight: 1.6 }}>
              O Agrupador mestre de Rotas! Aplique regras de Autenticação (JWT, Basic) e defina <b>Variáveis Estáticas da Pasta</b> que substituirão as variáveis dos Ambientes caso o nome seja o mesmo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(400px, 1fr)', gap: '24px', maxWidth: '1200px', alignItems: 'start' }}>
              {/* AUTH PANEL */}
              <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit2 size={16} className="text-success" /> Autenticação Herdável
                </h3>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Esquema Central de Auth</label>
                  <select
                    value={activeNode.folderConfig?.auth.type || 'none'}
                    onChange={e => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), type: e.target.value as AuthType } })}
                    className="select-input"
                    style={{ width: '100%' }}
                  >
                    <option value="none">No Auth (Público)</option>
                    <option value="bearer">Bearer Token (JWT)</option>
                    <option value="basic">Basic Auth</option>
                    <option value="apikey">API Key Headers</option>
                  </select>
                </div>

                {renderAuthFields(activeNode.folderConfig?.auth || defaultFolderAuth, (u) => handleActiveFolderConfigChange({ auth: { ...(activeNode.folderConfig?.auth || defaultFolderAuth), ...u } }))}
              </div>

              {/* ENV VARS PANEL */}
              <div className="glass-panel" style={{ padding: '32px' }}>
                {renderVarTable(activeNode.folderConfig?.variables || [], (v) => handleActiveFolderConfigChange({ variables: v }), 'Variáveis Focadas da Pasta')}
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Essas variáveis vencem conflitos de nome com as Variáveis de Ambiente e Globais.
                </p>
              </div>

              {/* SCRIPT PANEL */}
              <div className="glass-panel" style={{ padding: '32px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={16} className="text-accent" /> Script JS para Login/Setup da Pasta
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleActiveFolderConfigChange({
                        setupScript: '// Exemplo prático de Login Auth:\n\nconst res = await fetch("{{base_url}}/auth/login", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ email: "admin", pass: "123" })\n});\n\nconst data = await res.json();\n\n// Guarda no Ambiente ou Global\ngetman.setEnv("token_acesso", data.token);\ngetman.log("Token renovado com sucesso!");'
                      })}
                    >
                      <FileText size={14} /> Inserir Exemplo
                    </button>
                    <button className="btn btn-primary" onClick={() => runFolderScript(activeNode.id)} disabled={loading}>
                      <Play size={14} fill="currentColor" /> {loading ? 'Executando...' : 'Executar Script Manualmente'}
                    </button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
                  Faça uma requisição de login aqui e guarde o Token direto no Ambiente! <br />
                  Expostas: <code style={{ color: 'var(--accent-primary)' }}>fetch()</code> (com {'{{var}}'} parsing), <code style={{ color: 'var(--success)' }}>getman.setEnv(key, val)</code>, <code style={{ color: 'var(--info)' }}>getman.log(msg)</code>.
                </p>
                <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <CodeMirror
                    value={activeNode.folderConfig?.setupScript || ''}
                    height="220px"
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

            </div>

          </div>
        ) : (
          /* REQUEST CONFIGURATION */
          <>
            {/* Header URL Bar */}
            <div className="workspace-header">
              <div className="url-bar-container">
                <select
                  value={activeReq!.method}
                  onChange={e => handleActiveReqChange({ method: e.target.value as HttpMethod })}
                  className={`method-select method-${activeReq!.method}`}
                >
                  <option value="GET" className="method-GET">GET</option>
                  <option value="POST" className="method-POST">POST</option>
                  <option value="PUT" className="method-PUT">PUT</option>
                  <option value="PATCH" className="method-PATCH">PATCH</option>
                  <option value="DELETE" className="method-DELETE">DELETE</option>
                </select>
                <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)' }} />
                <input
                  type="text"
                  value={activeReq!.url}
                  onChange={e => handleActiveReqChange({ url: e.target.value })}
                  placeholder="{{base_url}}/v1/users"
                  style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', letterSpacing: '0.3px', flex: 1, background: 'transparent' }}
                />
              </div>
              <button className="btn btn-primary btn-send" onClick={handleSend} disabled={loading || isLooping}>
                <Send size={16} /> {loading ? 'Enviando...' : 'Fazer Disparo'}
              </button>

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
            </div>

            {/* Request Settings Tab Content */}
            <div className="request-panel">
              <div className="tabs">
                <div className={`tab ${activeReqTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveReqTab('auth')}>Autenticação</div>
                <div className={`tab ${activeReqTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveReqTab('headers')}>Headers Custo. <span className="badge">{activeReq!.headers.filter(h => h.key).length || ''}</span></div>
                <div className={`tab ${activeReqTab === 'body' ? 'active' : ''}`} onClick={() => setActiveReqTab('body')}>Payload / Body</div>
              </div>

              <div style={{ padding: '24px 0', flex: 1, overflowY: 'auto' }}>
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
                        <option value="basic">Basic Auth User</option>
                        <option value="apikey">API Key Custo.</option>
                      </select>

                      {activeReq!.auth.type === 'inherit' && (
                        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '4px' }}>
                          <p style={{ color: 'var(--text-primary)', fontSize: '13px', margin: 0 }}>
                            Esta aba está bloqueada e vazia porque a requisição busca automaticamente o que a pasta pai usa configurada. (Suporta {'{{variaveis}}'})
                          </p>
                        </div>
                      )}
                    </div>

                    {renderAuthFields(activeReq!.auth, (updates) => handleActiveReqChange({ auth: { ...activeReq!.auth, ...updates } }))}
                  </div>
                )}

                {activeReqTab === 'headers' && (
                  <div className="headers-container">
                    <div className="headers-grid header-row-title">
                      <div>Chave / Header Key</div>
                      <div>Valor da Chave</div>
                      <div></div>
                    </div>
                    {activeReq!.headers.map((h, i) => (
                      <div key={h.id} className="headers-grid">
                        <input
                          className="text-input"
                          placeholder="Ex: Content-Type"
                          value={h.key}
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
                        handleActiveReqChange({ headers: [...activeReq!.headers, { id: uuidv4(), key: '', value: '' }] });
                      }}
                    >
                      <Plus size={16} /> Nova Linha de Header
                    </button>
                  </div>
                )}

                {activeReqTab === 'body' && (
                  <div style={{ height: '100%', margin: '0 8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#282c34' }}>
                    <CodeMirror
                      value={activeReq!.body}
                      style={{ height: '100%' }}
                      minHeight="200px"
                      theme={oneDark}
                      extensions={[json()]}
                      onChange={(val) => handleActiveReqChange({ body: val })}
                      basicSetup={{
                        lineNumbers: true,
                        tabSize: 2,
                        autocompletion: true,
                        foldGutter: true
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Panel Wrapper */}
            <div className="bottom-panel-wrapper">

              <div className="tabs bottom-tabs">
                <div className={`tab ${activeResTab === 'response' ? 'active' : ''}`} onClick={() => setActiveResTab('response')}>
                  Resposta Renderizada {response && <span className={`status-dot ${response.status >= 200 && response.status < 300 ? 'dot-success' : response.status === 0 ? 'dot-warn' : 'dot-error'}`}></span>}
                </div>
                <div className={`tab ${activeResTab === 'console' ? 'active' : ''}`} onClick={() => setActiveResTab('console')}>
                  <Terminal size={14} /> Console / Timestamps <span className="badge">{logs.length}</span>
                </div>
              </div>

              {/* Response Panel Content */}
              {activeResTab === 'response' && (
                <div className="response-panel body-content">
                  {response ? (
                    <>
                      <div className="response-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <span className={`status-badge ${response.status >= 200 && response.status < 300 ? 'status-success' : response.status === 0 ? 'status-warning' : 'status-error'}`}>
                            {response.status === 0 ? 'ERR/000' : `${response.status} ${response.statusText}`}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Ping: <span style={{ color: 'var(--info)' }}>{response.time} ms</span></span>
                        </div>

                        <button className="btn btn-secondary" onClick={copyResponse} style={{ padding: '6px 12px', fontSize: '12px' }}>
                          {copiedRes ? <Check size={14} className="text-success" /> : <Copy size={14} />} {copiedRes ? 'Copiado!' : 'Clipboard'}
                        </button>
                      </div>
                      <pre className="json-viewer fade-in">
                        {typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
                      </pre>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)', flexDirection: 'column', gap: '20px' }}>
                      <Send size={64} style={{ opacity: 0.3 }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '16px', letterSpacing: '0.5px' }}>Tiro de sniper aguardando... Aperte "Disparo".</span>
                    </div>
                  )}
                </div>
              )}

              {/* Console Panel Content */}
              {activeResTab === 'console' && (
                <div className="console-panel body-content">
                  <div className="console-header">
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Logs do App e Rastros</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon" onClick={exportLogs} title="Exportar Logs para TXT" style={{ background: 'rgba(255,255,255,0.05)' }}><Download size={14} /> Exportar</button>
                      <button className="btn-icon" onClick={() => setLogs([])} title="Limpar Console / Sweep"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="console-logs">
                    {logs.map((log) => (
                      <div key={log.id} className={`log-line log-${log.type}`}>
                        <span className="log-time" style={{ width: '70px', display: 'inline-block' }}>[{log.timestamp.toLocaleTimeString()}]</span>
                        <span className="log-msg" style={{ flex: 1 }}>{log.message}</span>
                        {log.data && (
                          <pre style={{ marginTop: '4px', fontSize: '12px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                            {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                    {logs.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
                        Nenhum rastro capturado pelo sistema.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </>
        )
        }
      </main >
    </div >
  );
}
