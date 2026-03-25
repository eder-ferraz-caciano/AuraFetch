# Spec: Cobertura de Testes TDD — AuraFetch (Cypress)

**Data:** 2026-03-25
**Projeto:** AuraFetch
**Escopo:** Cobertura completa de testes E2E com Cypress para todas as funcionalidades da aplicação, incluindo regressões dos 13 bugs corrigidos na Fase 1.

---

## 1. Contexto e Motivação

O projeto possui 5 arquivos de spec Cypress (~900 linhas) cobrindo fluxos básicos de workspace, parâmetros, features profissionais e WebSocket. A Fase 1 de correção de bugs introduziu 13 correções que não possuem cobertura de regressão. Além disso, funcionalidades como upload de arquivo, renderização de response, import/export de coleção, autenticação completa e geração de code snippets não possuem testes.

**Objetivo:** criar testes que reflitam a realidade do usuário — testes que falhariam se o comportamento visível ao usuário quebrasse.

---

## 2. Decisões de Design

### Abordagem: Cypress-first com arquivos reais e geração dinâmica de arquivos grandes

- **100% Cypress** — sem Vitest ou Jest. Mantém consistência com o stack atual.
- **Arquivos reais** para upload via `cy.get('input').selectFile()` — sem mocks de filesystem.
- **Arquivos grandes** (49MB, 50MB, 51MB) gerados em runtime via `cy.task('generateLargeFile')` no diretório temporário do sistema operacional. Nunca commitados no repositório.
- **`cy.intercept()`** para controlar payloads de response (JSON grande, HTML, imagem, binário) sem depender de servidores externos.
- **`cy.window()`** para setar localStorage corrompido antes de `cy.visit()` e para spy em `console.warn/error` e `window.prompt`.

### Por que não Vitest/Jest

O risco levantado pelo time é que testes isolados de lógica podem passar enquanto o código real faz outra coisa. Cypress testa o comportamento completo do ponto de vista do usuário, eliminando esse risco.

---

## 3. Estrutura de Arquivos

```
cypress/
├── e2e/
│   ├── (existentes — expandidos)
│   ├── core_stability.cy.ts
│   ├── professional_features.cy.ts
│   ├── websocket_ui.cy.ts
│   ├── workspace_tree.cy.ts
│   │
│   └── (novos)
│       ├── bug_fixes_phase1.cy.ts
│       ├── file_upload.cy.ts
│       ├── response_rendering.cy.ts
│       ├── import_export.cy.ts
│       └── auth.cy.ts
│
├── fixtures/
│   ├── small-file.txt              (1 KB — texto simples)
│   ├── sample-image.png            (~10 KB — PNG válido mínimo)
│   └── sample-collection.json      (1 workspace, 2 pastas, 3 requests, 1 environment)
│
└── tasks/
    └── file-tasks.ts               (generateLargeFile, cleanupTempFiles)
```

### Alterações em arquivos existentes

| Arquivo | Alteração |
|---|---|
| `cypress.config.ts` | Adicionar `setupNodeEvents` com tasks de geração de arquivo |
| `cypress/e2e/core_stability.cy.ts` | + histórico completo, busca simultânea, env persistence |
| `cypress/e2e/professional_features.cy.ts` | + code snippets (cURL, fetch, axios) |
| `cypress/e2e/websocket_ui.cy.ts` | + fluxo completo: connect, send, receive, disconnect, reconect |
| `cypress/e2e/workspace_tree.cy.ts` | + renomear (sem prompt), duplicar, envs independentes |

---

## 4. Casos de Teste por Arquivo

### 4.1 `bug_fixes_phase1.cy.ts` — Regressões Fase 1

#### B1/B2 — Tela branca (JSON corrompido no localStorage)
- App carrega com `aurafetch_collection` corrompida no localStorage
- App carrega com `aurafetch_global_vars` corrompida no localStorage
- App carrega com ambas as chaves corrompidas simultaneamente

#### B5/B6/B8 — Response grande não trava e não persiste
- Response de 2MB renderiza sem travar (cy.intercept com payload grande)
- Após response grande, árvore responde a cliques normalmente
- Após reload, response não está no localStorage (não cresce)

#### B7/B9/B13 — WebSocket: cleanup e stale closure
- Mensagens WS aparecem corretamente após conexão
- Trocar de nó limpa as mensagens anteriores
- Reconectar ao mesmo nó não duplica mensagens

#### B10 — Web fallbacks
- Botão "Exportar" dispara download de arquivo JSON
- Botão de download de response dispara download no browser

#### B11/B12 — Sem `prompt()`, sem console leaks
- Renomear workspace não abre `window.prompt` nativo
- Nenhum `console.warn`/`console.error` durante fluxo básico de requisição GET

---

### 4.2 `file_upload.cy.ts` — Upload de Arquivo Real

#### Guard de tamanho (50MB)
- Arquivo de 49MB: upload aceito, sem mensagem de erro
- Arquivo de 51MB: exibe mensagem de erro "Arquivo muito grande" na UI
- Arquivo exatamente 50MB: tratado como inválido (limite é estritamente menor que 50MB)

*Implementação: `cy.task('generateLargeFile', { sizeMb: 49 | 50 | 51 })` gera em `os.tmpdir()` e retorna o caminho. `after()` chama `cy.task('cleanupTempFiles')`.*

#### Form-data com arquivo real
- Adicionar campo tipo "arquivo" e selecionar `small-file.txt` (1KB)
- Campo exibe nome do arquivo após seleção
- Enviar POST form-data com arquivo → postman-echo confirma campo presente
- Content-Type do Blob é `application/octet-stream`
- Header `Content-Type` com boundary não é sobrescrito manualmente (boundary gerado pelo browser)

#### Binary upload
- Selecionar `sample-image.png` como body binário
- Enviar requisição → postman-echo confirma Content-Length no echo

---

### 4.3 `response_rendering.cy.ts` — Renderização de Response

#### JSON
- Response JSON exibida com formatação pretty print (indentação visível)
- Response JSON grande (500KB via cy.intercept) renderiza sem travar a UI
- Aba "Raw" exibe o texto bruto sem formatação

#### HTML
- Response com `Content-Type: text/html` exibe o HTML renderizado
- Aba "Raw" disponível para ver o fonte

#### Imagem
- Response com `Content-Type: image/png` exibe imagem na aba Body
- Botão de download disponível

#### Binário
- Response com `Content-Type: application/octet-stream` exibe indicação de binário
- Botão de download disponível

#### Metadados
- Aba Headers mostra os headers retornados pelo servidor
- Status code visível na UI (200, 404, 500)
- Tempo de resposta exibido nos logs/console
- Aba Console mostra timestamp e duração da requisição

#### Persistência
- Response NÃO persiste no localStorage após reload (regressão B5)
- Trocar de nó limpa a response exibida

---

### 4.4 `import_export.cy.ts` — Import/Export e Download

#### Export de coleção
- Botão "Exportar" visível na UI
- Arquivo baixado é um JSON válido
- JSON exportado contém os workspaces, pastas e requisições criadas
- Exportar coleção vazia não trava

#### Import de coleção
- Selecionar `sample-collection.json` popula a árvore corretamente
- Workspaces importados aparecem com nomes corretos
- Pastas e requisições dentro dos workspaces são preservadas
- Environments importados são preservados
- Importar JSON inválido exibe mensagem de erro sem travar

#### Download de response
- Após receber response, botão de download está disponível
- Clicar no botão dispara download no browser
- Response JSON baixada tem o conteúdo correto
- Response binária (PNG via cy.intercept) pode ser baixada

---

### 4.5 `auth.cy.ts` — Autenticação

#### Bearer Token
- Selecionar tipo "Bearer" exibe campo de token
- Requisição enviada contém header `Authorization: Bearer <token>`
- Token com variável `{{token}}` é substituído pelo valor do environment ativo

#### Basic Auth
- Selecionar tipo "Basic" exibe campos usuário e senha
- Requisição enviada contém header `Authorization: Basic <base64>`
- Credenciais com variáveis são substituídas antes de codificar

#### API Key
- Selecionar tipo "API Key" exibe campos nome e valor
- API key adicionada como header personalizado na requisição
- API key adicionada como query param quando configurada assim

#### OAuth2
- Selecionar tipo "OAuth2" exibe os campos de configuração
- Campos `client_id`, `client_secret`, `token_url` visíveis na UI
- *(Fluxo OAuth2 completo não testado — requer servidor externo)*

#### Herança de autenticação por pasta
- Pasta com Bearer: requisição filha herda o header `Authorization`
- Requisição com auth própria sobrescreve a auth da pasta
- Requisição com auth "Nenhuma" ignora a auth da pasta pai

---

### 4.6 Expansões nos arquivos existentes

#### `websocket_ui.cy.ts` — fluxo completo
- Conectar a `wss://echo.websocket.org`
- Enviar mensagem de texto, verificar que aparece na lista
- Receber echo da mensagem enviada
- Desconectar limpa o status de conexão na UI
- Reconectar após desconexão funciona sem duplicar mensagens (regressão B13)
- Trocar de nó enquanto conectado: ao voltar, estado está limpo (regressão B9)

#### `professional_features.cy.ts` — code snippets
- Aba "Código" disponível após configurar uma requisição
- Snippet cURL contém o método e URL corretos
- Snippet fetch é JavaScript válido (contém `fetch(`)
- Snippet axios contém os headers configurados
- Snippet atualiza quando URL ou método muda

#### `core_stability.cy.ts` — histórico e busca
- Histórico persiste após reload da página
- Clicar em item do histórico restaura URL, método e headers
- Busca filtra por nome de pasta e de requisição simultaneamente
- Environment variables persistem após reload

#### `workspace_tree.cy.ts` — rename e duplicar
- Renomear workspace sem disparar `window.prompt` nativo (sem `prompt()`)
- Renomear pasta preserva as requisições filhas
- Duplicar requisição cria cópia com mesmo método e URL
- Environments de workspaces diferentes são independentes entre si

---

## 5. Fixtures

### `cypress/fixtures/small-file.txt`
Arquivo de texto simples, ~1KB, com conteúdo ASCII. Usado em tests de form-data.

### `cypress/fixtures/sample-image.png`
PNG mínimo válido, ~10KB. Usado em tests de binary upload e response rendering.

### `cypress/fixtures/sample-collection.json`
Coleção JSON no formato interno do AuraFetch com:
- 1 workspace ("Workspace Teste")
- 2 pastas ("Pasta A", "Pasta B")
- 3 requisições GET com URLs distintas
- 1 environment com 2 variáveis

---

## 6. Tasks Cypress (`cypress/tasks/file-tasks.ts`)

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

---

## 7. Alteração em `cypress.config.ts`

```typescript
import { defineConfig } from 'cypress'
import { generateLargeFile, cleanupTempFiles } from './cypress/tasks/file-tasks'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on) {
      on('task', { generateLargeFile, cleanupTempFiles })
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
  },
})
```

---

## 8. Contagem de Testes

| Arquivo | Testes novos |
|---|---|
| `bug_fixes_phase1.cy.ts` | 13 |
| `file_upload.cy.ts` | 10 |
| `response_rendering.cy.ts` | 12 |
| `import_export.cy.ts` | 10 |
| `auth.cy.ts` | 12 |
| Expansões nos 4 existentes | 22 |
| **Total novos** | **79** |
| Testes existentes mantidos | ~35 |
| **Total geral** | **~114** |

---

## 9. Restrições e Limites

- **WebSocket externo:** `wss://echo.websocket.org` é um serviço público. Se estiver indisponível, os testes de WS falham. Alternativa futura: subir servidor WS local via `cy.task`.
- **OAuth2 completo:** não testado automaticamente (requer servidor de autorização). Apenas a presença dos campos na UI é verificada.
- **Tauri nativo:** testes rodam contra o servidor web (`localhost:5173`). Funcionalidades exclusivas do runtime Tauri (leitura nativa de arquivo via `tauriReadFile`) são cobertas pelos guards `isTauri()` e testadas no caminho web com `selectFile()`.
- **Arquivo de 50MB:** gerado em memória e escrito no disco. Em máquinas com menos de 200MB livres em `os.tmpdir()`, os testes de size guard podem falhar por espaço insuficiente.
