import { test, expect } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ESLINT_SANDBOX, DEBUGGER_SAMPLE } from '#tests/config/integration/checks/language/javascript.ts';

const eslintSandbox = shareInstalledSandbox({ ...ESLINT_SANDBOX, level: 'basic' });

test('javascript/eslint lints a project that has no TypeScript', async () => {
    await assertCheckSample(eslintSandbox(), DEBUGGER_SAMPLE);
});

test('basic JavaScript reports template strings and loop conditions that never change', async () => {
    const sandbox = eslintSandbox();
    await using _changes = await applySandboxChanges(sandbox, {
        files: {
            'src/loop.js': 'export function run(count) {\n    while (count > 0) { console.info("${count}"); }\n}\n',
        },
    });
    const result = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', 'javascript/eslint', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const rules = result.report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule));
    expect(rules).toContain('no-template-curly-in-string');
    expect(rules).toContain('no-unmodified-loop-condition');
});

test('basic Bun tests require an assertion', async () => {
    const sandbox = eslintSandbox();
    await using _changes = await applySandboxChanges(sandbox, {
        files: {
            'src/empty.test.js': 'import { test } from "bun:test";\ntest("runs", () => { console.info("ready"); });\n',
        },
    });
    const result = parseCheckReport(await spawnGspot(sandbox.root, ['check', '--only', 'javascript/eslint', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule))).toContain(
        'sonarjs/assertions-in-tests',
    );
});
