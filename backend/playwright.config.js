'use strict';

const { defineConfig } = require('@playwright/test');

// Config mínima — aguardando o frontend (Prompt 5) para que os cenários em
// tests/e2e/ deixem de ser test.skip() e passem a rodar de verdade contra
// uma UI real. baseURL fica indefinida de propósito até lá.
module.exports = defineConfig({
  testDir: './tests/e2e',
});
