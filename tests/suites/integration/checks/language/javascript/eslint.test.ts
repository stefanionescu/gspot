import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ESLINT_SANDBOX, DEBUGGER_SAMPLE } from '#tests/config/integration/checks/language/javascript.ts';

const eslintSandbox = shareInstalledSandbox({ ...ESLINT_SANDBOX, level: 'basic' });

test('javascript/eslint lints a project that has no TypeScript', async () => {
    await assertCheckSample(eslintSandbox(), DEBUGGER_SAMPLE);
});
