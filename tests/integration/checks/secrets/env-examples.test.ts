import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { ENV_EXAMPLES_CASES, ENV_EXAMPLES_SANDBOX } from '#tests/data/checks/secrets.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox(ENV_EXAMPLES_SANDBOX);

test('dotenv-linter fixes a lowercase key in .env.example', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'secrets/dotenv-linter',
            files: { '.env.example': 'lowercase=value\n' },
        },
    );

    const fixed = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--fix'], environment);

    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);

    expect(await Bun.file(join(root, '.env.example')).text()).toBe('LOWERCASE=value\n');

    const checked = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--json'], environment);

    expect(checked.code, checked.stdout + checked.stderr).toBe(0);

    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'secrets/dotenv-linter', status: 'passed', findings: [] },
    ]);
});

for (const entry of ENV_EXAMPLES_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        const result = await runCheckSample(installedSandbox(), entry, ENV_EXAMPLES_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}
