import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Globe, Search, Copy, RotateCw } from 'lucide-react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { safeFetch } from '../../../utils/safeFetch';

// ─── Types ──────────────────────────────────────────────────

type Tab = 'ping' | 'ipinfo' | 'dns';

interface PingResult {
  seq: number;
  time: number;
  success: boolean;
  error?: string;
}

interface IpInfoData {
  query: string;
  city: string;
  regionName: string;
  country: string;
  countryCode: string;
  timezone: string;
  isp: string;
  org: string;
  lat: number;
  lon: number;
  status: string;
}

interface DnsRecord {
  type: string;
  data: string[];
  error?: string;
}

interface NetworkToolProps {
  onBack?: () => void;
}

// ─── Ping Logic ─────────────────────────────────────────────

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

const DNS_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT'] as const;

// ─── Component ──────────────────────────────────────────────

export const NetworkTool: React.FC<NetworkToolProps> = () => {
  const [activeTab, setActiveTab] = useState<Tab>('ping');
  const [host, setHost] = useState('');

  // Ping
  const [pingCount, setPingCount] = useState(5);
  const [pingResults, setPingResults] = useState<PingResult[]>([]);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);

  // IP Info
  const [ipData, setIpData] = useState<IpInfoData | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);
  const [ipFetched, setIpFetched] = useState(false);

  // DNS
  const [dnsResults, setDnsResults] = useState<Record<string, DnsRecord>>({});
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);

  // Shared
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // ─── Ping Handlers ──────────────────────

  const handlePing = useCallback(async () => {
    const target = host.trim();
    if (!target) { setPingError('Digite um hostname ou IP'); return; }
    setPingLoading(true);
    setPingError(null);
    setPingResults([]);

    const isInTauri = isTauri();
    const all: PingResult[] = [];

    for (let i = 0; i < pingCount; i++) {
      const result = isInTauri ? await pingTauri(target) : await pingBrowser(target);
      result.seq = i + 1;
      all.push(result);
      setPingResults([...all]);
      if (i < pingCount - 1) await new Promise(r => setTimeout(r, 300));
    }
    setPingLoading(false);
  }, [host, pingCount]);

  // ─── IP Info Handlers ───────────────────

  const fetchIpInfo = useCallback(async () => {
    setIpLoading(true);
    setIpError(null);
    try {
      const res = await fetch(
        'https://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,query'
      );
      if (!res.ok) throw new Error('Falha ao buscar');
      const data = await res.json();
      if (data.status === 'fail') throw new Error(data.message);
      setIpData(data);
    } catch (err) {
      setIpError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIpLoading(false);
      setIpFetched(true);
    }
  }, []);

  // Auto-fetch IP info when tab is first activated
  useEffect(() => {
    if (activeTab === 'ipinfo' && !ipFetched && !ipLoading) {
      fetchIpInfo();
    }
  }, [activeTab, ipFetched, ipLoading, fetchIpInfo]);

  // ─── DNS Handlers ───────────────────────

  const handleDnsLookup = useCallback(async () => {
    const domain = host.trim();
    if (!domain) { setDnsError('Digite um dominio'); return; }
    setDnsLoading(true);
    setDnsError(null);
    setDnsResults({});

    const results: Record<string, DnsRecord> = {};
    for (const type of DNS_TYPES) {
      try {
        const res = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        results[type] = {
          type,
          data: data.Answer ? data.Answer.map((r: { data: string }) => r.data) : [],
        };
      } catch (err) {
        results[type] = { type, data: [], error: err instanceof Error ? err.message : 'Erro' };
      }
    }
    setDnsResults(results);
    setDnsLoading(false);
  }, [host]);

  // ─── Shared Helpers ─────────────────────

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(text);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  };

  const handleGo = () => {
    if (activeTab === 'ping') handlePing();
    else if (activeTab === 'dns') handleDnsLookup();
    else fetchIpInfo();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGo();
  };

  const isLoading = activeTab === 'ping' ? pingLoading : activeTab === 'dns' ? dnsLoading : ipLoading;

  // Ping stats
  const successCount = pingResults.filter(r => r.success).length;
  const times = pingResults.filter(r => r.success).map(r => r.time);
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const minTime = times.length > 0 ? Math.min(...times) : 0;
  const maxTime = times.length > 0 ? Math.max(...times) : 0;
  const lossPercent = pingResults.length > 0 ? Math.round((1 - successCount / pingResults.length) * 100) : 0;

  // ─── Styles ─────────────────────────────

  const tabBtn = (_tab: Tab, active: boolean): React.CSSProperties => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
    backgroundColor: 'transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
    transition: 'all 0.15s ease',
    display: 'flex', alignItems: 'center', gap: '5px',
  });

  const statBox: React.CSSProperties = {
    padding: '8px', backgroundColor: 'var(--bg-deep)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    textAlign: 'center',
  };

  const statLabel: React.CSSProperties = {
    fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '2px',
  };

  const statValue: React.CSSProperties = {
    fontSize: '15px', fontWeight: '700', fontFamily: 'monospace',
    color: 'var(--text-primary)',
  };

  const copyBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '3px 6px', border: '1px solid var(--border-color)', borderRadius: '4px',
    backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
    fontSize: '10px', flexShrink: 0,
  };

  // ─── Render ─────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Tab bar + Input ── */}
      <form onSubmit={handleFormSubmit} style={{
        border: '1.5px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Tabs */}
          {([
            { id: 'ping' as Tab, label: 'PING', icon: <Activity size={12} /> },
            { id: 'ipinfo' as Tab, label: 'IP INFO', icon: <Globe size={12} /> },
            { id: 'dns' as Tab, label: 'DNS', icon: <Search size={12} /> },
          ]).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={tabBtn(t.id, activeTab === t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Input area */}
          {activeTab !== 'ipinfo' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={activeTab === 'ping' ? '192.168.1.1 ou google.com' : 'exemplo.com.br'}
                style={{
                  width: '220px', padding: '6px 10px', backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)', borderRadius: '5px',
                  color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px',
                  outline: 'none',
                }}
              />
              {activeTab === 'ping' && (
                <select
                  value={pingCount}
                  onChange={(e) => setPingCount(parseInt(e.target.value))}
                  style={{
                    padding: '6px 6px', backgroundColor: 'var(--bg-deep)',
                    border: '1px solid var(--border-color)', borderRadius: '5px',
                    color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer',
                  }}
                >
                  {[1, 3, 5, 10].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              )}
              <button
                type="submit"
                disabled={isLoading || !host.trim()}
                style={{
                  padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '4px',
                  backgroundColor: isLoading || !host.trim() ? 'var(--bg-deep)' : 'var(--accent-primary)',
                  border: `1px solid ${isLoading || !host.trim() ? 'var(--border-color)' : 'var(--accent-primary)'}`,
                  borderRadius: '5px',
                  color: isLoading || !host.trim() ? 'var(--text-muted)' : 'white',
                  cursor: isLoading || !host.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
                }}
              >
                <Activity size={11} />
                {isLoading ? '...' : activeTab === 'ping' ? 'Ping' : 'Buscar'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px' }}>
              <span style={{
                fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)',
                padding: '4px 10px', backgroundColor: 'var(--bg-deep)', borderRadius: '12px',
              }}>
                Auto-detectado
              </span>
              <button
                type="button"
                onClick={fetchIpInfo}
                disabled={ipLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: '5px',
                  backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: '11px', fontWeight: '600',
                }}
              >
                <RotateCw size={11} style={ipLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                {ipLoading ? '...' : 'Atualizar'}
              </button>
            </div>
          )}
        </div>

        {/* Browser warning for Ping */}
        {activeTab === 'ping' && !isTauri() && (
          <div style={{
            padding: '5px 12px', backgroundColor: 'rgba(234,179,8,0.06)',
            borderTop: '1px solid rgba(234,179,8,0.2)',
            fontSize: '10px', color: 'var(--text-muted)',
          }}>
            Modo browser: usa HTTP HEAD (nao e ICMP real). Use o app desktop para ping nativo.
          </div>
        )}
      </form>

      {/* ── Tab Content ── */}

      {/* ── PING TAB ── */}
      {activeTab === 'ping' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pingError && (
            <div style={{
              padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
              color: 'var(--danger)', fontSize: '11px',
            }}>
              {pingError}
            </div>
          )}

          {/* Stats grid */}
          {pingResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[
                { label: 'Enviados', value: `${pingResults.length}`, color: undefined },
                { label: 'Sucesso', value: `${successCount}`, color: successCount > 0 ? 'rgb(34,197,94)' : undefined },
                { label: 'Perda', value: `${lossPercent}%`, color: lossPercent > 0 ? 'var(--danger)' : undefined },
                { label: 'Min', value: times.length ? `${minTime}ms` : '-', color: undefined },
                { label: 'Max', value: times.length ? `${maxTime}ms` : '-', color: undefined },
              ].map(s => (
                <div key={s.label} style={statBox}>
                  <div style={statLabel}>{s.label}</div>
                  <div style={{ ...statValue, color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Average */}
          {times.length > 0 && (
            <div style={{
              padding: '8px 14px', backgroundColor: 'var(--bg-deep)',
              border: '1px solid var(--border-color)', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Media:</span>
              <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                {avgTime}ms
              </span>
            </div>
          )}

          {/* Results list */}
          {pingResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {pingResults.map(r => (
                <div key={r.seq} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 10px',
                  backgroundColor: r.success ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${r.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                  borderRadius: '5px', fontSize: '12px',
                }}>
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700',
                    backgroundColor: r.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: r.success ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                  }}>
                    {r.seq}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1, fontSize: '11px' }}>
                    {host}
                  </span>
                  {r.success ? (
                    <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'rgb(34,197,94)', fontSize: '12px' }}>
                      {r.time}ms
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'rgb(239,68,68)', fontSize: '12px' }}>
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {pingResults.length === 0 && !pingError && !pingLoading && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Activity size={28} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.25 }} />
              Digite um IP ou hostname e clique em Ping
            </div>
          )}
        </div>
      )}

      {/* ── IP INFO TAB ── */}
      {activeTab === 'ipinfo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ipLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <RotateCw size={18} style={{ display: 'block', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              Consultando...
            </div>
          )}

          {ipError && (
            <div style={{
              padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
              color: 'var(--danger)', fontSize: '11px',
            }}>
              {ipError}
            </div>
          )}

          {ipData && !ipLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { label: 'Meu IP', value: ipData.query, mono: true, copyable: true },
                { label: 'Pais', value: `${ipData.country} (${ipData.countryCode})`, mono: false },
                { label: 'Cidade', value: ipData.city || '-', mono: false },
                { label: 'Regiao', value: ipData.regionName || '-', mono: false },
                { label: 'ISP', value: ipData.isp, mono: false },
                { label: 'Timezone', value: ipData.timezone, mono: true },
                { label: 'Latitude', value: ipData.lat.toFixed(4), mono: true },
                { label: 'Longitude', value: ipData.lon.toFixed(4), mono: true },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '10px 12px', backgroundColor: 'var(--bg-deep)',
                  border: '1px solid var(--border-color)', borderRadius: '6px',
                }}>
                  <div style={{
                    fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px',
                  }}>
                    {item.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: item.label === 'Meu IP' ? '14px' : '12px',
                      fontWeight: '600',
                      fontFamily: item.mono ? 'monospace' : 'inherit',
                      color: item.label === 'Meu IP' ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}>
                      {item.value}
                    </span>
                    {item.copyable && (
                      <button onClick={() => handleCopy(ipData.query)} style={copyBtn}>
                        {copySuccess === ipData.query ? <span style={{ fontSize: '10px' }}>OK</span> : <Copy size={10} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!ipData && !ipLoading && !ipError && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Globe size={28} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.25 }} />
              Clique em Atualizar para consultar
            </div>
          )}
        </div>
      )}

      {/* ── DNS TAB ── */}
      {activeTab === 'dns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dnsError && (
            <div style={{
              padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
              color: 'var(--danger)', fontSize: '11px',
            }}>
              {dnsError}
            </div>
          )}

          {dnsLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Search size={18} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
              Consultando registros DNS...
            </div>
          )}

          {Object.keys(dnsResults).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DNS_TYPES.map(type => {
                const record = dnsResults[type];
                if (!record) return null;
                const hasData = record.data.length > 0 && !record.error;
                return (
                  <div key={type} style={{
                    border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 12px', backgroundColor: 'var(--bg-deep)',
                      borderBottom: hasData ? '1px solid var(--border-color)' : 'none',
                    }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        color: hasData ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontFamily: 'monospace',
                      }}>
                        {type}
                      </span>
                      <span style={{
                        fontSize: '9px', fontFamily: 'monospace',
                        padding: '1px 6px', borderRadius: '8px',
                        backgroundColor: hasData ? 'rgba(34,197,94,0.08)' : 'var(--bg-panel)',
                        color: hasData ? 'rgb(34,197,94)' : 'var(--text-muted)',
                      }}>
                        {record.error ? 'erro' : `${record.data.length}`}
                      </span>
                    </div>
                    {record.error && (
                      <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--danger)' }}>
                        {record.error}
                      </div>
                    )}
                    {hasData && record.data.map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 12px',
                        borderBottom: i < record.data.length - 1 ? '1px solid var(--border-color)' : 'none',
                        fontSize: '11px', fontFamily: 'monospace',
                      }}>
                        <span style={{ flex: 1, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{d}</span>
                        <button onClick={() => handleCopy(d)} style={copyBtn}>
                          {copySuccess === d ? <span style={{ fontSize: '9px' }}>OK</span> : <Copy size={10} />}
                        </button>
                      </div>
                    ))}
                    {!record.error && record.data.length === 0 && (
                      <div style={{ padding: '5px 12px', fontSize: '10px', color: 'var(--text-muted)' }}>
                        Sem registros
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(dnsResults).length === 0 && !dnsLoading && !dnsError && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <Search size={28} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.25 }} />
              Digite um dominio e clique em Buscar
            </div>
          )}
        </div>
      )}
    </div>
  );
};
