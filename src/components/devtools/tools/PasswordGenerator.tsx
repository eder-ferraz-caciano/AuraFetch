import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Key, RefreshCw, Trash2 } from 'lucide-react';

interface PasswordGeneratorProps {
  onBack?: () => void;
}

const CHAR_SETS = [
  { id: 'upper' as const, label: 'A-Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', size: 26 },
  { id: 'lower' as const, label: 'a-z', chars: 'abcdefghijklmnopqrstuvwxyz', size: 26 },
  { id: 'digits' as const, label: '0-9', chars: '0123456789', size: 10 },
  { id: 'special' as const, label: '!@#', chars: '!@#$%^&*()_+-=[]{}|;:,.<>?', size: 26 },
];

type CharSetId = 'upper' | 'lower' | 'digits' | 'special';

function getCharColor(ch: string): string {
  if (/[A-Z]/.test(ch)) return 'var(--accent-primary)';
  if (/[a-z]/.test(ch)) return 'var(--text-primary)';
  if (/[0-9]/.test(ch)) return 'rgb(34,197,94)';
  return 'rgb(251,191,36)';
}

function calcEntropy(length: number, charsetSize: number): number {
  if (charsetSize <= 0 || length <= 0) return 0;
  return Math.floor(length * Math.log2(charsetSize));
}

function getStrength(entropy: number): { label: string; color: string; bars: number } {
  if (entropy < 28) return { label: 'FRACA', color: 'rgb(239,68,68)', bars: 1 };
  if (entropy < 50) return { label: 'MEDIA', color: 'rgb(234,179,8)', bars: 2 };
  if (entropy < 80) return { label: 'FORTE', color: 'rgb(59,130,246)', bars: 3 };
  return { label: 'MUITO FORTE', color: 'rgb(34,197,94)', bars: 4 };
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = () => {
  const [enabled, setEnabled] = useState<Record<CharSetId, boolean>>({
    upper: true, lower: true, digits: true, special: true,
  });
  const [length, setLength] = useState(20);
  const [quantity, setQuantity] = useState(1);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const charsetSize = CHAR_SETS.reduce((sum, s) => sum + (enabled[s.id] ? s.size : 0), 0);
  const entropy = calcEntropy(length, charsetSize);
  const strength = getStrength(entropy);

  const generate = useCallback(() => {
    let chars = '';
    for (const s of CHAR_SETS) {
      if (enabled[s.id]) chars += s.chars;
    }
    if (!chars) { setPasswords([]); return; }

    const arr = new Uint32Array(length * quantity);
    crypto.getRandomValues(arr);

    const results: string[] = [];
    for (let q = 0; q < quantity; q++) {
      let pwd = '';
      for (let i = 0; i < length; i++) {
        pwd += chars[arr[q * length + i] % chars.length];
      }
      results.push(pwd);
    }
    setPasswords(results);
  }, [enabled, length, quantity]);

  useEffect(() => { generate(); }, [generate]);

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const toggleSet = (id: CharSetId) => {
    const next = { ...enabled, [id]: !enabled[id] };
    if (!Object.values(next).some(Boolean)) return;
    setEnabled(next);
  };

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

      {/* ── Header: charset pills + actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {CHAR_SETS.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleSet(s.id)}
            style={{
              padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.5px', fontFamily: 'monospace',
              backgroundColor: enabled[s.id] ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${enabled[s.id] ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: enabled[s.id] ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {s.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={generate}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '26px', height: '26px', border: '1px solid var(--border-color)',
            borderRadius: '50%', backgroundColor: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title="Regenerar"
        >
          <RefreshCw size={11} />
        </button>

        {passwords.length > 0 && (
          <button
            onClick={() => setPasswords([])}
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

      {/* ── Controls: Length + Quantity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '10px 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
              letterSpacing: '1px', textTransform: 'uppercase',
            }}>
              Comprimento
            </span>
            <span style={{
              fontSize: '14px', fontWeight: '800', fontFamily: 'monospace',
              color: 'var(--accent-primary)', minWidth: '30px', textAlign: 'right',
            }}>
              {length}
            </span>
          </div>
          <input
            type="range" min="4" max="128" value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>4</span>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>128</span>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: '10px 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
              letterSpacing: '1px', textTransform: 'uppercase',
            }}>
              Quantidade
            </span>
            <span style={{
              fontSize: '14px', fontWeight: '800', fontFamily: 'monospace',
              color: 'var(--accent-primary)', minWidth: '30px', textAlign: 'right',
            }}>
              {quantity}
            </span>
          </div>
          <input
            type="range" min="1" max="20" value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>1</span>
            <span style={{ fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>20</span>
          </div>
        </div>
      </div>

      {/* ── Strength / Entropy ── */}
      {passwords.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)',
            letterSpacing: '1px', textTransform: 'uppercase', flexShrink: 0,
          }}>
            Forca
          </span>
          <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                flex: 1, height: '6px', borderRadius: '3px',
                backgroundColor: i <= strength.bars ? strength.color : 'var(--border-color)',
                transition: 'background-color 0.2s ease',
              }} />
            ))}
          </div>
          <span style={{
            fontSize: '10px', fontWeight: '700', fontFamily: 'monospace',
            color: strength.color, letterSpacing: '0.5px', flexShrink: 0,
          }}>
            {strength.label}
          </span>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            flexShrink: 0,
          }}>
            {entropy}bit
          </span>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            flexShrink: 0,
          }}>
            {charsetSize}chars
          </span>
        </div>
      )}

      {/* ── Password list ── */}
      {passwords.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Senhas</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {passwords.length}
              </span>
              {passwords.length > 1 && (
                <button
                  onClick={() => handleCopy(passwords.join('\n'), 'all')}
                  style={copyBtn('all')}
                  title="Copiar todas"
                  onMouseEnter={(e) => { if (copySuccess !== 'all') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'all') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
              )}
            </div>
          </div>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}>
            {passwords.map((pwd, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px',
                backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
              }}>
                {passwords.length > 1 && (
                  <span style={{
                    fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
                    fontFamily: 'monospace', minWidth: '16px', textAlign: 'right', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                )}
                <code style={{
                  flex: 1, fontSize: '12px', fontFamily: 'monospace',
                  wordBreak: 'break-all', lineHeight: '1.5', userSelect: 'all',
                }}>
                  {pwd.split('').map((ch, ci) => (
                    <span key={ci} style={{ color: getCharColor(ch) }}>{ch}</span>
                  ))}
                </code>
                <button
                  onClick={() => handleCopy(pwd, `pwd-${idx}`)}
                  style={copyBtn(`pwd-${idx}`)}
                  title="Copiar"
                  onMouseEnter={(e) => { if (copySuccess !== `pwd-${idx}`) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== `pwd-${idx}`) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {passwords.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Key size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Gerador de Senha
          </div>
          <div>Selecione os tipos de caracteres para gerar senhas seguras</div>
        </div>
      )}
    </div>
  );
};
