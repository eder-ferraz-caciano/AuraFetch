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
        cy.get('button[title="Salvar resposta no Disco"]').should('exist');
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

    it('status code 500 é exibido corretamente', () => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 500, body: { error: 'internal server error' } }).as('serverError');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@serverError');
      cy.get('.status-badge', { timeout: 15000 }).should('contain', '500');
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
