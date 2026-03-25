# TDD Cypress Tests — AuraFetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar ~79 novos testes Cypress E2E cobrindo todas as funcionalidades do AuraFetch e as regressões dos 13 bugs corrigidos na Fase 1, usando arquivos reais e geração dinâmica de arquivos grandes.

**Architecture:** 100% Cypress (sem Vitest/Jest). Novos arquivos de spec em `cypress/e2e/`, arquivos grandes gerados via `cy.task('generateLargeFile')` em `os.tmpdir()` (nunca commitados), `cy.intercept()` para controlar payloads de response, `cy.window()` para localStorage e spies. Task 2 adiciona web fallback de file picker em `src/App.tsx` (hidden `<input type="file">`) para que os testes de upload funcionem no browser sem Tauri.

**Tech Stack:** Cypress 15, TypeScript, React 19, Vite 5, `cy.intercept()`, `cy.task()`, `cy.stub()`, `selectFile()`.

**Spec:** `docs/superpowers/specs/2026-03-25-tdd-cypress-tests-design.md`

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `cypress.config.ts` | Modificar | Registrar tasks `generateLargeFile` e `cleanupTempFiles` |
| `cypress/tasks/file-tasks.ts` | Criar | Geração e limpeza de arquivos temporários grandes |
| `cypress/fixtures/small-file.txt` | Criar | 1KB de texto ASCII para testes form-data |
| `cypress/fixtures/sample-image.png` | Criar | PNG mínimo válido para testes binary/imagem |
| `cypress/fixtures/sample-collection.json` | Criar | Coleção com 1 workspace, 2 pastas, 3 requests, 1 env |
| `src/App.tsx` | Modificar | Web fallback para `pickFormDataFile` e `pickBinaryFile` (hidden inputs) |
| `cypress/e2e/bug_fixes_phase1.cy.ts` | Criar | 13 regressões dos bugs corrigidos na Fase 1 |
| `cypress/e2e/file_upload.cy.ts` | Criar | Upload real (form-data, binary, size guard 50MB) |
| `cypress/e2e/response_rendering.cy.ts` | Criar | JSON, HTML, imagem, binário, metadados, persistência |
| `cypress/e2e/import_export.cy.ts` | Criar | Import/export de coleção, download de response |
| `cypress/e2e/auth.cy.ts` | Criar | Bearer, Basic, API Key, OAuth2 UI, herança de pasta |
| `cypress/e2e/websocket_ui.cy.ts` | Modificar | + fluxo completo (requer Tauri — skip automático no browser) |
| `cypress/e2e/professional_features.cy.ts` | Modificar | + code snippets (cURL, fetch, axios) |
| `cypress/e2e/core_stability.cy.ts` | Modificar | + histórico completo, busca simultânea, env persistence |
| `cypress/e2e/workspace_tree.cy.ts` | Modificar | + rename inline, duplicar, envs independentes |

---

## Task 1: Infraestrutura — tasks, fixtures, cypress.config

**Files:**
- Create: `cypress/tasks/file-tasks.ts`
- Create: `cypress/fixtures/small-file.txt`
- Create: `cypress/fixtures/sample-collection.json`
- Modify: `cypress.config.ts`

> `sample-image.png` é um PNG binário mínimo — criado via Node.js no passo abaixo.

- [ ] **Passo 1.1: Criar `cypress/tasks/file-tasks.ts`**

```typescript
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const tempFiles: string[] = []

export function generateLargeFile({ sizeMb, name }: { sizeMb: number; name?: string }): string {
  const filePath = path.join(os.tmpdir(), name ?? `test-file-${sizeMb}mb-${Date.now()}.bin`)
  const buffer = Buffer.alloc(sizeMb * 1024 * 1024, 0)
  fs.writeFileSync(filePath, buffer)
  tempFiles.push(filePath)
  return filePath
}

export function cleanupTempFiles(): null {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f) } catch { /* ignorar */ }
  }
  tempFiles.length = 0
  return null
}
```

- [ ] **Passo 1.2: Atualizar `cypress.config.ts`**

```typescript
import { defineConfig } from "cypress";
import { generateLargeFile, cleanupTempFiles } from "./cypress/tasks/file-tasks";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    setupNodeEvents(on) {
      on("task", { generateLargeFile, cleanupTempFiles });
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
  },
});
```

- [ ] **Passo 1.3: Criar `cypress/fixtures/small-file.txt`**

Conteúdo: texto ASCII de ~1KB (1024 caracteres). Executar no terminal:
```bash
node -e "require('fs').writeFileSync('cypress/fixtures/small-file.txt', 'AuraFetch Test File\n'.repeat(52))"
```

- [ ] **Passo 1.4: Criar `cypress/fixtures/sample-image.png`**

PNG mínimo 1x1 pixel — criado a partir de base64 conhecido e válido:
```bash
node -e "require('fs').writeFileSync('cypress/fixtures/sample-image.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))"
```

Verificar que o arquivo foi criado:
```bash
node -e "const buf = require('fs').readFileSync('cypress/fixtures/sample-image.png'); console.log('PNG válido:', buf[0]===0x89 && buf[1]===0x50, 'Tamanho:', buf.length, 'bytes')"
```
Esperado: `PNG válido: true Tamanho: 68 bytes`

- [ ] **Passo 1.5: Criar `cypress/fixtures/sample-collection.json`**

```json
{
  "collection": [
    {
      "id": "ws-fixture-001",
      "name": "Workspace Teste",
      "type": "workspace",
      "expanded": true,
      "environments": [
        {
          "id": "env-fixture-001",
          "name": "Desenvolvimento",
          "variables": [
            { "key": "base_url", "value": "https://postman-echo.com" },
            { "key": "token_teste", "value": "abc123" }
          ]
        }
      ],
      "children": [
        {
          "id": "folder-fixture-001",
          "name": "Pasta A",
          "type": "folder",
          "expanded": false,
          "folderConfig": { "auth": { "type": "none" }, "script": "" },
          "children": [
            {
              "id": "req-fixture-001",
              "name": "GET Lista",
              "type": "request",
              "children": [],
              "folderConfig": null,
              "request": {
                "id": "req-fixture-001",
                "name": "GET Lista",
                "method": "GET",
                "url": "https://postman-echo.com/get",
                "headers": [],
                "params": [],
                "pathParams": [],
                "body": "",
                "bodyType": "none",
                "formData": [],
                "auth": { "type": "inherit" }
              }
            }
          ]
        },
        {
          "id": "folder-fixture-002",
          "name": "Pasta B",
          "type": "folder",
          "expanded": false,
          "folderConfig": { "auth": { "type": "none" }, "script": "" },
          "children": [
            {
              "id": "req-fixture-002",
              "name": "POST Dados",
              "type": "request",
              "children": [],
              "folderConfig": null,
              "request": {
                "id": "req-fixture-002",
                "name": "POST Dados",
                "method": "POST",
                "url": "https://postman-echo.com/post",
                "headers": [],
                "params": [],
                "pathParams": [],
                "body": "{\"chave\": \"valor\"}",
                "bodyType": "json",
                "formData": [],
                "auth": { "type": "inherit" }
              }
            },
            {
              "id": "req-fixture-003",
              "name": "PUT Update",
              "type": "request",
              "children": [],
              "folderConfig": null,
              "request": {
                "id": "req-fixture-003",
                "name": "PUT Update",
                "method": "PUT",
                "url": "https://postman-echo.com/put",
                "headers": [],
                "params": [],
                "pathParams": [],
                "body": "",
                "bodyType": "none",
                "formData": [],
                "auth": { "type": "inherit" }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Passo 1.6: Verificar que a task funciona**

Iniciar o dev server: `npm run dev`
Em outro terminal: `npx cypress open` → rodar qualquer spec existente para confirmar que a task está registrada e o config é válido.

- [ ] **Passo 1.7: Commit**

```bash
git add cypress/tasks/file-tasks.ts cypress/fixtures/small-file.txt cypress/fixtures/sample-image.png cypress/fixtures/sample-collection.json cypress.config.ts
git commit -m "test(infra): add file-tasks, fixtures and update cypress.config"
```

---

## Task 2: Web fallback para seleção de arquivos em `src/App.tsx`

**Context:** `pickFormDataFile` e `pickBinaryFile` usam Tauri dialog e mostram erro no web. Os testes de upload precisam de hidden `<input type="file">` para funcionar no Cypress (browser mode).

**Files:**
- Modify: `src/App.tsx` (3 locais)

- [ ] **Passo 2.1: Adicionar `webFile` à interface `FormDataField` e `webBinaryFile` à `RequestModel`**

**Interface `FormDataField` (~linha 110):** localizar a interface `FormDataField` (procurar por `fileInfo?:`). Adicionar após `fileInfo`:
```typescript
  webFile?: File;   // Web mode only: File object do browser
```

**Interface `RequestModel` (~linha 134):** localizar `binaryFile?: { name: string; path: string } | null;`. Adicionar logo após:
```typescript
  webBinaryFile?: File;  // Web mode only: File object do browser para binary upload
```

- [ ] **Passo 2.2: Adicionar ref para o input de binary file web (~após linha 1339)**

Após a linha `const [wsInputMessage, setWsInputMessage] = useState('');`, adicionar:

```typescript
const webBinaryFileRef = useRef<HTMLInputElement>(null);
```

- [ ] **Passo 2.3: Substituir o bloco de file field no form-data render (~linha 3569)**

Localizar o bloco que começa com `{f.type === 'text' ? (` e termina após o bloco `else` com o botão "Escolher"/"Trocar". Substituir o trecho do `else` (o bloco que contém o botão "Escolher"):

**Antes** (o bloco `else if fileInfo`):
```tsx
                                    ) : (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => pickFormDataFile(f.id)}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                        </button>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {f.fileInfo?.name || 'Nenhum arquivo'}
                                        </span>
                                      </div>
                                    )}
```

**Depois:**
```tsx
                                    ) : isTauri() ? (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => pickFormDataFile(f.id)}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                        </button>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {f.fileInfo?.name || 'Nenhum arquivo'}
                                        </span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <label className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}>
                                          {f.fileInfo ? 'Trocar' : 'Escolher'}
                                          <input
                                            type="file"
                                            data-testid="formdata-file-input"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              if (file.size > MAX_FILE_UPLOAD_BYTES) {
                                                addLog('error', `❌ Arquivo "${file.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB. Selecione um arquivo menor.`);
                                                return;
                                              }
                                              const next = activeReq!.formData.map(x =>
                                                x.id === f.id
                                                  ? { ...x, fileInfo: { name: file.name, path: `web::${file.name}` }, webFile: file }
                                                  : x
                                              );
                                              handleActiveReqChange({ formData: next });
                                            }}
                                          />
                                        </label>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {f.fileInfo?.name || 'Nenhum arquivo'}
                                        </span>
                                      </div>
                                    )}
```

- [ ] **Passo 2.4: Adicionar web fallback para binary file picker (~linha 2035)**

Localizar `const pickBinaryFile = async () => {`. Substituir o bloco de `!isTauri()`:

**Antes:**
```typescript
  const pickBinaryFile = async () => {
    if (!isTauri()) {
      addLog('error', '❌ Seleção de arquivo binário disponível apenas na versão desktop.');
      return;
    }
```

**Depois:**
```typescript
  const pickBinaryFile = async () => {
    if (!isTauri()) {
      webBinaryFileRef.current?.click();
      return;
    }
```

- [ ] **Passo 2.5: Atualizar lógica de envio form-data para usar webFile (~linha 1583)**

Localizar:
```typescript
            } else if (f.fileInfo) {
              const bytes = await readFileWithSizeGuard(f.fileInfo.path, f.fileInfo.name);
              fd.append(key, new Blob([bytes], { type: 'application/octet-stream' }), f.fileInfo.name);
            }
```

Substituir por:
```typescript
            } else if (f.fileInfo) {
              let bytes: Uint8Array;
              if (!isTauri() && f.webFile) {
                if (f.webFile.size > MAX_FILE_UPLOAD_BYTES) {
                  throw new Error(`Arquivo "${f.webFile.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB`);
                }
                bytes = new Uint8Array(await f.webFile.arrayBuffer());
              } else {
                bytes = await readFileWithSizeGuard(f.fileInfo.path, f.fileInfo.name);
              }
              fd.append(key, new Blob([bytes], { type: 'application/octet-stream' }), f.fileInfo.name);
            }
```

- [ ] **Passo 2.5b: Atualizar lógica de envio binary para usar webBinaryFile (~linha 1570)**

Localizar:
```typescript
        else if (activeReq.bodyType === 'binary' && activeReq.binaryFile) {
          const bytes = await readFileWithSizeGuard(activeReq.binaryFile.path, activeReq.binaryFile.name);
          opts.body = bytes;
```

Substituir por:
```typescript
        else if (activeReq.bodyType === 'binary' && activeReq.binaryFile) {
          let bytes: Uint8Array;
          if (!isTauri() && activeReq.webBinaryFile) {
            if (activeReq.webBinaryFile.size > MAX_FILE_UPLOAD_BYTES) {
              throw new Error(`Arquivo "${activeReq.webBinaryFile.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB`);
            }
            bytes = new Uint8Array(await activeReq.webBinaryFile.arrayBuffer());
          } else {
            bytes = await readFileWithSizeGuard(activeReq.binaryFile.path, activeReq.binaryFile.name);
          }
          opts.body = bytes;
```

- [ ] **Passo 2.6: Adicionar o hidden input de binary ao JSX (~perto da linha 2476, antes do return)**

Após o bloco do Code Snippet Modal (que começa com `{isCodeModalOpen && activeReq && (`), adicionar antes do `{/* Modal Confirmation */}`:

```tsx
      {/* Web binary file picker (hidden — web mode only) */}
      {!isTauri() && (
        <input
          type="file"
          ref={webBinaryFileRef}
          data-testid="binary-file-input"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_FILE_UPLOAD_BYTES) {
              addLog('error', `❌ Arquivo "${file.name}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB. Selecione um arquivo menor.`);
              return;
            }
            handleActiveReqChange({
              binaryFile: { name: file.name, path: `web::${file.name}` },
              webBinaryFile: file,
            });
            if (e.target) e.target.value = '';
          }}
        />
      )}
```

> **Nota:** `webBinaryFile` requer adição ao `RequestModel` interface: `webBinaryFile?: File`. Adicionar ao lado de `binaryFile?:`.

- [ ] **Passo 2.7: Build passa sem erros**

```bash
npm run build
```

Esperado: `✓ built in X.XXs` sem erros TypeScript.

- [ ] **Passo 2.8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(web): add hidden file inputs as web fallback for form-data and binary file picker"
```

---

## Task 3: `cypress/e2e/bug_fixes_phase1.cy.ts`

**Files:**
- Create: `cypress/e2e/bug_fixes_phase1.cy.ts`

- [ ] **Passo 3.1: Criar o arquivo com todos os 13 testes de regressão**

```typescript
describe('AuraFetch - Regressões Fase 1', () => {
  const POSTMAN_ECHO = 'https://postman-echo.com';

  // ────────────────────────────────────────
  // B1/B2 — Proteção contra JSON corrompido
  // ────────────────────────────────────────
  describe('B1/B2 - LocalStorage corrompido não causa tela branca', () => {
    it('app carrega com aurafetch_collection_v2 corrompida', () => {
      cy.window().then(win => {
        win.localStorage.setItem('aurafetch_collection_v2', 'INVALID{JSON:broken')
      });
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').should('be.visible');
    });

    it('app carrega com aurafetch_globals corrompida', () => {
      cy.window().then(win => {
        win.localStorage.setItem('aurafetch_globals', '{"chave": broken json}')
      });
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').should('be.visible');
    });

    it('app carrega com ambas as chaves corrompidas simultaneamente', () => {
      cy.window().then(win => {
        win.localStorage.setItem('aurafetch_collection_v2', '!!!invalid')
        win.localStorage.setItem('aurafetch_globals', '!!!invalid')
      });
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // B5/B6/B8 — Response grande
  // ────────────────────────────────────────
  describe('B5/B6/B8 - Response grande não trava e não persiste', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    it('response de 2MB renderiza sem travar a UI', () => {
      const largePayload = { data: 'x'.repeat(2_000_000) };
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`, { body: largePayload, statusCode: 200 }).as('largeGet');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@largeGet');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    });

    it('após response grande, árvore responde a cliques', () => {
      const largePayload = { data: 'y'.repeat(2_000_000) };
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`, { body: largePayload, statusCode: 200 }).as('largeGet');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@largeGet');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      // Árvore ainda clicável após response grande
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.sidebar-tree-container').contains('Listar Dados').should('be.visible');
    });

    it('response não persiste no localStorage após reload', () => {
      const largePayload = { data: 'z'.repeat(100_000) };
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`, { body: largePayload, statusCode: 200 }).as('apiCall');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@apiCall');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      // Verificar que o localStorage NÃO contém os dados da response
      cy.window().then(win => {
        const stored = win.localStorage.getItem('aurafetch_collection_v2') ?? '';
        expect(stored).not.to.include('z'.repeat(1000));
      });
    });
  });

  // ────────────────────────────────────────
  // B7/B9/B13 — WebSocket cleanup
  // ────────────────────────────────────────
  describe('B7/B9/B13 - WebSocket: cleanup e stale closure', () => {
    // Estes testes requerem Tauri WebSocket — são pulados no browser
    before(function () {
      cy.visit('/');
      cy.window().then(win => {
        if (!(win as any).__TAURI_IPC__) {
          Cypress.env('skipWS', true);
        }
      });
    });

    beforeEach(function () {
      if (Cypress.env('skipWS')) return this.skip();
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      // Criar uma conexão WS
      cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
        cy.get('button[title="Opções"]').click({ force: true });
      });
      cy.get('.tree-dropdown-menu').contains('Nova Conexão WS').click();
    });

    it('mensagens WS aparecem após conexão', function () {
      if (Cypress.env('skipWS')) return this.skip();
      cy.get('.btn-send').contains('Conectar WS').click({ force: true });
      cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
      cy.get('textarea[placeholder*="Escreva a mensagem"]').type('olá ws{enter}', { force: true });
      cy.get('.ws-message-list, .chat-messages', { timeout: 10000 }).should('contain', 'olá ws');
    });

    it('trocar de nó limpa as mensagens anteriores', function () {
      if (Cypress.env('skipWS')) return this.skip();
      cy.get('.btn-send').contains('Conectar WS').click({ force: true });
      cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
      cy.get('textarea[placeholder*="Escreva a mensagem"]').type('msg antes de trocar{enter}', { force: true });
      cy.get('.ws-message-list, .chat-messages', { timeout: 10000 }).should('contain', 'msg antes de trocar');
      // Trocar para outro nó e voltar
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.sidebar-tree-container').contains('Conexão WebSocket').click({ force: true });
      // Mensagens devem estar limpas
      cy.get('.ws-message-list, .chat-messages').should('not.contain', 'msg antes de trocar');
    });

    it('reconectar não duplica mensagens', function () {
      if (Cypress.env('skipWS')) return this.skip();
      cy.get('.btn-send').contains('Conectar WS').click({ force: true });
      cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
      cy.get('.btn-send').contains('Desconectar').click({ force: true });
      cy.get('.btn-send', { timeout: 10000 }).should('contain', 'Conectar WS');
      cy.get('.btn-send').contains('Conectar WS').click({ force: true });
      cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
      // Apenas UMA mensagem de "Conectado" — sem duplicatas
      cy.get('.ws-message-list, .chat-messages').then($el => {
        const text = $el.text();
        const count = (text.match(/Conectado/g) || []).length;
        expect(count).to.equal(1);
      });
    });
  });

  // ────────────────────────────────────────
  // B10 — Web fallbacks
  // ────────────────────────────────────────
  describe('B10 - Web fallbacks para export e download', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    it('botão Exportar aciona download de arquivo JSON', () => {
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });

    it('botão Download response aciona download após receber response', () => {
      cy.intercept('GET', '**/get*', { body: { resultado: 'ok' }, statusCode: 200 }).as('req');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://postman-echo.com/get', { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('downloadClick');
      });
      cy.get('button[title="Salvar resposta no Disco"]').click();
      cy.get('@downloadClick').should('have.been.calledOnce');
    });
  });

  // ────────────────────────────────────────
  // B11/B12 — Sem prompt(), sem console leaks
  // ────────────────────────────────────────
  describe('B11/B12 - Sem prompt() e sem console.warn/error em uso normal', () => {
    it('renomear nó não dispara window.prompt nativo', () => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.window().then(win => {
        cy.stub(win, 'prompt').as('promptSpy');
      });
      cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
        cy.get('button[title="Opções"]').click({ force: true });
      });
      cy.get('.tree-dropdown-menu').contains('Renomear').click();
      cy.get('@promptSpy').should('not.have.been.called');
      // Input inline deve aparecer com o nome atual
      cy.get('input[value="Meu Servidor/Projeto"]').should('be.visible');
    });

    it('nenhum console.warn/error durante fluxo básico de GET', () => {
      cy.clearLocalStorage();
      cy.visit('/', {
        onBeforeLoad(win) {
          cy.spy(win.console, 'warn').as('consoleWarn');
          cy.spy(win.console, 'error').as('consoleError');
        }
      });
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.intercept('GET', '**/get*', { body: { ok: true }, statusCode: 200 }).as('req');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://postman-echo.com/get', { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('@consoleWarn').should('not.have.been.called');
      cy.get('@consoleError').should('not.have.been.called');
    });
  });
});
```

- [ ] **Passo 3.2: Rodar com o dev server ativo e verificar resultados**

```bash
npx cypress run --spec "cypress/e2e/bug_fixes_phase1.cy.ts"
```

Esperado: todos os testes passam exceto B7/B9/B13 (pulados por `skipWS`).

- [ ] **Passo 3.3: Commit**

```bash
git add cypress/e2e/bug_fixes_phase1.cy.ts
git commit -m "test(regression): add Phase 1 bug regression tests (B1/B2/B5/B6/B8/B10/B11/B12)"
```

---

## Task 4: `cypress/e2e/file_upload.cy.ts`

**Dependência:** Task 2 (web fallback de file picker) deve estar completa.

**Files:**
- Create: `cypress/e2e/file_upload.cy.ts`

- [ ] **Passo 4.1: Criar o arquivo**

```typescript
describe('AuraFetch - Upload de Arquivo Real', () => {
  const POSTMAN_ECHO = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    // Selecionar "Listar Dados", trocar para POST e ativar FORM-DATA
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.method-select').select('POST');
    cy.get('.tab').contains('Payload / Body').click();
    cy.contains('label', 'FORM-DATA').click();
  });

  // ────────────────────────────────────────
  // Guard de tamanho 50MB
  // ────────────────────────────────────────
  describe('Guard de tamanho (50MB)', () => {
    after(() => {
      cy.task('cleanupTempFiles');
    });

    it('arquivo de 49MB: upload aceito, sem mensagem de erro', () => {
      cy.task('generateLargeFile', { sizeMb: 49 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        // Trocar o campo para tipo "file"
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        // Não deve exibir erro de tamanho
        cy.get('.console-panel').should('not.contain', 'excede o limite');
        // O nome do arquivo deve aparecer
        cy.contains('49mb').should('be.visible');
      });
    });

    it('arquivo de 51MB: exibe mensagem de erro na UI', () => {
      cy.task('generateLargeFile', { sizeMb: 51 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        // Deve exibir o erro de tamanho — esperar até 5s pelo log
        cy.get('.console-panel, .log-entry', { timeout: 5000 }).should('contain', 'excede o limite');
      });
    });

    it('arquivo de exatamente 50MB: tratado como inválido', () => {
      cy.task('generateLargeFile', { sizeMb: 50 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        cy.get('.console-panel, .log-entry', { timeout: 5000 }).should('contain', 'excede o limite');
      });
    });
  });

  // ────────────────────────────────────────
  // Form-data com arquivo real pequeno
  // ────────────────────────────────────────
  describe('Form-data com arquivo de 1KB', () => {
    it('campo exibe nome do arquivo após seleção', () => {
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      cy.contains('small-file.txt').should('be.visible');
    });

    it('enviar POST form-data com arquivo → postman-echo confirma campo presente', () => {
      // Adicionar campo texto
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('input[placeholder="Key"]').last().type('descricao', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Value"]').last().type('teste upload', { parseSpecialCharSequences: false });
      // Adicionar campo arquivo
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('input[placeholder="Key"]').last().type('arquivo_upload', { parseSpecialCharSequences: false });
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      // Enviar
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.get('.body-content', { timeout: 30000 }).should('contain', 'descricao').and('contain', 'arquivo_upload');
    });

    it('Content-Type boundary é gerado pelo browser (não sobrescrito)', () => {
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      // Interceptar para verificar headers
      cy.intercept('POST', `${POSTMAN_ECHO}/post`).as('upload');
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@upload').then(interception => {
        const contentType = interception.request.headers['content-type'] as string;
        expect(contentType).to.include('multipart/form-data');
        expect(contentType).to.include('boundary=');
      });
    });
  });

  // ────────────────────────────────────────
  // Binary upload
  // ────────────────────────────────────────
  describe('Binary upload', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Payload / Body').click();
      cy.contains('label', 'Binary').click();
    });

    it('selecionar PNG como body binário e enviar', () => {
      cy.get('[data-testid="binary-file-input"]').selectFile('cypress/fixtures/sample-image.png', { force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      cy.intercept('POST', `${POSTMAN_ECHO}/post`).as('binaryUpload');
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@binaryUpload').then(interception => {
        expect(interception.request.headers['content-length']).to.exist;
      });
      cy.get('.status-badge', { timeout: 30000 }).should('contain', '200');
    });
  });
});
```

- [ ] **Passo 4.2: Rodar e verificar**

```bash
npx cypress run --spec "cypress/e2e/file_upload.cy.ts"
```

Esperado: todos os testes passam. Os testes de 49/50/51MB podem demorar 15-30s (geração do arquivo).

- [ ] **Passo 4.3: Commit**

```bash
git add cypress/e2e/file_upload.cy.ts
git commit -m "test(upload): add real file upload tests with 50MB size guard"
```

---

## Task 5: `cypress/e2e/response_rendering.cy.ts`

**Files:**
- Create: `cypress/e2e/response_rendering.cy.ts`

- [ ] **Passo 5.1: Criar o arquivo**

```typescript
describe('AuraFetch - Renderização de Response', () => {
  const BASE = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
  });

  // ────────────────────────────────────────
  // JSON
  // ────────────────────────────────────────
  // Nota: o painel de response possui 3 abas: "Body" (response), "Response Headers" e "Console".
  // Não existe aba "Raw" na implementação atual — os testes abaixo cobrem o que de fato existe.

  describe('JSON', () => {
    it('response JSON exibe formatação pretty print no CodeMirror', () => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        body: { usuario: { nome: 'Alice', idade: 30 }, ativo: true }
      }).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      // CodeMirror exibe o JSON formatado
      cy.get('.cm-content').should('contain', 'usuario').and('contain', 'nome');
    });

    it('response JSON grande (500KB) renderiza sem travar', () => {
      const largeJson = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, valor: 'x'.repeat(90) })) };
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 200, body: largeJson }).as('bigReq');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@bigReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      // UI ainda responde — árvore clicável
      cy.get('.sidebar-tree-container').contains('Listar Dados').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // HTML
  // ────────────────────────────────────────
  describe('HTML', () => {
    it('response HTML renderiza em iframe', () => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html><body><h1>Página de Teste</h1></body></html>'
      }).as('htmlReq');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@htmlReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('iframe[title="HTML Preview"]').should('exist');
    });
  });

  // ────────────────────────────────────────
  // Imagem
  // ────────────────────────────────────────
  describe('Imagem', () => {
    it('response image/png exibe tag <img> no painel', () => {
      cy.fixture('sample-image.png', 'base64').then(imgBase64 => {
        cy.intercept('GET', `${BASE}/get*`, {
          statusCode: 200,
          headers: { 'content-type': 'image/png' },
          body: Cypress.Buffer.from(imgBase64, 'base64')
        }).as('imgReq');
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.wait('@imgReq');
        cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
        cy.get('.response-panel img[alt="Response"]').should('exist');
      });
    });

    it('botão de download disponível para imagem', () => {
      cy.fixture('sample-image.png', 'base64').then(imgBase64 => {
        cy.intercept('GET', `${BASE}/get*`, {
          statusCode: 200,
          headers: { 'content-type': 'image/png' },
          body: Cypress.Buffer.from(imgBase64, 'base64')
        }).as('imgReq');
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.wait('@imgReq');
        cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
        cy.get('button[title="Salvar resposta no Disco"]').should('be.visible');
      });
    });
  });

  // ────────────────────────────────────────
  // Binário
  // ────────────────────────────────────────
  describe('Binário', () => {
    it('response octet-stream exibe indicação de arquivo binário', () => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'application/octet-stream' },
        body: 'binary data here'
      }).as('binReq');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@binReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.response-panel').should('contain', 'Arquivo Binário Detectado');
      cy.get('.response-panel button').contains('Baixar Arquivo').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // Metadados
  // ────────────────────────────────────────
  describe('Metadados da response', () => {
    beforeEach(() => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'x-custom-header': 'valor-teste', 'content-type': 'application/json' },
        body: { ok: true }
      }).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    });

    it('aba Response Headers mostra headers retornados', () => {
      cy.get('.tab').contains('Response Headers').click();
      cy.get('.body-content .headers-grid', { timeout: 10000 }).should('exist');
      cy.get('.body-content').should('contain', 'x-custom-header');
    });

    it('status code 200 é visível na UI', () => {
      cy.get('.status-badge').should('contain', '200');
    });

    it('aba Console mostra tempo de resposta', () => {
      cy.get('.tab').contains('Console / Timestamps').click();
      cy.get('.console-panel', { timeout: 10000 }).should('contain', 'REQUISIÇÃO');
    });

    it('status code 404 é exibido corretamente', () => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 404, body: { error: 'not found' } }).as('notFound');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@notFound');
      cy.get('.status-badge', { timeout: 15000 }).should('contain', '404');
    });
  });

  // ────────────────────────────────────────
  // Persistência
  // ────────────────────────────────────────
  describe('Persistência da response', () => {
    it('response NÃO persiste no localStorage após reload (regressão B5)', () => {
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 200, body: { resultado: 'cache_test_unique_string' } }).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.window().then(win => {
        const stored = win.localStorage.getItem('aurafetch_collection_v2') ?? '';
        expect(stored).not.to.include('cache_test_unique_string');
      });
    });

    it('trocar de nó limpa a response exibida', () => {
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 200, body: { msg: 'aparece antes' } }).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.body-content').should('contain', 'aparece antes');
      // Trocar para outra requisição
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.status-badge').should('not.exist');
    });
  });
});
```

- [ ] **Passo 5.2: Rodar e verificar**

```bash
npx cypress run --spec "cypress/e2e/response_rendering.cy.ts"
```

- [ ] **Passo 5.3: Commit**

```bash
git add cypress/e2e/response_rendering.cy.ts
git commit -m "test(response): add response rendering tests (JSON, HTML, image, binary, metadata)"
```

---

## Task 6: `cypress/e2e/import_export.cy.ts`

**Files:**
- Create: `cypress/e2e/import_export.cy.ts`

- [ ] **Passo 6.1: Criar o arquivo**

```typescript
describe('AuraFetch - Import/Export de Coleção e Download de Response', () => {
  const BASE = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
  });

  // ────────────────────────────────────────
  // Export de coleção
  // ────────────────────────────────────────
  describe('Export de coleção', () => {
    it('botão Exportar está visível na UI', () => {
      cy.get('button[title="Exportar"]').should('be.visible');
    });

    it('botão Exportar aciona download de JSON via âncora', () => {
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });

    it('exportar coleção vazia não trava a UI', () => {
      // Remover todos os workspaces importando uma coleção vazia
      cy.window().then(win => {
        win.localStorage.setItem('aurafetch_collection_v2', '[]');
      });
      cy.reload();
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });

    it('JSON exportado contém os workspaces criados', () => {
      // Criar um workspace e depois verificar o conteúdo exportado via interceptação do blob
      cy.get('button[title="Novo Workspace"]').click();
      cy.get('input[placeholder="Nome do workspace..."]').type('WS Exportar Teste{enter}', { parseSpecialCharSequences: false });
      cy.get('.sidebar-tree-container').should('contain', 'WS Exportar Teste');
      // Interceptar a criação do Blob para verificar conteúdo
      cy.window().then(win => {
        const origBlob = win.Blob;
        let capturedContent = '';
        cy.stub(win, 'Blob').callsFake(function(parts: any[], options: any) {
          if (options?.type === 'application/json') capturedContent = parts[0];
          return new origBlob(parts, options);
        });
        cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(() => {
          expect(capturedContent).to.include('WS Exportar Teste');
        }).as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });
  });

  // ────────────────────────────────────────
  // Import de coleção
  // ────────────────────────────────────────
  describe('Import de coleção', () => {
    it('importar sample-collection.json popula a árvore', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
    });

    it('workspaces importados têm nomes corretos', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
    });

    it('pastas e requisições dentro dos workspaces são preservadas', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Pasta A').and('contain', 'Pasta B');
      cy.get('.sidebar-tree-container').contains('Workspace Teste').click({ force: true });
      cy.get('.sidebar-tree-container').contains('Pasta A').click({ force: true });
      cy.get('.sidebar-tree-container').should('contain', 'GET Lista');
    });

    it('environments importados são preservados', () => {
      // O fixture tem 1 environment chamado "Desenvolvimento" com variáveis base_url e token_teste
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
      // Abrir o workspace e verificar environments
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace Teste')
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Environments').click({ force: true });
      cy.contains('Desenvolvimento').should('be.visible');
    });

    it('importar JSON inválido exibe mensagem de erro sem travar', () => {
      const invalidJson = new Blob(['{"collection": invalid json}'], { type: 'application/json' });
      const file = new File([invalidJson], 'invalid.json', { type: 'application/json' });
      cy.get('label[title="Importar"] input[type="file"]').selectFile(
        { contents: Cypress.Buffer.from('{"collection": invalid json}'), fileName: 'invalid.json' },
        { force: true }
      );
      // O app não deve travar — a árvore original ainda está visível
      cy.get('.app-title', { timeout: 10000 }).should('be.visible');
      cy.get('.sidebar-tree-container').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // Download de response
  // ────────────────────────────────────────
  describe('Download de response', () => {
    beforeEach(() => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        body: { conteudo: 'dados para download' }
      }).as('req');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    });

    it('botão de download está disponível após receber response', () => {
      cy.get('button[title="Salvar resposta no Disco"]').should('be.visible');
    });

    it('clicar no botão dispara download (âncora .click() chamado)', () => {
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('downloadClick');
      });
      cy.get('button[title="Salvar resposta no Disco"]').click();
      cy.get('@downloadClick').should('have.been.calledOnce');
    });

    it('response binária (PNG via intercept) aciona download', () => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.fixture('sample-image.png', 'base64').then(imgBase64 => {
        cy.intercept('GET', `${BASE}/get*`, {
          statusCode: 200,
          headers: { 'content-type': 'image/png' },
          body: Cypress.Buffer.from(imgBase64, 'base64')
        }).as('imgReq');
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.wait('@imgReq');
        cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
        cy.window().then(win => {
          cy.stub(win.HTMLAnchorElement.prototype, 'click').as('imgDownloadClick');
        });
        cy.get('button[title="Salvar resposta no Disco"], .response-panel button').contains('Baixar Arquivo').click();
        cy.get('@imgDownloadClick').should('have.been.calledOnce');
      });
    });
  });
});
```

- [ ] **Passo 6.2: Rodar e verificar**

```bash
npx cypress run --spec "cypress/e2e/import_export.cy.ts"
```

- [ ] **Passo 6.3: Commit**

```bash
git add cypress/e2e/import_export.cy.ts
git commit -m "test(import-export): add collection import/export and response download tests"
```

---

## Task 7: `cypress/e2e/auth.cy.ts`

**Files:**
- Create: `cypress/e2e/auth.cy.ts`

- [ ] **Passo 7.1: Criar o arquivo**

```typescript
describe('AuraFetch - Autenticação', () => {
  const POSTMAN_ECHO = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.tab').contains('Autenticação').click();
  });

  // ────────────────────────────────────────
  // Bearer Token
  // ────────────────────────────────────────
  describe('Bearer Token', () => {
    it('selecionar Bearer exibe campo de token', () => {
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').should('be.visible');
    });

    it('requisição enviada contém header Authorization: Bearer', () => {
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('meu_token_secreto');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer meu_token_secreto');
      });
    });

    it('token com variável {{token}} é substituído pelo environment', () => {
      // Configurar variável no workspace
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Environments').click({ force: true });
      cy.contains('button', 'Adicionar Ambiente').click();
      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('meu_token');
      cy.get('input[placeholder="Valor"]').last().type('token_do_env');
      // Voltar para a requisição e configurar Bearer com variável
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('{{meu_token}}', { parseSpecialCharSequences: false });
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer token_do_env');
      });
    });
  });

  // ────────────────────────────────────────
  // Basic Auth
  // ────────────────────────────────────────
  describe('Basic Auth', () => {
    it('selecionar Basic exibe campos usuário e senha', () => {
      cy.get('.glass-panel select').select('basic');
      cy.get('input[placeholder*="Usuário"]').should('be.visible');
      cy.get('input[placeholder*="Senha"], input[type="password"]').should('be.visible');
    });

    it('requisição contém header Authorization: Basic <base64>', () => {
      cy.get('.glass-panel select').select('basic');
      cy.get('input[placeholder*="Usuário"]').clear().type('admin');
      cy.get('input[placeholder*="Senha"], input[type="password"]').clear().type('senha123');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        const auth = interception.request.headers['authorization'] as string;
        expect(auth).to.match(/^Basic /);
        const decoded = atob(auth.replace('Basic ', ''));
        expect(decoded).to.equal('admin:senha123');
      });
    });
  });

  // ────────────────────────────────────────
  // API Key
  // ────────────────────────────────────────
  describe('API Key', () => {
    it('selecionar API Key exibe campos nome e valor', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder*="X-Api-Key"]').should('be.visible');
      cy.get('input[placeholder*="valor"]').should('be.visible');
    });

    it('API key adicionada como header quando configurada em "In Headers"', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder*="X-Api-Key"]').clear().type('X-Minha-Chave');
      cy.get('input[placeholder*="valor"]').clear().type('chave_secreta_123');
      // Garantir que "In Headers" está selecionado
      cy.get('.glass-panel').contains('Location').parent().find('select').select('header');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['x-minha-chave']).to.equal('chave_secreta_123');
      });
    });

    it('API key adicionada como query param quando configurada em "In Query Params"', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder*="X-Api-Key"]').clear().type('api_key');
      cy.get('input[placeholder*="valor"]').clear().type('qp_valor_123');
      // Mudar para "In Query Params"
      cy.get('.glass-panel').contains('Location').parent().find('select').select('query');
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        // API key deve aparecer na URL, não no header
        expect(interception.request.url).to.include('api_key=qp_valor_123');
        expect(interception.request.headers['api_key']).to.be.undefined;
      });
    });
  });

  // ────────────────────────────────────────
  // OAuth2
  // ────────────────────────────────────────
  describe('OAuth2 UI', () => {
    it('selecionar OAuth2 exibe campos Client ID e Access Token URL', () => {
      cy.get('.glass-panel select').select('oauth2');
      cy.get('.glass-panel').invoke('text').should('match', /Client ID/i);
      cy.get('.glass-panel').invoke('text').should('match', /Access Token/i);
    });
  });

  // ────────────────────────────────────────
  // Herança de autenticação
  // ────────────────────────────────────────
  describe('Herança de autenticação por pasta', () => {
    it('requisição herda Bearer da pasta pai', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_HERDADO');
      // Verificar que a requisição filha tem "inherit"
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').should('have.value', 'inherit');
      cy.contains('Esta requisição herda a autenticação da pasta pai').should('be.visible');
    });

    it('requisição com auth própria sobrescreve a pasta', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_PASTA');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      // Mudar para bearer próprio
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('TOKEN_PROPRIO');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer TOKEN_PROPRIO');
      });
    });

    it('requisição com auth "none" ignora a auth da pasta', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_PASTA');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').select('none');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.be.undefined;
      });
    });
  });
});
```

- [ ] **Passo 7.2: Rodar e verificar**

```bash
npx cypress run --spec "cypress/e2e/auth.cy.ts"
```

- [ ] **Passo 7.3: Commit**

```bash
git add cypress/e2e/auth.cy.ts
git commit -m "test(auth): add Bearer, Basic, API Key, OAuth2 UI and inheritance tests"
```

---

## Task 8: Expansões nos arquivos existentes

**Files:**
- Modify: `cypress/e2e/websocket_ui.cy.ts`
- Modify: `cypress/e2e/professional_features.cy.ts`
- Modify: `cypress/e2e/core_stability.cy.ts`
- Modify: `cypress/e2e/workspace_tree.cy.ts`

- [ ] **Passo 8.1: Expandir `websocket_ui.cy.ts` com fluxo completo**

Adicionar ao final do arquivo (fora do `describe` existente), um novo `describe`:

```typescript
describe('AuraFetch - WebSocket Fluxo Completo (requer Tauri)', () => {
  // Estes testes requerem Tauri WebSocket plugin — pulados no browser
  before(function () {
    cy.visit('/');
    cy.window().then(win => {
      if (!(win as any).__TAURI_IPC__) Cypress.env('skipWS_full', true);
    });
  });

  beforeEach(function () {
    if (Cypress.env('skipWS_full')) return this.skip();
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
      cy.get('button[title="Opções"]').click({ force: true });
    });
    cy.get('.tree-dropdown-menu').contains('Nova Conexão WS').click();
  });

  it('conectar a wss://echo.websocket.org e enviar mensagem', function () {
    if (Cypress.env('skipWS_full')) return this.skip();
    cy.get('.btn-send').contains('Conectar WS').click({ force: true });
    cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
    cy.get('textarea[placeholder*="Escreva a mensagem"]').type('ping_ws_test{enter}', { force: true });
    cy.get('.ws-message-list, .chat-messages', { timeout: 10000 }).should('contain', 'ping_ws_test');
  });

  it('desconectar limpa o status de conexão', function () {
    if (Cypress.env('skipWS_full')) return this.skip();
    cy.get('.btn-send').contains('Conectar WS').click({ force: true });
    cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
    cy.get('.btn-send').contains('Desconectar').click({ force: true });
    cy.get('.btn-send', { timeout: 10000 }).should('contain', 'Conectar WS');
  });

  it('reconectar após desconexão não duplica mensagens (regressão B13)', function () {
    if (Cypress.env('skipWS_full')) return this.skip();
    cy.get('.btn-send').contains('Conectar WS').click({ force: true });
    cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
    cy.get('.btn-send').contains('Desconectar').click({ force: true });
    cy.get('.btn-send', { timeout: 10000 }).should('contain', 'Conectar WS');
    cy.get('.btn-send').contains('Conectar WS').click({ force: true });
    cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
    cy.get('.ws-message-list, .chat-messages').then($el => {
      const matches = $el.text().match(/Conectado/g) || [];
      expect(matches.length).to.equal(1);
    });
  });

  it('trocar de nó enquanto conectado: ao voltar, estado limpo (regressão B9)', function () {
    if (Cypress.env('skipWS_full')) return this.skip();
    cy.get('.btn-send').contains('Conectar WS').click({ force: true });
    cy.get('.btn-send', { timeout: 15000 }).should('contain', 'Desconectar');
    cy.get('textarea[placeholder*="Escreva a mensagem"]').type('antes_de_trocar{enter}', { force: true });
    cy.get('.ws-message-list, .chat-messages', { timeout: 10000 }).should('contain', 'antes_de_trocar');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.sidebar-tree-container').contains('Conexão WebSocket').click({ force: true });
    cy.get('.ws-message-list, .chat-messages').should('not.contain', 'antes_de_trocar');
  });
});
```

- [ ] **Passo 8.2: Expandir `professional_features.cy.ts` com code snippets**

Adicionar ao final do arquivo (dentro ou fora do `describe` principal):

```typescript
  // ────────────────────────────────────────
  // 8. CODE SNIPPETS
  // ────────────────────────────────────────
  it('Deve gerar Code Snippet com método e URL corretos (cURL)', () => {
    cy.get('.method-select').select('POST');
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/dados', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar Snippet de Código"]').click();
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal-content pre').should('contain', 'POST').and('contain', 'api.exemplo.com/dados');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Deve gerar snippet fetch válido', () => {
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/lista', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar Snippet de Código"]').click();
    cy.get('.modal-content .select-input').select('fetch');
    cy.get('.modal-content pre').should('contain', 'fetch(').and('contain', 'api.exemplo.com/lista');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Deve gerar snippet axios com headers configurados', () => {
    cy.get('.tab').contains('Headers Custo.').click();
    cy.contains('button', 'Nova Linha de Header').click();
    cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-App-Token');
    cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('token_ax_123');
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/post', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar Snippet de Código"]').click();
    cy.get('.modal-content .select-input').select('axios');
    cy.get('.modal-content pre').should('contain', 'axios(').and('contain', 'X-App-Token');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Snippet atualiza quando URL muda', () => {
    cy.get('button[title="Gerar Snippet de Código"]').click();
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal-content pre').invoke('text').then(textBefore => {
      cy.get('.modal-overlay').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://novo.servidor.com/endpoint', { parseSpecialCharSequences: false });
      cy.get('button[title="Gerar Snippet de Código"]').click();
      cy.get('.modal-content pre').invoke('text').should('include', 'novo.servidor.com');
    });
  });
```

- [ ] **Passo 8.3: Expandir `core_stability.cy.ts` com histórico completo e env persistence**

Adicionar ao final do arquivo dentro do `describe` principal:

```typescript
  // ────────────────────────────────────────
  // 6. HISTÓRICO PERSISTE APÓS RELOAD
  // ────────────────────────────────────────
  it('Deve persistir histórico após reload', () => {
    cy.intercept('GET', '**/get*', { body: { ok: true }, statusCode: 200 }).as('req');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://postman-echo.com/get?test=persist_hist', { parseSpecialCharSequences: false });
    cy.contains('button', 'Fazer Disparo').click({ force: true });
    cy.wait('@req');
    cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    cy.reload();
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('button').contains('Histórico').click();
    cy.get('.history-card').should('have.length.at.least', 1);
  });

  // ────────────────────────────────────────
  // 7. HISTÓRICO: CLICAR RESTAURA MÉTODO E URL
  // ────────────────────────────────────────
  it('Deve restaurar método e URL ao clicar no histórico', () => {
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.method-select').select('POST');
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://postman-echo.com/post?hist_restore=1', { parseSpecialCharSequences: false });
    cy.intercept('POST', '**/post*', { body: { ok: true }, statusCode: 200 }).as('postReq');
    cy.contains('button', 'Fazer Disparo').click({ force: true });
    cy.wait('@postReq');
    cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    cy.get('button').contains('Histórico').click();
    cy.get('.history-card').first().click();
    cy.get('input[placeholder="{{base_url}}/api/..."]').should('have.value', 'https://postman-echo.com/post?hist_restore=1');
  });

  // ────────────────────────────────────────
  // 8. BUSCA FILTRA PASTA E REQUISIÇÃO SIMULTANEAMENTE
  // ────────────────────────────────────────
  it('Deve filtrar pasta e requisição pelo mesmo termo de busca', () => {
    cy.get('input[placeholder="Buscar requisição, pasta..."]').type('Servidor');
    cy.get('.sidebar-tree-container').should('contain', 'Meu Servidor/Projeto');
    cy.get('input[placeholder="Buscar requisição, pasta..."]').clear().type('Listar');
    cy.get('.sidebar-tree-container').should('contain', 'Listar Dados');
    cy.get('.sidebar-tree-container').should('not.contain', 'Meu Servidor/Projeto');
  });

  // ────────────────────────────────────────
  // 9. ENVIRONMENT VARIABLES PERSISTEM APÓS RELOAD
  // ────────────────────────────────────────
  it('Deve persistir variáveis de environment após reload', () => {
    cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
      .find('.node-name').click({ force: true });
    cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
    cy.contains('button', 'Adicionar Linha').click();
    cy.get('input[placeholder="Chave"]').last().type('persist_var');
    cy.get('input[placeholder="Valor"]').last().type('persist_valor_123');
    cy.reload();
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
      .find('.node-name').click({ force: true });
    cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
    cy.contains('persist_valor_123').should('be.visible');
  });
```

- [ ] **Passo 8.4: Expandir `workspace_tree.cy.ts` com rename inline, duplicar, envs independentes**

Adicionar ao final do arquivo dentro do `describe` principal ou em novo `describe`:

```typescript
  // ────────────────────────────────────────
  // RENAME, DUPLICAR, ENVS INDEPENDENTES
  // ────────────────────────────────────────
  describe('Rename inline, Duplicar e Envs independentes', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    it('Renomear pasta via menu mostra input inline (sem prompt nativo)', () => {
      cy.window().then(win => { cy.stub(win, 'prompt').as('promptSpy'); });
      cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
        cy.get('button[title="Opções"]').click({ force: true });
      });
      cy.get('.tree-dropdown-menu').contains('Renomear').click();
      cy.get('@promptSpy').should('not.have.been.called');
      cy.get('input[value="Meu Servidor/Projeto"]').should('be.visible');
    });

    it('Renomear pasta preserva as requisições filhas', () => {
      cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
        cy.get('button[title="Opções"]').click({ force: true });
      });
      cy.get('.tree-dropdown-menu').contains('Renomear').click();
      cy.get('input[value="Meu Servidor/Projeto"]').clear().type('Pasta Renomeada{enter}');
      cy.get('.sidebar-tree-container').should('contain', 'Pasta Renomeada');
      cy.get('.sidebar-tree-container').contains('Pasta Renomeada').click({ force: true });
      cy.get('.sidebar-tree-container').should('contain', 'Listar Dados');
    });

    it('Duplicar requisição cria cópia com mesmo método e URL', () => {
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/unique_url_dup', { parseSpecialCharSequences: false });
      cy.get('.method-select').select('PUT');
      cy.contains('.tree-item', 'Listar Dados').within(() => {
        cy.get('button[title="Opções"]').click({ force: true });
      });
      cy.get('.tree-dropdown-menu').contains('Duplicar').click();
      // Deve existir um segundo nó com nome "Listar Dados" ou "Listar Dados (cópia)"
      cy.get('.sidebar-tree-container .tree-item').filter(':contains("Listar Dados")').should('have.length.at.least', 2);
    });

    it('Environments de workspaces diferentes são independentes', () => {
      // Criar segundo workspace
      cy.get('button[title="Novo Workspace"]').click();
      cy.get('input[placeholder="Nome do workspace..."]').type('WS Isolado{enter}');
      cy.get('.sidebar-tree-container').should('contain', 'WS Isolado');
      // Adicionar env no primeiro workspace
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Environments').click({ force: true });
      cy.contains('button', 'Adicionar Ambiente').click();
      // Verificar que o env não aparece no segundo workspace
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'WS Isolado')
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Environments').click({ force: true });
      cy.get('.environment-list, .env-list').should('not.contain', 'Novo Ambiente');
    });
  });
```

- [ ] **Passo 8.5: Rodar todos os arquivos expandidos**

```bash
npx cypress run --spec "cypress/e2e/websocket_ui.cy.ts,cypress/e2e/professional_features.cy.ts,cypress/e2e/core_stability.cy.ts,cypress/e2e/workspace_tree.cy.ts"
```

- [ ] **Passo 8.6: Commit**

```bash
git add cypress/e2e/websocket_ui.cy.ts cypress/e2e/professional_features.cy.ts cypress/e2e/core_stability.cy.ts cypress/e2e/workspace_tree.cy.ts
git commit -m "test(expand): add WS full flow, code snippets, history, env persistence, rename and duplicate tests"
```

---

## Task 9: Verificação Final

- [ ] **Passo 9.1: Rodar toda a suite**

```bash
npx cypress run
```

- [ ] **Passo 9.2: Resultado esperado**

- Testes novos: ~79 passando
- Testes existentes: ~35 passando (sem regressão)
- WS testes com `skipWS*`: pulados (pending) no browser, verde no Tauri
- Total: ~114 testes — zero failing

- [ ] **Passo 9.3: Commit final**

```bash
git add -A
git commit -m "test: complete TDD Cypress test suite — 114 tests covering all features and Phase 1 regressions"
```

---

## Notas de Implementação

### Seletores importantes (referência rápida)
| Elemento | Seletor |
|---|---|
| App carregado | `.app-title` |
| Árvore lateral | `.sidebar-tree-container` |
| Input de URL | `input[placeholder="{{base_url}}/api/..."]` |
| Botão enviar | `button:contains("Fazer Disparo")` |
| Badge de status | `.status-badge` |
| Corpo da response | `.body-content` |
| Painel console | `.console-panel` |
| Botão opções nó | `button[title="Opções"]` |
| Menu dropdown | `.tree-dropdown-menu` |
| Abas do painel | `.tab` |
| Select método | `.method-select` |
| Import file input | `label[title="Importar"] input[type="file"]` |
| Export button | `button[title="Exportar"]` |
| Download button | `button[title="Salvar resposta no Disco"]` |
| Code snippet button | `button[title="Gerar Snippet de Código"]` |
| Form-data file (web) | `[data-testid="formdata-file-input"]` |
| Binary file (web) | `[data-testid="binary-file-input"]` |

### LocalStorage keys
- `aurafetch_collection_v2` — coleção principal
- `aurafetch_globals` — variáveis globais

### Padrão beforeEach padrão
```typescript
beforeEach(() => {
  cy.clearLocalStorage();
  cy.visit('/');
  cy.get('.app-title', { timeout: 30000 }).should('be.visible');
});
```

### Testar download (cy.stub em HTMLAnchorElement.prototype.click)
```typescript
cy.window().then(win => {
  cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
});
// ... ação que dispara download ...
cy.get('@anchorClick').should('have.been.calledOnce');
```
