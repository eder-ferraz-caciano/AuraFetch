import React, { useState } from 'react';
import { Download, Copy, Layers, QrCode, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  onBack?: () => void;
}

interface BatchResult {
  text: string;
  dataUrl: string | null;
  error: string | null;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);

  // Settings
  const [size, setSize] = useState(300);
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');

  const lineCount = input.split('\n').filter(l => l.trim()).length;

  const handleGenerate = async () => {
    const lines = input.split('\n').filter(l => l.trim());
    if (!lines.length) return;
    setLoading(true);
    const res = await Promise.all(
      lines.map(async (line): Promise<BatchResult> => {
        try {
          const dataUrl = await QRCode.toDataURL(line.trim(), {
            errorCorrectionLevel: 'H',
            width: size,
            margin: 1,
            color: { dark: darkColor, light: lightColor },
          });
          return { text: line.trim(), dataUrl, error: null };
        } catch {
          return { text: line.trim(), dataUrl: null, error: 'Invalido' };
        }
      })
    );
    setResults(res);
    setLoading(false);
  };

  const handleDownload = (dataUrl: string, label?: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = label ? `qr-${label.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` : `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyBase64 = async (dataUrl: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(dataUrl);
      setCopySuccess(idx);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  // ─── Styles ─────────────────────────────

  const fieldLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };

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

      {/* ── Header: Size + Colors ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {/* Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={fieldLabel}>Tamanho</span>
          <input
            type="range" min="100" max="500" step="10" value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <span style={{
            fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '2px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '4px',
            minWidth: '36px', textAlign: 'center',
          }}>
            {size}
          </span>
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }} />

        {/* Colors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={fieldLabel}>Cor</span>
          <input
            type="color" value={darkColor}
            onChange={(e) => setDarkColor(e.target.value)}
            style={{
              width: '24px', height: '24px', border: '2px solid var(--border-color)',
              borderRadius: '50%', cursor: 'pointer', padding: 0,
            }}
          />
          <span style={fieldLabel}>Fundo</span>
          <input
            type="color" value={lightColor}
            onChange={(e) => setLightColor(e.target.value)}
            style={{
              width: '24px', height: '24px', border: '2px solid var(--border-color)',
              borderRadius: '50%', cursor: 'pointer', padding: 0,
            }}
          />
        </div>
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
          placeholder={'https://exemplo.com\nhttps://google.com\nTexto qualquer'}
          spellCheck={false}
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
            minHeight: '120px',
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
          {loading ? 'Gerando...' : `Gerar ${lineCount} QR Code${lineCount !== 1 ? 's' : ''}`}
        </button>
        {results.length > 0 && (
          <button onClick={() => setResults([])} style={actionBtn('ghost')}>
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* ── Results grid ── */}
      {results.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 0',
          }}>
            <span style={fieldLabel}>Resultados</span>
            <span style={{
              fontSize: '10px', fontWeight: '600', color: 'rgb(34,197,94)',
            }}>
              {results.filter(r => r.dataUrl).length}/{results.length} gerados
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '8px',
          }}>
            {results.map((result, idx) => (
              <div key={idx} style={{
                display: 'flex', flexDirection: 'column', gap: '0',
                border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                borderRadius: '8px', overflow: 'hidden',
                backgroundColor: 'var(--bg-panel)',
              }}>
                {result.dataUrl ? (
                  <div style={{
                    padding: '10px',
                    backgroundColor: lightColor === '#ffffff' ? '#f5f3f0' : 'var(--bg-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={result.dataUrl}
                      alt={`QR ${idx + 1}`}
                      style={{ width: '100%', maxWidth: `${Math.min(size, 200)}px`, height: 'auto', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(239,68,68,0.04)',
                    color: 'var(--danger)', fontSize: '10px', fontWeight: '600',
                  }}>
                    {result.error}
                  </div>
                )}
                <div style={{
                  padding: '6px 8px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <span style={{
                    flex: 1, fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={result.text}>
                    {result.text}
                  </span>
                  {result.dataUrl && (
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleCopyBase64(result.dataUrl!, idx)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                          backgroundColor: copySuccess === idx ? 'rgb(34,197,94)' : 'transparent',
                          color: copySuccess === idx ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Copiar Base64"
                        onMouseEnter={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => handleDownload(result.dataUrl!, result.text)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                          backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                        title="Download PNG"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Download size={11} />
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
            <QrCode size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Gerador de QR Code
          </div>
          <div>Digite um ou mais textos (um por linha) e clique em Gerar</div>
        </div>
      )}
    </div>
  );
};
