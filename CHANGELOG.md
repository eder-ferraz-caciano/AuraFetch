# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.3.2](https://github.com/eder-ferraz-caciano/AuraFetch/compare/v1.3.1...v1.3.2) (2026-03-26)


### ♻️ Refactor | Refatoração

* move readFileWithSizeGuard to module scope (no component dependencies) ([b18cdcd](https://github.com/eder-ferraz-caciano/AuraFetch/commit/b18cdcd7a676ed6f0b9a6644ec7059201de5d5a6))
* remove savedResponse and savedLogs from collection interfaces (moved to separate state) ([bae9b4c](https://github.com/eder-ferraz-caciano/AuraFetch/commit/bae9b4cbba04a8f0e340f790f4a347b2836895ea))


### ⚙️ Housekeeping | Manutenção

* add .worktrees/ to .gitignore ([4efe819](https://github.com/eder-ferraz-caciano/AuraFetch/commit/4efe819bea705419d8eb375c7d42a1ece1280306))
* add GitHub workflows to deploy AuraFetch web to Actions Pages ([5564f3b](https://github.com/eder-ferraz-caciano/AuraFetch/commit/5564f3b059c9be94717c86ab2af36e8cddaac829))
* remove dead empty if-block and stale prompt comment from Task 6 cleanup ([c2cdb6c](https://github.com/eder-ferraz-caciano/AuraFetch/commit/c2cdb6cf7f86b38623b64e3e2737f51deb53672b))


### 🐛 Bug Fixes | Correções

* **ci:** suppress Node actions deprecation warning and setup node 24 ([ae2bcdf](https://github.com/eder-ferraz-caciano/AuraFetch/commit/ae2bcdf00261c4eb1236be8a93a1e87b2414beb1))
* **core:** add file size guard and web fallback for binary/form-data upload to prevent freeze ([0e60e63](https://github.com/eder-ferraz-caciano/AuraFetch/commit/0e60e638c7f4678d8c80231ac04d34537e90e1e6))
* **core:** move savedResponse and logs out of collection state to prevent large-response freeze and localStorage overflow ([2616854](https://github.com/eder-ferraz-caciano/AuraFetch/commit/2616854d76e79b679c4c8e8846d06860ffdd0be4))
* **core:** protect localStorage JSON.parse with try/catch to prevent white screen on corrupt data ([2051045](https://github.com/eder-ferraz-caciano/AuraFetch/commit/2051045112524ee551c524a3b12dd905b756b145))
* **formdata:** combine size guard with octet-stream Blob type for form-data file uploads ([ae98cf8](https://github.com/eder-ferraz-caciano/AuraFetch/commit/ae98cf892a4d0d2fe76425a54f96d8a9d24f9e0f))
* move switchActiveNode after state declarations it depends on ([acaeebb](https://github.com/eder-ferraz-caciano/AuraFetch/commit/acaeebb32cad011c484fe1c6e9c5a3dea2a8034e))
* **perf:** memoize addLog with useCallback to prevent stale closure in WS listener ([bc1858c](https://github.com/eder-ferraz-caciano/AuraFetch/commit/bc1858cfa040107bb36adc949f2b3bee2a833bab))
* **polish:** move index.css import to top of file ([e32accd](https://github.com/eder-ferraz-caciano/AuraFetch/commit/e32accd13f958abc2fd91e8b438c1034c24c92a6))
* **polish:** remove console leaks, replace prompt() with inline input, fix CSS import position ([a709c1b](https://github.com/eder-ferraz-caciano/AuraFetch/commit/a709c1b5bcc289bad544058376568141d557fbcd))
* **web:** add Tauri guards and web fallbacks for file export, download, and file picker ([21248b2](https://github.com/eder-ferraz-caciano/AuraFetch/commit/21248b229af71cd0d37fb66a7a3f6bd8526b30d9))
* **websocket:** fix stale closure in message listener and cleanup unlisten on disconnect and node switch ([6911ee6](https://github.com/eder-ferraz-caciano/AuraFetch/commit/6911ee612fe85ef5083fd8bb8a07ae6ab1fe90b5))


### 📚 Documentation | Documentação

* add Phase 1 bug fix implementation plan ([e5b8fbd](https://github.com/eder-ferraz-caciano/AuraFetch/commit/e5b8fbd90f178210d5f8f6b084fc179495b6ff42))
* add refactor, bug fix & rename design spec ([2733781](https://github.com/eder-ferraz-caciano/AuraFetch/commit/27337817abb2816504f1b24e215c019800dee4b0))
* add TDD Cypress implementation plan ([b9889cd](https://github.com/eder-ferraz-caciano/AuraFetch/commit/b9889cd579e0d1b7a1497f457603e4ab40a8fefa))
* add TDD Cypress test coverage design spec ([04b93cf](https://github.com/eder-ferraz-caciano/AuraFetch/commit/04b93cf554406dae2ab00adf3b40a76f2a6c74e0))
* fix 3 plan issues — PNG hex, binary web fallback step, OAuth2 syntax, Raw tab note, API key query param and env import tests ([052f8ff](https://github.com/eder-ferraz-caciano/AuraFetch/commit/052f8ff344b889deb148d650d4b46158e25bd512))
* translate design spec to Portuguese ([82a4c11](https://github.com/eder-ferraz-caciano/AuraFetch/commit/82a4c1186ada6f7c690fe8a0e367baacea8cd9e9))


### ✅ Tests | Testes

* fix all Cypress E2E tests — 121 passing, 0 failures ([4df9fbe](https://github.com/eder-ferraz-caciano/AuraFetch/commit/4df9fbeffe84910362977c5f13da36b963963460))
* **infra:** add file-tasks, fixtures and update cypress.config ([14bbbe5](https://github.com/eder-ferraz-caciano/AuraFetch/commit/14bbbe5cab7c582bd634cee1be0005fd600f46d8))

### [1.3.1](https://github.com/eder-ferraz-caciano/AuraFetch/compare/v1.3.0...v1.3.1) (2026-03-17)


### ⚙️ Housekeeping | Manutenção

* rebranding project from get_man to aurafetch ([404ae70](https://github.com/eder-ferraz-caciano/AuraFetch/commit/404ae70a790a56e850285e8708a7fe00d6fcdc34))


### 🐛 Bug Fixes | Correções

* **core:** Resolve CORS, white screen issues and add WS Cypress tests ([e995555](https://github.com/eder-ferraz-caciano/AuraFetch/commit/e9955553e4e49c21f899f5407b2a4e438ca53690))

## [1.3.0](https://github.com/eder-ferraz-caciano/AuraFetch/compare/v1.2.0...v1.3.0) (2026-03-14)


### ✨ Features | Novidades

* implement request timeout, scroll fixes and variable resolution improvements ([b6edda0](https://github.com/eder-ferraz-caciano/AuraFetch/commit/b6edda08bab261ba39dff0621148e26e010083d1))
