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
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@largeGet');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    });

    it('após response grande, árvore responde a cliques', () => {
      const largePayload = { data: 'y'.repeat(2_000_000) };
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`, { body: largePayload, statusCode: 200 }).as('largeGet');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Enviar').click({ force: true });
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
      cy.contains('button', 'Enviar').click({ force: true });
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
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('downloadClick');
      });
      cy.get('button[title="Download"]').click();
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
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('@consoleWarn').should('not.have.been.called');
      cy.get('@consoleError').should('not.have.been.called');
    });
  });
});
