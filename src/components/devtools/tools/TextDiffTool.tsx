import React, { useState, useMemo } from 'react';
import { Copy, Trash2, Columns2, AlignLeft, BookOpen } from 'lucide-react';

interface TextDiffToolProps {
  onBack?: () => void;
}

type ViewMode = 'unified' | 'side';
type DiffType = 'equal' | 'add' | 'remove';

interface DiffLine {
  type: DiffType;
  oldNum?: number;
  newNum?: number;
  text: string;
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return newLines.map((t, i) => ({ type: 'add' as DiffType, newNum: i + 1, text: t }));
  if (n === 0) return oldLines.map((t, i) => ({ type: 'remove' as DiffType, oldNum: i + 1, text: t }));

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'equal', oldNum: i, newNum: j, text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', newNum: j, text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: 'remove', oldNum: i, text: oldLines[i - 1] });
      i--;
    }
  }
  return result.reverse();
}

const EXAMPLE_OLD = `{
  "nome": "AuraFetch",
  "versao": "1.2.0",
  "descricao": "Cliente HTTP desktop",
  "autor": "Eder Ferraz",
  "licenca": "MIT",
  "dependencias": {
    "react": "^18.2.0",
    "tauri": "^1.5.0"
  }
}`;

const EXAMPLE_NEW = `{
  "nome": "AuraFetch",
  "versao": "1.3.2",
  "descricao": "Cliente HTTP desktop com DevTools",
  "autor": "Eder Ferraz",
  "licenca": "MIT",
  "homepage": "https://github.com/ederferraz/aurafetch",
  "dependencias": {
    "react": "^19.2.0",
    "tauri": "^2.0.0",
    "lucide-react": "^0.575.0"
  }
}`;

export const TextDiffTool: React.FC<TextDiffToolProps> = () => {
  const [oldText, setOldText] = useState('');
  const [newText, setNewText] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('side');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const diff = useMemo(() => {
    if (!oldText && !newText) return [];
    const normalize = (s: string) => ignoreWhitespace ? s.trimEnd() : s;
    const oldLines = oldText.split('\n').map(normalize);
    const newLines = newText.split('\n').map(normalize);
    return computeDiff(oldLines, newLines);
  }, [oldText, newText, ignoreWhitespace]);

  const stats = useMemo(() => {
    let added = 0, removed = 0, unchanged = 0;
    for (const d of diff) {
      if (d.type === 'add') added++;
      else if (d.type === 'remove') removed++;
      else unchanged++;
    }
    return { added, removed, unchanged, total: diff.length };
  }, [diff]);

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const handleLoadExample = () => {
    setOldText(EXAMPLE_OLD);
    setNewText(EXAMPLE_NEW);
  };

  const handleClear = () => {
    setOldText('');
    setNewText('');
  };

  const unifiedText = diff.map(d => {
    const prefix = d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' ';
    return `${prefix} ${d.text}`;
  }).join('\n');

  const hasDiff = diff.length > 0;
  const hasInput = oldText || newText;

  const lineColor = (type: DiffType) => {
    if (type === 'add') return 'rgba(34,197,94,0.08)';
    if (type === 'remove') return 'rgba(239,68,68,0.08)';
    return 'transparent';
  };

  const lineBorderColor = (type: DiffType) => {
    if (type === 'add') return 'rgba(34,197,94,0.25)';
    if (type === 'remove') return 'rgba(239,68,68,0.25)';
    return 'transparent';
  };

  const prefixColor = (type: DiffType) => {
    if (type === 'add') return 'rgb(34,197,94)';
    if (type === 'remove') return 'rgb(239,68,68)';
    return 'var(--text-muted)';
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

  const textareaStyle: React.CSSProperties = {
    flex: 1, padding: '12px',
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '0 0 8px 8px',
    color: 'var(--text-primary)',
    fontFamily: 'monospace', fontSize: '12px',
    lineHeight: '1.6', resize: 'vertical',
    minHeight: '120px', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: view mode + options ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {([
          { id: 'side' as ViewMode, label: 'Lado a Lado', icon: <Columns2 size={10} /> },
          { id: 'unified' as ViewMode, label: 'Unificado', icon: <AlignLeft size={10} /> },
        ]).map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            style={{
              padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px',
              backgroundColor: viewMode === m.id ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${viewMode === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: viewMode === m.id ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}

        <button
          onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
          style={{
            padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
            letterSpacing: '0.5px', fontFamily: 'monospace',
            backgroundColor: ignoreWhitespace ? 'var(--accent-primary)' : 'transparent',
            border: `1.5px solid ${ignoreWhitespace ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            borderRadius: '20px',
            color: ignoreWhitespace ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          Ignorar Espacos
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleLoadExample}
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
          title="Carregar exemplo"
        >
          <BookOpen size={11} />
        </button>

        {hasInput && (
          <button
            onClick={handleClear}
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

      {/* ── Input panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Original</span>
            {oldText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                  padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                }}>
                  {oldText.split('\n').length}ln
                </span>
                <button
                  onClick={() => handleCopy(oldText, 'old')}
                  style={copyBtn('old')}
                  title="Copiar original"
                  onMouseEnter={(e) => { if (copySuccess !== 'old') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'old') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
              </div>
            )}
          </div>
          <textarea
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            placeholder="Cole o texto original aqui..."
            spellCheck={false}
            style={textareaStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Modificado</span>
            {newText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                  padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                }}>
                  {newText.split('\n').length}ln
                </span>
                <button
                  onClick={() => handleCopy(newText, 'new')}
                  style={copyBtn('new')}
                  title="Copiar modificado"
                  onMouseEnter={(e) => { if (copySuccess !== 'new') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'new') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={11} />
                </button>
              </div>
            )}
          </div>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Cole o texto modificado aqui..."
            spellCheck={false}
            style={textareaStyle}
          />
        </div>
      </div>

      {/* ── Stats row ── */}
      {hasDiff && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
          }}>
            {stats.total} linhas
          </span>
          {stats.added > 0 && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', fontWeight: '700',
              color: 'rgb(34,197,94)',
              padding: '1px 6px', backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: '3px',
            }}>
              +{stats.added}
            </span>
          )}
          {stats.removed > 0 && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', fontWeight: '700',
              color: 'rgb(239,68,68)',
              padding: '1px 6px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '3px',
            }}>
              -{stats.removed}
            </span>
          )}
          {stats.unchanged > 0 && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
              padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            }}>
              ={stats.unchanged}
            </span>
          )}
        </div>
      )}

      {/* ── Diff output ── */}
      {hasDiff && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Diferencias</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => handleCopy(unifiedText, 'diff')}
                style={copyBtn('diff')}
                title="Copiar diff"
                onMouseEnter={(e) => { if (copySuccess !== 'diff') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { if (copySuccess !== 'diff') e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Copy size={11} />
              </button>
            </div>
          </div>

          {viewMode === 'unified' ? (
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              {diff.map((d, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'stretch',
                  backgroundColor: lineColor(d.type),
                  borderLeft: `3px solid ${lineBorderColor(d.type)}`,
                  borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                  minHeight: '24px',
                }}>
                  <span style={{
                    width: '32px', flexShrink: 0, textAlign: 'right',
                    padding: '3px 6px', fontSize: '10px', fontFamily: 'monospace',
                    color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.05)',
                    userSelect: 'none',
                  }}>
                    {d.oldNum || ''}
                  </span>
                  <span style={{
                    width: '32px', flexShrink: 0, textAlign: 'right',
                    padding: '3px 6px', fontSize: '10px', fontFamily: 'monospace',
                    color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.03)',
                    userSelect: 'none',
                  }}>
                    {d.newNum || ''}
                  </span>
                  <span style={{
                    width: '18px', flexShrink: 0, textAlign: 'center',
                    padding: '3px 0', fontSize: '11px', fontFamily: 'monospace',
                    fontWeight: '700', color: prefixColor(d.type),
                    userSelect: 'none',
                  }}>
                    {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' '}
                  </span>
                  <span style={{
                    flex: 1, padding: '3px 8px', fontSize: '12px', fontFamily: 'monospace',
                    color: 'var(--text-primary)', whiteSpace: 'pre', overflowX: 'auto',
                  }}>
                    {d.text || '\u00A0'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              {diff.map((d, idx) => (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                  minHeight: '24px',
                }}>
                  {/* Left (old) */}
                  <div style={{
                    display: 'flex', alignItems: 'stretch',
                    backgroundColor: d.type === 'remove' ? 'rgba(239,68,68,0.08)' : d.type === 'add' ? 'var(--bg-deep)' : 'transparent',
                    borderLeft: d.type === 'remove' ? '3px solid rgba(239,68,68,0.25)' : '3px solid transparent',
                    borderRight: '1px solid var(--border-color)',
                    opacity: d.type === 'add' ? 0.4 : 1,
                  }}>
                    <span style={{
                      width: '32px', flexShrink: 0, textAlign: 'right',
                      padding: '3px 6px', fontSize: '10px', fontFamily: 'monospace',
                      color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.05)',
                      userSelect: 'none',
                    }}>
                      {d.oldNum || ''}
                    </span>
                    <span style={{
                      flex: 1, padding: '3px 8px', fontSize: '12px', fontFamily: 'monospace',
                      color: d.type === 'remove' ? 'rgb(239,68,68)' : 'var(--text-primary)',
                      whiteSpace: 'pre', overflowX: 'auto',
                    }}>
                      {d.type !== 'add' ? (d.text || '\u00A0') : ''}
                    </span>
                  </div>

                  {/* Right (new) */}
                  <div style={{
                    display: 'flex', alignItems: 'stretch',
                    backgroundColor: d.type === 'add' ? 'rgba(34,197,94,0.08)' : d.type === 'remove' ? 'var(--bg-deep)' : 'transparent',
                    borderLeft: d.type === 'add' ? '3px solid rgba(34,197,94,0.25)' : '3px solid transparent',
                    opacity: d.type === 'remove' ? 0.4 : 1,
                  }}>
                    <span style={{
                      width: '32px', flexShrink: 0, textAlign: 'right',
                      padding: '3px 6px', fontSize: '10px', fontFamily: 'monospace',
                      color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.05)',
                      userSelect: 'none',
                    }}>
                      {d.newNum || ''}
                    </span>
                    <span style={{
                      flex: 1, padding: '3px 8px', fontSize: '12px', fontFamily: 'monospace',
                      color: d.type === 'add' ? 'rgb(34,197,94)' : 'var(--text-primary)',
                      whiteSpace: 'pre', overflowX: 'auto',
                    }}>
                      {d.type !== 'remove' ? (d.text || '\u00A0') : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasInput && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Columns2 size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Text Diff
          </div>
          <div>Cole os textos original e modificado para comparar as diferencas</div>
        </div>
      )}
    </div>
  );
};
