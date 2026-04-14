import React, { useState, useEffect } from 'react';
import { Copy, Zap, Trash2 } from 'lucide-react';
import SparkMD5 from 'spark-md5';

interface HashCalculatorProps {
  onBack?: () => void;
}

type Algo = 'md5' | 'sha1' | 'sha256' | 'sha512';

const ALGOS: { id: Algo; label: string; bits: number }[] = [
  { id: 'md5', label: 'MD5', bits: 128 },
  { id: 'sha1', label: 'SHA-1', bits: 160 },
  { id: 'sha256', label: 'SHA-256', bits: 256 },
  { id: 'sha512', label: 'SHA-512', bits: 512 },
];

export const HashCalculator: React.FC<HashCalculatorProps> = () => {
  const [text, setText] = useState('');
  const [useSalt, setUseSalt] = useState(false);
  const [salt, setSalt] = useState('');
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!text) { setHashes({}); return; }

    const input = useSalt ? text + salt : text;
    const map: Record<string, string> = {};

    try { map['md5'] = SparkMD5.hash(input); } catch { map['md5'] = 'Erro'; }

    const compute = async () => {
      try {
        const data = new TextEncoder().encode(input);
        const [s1, s256, s512] = await Promise.all([
          crypto.subtle.digest('SHA-1', data),
          crypto.subtle.digest('SHA-256', data),
          crypto.subtle.digest('SHA-512', data),
        ]);
        const hex = (buf: ArrayBuffer) =>
          Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        map['sha1'] = hex(s1);
        map['sha256'] = hex(s256);
        map['sha512'] = hex(s512);
        setHashes({ ...map });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao calcular');
        setHashes(map);
      }
    };

    setHashes(map);
    compute();
  }, [text, useSalt, salt]);

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const charCount = text.length;
  const byteCount = text ? new TextEncoder().encode(text).length : 0;

  // ─── Styles ─────────────────────────────

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

  const copyBtn = (key: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px', border: 'none', borderRadius: '4px',
    backgroundColor: copySuccess === key ? 'rgb(34,197,94)' : 'transparent',
    color: copySuccess === key ? 'white' : 'var(--text-muted)', cursor: 'pointer',
    transition: 'all 0.15s ease', flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: Salt toggle ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <button
          onClick={() => setUseSalt(!useSalt)}
          style={{
            padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
            letterSpacing: '0.5px', textTransform: 'uppercase',
            backgroundColor: useSalt ? 'var(--accent-primary)' : 'transparent',
            border: `1.5px solid ${useSalt ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '20px',
            color: useSalt ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          Salt
        </button>

        {useSalt && (
          <input
            type="text"
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            placeholder="valor do salt..."
            style={{
              flex: 1, minWidth: '100px', padding: '5px 10px',
              backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)',
              borderRadius: '6px', color: 'var(--text-primary)',
              fontFamily: 'monospace', fontSize: '11px', outline: 'none',
            }}
          />
        )}

        <div style={{ flex: useSalt ? 0 : 1 }} />

        {text && (
          <button
            onClick={() => { setText(''); setSalt(''); setHashes({}); setError(null); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '26px', height: '26px', border: '1px solid var(--border-color)',
              borderRadius: '50%', backgroundColor: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--danger)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* ── Input ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={panelHeader}>
          <span style={headerLabel}>Texto</span>
          {text && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{
                fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {charCount} chars
              </span>
              <span style={{
                fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {byteCount} bytes
              </span>
            </div>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Texto para gerar hashes..."
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

      {/* ── Error ── */}
      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', fontSize: '11px', fontWeight: '600',
        }}>
          {error}
        </div>
      )}

      {/* ── All hashes ── */}
      {Object.keys(hashes).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Hashes</span>
            {useSalt && salt && (
              <span style={{
                fontSize: '9px', fontFamily: 'monospace', color: 'var(--accent-primary)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                fontWeight: '600',
              }}>
                +salt
              </span>
            )}
          </div>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}>
            {ALGOS.map((algo, idx) => {
              const hash = hashes[algo.id] || '';
              if (!hash) return null;
              return (
                <div key={algo.id} style={{
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  padding: '8px 12px',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                  borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: '800', color: 'var(--accent-primary)',
                      fontFamily: 'monospace', minWidth: '52px',
                    }}>
                      {algo.label}
                    </span>
                    <span style={{
                      fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)',
                      padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                    }}>
                      {algo.bits}bit
                    </span>
                    <span style={{
                      fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)',
                      padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                    }}>
                      {hash.length}hex
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => handleCopy(hash, algo.id)}
                      style={copyBtn(algo.id)}
                      title="Copiar"
                      onMouseEnter={(e) => { if (copySuccess !== algo.id) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { if (copySuccess !== algo.id) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                  <code style={{
                    fontSize: '11px', fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all', lineHeight: '1.4',
                    userSelect: 'all',
                  }}>
                    {hash}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!text && Object.keys(hashes).length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Zap size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Gerador de Hash
          </div>
          <div>Digite qualquer texto para gerar MD5, SHA-1, SHA-256 e SHA-512</div>
        </div>
      )}
    </div>
  );
};
