describe('AuraFetch - Queries & Params Synchronization E2E', () => {
    const POSTMAN_ECHO = 'https://postman-echo.com';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
        // Selecionar a primeira requisição da coleção para garantir que estamos em uma requisição
        cy.get('.sidebar-tree-container', { timeout: 20000 }).contains('Listar Dados', { timeout: 15000 }).click({ force: true });
    });

    // ────────────────────────────────────────────
    // 1. QUERY PARAMS SYNC (2-WAY)
    // ────────────────────────────────────────────
    it('Deve sincronizar a URL ao adicionar Query Params na tabela', () => {
        // Primeiro definir a URL base
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });

        cy.get('.tab').contains('Query').click();

        // Adicionar nova query (renderVarTable usa botão "Adicionar Linha")
        cy.contains('button', 'Adicionar Linha').first().click();

        cy.get('input[placeholder="Chave"]').last().clear().type('teste_query', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Valor"]').last().clear().type('valor_abc', { parseSpecialCharSequences: false });

        // Verificar se a URL foi atualizada (deve conter chave=valor)
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .invoke('val')
            .should('include', 'teste_query=valor_abc');
    });

    it('Deve preencher a tabela ao digitar Query Params na URL', () => {
        cy.get('.tab').contains('Query').click();

        // Digitar diretamente na barra de URL
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get?q=tauri&lang=pt`, { parseSpecialCharSequences: false });

        // Verificar se a tabela de Queries agora tem os itens nos inputs
        // O h3 deve conter "Query Parameters"
        cy.get('.headers-container').contains('Query Parameters').should('be.visible');

        // Deve ter pelo menos dois inputs de chave preenchidos
        cy.get('input[placeholder="Chave"]').should('have.length.at.least', 2);
    });

    // ────────────────────────────────────────────
    // 2. PATH PARAMS DETECTION
    // ────────────────────────────────────────────
    it('Deve detectar Path Params (:id) na URL e criar na tabela', () => {
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/users/:id/details`, { parseSpecialCharSequences: false });

        cy.get('.tab').contains('Params').click();

        // Verificar se a chave "id" foi criada na tabela de Params
        cy.get('input[placeholder="Chave"]').last().should('have.value', 'id');

        // Preencher o valor do ID
        cy.get('input[placeholder="Valor"]').last().type('789', { parseSpecialCharSequences: false });

        // Verificar que o valor foi preenchido corretamente
        cy.get('input[placeholder="Valor"]').last().should('have.value', '789');
    });

    // ────────────────────────────────────────────
    // 3. LAYOUT & DIMENSIONS
    // ────────────────────────────────────────────
    it('Deve respeitar a largura inicial do painel (800px)', () => {
        cy.get('.request-panel').invoke('css', 'width').then((width) => {
            const widthVal = parseInt(width as string);
            expect(widthVal).to.be.closeTo(800, 10); // 800px +/- 10px margem
        });
    });

    // ────────────────────────────────────────────
    // 4. DOWNLOADS & EXPORT (UI CHECK)
    // ────────────────────────────────────────────
    it('Deve mostrar o botão de exportar workspace', () => {
        cy.get('button[title*="Exportar"]').should('be.visible');
    });
});
