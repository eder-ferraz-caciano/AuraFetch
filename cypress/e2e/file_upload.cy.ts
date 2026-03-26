describe('AuraFetch - Upload de Arquivo Real', () => {
  const POSTMAN_ECHO = 'https://postman-echo.com';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.get('.app-title', { timeout: 30000 }).should('be.visible');
    // Selecionar "Listar Dados", trocar para POST e ativar FORM-DATA
    cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
    cy.get('.method-select').select('POST');
    cy.get('.tab').contains('Payload / Body').click();
    cy.contains('label', 'FORM-DATA').click();
  });

  // ────────────────────────────────────────
  // Guard de tamanho 50MB
  // ────────────────────────────────────────
  describe('Guard de tamanho (50MB)', () => {
    after(() => {
      cy.task('cleanupTempFiles');
    });

    it('arquivo de 49MB: upload aceito, sem mensagem de erro', () => {
      cy.task('generateLargeFile', { sizeMb: 49 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        // Trocar o campo para tipo "file"
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        // O nome do arquivo deve aparecer (upload aceito)
        cy.contains('49mb').should('be.visible');
        // Verificar no console que não há erro de tamanho
        cy.get('.tab').contains('Console / Timestamps').click();
        cy.get('.console-panel').should('not.contain', 'excede o limite');
      });
    });

    it('arquivo de 51MB: exibe mensagem de erro na UI', () => {
      cy.task('generateLargeFile', { sizeMb: 51 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        // Deve exibir o erro de tamanho no console
        cy.get('.tab').contains('Console / Timestamps').click();
        cy.get('.console-panel', { timeout: 5000 }).should('contain', 'excede o limite');
      });
    });

    it('arquivo de exatamente 50MB: aceito (guard usa >50MB estrito)', () => {
      cy.task('generateLargeFile', { sizeMb: 50 }).then((filePath: unknown) => {
        cy.contains('button', 'Adicionar Campo').click();
        cy.get('.select-input').last().select('file');
        cy.get('[data-testid="formdata-file-input"]').selectFile(filePath as string, { force: true });
        // 50MB exato é aceito pois o guard usa > (não >=)
        cy.contains('50mb').should('be.visible');
        cy.get('.tab').contains('Console / Timestamps').click();
        cy.get('.console-panel').should('not.contain', 'excede o limite');
      });
    });
  });

  // ────────────────────────────────────────
  // Form-data com arquivo real pequeno
  // ────────────────────────────────────────
  describe('Form-data com arquivo de 1KB', () => {
    it('campo exibe nome do arquivo após seleção', () => {
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      cy.contains('small-file.txt').should('be.visible');
    });

    it('enviar POST form-data com arquivo → postman-echo confirma campo presente', () => {
      // Adicionar campo texto
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('input[placeholder="Key"]').last().type('descricao', { parseSpecialCharSequences: false });
      cy.get('input[placeholder="Value"]').last().type('teste upload', { parseSpecialCharSequences: false });
      // Adicionar campo arquivo
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('input[placeholder="Key"]').last().type('arquivo_upload', { parseSpecialCharSequences: false });
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      // Enviar
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      cy.intercept('POST', `${POSTMAN_ECHO}/post`).as('formDataReq');
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@formDataReq', { timeout: 30000 });
      cy.get('.status-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.body-content', { timeout: 15000 }).should('contain', 'descricao');
    });

    it('Content-Type boundary é gerado pelo browser (não sobrescrito)', () => {
      cy.contains('button', 'Adicionar Campo').click();
      cy.get('.select-input').last().select('file');
      cy.get('[data-testid="formdata-file-input"]').selectFile('cypress/fixtures/small-file.txt', { force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      // Interceptar para verificar headers
      cy.intercept('POST', `${POSTMAN_ECHO}/post`).as('upload');
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@upload').then(interception => {
        const contentType = interception.request.headers['content-type'] as string;
        expect(contentType).to.include('multipart/form-data');
        expect(contentType).to.include('boundary=');
      });
    });
  });

  // ────────────────────────────────────────
  // Binary upload
  // ────────────────────────────────────────
  describe('Binary upload', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.visit('/');
      cy.get('.app-title', { timeout: 30000 }).should('be.visible');
      cy.get('.sidebar-tree-container').contains('Listar Dados').click({ force: true });
      cy.get('.method-select').select('POST');
      cy.get('.tab').contains('Payload / Body').click();
      cy.contains('label', 'BINARY').click();
    });

    it('selecionar PNG como body binário e enviar', () => {
      cy.get('[data-testid="binary-file-input"]').selectFile('cypress/fixtures/sample-image.png', { force: true });
      cy.get('input[placeholder="{{base_url}}/api/..."]').clear().type(`${POSTMAN_ECHO}/post`, { parseSpecialCharSequences: false });
      cy.intercept('POST', `${POSTMAN_ECHO}/post`).as('binaryUpload');
      cy.contains('button', 'Fazer Disparo').click({ force: true });
      cy.wait('@binaryUpload').then(interception => {
        expect(interception.request.headers['content-length']).to.exist;
      });
      cy.get('.status-badge', { timeout: 30000 }).should('contain', '200');
    });
  });
});
