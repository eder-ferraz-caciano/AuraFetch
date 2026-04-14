import React, { useState, useEffect } from 'react';
import { Copy, ArrowRightLeft, Hash, Trash2 } from 'lucide-react';

interface Base64ToolProps {
  onBack?: () => void;
}

type Mode = 'encode' | 'decode';

export const Base64Tool: React.FC<Base64ToolProps> = () => {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setError(null);
    if (!input.trim()) { setOutput(''); return; }
    try {
      if (mode === 'encode') {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
    } catch {
      setError(mode === 'decode' ? 'Base64 invalido' : 'Erro ao codificar');
      setOutput('');
    }
  }, [input, mode]);

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch { /* ignore */ }
  };

  const handleSwap = () => {
    if (!output) return;
    const newInput = output;
    setMode(mode === 'encode' ? 'decode' : 'encode');
    setInput(newInput);
  };

  // ─── Styles ─────────────────────────────

  const modePill = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
    letterSpacing: '0.5px', textTransform: 'uppercase',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '20px',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
  });

  const textareaStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '0 0 8px 8px',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    fontSize: '12px',
    minHeight: '160px',
    resize: 'vertical',
    lineHeight: '1.6',
    outline: 'none',
    wordBreak: 'break-all',
  };

  const panelHeader: React.CSSProperties = {
    padding: '5px 10px', backgroundColor: 'var(--bg-deep)',
    borderRadius: '8px 8px 0 0',
    border: '1px solid var(--border-color)', borderBottom: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  const headerLabel: React.CSSProperties = {
    fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
    letterSpacing: '1px', textTransform: 'uppercase',
  };

  const charBadge: React.CSSProperties = {
    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: Mode pills ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <button style={modePill(mode === 'encode')} onClick={() => setMode('encode')}>
          Codificar
        </button>
        <button style={modePill(mode === 'decode')} onClick={() => setMode('decode')}>
          Decodificar
        </button>

        <div style={{ flex: 1 }} />

        {/* Swap */}
        {output && (
          <button
            onClick={handleSwap}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', fontSize: '10px', fontWeight: '700',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)', borderRadius: '20px',
              color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Inverter entrada/saida"
          >
            <ArrowRightLeft size={11} /> Inverter
          </button>
        )}

        {input && (
          <button
            onClick={() => { setInput(''); setOutput(''); setError(null); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '26px', height: '26px', border: '1px solid var(--border-color)',
              borderRadius: '50%', backgroundColor: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--danger)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Limpar"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* ── Side-by-side panels ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}>
        {/* Input panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>
              {mode === 'encode' ? 'Texto' : 'Base64'}
            </span>
            {input && (
              <span style={charBadge}>{input.length} chars</span>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? 'Texto para codificar...' : 'Base64 para decodificar...'}
            spellCheck={false}
            style={textareaStyle}
          />
        </div>

        {/* Output panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>
              {mode === 'encode' ? 'Base64' : 'Texto'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {output && (
                <span style={charBadge}>{output.length} chars</span>
              )}
              {output && (
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                    backgroundColor: copySuccess ? 'rgb(34,197,94)' : 'transparent',
                    color: copySuccess ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={copySuccess ? 'Copiado!' : 'Copiar'}
                  onMouseEnter={(e) => { if (!copySuccess) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (!copySuccess) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
          </div>
          {error ? (
            <div style={{
              ...textareaStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--danger)', fontSize: '11px', fontWeight: '600',
              minHeight: '160px',
              backgroundColor: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              {error}
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              placeholder="Resultado aparece aqui..."
              style={{
                ...textareaStyle,
                cursor: 'default',
                opacity: output ? 1 : 0.5,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      {output && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
          padding: '4px 0',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {mode === 'encode' ? 'Texto' : 'Base64'}: <strong>{input.length}</strong> chars
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>→</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {mode === 'encode' ? 'Base64' : 'Texto'}: <strong>{output.length}</strong> chars
          </span>
          {mode === 'encode' && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--accent-primary)',
              padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
              fontWeight: '600',
            }}>
              +{Math.round(((output.length - input.length) / Math.max(input.length, 1)) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!input && !output && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Hash size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Base64
          </div>
          <div>Converte automaticamente ao digitar</div>
        </div>
      )}
    </div>
  );
};
