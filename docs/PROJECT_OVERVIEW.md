# AuraFetch — Project Overview

> **Este documento é lido no início de cada sessão de desenvolvimento com IA.**
> Última atualização: 2026-03-30 | Versão: 1.3.2

---

## O que é

AuraFetch é um **cliente de API desktop** (alternativa ao Postman/Insomnia) construído com Tauri 2 + React 19 + TypeScript. Roda como app nativo (Windows) e também como web app (GitHub Pages).

**Roadmap:** evoluir para **DevLoid** — ferramenta completa de dev utils (HTTP Client + QR Code, JWT, Base64, Cron, etc.), com renomeação completa na Fase 4.

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Desktop runtime | Tauri 2 (Rust) | 2.x |
| Frontend | React | 19.2 |
| Linguagem | TypeScript | 5.9 |
| Bundler | Vite | 7.3 |
| Editor de código | CodeMirror 6 | 6.x |
| Ícones | Lucide React | 0.575 |
| Testes E2E | Cypress | 15.11 |
| Versionamento | standard-version | 9.5 |

## Funcionalidades principais

- Requisições HTTP (GET, POST, PUT, DELETE, PATCH)
- WebSocket (conectar, enviar, receber, desconectar)
- Workspaces com árvore de coleções (pastas e requisições)
- Environments e variáveis globais com interpolação `{{var}}`
- Autenticação: Bearer, Basic, API Key, OAuth2 UI, herança de pasta
- Upload de arquivo: form-data e binary (com guard de 50MB)
- Renderização de response: JSON (syntax highlight), HTML (iframe), imagem, binário
- Import/export de coleções (.json)
- Download de responses (JSON e binário)
- Pre-request scripts (JavaScript com `aurafetch.setEnv()`, `aurafetch.setVar()`, `aurafetch.log()`)
- Code snippets: cURL, fetch, axios
- Histórico de requisições
- Console com logs e timestamps

## Estado atual

| Item | Status |
|------|--------|
| Versão | **1.3.2** |
| Fase 0 — Auditoria | Concluída |
| Fase 1 — Correção de bugs (14 bugs) | Concluída |
| Testes Cypress | **121 passando, 0 falhas** (10 spec files) |
| Fase 2 — Componentização | **Próxima** |
| Fase 3a — Dev Tools Offline | Pendente |
| Fase 3b — Dev Tools de Rede | Pendente |
| Fase 4 — Renomeação para DevLoid | Pendente |

## Decisões importantes já tomadas

1. **100% Cypress** para testes — sem Vitest/Jest. Testa comportamento real do usuário.
2. **Sem refatoração durante bug fixes** — Fase 1 fez apenas correções pontuais no App.tsx monolítico.
3. **API de scripts é contrato** — `aurafetch.setEnv()`, `aurafetch.setVar()`, `aurafetch.log()` não podem quebrar (usuários têm scripts salvos).
4. **Web fallback obrigatório** — Toda funcionalidade Tauri precisa de guard `isTauri()` com fallback para browser.
5. **Renomeação para DevLoid** (não HTTPilot) — inclui migração de todos os 4 keys de localStorage e alias retrocompatível para API de scripts por 1 release.
6. **HTTP Client permanece a ferramenta principal** — Dev Tools é complementar.

## Repositório

- **GitHub:** https://github.com/eder-ferraz-caciano/AuraFetch
- **Deploy web:** GitHub Pages
- **Instaladores:** `.exe` (NSIS) e `.msi` (WiX) gerados via `npx tauri build`
- **Release:** `npm run release` (standard-version) → `git push --follow-tags` → `npx tauri build` → `gh release upload`

## Idioma da UI

A interface está em **português brasileiro**. Exemplos:
- Tabs: "Ambientes", "Variáveis Globais"
- Botões: "Adicionar Campo", "Baixar Arquivo", "Salvar resposta no Disco"
- Placeholders: `admin`, `••••••`, `x-api-key`, `A8F90x...`
- Labels de body type: renderizados como `type.toUpperCase()` (ex: "BINARY", "FORM-DATA")
