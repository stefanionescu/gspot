import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { checkChanges } from '#tests/setup/sample-checks.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { ESLINT_SANDBOX, JAVASCRIPT_MODULE } from '#tests/data/checks/javascript/eslint.ts';

const installedSandbox = registerSharedSandbox(ESLINT_SANDBOX);

test('javascript/eslint lints a project that has no TypeScript', async () => {
    const { root, environment } = installedSandbox();
    const result = parseCheckReport(
        await checkChanges(
            root,
            {
                check: 'javascript/eslint',
                files: { 'src/paused.js': JAVASCRIPT_MODULE.replace('    return', () => '    debugger;\n    return') },
            },
            environment,
        ),
    );
    expect(result.code, result.stdout).toBe(1);
    const failed = result.report;
    expect(failed.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
    expect(failed.checks[0]!.findings).toContainEqual(
        matchFields({ rule: 'no-debugger', file: 'src/paused.js', line: 9 }),
    );
    await writeFile(
        join(root, 'src/paused.js'),
        `// The number of orders.

/** The number of orders. */
export const orderCount = 1;
`,
    );
    const corrected = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json', '--', 'src/paused.js'], environment),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', fileCount: 1, findings: [] },
    ]);
});
