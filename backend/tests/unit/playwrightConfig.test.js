const { execFileSync } = require('child_process');
const path = require('path');

describe('Playwright auth bootstrap config', () => {
  const originalEnv = process.env;
  const backendRoot = path.resolve(__dirname, '../..');

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const loadConfigSnapshot = (requiresAuth) => {
    const script = `
      const config = require('./playwright.config');
      process.stdout.write(JSON.stringify({
        globalSetup: config.globalSetup,
        storageState: config.use && config.use.storageState
      }));
    `;

    return JSON.parse(
      execFileSync(process.execPath, ['-e', script], {
        cwd: backendRoot,
        env: {
          ...process.env,
          E2E_REQUIRES_AUTH: requiresAuth ? 'true' : 'false',
        },
        encoding: 'utf8',
      })
    );
  };

  test('enables global auth bootstrap when E2E auth is required', () => {
    const config = loadConfigSnapshot(true);

    expect(config.globalSetup).toBe('./tests/e2e/globalSetup.js');
    expect(config.storageState).toBe('./tests/e2e/.auth/user.json');
  });

  test('does not force storage state when E2E auth is disabled', () => {
    const config = loadConfigSnapshot(false);

    expect(config.globalSetup).toBeUndefined();
    expect(config.storageState).toBeUndefined();
  });
});
