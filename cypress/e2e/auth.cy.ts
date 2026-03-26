describe('AuraFetch - Autenticação', () => {
  const POSTMAN_ECHO = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.tab').contains('Autenticação').click();
  });

  // ────────────────────────────────────────
  // Bearer Token
  // ────────────────────────────────────────
  describe('Bearer Token', () => {
    it('selecionar Bearer exibe campo de token', () => {
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').should('be.visible');
    });

    it('requisição enviada contém header Authorization: Bearer', () => {
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('meu_token_secreto');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer meu_token_secreto');
      });
    });

    it('token com variável {{token}} é substituído pelo environment', () => {
      // Configurar variável no ambiente ativo "Ambiente DEV"
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Ambientes').click({ force: true });
      // Clicar no "Ambiente DEV" para editá-lo (já é o ambiente ativo)
      cy.get('.ws-env-item').contains('Ambiente DEV').click({ force: true });
      cy.get('.ws-env-editor').should('be.visible');
      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('meu_token');
      cy.get('input[placeholder="Valor"]').last().type('token_do_env').blur();
      cy.wait(300);
      // Voltar para a requisição e configurar Bearer com variável
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('{{meu_token}}', { parseSpecialCharSequences: false });
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer token_do_env');
      });
    });
  });

  // ────────────────────────────────────────
  // Basic Auth
  // ────────────────────────────────────────
  describe('Basic Auth', () => {
    it('selecionar Basic exibe campos usuário e senha', () => {
      cy.get('.glass-panel select').select('basic');
      cy.get('input[placeholder="admin"]').should('be.visible');
      cy.get('input[placeholder="••••••"]').should('be.visible');
    });

    it('requisição contém header Authorization: Basic <base64>', () => {
      cy.get('.glass-panel select').select('basic');
      cy.get('input[placeholder="admin"]').clear().type('admin');
      cy.get('input[placeholder="••••••"]').clear().type('senha123');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        const auth = interception.request.headers['authorization'] as string;
        expect(auth).to.match(/^Basic /);
        const decoded = atob(auth.replace('Basic ', ''));
        expect(decoded).to.equal('admin:senha123');
      });
    });

    it('credenciais com variáveis são substituídas antes de codificar', () => {
      // Configurar variável global com valor de senha
      cy.get('.sidebar-tree-container').contains('.workspace-node', 'Workspace', { timeout: 10000 })
        .find('.node-name').click({ force: true });
      cy.get('.ws-config-tab').contains('Variáveis Globais').click({ force: true });
      cy.contains('button', 'Adicionar Linha').click();
      cy.get('input[placeholder="Chave"]').last().type('basic_user');
      cy.get('input[placeholder="Valor"]').last().type('user_from_var').blur();
      cy.wait(300);
      // Voltar para a requisição
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').select('basic');
      cy.get('input[placeholder="admin"]').clear().type('{{basic_user}}', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="••••••"]').clear().type('pass123');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        const auth = interception.request.headers['authorization'] as string;
        expect(auth).to.match(/^Basic /);
        const decoded = atob(auth.replace('Basic ', ''));
        expect(decoded).to.equal('user_from_var:pass123');
      });
    });
  });

  // ────────────────────────────────────────
  // API Key
  // ────────────────────────────────────────
  describe('API Key', () => {
    it('selecionar API Key exibe campos nome e valor', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder="x-api-key"]').should('be.visible');
      cy.get('input[placeholder="A8F90x..."]').should('be.visible');
    });

    it('API key adicionada como header quando configurada em "In Headers"', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder="x-api-key"]').clear().type('X-Minha-Chave');
      cy.get('input[placeholder="A8F90x..."]').clear().type('chave_secreta_123');
      // Forçar onChange no select de Location: selecionar query e depois header
      // (o default visual é 'header' mas apiKeyIn pode estar undefined internamente)
      cy.get('.glass-panel select').last().select('query');
      cy.get('.glass-panel select').last().select('header');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers*`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req', { timeout: 15000 }).then(interception => {
        expect(interception.request.headers['x-minha-chave']).to.equal('chave_secreta_123');
      });
    });

    it('API key adicionada como query param quando configurada em "In Query Params"', () => {
      cy.get('.glass-panel select').select('apikey');
      cy.get('input[placeholder="x-api-key"]').clear().type('api_key');
      cy.get('input[placeholder="A8F90x..."]').clear().type('qp_valor_123');
      // Mudar para "In Query Params" (Location é o último select no glass-panel)
      cy.get('.glass-panel select').last().select('query');
      cy.intercept('GET', `${POSTMAN_ECHO}/get*`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/get`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        // API key deve aparecer na URL, não no header
        expect(interception.request.url).to.include('api_key=qp_valor_123');
        expect(interception.request.headers['api_key']).to.be.undefined;
      });
    });
  });

  // ────────────────────────────────────────
  // OAuth2
  // ────────────────────────────────────────
  describe('OAuth2 UI', () => {
    it('selecionar OAuth2 exibe campos Client ID, Client Secret e Access Token URL', () => {
      cy.get('.glass-panel select').select('oauth2');
      cy.get('.glass-panel').invoke('text').should('match', /Client ID/i);
      cy.get('.glass-panel').invoke('text').should('match', /Client Secret/i);
      cy.get('.glass-panel').invoke('text').should('match', /Access Token/i);
    });
  });

  // ────────────────────────────────────────
  // Herança de autenticação
  // ────────────────────────────────────────
  describe('Herança de autenticação por pasta', () => {
    it('requisição herda Bearer da pasta pai', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_HERDADO');
      // Verificar que a requisição filha tem "inherit"
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').should('have.value', 'inherit');
      cy.contains('Esta requisição herda a autenticação da pasta pai').should('be.visible');
    });

    it('requisição com auth própria sobrescreve a pasta', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_PASTA');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      // Mudar para bearer próprio
      cy.get('.glass-panel select').select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').clear().type('TOKEN_PROPRIO');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.equal('Bearer TOKEN_PROPRIO');
      });
    });

    it('requisição com auth "none" ignora a auth da pasta', () => {
      cy.get('.sidebar-tree-container').contains('Meu Servidor/Projeto').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('select').first().select('bearer');
      cy.get('input[placeholder*="meu_token_jwt"]').type('TOKEN_PASTA');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.tab').contains('Autenticação').click();
      cy.get('.glass-panel select').select('none');
      cy.intercept('GET', `${POSTMAN_ECHO}/headers`).as('req');
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/headers`, { parseSpecialCharSequences: false });
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@req').then(interception => {
        expect(interception.request.headers['authorization']).to.be.undefined;
      });
    });
  });
});
