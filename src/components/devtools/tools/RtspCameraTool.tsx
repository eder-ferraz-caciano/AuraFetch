import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Wifi, WifiOff, ZoomIn, ZoomOut, RefreshCw, AlertTriangle, Play, Square, Volume2, VolumeX, Maximize2, Download, Search, BookmarkPlus, Trash2, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { safeFetch } from '../../../utils/safeFetch';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type Protocol = 'onvif' | 'hikvision' | 'dahua' | 'generic';
type ConnStatus = 'idle' | 'testing' | 'ok' | 'fail';
type LiveMode = 'off' | 'mjpeg' | 'polling' | 'rtsp_stream';

interface ParsedRtsp {
  user: string;
  pass: string;
  ip: string;
  port: string;
  path: string;
}

interface RtspCameraToolProps {
  onBack?: () => void;
}

function parseRtspUrl(url: string): ParsedRtsp | null {
  const m = url.match(/^rtsp:\/\/(?:([^:@]+):([^@]*)@)?([^:/\s]+):?(\d+)?(\/.*)?\s*$/i);
  if (!m) return null;
  return {
    user: m[1] || '',
    pass: m[2] || '',
    ip: m[3],
    port: m[4] || '554',
    path: m[5] || '/',
  };
}

function basicAuthHeader(user: string, pass: string): string {
  return 'Basic ' + btoa(`${user}:${pass}`);
}

function getMjpegUrls(ip: string, protocol: Protocol): string[] {
  if (protocol === 'onvif') {
    return [
      `http://${ip}/video1.mjpeg`,
      `http://${ip}/video.mjpg`,
      `http://${ip}/mjpeg`,
    ];
  }
  if (protocol === 'hikvision') {
    return [
      `http://${ip}/Streaming/channels/101/httppreview`,
      `http://${ip}/video.cgi`,
    ];
  }
  if (protocol === 'dahua') {
    return [
      `http://${ip}/cgi-bin/mjpeg?channel=0&subtype=1`,
      `http://${ip}/cgi-bin/video.cgi`,
    ];
  }
  return [
    `http://${ip}/video.mjpg`,
    `http://${ip}/mjpeg`,
    `http://${ip}/video`,
    `http://${ip}/video1`,
  ];
}

function getSnapshotUrls(ip: string, protocol: Protocol): string[] {
  if (protocol === 'onvif') {
    return [
      `http://${ip}/onvif/snapshot`,
      `http://${ip}/snapshot`,
      `http://${ip}/cgi-bin/snapshot.cgi`,
      `http://${ip}/snap.jpg`,
      `http://${ip}/image.jpg`,
    ];
  }
  if (protocol === 'hikvision') {
    return [
      `http://${ip}/ISAPI/Streaming/channels/101/picture`,
      `http://${ip}/Streaming/channels/101/picture`,
      `http://${ip}/onvif/snapshot`,
    ];
  }
  if (protocol === 'dahua') {
    return [
      `http://${ip}/cgi-bin/snapshot.cgi`,
      `http://${ip}/cgi-bin/snapshot.cgi?channel=1`,
      `http://${ip}/onvif/snapshot`,
    ];
  }
  return [
    `http://${ip}/snapshot.jpg`,
    `http://${ip}/snap.jpg`,
    `http://${ip}/cgi-bin/snapshot.cgi`,
    `http://${ip}/image.jpg`,
    `http://${ip}/onvif/snapshot`,
  ];
}

// Descoberta dinâmica da URI de snapshot via ONVIF GetSnapshotUri (SOAP)
async function getOnvifSnapshotUri(ip: string, user: string, pass: string): Promise<string | null> {
  const mediaEndpoints = [
    `http://${ip}/onvif/media`,
    `http://${ip}/onvif/Media`,
    `http://${ip}/onvif/media_service`,
    `http://${ip}/onvif/media2`,
  ];
  const profileTokens = ['Profile_1', 'Profile_2', 'MainStream', '000', 'main', '1'];
  const authHeader = user ? basicAuthHeader(user, pass) : undefined;

  for (const endpoint of mediaEndpoints) {
    for (const token of profileTokens) {
      const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsdl="http://www.onvif.org/ver10/media/wsdl">
  <soap:Body>
    <wsdl:GetSnapshotUri>
      <wsdl:ProfileToken>${token}</wsdl:ProfileToken>
    </wsdl:GetSnapshotUri>
  </soap:Body>
</soap:Envelope>`;
      try {
        const res = await safeFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: soap,
          signal: AbortSignal.timeout(5000),
        });
        const text = await res.text();
        // Extract URI from ONVIF response XML
        const m = text.match(/<(?:[^:>]+:)?Uri>([^<]+)<\/(?:[^:>]+:)?Uri>/);
        if (m?.[1]?.startsWith('http')) {
          return m[1].trim();
        }
      } catch {
        // try next endpoint/token
      }
    }
  }
  return null;
}

// ---- ONVIF Port Discovery & WS-UsernameToken Auth ----

const ONVIF_CANDIDATE_PORTS = [5000, 8899, 80, 8080, 8000, 6688, 443, 554, 2020, 8081, 8181, 37777, 34567];

const ONVIF_PATHS = ['/onvif/device_service', '/onvif/devices', '/', '/onvif'];

const ONVIF_PROBE_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <GetSystemDateAndTime xmlns="http://www.onvif.org/ver10/device/wsdl"/>
  </s:Body>
</s:Envelope>`;

interface DiscoveryLog {
  port: number;
  path: string;
  result: string;
}

async function discoverOnvifPort(
  ip: string,
  onLog?: (log: DiscoveryLog) => void
): Promise<{ port: number; path: string } | null> {
  for (const port of ONVIF_CANDIDATE_PORTS) {
    for (const path of ONVIF_PATHS) {
      const url = `http://${ip}:${port}${path}`;
      try {
        const res = await safeFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
          body: ONVIF_PROBE_BODY,
          signal: AbortSignal.timeout(2500),
        });
        const text = await res.text();
        const snippet = text.substring(0, 120);
        if (text.includes('Envelope') || text.includes('onvif') || text.includes('ONVIF')) {
          onLog?.({ port, path, result: `OK (${res.status}) — ${snippet}` });
          return { port, path };
        }
        // Got a response but not ONVIF — still log it
        onLog?.({ port, path, result: `HTTP ${res.status} — nao ONVIF: ${snippet}` });
      } catch (err) {
        const msg = String(err);
        if (msg.includes('refused') || msg.includes('ECONNREFUSED')) {
          onLog?.({ port, path, result: 'Conexao recusada' });
        } else if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted')) {
          onLog?.({ port, path, result: 'Timeout' });
        } else {
          onLog?.({ port, path, result: `Erro: ${msg.substring(0, 80)}` });
        }
      }
    }
  }
  return null;
}

const PTZ_DIRECTIONS: ReadonlyArray<{ label: string; action: string; row: number; col: number; isStop?: boolean }> = [
  { label: '↖', action: 'LeftUp', row: 0, col: 0 },
  { label: '↑', action: 'Up', row: 0, col: 1 },
  { label: '↗', action: 'RightUp', row: 0, col: 2 },
  { label: '←', action: 'Left', row: 1, col: 0 },
  { label: '⏹', action: 'Stop', row: 1, col: 1, isStop: true },
  { label: '→', action: 'Right', row: 1, col: 2 },
  { label: '↙', action: 'LeftDown', row: 2, col: 0 },
  { label: '↓', action: 'Down', row: 2, col: 1 },
  { label: '↘', action: 'RightDown', row: 2, col: 2 },
];

const DIRECTION_MAP: Record<string, { pan: number; tilt: number }> = {
  Up: { pan: 0, tilt: 1 }, Down: { pan: 0, tilt: -1 },
  Left: { pan: -1, tilt: 0 }, Right: { pan: 1, tilt: 0 },
  LeftUp: { pan: -1, tilt: 1 }, RightUp: { pan: 1, tilt: 1 },
  LeftDown: { pan: -1, tilt: -1 }, RightDown: { pan: 1, tilt: -1 },
  Stop: { pan: 0, tilt: 0 },
};

export const RtspCameraTool: React.FC<RtspCameraToolProps> = () => {
  const [url, setUrl] = useState('');
  const [parsed, setParsed] = useState<ParsedRtsp | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<Protocol>('onvif');
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [connMessage, setConnMessage] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [ptzStatus, setPtzStatus] = useState('');
  const [ptzSpeed, setPtzSpeed] = useState(0.5);
  const [isInTauri] = useState(() => isTauri());

  // Live view
  const [liveMode, setLiveMode] = useState<LiveMode>('off');
  const [liveInterval, setLiveInterval] = useState(2);
  const [mjpegSrc, setMjpegSrc] = useState<string | null>(null);
  const [pollingBlobUrl, setPollingBlobUrl] = useState<string | null>(null);
  const [liveRtspOnly, setLiveRtspOnly] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [liveViewHeight, setLiveViewHeight] = useState(600);
  const [onvifPort, setOnvifPort] = useState<number | null>(null);
  const [onvifDiscovering, setOnvifDiscovering] = useState(false);
  const [onvifStatus, setOnvifStatus] = useState<string | null>(null);
  const [discoveryLogs, setDiscoveryLogs] = useState<DiscoveryLog[]>([]);

  // Saved URLs list
  const STORAGE_KEY = 'aurafetch_rtsp_urls';
  const [savedUrls, setSavedUrls] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [showSavedList, setShowSavedList] = useState(false);

  const persistUrls = (urls: string[]) => {
    setSavedUrls(urls);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
  };

  const handleSaveUrl = () => {
    const trimmed = url.trim();
    if (!trimmed || savedUrls.includes(trimmed)) return;
    persistUrls([trimmed, ...savedUrls]);
  };

  const handleRemoveUrl = (target: string) => {
    persistUrls(savedUrls.filter(u => u !== target));
  };

  const handleSelectUrl = (target: string) => {
    handleUrlChange(target);
    setShowSavedList(false);
  };

  // Digital PTZ (software zoom/pan)
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const snapshotBlobRef = useRef<string | null>(null);
  const pollingBlobRef = useRef<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingFailCountRef = useRef(0);
  const ptzTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioTimeRef = useRef(0);
  const audioUnlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    return () => {
      if (snapshotBlobRef.current) URL.revokeObjectURL(snapshotBlobRef.current);
      if (pollingBlobRef.current) URL.revokeObjectURL(pollingBlobRef.current);
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (unlistenRef.current) unlistenRef.current();
      if (audioUnlistenRef.current) audioUnlistenRef.current();
      invoke('stop_rtsp_stream').catch(() => { /* ignore */ });
    };
  }, []);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setParseError(null);
    if (!value.trim()) { setParsed(null); return; }
    const result = parseRtspUrl(value.trim());
    if (result) {
      setParsed(result);
    } else {
      setParsed(null);
      if (value.trim().length > 10) {
        setParseError('URL inválida. Formato esperado: rtsp://usuario:senha@ip:porta/path');
      }
    }
  };

  const isPortRefused = (err: unknown): boolean => {
    const msg = String(err).toLowerCase();
    return (
      msg.includes('refused') ||
      msg.includes('econnrefused') ||
      msg.includes('connection refused') ||
      msg.includes('err_connection_refused')
    );
  };

  const handleTestConnection = async () => {
    if (!parsed) return;
    setConnStatus('testing');
    setConnMessage('');

    const rtspPort = parsed.port || '554';
    const probePorts = Array.from(new Set([rtspPort, '554', '8554']));

    for (const p of probePorts) {
      const probeUrl = `http://${parsed.ip}:${p}`;
      try {
        await safeFetch(probeUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
        setConnStatus('ok');
        setConnMessage(`Câmera acessível — porta ${p} aberta (${parsed.ip})`);
        return;
      } catch (err) {
        if (!isPortRefused(err)) {
          setConnStatus('ok');
          setConnMessage(`Câmera acessível — porta RTSP ${p} respondeu em ${parsed.ip}`);
          return;
        }
      }
    }

    try {
      const res = await safeFetch(`http://${parsed.ip}`, { method: 'GET', signal: AbortSignal.timeout(4000) });
      setConnStatus('ok');
      setConnMessage(`Interface web acessível (HTTP ${res.status}) em ${parsed.ip}`);
      return;
    } catch (err) {
      if (!isPortRefused(err)) {
        setConnStatus('ok');
        setConnMessage(`Câmera acessível — porta 80 respondeu em ${parsed.ip}`);
        return;
      }
    }

    setConnStatus('fail');
    setConnMessage(`Câmera inacessível em ${parsed.ip}. Verifique o IP e se a câmera está ligada.`);
  };

  // ---- Live View ----

  const stopLive = () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => { /* ignore */ });
      audioCtxRef.current = null;
      audioTimeRef.current = 0;
    }
    if (isInTauri) {
      invoke('stop_rtsp_stream').catch(() => { /* ignore */ });
    }
    setAudioEnabled(false);
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (pollingBlobRef.current) {
      URL.revokeObjectURL(pollingBlobRef.current);
      pollingBlobRef.current = null;
    }
    pollingFailCountRef.current = 0;
    setPollingBlobUrl(null);
    setMjpegSrc(null);
    setLiveRtspOnly(false);
    setLiveMode('off');
  };

  const fetchPollingFrame = async (p: ParsedRtsp, proto: Protocol) => {
    const authHeader = p.user ? basicAuthHeader(p.user, p.pass) : undefined;
    let endpoints = getSnapshotUrls(p.ip, proto);

    if (proto === 'onvif') {
      const discovered = await getOnvifSnapshotUri(p.ip, p.user, p.pass);
      if (discovered) endpoints = [discovered, ...endpoints];
    }

    for (const endpoint of endpoints) {
      try {
        const res = await safeFetch(endpoint, {
          method: 'GET',
          headers: authHeader ? { Authorization: authHeader } : {},
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.startsWith('image/') || blob.size > 100) {
            const newUrl = URL.createObjectURL(blob);
            if (pollingBlobRef.current) URL.revokeObjectURL(pollingBlobRef.current);
            pollingBlobRef.current = newUrl;
            pollingFailCountRef.current = 0;
            setPollingBlobUrl(newUrl);
            setLiveRtspOnly(false);
            return;
          }
        }
      } catch {
        // try next
      }
    }

    // All endpoints failed for this frame
    pollingFailCountRef.current += 1;
    if (pollingFailCountRef.current >= 3) {
      setLiveRtspOnly(true);
    }
  };

  const startMjpeg = (p: ParsedRtsp, proto: Protocol) => {
    const candidates = getMjpegUrls(p.ip, proto);
    // Build URL with basic auth embedded (for <img src> in Tauri WebView)
    const authPrefix = p.user ? `${p.user}:${p.pass}@` : '';
    const withAuth = candidates.map((u) => u.replace('http://', `http://${authPrefix}`));
    setMjpegSrc(withAuth[0]);
    setLiveMode('mjpeg');
  };

  const startPolling = (p: ParsedRtsp, proto: Protocol, intervalSec: number) => {
    setLiveMode('polling');
    fetchPollingFrame(p, proto);
    pollingTimerRef.current = setInterval(() => {
      fetchPollingFrame(p, proto);
    }, intervalSec * 1000);
  };

  const handleStartRtspStream = async () => {
    if (!parsed) return;
    try {
      await invoke('start_rtsp_stream', { url });
      setLiveMode('rtsp_stream');

      const unlistenFrame = await listen<string>('rtsp-frame', (event) => {
        const b64 = event.payload;
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const newUrl = URL.createObjectURL(blob);
        if (pollingBlobRef.current) URL.revokeObjectURL(pollingBlobRef.current);
        pollingBlobRef.current = newUrl;
        setPollingBlobUrl(newUrl);
        setLiveRtspOnly(false);
      });

      // Audio comes from the same ffmpeg process via stderr (pipe:2)
      const unlistenAudio = await listen<string>('rtsp-audio', (event) => {
        if (!audioCtxRef.current) return;
        const ac = audioCtxRef.current;
        const b64 = event.payload;
        const binary = atob(b64);
        const int16 = new Int16Array(binary.length / 2);
        for (let i = 0; i < int16.length; i++) {
          int16[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
        }
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
        const buffer = ac.createBuffer(1, float32.length, 16000);
        buffer.copyToChannel(float32, 0);
        const source = ac.createBufferSource();
        source.buffer = buffer;
        source.connect(ac.destination);
        const startAt = Math.max(ac.currentTime, audioTimeRef.current);
        source.start(startAt);
        audioTimeRef.current = startAt + buffer.duration;
      });
      audioUnlistenRef.current = unlistenAudio;

      unlistenRef.current = () => { unlistenFrame(); };
    } catch {
      // ffmpeg not found — fall back to MJPEG + polling
      startMjpeg(parsed, protocol);
    }
  };

  const handleStartLive = async () => {
    if (!parsed) return;
    stopLive();
    if (isInTauri) {
      await handleStartRtspStream();
    } else {
      startMjpeg(parsed, protocol);
    }
  };

  const handleToggleAudio = () => {
    if (audioEnabled) {
      // Stop audio playback — just close AudioContext (events keep arriving but are ignored)
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => { /* ignore */ });
        audioCtxRef.current = null;
        audioTimeRef.current = 0;
      }
      setAudioEnabled(false);
    } else {
      // Start audio playback — create AudioContext so rtsp-audio events start playing
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      audioTimeRef.current = ctx.currentTime;
      setAudioEnabled(true);
    }
  };

  const handleMjpegError = () => {
    // MJPEG stream failed → fall back to polling silently
    setMjpegSrc(null);
    if (parsed) startPolling(parsed, protocol, liveInterval);
  };

  // ---- Snapshot (one-shot) ----

  const handleSnapshot = async () => {
    if (!parsed) return;
    setSnapshotLoading(true);
    setSnapshotError(null);

    if (snapshotBlobRef.current) {
      URL.revokeObjectURL(snapshotBlobRef.current);
      snapshotBlobRef.current = null;
      setSnapshotUrl(null);
    }

    // In Tauri mode, use ffmpeg to capture a single frame directly from RTSP
    if (isInTauri) {
      try {
        const b64: string = await invoke('rtsp_snapshot', { url });
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const blobUrl = URL.createObjectURL(blob);
        snapshotBlobRef.current = blobUrl;
        setSnapshotUrl(blobUrl);
        setSnapshotLoading(false);
        return;
      } catch (err) {
        // ffmpeg snapshot failed — fall through to HTTP endpoints
        setSnapshotError(String(err));
        setSnapshotLoading(false);
        return;
      }
    }

    // Browser mode: try HTTP endpoints
    const authHeader = parsed.user ? basicAuthHeader(parsed.user, parsed.pass) : undefined;
    const headers: Record<string, string> = authHeader ? { Authorization: authHeader } : {};
    let endpoints = getSnapshotUrls(parsed.ip, protocol);

    if (protocol === 'onvif') {
      const discovered = await getOnvifSnapshotUri(parsed.ip, parsed.user, parsed.pass);
      if (discovered) endpoints = [discovered, ...endpoints];
    }

    for (const endpoint of endpoints) {
      try {
        const res = await safeFetch(endpoint, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.startsWith('image/') || blob.size > 100) {
            const blobUrl = URL.createObjectURL(blob);
            snapshotBlobRef.current = blobUrl;
            setSnapshotUrl(blobUrl);
            setSnapshotLoading(false);
            return;
          }
        }
      } catch {
        // try next
      }
    }

    setSnapshotError('Não foi possível capturar snapshot. Verifique o protocolo e as credenciais.');
    setSnapshotLoading(false);
  };

  // ---- ONVIF Discovery ----

  const handleDiscoverOnvif = useCallback(async () => {
    if (!parsed) return;
    setOnvifDiscovering(true);
    setOnvifStatus('Buscando porta ONVIF...');
    setOnvifPort(null);
    setDiscoveryLogs([]);

    const logs: DiscoveryLog[] = [];
    const result = await discoverOnvifPort(parsed.ip, (log) => {
      logs.push(log);
      setDiscoveryLogs([...logs]);
      setOnvifStatus(`Testando porta ${log.port}${log.path}...`);
    });

    setDiscoveryLogs([...logs]);

    if (result === null) {
      setOnvifStatus(`Nenhuma porta ONVIF encontrada apos testar ${ONVIF_CANDIDATE_PORTS.length} portas. Veja o log abaixo.`);
      setOnvifDiscovering(false);
      return;
    }

    setOnvifPort(result.port);
    setOnvifStatus(`ONVIF encontrado em ${parsed.ip}:${result.port}${result.path}`);
    setOnvifDiscovering(false);
  }, [parsed]);

  // ---- PTZ (ONVIF SOAP ContinuousMove — Yoosee/GWIPC cameras on port 5000) ----

  // Direction unit vectors — multiplied by ptzSpeed (0.1–1.0)
  const ONVIF_PTZ_DIR: Record<string, [number, number]> = {
    Up: [0, 1], Down: [0, -1], Left: [-1, 0], Right: [1, 0],
    LeftUp: [-1, 1], RightUp: [1, 1],
    LeftDown: [-1, -1], RightDown: [1, -1],
  };

  const sendPtzMove = async (action: string) => {
    if (!parsed || !isInTauri) return;
    const dir = ONVIF_PTZ_DIR[action];
    if (!dir) return;
    try {
      await invoke('onvif_ptz_move', {
        ip: parsed.ip,
        port: 5000,
        user: parsed.user || 'admin',
        pass: parsed.pass || '',
        panX: dir[0] * ptzSpeed,
        panY: dir[1] * ptzSpeed,
      });
      setPtzStatus(`Movendo: ${action}`);
    } catch (err) {
      setPtzStatus(`Erro PTZ: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const sendPtzStop = async () => {
    if (!parsed || !isInTauri) return;
    try {
      await invoke('onvif_ptz_stop', {
        ip: parsed.ip,
        port: 5000,
        user: parsed.user || 'admin',
        pass: parsed.pass || '',
      });
      setPtzStatus('Parado');
    } catch (err) {
      setPtzStatus(`Erro PTZ Stop: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePtzStart = (action: string) => sendPtzMove(action);
  const handlePtzStop = () => { if (ptzTimerRef.current) clearTimeout(ptzTimerRef.current); sendPtzStop(); };

  // ---- Save Snapshot ----

  const handleSaveSnapshot = async () => {
    if (!snapshotUrl) return;
    try {
      const res = await fetch(snapshotUrl);
      const blob = await res.blob();
      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);

      if (isInTauri) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const now = new Date();
        const defaultName = `snapshot_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.jpg`;
        const filePath = await save({
          defaultPath: defaultName,
          filters: [{ name: 'Imagem JPEG', extensions: ['jpg', 'jpeg'] }, { name: 'Todos', extensions: ['*'] }],
        });
        if (filePath) {
          await writeFile(filePath, bytes);
        }
      } else {
        // Browser fallback: download via anchor
        const a = document.createElement('a');
        a.href = snapshotUrl;
        a.download = 'snapshot.jpg';
        a.click();
      }
    } catch (err) {
      console.error('Erro ao salvar snapshot:', err);
    }
  };

  // ---- Digital PTZ handlers ----

  const handleDigitalZoomIn = () => {
    setDigitalZoom((z) => Math.min(z + 0.5, 8));
  };
  const handleDigitalZoomOut = () => {
    setDigitalZoom((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) { setPanX(0); setPanY(0); }
      return next;
    });
  };
  const handleDigitalZoomReset = () => {
    setDigitalZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleViewerMouseDown = (e: React.MouseEvent) => {
    if (digitalZoom <= 1) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    e.preventDefault();
  };
  const handleViewerMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanX(panStartRef.current.panX + dx);
    setPanY(panStartRef.current.panY + dy);
  };
  const handleViewerMouseUp = () => {
    isPanningRef.current = false;
  };
  const handleViewerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setDigitalZoom((z) => Math.min(z + 0.25, 8));
    } else {
      setDigitalZoom((z) => {
        const next = Math.max(z - 0.25, 1);
        if (next === 1) { setPanX(0); setPanY(0); }
        return next;
      });
    }
  };

  const protocolLabels: Record<Protocol, string> = {
    onvif: 'ONVIF', hikvision: 'Hikvision', dahua: 'Dahua', generic: 'Genérico',
  };

  const liveActive = liveMode !== 'off';

  // Shared styles
  const chipActive = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '20px',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
  });

  const ptzBtn = (isStop?: boolean, disabled?: boolean): React.CSSProperties => ({
    width: '42px', height: '42px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: isStop ? 'rgba(239,68,68,0.08)' : 'var(--bg-panel)',
    border: `1.5px solid ${isStop ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}`,
    borderRadius: isStop ? '50%' : '8px',
    color: isStop ? 'var(--danger)' : disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '18px', userSelect: 'none',
    transition: 'all 0.1s ease',
  });

  const sectionTitle = (text: string, accent?: boolean) => (
    <div style={{
      fontSize: '10px', fontWeight: '700', letterSpacing: '1.2px', textTransform: 'uppercase',
      color: accent ? 'var(--accent-primary)' : 'var(--text-muted)',
      paddingBottom: '4px', borderBottom: '1px solid var(--border-color)',
    }}>
      {text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── CORS Warning ── */}
      {!isInTauri && (
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'center',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px',
          color: 'rgb(245,158,11)', fontSize: '11px',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>Modo browser: acesso limitado por CORS. Use o app desktop para controle total.</span>
        </div>
      )}

      {/* ── URL Input + Connection Bar ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0',
        border: `1.5px solid ${parsed ? (connStatus === 'ok' ? 'rgba(34,197,94,0.3)' : connStatus === 'fail' ? 'rgba(239,68,68,0.3)' : 'var(--border-color)') : parseError ? 'var(--danger)' : 'var(--border-color)'}`,
        borderRadius: '8px', overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <div style={{
            padding: '10px 12px', backgroundColor: 'var(--bg-deep)',
            display: 'flex', alignItems: 'center', gap: '6px',
            borderRight: '1px solid var(--border-color)',
          }}>
            <Camera size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>RTSP</span>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="rtsp://admin:senha@192.168.1.2:554/onvif1"
            style={{
              flex: 1, padding: '10px 12px',
              backgroundColor: 'var(--bg-panel)', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '13px',
            }}
          />
          {/* Save + Dropdown buttons */}
          {url.trim() && !savedUrls.includes(url.trim()) && (
            <button
              onClick={handleSaveUrl}
              title="Salvar URL"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 10px', border: 'none', borderLeft: '1px solid var(--border-color)',
                backgroundColor: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer',
              }}
            >
              <BookmarkPlus size={14} />
            </button>
          )}
          {savedUrls.length > 0 && (
            <button
              onClick={() => setShowSavedList(!showSavedList)}
              title="Cameras salvas"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 10px', border: 'none', borderLeft: '1px solid var(--border-color)',
                backgroundColor: showSavedList ? 'var(--bg-deep)' : 'transparent',
                color: showSavedList ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ChevronDownIcon size={14} style={{ transform: showSavedList ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
            </button>
          )}
          {/* Inline connection status */}
          {parsed && connStatus !== 'idle' && (
            <div style={{
              padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: '700',
              color: connStatus === 'ok' ? 'rgb(34,197,94)' : connStatus === 'fail' ? 'var(--danger)' : 'var(--text-muted)',
            }}>
              {connStatus === 'testing' && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
              {connStatus === 'ok' && <Wifi size={11} />}
              {connStatus === 'fail' && <WifiOff size={11} />}
              <span>{connStatus === 'testing' ? 'Testando' : connStatus === 'ok' ? 'Online' : 'Offline'}</span>
            </div>
          )}
        </div>

        {/* Saved URLs list */}
        {showSavedList && savedUrls.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-deep)',
            maxHeight: '180px', overflowY: 'auto',
          }}>
            <div style={{
              padding: '5px 12px', fontSize: '9px', fontWeight: '700',
              color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase',
              borderBottom: '1px solid var(--border-color)',
            }}>
              Cameras salvas ({savedUrls.length})
            </div>
            {savedUrls.map((savedUrl) => {
              const active = savedUrl === url.trim();
              const p = parseRtspUrl(savedUrl);
              return (
                <div
                  key={savedUrl}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: active ? 'rgba(59,130,246,0.06)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => handleSelectUrl(savedUrl)}
                >
                  <Camera size={12} style={{ color: active ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '11px', fontFamily: 'monospace', fontWeight: '500',
                      color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {p ? `${p.ip}:${p.port}${p.path}` : savedUrl}
                    </div>
                    {p && p.user && (
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        {p.user}@{p.ip}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveUrl(savedUrl); }}
                    title="Remover"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                      backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                      flexShrink: 0, transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Parsed info strip */}
        {parsed && (
          <div style={{
            display: 'flex', gap: '16px', padding: '6px 12px',
            backgroundColor: 'var(--bg-deep)', borderTop: '1px solid var(--border-color)',
            fontSize: '11px',
          }}>
            {[
              { label: 'IP', value: parsed.ip },
              { label: 'Porta', value: parsed.port },
              { label: 'User', value: parsed.user || '--' },
              { label: 'Path', value: parsed.path },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: '500' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {parseError && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '-8px' }}>{parseError}</div>}

      {/* ── Protocol + Actions ── */}
      {parsed && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Protocol chips */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['onvif', 'hikvision', 'dahua', 'generic'] as Protocol[]).map((p) => (
              <button
                key={p}
                onClick={() => { setProtocol(p); if (liveActive) stopLive(); }}
                style={chipActive(protocol === p)}
              >
                {protocolLabels[p]}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleTestConnection}
              disabled={connStatus === 'testing'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                color: connStatus === 'testing' ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: connStatus === 'testing' ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: '600',
              }}
            >
              <Wifi size={13} />
              Testar
            </button>

            <button
              onClick={handleSnapshot}
              disabled={snapshotLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                color: snapshotLoading ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: snapshotLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: '600',
              }}
            >
              {snapshotLoading ? <RefreshCw size={13} /> : <Camera size={13} />}
              Snapshot
            </button>

            {!liveActive ? (
              <button
                onClick={handleStartLive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 16px',
                  backgroundColor: 'var(--accent-primary)',
                  border: '1px solid var(--accent-primary)', borderRadius: '6px',
                  color: 'white', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '700',
                }}
              >
                <Play size={13} />
                Live
              </button>
            ) : (
              <button
                onClick={stopLive}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 16px',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.5)', borderRadius: '6px',
                  color: 'var(--danger)', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '700',
                }}
              >
                <Square size={13} />
                Parar
              </button>
            )}

            {/* Audio toggle */}
            {liveMode === 'rtsp_stream' && isInTauri && (
              <button
                onClick={handleToggleAudio}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '34px', height: '34px',
                  backgroundColor: audioEnabled ? 'rgba(34,197,94,0.1)' : 'transparent',
                  border: `1px solid ${audioEnabled ? 'rgb(34,197,94)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  color: audioEnabled ? 'rgb(34,197,94)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                title={audioEnabled ? 'Desativar audio' : 'Ativar audio'}
              >
                {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Connection Status Message ── */}
      {connStatus !== 'idle' && connMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: connStatus === 'ok' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${connStatus === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: connStatus === 'ok' ? 'rgb(34,197,94)' : 'var(--danger)',
          fontSize: '11px', fontWeight: '500',
        }}>
          {connStatus === 'ok' ? <Wifi size={13} /> : <WifiOff size={13} />}
          {connMessage}
        </div>
      )}

      {/* ── Live View + Controls ── */}
      {liveActive && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '10px', alignItems: 'start' }}>

          {/* LEFT: Live View Monitor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minWidth: 0 }}>
            {/* Monitor top bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.85)',
              borderRadius: '8px 8px 0 0',
              borderBottom: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Recording indicator */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: 'rgb(239,68,68)',
                  boxShadow: '0 0 6px rgba(239,68,68,0.6)',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                  {parsed?.ip || ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {digitalZoom > 1 && (
                  <span style={{
                    fontSize: '10px', fontFamily: 'monospace', fontWeight: '700',
                    color: 'rgb(34,197,94)',
                    padding: '1px 6px', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: '3px',
                  }}>
                    {digitalZoom.toFixed(1)}x
                  </span>
                )}
                <span style={{
                  fontSize: '10px', fontFamily: 'monospace', fontWeight: '700',
                  padding: '1px 6px', borderRadius: '3px',
                  color: liveMode === 'rtsp_stream' ? 'rgb(34,197,94)' : 'rgb(234,179,8)',
                  backgroundColor: liveMode === 'rtsp_stream' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                }}>
                  {liveMode === 'mjpeg' ? 'MJPEG' : liveMode === 'rtsp_stream' ? 'RTSP' : `POLL ${liveInterval}s`}
                </span>
              </div>
            </div>

            {/* Video viewport */}
            {liveRtspOnly && liveMode !== 'rtsp_stream' ? (
              <div style={{
                padding: '24px 16px', backgroundColor: 'rgba(0,0,0,0.9)',
                borderRadius: '0 0 8px 8px',
                display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center',
              }}>
                <AlertTriangle size={28} style={{ color: 'rgb(245,158,11)', opacity: 0.8 }} />
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', textAlign: 'center' }}>
                  Camera RTSP pura - sem endpoint HTTP
                </div>
                <div style={{
                  padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all',
                }}>
                  {url}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  style={{
                    padding: '6px 14px', backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
                    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '600',
                  }}
                >
                  Copiar URL
                </button>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#000',
                  borderRadius: '0 0 8px 8px',
                  minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                  cursor: digitalZoom > 1 ? 'grab' : 'default',
                }}
                onMouseDown={handleViewerMouseDown}
                onMouseMove={handleViewerMouseMove}
                onMouseUp={handleViewerMouseUp}
                onMouseLeave={handleViewerMouseUp}
                onWheel={handleViewerWheel}
              >
                {liveMode === 'mjpeg' && mjpegSrc && (
                  <img
                    src={mjpegSrc}
                    alt="Live MJPEG"
                    onError={handleMjpegError}
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      ...(liveViewHeight > 0 ? { maxHeight: `${liveViewHeight}px` } : {}),
                      objectFit: 'contain', display: 'block',
                      transform: `scale(${digitalZoom}) translate(${panX / digitalZoom}px, ${panY / digitalZoom}px)`,
                      transformOrigin: 'center center',
                      transition: isPanningRef.current ? 'none' : 'transform 0.1s ease-out',
                    }}
                  />
                )}
                {(liveMode === 'polling' || liveMode === 'rtsp_stream') && pollingBlobUrl && (
                  <img
                    src={pollingBlobUrl}
                    alt={liveMode === 'rtsp_stream' ? 'Live RTSP' : 'Live polling'}
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      ...(liveViewHeight > 0 ? { maxHeight: `${liveViewHeight}px` } : {}),
                      objectFit: 'contain', display: 'block',
                      transform: `scale(${digitalZoom}) translate(${panX / digitalZoom}px, ${panY / digitalZoom}px)`,
                      transformOrigin: 'center center',
                      transition: isPanningRef.current ? 'none' : 'transform 0.1s ease-out',
                    }}
                  />
                )}
                {(liveMode === 'polling' || liveMode === 'rtsp_stream') && !pollingBlobUrl && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    color: 'rgba(255,255,255,0.3)', fontSize: '12px',
                  }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1.5s linear infinite' }} />
                    Aguardando frame...
                  </div>
                )}
                {/* Scanline overlay */}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
                  mixBlendMode: 'multiply',
                }} />
              </div>
            )}
          </div>

          {/* RIGHT: Controls Panel */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px', width: '200px',
            padding: '10px',
            backgroundColor: 'var(--bg-deep)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}>

            {/* Digital PTZ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sectionTitle('PTZ Digital')}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px',
                padding: '2px',
              }}>
                {PTZ_DIRECTIONS.map((btn) => (
                  <button
                    key={btn.action}
                    onMouseDown={() => {
                      if (btn.isStop) { handleDigitalZoomReset(); return; }
                      const dir = DIRECTION_MAP[btn.action];
                      if (digitalZoom <= 1) return;
                      setPanX((x) => x + dir.pan * -40);
                      setPanY((y) => y + dir.tilt * 40);
                    }}
                    style={{
                      ...ptzBtn(btn.isStop, !btn.isStop && digitalZoom <= 1),
                      gridRow: btn.row + 1, gridColumn: btn.col + 1,
                      width: '100%',
                    }}
                    title={btn.isStop ? 'Reset (1x)' : btn.action}
                  >
                    {btn.isStop ? 'R' : btn.label}
                  </button>
                ))}
              </div>

              {/* Zoom controls */}
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <button
                  onClick={handleDigitalZoomOut}
                  disabled={digitalZoom <= 1}
                  style={{
                    flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px',
                    color: digitalZoom <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: digitalZoom <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ZoomOut size={14} />
                </button>
                <div style={{
                  flex: 1.2, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px',
                  fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: 'var(--accent-primary)',
                }}>
                  {digitalZoom.toFixed(1)}x
                </div>
                <button
                  onClick={handleDigitalZoomIn}
                  disabled={digitalZoom >= 8}
                  style={{
                    flex: 1, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px',
                    color: digitalZoom >= 8 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: digitalZoom >= 8 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '1.4', textAlign: 'center' }}>
                Scroll = zoom | Arraste = pan
              </div>
            </div>

            {/* View Size */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sectionTitle('Tamanho')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {[400, 600, 800].map((h) => (
                  <button
                    key={h}
                    onClick={() => setLiveViewHeight(h)}
                    style={chipActive(liveViewHeight === h)}
                  >
                    {h}
                  </button>
                ))}
                <button
                  onClick={() => setLiveViewHeight(0)}
                  style={{
                    ...chipActive(liveViewHeight === 0),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px',
                  }}
                >
                  <Maximize2 size={9} />
                </button>
              </div>
            </div>

            {/* Hardware PTZ */}
            {isInTauri && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sectionTitle('PTZ Camera', true)}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', padding: '2px',
                }}>
                  {PTZ_DIRECTIONS.map((btn) => (
                    <button
                      key={`hw-${btn.action}`}
                      onMouseDown={() => !btn.isStop && handlePtzStart(btn.action)}
                      onMouseUp={() => !btn.isStop && handlePtzStop()}
                      onMouseLeave={() => !btn.isStop && handlePtzStop()}
                      onClick={() => btn.isStop && handlePtzStop()}
                      style={{
                        ...ptzBtn(btn.isStop),
                        gridRow: btn.row + 1, gridColumn: btn.col + 1,
                        width: '100%',
                      }}
                      title={btn.action}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Speed */}
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[
                    { label: 'Lento', value: 0.15 },
                    { label: 'Medio', value: 0.5 },
                    { label: 'Rapido', value: 1.0 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setPtzSpeed(s.value)}
                      style={{
                        ...chipActive(ptzSpeed === s.value),
                        flex: 1, padding: '4px 0', fontSize: '10px',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {ptzStatus && (
                  <div style={{
                    fontSize: '10px', fontFamily: 'monospace',
                    color: ptzStatus.includes('Erro') ? 'var(--danger)' : 'var(--text-muted)',
                    padding: '3px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '4px',
                  }}>
                    {ptzStatus}
                  </div>
                )}
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Segure para mover | ONVIF :5000
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Snapshot Error ── */}
      {snapshotError && (
        <div style={{
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: '12px',
        }}>
          {snapshotError}
        </div>
      )}

      {/* ── Snapshot Display ── */}
      {snapshotUrl && !liveActive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px', backgroundColor: 'var(--bg-deep)',
            borderRadius: '8px 8px 0 0', border: '1px solid var(--border-color)', borderBottom: 'none',
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Snapshot
            </span>
            <button
              onClick={handleSaveSnapshot}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 10px', backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--text-primary)', cursor: 'pointer',
                fontSize: '11px', fontWeight: '600',
              }}
            >
              <Download size={11} />
              Salvar
            </button>
          </div>
          <div style={{
            padding: '8px', backgroundColor: '#000',
            border: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px',
            display: 'flex', justifyContent: 'center',
          }}>
            <img src={snapshotUrl} alt="Camera snapshot" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }} />
          </div>
        </div>
      )}

      {/* ── ONVIF Discovery ── */}
      {parsed && protocol === 'onvif' && !onvifPort && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '10px 12px', backgroundColor: 'var(--bg-deep)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ONVIF Discovery
            </span>
            <button
              onClick={handleDiscoverOnvif}
              disabled={onvifDiscovering}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '20px',
                color: onvifDiscovering ? 'var(--text-muted)' : 'var(--accent-primary)',
                cursor: onvifDiscovering ? 'not-allowed' : 'pointer',
                fontSize: '11px', fontWeight: '600',
              }}
            >
              <Search size={11} />
              {onvifDiscovering ? 'Buscando...' : 'Descobrir'}
            </button>
          </div>
          {onvifStatus && (
            <div style={{
              padding: '5px 8px', backgroundColor: 'var(--bg-panel)',
              borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)',
            }}>
              {onvifStatus}
            </div>
          )}
          {discoveryLogs.length > 0 && (
            <details style={{ fontSize: '11px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '4px', fontSize: '10px' }}>
                Log ({discoveryLogs.length} tentativas)
              </summary>
              <div style={{
                maxHeight: '160px', overflowY: 'auto',
                padding: '6px 8px', backgroundColor: 'var(--bg-panel)',
                borderRadius: '4px',
                fontFamily: 'monospace', fontSize: '9px', lineHeight: '1.7',
              }}>
                {discoveryLogs.map((log, i) => (
                  <div key={i} style={{
                    color: log.result.startsWith('OK') ? 'rgb(34,197,94)' :
                           log.result.includes('recusada') ? 'var(--text-muted)' :
                           log.result.includes('Timeout') ? 'rgb(245,158,11)' : 'var(--danger)',
                  }}>
                    :{log.port}{log.path} - {log.result}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Polling interval (when not live) ── */}
      {!liveActive && parsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Polling fallback:</span>
          {[1, 2, 5].map((s) => (
            <button key={s} onClick={() => setLiveInterval(s)} style={chipActive(liveInterval === s)}>
              {s}s
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!url && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          color: 'var(--text-muted)', fontSize: '13px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Camera size={24} style={{ opacity: 0.4 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Testador RTSP
          </div>
          <div style={{ fontSize: '12px' }}>
            Cole a URL RTSP da camera para testar conexao, capturar snapshots e ver o live view
          </div>
        </div>
      )}

      {/* CSS keyframes for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
