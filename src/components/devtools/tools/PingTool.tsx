import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { safeFetch } from '../../../utils/safeFetch';

interface PingResult {
  seq: number;
  time: number;
  success: boolean;
  error?: string;
}

interface PingToolProps {
  onBack?: () => void;
}

export const PingTool: React.FC<PingToolProps> = () => {
  const [host, setHost] = useState('');
  const [count, setCount] = useState(5);
  const [results, setResults] = useState<PingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pingBrowser = async (hostname: string): Promise<PingResult> => {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const target = hostname.includes('://') ? hostname : `https://${hostname}`;
      await safeFetch(target, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      return { seq: 0, time: Math.round(performance.now() - start), success: true };
    } catch (err) {
      const elapsed = performance.now() - start;
      const msg = err instanceof Error ? err.message : 'Erro';
      if (msg.includes('abort') || elapsed >= 4900) {
        return { seq: 0, time: 0, success: false, error: 'Timeout' };
      }
      // For no-cors/opaque responses, a non-timeout error often means the host replied
      return { seq: 0, time: Math.round(elapsed), success: true };
    }
  };

  const pingTauri = async (hostname: string): Promise<PingResult> => {
    try {
      const ms = await invoke<number>('ping_host', { host: hostname });
      return { seq: 0, time: ms, success: true };
    } catch (err) {
      return { seq: 0, time: 0, success: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const handlePing = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = host.trim();
    if (!target) { setError('Digite um hostname ou IP'); return; }

    setLoading(true);
    setError(null);
    setResults([]);

    const isInTauri = isTauri();
    const all: PingResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = isInTauri ? await pingTauri(target) : await pingBrowser(target);
      result.seq = i + 1;
      all.push(result);
      setResults([...all]);
      // Small delay between pings
      if (i < count - 1) await new Promise(r => setTimeout(r, 300));
    }

    setLoading(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const times = results.filter((r) => r.success).map((r) => r.time);
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const minTime = times.length > 0 ? Math.min(...times) : 0;
  const maxTime = times.length > 0 ? Math.max(...times) : 0;
  const lossPercent = results.length > 0 ? Math.round((1 - successCount / results.length) * 100) : 0;

  const sectionLabel: React.CSSProperties = {
    fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Host + Count */}
      <form onSubmit={handlePing} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <label style={sectionLabel}>Host / IP</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.1 ou google.com"
              style={{
                padding: '10px 12px', backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '13px',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '80px' }}>
            <label style={sectionLabel}>Pings</label>
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              style={{
                padding: '10px 8px', backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !host.trim()}
            style={{
              padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: loading || !host.trim() ? 'var(--bg-panel)' : 'var(--accent-primary)',
              border: `1px solid ${loading || !host.trim() ? 'var(--border-color)' : 'var(--accent-primary)'}`,
              borderRadius: '4px',
              color: loading || !host.trim() ? 'var(--text-muted)' : 'white',
              cursor: loading || !host.trim() ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap',
            }}
          >
            <Activity size={15} />
            {loading ? 'Pingando...' : 'Ping'}
          </button>
        </div>
        {!isTauri() && (
          <div style={{
            padding: '8px 12px', backgroundColor: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.3)', borderRadius: '4px',
            fontSize: '11px', color: 'var(--text-muted)',
          }}>
            Modo browser: usa HTTP HEAD (nao e ICMP real). Use o app desktop para ping nativo.
          </div>
        )}
      </form>

      {error && (
        <div style={{
          padding: '10px 12px', backgroundColor: 'var(--danger-bg)',
          border: '1px solid var(--danger)', borderRadius: '4px',
          color: 'var(--danger)', fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Statistics */}
      {results.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px',
        }}>
          {[
            { label: 'Enviados', value: `${results.length}` },
            { label: 'Sucesso', value: `${successCount}`, color: successCount > 0 ? 'rgb(34,197,94)' : undefined },
            { label: 'Perda', value: `${lossPercent}%`, color: lossPercent > 0 ? 'var(--danger)' : undefined },
            { label: 'Min', value: times.length ? `${minTime}ms` : '-' },
            { label: 'Max', value: times.length ? `${maxTime}ms` : '-' },
          ].map((s) => (
            <div key={s.label} style={{
              padding: '8px', backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)', borderRadius: '4px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                {s.label}
              </div>
              <div style={{
                fontSize: '16px', fontWeight: '700', fontFamily: 'monospace',
                color: s.color || 'var(--text-primary)',
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Average bar */}
      {times.length > 0 && (
        <div style={{
          padding: '10px 14px', backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)', borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Media:</span>
          <span style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
            {avgTime}ms
          </span>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {results.map((r) => (
            <div
              key={r.seq}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px',
                backgroundColor: r.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${r.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: '4px', fontSize: '12px',
              }}
            >
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700',
                backgroundColor: r.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: r.success ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
              }}>
                {r.seq}
              </span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>
                {host}
              </span>
              {r.success ? (
                <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'rgb(34,197,94)' }}>
                  {r.time}ms
                </span>
              ) : (
                <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'rgb(239,68,68)' }}>
                  {r.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !error && !loading && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <Activity size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
          Digite um IP ou hostname e clique em Ping
        </div>
      )}
    </div>
  );
};
