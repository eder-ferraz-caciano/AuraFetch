import React, { useState, useEffect } from 'react';
import { Copy, Clock, Trash2 } from 'lucide-react';
import cronstrue from 'cronstrue';

interface CronHelperProps {
  onBack?: () => void;
}

const CRON_PRESETS: { label: string; expr: string }[] = [
  { label: 'Cada minuto', expr: '* * * * *' },
  { label: 'A cada 5 min', expr: '*/5 * * * *' },
  { label: 'A cada hora', expr: '0 * * * *' },
  { label: 'Diario 9h', expr: '0 9 * * *' },
  { label: 'Seg-Sex 9h', expr: '0 9 * * 1-5' },
  { label: '1o do mes', expr: '0 0 1 * *' },
  { label: 'Domingo 0h', expr: '0 0 * * 0' },
  { label: 'A cada 30 min', expr: '*/30 * * * *' },
];

const FIELD_LABELS = ['Minuto', 'Hora', 'Dia', 'Mes', 'DiaSem'];
const FIELD_RANGES = ['0-59', '0-23', '1-31', '1-12', '0-6'];

function getNextExecutions(cronExpr: string, count = 5): Date[] {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const parseField = (field: string, min: number, max: number): number[] => {
    if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    if (field.includes(',')) return field.split(',').map(Number).filter(n => n >= min && n <= max);
    if (field.includes('/')) {
      const [base, step] = field.split('/');
      const start = base === '*' ? min : Number(base);
      const s = Number(step);
      const result = [];
      for (let i = start; i <= max; i += s) result.push(i);
      return result;
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return Array.from({ length: end - start + 1 }, (_, i) => i + start);
    }
    const n = Number(field);
    return n >= min && n <= max ? [n] : [];
  };

  try {
    const minutes = parseField(parts[0], 0, 59);
    const hours = parseField(parts[1], 0, 23);
    const days = parseField(parts[2], 1, 31);
    const months = parseField(parts[3], 1, 12);
    const dows = parseField(parts[4], 0, 6);

    const results: Date[] = [];
    let current = new Date();
    current.setSeconds(0, 0);
    current = new Date(current.getTime() + 60000);

    for (let i = 0; i < 100000 && results.length < count; i++) {
      if (
        minutes.includes(current.getMinutes()) &&
        hours.includes(current.getHours()) &&
        days.includes(current.getDate()) &&
        months.includes(current.getMonth() + 1) &&
        dows.includes(current.getDay())
      ) {
        results.push(new Date(current));
      }
      current = new Date(current.getTime() + 60000);
    }
    return results;
  } catch {
    return [];
  }
}

export const CronHelper: React.FC<CronHelperProps> = () => {
  const [expression, setExpression] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextExecutions, setNextExecutions] = useState<Date[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!expression.trim()) {
        setDescription(null);
        setError(null);
        setNextExecutions([]);
        return;
      }
      try {
        setDescription(cronstrue.toString(expression, { locale: 'pt_BR' }));
        setNextExecutions(getNextExecutions(expression));
        setError(null);
      } catch {
        setError('Expressao cron invalida');
        setDescription(null);
        setNextExecutions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [expression]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch { /* ignore */ }
  };

  const fields = expression.trim().split(/\s+/);
  const hasValidFields = fields.length === 5;

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

      {/* ── Presets ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-deep)',
        border: '1px solid var(--border-color)', borderRadius: '8px',
      }}>
        {CRON_PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => setExpression(p.expr)}
            style={{
              padding: '4px 10px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
              letterSpacing: '0.3px',
              backgroundColor: expression === p.expr ? 'var(--accent-primary)' : 'transparent',
              border: `1.5px solid ${expression === p.expr ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '20px',
              color: expression === p.expr ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Expression input ── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={panelHeader}>
          <span style={headerLabel}>Expressao Cron</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {expression && (
              <button
                onClick={() => handleCopy(expression, 'expr')}
                style={copyBtn('expr')}
                title="Copiar"
                onMouseEnter={(e) => { if (copySuccess !== 'expr') e.currentTarget.style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { if (copySuccess !== 'expr') e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Copy size={11} />
              </button>
            )}
            {expression && (
              <button
                onClick={() => setExpression('')}
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
            )}
          </div>
        </div>
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="* * * * *"
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
            letterSpacing: '2px',
            outline: 'none',
            textAlign: 'center',
          }}
        />
      </div>

      {/* ── Field breakdown ── */}
      {hasValidFields && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px',
        }}>
          {fields.map((field, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '8px 4px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
            }}>
              <span style={{
                fontSize: '14px', fontWeight: '700', fontFamily: 'monospace',
                color: 'var(--accent-primary)',
              }}>
                {field}
              </span>
              <span style={{
                fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.3px',
              }}>
                {FIELD_LABELS[i]}
              </span>
              <span style={{
                fontSize: '8px', fontFamily: 'monospace', color: 'var(--text-muted)',
                opacity: 0.6,
              }}>
                {FIELD_RANGES[i]}
              </span>
            </div>
          ))}
        </div>
      )}

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

      {/* ── Description ── */}
      {!error && description && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '14px', fontWeight: '600',
          color: 'var(--text-primary)',
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          {description}
        </div>
      )}

      {/* ── Next executions ── */}
      {!error && nextExecutions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={panelHeader}>
            <span style={headerLabel}>Proximas Execucoes</span>
            <span style={{
              fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
              padding: '1px 6px', backgroundColor: 'var(--bg-panel)', borderRadius: '3px',
            }}>
              {nextExecutions.length}
            </span>
          </div>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}>
            {nextExecutions.map((date, idx) => {
              const diffMs = date.getTime() - Date.now();
              const diffMin = Math.floor(diffMs / 60000);
              const diffH = Math.floor(diffMin / 60);
              const diffD = Math.floor(diffH / 24);
              let relative = '';
              if (diffD > 0) relative = `em ${diffD}d ${diffH % 24}h`;
              else if (diffH > 0) relative = `em ${diffH}h ${diffMin % 60}min`;
              else relative = `em ${diffMin}min`;

              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 12px',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-deep)',
                  borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <span style={{
                    fontSize: '9px', fontWeight: '700', color: 'var(--accent-primary)',
                    fontFamily: 'monospace', minWidth: '16px', textAlign: 'right',
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{
                    flex: 1, fontSize: '12px', fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                  }}>
                    {date.toLocaleString('pt-BR')}
                  </span>
                  <span style={{
                    fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    padding: '1px 6px', backgroundColor: 'var(--bg-deep)', borderRadius: '3px',
                    whiteSpace: 'nowrap',
                  }}>
                    {relative}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!expression && !error && (
        <div style={{
          textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--bg-deep)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Clock size={20} style={{ opacity: 0.35 }} />
          </div>
          <div style={{ fontWeight: '600', marginBottom: '3px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Expressao Cron
          </div>
          <div>Escolha um preset ou digite uma expressao para decodificar</div>
        </div>
      )}
    </div>
  );
};
