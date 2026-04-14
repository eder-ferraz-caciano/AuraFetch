describe('AuraFetch - Funcionalidades de Requisicao (Gaps)', () => {
  const BASE = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container', { timeout: 20000 })
      .contains('Listar Dados', { timeout: 15000 })
      .click({ force: true });
  });

  // Helper: adicionar variavel no ambiente DEV
  function addEnvVar(key: string, value: string) {
    cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
      .find('.node-name').click({ force: true });
    cy.get('.ws-config-tab').contains('Ambientes').click({ force: true });
    cy.get('.ws-env-item').contains('Ambiente DEV').click({ force: true });
    cy.get('.ws-env-editor').should('be.visible');
    cy.contains('button', 'Adicionar Linha').click();
    cy.get('input[placeholder="Chave"]').last().type(key, { parseSpecialCharSequences: false });
    cy.get('input[placeholder="Valor"]').last().type(value, { parseSpecialCharSequences: false }).blur();
    cy.wait(300);
  }

  // Helper: voltar para a request "Listar Dados"
  function goToRequest() {
    cy.get('.sidebar-tree-container').contains('Listar Dados', { timeout: 10000 }).click({ force: true });
  }

  // Helper: preencher URL e disparar
  function sendRequest(url: string) {
    cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(url, { parseSpecialCharSequences: false });
    cy.contains('button', 'Enviar').click({ force: true });
  }

  // ────────────────────────────────────────
  // 1. PDF Response
  // ────────────────────────────────────────
  describe('PDF Response', () => {
    it('response application/pdf renderiza iframe com preview', () => {
      const pdfBytes = Cypress.Buffer.from('%PDF-1.4 fake pdf content for testing');
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'application/pdf' },
        body: pdfBytes
      }).as('pdfReq');
      sendRequest(`${BASE}/get`);
      cy.wait('@pdfReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('iframe[title="PDF Preview"]', { timeout: 10000 }).should('exist');
    });

    it('botao download disponivel para PDF', () => {
      const pdfBytes = Cypress.Buffer.from('%PDF-1.4 fake pdf');
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'application/pdf' },
        body: pdfBytes
      }).as('pdfReq');
      sendRequest(`${BASE}/get`);
      cy.wait('@pdfReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('button[title="Download"]').should('exist');
    });
  });

  // ────────────────────────────────────────
  // 2. SVG Response
  // ────────────────────────────────────────
  describe('SVG Response', () => {
    it('response image/svg+xml exibe como imagem', () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'image/svg+xml' },
        body: Cypress.Buffer.from(svgContent)
      }).as('svgReq');
      sendRequest(`${BASE}/get`);
      cy.wait('@svgReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.response-panel img[alt="Response"]', { timeout: 10000 }).should('exist');
    });
  });

  // ────────────────────────────────────────
  // 3. Download binario funcional
  // ────────────────────────────────────────
  describe('Download binario', () => {
    it('download de response binaria aciona sem erro', () => {
      cy.intercept('GET', `${BASE}/get*`, {
        statusCode: 200,
        headers: { 'content-type': 'application/octet-stream' },
        body: Cypress.Buffer.from('binary test data 12345')
      }).as('binReq');
      sendRequest(`${BASE}/get`);
      cy.wait('@binReq');
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.response-panel').should('contain', 'binario');
      // Verificar que botao de download esta presente e clicavel
      cy.get('.response-panel button').contains('Baixar Arquivo').should('be.visible');
    });
  });

  // ────────────────────────────────────────
  // 4. Variaveis no body JSON
  // ────────────────────────────────────────
  describe('Variaveis no body JSON', () => {
    it('{{variavel}} no JSON body eh substituida antes do envio', () => {
      addEnvVar('api_user', 'alice_cypress');
      goToRequest();
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Body').click();
      cy.contains('label', 'JSON').click();
      cy.get('.cm-content').first().focus().clear()
        .type('{"usuario": "{{api_user}}"}', { parseSpecialCharSequences: false });
      cy.intercept('POST', `${BASE}/post*`).as('postReq');
      sendRequest(`${BASE}/post`);
      cy.wait('@postReq', { timeout: 15000 }).then(interception => {
        const body = typeof interception.request.body === 'string'
          ? interception.request.body
          : JSON.stringify(interception.request.body);
        expect(body).to.include('alice_cypress');
        expect(body).not.to.include('{{api_user}}');
      });
    });
  });

  // ────────────────────────────────────────
  // 5. Prioridade folder var > env var
  // ────────────────────────────────────────
  describe('Prioridade de variaveis', () => {
    it('variavel de folder tem prioridade sobre environment', () => {
      addEnvVar('prioridade', 'env_value');

      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto', { timeout: 10000 }).click({ force: true });
      // Folder config - clicar na aba "Variaveis" primeiro
      cy.contains('button', 'Variaveis').click();
      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('prioridade', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Valor"]').last().type('folder_value', { parseSpecialCharSequences: false }).blur();
      cy.wait(300);

      goToRequest();
      cy.get('.tab').contains('Headers').click();
      cy.contains('button', 'Adicionar Header').click();
      cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Priority', { parseSpecialCharSequences: false });
      cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('{{prioridade}}', { parseSpecialCharSequences: false });

      cy.intercept('GET', `${BASE}/headers*`).as('req');
      sendRequest(`${BASE}/headers`);
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.headers['x-priority']).to.equal('folder_value');
      });
    });
  });

  // ────────────────────────────────────────
  // 6. Query Params
  // ────────────────────────────────────────
  describe('Query Params', () => {
    it('params desabilitados nao sao enviados', () => {
      // Definir URL antes de adicionar query params (evitar sync que remove params)
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.get('.tab').contains('Query').click();

      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('ativo', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Valor"]').last().type('sim', { parseSpecialCharSequences: false });

      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('inativo', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Valor"]').last().type('nao', { parseSpecialCharSequences: false });
      // Desabilitar ultimo param via checkbox
      cy.get('.headers-container input[type="checkbox"]').last().uncheck({ force: true });

      cy.intercept('GET', `${BASE}/get*`).as('req');
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.url).to.include('ativo=sim');
        expect(interception.request.url).not.to.include('inativo');
      });
    });

    it('caracteres especiais sao codificados na URL', () => {
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.get('.tab').contains('Query').click();

      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('busca', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Valor"]').last().type('a&b=c', { parseSpecialCharSequences: false });

      cy.intercept('GET', `${BASE}/get*`).as('req');
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.url).to.include('busca=');
        // O valor deve estar encodado, nao como literal a&b=c
        expect(interception.request.url).not.to.include('busca=a&b=c');
      });
    });

    it('variavel {{var}} em query param eh interpolada', () => {
      addEnvVar('search_term', 'cypress_test');
      goToRequest();
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.get('.tab').contains('Query').click();

      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('q', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Valor"]').last().type('{{search_term}}', { parseSpecialCharSequences: false });

      cy.intercept('GET', `${BASE}/get*`).as('req');
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.url).to.include('q=cypress_test');
        expect(interception.request.url).not.to.include('{{search_term}}');
      });
    });
  });

  // ────────────────────────────────────────
  // 7. Path Params com variavel
  // ────────────────────────────────────────
  describe('Path Params', () => {
    it('path param :id com variavel eh substituido na URL', () => {
      addEnvVar('user_id', '42');
      goToRequest();
      // Digitar URL com path param
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear()
        .type(`${BASE}/anything/:user_id`, { parseSpecialCharSequences: false });
      // Ir para tab Params para preencher o valor
      cy.get('.tab').contains('Params').click();
      cy.get('input[placeholder="Valor"]').last().clear().type('{{user_id}}', { parseSpecialCharSequences: false });

      cy.intercept('GET', `${BASE}/anything/*`).as('req');
      cy.contains('button', 'Enviar').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.url).to.include('/anything/42');
      });
    });
  });

  // ────────────────────────────────────────
  // 8. URL-Encoded com variaveis
  // ────────────────────────────────────────
  describe('URL-Encoded com variaveis', () => {
    it('campos urlencoded com variavel sao interpolados', () => {
      addEnvVar('login_user', 'eder_cypress');
      goToRequest();
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Body').click();
      cy.contains('label', 'x-www-form-urlencoded').click();
      cy.contains('button', 'Adicionar Par Chave/Valor').click();
      cy.get('input[placeholder="Key"]').last().type('user', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Value"]').last().type('{{login_user}}', { parseSpecialCharSequences: false });

      cy.intercept('POST', `${BASE}/post*`).as('req');
      sendRequest(`${BASE}/post`);
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        const body = typeof interception.request.body === 'string'
          ? interception.request.body
          : JSON.stringify(interception.request.body);
        expect(body).to.include('eder_cypress');
        expect(body).not.to.include('{{login_user}}');
      });
    });
  });

  // ────────────────────────────────────────
  // 9. Form-Data texto com variavel
  // ────────────────────────────────────────
  describe('Form-Data texto com variavel', () => {
    it('campo form-data texto com variavel eh interpolado', () => {
      addEnvVar('fd_nome', 'teste_fd_cypress');
      goToRequest();
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Body').click();
      cy.contains('label', 'FORM-DATA').click();
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('input[placeholder="Key"]').last().type('nome', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Value"]').last().type('{{fd_nome}}', { parseSpecialCharSequences: false });

      cy.intercept('POST', `${BASE}/post*`).as('req');
      sendRequest(`${BASE}/post`);
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        const body = typeof interception.request.body === 'string'
          ? interception.request.body
          : JSON.stringify(interception.request.body);
        expect(body).to.include('teste_fd_cypress');
      });
    });
  });

  // ────────────────────────────────────────
  // 10. GraphQL
  // ────────────────────────────────────────
  describe('GraphQL', () => {
    it('query e variables sao enviados como JSON com Content-Type correto', () => {
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Body').click();
      cy.contains('label', 'GRAPHQL').click();

      cy.get('.cm-content').first().focus().clear()
        .type('query { users { id name } }', { parseSpecialCharSequences: false, delay: 0 });

      cy.intercept('POST', `${BASE}/post*`).as('gqlReq');
      sendRequest(`${BASE}/post`);
      cy.wait('@gqlReq', { timeout: 15000 }).then(interception => {
        const body = typeof interception.request.body === 'string'
          ? JSON.parse(interception.request.body)
          : interception.request.body;
        expect(body).to.have.property('query');
        expect(body.query).to.include('users');
        const ct = interception.request.headers['content-type'] as string;
        expect(ct).to.include('application/json');
      });
    });
  });

  // ────────────────────────────────────────
  // 11. Code Snippet - API Key query
  // ────────────────────────────────────────
  describe('Code Snippet - API Key query', () => {
    it('snippet curl inclui api key como query param na URL', () => {
      cy.get('.tab').contains('Auth').click();
      cy.get('.select-input').first().select('apikey');
      cy.get('input[placeholder="x-api-key"]').clear().type('api_key', { parseSpecialCharSequences: false });
      cy.get('input[placeholder*="A8F90x"]').clear().type('secreto123', { parseSpecialCharSequences: false });
      // Selecionar "In Query Params" no select
      cy.get('.glass-panel select').last().select('query');

      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${BASE}/get`, { parseSpecialCharSequences: false });
      cy.get('button[title="Gerar snippet"]').click();
      cy.get('.modal-content pre').should('contain', 'api_key=secreto123');
      cy.get('.modal-overlay').click({ force: true });
    });
  });

  // ────────────────────────────────────────
  // 12. Status Codes
  // ────────────────────────────────────────
  describe('Status Codes adicionais', () => {
    it('201 Created exibido corretamente', () => {
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 201, body: { created: true } }).as('req');
      sendRequest(`${BASE}/get`);
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('contain', '201');
    });

    it('400 Bad Request exibido corretamente', () => {
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 400, body: { error: 'bad request' } }).as('req');
      sendRequest(`${BASE}/get`);
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('contain', '400');
    });

    it('401 Unauthorized exibido corretamente', () => {
      cy.intercept('GET', `${BASE}/get*`, { statusCode: 401, body: { error: 'unauthorized' } }).as('req');
      sendRequest(`${BASE}/get`);
      cy.wait('@req');
      cy.get('.status-badge', { timeout: 15000 }).should('contain', '401');
    });
  });

  // ────────────────────────────────────────
  // 13. Headers
  // ────────────────────────────────────────
  describe('Headers', () => {
    beforeEach(() => {
      cy.get('.tab').contains('Headers').click();
    });

    it('header desabilitado nao eh enviado', () => {
      cy.contains('button', 'Adicionar Header').click();
      cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Active', { parseSpecialCharSequences: false });
      cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('yes', { parseSpecialCharSequences: false });

      cy.contains('button', 'Adicionar Header').click();
      cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Disabled', { parseSpecialCharSequences: false });
      cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('no', { parseSpecialCharSequences: false });
      // Desabilitar o ultimo header via checkbox
      cy.get('.headers-grid input[type="checkbox"]').last().uncheck({ force: true });

      cy.intercept('GET', `${BASE}/get*`).as('req');
      sendRequest(`${BASE}/get`);
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.headers['x-active']).to.equal('yes');
        expect(interception.request.headers).not.to.have.property('x-disabled');
      });
    });

    it('header com variavel {{var}} eh interpolado', () => {
      addEnvVar('auth_token', 'header_token_cy');
      goToRequest();
      cy.get('.tab').contains('Headers').click();
      cy.contains('button', 'Adicionar Header').click();
      cy.get('input[placeholder="Ex: Content-Type"]').last().clear().type('X-Auth', { parseSpecialCharSequences: false });
      cy.get('input[placeholder*="Ex: application/json"]').last().clear().type('{{auth_token}}', { parseSpecialCharSequences: false });

      cy.intercept('GET', `${BASE}/get*`).as('req');
      sendRequest(`${BASE}/get`);
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.headers['x-auth']).to.equal('header_token_cy');
      });
    });
  });
});
