describe('AuraFetch - Premium Features E2E', () => {
    const POSTMAN_ECHO = 'https://postman-echo.com';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
        cy.get('.sidebar-tree-container', { timeout: 20000 }).contains('Listar Dados', { timeout: 15000 }).click({ force: true });
    });

    // ────────────────────────────────────────────
    // 1. CUSTOM HEADERS
    // ────────────────────────────────────────────
    it('Deve gerenciar Headers Customizados e validar eco', () => {
        cy.get('.tab').contains('Headers').click();

        // CRITICAL: Adicionar linha NOVA primeiro, senão digita nos existentes (Accept)
        cy.contains('button', 'Adicionar Header').click();

        // Agora o último input de key/value estará vazio
        cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Test-Api', { parseSpecialCharSequences: false });
        cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('Antigravity-Value', { parseSpecialCharSequences: false });

        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });

        // A resposta fica em div.response-panel.body-content
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'x-test-api');
    });

    // ────────────────────────────────────────────
    // 2. JSON BODY
    // ────────────────────────────────────────────
    it('Deve enviar JSON no Body', () => {
        cy.get('.method-select').select('POST');
        cy.get('.tab').contains('Body').click();
        cy.contains('label', 'JSON').click();

        // O CodeMirror do body está dentro de um div com background #282c34, não tem classe customizada
        // Primeiro .cm-content na página é o editor de Body
        cy.get('.cm-content').first().focus().clear().type('{"key": "json_val"}', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'json_val');
    });

    // ────────────────────────────────────────────
    // 3. FORM-DATA
    // ────────────────────────────────────────────
    it('Deve enviar FORM-DATA', () => {
        cy.get('.method-select').select('POST');
        cy.get('.tab').contains('Body').click();
        cy.contains('label', 'FORM-DATA').click();

        // Botão correto: "Adicionar Campo"
        cy.contains('button', 'Adicionar Campo').click();
        cy.get('input[placeholder="Key"]').last().type('fd_key', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Value"]').last().type('fd_val', { parseSpecialCharSequences: false });

        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'fd_key').and('contain', 'fd_val');
    });

    // ────────────────────────────────────────────
    // 4. URL-ENCODED
    // ────────────────────────────────────────────
    it('Deve enviar x-www-form-urlencoded', () => {
        cy.get('.method-select').select('POST');
        cy.get('.tab').contains('Body').click();
        cy.contains('label', 'x-www-form-urlencoded').click();

        // Botão correto: "Adicionar Par Chave/Valor" (diferente do FORM-DATA!)
        cy.contains('button', 'Adicionar Par Chave/Valor').click();
        cy.get('input[placeholder="Key"]').last().type('url_key', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Value"]').last().type('url_val', { parseSpecialCharSequences: false });

        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'url_key').and('contain', 'url_val');
    });

    // ────────────────────────────────────────────
    // 5. VARIÁVEIS GLOBAIS
    // ────────────────────────────────────────────
    it('Deve injetar variáveis Globais no fluxo', () => {
        // Navigate to workspace to set global vars via the new inline UI
        cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
            .find('.node-name').click({ force: true });

        // Go to "Variáveis Globais" tab
        cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
        cy.contains('Variáveis globais são acessíveis').should('be.visible');

        // Add a global variable
        cy.contains('button', 'Adicionar Linha').click();
        cy.get('input[placeholder="Chave"]').last().type('env_host', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Valor"]').last().type(POSTMAN_ECHO, { parseSpecialCharSequences: false });

        // Go back to the request
        cy.get('.sidebar-tree-container').contains('Listar Dados', { timeout: 10000 }).click({ force: true });

        // Use the global variable in the URL
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('{{env_host}}/get', { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.status-badge', { timeout: 25000 }).should('contain', '200');
    });

    // ────────────────────────────────────────────
    // 6. SCRIPT DA PASTA
    // ────────────────────────────────────────────
    it('Deve executar Script de Setup da Pasta e validar Log', () => {
        cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto', { timeout: 10000 }).click({ force: true });
        // Clicar na aba Script do folder config
        cy.contains('button', 'Script').click();
        cy.get('.cm-content').last().focus().clear().type('aurafetch.log("CY_FOLDER_OK");', { parseSpecialCharSequences: false });
        cy.contains('button', 'Executar').click();

        // O console inline da pasta usa classe .log-line dentro de um div
        cy.get('.log-line', { timeout: 15000 }).should('contain', 'CY_FOLDER_OK');
    });

    // ────────────────────────────────────────────
    // 7. RESPONSE HEADERS + CONSOLE
    // ────────────────────────────────────────────
    it('Deve validar Abas de Response Headers e Console', () => {
        cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
        cy.contains('button', 'Enviar').click({ force: true });
        cy.get('.status-badge', { timeout: 25000 }).should('be.visible');

        // Headers da resposta (classe: div.response-panel.body-content com um .headers-grid dentro)
        cy.get('.bottom-tabs .tab').contains('Headers').click();
        cy.get('.body-content .headers-grid', { timeout: 15000 }).should('exist');

        // Console (classe: div.console-panel.body-content com renderConsole)
        cy.get('.tab').contains('Console').click();
        cy.get('.console-panel', { timeout: 15000 }).should('contain', 'REQUISIÇÃO');
    });

  // ────────────────────────────────────────────
  // 8. CODE SNIPPETS
  // ────────────────────────────────────────────
  it('Deve gerar Code Snippet com método e URL corretos (cURL)', () => {
    cy.get('.method-select').select('POST');
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/dados', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar snippet"]').click();
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal-content pre').should('contain', 'POST').and('contain', 'api.exemplo.com/dados');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Deve gerar snippet fetch válido', () => {
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/lista', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar snippet"]').click();
    cy.get('.modal-content .select-input').select('fetch');
    cy.get('.modal-content pre').should('contain', 'fetch(').and('contain', 'api.exemplo.com/lista');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Deve gerar snippet axios com headers configurados', () => {
    cy.get('.tab').contains('Headers').click();
    cy.contains('button', 'Adicionar Header').click();
    cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-App-Token');
    cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('token_ax_123');
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://api.exemplo.com/post', { parseSpecialCharSequences: false });
    cy.get('button[title="Gerar snippet"]').click();
    cy.get('.modal-content .select-input').select('axios');
    cy.get('.modal-content pre').should('contain', 'axios(').and('contain', 'X-App-Token');
    cy.get('.modal-overlay').click({ force: true });
  });

  it('Snippet atualiza quando URL muda', () => {
    cy.get('button[title="Gerar snippet"]').click();
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal-content pre').invoke('text').then(textBefore => {
      cy.get('.modal-overlay').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type('https://novo.servidor.com/endpoint', { parseSpecialCharSequences: false });
      cy.get('button[title="Gerar snippet"]').click();
      cy.get('.modal-content pre').invoke('text').should('include', 'novo.servidor.com');
    });
  });
});
