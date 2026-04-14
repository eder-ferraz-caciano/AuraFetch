import React, { useState, useEffect } from 'react';
import { Copy, CreditCard, RefreshCw, Trash2 } from 'lucide-react';

interface CPFCNPJValidatorProps {
  onBack?: () => void;
}

type DocType = 'CPF' | 'CNPJ' | 'unknown';

// ─── Validation ──────────────────────────

function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(d[9], 10) === d1 && parseInt(d[10], 10) === d2;
}

function validateCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const m1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * m1[i];
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  const m2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i], 10) * m2[i];
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(d[12], 10) === d1 && parseInt(d[13], 10) === d2;
}

function formatCPF(s: string): string {
  const d = s.replace(/\D/g, '');
  if (d.length !== 11) return s;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCNPJ(s: string): string {
  const d = s.replace(/\D/g, '');
  if (d.length !== 14) return s;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function detectType(input: string): DocType {
  const d = input.replace(/\D/g, '');
  if (d.length === 11) return 'CPF';
  if (d.length === 14) return 'CNPJ';
  return 'unknown';
}

function generateCPF(): string {
  const rnd = () => Math.floor(Math.random() * 10);
  const n = Array.from({ length: 9 }, rnd);
  let sum = n.reduce((a, v, i) => a + v * (10 - i), 0);
  let r = sum % 11;
  n.push(r < 2 ? 0 : 11 - r);
  sum = n.reduce((a, v, i) => a + v * (11 - i), 0);
  r = sum % 11;
  n.push(r < 2 ? 0 : 11 - r);
  const s = n.join('');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

function generateCNPJ(): string {
  const rnd = () => Math.floor(Math.random() * 10);
  const n = [...Array.from({ length: 8 }, rnd), 0, 0, 0, 1];
  const m1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = n.reduce((a, v, i) => a + v * m1[i], 0);
  let r = sum % 11;
  n.push(r < 2 ? 0 : 11 - r);
  const m2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = n.reduce((a, v, i) => a + v * m2[i], 0);
  r = sum % 11;
  n.push(r < 2 ? 0 : 11 - r);
  const s = n.join('');
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

// ─── Component ───────────────────────────

export const CPFCNPJValidator: React.FC<CPFCNPJValidatorProps> = () => {
  const [input, setInput] = useState('');
  const [docType, setDocType] = useState<DocType>('unknown');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [formatted, setFormatted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setDocType('unknown'); setIsValid(null); setError(null); setFormatted('');
      return;
    }
    const type = detectType(input);
    setDocType(type);
    if (type === 'unknown') {
      const digits = input.replace(/\D/g, '').length;
      setError(digits < 11 ? `${digits}/11 digitos (CPF) ou ${digits}/14 (CNPJ)` : 'Formato nao reconhecido');
      setIsValid(null); setFormatted('');
      return;
    }
    setError(null);
    if (type === 'CPF') { setIsValid(validateCPF(input)); setFormatted(formatCPF(input)); }
    else { setIsValid(validateCNPJ(input)); setFormatted(formatCNPJ(input)); }
  }, [input]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const digits = input.replace(/\D/g, '');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: Generate buttons ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <span style={{
          fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Gerar
        </span>
        <button
          onClick={() => setInput(generateCPF())}
          style={{
            padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: '1.5px solid var(--border-color)',
            borderRadius: '20px',
            color: 'var(--text-muted)',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', gap: '4px',
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
          <RefreshCw size={10} /> CPF
        </button>
        <button
          onClick={() => setInput(generateCNPJ())}
          style={{
            padding: '5px 14px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
            letterSpacing: '0.5px',
            backgroundColor: 'transparent',
            border: '1.5px solid var(--border-color)',
            borderRadius: '20px',
            color: 'var(--text-muted)',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', gap: '4px',
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
          <RefreshCw size={10} /> CNPJ
        </button>

        <div style={{ flex: 1 }} />

        {input && (
          <button
            onClick={() => setInput('')}
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
          <span style={headerLabel}>Documento</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {docType !== 'unknown' && (
              <span style={{
                fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
                padding: '2px 8px', borderRadius: '3px',
                backgroundColor: 'var(--accent-primary)', color: 'white',
              }}>
                {docType}
              </span>
            )}
            {digits.length > 0 && docType === 'unknown' && (
              <span style={{
                fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
              }}>
                {digits.length} digitos
              </span>
            )}
          </div>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="CPF ou CNPJ (com ou sem mascara)..."
          spellCheck={false}
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '16px',
            fontWeight: '600',
            letterSpacing: '1px',
            outline: 'none',
            textAlign: 'center',
          }}
        />
      </div>

      {/* ── Digit progress (when typing) ── */}
      {digits.length > 0 && docType === 'unknown' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 4px',
        }}>
          <div style={{
            flex: 1, height: '4px', borderRadius: '2px',
            backgroundColor: 'var(--bg-deep)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              backgroundColor: 'var(--accent-primary)',
              width: `${Math.min((digits.length / 14) * 100, 100)}%`,
              transition: 'width 0.2s ease',
            }} />
          </div>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {error}
          </span>
        </div>
      )}

      {/* ── Validation result ── */}
      {!error && isValid !== null && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '8px',
            backgroundColor: isValid ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${isValid ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <span style={{
              fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: '4px',
              backgroundColor: isValid ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
              color: 'white',
            }}>
              {isValid ? 'VALIDO' : 'INVALIDO'}
            </span>
            <span style={{
              fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
              padding: '2px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
            }}>
              {docType}
            </span>
            {isValid && (
              <span style={{
                fontSize: '13px', fontFamily: 'monospace', fontWeight: '700',
                color: 'var(--text-primary)', letterSpacing: '1px',
              }}>
                {formatted}
              </span>
            )}
            {isValid && formatted && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleCopy(formatted, 'fmt')}
                  title="Copiar formatado"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', border: 'none', borderRadius: '4px',
                    backgroundColor: copySuccess === 'fmt' ? 'rgb(34,197,94)' : 'transparent',
                    color: copySuccess === 'fmt' ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (copySuccess !== 'fmt') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'fmt') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => handleCopy(digits, 'raw')}
                  title="Copiar so digitos"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '0 6px', height: '24px', border: 'none', borderRadius: '4px',
                    backgroundColor: copySuccess === 'raw' ? 'rgb(34,197,94)' : 'transparent',
                    color: copySuccess === 'raw' ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '9px', fontWeight: '700', fontFamily: 'monospace',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (copySuccess !== 'raw') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== 'raw') e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {copySuccess === 'raw' ? 'OK' : 'RAW'}
                </button>
              </div>
            )}
          </div>

          {/* Digit breakdown (visual) */}
          {isValid && (
            <div style={{
              display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap',
            }}>
              {digits.split('').map((d, i) => {
                const isCheckDigit = docType === 'CPF' ? i >= 9 : i >= 12;
                return (
                  <span key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '28px',
                    fontSize: '13px', fontFamily: 'monospace', fontWeight: '700',
                    color: isCheckDigit ? 'white' : 'var(--text-primary)',
                    backgroundColor: isCheckDigit ? 'var(--accent-primary)' : 'var(--bg-panel)',
                    border: `1px solid ${isCheckDigit ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: '4px',
                  }}>
                    {d}
                  </span>
                );
              })}
            </div>
          )}
          {isValid && (
            <div style={{
              textAlign: 'center', fontSize: '9px', color: 'var(--text-muted)',
            }}>
              Digitos verificadores em destaque
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!input && isValid === null && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <CreditCard size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Validador CPF/CNPJ
          </div>
          <div>Digite ou gere um documento para validar</div>
        </div>
      )}
    </div>
  );
};
