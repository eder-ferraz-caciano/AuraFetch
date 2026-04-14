import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Send, Eye, CheckCircle2, WifiOff, Trash2, Info, Type, BarChart3, QrCode, Minus, Settings, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { safeFetch } from '../../../utils/safeFetch';
import { parseZplElements, parseDplElements, elementToZpl, elementToDpl, reassembleZpl, reassembleDpl, getElementLabel, isEditableConfig } from './labelPrinterParsers';
import type { ParsedElement, ElementKind } from './labelPrinterParsers';

type PrinterType = 'zebra' | 'datamax';
type PrintStatus = 'idle' | 'sending' | 'sent' | 'unreachable';

interface LabelPrinterToolProps {
  onBack?: () => void;
}

const DOTS_PER_CM = 80; // 203 dpi ≈ 80 dots/cm

function cmToDots(cm: number): number {
  return Math.round(cm * DOTS_PER_CM);
}

function cmToInches(cm: number): number {
  return +(cm / 2.54).toFixed(4);
}

function buildZplTemplate(wDots: number, hDots: number): string {
  const midX = Math.round(wDots * 0.71);
  const barcodeY = Math.round(hDots * 0.48);
  const qrX = Math.round(wDots * 0.79);
  const sepY = Math.round(hDots * 0.13);
  const sep2Y = Math.round(hDots * 0.47);
  return `^XA
^PW${wDots}
^LL${hDots}
^FO30,20^A0N,28,28^FDMINHA EMPRESA LTDA^FS
^FO30,${sepY}^GB${wDots - 60},2,2^FS
^FO30,${sepY + 15}^A0N,50,50^FDNOME DO PRODUTO^FS
^FO30,${sepY + 75}^A0N,25,25^FDDescricao: Produto exemplo 500ml^FS
^FO30,${sepY + 107}^A0N,25,25^FDSKU: PRD-001234^FS
^FO${midX},${sepY + 75}^A0N,55,55^FDR$ 29,90^FS
^FO30,${sep2Y}^GB${wDots - 60},2,2^FS
^FO30,${barcodeY}
^BY2,3,80
^BCN,80,Y,N,N
^FD7891234567890^FS
^FO${qrX},${barcodeY}
^BQN,2,4
^FDQA,https://exemplo.com.br^FS
^XZ`;
}

function buildDplTemplate(wDots: number, hDots: number): string {
  const wInches = Math.ceil(wDots / 203);
  // Helper: pad number to N digits
  const p = (n: number, len = 4) => String(n).padStart(len, '0');

  const x0 = p(30);             // margem esquerda
  const priceX = p(Math.round(wDots * 0.71));
  const sepW = p(wDots - 60);
  const sepY = p(Math.round(hDots * 0.13));
  const prodY = p(Math.round(hDots * 0.13) + 15);
  const descY = p(Math.round(hDots * 0.13) + 75);
  const skuY = p(Math.round(hDots * 0.13) + 107);
  const sep2Y = p(Math.round(hDots * 0.47));
  const bcY = p(Math.round(hDots * 0.48));

  // DPL text:    1A[font:1][rot:1][x:4][y:4][h:3][dados]
  // DPL line:    LO[x:4][y:4][comp:4][esp:3]
  // DPL barcode: 1B[rot:1][tipo:2][x:4][y:4][h:3][narrow:1][dados]
  return `\x02L
D11
H${p(hDots)}
c${wInches}
1A10${x0}${p(20)}028MINHA EMPRESA LTDA
LO${x0}${sepY}${sepW}002
1A10${x0}${prodY}050NOME DO PRODUTO
1A10${x0}${descY}025Descricao: Produto exemplo 500ml
1A10${x0}${skuY}025SKU: PRD-001234
1A10${priceX}${descY}055R$ 29,90
LO${x0}${sep2Y}${sepW}002
1B102${x0}${bcY}${p(80, 3)}07891234567890
E`;
}

function drawSimpleBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, data: string) {
  const barW = 2;
  let cx = x;
  ctx.fillStyle = '#000';
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i) % 16;
    for (let b = 0; b < 4; b++) {
      if ((code >> b) & 1) ctx.fillRect(cx, y, barW, h);
      cx += barW;
    }
    cx += 1;
  }
  ctx.font = `${Math.max(h * 0.15, 8)}px monospace`;
  ctx.fillText(data, x, y + h + 10);
}

function renderDplToCanvas(code: string): string {
  let wDots = 812, hDots = 406;
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    const hMatch = line.match(/^H(\d{4})$/);
    if (hMatch) hDots = parseInt(hMatch[1]);
  }

  const SCALE = 0.5;
  const W = Math.round(wDots * SCALE);
  const H = Math.round(hDots * SCALE);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';

  for (const raw of code.split('\n')) {
    const line = raw.trim();

    const textMatch = line.match(/^1A(\d)(\d)(\d{4})(\d{4})(\d{3})(.+)$/);
    if (textMatch) {
      const x = parseInt(textMatch[3]) * SCALE;
      const y = parseInt(textMatch[4]) * SCALE;
      const h = parseInt(textMatch[5]) * SCALE;
      const data = textMatch[6];
      const fontSize = Math.max(Math.round(h * 0.75), 8);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.fillText(data, x, y + fontSize);
      continue;
    }

    const lineMatch = line.match(/^LO(\d{4})(\d{4})(\d{4})(\d{2,4})$/);
    if (lineMatch) {
      const x = parseInt(lineMatch[1]) * SCALE;
      const y = parseInt(lineMatch[2]) * SCALE;
      const len = parseInt(lineMatch[3]) * SCALE;
      const wid = Math.max(parseInt(lineMatch[4]) * SCALE, 1);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, len, wid);
      continue;
    }

    const bcMatch = line.match(/^1B(\d)(\d{2})(\d{4})(\d{4})(\d{3})(\d)(.+)$/);
    if (bcMatch) {
      const x = parseInt(bcMatch[3]) * SCALE;
      const y = parseInt(bcMatch[4]) * SCALE;
      const h = parseInt(bcMatch[5]) * SCALE;
      const data = bcMatch[7];
      drawSimpleBarcode(ctx, x, y, h, data);
    }
  }

  return canvas.toDataURL('image/png');
}

async function fetchZplPreview(code: string, widthCm: number, heightCm: number): Promise<string> {
  const wIn = cmToInches(widthCm);
  const hIn = cmToInches(heightCm);
  const res = await safeFetch(`http://api.labelary.com/v1/printers/8dpmm/labels/${wIn}x${hIn}/0/`, {
    method: 'POST',
    body: code,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Labelary erro ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

const ZPL_REFERENCE = [
  { title: 'Tamanho da fonte', code: '^A0N,{altura},{largura}', example: '^A0N,30,30 (pequena)  ^A0N,60,60 (grande)' },
  { title: 'Posicao (X,Y)', code: '^FO{x},{y}', example: '^FO30,20 — X: direita(+) esquerda(-)  Y: baixo(+) cima(-)' },
  { title: 'Largura etiqueta', code: '^PW{dots}', example: '^PW812 (10cm)  ^PW1218 (15cm)  1cm = 80 dots' },
  { title: 'Altura etiqueta', code: '^LL{dots}', example: '^LL406 (5cm)  ^LL812 (10cm)  1cm = 80 dots' },
  { title: 'Texto', code: '^FO{x},{y}^A0N,{h},{w}^FD{texto}^FS', example: '^FO50,100^A0N,40,40^FDOla Mundo^FS' },
  { title: 'Linha horizontal', code: '^FO{x},{y}^GB{comp},{esp},{esp}^FS', example: '^FO30,50^GB400,2,2^FS' },
  { title: 'Codigo de barras', code: '^FO{x},{y}^BY{larg},3,{alt}^BCN...^FD{dados}^FS', example: '^FO30,200^BY2,3,80^BCN,80,Y,N,N^FD123456^FS' },
  { title: 'QR Code', code: '^FO{x},{y}^BQN,2,{tam}^FDQA,{dados}^FS', example: '^FO600,200^BQN,2,4^FDQA,https://site.com^FS' },
];

const DPL_REFERENCE = [
  { title: 'Tamanho da fonte', code: '1A{f}{r}{x:4}{y:4}{h:3}{texto}', example: 'h=025 (pequena)  h=050 (media)  h=080 (grande)' },
  { title: 'Posicao (X,Y)', code: 'x:4 e y:4 no campo 1A', example: 'x: direita(+)  y: baixo(+) — ex: 1A1000500100040Texto' },
  { title: 'Altura etiqueta', code: 'H{dots:4}', example: 'H0406 (5cm)  H0812 (10cm)  1cm = 80 dots' },
  { title: 'Largura etiqueta', code: 'c{polegadas}', example: 'c4 (10cm)  c6 (15cm)' },
  { title: 'Texto', code: '1A{font}{rot}{x:4}{y:4}{h:3}{texto}', example: '1A1000300020028Minha Empresa' },
  { title: 'Linha horizontal', code: 'LO{x:4}{y:4}{comp:4}{esp:3}', example: 'LO0030005507520002' },
  { title: 'Codigo de barras', code: '1B{rot}{tipo:2}{x:4}{y:4}{h:3}{narrow}{dados}', example: '1B1020030020508007891234567890' },
  { title: 'Mover p/ cima', code: 'Diminuir o valor Y', example: 'y=0100 → y=0050 (subiu 50 dots)' },
  { title: 'Mover p/ baixo', code: 'Aumentar o valor Y', example: 'y=0050 → y=0150 (desceu 100 dots)' },
  { title: 'Mover p/ esquerda', code: 'Diminuir o valor X', example: 'x=0300 → x=0100 (moveu esquerda)' },
  { title: 'Mover p/ direita', code: 'Aumentar o valor X', example: 'x=0100 → x=0400 (moveu direita)' },
];

// Common label sizes in cm
const LABEL_PRESETS = [
  { label: '10x5', w: 10, h: 5 },
  { label: '10x8', w: 10, h: 8 },
  { label: '10x15', w: 10, h: 15 },
  { label: '8x5', w: 8, h: 5 },
  { label: '5x2.5', w: 5, h: 2.5 },
];

export const LabelPrinterTool: React.FC<LabelPrinterToolProps> = () => {
  const [printerType, setPrinterType] = useState<PrinterType>('zebra');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('9100');
  const [code, setCode] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [labelWidthCm, setLabelWidthCm] = useState(10);
  const [labelHeightCm, setLabelHeightCm] = useState(5);
  const [showRef, setShowRef] = useState(false);
  const [elements, setElements] = useState<ParsedElement[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'raw'>('raw');
  const [nudgeStep, setNudgeStep] = useState(10);
  const codeFromVisualRef = useRef(false);
  const previewPendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Sync code -> elements (only when code changes from non-visual source)
  useEffect(() => {
    if (codeFromVisualRef.current) {
      codeFromVisualRef.current = false;
      return;
    }
    if (!code.trim()) {
      setElements([]);
      setSelectedIndex(null);
      return;
    }
    const parsed = printerType === 'zebra'
      ? parseZplElements(code)
      : parseDplElements(code);
    setElements(parsed);
    if (selectedIndex !== null && selectedIndex >= parsed.length) {
      setSelectedIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, printerType]);

  const handlePropertyChange = useCallback((field: keyof ParsedElement, value: number | string | null) => {
    if (selectedIndex === null) return;
    setElements(prev => {
      const updated = [...prev];
      const el = { ...updated[selectedIndex], [field]: value };
      el.raw = printerType === 'zebra' ? elementToZpl(el) : elementToDpl(el);
      updated[selectedIndex] = el;
      const newCode = printerType === 'zebra'
        ? reassembleZpl(updated)
        : reassembleDpl(updated);
      codeFromVisualRef.current = true;
      previewPendingRef.current = true;
      setCode(newCode);
      return updated;
    });
  }, [selectedIndex, printerType]);

  const handleNudge = useCallback((axis: 'x' | 'y', delta: number) => {
    if (selectedIndex === null) return;
    const el = elements[selectedIndex];
    if (el.x === null && el.y === null) return;
    const current = axis === 'x' ? (el.x ?? 0) : (el.y ?? 0);
    handlePropertyChange(axis, Math.max(0, current + delta));
  }, [selectedIndex, elements, handlePropertyChange]);

  const KIND_ICON: Record<ElementKind, React.ReactNode> = {
    text: <Type size={13} />,
    barcode: <BarChart3 size={13} />,
    qrcode: <QrCode size={13} />,
    line: <Minus size={13} />,
    config: <Settings size={13} />,
    unknown: <Info size={13} />,
  };

  const handleInsertTemplate = useCallback(async () => {
    const wDots = cmToDots(labelWidthCm);
    const hDots = cmToDots(labelHeightCm);
    const template = printerType === 'zebra'
      ? buildZplTemplate(wDots, hDots)
      : buildDplTemplate(wDots, hDots);
    setCode(template);
    setPreviewUrl(null);
    setPreviewError(null);
    setEditorMode('visual');
    setSelectedIndex(null);

    if (printerType === 'zebra') {
      setPreviewLoading(true);
      try {
        const url = await fetchZplPreview(template, labelWidthCm, labelHeightCm);
        setPreviewUrl(url);
      } catch (err) {
        setPreviewError(`Falha ao gerar preview: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      const url = renderDplToCanvas(template);
      if (url) setPreviewUrl(url);
    }
  }, [printerType, labelWidthCm, labelHeightCm, previewUrl]);

  const handlePreview = useCallback(async () => {
    if (!code.trim()) return;

    setPreviewError(null);
    const oldUrl = previewUrl;

    if (printerType === 'datamax') {
      const url = renderDplToCanvas(code);
      if (url) {
        setPreviewUrl(url);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      }
      return;
    }

    setPreviewLoading(true);
    try {
      const url = await fetchZplPreview(code, labelWidthCm, labelHeightCm);
      setPreviewUrl(url);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
    } catch (err) {
      setPreviewError(`Falha ao gerar preview: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [code, printerType, labelWidthCm, labelHeightCm, previewUrl]);

  // Recarrega preview automaticamente quando dimensoes mudam e ja existe preview
  useEffect(() => {
    if (!code.trim() || !previewUrl) return;
    handlePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelWidthCm, labelHeightCm]);

  // Recarrega preview quando codigo muda pelo editor visual
  useEffect(() => {
    if (!previewPendingRef.current) return;
    previewPendingRef.current = false;
    if (!code.trim()) return;
    handlePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handlePrint = async () => {
    if (!code.trim()) return;
    if (!ip.trim()) return;

    setPrintStatus('sending');

    try {
      // Impressoras de etiquetas (Zebra/Datamax porta 9100) recebem dados raw
      // e nao retornam resposta HTTP. Usamos timeout curto — se o POST foi
      // aceito pela rede (sem connection refused), os bytes chegaram.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      await safeFetch(`http://${ip.trim()}:${port}`, {
        method: 'POST',
        body: code,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      setPrintStatus('sent');
    } catch (err) {
      const msg = String(err).toLowerCase();
      const refused =
        msg.includes('refused') ||
        msg.includes('econnrefused') ||
        msg.includes('connection refused') ||
        msg.includes('failed to fetch') ||
        msg.includes('network');
      // Abort/timeout = bytes provavelmente chegaram (impressora nao responde)
      setPrintStatus(refused ? 'unreachable' : 'sent');
    }

    setTimeout(() => setPrintStatus('idle'), 4000);
  };

  const handleClear = () => {
    setCode('');
    setPreviewUrl(null);
    setPreviewError(null);
    setPrintStatus('idle');
    setElements([]);
    setSelectedIndex(null);
  };

  const refData = printerType === 'zebra' ? ZPL_REFERENCE : DPL_REFERENCE;
  const canPrint = code.trim() && ip.trim() && printStatus !== 'sending';
  const canPreview = code.trim() && !previewLoading;
  const isPresetActive = (p: typeof LABEL_PRESETS[0]) => labelWidthCm === p.w && labelHeightCm === p.h;

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '20px',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Top bar: Printer type + Connection ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0',
        border: '1.5px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden',
      }}>
        {/* Printer tabs + IP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {(['zebra', 'datamax'] as PrinterType[]).map((type) => (
            <button
              key={type}
              onClick={() => { setPrinterType(type); setPreviewUrl(null); setPreviewError(null); setCode(''); }}
              style={{
                padding: '10px 18px', border: 'none', borderRight: '1px solid var(--border-color)',
                backgroundColor: printerType === type ? 'var(--bg-panel)' : 'var(--bg-deep)',
                color: printerType === type ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                letterSpacing: '0.3px',
                borderBottom: printerType === type ? '2px solid var(--accent-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {type === 'zebra' ? 'ZEBRA (ZPL)' : 'DATAMAX (DPL)'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px' }}>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.100"
              style={{
                width: '140px', padding: '6px 10px', backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>:</span>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              style={{
                width: '50px', padding: '6px 8px', backgroundColor: 'transparent',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px',
                textAlign: 'center', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Label dimensions strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px',
          backgroundColor: 'var(--bg-deep)', borderTop: '1px solid var(--border-color)',
          fontSize: '11px',
        }}>
          <span style={{ fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', fontSize: '9px' }}>
            Etiqueta
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              value={labelWidthCm}
              onChange={(e) => setLabelWidthCm(Math.max(1, parseFloat(e.target.value) || 1))}
              step={0.5} min={1} max={30}
              style={{
                width: '46px', padding: '3px 4px', backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '11px', textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>x</span>
            <input
              type="number"
              value={labelHeightCm}
              onChange={(e) => setLabelHeightCm(Math.max(1, parseFloat(e.target.value) || 1))}
              step={0.5} min={1} max={30}
              style={{
                width: '46px', padding: '3px 4px', backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '11px', textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>cm</span>
          </div>
          <span style={{
            fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '2px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '4px',
          }}>
            {cmToDots(labelWidthCm)}x{cmToDots(labelHeightCm)} dots
          </span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {LABEL_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setLabelWidthCm(p.w); setLabelHeightCm(p.h); }}
                style={chip(isPresetActive(p))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar: Actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 8px', backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <button
          onClick={handleInsertTemplate}
          disabled={previewLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
            backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px',
            color: previewLoading ? 'var(--text-muted)' : 'var(--accent-primary)',
            cursor: previewLoading ? 'not-allowed' : 'pointer',
            fontSize: '11px', fontWeight: '700',
          }}
        >
          <Printer size={12} />
          {previewLoading ? 'Carregando...' : 'Inserir exemplo'}
        </button>
        <button
          onClick={handlePreview}
          disabled={!canPreview}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px',
            backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px',
            color: !canPreview ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: !canPreview ? 'not-allowed' : 'pointer',
            fontSize: '11px', fontWeight: '600',
          }}
        >
          <Eye size={12} />
          {previewLoading ? 'Gerando...' : 'Visualizar'}
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setShowRef(!showRef)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
            backgroundColor: showRef ? 'rgba(var(--accent-primary-rgb, 59,130,246),0.1)' : 'transparent',
            border: `1px solid ${showRef ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '6px',
            color: showRef ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '11px', fontWeight: '600',
          }}
        >
          <Info size={11} /> Ref
        </button>

        {code && (
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '30px', height: '30px',
              backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px',
              color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = 'rgb(239,68,68)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Trash2 size={12} />
          </button>
        )}

        <button
          onClick={handlePrint}
          disabled={!canPrint}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 16px',
            backgroundColor: canPrint ? 'var(--accent-primary)' : 'var(--bg-panel)',
            border: `1px solid ${canPrint ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '6px',
            color: canPrint ? 'white' : 'var(--text-muted)',
            cursor: canPrint ? 'pointer' : 'not-allowed',
            fontSize: '11px', fontWeight: '700',
          }}
        >
          {printStatus === 'sending' ? <Printer size={12} /> : <Send size={12} />}
          {printStatus === 'sending' ? 'Enviando...' : 'Imprimir'}
        </button>
      </div>

      {/* ── Print Status ── */}
      {printStatus === 'sent' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
          color: 'rgb(34,197,94)', fontSize: '12px', fontWeight: '600',
        }}>
          <CheckCircle2 size={14} />
          Comando enviado para a impressora
        </div>
      )}
      {printStatus === 'unreachable' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: '12px', fontWeight: '600',
        }}>
          <WifiOff size={14} />
          Impressora inacessivel - verifique IP e se esta ligada
        </div>
      )}
      {previewError && (
        <div style={{
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: '11px',
        }}>
          {previewError}
        </div>
      )}

      {/* ── Code + Preview side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '1fr 1fr' : '1fr', gap: '10px' }}>
        {/* Code editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Header bar with mode toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 10px',
            backgroundColor: 'var(--bg-deep)',
            borderRadius: '8px 8px 0 0',
            border: '1px solid var(--border-color)', borderBottom: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>
                {printerType === 'zebra' ? 'ZPL' : 'DPL'}
              </span>
              {code && (
                <span style={{
                  fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                  padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                }}>
                  {code.split('\n').length} linhas
                </span>
              )}
            </div>
            {/* Visual / Codigo toggle */}
            {code && (
              <div style={{ display: 'flex', gap: '0', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {(['visual', 'raw'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setEditorMode(mode); if (mode === 'visual') setSelectedIndex(null); }}
                    style={{
                      padding: '2px 10px', border: 'none', fontSize: '9px', fontWeight: '700',
                      letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
                      backgroundColor: editorMode === mode ? 'var(--accent-primary)' : 'var(--bg-panel)',
                      color: editorMode === mode ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode === 'visual' ? 'Visual' : 'Codigo'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Raw textarea mode */}
          {editorMode === 'raw' && (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={printerType === 'zebra' ? '^XA\n^PW812\n^LL406\n^FO30,20^A0N,28,28^FDTexto^FS\n^XZ' : '\x02L\nD11\nH0406\nc4\n1A100030002002 8Texto\nE'}
              spellCheck={false}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '0 0 8px 8px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                minHeight: '380px',
                resize: 'vertical',
                fontWeight: '500',
                lineHeight: '1.6',
                outline: 'none',
                tabSize: 2,
              }}
            />
          )}

          {/* Visual editor mode */}
          {editorMode === 'visual' && code && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedIndex !== null ? '1fr 260px' : '1fr',
              minHeight: '380px',
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
            }}>
              {/* Element list */}
              <div style={{
                overflowY: 'auto', maxHeight: '500px',
                backgroundColor: 'var(--bg-panel)',
                borderRight: selectedIndex !== null ? '1px solid var(--border-color)' : 'none',
              }}>
                {elements.map((el, i) => {
                  const selected = selectedIndex === i;
                  const isStructural = el.kind === 'config' && (el.configKey === 'STX' || el.configKey === 'ETX');
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedIndex(selected ? null : i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 10px',
                        cursor: 'pointer',
                        backgroundColor: selected ? 'rgba(59,130,246,0.08)' : 'transparent',
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: selected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0,
                        backgroundColor: selected ? 'rgba(59,130,246,0.12)' : 'var(--bg-deep)',
                        color: selected ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}>
                        {KIND_ICON[el.kind]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '11px', fontWeight: '600',
                          color: isStructural ? 'var(--text-muted)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {getElementLabel(el)}
                        </div>
                      </div>
                      {el.x !== null && (
                        <span style={{
                          fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                          padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                          flexShrink: 0,
                        }}>
                          {el.x},{el.y ?? 0}
                        </span>
                      )}
                    </div>
                  );
                })}
                {elements.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Nenhum elemento encontrado
                  </div>
                )}
              </div>

              {/* Property panel */}
              {selectedIndex !== null && selectedIndex < elements.length && (() => {
                const el = elements[selectedIndex];
                const isStructural = el.kind === 'config' && (el.configKey === 'STX' || el.configKey === 'ETX');

                const fieldLabel: React.CSSProperties = {
                  fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px',
                };
                const fieldInput: React.CSSProperties = {
                  width: '100%', padding: '5px 8px', backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-color)', borderRadius: '5px',
                  color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '11px',
                  outline: 'none',
                };
                const numInput: React.CSSProperties = {
                  ...fieldInput, width: '70px', textAlign: 'center' as const,
                };
                const nudgeBtn: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', border: '1px solid var(--border-color)',
                  borderRadius: '4px', backgroundColor: 'var(--bg-deep)', color: 'var(--text-muted)',
                  cursor: 'pointer', flexShrink: 0,
                };

                return (
                  <div style={{
                    padding: '10px', backgroundColor: 'var(--bg-panel)',
                    overflowY: 'auto', maxHeight: '500px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px', borderRadius: '4px',
                          backgroundColor: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)',
                        }}>
                          {KIND_ICON[el.kind]}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {el.kind === 'text' ? 'Texto' : el.kind === 'barcode' ? 'Barcode' : el.kind === 'qrcode' ? 'QR Code' : el.kind === 'line' ? 'Separador' : el.kind === 'config' ? 'Config' : 'Elemento'}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedIndex(null)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px', border: 'none', borderRadius: '4px',
                          backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {isStructural && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Marcador de {el.configKey === 'STX' ? 'inicio' : 'fim'} (nao editavel)
                      </div>
                    )}

                    {/* Content field */}
                    {(el.kind === 'text' || el.kind === 'barcode' || el.kind === 'qrcode') && (
                      <div>
                        <div style={fieldLabel}>{el.kind === 'text' ? 'Conteudo' : 'Dados'}</div>
                        <input
                          type="text"
                          value={el.data ?? ''}
                          onChange={(e) => handlePropertyChange('data', e.target.value)}
                          style={fieldInput}
                        />
                      </div>
                    )}

                    {/* Config value */}
                    {el.kind === 'config' && isEditableConfig(el) && (
                      <div>
                        <div style={fieldLabel}>Valor</div>
                        <input
                          type="text"
                          value={el.configValue ?? ''}
                          onChange={(e) => handlePropertyChange('configValue', e.target.value)}
                          style={fieldInput}
                        />
                      </div>
                    )}

                    {/* Position X/Y with nudge */}
                    {el.x !== null && (
                      <>
                        <div>
                          <div style={fieldLabel}>Posicao X</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button style={nudgeBtn} onClick={() => handleNudge('x', -nudgeStep)}><ChevronLeft size={12} /></button>
                            <input
                              type="number"
                              value={el.x ?? 0}
                              onChange={(e) => handlePropertyChange('x', Math.max(0, parseInt(e.target.value) || 0))}
                              style={numInput}
                            />
                            <button style={nudgeBtn} onClick={() => handleNudge('x', nudgeStep)}><ChevronRight size={12} /></button>
                          </div>
                        </div>
                        <div>
                          <div style={fieldLabel}>Posicao Y</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button style={nudgeBtn} onClick={() => handleNudge('y', -nudgeStep)}><ChevronUp size={12} /></button>
                            <input
                              type="number"
                              value={el.y ?? 0}
                              onChange={(e) => handlePropertyChange('y', Math.max(0, parseInt(e.target.value) || 0))}
                              style={numInput}
                            />
                            <button style={nudgeBtn} onClick={() => handleNudge('y', nudgeStep)}><ChevronDown size={12} /></button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Font size + bold for text */}
                    {el.kind === 'text' && (() => {
                      const isBold = printerType === 'zebra'
                        ? (el.fontWidth ?? 0) > (el.fontHeight ?? 0)
                        : (el.fontId ?? 1) >= 5;
                      const toggleBold = () => {
                        if (printerType === 'zebra') {
                          const h = el.fontHeight ?? 28;
                          handlePropertyChange('fontWidth', isBold ? h : Math.round(h * 1.5));
                        } else {
                          handlePropertyChange('fontId', isBold ? 1 : 5);
                        }
                      };
                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div>
                              <div style={fieldLabel}>Fonte H</div>
                              <input
                                type="number"
                                value={el.fontHeight ?? 28}
                                onChange={(e) => handlePropertyChange('fontHeight', Math.max(8, parseInt(e.target.value) || 8))}
                                min={8} step={2}
                                style={numInput}
                              />
                            </div>
                            {printerType === 'zebra' && (
                              <div>
                                <div style={fieldLabel}>Fonte W</div>
                                <input
                                  type="number"
                                  value={el.fontWidth ?? 28}
                                  onChange={(e) => handlePropertyChange('fontWidth', Math.max(8, parseInt(e.target.value) || 8))}
                                  min={8} step={2}
                                  style={numInput}
                                />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={fieldLabel}>Estilo</div>
                            <button
                              onClick={toggleBold}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', fontSize: '11px', fontWeight: isBold ? '800' : '500',
                                cursor: 'pointer',
                                backgroundColor: isBold ? 'rgba(59,130,246,0.1)' : 'transparent',
                                border: `1px solid ${isBold ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                borderRadius: '5px',
                                color: isBold ? 'var(--accent-primary)' : 'var(--text-muted)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span style={{ fontWeight: '800', fontSize: '13px' }}>B</span>
                              {isBold ? 'Negrito' : 'Normal'}
                            </button>
                            {printerType === 'zebra' && (
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                ZPL: negrito = largura {'>'} altura da fonte
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Barcode fields */}
                    {el.kind === 'barcode' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <div style={fieldLabel}>Altura</div>
                          <input
                            type="number"
                            value={el.barcodeHeight ?? 80}
                            onChange={(e) => handlePropertyChange('barcodeHeight', Math.max(10, parseInt(e.target.value) || 10))}
                            min={10} step={5}
                            style={numInput}
                          />
                        </div>
                        <div>
                          <div style={fieldLabel}>Modulo</div>
                          <input
                            type="number"
                            value={el.barcodeModuleWidth ?? 2}
                            onChange={(e) => handlePropertyChange('barcodeModuleWidth', Math.max(1, parseInt(e.target.value) || 1))}
                            min={1} max={10}
                            style={numInput}
                          />
                        </div>
                      </div>
                    )}

                    {/* QR size */}
                    {el.kind === 'qrcode' && (
                      <div>
                        <div style={fieldLabel}>Tamanho</div>
                        <input
                          type="number"
                          value={el.qrSize ?? 4}
                          onChange={(e) => handlePropertyChange('qrSize', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          min={1} max={10}
                          style={numInput}
                        />
                      </div>
                    )}

                    {/* Line fields */}
                    {el.kind === 'line' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <div style={fieldLabel}>Comprimento</div>
                          <input
                            type="number"
                            value={el.lineLength ?? 100}
                            onChange={(e) => handlePropertyChange('lineLength', Math.max(1, parseInt(e.target.value) || 1))}
                            min={1} step={10}
                            style={numInput}
                          />
                        </div>
                        <div>
                          <div style={fieldLabel}>Espessura</div>
                          <input
                            type="number"
                            value={el.lineThickness ?? 2}
                            onChange={(e) => handlePropertyChange('lineThickness', Math.max(1, parseInt(e.target.value) || 1))}
                            min={1} max={20}
                            style={numInput}
                          />
                        </div>
                      </div>
                    )}

                    {/* Nudge step selector */}
                    {el.x !== null && (
                      <div>
                        <div style={fieldLabel}>Passo</div>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {[5, 10, 25, 50].map((step) => (
                            <button
                              key={step}
                              onClick={() => setNudgeStep(step)}
                              style={{
                                padding: '3px 8px', fontSize: '10px', fontWeight: '600',
                                fontFamily: 'monospace', cursor: 'pointer',
                                backgroundColor: nudgeStep === step ? 'var(--accent-primary)' : 'transparent',
                                border: `1px solid ${nudgeStep === step ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                borderRadius: '12px',
                                color: nudgeStep === step ? 'white' : 'var(--text-muted)',
                              }}
                            >
                              {step}
                            </button>
                          ))}
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '2px' }}>dots</span>
                        </div>
                      </div>
                    )}

                    {/* Unknown element: show raw */}
                    {el.kind === 'unknown' && (
                      <div>
                        <div style={fieldLabel}>Codigo bruto</div>
                        <div style={{
                          padding: '6px 8px', backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-color)', borderRadius: '5px',
                          fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)',
                          wordBreak: 'break-all',
                        }}>
                          {el.raw}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Visual mode but no code */}
          {editorMode === 'visual' && !code && (
            <div style={{
              minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px',
              backgroundColor: 'var(--bg-panel)', color: 'var(--text-muted)', fontSize: '11px',
            }}>
              Insira um exemplo para usar o editor visual
            </div>
          )}
        </div>

        {/* Preview panel */}
        {previewUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 10px',
              backgroundColor: 'var(--bg-deep)',
              borderRadius: '8px 8px 0 0',
              border: '1px solid var(--border-color)', borderBottom: 'none',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
                letterSpacing: '1px', textTransform: 'uppercase',
              }}>
                Preview
              </span>
              <span style={{
                fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {printerType === 'zebra' ? 'Labelary API' : 'Local'}
              </span>
            </div>
            <div style={{
              flex: 1, minHeight: '380px',
              padding: '16px',
              backgroundColor: '#e8e4df',
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
              backgroundSize: '12px 12px',
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                borderRadius: '2px', padding: '4px',
                maxWidth: '100%',
              }}>
                <img
                  src={previewUrl}
                  alt="Preview da etiqueta"
                  style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Reference Guide ── */}
      {showRef && (
        <div style={{
          border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden',
        }}>
          <div style={{
            padding: '7px 12px', backgroundColor: 'var(--bg-deep)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', color: 'var(--accent-primary)',
              textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              Referencia {printerType === 'zebra' ? 'ZPL' : 'DPL'}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              1cm = 80 dots | 203 dpi
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {refData.map((item, i) => (
              <div key={i} style={{
                padding: '6px 10px', fontSize: '11px',
                borderBottom: '1px solid var(--border-color)',
                borderRight: i % 2 === 0 ? '1px solid var(--border-color)' : 'none',
                display: 'flex', flexDirection: 'column', gap: '2px',
              }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '10px' }}>
                  {item.title}
                </div>
                <code style={{
                  fontFamily: 'monospace', fontSize: '10px', color: 'var(--accent-primary)',
                  backgroundColor: 'var(--bg-deep)', padding: '2px 5px', borderRadius: '3px',
                  display: 'inline-block', width: 'fit-content',
                }}>
                  {item.code}
                </code>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px', lineHeight: '1.4' }}>
                  {item.example}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!code && !showRef && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Printer size={24} style={{ opacity: 0.4 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Impressora de Etiquetas
          </div>
          <div style={{ fontSize: '12px' }}>
            Insira um exemplo ou escreva codigo {printerType === 'zebra' ? 'ZPL' : 'DPL'} para visualizar e imprimir
          </div>
        </div>
      )}
    </div>
  );
};
