import React, { useState } from 'react';
import { Copy, Trash2, Key, RefreshCw } from 'lucide-react';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';

interface UUIDGeneratorProps {
  onBack?: () => void;
}

type UUIDVersion = 'v1' | 'v4' | 'v7';

const VERSIONS: { id: UUIDVersion; label: string; hint: string }[] = [
  { id: 'v1', label: 'v1', hint: 'Time-based (MAC + timestamp)' },
  { id: 'v4', label: 'v4', hint: 'Random (criptograficamente seguro)' },
  { id: 'v7', label: 'v7', hint: 'Time-sorted (timestamp ms + random)' },
];

function generateUUIDv7(): string {
  const now = Date.now();
  const tsHex = now.toString(16).padStart(12, '0');
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${rand().slice(1)}-${((Math.random() * 0x3fff + 0x8000) | 0).toString(16)}-${rand()}${rand()}${rand().slice(0, 4)}`;
}

export const UUIDGenerator: React.FC<UUIDGeneratorProps> = () => {
  const [version, setVersion] = useState<UUIDVersion>('v4');
  const [quantity, setQuantity] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);

  const makeUUID = () => {
    if (version === 'v1') return uuidv1();
    if (version === 'v7') return generateUUIDv7();
    return uuidv4();
  };

  const handleGenerate = () => {
    const newUuids = Array.from({ length: quantity }, makeUUID);
    setUuids(prev => [...newUuids, ...prev]);
    setCopySuccess(null);
    setCopyAllSuccess(false);
  };

  const handleCopySingle = async (uuid: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(uuid);
      setCopySuccess(idx);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyAll = async () => {
    if (!uuids.length) return;
    try {
      await navigator.clipboard.writeText(uuids.join('\n'));
      setCopyAllSuccess(true);
      setTimeout(() => setCopyAllSuccess(false), 2000);
    } catch { /* ignore */ }
  };

  const handleClear = () => {
    setUuids([]);
    setCopySuccess(null);
    setCopyAllSuccess(false);
  };

  const activeVersion = VERSIONS.find(v => v.id === version)!;

  // ─── Styles ─────────────────────────────

  const fieldLabel: React.CSSProperties = {
    fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  const versionPill = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
    letterSpacing: '0.3px', fontFamily: 'monospace',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
    borderRadius: '20px',
    color: active ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s ease',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Header: Version pills + Quantity ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        <span style={fieldLabel}>Versao</span>
        {VERSIONS.map(v => (
          <button key={v.id} style={versionPill(version === v.id)} onClick={() => setVersion(v.id)}>
            {v.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

        {/* Quantity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={fieldLabel}>Qtd</span>
          <input
            type="range" min="1" max="100" value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={{ width: '80px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
          />
          <span style={{
            fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
            padding: '2px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '4px',
            minWidth: '28px', textAlign: 'center',
          }}>
            {quantity}
          </span>
        </div>
      </div>

      {/* ── Version hint ── */}
      <div style={{ padding: '0 4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          UUID {activeVersion.label}: {activeVersion.hint}
        </span>
      </div>

      {/* ── Generate button ── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleGenerate} style={{ ...actionBtn('primary'), flex: 1 }}>
          <RefreshCw size={12} />
          Gerar {quantity} UUID{quantity !== 1 ? 's' : ''}
        </button>
        {uuids.length > 0 && (
          <>
            <button
              onClick={handleCopyAll}
              style={actionBtn(copyAllSuccess ? 'success' : 'ghost')}
            >
              <Copy size={12} /> {copyAllSuccess ? 'Copiado' : 'Tudo'}
            </button>
            <button onClick={handleClear} style={actionBtn('ghost')}>
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* ── Results ── */}
      {uuids.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 0',
          }}>
            <span style={fieldLabel}>Resultados</span>
            <span style={{ fontSize: '10px', fontWeight: '600', color: 'rgb(34,197,94)' }}>
              {uuids.length} gerado{uuids.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '4px',
            maxHeight: '420px', overflowY: 'auto',
          }}>
            {uuids.map((uuid, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
              }}>
                <span style={{
                  fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
                  padding: '1px 5px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                  letterSpacing: '0.3px', fontFamily: 'monospace',
                  flexShrink: 0,
                }}>
                  {version}
                </span>
                <code style={{
                  flex: 1, fontFamily: 'monospace', fontSize: '12px',
                  color: 'var(--text-primary)', wordBreak: 'break-all',
                  lineHeight: '1.4',
                }}>
                  {uuid}
                </code>
                <button
                  onClick={() => handleCopySingle(uuid, idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', border: 'none', borderRadius: '4px',
                    backgroundColor: copySuccess === idx ? 'rgb(34,197,94)' : 'transparent',
                    color: copySuccess === idx ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                    transition: 'all 0.15s ease', flexShrink: 0,
                  }}
                  title="Copiar"
                  onMouseEnter={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (copySuccess !== idx) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Copy size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {uuids.length === 0 && (
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
            Gerador de UUID
          </div>
          <div>Escolha a versao e quantidade, clique em Gerar</div>
        </div>
      )}
    </div>
  );
};
