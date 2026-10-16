import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { checkChanges } from '#tests/setup/sample-checks.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { ESLINT_SANDBOX, JAVASCRIPT_MODULE } from '#tests/data/checks/javascript/eslint.ts';

const installedSandbox = registerSharedSandbox(ESLINT_SANDBOX);

test('javascript/eslint lints a project that has no TypeScript', async () => {
    const { root, environment } = installedSandbox();
    const result = await checkChanges(
        root,
        {
            check: 'javascript/eslint',
            files: { 'src/paused.js': JAVASCRIPT_MODULE.replace('    return', () => '    debugger;\n    return') },
        },
        environment,
    );
    expect(result.code, result.stdout).toBe(1);
    const failed = JSON.parse(result.stdout) as RunReport;
    expect(failed.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
    expect(failed.checks[0]!.findings).toContainEqual(
        matchFields({ rule: 'no-debugger', file: 'src/paused.js', line: 9 }),
    );
    await Bun.write(
        join(root, 'src/paused.js'),
        `// The number of orders.

/** The number of orders. */
export const orderCount = 1;
`,
    );
    const corrected = await spawnGspot(
        root,
        ['check', '--only', 'javascript/eslint', '--json', '--', 'src/paused.js'],
        environment,
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', fileCount: 1, findings: [] },
    ]);
});
