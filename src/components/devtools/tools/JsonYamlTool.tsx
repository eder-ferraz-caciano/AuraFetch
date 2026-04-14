import React, { useState, useEffect } from 'react';
import { Copy, ArrowRightLeft, Trash2, FileText } from 'lucide-react';
import YAML from 'js-yaml';

interface JsonYamlToolProps {
  onBack?: () => void;
}

type Mode = 'json2yaml' | 'yaml2json';

const MODES: { id: Mode; from: string; to: string }[] = [
  { id: 'json2yaml', from: 'JSON', to: 'YAML' },
  { id: 'yaml2json', from: 'YAML', to: 'JSON' },
];

export const JsonYamlTool: React.FC<JsonYamlToolProps> = () => {
  const [mode, setMode] = useState<Mode>('json2yaml');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const currentMode = MODES.find(m => m.id === mode)!;

  useEffect(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      setError(null);
      if (mode === 'json2yaml') {
        const parsed = JSON.parse(input);
        setOutput(YAML.dump(parsed, { lineWidth: -1 }));
      } else {
        const parsed = YAML.load(input);
        setOutput(JSON.stringify(parsed, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setOutput('');
    }
  }, [input, mode]);

  const handleSwap = () => {
    if (!output) return;
    setInput(output);
    setMode(mode === 'json2yaml' ? 'yaml2json' : 'json2yaml');
  };

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const inputLines = input ? input.split('\n').length : 0;
  const outputLines = output ? output.split('\n').length : 0;
  const inputBytes = input ? new TextEncoder().encode(input).length : 0;
  const outputBytes = output ? new TextEncoder().encode(output).length : 0;

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
    minHeight: '180px', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: mode pills + swap + clear ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.5px', fontFamily: 'monospace',
              backgroundColor: mode === m.id ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${mode === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: mode === m.id ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {m.from} → {m.to}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {output && (
          <button
            onClick={handleSwap}
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
            title="Inverter entrada/saida"
          >
            <ArrowRightLeft size={11} />
          </button>
        )}

        {input && (
          <button
            onClick={() => { setInput(''); setOutput(''); setError(null); }}
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

      {/* ── Side-by-side panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

        {/* Input panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={headerLabel}>Entrada</span>
              <span style={{
                fontSize: '9px', fontWeight: '700', fontFamily: 'monospace',
                color: 'var(--accent-primary)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {currentMode.from}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {input && (
                <>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {inputLines}ln
                  </span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {inputBytes}B
                  </span>
                  <button
                    onClick={() => handleCopy(input, 'input')}
                    style={copyBtn('input')}
                    title="Copiar entrada"
                    onMouseEnter={(e) => { if (copySuccess !== 'input') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { if (copySuccess !== 'input') e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Copy size={11} />
                  </button>
                </>
              )}
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'json2yaml'
              ? '{\n  "nome": "AuraFetch",\n  "versao": "1.3.2"\n}'
              : 'nome: AuraFetch\nversao: "1.3.2"'
            }
            spellCheck={false}
            style={textareaStyle}
          />
        </div>

        {/* Output panel */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={headerLabel}>Saida</span>
              <span style={{
                fontSize: '9px', fontWeight: '700', fontFamily: 'monospace',
                color: 'var(--accent-primary)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {currentMode.to}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {output && (
                <>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {outputLines}ln
                  </span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {outputBytes}B
                  </span>
                  <button
                    onClick={() => handleCopy(output, 'output')}
                    style={copyBtn('output')}
                    title="Copiar saida"
                    onMouseEnter={(e) => { if (copySuccess !== 'output') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { if (copySuccess !== 'output') e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Copy size={11} />
                  </button>
                </>
              )}
            </div>
          </div>
          {error ? (
            <div style={{
              flex: 1, padding: '12px',
              backgroundColor: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '0 0 8px 8px',
              color: 'var(--danger)', fontFamily: 'monospace', fontSize: '11px',
              lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              minHeight: '180px',
            }}>
              {error}
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              placeholder={mode === 'json2yaml'
                ? 'nome: AuraFetch\nversao: "1.3.2"'
                : '{\n  "nome": "AuraFetch",\n  "versao": "1.3.2"\n}'
              }
              spellCheck={false}
              style={{ ...textareaStyle, cursor: output ? 'text' : 'default' }}
            />
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      {output && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
        }}>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
          }}>
            {inputBytes}B → {outputBytes}B
          </span>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace',
            color: outputBytes > inputBytes ? 'rgb(239,68,68)' : 'rgb(34,197,94)',
            padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            fontWeight: '700',
          }}>
            {outputBytes >= inputBytes ? '+' : ''}{outputBytes - inputBytes}B ({outputBytes >= inputBytes ? '+' : ''}{inputBytes > 0 ? Math.round(((outputBytes - inputBytes) / inputBytes) * 100) : 0}%)
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!input && !error && (
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
            JSON ↔ YAML
          </div>
          <div>Cole JSON ou YAML na entrada para converter automaticamente</div>
        </div>
      )}
    </div>
  );
};
