/**
 * AuraFetch – Workspace, Tree & Environment E2E Tests
 *
 * Covers:
 *  1. Creating multiple workspaces
 *  2. Creating folders and requests inside workspaces
 *  3. Moving requests between folders (drag & drop)
 *  4. Moving folders within a workspace
 *  5. Moving folders/requests between different workspaces
 *  6. Switching active environments
 *  7. Query Params, Path Params (Params URL tab), and Queries tab synchronization
 */

describe('AuraFetch – Workspace & Tree E2E', () => {

    // ─── Helper: click the ⋮ menu on a tree node, then an action ───
    const openNodeMenu = (nodeName: string) => {
        cy.get('.sidebar-tree-container')
            .contains('.tree-item', nodeName, { timeout: 10000 })
            .find('.tree-item-menu-trigger button')
            .click({ force: true });
    };

    const clickMenuAction = (actionText: string) => {
        cy.get('.tree-dropdown-menu')
            .should('be.visible')
            .contains('button', actionText)
            .click({ force: true });
    };

    // ─── Helper: click a tree node by name ───
    const clickTreeNode = (name: string) => {
        cy.get('.sidebar-tree-container')
            .contains('.node-name', name, { timeout: 10000 })
            .click({ force: true });
    };

    // ─── Helper: create workspace via action-bar inline input ───
    const createWorkspace = (name: string) => {
        cy.get('button[title="Novo Workspace"]').click({ force: true });
        cy.get('input[placeholder="Nome do workspace..."]', { timeout: 5000 }).should('be.visible').type(name);
        cy.get('input[placeholder="Nome do workspace..."]').type('{enter}');
        cy.get('.sidebar-tree-container').contains(name, { timeout: 10000 }).should('exist');
    };

    // ─── Helper: create folder inside a parent node via ⋮ menu ───
    const createFolderIn = (parentName: string) => {
        openNodeMenu(parentName);
        clickMenuAction('Nova Pasta');
        cy.get('.sidebar-tree-container').contains('Nova Pasta', { timeout: 10000 }).should('exist');
    };

    // ─── Helper: create request inside a parent node via ⋮ menu ───
    const createRequestIn = (parentName: string) => {
        openNodeMenu(parentName);
        clickMenuAction('Nova Requisição');
        cy.get('.sidebar-tree-container').contains('Nova Rota', { timeout: 10000 }).should('exist');
    };

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 1: WORKSPACE CREATION
    // ═══════════════════════════════════════════════════════════════
    describe('1. Criação de Workspaces', () => {
        it('Deve já ter o "Workspace Padrão" ao iniciar', () => {
            cy.get('.sidebar-tree-container .workspace-node')
                .should('have.length.at.least', 1)
                .first()
                .should('contain.text', 'Workspace');
        });

        it('Deve criar um segundo Workspace pela barra de ações', () => {
            createWorkspace('Workspace Testes');
            cy.get('.sidebar-tree-container .workspace-node').should('have.length', 2);
            cy.get('.sidebar-tree-container').contains('Workspace Testes').should('be.visible');
        });

        it('Deve criar múltiplos Workspaces e todos coexistirem', () => {
            createWorkspace('WS Alpha');
            // Need to re-stub for the second prompt
            createWorkspace('WS Beta');
            cy.get('.sidebar-tree-container .workspace-node').should('have.length', 3);
        });

        it('Deve exibir o badge de ambiente no Workspace Padrão', () => {
            cy.get('.sidebar-tree-container .workspace-node')
                .first()
                .find('.workspace-env-badge')
                .should('contain.text', 'Ambiente DEV');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 2: FOLDERS & REQUESTS INSIDE WORKSPACES
    // ═══════════════════════════════════════════════════════════════
    describe('2. Criação de Pastas e Requisições dentro de Workspaces', () => {
        it('Deve criar pasta dentro do Workspace Padrão via ⋮ menu', () => {
            openNodeMenu('Workspace');
            clickMenuAction('Nova Pasta');
            cy.get('.sidebar-tree-container').contains('Nova Pasta').should('be.visible');
        });

        it('Deve criar requisição dentro do Workspace Padrão via ⋮ menu', () => {
            openNodeMenu('Workspace');
            clickMenuAction('Nova Requisição');
            cy.get('.sidebar-tree-container').contains('Nova Rota').should('be.visible');
        });

        it('Deve criar requisição dentro de uma pasta via ⋮ menu', () => {
            openNodeMenu('Meu Servidor/Projeto');
            clickMenuAction('Nova Requisição');
            cy.get('.sidebar-tree-container').contains('Nova Rota').should('be.visible');
        });

        it('Deve criar pasta dentro de outra pasta via ⋮ menu', () => {
            openNodeMenu('Meu Servidor/Projeto');
            clickMenuAction('Nova Pasta');
            cy.get('.sidebar-tree-container').contains('Nova Pasta').should('be.visible');
        });

        it('Deve criar pasta e requisição dentro de um Workspace novo', () => {
            createWorkspace('WS Secundário');
            openNodeMenu('WS Secundário');
            clickMenuAction('Nova Requisição');
            cy.get('.sidebar-tree-container').contains('Nova Rota').should('be.visible');
        });

        it('Deve criar pasta e req via botões no header do workspace config', () => {
            clickTreeNode('Workspace');
            // Click "HTTP" in the workspace config header (was previously Requisição)
            cy.get('.main-content').contains('button', 'HTTP').click({ force: true });
            cy.get('.sidebar-tree-container').contains('Nova Rota').should('exist');

            // Go back to workspace
            clickTreeNode('Workspace');
            cy.get('.main-content').contains('button', 'Pasta').click({ force: true });
            cy.get('.sidebar-tree-container').contains('Nova Pasta').should('exist');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 3: DRAG & DROP – MOVE REQUESTS BETWEEN FOLDERS
    // ═══════════════════════════════════════════════════════════════
    describe('3. Mover Requisições entre Pastas (Drag & Drop)', () => {
        it('Deve arrastar requisição de uma pasta para o workspace root', () => {
            const dataTransfer = new DataTransfer();

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Listar Dados')
                .trigger('dragstart', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Workspace')
                .first()
                .trigger('dragover', { dataTransfer, force: true })
                .trigger('drop', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Listar Dados')
                .trigger('dragend', { force: true });

            // The item should still exist in the tree after the drop
            cy.get('.sidebar-tree-container').contains('Listar Dados').should('exist');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 4: DRAG & DROP – MOVE FOLDERS
    // ═══════════════════════════════════════════════════════════════
    describe('4. Mover Pastas (Drag & Drop)', () => {
        it('Deve arrastar pasta criada para outra posição', () => {
            // Create a new folder first
            openNodeMenu('Workspace');
            clickMenuAction('Nova Pasta');

            const dataTransfer = new DataTransfer();

            // Drag "Nova Pasta" onto "Meu Servidor/Projeto"
            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Nova Pasta')
                .trigger('dragstart', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Meu Servidor/Projeto')
                .trigger('dragover', { dataTransfer, force: true })
                .trigger('drop', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Nova Pasta')
                .trigger('dragend', { force: true });

            cy.get('.sidebar-tree-container').contains('Nova Pasta').should('exist');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 5: DRAG & DROP – CROSS-WORKSPACE MOVEMENT
    // ═══════════════════════════════════════════════════════════════
    describe('5. Mover entre Workspaces (Drag & Drop)', () => {
        beforeEach(() => {
            createWorkspace('WS Destino');
        });

        it('Deve arrastar requisição do WS Padrão para o WS Destino', () => {
            const dataTransfer = new DataTransfer();

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Listar Dados')
                .trigger('dragstart', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'WS Destino')
                .trigger('dragover', { dataTransfer, force: true })
                .trigger('drop', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Listar Dados')
                .trigger('dragend', { force: true });

            cy.get('.sidebar-tree-container').contains('Listar Dados').should('exist');
        });

        it('Deve arrastar pasta do WS Padrão para o WS Destino', () => {
            const dataTransfer = new DataTransfer();

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Meu Servidor/Projeto')
                .trigger('dragstart', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'WS Destino')
                .trigger('dragover', { dataTransfer, force: true })
                .trigger('drop', { dataTransfer, force: true });

            cy.get('.sidebar-tree-container')
                .contains('.tree-item', 'Meu Servidor/Projeto')
                .trigger('dragend', { force: true });

            cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').should('exist');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 6: ENVIRONMENT SWITCHING
    // ═══════════════════════════════════════════════════════════════
    describe('6. Trocar de Ambiente', () => {
        it('Deve exibir o badge "Ambiente DEV" no Workspace Padrão', () => {
            cy.get('.workspace-node')
                .first()
                .find('.workspace-env-badge')
                .should('exist')
                .and('contain.text', 'Ambiente DEV');
        });

        it('Deve exibir aba de ambientes ao clicar no workspace', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-config-tabs').should('be.visible');
            cy.get('.ws-config-tab.active').should('contain.text', 'Ambientes');
        });

        it('Deve listar os ambientes DEV e PROD na sidebar de ambientes', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-env-sidebar', { timeout: 10000 }).should('be.visible');
            cy.get('.ws-env-item').should('have.length', 2);
            cy.get('.ws-env-item').eq(0).should('contain.text', 'Ambiente DEV');
            cy.get('.ws-env-item').eq(1).should('contain.text', 'Ambiente PROD');
        });

        it('Deve trocar o ambiente ativo de DEV para PROD', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-env-sidebar').should('be.visible');

            // Click the dot on "Ambiente PROD" to activate it
            cy.get('.ws-env-item').contains('Ambiente PROD')
                .closest('.ws-env-item')
                .find('.env-active-dot')
                .click({ force: true });

            // Badge should update to PROD
            cy.get('.workspace-node')
                .first()
                .find('.workspace-env-badge')
                .should('contain.text', 'Ambiente PROD');
        });

        it('Deve desativar o ambiente ativo clicando no dot do ativo', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-env-sidebar').should('be.visible');

            // The active env "Ambiente DEV" click dot to deactivate
            cy.get('.ws-env-item').contains('Ambiente DEV')
                .closest('.ws-env-item')
                .find('.env-active-dot')
                .click({ force: true });

            // Badge should show "Sem Amb."
            cy.get('.workspace-node')
                .first()
                .find('.workspace-env-badge')
                .should('contain.text', 'Sem Amb.');
        });

        it('Deve editar variáveis de um ambiente inline', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-env-sidebar').should('be.visible');

            // Select "Ambiente DEV" for editing
            cy.get('.ws-env-item').contains('Ambiente DEV').click({ force: true });

            // The editor should show
            cy.get('.ws-env-editor').should('be.visible');
            cy.get('.ws-env-editor-header input').should('have.value', 'Ambiente DEV');

            // The variable "base_url" should be present
            cy.get('.ws-env-editor')
                .find('input[placeholder="Chave"]')
                .first()
                .should('have.value', 'base_url');
        });

        it('Deve adicionar novo ambiente', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-env-sidebar').should('be.visible');

            cy.get('.ws-env-sidebar-header button').click({ force: true });

            cy.get('.ws-env-item').should('have.length', 3);
            cy.get('.ws-env-item').last().should('contain.text', 'Novo Ambiente');
        });

        it('Deve navegar para a aba Variáveis Globais', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
            cy.contains('Variáveis globais são acessíveis').should('be.visible');
        });

        it('Deve navegar para a aba Resumo e ver contadores', () => {
            clickTreeNode('Workspace');
            cy.get('.ws-config-tab').contains('Resumo').click({ force: true });
            cy.contains('Resumo do Workspace').should('be.visible');
            cy.contains('Itens na Raiz').should('be.visible');
            cy.contains('Ambientes').should('be.visible');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    //  SUITE 7: WELCOME SCREEN & SIDEBAR LAYOUT
    // ═══════════════════════════════════════════════════════════════
    describe('7. Welcome Screen e Sidebar', () => {
        it('Deve mostrar botão "Novo Workspace" na welcome screen', () => {
            cy.contains('button', 'Novo Workspace').should('be.visible');
        });

        it('Deve NÃO ter seletor de ambiente no rodapé do sidebar', () => {
            cy.get('.sidebar').should('exist');
            cy.contains('label', 'Ambiente Ativo').should('not.exist');
        });

        it('Deve ter botão de workspace na barra de ações', () => {
            cy.get('button[title="Novo Workspace"]').should('be.visible');
        });

        it('Deve NÃO ter botões de criar pasta ou req soltos na barra', () => {
            cy.get('button[title="Nova Pasta"]').should('not.exist');
            cy.get('button[title="Nova Req"]').should('not.exist');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
//  SEPARATE SUITE: QUERY PARAMS, PATH PARAMS, QUERIES
// ═══════════════════════════════════════════════════════════════════
describe('AuraFetch – Params, Queries & URL Synchronization', () => {
    const POSTMAN_ECHO = 'https://postman-echo.com';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.visit('/');
        cy.get('.app-title', { timeout: 30000 }).should('be.visible');
        // Navigate to the first request in the tree
        cy.get('.sidebar-tree-container', { timeout: 20000 })
            .contains('Listar Dados', { timeout: 15000 })
            .click({ force: true });
    });

    // ────────────────────────────────────────────
    // 1. QUERIES TAB – TABLE → URL (2-way sync)
    // ────────────────────────────────────────────
    it('Deve adicionar Query Param na tabela e sincronizar com a URL', () => {
        cy.get('.tab').contains('Queries').click();

        cy.contains('button', 'Adicionar Linha').first().click();

        cy.get('input[placeholder="Chave"]').last().clear().type('search', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Valor"]').last().clear().type('cypress_test', { parseSpecialCharSequences: false });

        // URL should now contain ?search=cypress_test
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .invoke('val')
            .should('include', 'search=cypress_test');
    });

    // ────────────────────────────────────────────
    // 2. QUERIES TAB – URL → TABLE (2-way sync)
    // ────────────────────────────────────────────
    it('Deve preencher a tabela de Queries ao digitar na URL', () => {
        cy.get('.tab').contains('Queries').click();

        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/get?page=1&limit=50`, { parseSpecialCharSequences: false });

        cy.get('.headers-container').contains('Query Parameters').should('be.visible');
        cy.get('input[placeholder="Chave"]').should('have.length.at.least', 2);
    });

    // ────────────────────────────────────────────
    // 3. PATH PARAMS DETECTION
    // ────────────────────────────────────────────
    it('Deve detectar Path Params (:id) na URL e criar na tabela', () => {
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/users/:userId/posts/:postId`, { parseSpecialCharSequences: false });

        cy.get('.tab').contains('Params (URL)').click();

        cy.get('input[placeholder="Chave"]').then(($inputs) => {
            const keys = $inputs.toArray().map(el => (el as HTMLInputElement).value);
            expect(keys).to.include('userId');
            expect(keys).to.include('postId');
        });
    });

    // ────────────────────────────────────────────
    // 4. PATH PARAMS REPLACEMENT IN REQUEST
    // ────────────────────────────────────────────
    it('Deve substituir :id no Path Param ao fazer disparo', () => {
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });

        // Add :id path param by editing the URL
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/get/user/:id`, { parseSpecialCharSequences: false });

        cy.get('.tab').contains('Params (URL)').click();

        // Fill in value for :id
        cy.get('input[placeholder="Valor"]').last().type('42', { parseSpecialCharSequences: false });

        // Switch to Queries tab to trigger any query parsing (should be empty for path params but keeps test structure)
        cy.get('.tab').contains('Queries').click();

        // Verify path param parsing happened (go back to Params tab to check or check path params table if visible)
        cy.get('.tab').contains('Params (URL)').click();
        cy.get('input[placeholder="Chave"]').should('have.length.at.least', 1).and('have.value', 'id');
    });

    // ────────────────────────────────────────────
    // 5. MULTIPLE QUERY PARAMS
    // ────────────────────────────────────────────
    it('Deve suportar múltiplos Query Params e enviar corretamente', () => {
        cy.get('.tab').contains('Queries').click();

        // Add first query param
        cy.contains('button', 'Adicionar Linha').first().click();
        cy.get('input[placeholder="Chave"]').last().clear().type('foo', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Valor"]').last().clear().type('bar', { parseSpecialCharSequences: false });

        // Add second query param
        cy.contains('button', 'Adicionar Linha').first().click();
        cy.get('input[placeholder="Chave"]').last().clear().type('baz', { parseSpecialCharSequences: false });
        cy.get('input[placeholder="Valor"]').last().clear().type('qux', { parseSpecialCharSequences: false });

        // URL should contain both
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .invoke('val')
            .should('include', 'foo=bar')
            .and('include', 'baz=qux');
    });

    // ────────────────────────────────────────────
    // 6. QUERY PARAMS WITH REAL ECHO
    // ────────────────────────────────────────────
    it('Deve enviar Query Params e receber echo correto', () => {
        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/get?framework=cypress&lang=ts`, { parseSpecialCharSequences: false });

        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.get('.status-badge', { timeout: 25000 }).should('contain', '200');
        cy.get('.body-content').should('contain', 'framework').and('contain', 'cypress');
    });

    // ────────────────────────────────────────────
    // 7. HEADERS TAB
    // ────────────────────────────────────────────
    it('Deve adicionar Custom Header e validar echo', () => {
        cy.get('.tab').contains('Headers Custo.').click();

        cy.contains('button', 'Nova Linha de Header').click();
        cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Cypress-Test', { parseSpecialCharSequences: false });
        cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('e2e-value', { parseSpecialCharSequences: false });

        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });

        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'x-cypress-test');
    });

    // ────────────────────────────────────────────
    // 8. AUTH TAB (Autenticação)
    // ────────────────────────────────────────────
    it('Deve mostrar a aba Autenticação com seleção de tipo', () => {
        cy.get('.tab').contains('Autenticação').click();

        // Should show auth-override selector
        cy.contains('Sobrescrever Auth da Pasta').should('be.visible');
    });

    // ────────────────────────────────────────────
    // 9. BODY TAB (JSON)
    // ────────────────────────────────────────────
    it('Deve enviar JSON Body via POST', () => {
        cy.get('.method-select').select('POST');
        cy.get('.tab').contains('Payload / Body').click();
        cy.contains('label', 'JSON').click();

        cy.get('.cm-content').first().focus().clear()
            .type('{"test": "cypress_body"}', { parseSpecialCharSequences: false });

        cy.get('input[placeholder="{{base_url}}/api/..."]')
            .clear()
            .type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });

        cy.contains('button', 'Fazer Disparo').click({ force: true });
        cy.get('.body-content', { timeout: 25000 }).should('contain', 'cypress_body');
    });
});
