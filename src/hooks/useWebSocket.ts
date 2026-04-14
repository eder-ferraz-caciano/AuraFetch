import { useRef, useCallback } from 'react';
import WebSocket from '@tauri-apps/plugin-websocket';
import { useRequestContext } from '../context/RequestContext';
import { useEnvironment } from './useEnvironment';
import { v4 as uuidv4 } from 'uuid';
import type { RequestModel } from '../types';

interface UseWebSocketProps {
  activeReq: RequestModel | null;
  activeNodeId: string | null;
  handleActiveReqChange: (updates: any) => void;
  setLoading: (loading: boolean) => void;
  setCollection: (updater: (prev: any[]) => any[]) => void;
}

export const useWebSocket = (props?: UseWebSocketProps) => {
  const { addLog, setWsConnected, wsInputMessage, setWsInputMessage } = useRequestContext();
  const { applyVariables } = useEnvironment();

  const wsInstRef = useRef<WebSocket | null>(null);
  const wsUnlistenRef = useRef<(() => void) | null>(null);

  // For use in App.tsx (no props passed) - sendWsMessage
  const sendWsMessage = useCallback(async (
    activeReq: RequestModel | null,
    handleActiveReqChange: (updates: any) => void
  ) => {
    if (wsInstRef.current && wsInputMessage.trim()) {
      await wsInstRef.current.send(wsInputMessage);
      handleActiveReqChange({
        wsMessages: [...(activeReq!.wsMessages || []), { id: uuidv4(), type: 'sent', text: wsInputMessage, timestamp: Date.now() }]
      });
      setWsInputMessage('');
    }
  }, [wsInstRef, wsInputMessage, setWsInputMessage]);

  // For use in useRequest hook (with props passed)
  const connectWs = useCallback(async () => {
    if (!props?.activeReq || !props?.activeNodeId) return;
    props.setLoading(true);
    const targetUrl = applyVariables(props.activeReq.url, props.activeReq.id);
    addLog('info', `🔌 Tentando conectar WebSocket em: ${targetUrl}`);

    try {
      if (wsUnlistenRef.current) {
        wsUnlistenRef.current();
        wsUnlistenRef.current = null;
      }

      const ws = await WebSocket.connect(targetUrl);
      wsInstRef.current = ws;
      setWsConnected(true);

      const nodeId = props.activeNodeId;

      props.handleActiveReqChange({
        wsMessages: [{ id: uuidv4(), type: 'info', text: 'Conectado a ' + targetUrl, timestamp: Date.now() }]
      });

      wsUnlistenRef.current = ws.addListener((msg: any) => {
        let textData = '';
        if (msg.type === 'Text') textData = msg.data as string;
        else if (msg.type === 'Binary') textData = '[Binary Message]';

        props!.setCollection((prev: any[]) => {
          const update = (nodes: any[]): any[] =>
            nodes.map((node: any) => {
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

        addLog('info', `WS recebido: ${textData.substring(0, 100)}${textData.length > 100 ? '...' : ''}`);
      });

    } catch (err: any) {
      addLog('error', `Falha ao conectar WS: ${err.message || err.toString()}`);
    } finally {
      props!.setLoading(false);
    }
  }, [props, applyVariables, addLog, setWsConnected, wsUnlistenRef, wsInstRef]);

  const disconnectWs = useCallback(async () => {
    if (wsUnlistenRef.current) {
      wsUnlistenRef.current();
      wsUnlistenRef.current = null;
    }
    if (wsInstRef.current) {
      await wsInstRef.current.disconnect();
      wsInstRef.current = null;
      setWsConnected(false);
      props?.handleActiveReqChange({
        wsMessages: [...(props.activeReq!.wsMessages || []), { id: uuidv4(), type: 'info', text: 'Desconectado', timestamp: Date.now() }]
      });
      addLog('info', '🔌 WebSocket Desconectado');
    }
  }, [props, setWsConnected, addLog, wsUnlistenRef, wsInstRef]);

  return { connectWs, disconnectWs, sendWsMessage, wsInstRef, wsUnlistenRef };
};
