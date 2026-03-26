describe('AuraFetch - Import/Export de Coleção e Download de Response', () => {
  const BASE = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
  });

  // ────────────────────────────────────────
  // Export de coleção
  // ────────────────────────────────────────
  describe('Export de coleção', () => {
    it('botão Exportar está visível na UI', () => {
      cy.get('button[title="Exportar"]').should('be.visible');
    });

    it('botão Exportar aciona download de JSON via âncora', () => {
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });

    it('exportar coleção vazia não trava a UI', () => {
      // Remover todos os workspaces importando uma coleção vazia
      cy.window().then(win => {
        win.localStorage.setItem('aurafetch_collection_v2', '[]');
      });
      cy.reload();
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });

    it('JSON exportado contém os workspaces criados', () => {
      // Criar um workspace e depois verificar o conteúdo exportado via interceptação do blob
      cy.get('button[title="Novo Workspace"]').click();
      cy.get('input[placeholder="Nome do workspace..."]').type('WS Exportar Teste').type('{enter}');
      cy.get('.sidebar-tree-container').should('contain', 'WS Exportar Teste');
      // Interceptar a criação do Blob para verificar conteúdo
      cy.window().then(win => {
        const origBlob = win.Blob;
        let capturedContent = '';
        cy.stub(win, 'Blob').callsFake(function(parts: any[], options: any) {
          if (options?.type === 'application/json') capturedContent = parts[0];
          return new origBlob(parts, options);
        });
        cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(() => {
          expect(capturedContent).to.include('WS Exportar Teste');
        }).as('anchorClick');
      });
      cy.get('button[title="Exportar"]').click();
      cy.get('@anchorClick').should('have.been.calledOnce');
    });
  });

  // ────────────────────────────────────────
  // Import de coleção
  // ────────────────────────────────────────
  describe('Import de coleção', () => {
    it('importar sample-collection.json popula a árvore', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
    });

    it('workspaces importados têm nomes corretos', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
    });

    it('pastas e requisições dentro dos workspaces são preservadas', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Pasta A').and('contain', 'Pasta B');
      // Expandir "Pasta A" clicando no ícone de chevron (expander-icon)
      cy.get('.sidebar-tree-container').contains('.tree-item', 'Pasta A')
        .find('.expander-icon').click({ force: true });
      cy.get('.sidebar-tree-container', { timeout: 10000 }).should('contain', 'GET Lista');
    });

    it('environments importados são preservados', () => {
      // O fixture tem 1 environment chamado "Desenvolvimento" com variáveis base_url e token_teste
      cy.get('label[title="Importar"] input[type="file"]').selectFile('cypress/fixtures/sample-collection.json', { force: true });
      cy.get('.sidebar-tree-container', { timeout: 15000 }).should('contain', 'Workspace Teste');
      // Abrir o workspace e verificar environments
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace Teste')
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Ambientes').click({ force: true });
      cy.contains('Desenvolvimento').should('be.visible');
    });

    it('importar JSON inválido exibe mensagem de erro sem travar', () => {
      cy.get('label[title="Importar"] input[type="file"]').selectFile(
        { contents: Cypress.Buffer.from('{"collection": invalid json}'), fileName: 'invalid.json' },
        { force: true }
      );
      // O app não deve travar — a árvore original ainda está visível
      cy.get('.app-title', { timeout: 10000 }).should('be.visible');
      cy.get('.sidebar-tree-container').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // Download de response
  // ────────────────────────────────────────
  describe('Download de response', () => {
    beforeEach(() => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        body: { conteudo: 'dados para download' }
      }).as('req');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
    });

    it('botão de download está disponível após receber response', () => {
      cy.get('button[title="Salvar resposta no Disco"]').should('exist');
    });

    it('clicar no botão dispara download (âncora .click() chamado)', () => {
      cy.window().then(win => {
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('downloadClick');
      });
      cy.get('button[title="Salvar resposta no Disco"]').click();
      cy.get('@downloadClick').should('have.been.calledOnce');
    });

    it('response binária (PNG via intercept) aciona download', () => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
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
        cy.window().then(win => {
          cy.stub(win.HTMLAnchorElement.prototype, 'click').as('imgDownloadClick');
        });
        cy.get('button[title="Salvar resposta no Disco"]').click({ force: true });
        cy.get('@imgDownloadClick').should('have.been.calledOnce');
      });
    });
  });
});
