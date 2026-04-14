import React, { useState, useEffect } from 'react';
import { Copy, FileText, Trash2 } from 'lucide-react';

interface RegexTesterProps {
  onBack?: () => void;
}

interface RegexMatch {
  text: string;
  index: number;
  groups: (string | undefined)[];
}

interface Flags {
  g: boolean;
  i: boolean;
  m: boolean;
}

const PRESETS = [
  { name: 'Email', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
  { name: 'URL', pattern: 'https?:\\/\\/[^\\s]+' },
  { name: 'Numeros', pattern: '\\d+' },
  { name: 'Telefone BR', pattern: '\\(\\d{2}\\) \\d{4,5}-\\d{4}' },
  { name: 'Data BR', pattern: '\\d{2}\\/\\d{2}\\/\\d{4}' },
  { name: 'CEP', pattern: '\\d{5}-?\\d{3}' },
  { name: 'IPv4', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' },
  { name: 'Hex Color', pattern: '#[0-9a-fA-F]{3,8}' },
];

const FLAG_INFO: { key: keyof Flags; label: string; desc: string }[] = [
  { key: 'g', label: 'g', desc: 'global' },
  { key: 'i', label: 'i', desc: 'case-insensitive' },
  { key: 'm', label: 'm', desc: 'multiline' },
];

export const RegexTester: React.FC<RegexTesterProps> = () => {
  const [pattern, setPattern] = useState('');
  const [text, setText] = useState('');
  const [flags, setFlags] = useState<Flags>({ g: true, i: false, m: false });
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!pattern.trim() || !text.trim()) {
      setError(null);
      setMatches([]);
      return;
    }
    try {
      const flagStr = (flags.g ? 'g' : '') + (flags.i ? 'i' : '') + (flags.m ? 'm' : '');
      const regex = new RegExp(pattern, flagStr);
      const found: RegexMatch[] = [];

      if (flags.g) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          found.push({ text: match[0], index: match.index, groups: match.slice(1) });
        }
      } else {
        const match = regex.exec(text);
        if (match) {
          found.push({ text: match[0], index: match.index, groups: match.slice(1) });
        }
      }
      setError(null);
      setMatches(found);
    } catch {
      setError('Padrao invalido');
      setMatches([]);
    }
  }, [pattern, text, flags]);

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  // Build highlighted text
  const buildHighlightedText = (): React.ReactNode => {
    if (!matches.length || !text) return null;
    const parts: React.ReactNode[] = [];
    let lastEnd = 0;
    matches.forEach((m, i) => {
      if (m.index > lastEnd) {
        parts.push(<span key={`t${i}`}>{text.slice(lastEnd, m.index)}</span>);
      }
      parts.push(
        <span key={`m${i}`} style={{
          backgroundColor: 'rgba(var(--accent-primary-rgb, 59,130,246), 0.25)',
          borderBottom: '2px solid var(--accent-primary)',
          borderRadius: '2px',
          padding: '0 1px',
        }}>
          {m.text}
        </span>
      );
      lastEnd = m.index + m.text.length;
    });
    if (lastEnd < text.length) {
      parts.push(<span key="tail">{text.slice(lastEnd)}</span>);
    }
    return parts;
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

  const highlighted = buildHighlightedText();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Presets ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPattern(p.pattern)}
            style={{
              padding: '4px 10px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.3px',
              backgroundColor: pattern === p.pattern ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${pattern === p.pattern ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: pattern === p.pattern ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* ── Pattern input + flags ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={panelHeader}>
          <span style={headerLabel}>Padrao Regex</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Flags */}
            {FLAG_INFO.map(f => (
              <button
                key={f.key}
                onClick={() => setFlags(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                title={f.desc}
                style={{
                  padding: '2px 8px', fontSize: '10px', fontWeight: '800',
                  fontFamily: 'monospace', cursor: 'pointer',
                  backgroundColor: flags[f.key] ? 'var(--accent-primary)' : 'transparent',
                  border: `1.5px solid ${flags[f.key] ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  color: flags[f.key] ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}

            {pattern && (
              <>
                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
                <button
                  onClick={() => handleCopy(pattern, 'pattern')}
                  style={copyBtn('pattern')}
                  title="Copiar padrao"
                  onMouseEnter={(e) => { if (copySuccess !== 'pattern') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'pattern') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={() => setPattern('')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                    backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '0 0 8px 8px',
        }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '14px', userSelect: 'none' }}>/</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="padrao regex..."
            spellCheck={false}
            style={{
              flex: 1, padding: '10px 6px',
              backgroundColor: 'transparent', border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'monospace', fontSize: '13px', fontWeight: '600',
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '14px', userSelect: 'none' }}>
            /{(flags.g ? 'g' : '') + (flags.i ? 'i' : '') + (flags.m ? 'm' : '')}
          </span>
        </div>
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

      {/* ── Test text ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={panelHeader}>
          <span style={headerLabel}>Texto de Teste</span>
          {text && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
              padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
            }}>
              {text.length} chars
            </span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Texto para testar o padrao..."
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

      {/* ── Highlighted preview ── */}
      {highlighted && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Resultado</span>
            <span style={{
              fontSize: '9px', fontWeight: '700',
              padding: '1px 6px', borderRadius: '3px',
              backgroundColor: matches.length > 0 ? 'rgb(34,197,94)' : 'var(--bg-panel)',
              color: matches.length > 0 ? 'white' : 'var(--text-muted)',
            }}>
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'var(--text-primary)',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '200px',
            overflowY: 'auto',
          }}>
            {highlighted}
          </div>
        </div>
      )}

      {/* ── Match details ── */}
      {!error && matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Matches ({matches.length})</span>
          </div>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
            maxHeight: '260px',
            overflowY: 'auto',
          }}>
            {matches.map((match, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '7px 12px',
                backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
              }}>
                <span style={{
                  fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
                  fontFamily: 'monospace', minWidth: '16px', textAlign: 'right',
                  paddingTop: '2px', flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-primary)',
                    wordBreak: 'break-all', fontWeight: '600',
                  }}>
                    {match.text}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    }}>
                      idx:{match.index}
                    </span>
                    {match.groups.length > 0 && match.groups.map((g, gi) => (
                      <span key={gi} style={{
                        fontSize: '9px', fontFamily: 'monospace',
                        color: g !== undefined ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}>
                        ${gi + 1}:{g !== undefined ? g : 'undef'}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(match.text, `m${idx}`)}
                  style={copyBtn(`m${idx}`)}
                  title="Copiar"
                  onMouseEnter={(e) => { if (copySuccess !== `m${idx}`) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== `m${idx}`) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── No matches ── */}
      {!error && pattern.trim() && text.trim() && matches.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '11px',
          backgroundColor: 'var(--bg-panel)', borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          Nenhuma correspondencia encontrada
        </div>
      )}

      {/* ── Empty state ── */}
      {!pattern && !text && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <FileText size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Validador Regex
          </div>
          <div>Escolha um preset ou digite um padrao e texto para testar</div>
        </div>
      )}
    </div>
  );
};
