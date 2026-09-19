// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/specs',
  timeout: 20000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    // Les maquettes s'ouvrent en file:// comme dans l'usage réel (double-clic sur le fichier).
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});
