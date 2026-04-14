import React, { useState, useRef, useCallback } from 'react';
import { Download, Copy, Layers, Barcode, Trash2, AlertCircle } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  onBack?: () => void;
}

type BarcodeFormat = 'CODE128' | 'EAN13' | 'CODE39' | 'EAN8' | 'UPCA' | 'ITF14';

interface BarcodeResult {
  text: string;
  svgMarkup: string | null;
  error: string | null;
}

const FORMATS: { id: BarcodeFormat; label: string; hint: string }[] = [
  { id: 'CODE128', label: 'CODE128', hint: 'Qualquer texto' },
  { id: 'EAN13', label: 'EAN-13', hint: '13 digitos' },
  { id: 'EAN8', label: 'EAN-8', hint: '8 digitos' },
  { id: 'UPCA', label: 'UPC-A', hint: '12 digitos' },
  { id: 'CODE39', label: 'CODE39', hint: 'A-Z, 0-9, - . espaco' },
  { id: 'ITF14', label: 'ITF-14', hint: '14 digitos' },
];

function validateLine(input: string, fmt: BarcodeFormat): string | null {
  if (!input.trim()) return 'Vazio';
  switch (fmt) {
    case 'EAN13':
      if (!/^\d+$/.test(input)) return 'Apenas digitos';
      if (input.length !== 13) return `Requer 13 digitos (${input.length})`;
      break;
    case 'EAN8':
      if (!/^\d+$/.test(input)) return 'Apenas digitos';
      if (input.length !== 8) return `Requer 8 digitos (${input.length})`;
      break;
    case 'UPCA':
      if (!/^\d+$/.test(input)) return 'Apenas digitos';
      if (input.length !== 12) return `Requer 12 digitos (${input.length})`;
      break;
    case 'ITF14':
      if (!/^\d+$/.test(input)) return 'Apenas digitos';
      if (input.length !== 14) return `Requer 14 digitos (${input.length})`;
      break;
    case 'CODE39':
      if (!/^[A-Z0-9\-. ]*$/i.test(input)) return 'Caracteres invalidos';
      break;
    case 'CODE128':
      if (input.length > 100) return 'Muito longo (max 100)';
      break;
  }
  return null;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = () => {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [height, setHeight] = useState(80);
  const [results, setResults] = useState<BarcodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const tempSvgRef = useRef<SVGSVGElement>(null);

  const lineCount = input.split('\n').filter(l => l.trim()).length;

  const generateBarcode = useCallback((text: string): BarcodeResult => {
    const validationError = validateLine(text, format);
    if (validationError) return { text, svgMarkup: null, error: validationError };

    try {
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      JsBarcode(svg, text, {
        format,
        width: 2,
        height,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
      });
      const markup = new XMLSerializer().serializeToString(svg);
      return { text, svgMarkup: markup, error: null };
    } catch (err) {
      return { text, svgMarkup: null, error: err instanceof Error ? err.message : 'Erro' };
    }
  }, [format, height]);

  const handleGenerate = () => {
    const lines = input.split('\n').filter(l => l.trim());
    if (!lines.length) return;
    setLoading(true);
    const res = lines.map(line => generateBarcode(line.trim()));
    setResults(res);
    setLoading(false);
  };

  const handleDownload = (svgMarkup: string, label: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `barcode-${format}-${label.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
  };

  const handleCopySvg = async (svgMarkup: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(svgMarkup);
      setCopySuccess(idx);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const activeFormat = FORMATS.find(f => f.id === format)!;

  // ─── Styles ─────────────────────────────

  const fieldLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  const formatPill = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
    letterSpacing: '0.3px',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '20px',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  });

  const actionBtn = (variant: 'primary' | 'ghost' | 'success'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
    padding: '7px 14px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
    borderRadius: '6px', transition: 'all 0.15s ease',
    ...(variant === 'primary' ? {
      backgroundColor: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', color: 'white',
    } : variant === 'success' ? {
      backgroundColor: 'rgb(34,197,94)', border: '1px solid rgb(34,197,94)', color: 'white',
    } : {
      backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
    }),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Hidden SVG for rendering */}
      <svg ref={tempSvgRef} style={{ display: 'none' }} />

      {/* ── Header: Format pills ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {FORMATS.map(f => (
          <button key={f.id} style={formatPill(format === f.id)} onClick={() => setFormat(f.id)}>
            {f.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

        {/* Height */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={fieldLabel}>Altura</span>
          <input
            type="range" min="40" max="200" step="10" value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: '70px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <span style={{
            fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '2px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '4px',
            minWidth: '32px', textAlign: 'center',
          }}>
            {height}
          </span>
        </div>
      </div>

      {/* ── Format hint ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '0 4px',
      }}>
        <AlertCircle size={11} style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {activeFormat.label}: {activeFormat.hint}
        </span>
      </div>

      {/* ── Input area ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div style={{
          padding: '5px 10px', backgroundColor: 'var(--bg-deep)',
          borderRadius: '8px 8px 0 0',
          border: '1px solid var(--border-color)', borderBottom: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
            letterSpacing: '1px', textTransform: 'uppercase',
          }}>
            Textos (um por linha)
          </span>
          {input && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--accent-primary)',
              padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              fontWeight: '600',
            }}>
              {lineCount} {lineCount === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={format === 'EAN13' ? '7891234567890\n7894561237890' :
            format === 'EAN8' ? '78912345\n12345678' :
            format === 'UPCA' ? '012345678905\n789456123789' :
            format === 'ITF14' ? '00012345678905\n10012345678902' :
            format === 'CODE39' ? 'ABC-123\nPRODUCT.456' :
            'SKU-001\nhttps://exemplo.com\nProduto ABC'}
          spellCheck={false}
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
            minHeight: '100px',
            resize: 'vertical',
            lineHeight: '1.6',
            outline: 'none',
          }}
        />
      </div>

      {/* ── Generate button ── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleGenerate}
          disabled={!input.trim() || loading}
          style={{
            ...actionBtn(!input.trim() || loading ? 'ghost' : 'primary'),
            cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
            flex: 1,
          }}
        >
          <Layers size={12} />
          {loading ? 'Gerando...' : `Gerar ${lineCount} Barcode${lineCount !== 1 ? 's' : ''}`}
        </button>
        {results.length > 0 && (
          <button onClick={() => setResults([])} style={actionBtn('ghost')}>
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* ── Results ── */}
      {results.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 0',
          }}>
            <span style={fieldLabel}>Resultados</span>
            <span style={{
              fontSize: '10px', fontWeight: '600',
              color: results.every(r => r.svgMarkup) ? 'rgb(34,197,94)' : 'var(--text-muted)',
            }}>
              {results.filter(r => r.svgMarkup).length}/{results.length} gerados
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map((result, idx) => (
              <div key={idx} style={{
                display: 'flex', flexDirection: 'column',
                border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                borderRadius: '8px', overflow: 'hidden',
                backgroundColor: 'var(--bg-panel)',
              }}>
                {result.svgMarkup ? (
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f5f3f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'auto',
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0)',
                    backgroundSize: '8px 8px',
                  }}>
                    <div
                      dangerouslySetInnerHTML={{ __html: result.svgMarkup }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '16px', display: 'flex', alignItems: 'center', gap: '8px',
                    backgroundColor: 'rgba(239,68,68,0.04)',
                    color: 'var(--danger)', fontSize: '11px', fontWeight: '600',
                  }}>
                    <AlertCircle size={13} />
                    {result.error}
                  </div>
                )}
                <div style={{
                  padding: '6px 10px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{
                    fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
                    padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                    letterSpacing: '0.3px',
                  }}>
                    {format}
                  </span>
                  <span style={{
                    flex: 1, fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={result.text}>
                    {result.text}
                  </span>
                  {result.svgMarkup && (
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleCopySvg(result.svgMarkup!, idx)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', border: 'none', borderRadius: '4px',
                          backgroundColor: copySuccess === idx ? 'rgb(34,197,94)' : 'transparent',
                          color: copySuccess === idx ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Copiar SVG"
                        onMouseEnter={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleDownload(result.svgMarkup!, result.text)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', border: 'none', borderRadius: '4px',
                          backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                        title="Download PNG"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!input && results.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Barcode size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Gerador de Barcode
          </div>
          <div>Escolha o formato, digite um ou mais textos e clique em Gerar</div>
        </div>
      )}
    </div>
  );
};
