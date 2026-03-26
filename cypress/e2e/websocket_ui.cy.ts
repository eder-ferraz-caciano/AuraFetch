describe('AuraFetch - WebSocket UI', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        // Espera a UI carregar
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    it('Deve criar uma requisição WebSocket via menu e mostrar a UI de chat', () => {
        cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
            cy.get('button[title="Opções"]').click({ force: true });
        });

        cy.get('.tree-dropdown-menu').contains('Nova Conexão WS').click();
        
        // Verifica se a tag WS aparece na árvore
        cy.get('.tree-item.active-node .method-WS').should('contain', 'WS');
        cy.get('.tree-item.active-node .node-name').should('contain', 'Conexão WebSocket');

        // Verifica a URL bar
        cy.get('.url-bar-container').should('contain', 'WS');
        cy.get('input[placeholder="wss://echo.websocket.org..."]').should('have.value', 'wss://echo.websocket.org');

        // Verifica o botão de conectar
        cy.get('.btn-send').should('contain', 'Conectar WS');

        // Verifica o painel de chat / input de mensagem
        cy.get('textarea[placeholder="Escreva a mensagem (Enter para enviar)..."]').should('be.visible');
        
        // Tenta digitar algo e o botão enviar inicialmente deve estar desabilitado (pois não está conectado)
        cy.get('textarea').type('Olá WebSocket', { force: true });
        cy.get('button').find('svg.lucide-send').parent().should('be.disabled');
    });
});

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
