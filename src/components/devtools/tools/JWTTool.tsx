import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Shield, X, Plus, Trash2 } from 'lucide-react';

interface JWTToolProps {
  onBack?: () => void;
}

type Mode = 'decode' | 'generate';

interface DecodedToken {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signature: string;
  error: string | null;
}

// ─── Helpers ─────────────────────────────

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return decodeURIComponent(
    Array.from(binary).map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function formatJson(obj: Record<string, unknown> | null): string {
  if (!obj) return '';
  return JSON.stringify(obj, null, 2);
}

function formatTimestamp(ts: number): string {
  try { return new Date(ts * 1000).toLocaleString('pt-BR'); }
  catch { return String(ts); }
}

// ─── Component ───────────────────────────

export const JWTTool: React.FC<JWTToolProps> = () => {
  const [mode, setMode] = useState<Mode>('decode');

  // ── Decode state ──
  const [token, setToken] = useState('');
  const [decoded, setDecoded] = useState<DecodedToken>({ header: null, payload: null, signature: '', error: null });

  // ── Generate state ──
  const [claims, setClaims] = useState<Record<string, string>>({
    sub: '1234567890',
    name: 'John Doe',
    iat: Math.floor(Date.now() / 1000).toString(),
  });
  const [secret, setSecret] = useState('sua-chave-secreta');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // ── Shared ──
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // ── Decode logic ──
  useEffect(() => {
    if (mode !== 'decode') return;
    if (!token.trim()) {
      setDecoded({ header: null, payload: null, signature: '', error: null });
      return;
    }
    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      setDecoded({ header: null, payload: null, signature: '', error: 'JWT invalido: deve ter 3 partes separadas por ponto (.)' });
      return;
    }
    try {
      const header = JSON.parse(decodeBase64Url(parts[0])) as Record<string, unknown>;
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
      setDecoded({ header, payload, signature: parts[2], error: null });
    } catch {
      setDecoded({ header: null, payload: null, signature: '', error: 'Falha ao decodificar. Verifique o formato.' });
    }
  }, [token, mode]);

  // ── Generate logic ──
  const generatedToken = useMemo(() => {
    const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64urlEncode(JSON.stringify(claims));
    const signature = base64urlEncode(`${header}.${payload}.${secret}`);
    return `${header}.${payload}.${signature}`;
  }, [claims, secret]);

  const handleAddClaim = () => {
    if (!newKey.trim()) return;
    setClaims(prev => ({ ...prev, [newKey.trim()]: newValue.trim() }));
    setNewKey('');
    setNewValue('');
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
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

  const preBlock: React.CSSProperties = {
    margin: 0, fontFamily: 'monospace', fontSize: '11px',
    color: 'var(--text-primary)', overflow: 'auto',
    padding: '10px 12px', backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '0 0 8px 8px', lineHeight: '1.5',
    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  };

  const copyBtn = (key: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px', border: 'none', borderRadius: '4px',
    backgroundColor: copySuccess === key ? 'rgb(34,197,94)' : 'transparent',
    color: copySuccess === key ? 'white' : 'var(--text-muted)', cursor: 'pointer',
    transition: 'all 0.15s ease', flexShrink: 0,
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

  // ─── Expiration check ──
  const expInfo = decoded.payload && typeof decoded.payload.exp === 'number'
    ? { expired: (decoded.payload.exp as number) < Math.floor(Date.now() / 1000), ts: decoded.payload.exp as number }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: Mode pills ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <button style={modePill(mode === 'decode')} onClick={() => setMode('decode')}>
          Decodificar
        </button>
        <button style={modePill(mode === 'generate')} onClick={() => setMode('generate')}>
          Gerar
        </button>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ── DECODE MODE ── */}
      {/* ═══════════════════════════════════════ */}
      {mode === 'decode' && (
        <>
          {/* Token input */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={panelHeader}>
              <span style={headerLabel}>Token JWT</span>
              {token && (
                <button
                  onClick={() => setToken('')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px', border: 'none', borderRadius: '50%',
                    backgroundColor: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole seu token JWT aqui..."
              spellCheck={false}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '0 0 8px 8px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                minHeight: '80px',
                resize: 'vertical',
                lineHeight: '1.6',
                outline: 'none',
                wordBreak: 'break-all',
              }}
            />
          </div>

          {/* Error */}
          {decoded.error && (
            <div style={{
              padding: '8px 12px', borderRadius: '6px',
              backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', fontSize: '11px', fontWeight: '600',
            }}>
              {decoded.error}
            </div>
          )}

          {/* Decoded sections */}
          {!decoded.error && decoded.header && decoded.payload && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Expiration badge */}
              {expInfo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '6px',
                  backgroundColor: expInfo.expired ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                  border: `1px solid ${expInfo.expired ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                }}>
                  <span style={{
                    fontSize: '8px', fontWeight: '800', letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: '3px',
                    backgroundColor: expInfo.expired ? 'rgb(239,68,68)' : 'rgb(34,197,94)',
                    color: 'white',
                  }}>
                    {expInfo.expired ? 'EXPIRADO' : 'VALIDO'}
                  </span>
                  <span style={{
                    fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace',
                  }}>
                    exp: {formatTimestamp(expInfo.ts)}
                  </span>
                </div>
              )}

              {/* Header + Payload side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={panelHeader}>
                    <span style={headerLabel}>Header</span>
                    <button
                      onClick={() => handleCopy(formatJson(decoded.header), 'header')}
                      style={copyBtn('header')}
                      title="Copiar"
                      onMouseEnter={(e) => { if (copySuccess !== 'header') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { if (copySuccess !== 'header') e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                  <pre style={{ ...preBlock, maxHeight: '200px' }}>
                    {formatJson(decoded.header)}
                  </pre>
                </div>

                {/* Payload */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={panelHeader}>
                    <span style={headerLabel}>Payload</span>
                    <button
                      onClick={() => handleCopy(formatJson(decoded.payload), 'payload')}
                      style={copyBtn('payload')}
                      title="Copiar"
                      onMouseEnter={(e) => { if (copySuccess !== 'payload') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { if (copySuccess !== 'payload') e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                  <pre style={{ ...preBlock, maxHeight: '200px' }}>
                    {formatJson(decoded.payload)}
                  </pre>
                </div>
              </div>

              {/* Signature */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={panelHeader}>
                  <span style={headerLabel}>Assinatura</span>
                  <button
                    onClick={() => handleCopy(decoded.signature, 'sig')}
                    style={copyBtn('sig')}
                    title="Copiar"
                    onMouseEnter={(e) => { if (copySuccess !== 'sig') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { if (copySuccess !== 'sig') e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Copy size={11} />
                  </button>
                </div>
                <code style={{
                  ...preBlock, display: 'block', fontSize: '10px',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {decoded.signature}
                </code>
              </div>

              {/* Payload claims table */}
              {decoded.payload && Object.keys(decoded.payload).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={panelHeader}>
                    <span style={headerLabel}>Claims ({Object.keys(decoded.payload).length})</span>
                  </div>
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '0 0 8px 8px',
                    overflow: 'hidden',
                  }}>
                    {Object.entries(decoded.payload).map(([key, value], idx) => {
                      const isTimestamp = (key === 'exp' || key === 'iat' || key === 'nbf') && typeof value === 'number';
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 12px',
                          backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                          borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                        }}>
                          <span style={{
                            fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)',
                            fontFamily: 'monospace', minWidth: '60px',
                          }}>
                            {key}
                          </span>
                          <span style={{
                            flex: 1, fontSize: '11px', color: 'var(--text-primary)',
                            fontFamily: 'monospace', wordBreak: 'break-all',
                          }}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                          {isTimestamp && (
                            <span style={{
                              fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace',
                              padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                              whiteSpace: 'nowrap',
                            }}>
                              {formatTimestamp(value as number)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!token && !decoded.error && (
            <div style={{
              textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <Shield size={20} style={{ opacity: 0.35 }} />
              </div>
              <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
                Decodificador JWT
              </div>
              <div>Cole um token para ver header, payload e claims</div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ── GENERATE MODE ── */}
      {/* ═══════════════════════════════════════ */}
      {mode === 'generate' && (
        <>
          {/* Secret */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={panelHeader}>
              <span style={headerLabel}>Chave Secreta</span>
            </div>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Chave para assinatura..."
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '0 0 8px 8px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Claims editor */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={panelHeader}>
              <span style={headerLabel}>Claims ({Object.keys(claims).length})</span>
            </div>
            <div style={{
              border: '1px solid var(--border-color)',
              borderTop: 'none',
              overflow: 'hidden',
            }}>
              {Object.entries(claims).map(([key, value], idx) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                  borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)',
                    fontFamily: 'monospace', minWidth: '60px', flexShrink: 0,
                  }}>
                    {key}
                  </span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setClaims(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      flex: 1, padding: '4px 8px',
                      backgroundColor: 'var(--bg-deep)', border: '1px solid var(--border-color)',
                      borderRadius: '4px', color: 'var(--text-primary)',
                      fontSize: '11px', fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      const updated = { ...claims };
                      delete updated[key];
                      setClaims(updated);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                      backgroundColor: 'transparent', color: 'var(--text-muted)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {/* Add claim row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px',
                backgroundColor: 'var(--bg-deep)',
                borderTop: '1px solid var(--border-color)',
              }}>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClaim()}
                  placeholder="chave"
                  style={{
                    width: '80px', padding: '4px 8px',
                    backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: '4px', color: 'var(--text-primary)',
                    fontSize: '11px', fontFamily: 'monospace', outline: 'none',
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClaim()}
                  placeholder="valor"
                  style={{
                    flex: 1, padding: '4px 8px',
                    backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: '4px', color: 'var(--text-primary)',
                    fontSize: '11px', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddClaim}
                  disabled={!newKey.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', border: 'none', borderRadius: '4px',
                    backgroundColor: newKey.trim() ? 'var(--accent-primary)' : 'transparent',
                    color: newKey.trim() ? 'white' : 'var(--text-muted)',
                    cursor: newKey.trim() ? 'pointer' : 'default',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div style={{ borderRadius: '0 0 8px 8px' }} />
          </div>

          {/* Generated token */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={panelHeader}>
              <span style={headerLabel}>Token Gerado</span>
              <button
                onClick={() => handleCopy(generatedToken, 'token')}
                style={copyBtn('token')}
                title="Copiar token"
                onMouseEnter={(e) => { if (copySuccess !== 'token') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { if (copySuccess !== 'token') e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Copy size={11} />
              </button>
            </div>
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              lineHeight: '1.5',
              maxHeight: '100px',
              overflowY: 'auto',
            }}>
              {generatedToken}
            </div>
          </div>

          {/* Copy button */}
          <button
            onClick={() => handleCopy(generatedToken, 'token-btn')}
            style={{
              ...actionBtn(copySuccess === 'token-btn' ? 'success' : 'primary'),
              width: '100%',
            }}
          >
            <Copy size={12} />
            {copySuccess === 'token-btn' ? 'Copiado!' : 'Copiar Token'}
          </button>

          {/* Warning */}
          <div style={{
            padding: '6px 10px', borderRadius: '6px',
            backgroundColor: 'rgba(234,179,8,0.06)',
            border: '1px solid rgba(234,179,8,0.2)',
            fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4',
          }}>
            Assinatura simplificada para demonstracao. Em producao use HMAC-SHA256.
          </div>
        </>
      )}
    </div>
  );
};
