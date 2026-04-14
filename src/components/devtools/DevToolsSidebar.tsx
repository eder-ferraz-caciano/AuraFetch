import React from 'react';
import { Zap } from 'lucide-react';

export const DevToolsSidebar: React.FC = () => {
  return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          alignSelf: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: '8px',
            color: 'white',
            flexShrink: 0,
          }}
        >
          <Zap size={24} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--text-primary)',
            }}
          >
            Dev Tools
          </h3>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            Utilitários para desenvolvedores
          </p>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: '1px',
          backgroundColor: 'var(--border-color)',
          marginBottom: '16px',
        }}
      />

      <p
        style={{
          margin: 0,
          fontSize: '12px',
          color: 'var(--text-muted)',
          lineHeight: '1.5',
          textAlign: 'center',
        }}
      >
        Geradores, conversores, validadores e ferramentas de rede para acelerar seu desenvolvimento.
      </p>
    </div>
  );
};
