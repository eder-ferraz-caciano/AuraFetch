import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';

interface JWTDecoderProps {
  onBack?: () => void;
}

interface TokenParts {
  header: Record<string, string> | null;
  payload: Record<string, unknown> | null;
  signature: string;
  error: string | null;
}

export const JWTDecoder: React.FC<JWTDecoderProps> = () => {
  const [token, setToken] = useState('');
  const [tokenParts, setTokenParts] = useState<TokenParts>({
    header: null,
    payload: null,
    signature: '',
    error: null,
  });
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    const decodeBase64 = (str: string): string => {
      try {
        const binary = atob(str);
        return decodeURIComponent(
          Array.from(binary)
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
      } catch {
        throw new Error('Invalid Base64');
      }
    };

    const decodePart = (part: string): Record<string, unknown> | null => {
      try {
        const decoded = decodeBase64(part);
        return JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    if (!token.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenParts({
        header: null,
        payload: null,
        signature: '',
        error: null,
      });
      return;
    }

    const parts = token.trim().split('.');

    if (parts.length !== 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenParts({
        header: null,
        payload: null,
        signature: '',
        error: 'Token JWT inválido. Deve conter 3 partes separadas por pontos (.)',
      });
      return;
    }

    const [headerPart, payloadPart, signaturePart] = parts;

    const decodedHeader = decodePart(headerPart);
    const decodedPayload = decodePart(payloadPart);

    if (!decodedHeader || !decodedPayload) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenParts({
        header: null,
        payload: null,
        signature: '',
        error: 'Falha ao decodificar partes do token JWT. Verifique o formato Base64.',
      });
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokenParts({
      header: decodedHeader as Record<string, string>,
      payload: decodedPayload,
      signature: signaturePart.substring(0, 20) + (signaturePart.length > 20 ? '...' : ''),
      error: null,
    });
  }, [token]);

  const handleCopySection = async (content: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(sectionName);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      // Silently fail on copy error
    }
  };

  const formatJson = (obj: Record<string, unknown> | null): string => {
    if (!obj) return '';
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Input Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Token JWT
        </label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole seu token JWT aqui"
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            minHeight: '100px',
            resize: 'vertical',
            fontWeight: '500',
            wordBreak: 'break-all',
          }}
        />
      </div>

      {/* Error Message */}
      {tokenParts.error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: '4px',
            color: 'var(--danger)',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          {tokenParts.error}
        </div>
      )}

      {/* Decoded Sections */}
      {!tokenParts.error && tokenParts.header && tokenParts.payload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Section */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Header
              </h3>
              <button
                onClick={() => handleCopySection(formatJson(tokenParts.header), 'header')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  backgroundColor: copySuccess === 'header' ? 'rgb(34, 197, 94)' : 'var(--bg-panel)',
                  border: `1px solid ${copySuccess === 'header' ? 'rgb(34, 197, 94)' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  color: copySuccess === 'header' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  if (copySuccess !== 'header') {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (copySuccess !== 'header') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                title={copySuccess === 'header' ? 'Copiado!' : 'Copiar Header'}
              >
                <Copy size={14} />
                {copySuccess === 'header' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                overflow: 'auto',
                maxHeight: '200px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '2px',
              }}
            >
              {formatJson(tokenParts.header)}
            </pre>
          </div>

          {/* Expiration Status */}
          {tokenParts.payload && typeof tokenParts.payload.exp === 'number' && (() => {
            const exp = tokenParts.payload.exp as number;
            const isExpired = exp < Math.floor(Date.now() / 1000);
            return (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  border: `1px solid ${isExpired ? 'rgb(239,68,68)' : 'rgb(34,197,94)'}`,
                  borderRadius: '4px',
                  color: isExpired ? 'rgb(239,68,68)' : 'rgb(22,163,74)',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span>{isExpired ? 'Token Expirado' : 'Token Valido'}</span>
                <span style={{ fontWeight: 'normal', fontSize: '11px' }}>
                  Expira em: {new Date(exp * 1000).toLocaleString('pt-BR')}
                </span>
              </div>
            );
          })()}

          {/* Payload Section */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Payload
              </h3>
              <button
                onClick={() => handleCopySection(formatJson(tokenParts.payload), 'payload')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  backgroundColor: copySuccess === 'payload' ? 'rgb(34, 197, 94)' : 'var(--bg-panel)',
                  border: `1px solid ${copySuccess === 'payload' ? 'rgb(34, 197, 94)' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  color: copySuccess === 'payload' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  if (copySuccess !== 'payload') {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (copySuccess !== 'payload') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                title={copySuccess === 'payload' ? 'Copiado!' : 'Copiar Payload'}
              >
                <Copy size={14} />
                {copySuccess === 'payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                overflow: 'auto',
                maxHeight: '300px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '2px',
              }}
            >
              {formatJson(tokenParts.payload)}
            </pre>
          </div>

          {/* Signature Section */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Assinatura (Preview)
              </h3>
              <button
                onClick={() => handleCopySection(tokenParts.signature, 'signature')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 10px',
                  backgroundColor: copySuccess === 'signature' ? 'rgb(34, 197, 94)' : 'var(--bg-panel)',
                  border: `1px solid ${copySuccess === 'signature' ? 'rgb(34, 197, 94)' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  color: copySuccess === 'signature' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  if (copySuccess !== 'signature') {
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (copySuccess !== 'signature') {
                    e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                title={copySuccess === 'signature' ? 'Copiado!' : 'Copiar Assinatura'}
              >
                <Copy size={14} />
                {copySuccess === 'signature' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <code
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '2px',
                wordBreak: 'break-all',
              }}
            >
              {tokenParts.signature}
            </code>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!tokenParts.error && !tokenParts.header && !tokenParts.payload && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          Cole seu token JWT acima para decodificar
        </div>
      )}
    </div>
  );
};
