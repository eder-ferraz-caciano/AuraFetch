describe('AuraFetch - Core Stability & Reliability E2E', () => {
    const POSTMAN_ECHO = 'https://postman-echo.com';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        // Espera a UI carregar
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    // ────────────────────────────────────────────
    // 1. PERSISTENCE & RELOAD
    // ────────────────────────────────────────────
    it('Deve persistir o Workspace ao recarregar a página', () => {
        cy.get('button[title="Novo Workspace"]').click();
        cy.get('input[placeholder="Nome do workspace..."]', { timeout: 5000 }).should('be.visible').type('Workspace Persistente');
        cy.get('input[placeholder="Nome do workspace..."]').type('{enter}');
        cy.get('.sidebar-tree-container', { timeout: 10000 }).should('contain', 'Workspace Persistente');

        cy.reload();
        cy.get('.sidebar-tree-container', { timeout: 20000 }).should('contain', 'Workspace Persistente');
    });

    // ────────────────────────────────────────────
    // 2. SEARCH & FILTERING
    // ────────────────────────────────────────────
    it('Deve filtrar a árvore de requisições corretamente', () => {
        cy.get('.sidebar-tree-container').contains('Listar Dados').should('be.visible');
        cy.get('input[placeholder="Buscar requisição, pasta..."]').type('xyz_nao_existe');
        cy.get('.sidebar-tree-container').should('not.contain', 'Listar Dados');

        cy.get('input[placeholder="Buscar requisição, pasta..."]').clear().type('Dados');
        cy.get('.sidebar-tree-container').should('contain', 'Listar Dados');
    });

    // ────────────────────────────────────────────
    // 3. HISTORY MANAGEMENT
    // ────────────────────────────────────────────
    it('Deve gerenciar o Histórico de requisições', () => {
        // Selecionar uma requisição e disparar com URL única
        cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get?test=history`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.status-badge', { timeout: 25000 }).should('be.visible');

        // Mudar para a aba de Historico na sidebar
        cy.contains('button', 'Historico').click();
        cy.get('.history-card').should('have.length.at.least', 1);

        // Clicar no histórico deve carregar a URL no input principal
        cy.get('.history-card').first().click();
        cy.get('input[placeholder="{{base_url}}/api/..."]').should('have.value', `${POSTMAN_ECHO}/get?test=history`);
    });

    // ────────────────────────────────────────────
    // 4. AUTHENTICATION INHERITANCE
    // ────────────────────────────────────────────
    it('Deve mostrar que a Requisição herda Auth da Pasta no UI', () => {
        cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
        // Folder config abre na aba auth por padrão (sem .tab class)
        cy.get('.select-input').first().select('bearer');
        cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_TESTE', { parseSpecialCharSequences: false });

        cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
        cy.get('.tab').contains('Auth').click();

        cy.get('.glass-panel select').should('have.value', 'inherit');
        cy.contains('Herda autenticacao da pasta pai').should('be.visible');
    });

    // ────────────────────────────────────────────
    // 5. CRUD: DELEÇÃO
    // ────────────────────────────────────────────
    it('Deve abrir modal de confirmação ao deletar', () => {
        cy.contains('.tree-item', 'Meu Servidor/Projeto').within(() => {
            cy.get('button[title="Opções"]').click({ force: true });
        });

        cy.get('.tree-dropdown-menu').contains('Excluir').click();
        cy.get('.modal-overlay').should('be.visible');
        cy.contains('Confirmar Eliminação').should('be.visible');

        cy.contains('button', 'Cancelar').click();
        cy.get('.modal-overlay').should('not.exist');
    });

  // ────────────────────────────────────────
  // 6. HISTÓRICO PERSISTE APÓS RELOAD
  // ────────────────────────────────────────
  it('Deve persistir histórico após reload', () => {
    cy.intercept('GET', '**/get*', { body: { ok: true }, statusCode: 200 }).as('req');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://postman-echo.com/get?test=persist_hist', { parseSpecialCharSequences: false });
    cy.contains('button', 'Enviar').click({ force: true });
    cy.wait('@req');
    cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    cy.reload();
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    // Selecionar um nó para ativar o histórico do workspace
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.contains('button', 'Historico').click();
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
    cy.contains('button', 'Enviar').click({ force: true });
    cy.wait('@postReq');
    cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    cy.contains('button', 'Historico').click();
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
    // A pasta pai "Meu Servidor/Projeto" ainda aparece porque a árvore exibe o caminho completo
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
    cy.get('input[placeholder="Valor"]').last().type('persist_valor_123').blur();
    // Aguardar persitência no localStorage antes do reload
    cy.wait(500);
    cy.reload();
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
      .find('.node-name').click({ force: true });
    cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
    // Usar .have.value pois o conteúdo está em um input, não em texto visível
    cy.get('input[placeholder="Valor"]').should('have.value', 'persist_valor_123');
  });
});
