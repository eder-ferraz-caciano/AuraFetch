import React, { useState, useEffect } from 'react';
import { Copy, ArrowRightLeft, Trash2, Globe } from 'lucide-react';

interface UrlEncodeToolProps {
  onBack?: () => void;
}

type Mode = 'encode' | 'decode';

const EXAMPLES: { label: string; value: string }[] = [
  { label: 'URL com query', value: 'https://api.exemplo.com/busca?q=café com leite&lang=pt-BR' },
  { label: 'Path com espaços', value: 'https://site.com/path/arquivo com espaços.pdf' },
  { label: 'Query string', value: 'nome=João da Silva&cidade=São Paulo&email=joao@email.com' },
  { label: 'Encoded', value: 'https%3A%2F%2Fapi.exemplo.com%2Fbusca%3Fq%3Dcaf%C3%A9%20com%20leite%26lang%3Dpt-BR' },
];

export const UrlEncodeTool: React.FC<UrlEncodeToolProps> = () => {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!input) {
      setOutput('');
      setError(null);
      return;
    }
    try {
      setError(null);
      setOutput(mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setOutput('');
    }
  }, [input, mode]);

  const handleSwap = () => {
    if (!output) return;
    setInput(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  const handleExample = (ex: typeof EXAMPLES[number]) => {
    const looksEncoded = /%[0-9A-Fa-f]{2}/.test(ex.value);
    setMode(looksEncoded ? 'decode' : 'encode');
    setInput(ex.value);
  };

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const inputLen = input.length;
  const outputLen = output.length;
  const inputBytes = input ? new TextEncoder().encode(input).length : 0;
  const outputBytes = output ? new TextEncoder().encode(output).length : 0;

  const encodedChars = mode === 'encode' && output
    ? (output.match(/%[0-9A-Fa-f]{2}/g) || []).length
    : 0;

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
    minHeight: '140px', outline: 'none',
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
        {(['encode', 'decode'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.5px', textTransform: 'uppercase',
              backgroundColor: mode === m ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${mode === m ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: mode === m ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {m === 'encode' ? 'Codificar' : 'Decodificar'}
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

      {/* ── Example presets ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <span style={{
          fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
          letterSpacing: '1px', textTransform: 'uppercase', marginRight: '2px',
        }}>
          Exemplos
        </span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => handleExample(ex)}
            style={{
              padding: '3px 10px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {ex.label}
          </button>
        ))}
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
                {mode === 'encode' ? 'TEXTO' : 'ENCODED'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {input && (
                <>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {inputLen}ch
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
            placeholder={mode === 'encode'
              ? 'https://exemplo.com/busca?q=café com leite'
              : 'https%3A%2F%2Fexemplo.com%2Fbusca%3Fq%3Dcaf%C3%A9'
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
                {mode === 'encode' ? 'ENCODED' : 'TEXTO'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {output && (
                <>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
                  }}>
                    {outputLen}ch
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
              minHeight: '140px',
            }}>
              {error}
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              placeholder={mode === 'encode'
                ? 'https%3A%2F%2Fexemplo.com%2Fbusca%3Fq%3Dcaf%C3%A9'
                : 'https://exemplo.com/busca?q=café com leite'
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
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            {inputLen}ch → {outputLen}ch
          </span>
          <span style={{
            fontSize: '9px', fontFamily: 'monospace',
            color: outputBytes > inputBytes ? 'rgb(239,68,68)' : 'rgb(34,197,94)',
            padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            fontWeight: '700',
          }}>
            {outputBytes >= inputBytes ? '+' : ''}{outputBytes - inputBytes}B ({outputBytes >= inputBytes ? '+' : ''}{inputBytes > 0 ? Math.round(((outputBytes - inputBytes) / inputBytes) * 100) : 0}%)
          </span>
          {mode === 'encode' && encodedChars > 0 && (
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
              padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            }}>
              {encodedChars} encoded
            </span>
          )}
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
            <Globe size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            URL Encode / Decode
          </div>
          <div>Cole uma URL ou texto para codificar/decodificar, ou use um exemplo acima</div>
        </div>
      )}
    </div>
  );
};
