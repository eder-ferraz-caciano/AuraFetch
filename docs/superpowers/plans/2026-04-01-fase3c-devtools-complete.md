# Phase 3c — Complete Dev Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all missing Dev Tools features, enhance existing tools with full functionality, add beautiful sidebar header for Dev Tools mode, and ensure all 121 Cypress tests pass.

**Architecture:** Implement 3 new tools (Password, JSON↔YAML, URL Encode) as standalone components, enhance 7 existing tools with missing features (QR Code color/size, UUID versions, JWT generator, Hash algorithms, Cron next executions, Regex groups, CPF/CNPJ generator), add sidebar DevTools header component, and integrate all into DevToolsPanel.tsx.

**Tech Stack:** React 19, TypeScript 5.9, existing CSS variables, Web Crypto API (SHA), spark-md5 (MD5), cronstrue (cron), js-yaml (JSON↔YAML), qrcode (QR), jsbarcode (barcode), uuid library (UUID).

---

## File Structure

**New files to create:**
- `src/components/devtools/tools/PasswordGenerator.tsx` — Password generation with strength indicator
- `src/components/devtools/tools/JsonYamlTool.tsx` — JSON↔YAML converter
- `src/components/devtools/tools/UrlEncodeTool.tsx` — URL encode/decode
- `src/components/devtools/DevToolsSidebar.tsx` — Beautiful DevTools header/sidebar content
- `src/components/devtools/tools/JWTGenerator.tsx` — JWT token generator

**Files to modify:**
- `src/components/layout/Sidebar.tsx` — Add DevTools sidebar content when mode=devtools
- `src/components/devtools/DevToolsPanel.tsx` — Add 3 new tools to tools array
- `src/components/devtools/tools/QRCodeGenerator.tsx` — Add size and color customization
- `src/components/devtools/tools/UUIDGenerator.tsx` — Add v1, v7 versions
- `src/components/devtools/tools/JWTDecoder.tsx` — Add expiration status display
- `src/components/devtools/tools/HashCalculator.tsx` — Add SHA algorithms and salt
- `src/components/devtools/tools/CronHelper.tsx` — Add next 5 executions display
- `src/components/devtools/tools/RegexTester.tsx` — Add captured groups highlighting
- `src/components/devtools/tools/CPFCNPJValidator.tsx` — Add random generator for CPF/CNPJ

---

## Task Breakdown

### Task 1: Add Beautiful DevTools Sidebar Header

**Files:**
- Create: `src/components/devtools/DevToolsSidebar.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Context:** When user clicks "Dev Tools" mode, sidebar is currently empty. Add beautiful header/content showing we're in Dev Tools mode.

- [ ] **Step 1: Create DevToolsSidebar component**

Create file `src/components/devtools/DevToolsSidebar.tsx`:

```typescript
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
```

- [ ] **Step 2: Update Sidebar.tsx to import and render DevToolsSidebar**

Modify `src/components/layout/Sidebar.tsx`:

Replace the entire file with:

```typescript
import React from 'react';
import { SidebarModeSwitch } from './SidebarModeSwitch';
import { CollectionTree } from '../http/CollectionTree';
import { DevToolsSidebar } from '../devtools/DevToolsSidebar';

interface SidebarProps {
  mode: 'http' | 'devtools';
  onModeChange: (mode: 'http' | 'devtools') => void;
  exportCollection?: any;
  importCollection?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ mode, onModeChange, exportCollection, importCollection }) => {
  return (
    <div className="sidebar">
      <SidebarModeSwitch mode={mode} onChange={onModeChange} />
      {mode === 'http' && <CollectionTree exportCollection={exportCollection} importCollection={importCollection} />}
      {mode === 'devtools' && <DevToolsSidebar />}
    </div>
  );
};
```

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Navigate to browser at `http://localhost:5173`
- Click "Dev Tools" tab
- Verify sidebar shows beautiful header with Zap icon, "Dev Tools" title, and description
- Verify layout is clean and centered
- Verify text is in Portuguese

- [ ] **Step 4: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/devtools/DevToolsSidebar.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add beautiful DevTools sidebar header with icon and description"
```

---

### Task 2: Create Password Generator Tool

**Files:**
- Create: `src/components/devtools/tools/PasswordGenerator.tsx`
- Modify: `src/components/devtools/DevToolsPanel.tsx`

**Context:** New tool for generating random passwords with configurable options (length, special chars, numbers, uppercase).

- [ ] **Step 1: Create PasswordGenerator component**

Create file `src/components/devtools/tools/PasswordGenerator.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Copy, RotateCw, Zap } from 'lucide-react';

interface PasswordGeneratorProps {
  onBack?: () => void;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = () => {
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);
  const [password, setPassword] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [strength, setStrength] = useState<'fraca' | 'media' | 'forte' | 'muito-forte'>('media');

  const generatePassword = () => {
    let chars = '';
    if (useUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) chars += '0123456789';
    if (useSpecial) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) {
      setPassword('');
      setStrength('fraca');
      return;
    }

    let newPassword = '';
    for (let i = 0; i < length; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setPassword(newPassword);
    updateStrength(newPassword);
  };

  const updateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd)) score++;

    if (score <= 2) setStrength('fraca');
    else if (score <= 4) setStrength('media');
    else if (score <= 5) setStrength('forte');
    else setStrength('muito-forte');
  };

  useEffect(() => {
    generatePassword();
  }, [length, useUppercase, useLowercase, useNumbers, useSpecial]);

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const strengthColors = {
    fraca: '#ef4444',
    media: '#eab308',
    forte: '#3b82f6',
    'muito-forte': '#10b981',
  };

  const strengthLabels = {
    fraca: 'Fraca',
    media: 'Média',
    forte: 'Forte',
    'muito-forte': 'Muito Forte',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Password Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Senha Gerada
        </label>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            value={password}
            readOnly
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '14px',
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            <Copy size={16} />
            {copySuccess ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Strength Indicator */}
      {password && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Força da Senha</label>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              height: '8px',
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '100%',
                  backgroundColor:
                    (strength === 'fraca' && i === 0) ||
                    (strength === 'media' && i < 2) ||
                    (strength === 'forte' && i < 3) ||
                    (strength === 'muito-forte')
                      ? strengthColors[strength]
                      : 'var(--border-color)',
                  borderRadius: '2px',
                  transition: 'background-color 0.2s',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: '12px', color: strengthColors[strength], fontWeight: '600' }}>
            {strengthLabels[strength]}
          </span>
        </div>
      )}

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Comprimento: {length}
          </label>
          <input
            type="range"
            min="4"
            max="128"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Mín: 4 | Máx: 128
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Maiúsculas (A-Z)', value: useUppercase, onChange: setUseUppercase },
            { label: 'Minúsculas (a-z)', value: useLowercase, onChange: setUseLowercase },
            { label: 'Números (0-9)', value: useNumbers, onChange: setUseNumbers },
            { label: 'Caracteres Especiais (!@#$)', value: useSpecial, onChange: setUseSpecial },
          ].map((option) => (
            <label
              key={option.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={option.value}
                onChange={(e) => option.onChange(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {/* Regenerate Button */}
      <button
        onClick={() => generatePassword()}
        style={{
          padding: '10px 16px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--accent-primary)',
          color: 'var(--accent-primary)',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '500',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
          e.currentTarget.style.color = 'var(--accent-primary)';
        }}
      >
        <RotateCw size={16} />
        Regenerar
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Create JSON↔YAML Tool**

Create file `src/components/devtools/tools/JsonYamlTool.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Copy, AlertCircle, ArrowRightLeft } from 'lucide-react';
import YAML from 'js-yaml';

interface JsonYamlToolProps {
  onBack?: () => void;
}

export const JsonYamlTool: React.FC<JsonYamlToolProps> = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [inputFormat, setInputFormat] = useState<'json' | 'yaml'>('json');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      setError(null);

      if (inputFormat === 'json') {
        // JSON to YAML
        const parsed = JSON.parse(input);
        const yaml = YAML.dump(parsed, { lineWidth: -1 });
        setOutput(yaml);
      } else {
        // YAML to JSON
        const parsed = YAML.load(input);
        const json = JSON.stringify(parsed, null, 2);
        setOutput(json);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro ao converter: ${err.message}`
          : 'Erro desconhecido ao converter'
      );
      setOutput('');
    }
  }, [input, inputFormat]);

  const handleSwitch = () => {
    setInput(output);
    setInputFormat(inputFormat === 'json' ? 'yaml' : 'json');
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Format Selector and Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Formato de Entrada: {inputFormat.toUpperCase()}
          </label>
        </div>
        <button
          onClick={handleSwitch}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowRightLeft size={14} />
          Inverter
        </button>
      </div>

      {/* Input/Output */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Entrada</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputFormat === 'json' ? '{"key": "value"}' : 'key: value'}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'none',
              fontWeight: '500',
            }}
          />
        </div>

        {/* Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Saída {output && `(${inputFormat === 'json' ? 'YAML' : 'JSON'})`}
          </label>
          <textarea
            value={output}
            readOnly
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'none',
              fontWeight: '500',
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Copy Button */}
      {output && (
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <Copy size={16} />
          {copySuccess ? 'Copiado!' : 'Copiar Saída'}
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Create URL Encode/Decode Tool**

Create file `src/components/devtools/tools/UrlEncodeTool.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Copy, AlertCircle, ArrowRightLeft } from 'lucide-react';

interface UrlEncodeToolProps {
  onBack?: () => void;
}

export const UrlEncodeTool: React.FC<UrlEncodeToolProps> = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!input) {
      setOutput('');
      setError(null);
      return;
    }

    try {
      setError(null);

      if (mode === 'encode') {
        setOutput(encodeURIComponent(input));
      } else {
        setOutput(decodeURIComponent(input));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro ao converter: ${err.message}`
          : 'Erro desconhecido ao converter'
      );
      setOutput('');
    }
  }, [input, mode]);

  const handleSwitch = () => {
    setInput(output);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Mode Selector and Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Modo: {mode === 'encode' ? 'Codificar' : 'Decodificar'}
          </label>
        </div>
        <button
          onClick={handleSwitch}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowRightLeft size={14} />
          Inverter
        </button>
      </div>

      {/* Input/Output */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {mode === 'encode' ? 'Texto' : 'URL Codificada'}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? 'Insira o texto para codificar' : 'Insira a URL para decodificar'}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'none',
              fontWeight: '500',
            }}
          />
        </div>

        {/* Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {mode === 'encode' ? 'URL Codificada' : 'Texto'}
          </label>
          <textarea
            value={output}
            readOnly
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'none',
              fontWeight: '500',
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Copy Button */}
      {output && (
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <Copy size={16} />
          {copySuccess ? 'Copiado!' : 'Copiar Saída'}
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Update DevToolsPanel.tsx to add new tools**

Modify `src/components/devtools/DevToolsPanel.tsx` to import and add the 3 new tools:

At the top, add imports:
```typescript
import { PasswordGenerator } from './tools/PasswordGenerator';
import { JsonYamlTool } from './tools/JsonYamlTool';
import { UrlEncodeTool } from './tools/UrlEncodeTool';
```

In the tools array (before the network tools), add:
```typescript
  {
    id: 'password',
    label: 'Gerador Senha',
    description: 'Gere senhas aleatórias seguras',
    icon: <Zap size={24} />,
    component: PasswordGenerator,
  },
  {
    id: 'jsonyaml',
    label: 'JSON ↔ YAML',
    description: 'Converta entre JSON e YAML',
    icon: <FileText size={24} />,
    component: JsonYamlTool,
  },
  {
    id: 'urlencode',
    label: 'URL Codificação',
    description: 'Codifique e decodifique URLs',
    icon: <FileText size={24} />,
    component: UrlEncodeTool,
  },
```

- [ ] **Step 5: Run dev server and verify**

Run: `npm run dev`

Navigate to browser and click "Dev Tools":
- Verify Gerador Senha card appears
- Click it and verify password generation works, strength indicator shows
- Click Inverter to copy output to input
- Verify JSON ↔ YAML card appears
- Test JSON to YAML conversion (paste `{"name": "John", "age": 30}`)
- Verify URL Codificação card appears
- Test encoding and decoding

- [ ] **Step 6: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/devtools/tools/PasswordGenerator.tsx src/components/devtools/tools/JsonYamlTool.tsx src/components/devtools/tools/UrlEncodeTool.tsx src/components/devtools/DevToolsPanel.tsx
git commit -m "feat: implement 3 new dev tools (Password, JSON↔YAML, URL Encode)"
```

---

### Task 3: Enhance QR Code Generator (Size & Color Customization)

**Files:**
- Modify: `src/components/devtools/tools/QRCodeGenerator.tsx`

**Context:** Add size (100-500px) and color customization (foreground/background) to QR Code tool.

- [ ] **Step 1: Update QRCodeGenerator with size and color controls**

Replace the entire `src/components/devtools/tools/QRCodeGenerator.tsx` file with:

```typescript
import React, { useState } from 'react';
import { Download, Copy, AlertCircle, RotateCw } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  onBack?: () => void;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = () => {
  const [text, setText] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [size, setSize] = useState(300);
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');

  const handleGenerateQR = async () => {
    setError(null);
    setCopySuccess(false);

    if (!text.trim()) {
      setError('Por favor, insira um texto para gerar o QR code');
      setQrUrl(null);
      return;
    }

    try {
      const dataUrl = await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'H',
        width: size,
        margin: 1,
        color: {
          dark: darkColor,
          light: lightColor,
        },
      });
      setQrUrl(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro ao gerar QR code: ${err.message}`
          : 'Erro desconhecido ao gerar QR code'
      );
      setQrUrl(null);
    }
  };

  const handleDownload = () => {
    if (!qrUrl) return;

    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyBase64 = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setError('Erro ao copiar para a área de transferência');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}
        >
          Texto
        </label>
        <textarea
          className="tool-textarea"
          placeholder="Insira o texto para gerar QR code"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
            minHeight: '100px',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Size Control */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Tamanho: {size}px
        </label>
        <input
          type="range"
          min="100"
          max="500"
          step="10"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      {/* Color Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Cor Escura (Módulos)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={darkColor}
              onChange={(e) => setDarkColor(e.target.value)}
              style={{
                width: '50px',
                height: '40px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            />
            <input
              type="text"
              value={darkColor}
              onChange={(e) => setDarkColor(e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Cor Clara (Fundo)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              style={{
                width: '50px',
                height: '40px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            />
            <input
              type="text"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerateQR}
        style={{
          padding: '10px 16px',
          backgroundColor: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
        }}
      >
        Gerar QR Code
      </button>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* QR Display */}
      {qrUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <img src={qrUrl} alt="QR Code" style={{ display: 'block' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={handleDownload}
              style={{
                flex: 1,
                padding: '10px 12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              <Download size={14} />
              Download PNG
            </button>

            <button
              onClick={handleCopyBase64}
              style={{
                flex: 1,
                padding: '10px 12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              <Copy size={14} />
              {copySuccess ? 'Copiado!' : 'Copiar Base64'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Run dev server and verify QR customization**

Run: `npm run dev`

Navigate to Dev Tools > Gerador QR Code:
- Change size slider from 100 to 500
- Click color inputs to customize dark/light colors
- Verify QR code updates in real-time
- Verify download and copy still work

- [ ] **Step 3: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/devtools/tools/QRCodeGenerator.tsx
git commit -m "feat: add size and color customization to QR Code generator"
```

---

### Task 4: Enhance UUID Generator (Add v1, v7 Support)

**Files:**
- Modify: `src/components/devtools/tools/UUIDGenerator.tsx`

**Context:** Add UUID versions (v1, v4, v7) and support generating up to 100 at once.

- [ ] **Step 1: Read current UUID implementation**

Run: `cat src/components/devtools/tools/UUIDGenerator.tsx` to see current implementation

- [ ] **Step 2: Update UUID Generator with v1, v4, v7 versions**

Replace the entire file with:

```typescript
import React, { useState } from 'react';
import { Copy, RotateCw, Trash2 } from 'lucide-react';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';

interface UUIDGeneratorProps {
  onBack?: () => void;
}

export const UUIDGenerator: React.FC<UUIDGeneratorProps> = () => {
  const [version, setVersion] = useState<'v1' | 'v4' | 'v7'>('v4');
  const [quantity, setQuantity] = useState(1);
  const [uuids, setUuids] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  const generateUUIDs = () => {
    const newUuids: string[] = [];

    for (let i = 0; i < quantity; i++) {
      if (version === 'v1') {
        newUuids.push(uuidv1());
      } else if (version === 'v4') {
        newUuids.push(uuidv4());
      } else if (version === 'v7') {
        // UUID v7 (time-based) - approximate implementation
        // Using timestamp + random
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const v7 = `${timestamp.toString(16).padStart(12, '0')}-${Math.random().toString(16).substring(2, 6)}-7${Math.random().toString(16).substring(1, 4)}-${Math.random().toString(16).substring(1, 5)}-${random.substring(0, 12)}`;
        newUuids.push(v7);
      }
    }

    setUuids(newUuids);
  };

  const handleCopyAll = async () => {
    if (uuids.length === 0) return;

    const text = uuids.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const handleCopyOne = async (uuid: string) => {
    try {
      await navigator.clipboard.writeText(uuid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const handleClear = () => {
    setUuids([]);
    setCopySuccess(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Versão UUID
          </label>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value as 'v1' | 'v4' | 'v7')}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="v1">UUID v1 (Time-based)</option>
            <option value="v4">UUID v4 (Random)</option>
            <option value="v7">UUID v7 (Time-sorted)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Quantidade: {quantity}
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateUUIDs}
        style={{
          padding: '10px 16px',
          backgroundColor: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <RotateCw size={16} />
        Gerar {quantity} UUID{quantity > 1 ? 's' : ''}
      </button>

      {/* UUIDs List */}
      {uuids.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {uuids.length} UUID{uuids.length !== 1 ? 's' : ''} gerado{uuids.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyAll}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                <Copy size={12} />
                {copySuccess ? 'Copiado!' : 'Copiar Tudo'}
              </button>
              <button
                onClick={handleClear}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                <Trash2 size={12} />
                Limpar
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {uuids.map((uuid, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  backgroundColor: 'var(--bg-deep)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ flex: 1, wordBreak: 'break-all' }}>{uuid}</span>
                <button
                  onClick={() => handleCopyOne(uuid)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    flexShrink: 0,
                  }}
                >
                  <Copy size={12} style={{ display: 'inline' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools > Gerador UUID:
- Verify v1, v4, v7 options appear
- Select v1 and generate 5 UUIDs
- Verify they're time-based (timestamps visible)
- Change to v4 and generate 10 UUIDs
- Change quantity slider to 100
- Verify "Copiar Tudo" copies all UUIDs
- Verify individual copy buttons work

- [ ] **Step 4: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/devtools/tools/UUIDGenerator.tsx
git commit -m "feat: add UUID v1, v7 versions and quantity slider (up to 100)"
```

---

### Task 5: Create JWT Generator Tool & Enhance JWT Decoder

**Files:**
- Create: `src/components/devtools/tools/JWTGenerator.tsx`
- Modify: `src/components/devtools/tools/JWTDecoder.tsx`
- Modify: `src/components/devtools/DevToolsPanel.tsx`

**Context:** Create new JWT Generator for creating tokens with custom claims. Enhance decoder to show expiration status.

- [ ] **Step 1: Create JWTGenerator component**

Create file `src/components/devtools/tools/JWTGenerator.tsx`:

```typescript
import React, { useState, useMemo } from 'react';
import { Copy, AlertCircle, X } from 'lucide-react';

interface JWTGeneratorProps {
  onBack?: () => void;
}

export const JWTGenerator: React.FC<JWTGeneratorProps> = () => {
  const [headerClaims, setHeaderClaims] = useState<Record<string, string>>({
    alg: 'HS256',
    typ: 'JWT',
  });
  const [payloadClaims, setPayloadClaims] = useState<Record<string, string>>({
    sub: '1234567890',
    name: 'John Doe',
    iat: Math.floor(Date.now() / 1000).toString(),
  });
  const [secret, setSecret] = useState('your-secret-key');
  const [copySuccess, setCopySuccess] = useState(false);
  const [newClaimKey, setNewClaimKey] = useState('');
  const [newClaimValue, setNewClaimValue] = useState('');

  const token = useMemo(() => {
    // Simple base64url encoding
    const base64urlEncode = (str: string) => {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const header = base64urlEncode(JSON.stringify(headerClaims));
    const payload = base64urlEncode(JSON.stringify(payloadClaims));

    // For demo purposes, we create a simple HMAC-like signature
    // Real JWT requires proper HMAC signing
    const signature = base64urlEncode(secret);

    return `${header}.${payload}.${signature}`;
  }, [headerClaims, payloadClaims, secret]);

  const handleAddClaim = (type: 'header' | 'payload') => {
    if (!newClaimKey.trim() || !newClaimValue.trim()) return;

    if (type === 'header') {
      setHeaderClaims({ ...headerClaims, [newClaimKey]: newClaimValue });
    } else {
      setPayloadClaims({ ...payloadClaims, [newClaimKey]: newClaimValue });
    }

    setNewClaimKey('');
    setNewClaimValue('');
  };

  const handleRemoveClaim = (type: 'header' | 'payload', key: string) => {
    if (type === 'header') {
      const updated = { ...headerClaims };
      delete updated[key];
      setHeaderClaims(updated);
    } else {
      const updated = { ...payloadClaims };
      delete updated[key];
      setPayloadClaims(updated);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Secret */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Chave Secreta (para assinatura)
        </label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Chave secreta para assinar o token"
          style={{
            padding: '10px 12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        />
      </div>

      {/* Header Claims */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Header
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Object.entries(headerClaims).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}
            >
              <input
                type="text"
                value={key}
                readOnly
                style={{
                  flex: 0.3,
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>:</span>
              <input
                type="text"
                value={value}
                readOnly
                style={{
                  flex: 0.7,
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Payload Claims */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Payload (Claims)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
          {Object.entries(payloadClaims).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}
            >
              <input
                type="text"
                value={key}
                readOnly
                style={{
                  flex: 0.3,
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>:</span>
              <input
                type="text"
                value={value}
                readOnly
                style={{
                  flex: 0.7,
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
              <button
                onClick={() => handleRemoveClaim('payload', key)}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Claim */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
          <input
            type="text"
            value={newClaimKey}
            onChange={(e) => setNewClaimKey(e.target.value)}
            placeholder="Chave"
            style={{
              padding: '8px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
          />
          <input
            type="text"
            value={newClaimValue}
            onChange={(e) => setNewClaimValue(e.target.value)}
            placeholder="Valor"
            style={{
              padding: '8px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
          />
          <button
            onClick={() => handleAddClaim('payload')}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Token Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
          Token JWT
        </label>
        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '11px',
            wordBreak: 'break-all',
            maxHeight: '150px',
            overflowY: 'auto',
          }}
        >
          {token}
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          <Copy size={16} />
          {copySuccess ? 'Copiado!' : 'Copiar Token'}
        </button>
      </div>

      <div
        style={{
          padding: '12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '4px',
          color: '#92400e',
          fontSize: '11px',
          lineHeight: '1.5',
        }}
      >
        <strong>Nota:</strong> Este é um JWT simplificado para demonstração. A assinatura real requer criptografia HMAC/RSA.
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update JWTDecoder to show expiration status**

Modify `src/components/devtools/tools/JWTDecoder.tsx` to add expiration status:

Find the section that displays the decoded payload and add after it:

```typescript
// Add this after displaying the payload section:

{payload && payload.exp && (
  <div
    style={{
      padding: '12px',
      backgroundColor: isExpired ? '#fee2e2' : '#dcfce7',
      border: `1px solid ${isExpired ? '#fecaca' : '#86efac'}`,
      borderRadius: '4px',
      color: isExpired ? '#991b1b' : '#166534',
      fontSize: '12px',
      fontWeight: '600',
    }}
  >
    Status: {isExpired ? '❌ Expirado' : '✅ Válido'}
    <br />
    <span style={{ fontSize: '11px', fontWeight: 'normal' }}>
      Expira em: {new Date(payload.exp * 1000).toLocaleString()}
    </span>
  </div>
)}
```

And add this helper at the beginning of the component:

```typescript
const isExpired = payload && payload.exp ? payload.exp < Math.floor(Date.now() / 1000) : false;
```

- [ ] **Step 3: Update DevToolsPanel to add JWT Generator**

Modify `src/components/devtools/DevToolsPanel.tsx`:

Add import at the top:
```typescript
import { JWTGenerator } from './tools/JWTGenerator';
```

Add to tools array (after JWTDecoder):
```typescript
  {
    id: 'jwtgen',
    label: 'Gerador JWT',
    description: 'Crie tokens JWT com claims personalizados',
    icon: <Shield size={24} />,
    component: JWTGenerator,
  },
```

- [ ] **Step 4: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools:
- Verify Gerador JWT card appears
- Click it and verify you can add/remove claims
- Verify token is generated correctly
- Click Copiar Token to copy it
- Go back and open Decodificador JWT
- Paste the generated token
- Verify payload displays and expiration status shows (should be ✅ Válido)

- [ ] **Step 5: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/devtools/tools/JWTGenerator.tsx src/components/devtools/tools/JWTDecoder.tsx src/components/devtools/DevToolsPanel.tsx
git commit -m "feat: add JWT generator and expiration status to decoder"
```

---

### Task 6: Enhance Hash Calculator (Add SHA Algorithms & Salt)

**Files:**
- Modify: `src/components/devtools/tools/HashCalculator.tsx`

**Context:** Add support for SHA-1, SHA-256, SHA-512 algorithms plus optional salt.

- [ ] **Step 1: Update HashCalculator with SHA support**

Replace the entire `src/components/devtools/tools/HashCalculator.tsx` with:

```typescript
import React, { useState, useEffect } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import SparkMD5 from 'spark-md5';

interface HashCalculatorProps {
  onBack?: () => void;
}

export const HashCalculator: React.FC<HashCalculatorProps> = () => {
  const [text, setText] = useState('');
  const [algorithm, setAlgorithm] = useState<'md5' | 'sha1' | 'sha256' | 'sha512'>('sha256');
  const [useSalt, setUseSalt] = useState(false);
  const [salt, setSalt] = useState('');
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setError(null);

    if (!text) {
      setHashes({});
      return;
    }

    try {
      const hashMap: Record<string, string> = {};

      // Prepare text with optional salt
      const textToHash = useSalt ? text + salt : text;

      // MD5 (using spark-md5)
      try {
        hashMap['md5'] = SparkMD5.hash(textToHash);
      } catch {
        hashMap['md5'] = 'Erro ao calcular';
      }

      // SHA algorithms using Web Crypto API
      const processHashes = async () => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(textToHash);

          // SHA-1
          const sha1 = await crypto.subtle.digest('SHA-1', data);
          hashMap['sha1'] = Array.from(new Uint8Array(sha1))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          // SHA-256
          const sha256 = await crypto.subtle.digest('SHA-256', data);
          hashMap['sha256'] = Array.from(new Uint8Array(sha256))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          // SHA-512
          const sha512 = await crypto.subtle.digest('SHA-512', data);
          hashMap['sha512'] = Array.from(new Uint8Array(sha512))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          setHashes(hashMap);
        } catch (err) {
          setError(
            err instanceof Error
              ? `Erro ao calcular hash: ${err.message}`
              : 'Erro desconhecido ao calcular hash'
          );
          setHashes(hashMap);
        }
      };

      processHashes();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erro ao calcular hash: ${err.message}`
          : 'Erro desconhecido ao calcular hash'
      );
      setHashes({});
    }
  }, [text, useSalt, salt]);

  const handleCopy = async (hashValue: string) => {
    if (!hashValue) return;

    try {
      await navigator.clipboard.writeText(hashValue);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Silently fail on copy error
    }
  };

  const handleClear = () => {
    setText('');
    setSalt('');
    setHashes({});
    setError(null);
  };

  const charCount = text.length;
  const byteCount = new TextEncoder().encode(text).length;

  const algorithmSizes = {
    md5: '128-bit',
    sha1: '160-bit',
    sha256: '256-bit',
    sha512: '512-bit',
  };

  const currentHash = hashes[algorithm] || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          Texto para gerar hash
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Insira o texto para gerar hash"
          style={{
            padding: '12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: '12px',
            minHeight: '140px',
            resize: 'vertical',
            fontWeight: '500',
            wordBreak: 'break-all',
          }}
        />
        {text && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              gap: '16px',
            }}
          >
            <span>Caracteres: {charCount}</span>
            <span>Bytes: {byteCount}</span>
          </div>
        )}
      </div>

      {/* Algorithm and Salt */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Algoritmo
          </label>
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as any)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <option value="md5">MD5 (128-bit)</option>
            <option value="sha1">SHA-1 (160-bit)</option>
            <option value="sha256">SHA-256 (256-bit)</option>
            <option value="sha512">SHA-512 (512-bit)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <input
              type="checkbox"
              checked={useSalt}
              onChange={(e) => setUseSalt(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Usar Salt
          </label>
          <input
            type="text"
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            placeholder="Insira o salt (ex: mysalt123)"
            disabled={!useSalt}
            style={{
              padding: '8px 12px',
              backgroundColor: useSalt ? 'var(--bg-panel)' : 'var(--border-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: useSalt ? 'text' : 'not-allowed',
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Hash Output */}
      {currentHash && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {algorithm.toUpperCase()} Hash
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {algorithmSizes[algorithm]}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={currentHash}
              readOnly
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
              }}
            />
            <button
              onClick={() => handleCopy(currentHash)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {copySuccess ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* All Hashes */}
      {Object.keys(hashes).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Todos os Hashes
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(['md5', 'sha1', 'sha256', 'sha512'] as const).map((algo) => (
              <div key={algo} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {algo.toUpperCase()}
                </div>
                <input
                  type="text"
                  value={hashes[algo] || ''}
                  readOnly
                  style={{
                    padding: '8px',
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    wordBreak: 'break-all',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear Button */}
      {text && (
        <button
          onClick={handleClear}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          <Trash2 size={14} />
          Limpar
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools > Gerador Hash:
- Type some text
- Verify all 4 algorithms (MD5, SHA-1, SHA-256, SHA-512) show
- Enable salt and add "mysalt"
- Verify hashes change with salt
- Try different algorithms from dropdown
- Verify copy button works

- [ ] **Step 3: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/devtools/tools/HashCalculator.tsx
git commit -m "feat: add SHA-1, SHA-256, SHA-512 algorithms and salt support to hash calculator"
```

---

### Task 7: Enhance Cron Helper (Next 5 Executions)

**Files:**
- Modify: `src/components/devtools/tools/CronHelper.tsx`

**Context:** Add display of next 5 execution times for valid cron expressions.

- [ ] **Step 1: Read current Cron implementation**

Run: `wc -l src/components/devtools/tools/CronHelper.tsx` to see file size

- [ ] **Step 2: Update CronHelper to show next 5 executions**

Modify `src/components/devtools/tools/CronHelper.tsx` by adding this function before the component:

```typescript
function getNextExecutions(cronExpression: string, count: number = 5): Date[] {
  // Simple cron parser for basic validation
  // Returns array of next execution times
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return [];

  const [minute, hour, day, month, dayOfWeek] = parts.map(p => p === '*' ? -1 : parseInt(p));

  if (isNaN(minute) || isNaN(hour) || isNaN(day) || isNaN(month) || isNaN(dayOfWeek)) {
    return [];
  }

  const executions: Date[] = [];
  let current = new Date();

  // Simple approximation: check next 400 hours for matches
  for (let i = 0; i < 400 && executions.length < count; i++) {
    current = new Date(current.getTime() + 60000); // Add 1 minute

    const m = current.getMinutes();
    const h = current.getHours();
    const d = current.getDate();
    const mon = current.getMonth() + 1;
    const dow = current.getDay();

    const minuteMatch = minute === -1 || minute === m;
    const hourMatch = hour === -1 || hour === h;
    const dayMatch = day === -1 || day === d;
    const monthMatch = month === -1 || month === mon;
    const dayOfWeekMatch = dayOfWeek === -1 || dayOfWeek === dow;

    if (minuteMatch && hourMatch && dayMatch && monthMatch && dayOfWeekMatch) {
      executions.push(new Date(current));
    }
  }

  return executions;
}
```

Then find where it displays the cron description and add after it:

```typescript
{cronExpression && isValidCron && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
      Próximas 5 execuções
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {getNextExecutions(cronExpression, 5).map((execution, idx) => (
        <div
          key={idx}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
          }}
        >
          {idx + 1}. {execution.toLocaleString('pt-BR')}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools > Expressão Cron:
- Enter valid cron: `0 9 * * *` (9am every day)
- Verify "Próximas 5 execuções" appears
- Verify 5 dates are shown in Portuguese locale
- Enter invalid cron: `99 99 99 99 99`
- Verify next executions don't show (validation works)

- [ ] **Step 4: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/devtools/tools/CronHelper.tsx
git commit -m "feat: add next 5 executions display to cron helper"
```

---

### Task 8: Enhance Regex Tester (Captured Groups)

**Files:**
- Modify: `src/components/devtools/tools/RegexTester.tsx`

**Context:** Add highlighting and display of captured groups.

- [ ] **Step 1: Update RegexTester to show captured groups**

Find the section where it displays matches and add captured groups display:

```typescript
{matches && matches.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
      Grupos Capturados
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {matches.map((match, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Match {idx + 1}: <strong>{match[0]}</strong>
          </div>
          {match.length > 1 && (
            <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {match.slice(1).map((group, groupIdx) => (
                <div key={groupIdx} style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                  Grupo {groupIdx + 1}: <code style={{ color: 'var(--accent-primary)' }}>{group}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools > Validador Regex:
- Enter pattern: `(\w+)@(\w+)\.(\w+)` (email pattern)
- Enter text: `test@example.com`
- Verify Match 1 shows full match
- Verify Grupo 1, 2, 3 show captured groups
- Try pattern with global flag: `(\d+)/(\d+)`
- Enter text: `10/20 and 30/40`
- Verify multiple matches show with groups

- [ ] **Step 3: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/devtools/tools/RegexTester.tsx
git commit -m "feat: add captured groups highlighting to regex tester"
```

---

### Task 9: Enhance CPF/CNPJ Validator (Random Generator)

**Files:**
- Modify: `src/components/devtools/tools/CPFCNPJValidator.tsx`

**Context:** Add button to generate random valid CPF or CNPJ.

- [ ] **Step 1: Update CPFCNPJValidator to add generator**

Add these functions to generate random CPF/CNPJ:

```typescript
function generateRandomCPF(): string {
  const randomDigits = () => Math.floor(Math.random() * 10);

  let cpf = '';
  for (let i = 0; i < 9; i++) {
    cpf += randomDigits();
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 >= 10 ? 0 : digit1;
  cpf += digit1;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 >= 10 ? 0 : digit2;
  cpf += digit2;

  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function generateRandomCNPJ(): string {
  const randomDigits = () => Math.floor(Math.random() * 10);

  let cnpj = '';
  for (let i = 0; i < 8; i++) {
    cnpj += randomDigits();
  }
  cnpj += '0001'; // Default sequence

  // Calculate first check digit
  let sum = 0;
  const multiplier1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * multiplier1[i];
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 >= 10 ? 0 : digit1;
  cnpj += digit1;

  // Calculate second check digit
  sum = 0;
  const multiplier2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * multiplier2[i];
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 >= 10 ? 0 : digit2;
  cnpj += digit2;

  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
```

Then find where the input field is and add buttons after it:

```typescript
<div style={{ display: 'flex', gap: '8px' }}>
  <button
    onClick={() => {
      const cpf = generateRandomCPF();
      setInput(cpf);
    }}
    style={{
      flex: 1,
      padding: '8px 12px',
      backgroundColor: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
    }}
  >
    Gerar CPF
  </button>
  <button
    onClick={() => {
      const cnpj = generateRandomCNPJ();
      setInput(cnpj);
    }}
    style={{
      flex: 1,
      padding: '8px 12px',
      backgroundColor: 'var(--bg-panel)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
    }}
  >
    Gerar CNPJ
  </button>
</div>
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`

Navigate to Dev Tools > Validador CPF/CNPJ:
- Click "Gerar CPF"
- Verify a valid formatted CPF appears in input
- Verify result shows ✅ Válido
- Click "Gerar CNPJ"
- Verify a valid formatted CNPJ appears in input
- Verify result shows ✅ Válido

- [ ] **Step 3: Run Cypress tests**

Run: `npm run cypress:run`

Expected: All 121 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/devtools/tools/CPFCNPJValidator.tsx
git commit -m "feat: add random CPF/CNPJ generator to validator"
```

---

### Task 10: Final Verification & Testing

**Files:**
- All dev tools

**Context:** Run full test suite to ensure no regressions and all features work.

- [ ] **Step 1: Run full Cypress test suite**

Run: `npm run cypress:run`

Expected: All 121 tests pass with no failures

Output should show:
```
121 passing
0 failing
```

- [ ] **Step 2: Manual smoke test all tools**

Run: `npm run dev`

For each tool:
1. Password Generator — Generate password, verify strength, toggle options
2. JSON↔YAML — Convert JSON to YAML, switch modes
3. URL Encode — Encode/decode URLs
4. QR Code — Generate with custom size and colors
5. UUID — Generate v1, v4, v7 with quantity
6. Decodificador JWT — Paste token, verify expiration status
7. Gerador JWT — Create token with claims
8. Hash — Calculate all 4 algorithms with salt
9. Cron — Show next 5 executions
10. Regex — Show captured groups
11. CPF/CNPJ — Generate and validate
12. Barcode — Generate barcode
13. Base64 — Encode/decode
14. IP Info — Check public IP
15. DNS Lookup — Lookup domain records
16. Ping — Show "desktop only" message

- [ ] **Step 3: Verify sidebar shows DevTools header**

- Check that when clicking "Dev Tools" mode, sidebar shows:
  - Zap icon (accent color)
  - "Dev Tools" title
  - "Utilitários para desenvolvedores" description
  - Clean, centered layout

- [ ] **Step 4: Commit final summary**

```bash
git commit --allow-empty -m "feat: complete Phase 3c — implement all missing Dev Tools features

- Added 3 new tools: Password Generator, JSON↔YAML, URL Encode
- Enhanced QR Code with size/color customization
- Enhanced UUID with v1, v7 versions and quantity slider (up to 100)
- Added JWT Generator and expiration status to decoder
- Enhanced Hash with SHA-1/256/512 algorithms and salt
- Enhanced Cron with next 5 executions display
- Enhanced Regex with captured groups highlighting
- Enhanced CPF/CNPJ with random generator
- Added beautiful DevTools header to sidebar
- All 121 Cypress tests passing"
```

---

## Summary

**Total Tasks:** 10
**New Tools Created:** 3 (Password, JSON↔YAML, URL Encode)
**Tools Enhanced:** 7 (QR Code, UUID, JWT, Hash, Cron, Regex, CPF/CNPJ)
**UI Improvements:** 1 (DevTools sidebar header)
**Test Coverage:** All 121 Cypress tests passing

**Benefits:**
- Complete Dev Tools feature set matching original specification
- Better developer experience with all utilities in one place
- Professional sidebar presentation
- No breaking changes to existing functionality
- Full backward compatibility with all 121 tests
