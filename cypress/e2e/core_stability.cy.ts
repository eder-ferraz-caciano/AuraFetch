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
        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.get('.status-badge', { timeout: 25000 }).should('be.visible');

        // Mudar para a aba de Histórico
        cy.get('button').contains('Histórico').click();
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
        cy.get('.tab').contains('Autenticação').click();
        cy.get('select').first().select('bearer');
        cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_TESTE', { parseSpecialCharSequences: false });

        cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
        cy.get('.tab').contains('Autenticação').click();

        cy.get('.glass-panel select').should('have.value', 'inherit');
        cy.contains('Esta requisição herda a autenticação da pasta pai').should('be.visible');
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

        cy.contains('button', 'Repensar').click();
        cy.get('.modal-overlay').should('not.exist');
    });
});
