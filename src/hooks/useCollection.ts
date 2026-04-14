import { useCallback } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { save as tauriSave } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useRequestContext } from '../context/RequestContext';
import type { CollectionNode, HistoryEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Helper function to get a node from the collection
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

// Web download helper
const downloadBlobWeb = (content: string, filename: string, contentType: string = 'application/json') => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const defaultFolderAuth = { type: 'none' as const };
const defaultRequest = {
  id: uuidv4(),
  name: 'Nova Requisição',
  method: 'GET' as const,
  url: '{{base_url}}/todos/1',
  auth: { type: 'inherit' as const },
  headers: [
    { id: uuidv4(), key: 'Content-Type', value: 'application/json', enabled: true },
    { id: uuidv4(), key: 'Accept', value: 'application/json', enabled: true }
  ],
  queryParams: [],
  params: [],
  body: '',
  bodyType: 'json' as const,
  formData: [],
  binaryFile: null
};

interface UseCollectionParams {
  editingNodeId?: string | null;
  setEditingNodeId?: (id: string | null) => void;
  editingName?: string;
  setEditingName?: (name: string) => void;
  nodeToDelete?: { id: string; name: string } | null;
  setNodeToDelete?: (node: { id: string; name: string } | null) => void;
  draggedNodeIdRef?: React.MutableRefObject<string | null>;
  newWorkspaceName?: string;
  setNewWorkspaceName?: (name: string) => void;
  setShowNewWorkspaceInput?: (show: boolean) => void;
}

export const useCollection = (params?: UseCollectionParams) => {
  const {
    collection,
    setCollection,
    activeNodeId,
    setActiveNodeId,
    addLog,
  } = useRequestContext();

  const findParentWorkspace = useCallback(
    (nodeId: string, nodes: CollectionNode[] = collection): CollectionNode | null => {
      for (const node of nodes) {
        if (node.type === 'workspace') {
          if (node.id === nodeId) return node;
          if (node.children) {
            const found = getActiveNode(node.children, nodeId);
            if (found) return node;
          }
        }
      }
      return null;
    },
    [collection]
  );

  const getWorkspaceHistory = useCallback(
    (nodeId: string): HistoryEntry[] => {
      const ws = findParentWorkspace(nodeId);
      return ws?.workspaceConfig?.history || [];
    },
    [findParentWorkspace]
  );

  const updateNodeInCollection = useCallback(
    (nodeId: string, updater: (node: CollectionNode) => CollectionNode) => {
      setCollection((prev) => {
        const update = (nodes: CollectionNode[]): CollectionNode[] => {
          return nodes.map((node) => {
            if (node.id === nodeId) {
              return updater(node);
            }
            if (node.children) return { ...node, children: update(node.children) };
            return node;
          });
        };
        return update(prev);
      });
    },
    [setCollection]
  );

  const addWorkspaceHistoryEntry = useCallback(
    (nodeId: string, entry: HistoryEntry) => {
      const ws = findParentWorkspace(nodeId);
      if (!ws) return;
      updateNodeInCollection(ws.id, (node) => {
        if (node.type !== 'workspace' || !node.workspaceConfig) return node;
        return {
          ...node,
          workspaceConfig: {
            ...node.workspaceConfig,
            history: [entry, ...(node.workspaceConfig.history || [])].slice(0, 50),
          },
        };
      });
    },
    [findParentWorkspace, updateNodeInCollection]
  );

  const addWorkspace = useCallback(() => {
    if (!params?.newWorkspaceName?.trim()) return;
    const name = params.newWorkspaceName.trim();
    const newWs: CollectionNode = {
      id: uuidv4(),
      name,
      type: 'workspace',
      expanded: true,
      workspaceConfig: {
        environments: [{ id: uuidv4(), name: 'Produção', variables: [] }],
        activeEnvironmentId: null,
        history: [],
      },
      children: [
        {
          id: uuidv4(),
          name: 'Nova Pasta',
          type: 'folder',
          children: [],
          folderConfig: { auth: { type: 'none' } },
        },
      ],
    };
    setCollection((prev) => [...prev, newWs]);
    params.setNewWorkspaceName?.('');
    params.setShowNewWorkspaceInput?.(false);
  }, [params, setCollection]);

  const toggleFolder = useCallback(
    (nodeId: string) => {
      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.id === nodeId) return { ...node, expanded: !node.expanded };
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });
      setCollection(updateNode(collection));
    },
    [collection, setCollection]
  );

  const addFolderTo = useCallback(
    (parentId: string) => {
      const newFolder: CollectionNode = {
        id: uuidv4(),
        name: 'Nova Pasta',
        type: 'folder',
        expanded: true,
        children: [],
        folderConfig: { auth: { ...defaultFolderAuth }, variables: [] },
      };
      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.id === parentId) {
            return { ...node, expanded: true, children: [...(node.children || []), newFolder] };
          }
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });
      setCollection(updateNode(collection));
      setActiveNodeId(newFolder.id);
      addLog('info', 'Nova pasta criada');
    },
    [collection, setCollection, setActiveNodeId, addLog]
  );

  const addRequestToFolder = useCallback(
    (folderId: string) => {
      const req = { ...defaultRequest, id: uuidv4(), name: 'Nova Rota' };
      const newNode: CollectionNode = { id: req.id, name: req.name, type: 'request', request: req };

      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.id === folderId) {
            return { ...node, expanded: true, children: [...(node.children || []), newNode] };
          }
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });
      setCollection(updateNode(collection));
      setActiveNodeId(req.id);
      addLog('success', '📄 Nova rota adicionada ao agrupador.');
    },
    [collection, setCollection, setActiveNodeId, addLog]
  );

  const addWebSocketToFolder = useCallback(
    (folderId: string) => {
      const wsReq = {
        ...defaultRequest,
        id: uuidv4(),
        name: 'Conexão WebSocket',
        method: 'WS' as any,
        url: 'wss://echo.websocket.org',
        bodyType: 'ws' as any,
        wsMessages: [],
      };
      const newNode: CollectionNode = { id: wsReq.id, name: wsReq.name, type: 'request', request: wsReq };

      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.id === folderId || node.id === folderId.replace('-ws', '')) {
            return { ...node, expanded: true, children: [...(node.children || []), newNode] };
          }
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });
      setCollection(updateNode(collection));
      setActiveNodeId(wsReq.id);
      addLog('info', 'Nova conexao WebSocket adicionada.');
    },
    [collection, setCollection, setActiveNodeId, addLog]
  );

  const cloneRequest = useCallback(
    (nodeId: string) => {
      const nodeToClone = getActiveNode(collection, nodeId);
      if (!nodeToClone || nodeToClone.type !== 'request' || !nodeToClone.request) return;

      const id = uuidv4();
      const clonedReq = { ...nodeToClone.request, id, name: `${nodeToClone.name} (Cópia)` };
      const newNode: CollectionNode = { id, name: clonedReq.name, type: 'request', request: clonedReq };

      let attached = false;
      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.children && node.children.some((c) => c.id === nodeId)) {
            attached = true;
            const idx = node.children.findIndex((c) => c.id === nodeId);
            const newChildren = [...node.children];
            newChildren.splice(idx + 1, 0, newNode);
            return { ...node, children: newChildren };
          }
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });

      const newColl = updateNode(collection);
      if (!attached) {
        const idx = newColl.findIndex((n) => n.id === nodeId);
        newColl.splice(idx + 1, 0, newNode);
      }

      setCollection(newColl);
      setActiveNodeId(id);
      addLog('success', `📄 Requisição clonada: ${clonedReq.name}`);
    },
    [collection, setCollection, setActiveNodeId, addLog]
  );

  const handleDrop = useCallback(
    (targetId: string | null, asChild: boolean, insertBefore: boolean = false) => {
      if (!params?.draggedNodeIdRef) return;
      const draggedId = params.draggedNodeIdRef.current;
      if (!draggedId) {
        return;
      }

      if (draggedId === targetId) {
        params.draggedNodeIdRef!.current = null;
        document.body.classList.remove('dragging-active');
        return;
      }

      setCollection((prev) => {
        const newCollection: CollectionNode[] = JSON.parse(JSON.stringify(prev));
        let draggedNode: CollectionNode | null = null;

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

        const isTargetInsideDragged = (node: CollectionNode): boolean => {
          if (node.id === targetId) return true;
          if (node.children) {
            return node.children.some((child) => isTargetInsideDragged(child));
          }
          return false;
        };

        const sourceNode = getActiveNode(prev, draggedId);
        if (sourceNode && targetId && isTargetInsideDragged(sourceNode)) {
          addLog('error', 'Operação inválida: Não é possível mover uma pasta para dentro de si mesma ou de seus filhos.');
          return prev;
        }

        findAndRemove(newCollection);
        if (!draggedNode) return prev;

        const nodeToMove: CollectionNode = draggedNode;

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

      params.draggedNodeIdRef!.current = null;
      document.body.classList.remove('dragging-active');
    },
    [params, setCollection, addLog]
  );

  const confirmDelete = useCallback(() => {
    if (!params?.nodeToDelete || !params.setNodeToDelete) return;
    const nodeId = params.nodeToDelete.id;

    const removeNode = (nodes: CollectionNode[]): CollectionNode[] => {
      return nodes.filter((node) => {
        if (node.id === nodeId) return false;
        if (node.children) {
          node.children = removeNode(node.children);
        }
        return true;
      });
    };

    setCollection(removeNode(collection));
    addLog('warn', `🗑️ Item deletado: ${params.nodeToDelete.name}`);

    if (activeNodeId === nodeId) {
      setActiveNodeId(null);
    }

    params.setNodeToDelete(null);
  }, [params, collection, setCollection, activeNodeId, setActiveNodeId, addLog]);

  const startRename = useCallback(
    (nodeId: string, currentName: string, e: any) => {
      if (!params?.setEditingNodeId || !params.setEditingName) return;
      e.stopPropagation();
      params.setEditingNodeId(nodeId);
      params.setEditingName(currentName);
    },
    [params]
  );

  const commitRename = useCallback(
    (nodeId: string) => {
      if (!params?.editingName || !params.setEditingNodeId) return;
      if (!params.editingName.trim()) {
        params.setEditingNodeId(null);
        return;
      }
      const updateNode = (nodes: CollectionNode[]): CollectionNode[] =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            if (node.type === 'request' && node.request) {
              addLog('info', `✏️ Requisição renomeada para "${params.editingName!.trim()}"`);
              return { ...node, name: params.editingName!.trim(), request: { ...node.request, name: params.editingName!.trim() } };
            }
            addLog('info', `✏️ Agrupador renomeado para "${params.editingName!.trim()}"`);
            return { ...node, name: params.editingName!.trim() };
          }
          if (node.children) return { ...node, children: updateNode(node.children) };
          return node;
        });
      setCollection(updateNode(collection));
      params.setEditingNodeId(null);
    },
    [params, collection, setCollection, addLog]
  );

  const exportCollection = useCallback(async (globalVariables: any) => {
    try {
      const db = { collection, globals: globalVariables };
      const content = JSON.stringify(db, null, 2);

      if (!isTauri()) {
        downloadBlobWeb(content, 'aurafetch_workspace.json');
        addLog('success', 'Workspace exportado (download iniciado).');
        return;
      }

      const filePath = await tauriSave({
        filters: [{ name: 'AuraFetch Workspace', extensions: ['json'] }],
        defaultPath: 'aurafetch_workspace.json',
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        addLog('success', `Workspace exportado com sucesso em: ${filePath}`);
      }
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown Error';
      addLog('error', `Falha ao exportar workspace: ${msg}`);
    }
  }, [collection, addLog]);

  const importCollection = useCallback(
    (e: any, setGlobalVariables: any, setActiveNodeId: any) => {
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
            setCollection(obj);
          }

          setActiveNodeId(null);
          addLog('success', `📦 Importação de "${file.name}" feita 100%.`);
        } catch (err) {
          addLog('error', 'O arquivo JSON é inválido.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [setCollection, setActiveNodeId, addLog]
  );

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
