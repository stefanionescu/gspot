import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { applyChanges } from '#tests/setup/files.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { ENV_EXAMPLES_CASES, ENV_EXAMPLES_SANDBOX } from '#tests/config/secrets.ts';

const installedSandbox = shareInstalledSandbox(ENV_EXAMPLES_SANDBOX);

test('dotenv-linter fixes a lowercase key in .env.example', async () => {
    const { root, environment } = installedSandbox();
    const restore = await applyChanges(root, {
        check: 'secrets/dotenv-linter',
        files: { '.env.example': 'lowercase=value\n' },
    });
    try {
        const fixed = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, '.env.example')).text()).toBe('LOWERCASE=value\n');
        const checked = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            { check: 'secrets/dotenv-linter', status: 'passed', findings: [] },
        ]);
    } finally {
        await restore();
    }
});

for (const entry of ENV_EXAMPLES_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, ENV_EXAMPLES_SANDBOX);
    });
}
