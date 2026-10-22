import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { PYTHON_SANDBOX, ARITHMETIC_MODULE_PATH } from '#tests/config/integration/checks/language/python/samples.ts';

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);
test('init replaces your pyrightconfig.json with a pointer, and basedpyright reports the type error', async () => {
    const typed = `${ARITHMETIC_MODULE}

TOTAL: int = "three"
`;
    const { root, environment } = installedSandbox();
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        check: 'python/basedpyright',
        files: { [ARITHMETIC_MODULE_PATH]: typed },
    });
    // The pointer replaces the file; gspot.toml keeps none of the old settings.
    const pointer = await readFile(join(root, 'pyrightconfig.json'), 'utf8');
    expect(pointer).toContain('"extends": "./.gspot/configurations/language/python/basedpyright.json"');
    expect(pointer).not.toContain('basic');
    const settings = await readFile(join(root, 'gspot.toml'), 'utf8');
    expect(settings).not.toContain('example/skipped.py');
    const command = ['check', '--only', 'python/basedpyright', '--json'];
    const refused = parseCheckReport(await spawnGspot(root, command, environment));
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const report = refused.report;
    expect(report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'failed'],
    ]);
    expect(report.checks[0]?.findings).toContainEqual(
        matchFields({
            file: ARITHMETIC_MODULE_PATH,
            rule: 'reportAssignmentType',
        }),
    );
    await writeFile(
        `${root}/${ARITHMETIC_MODULE_PATH}`,
        `${ARITHMETIC_MODULE}

TOTAL: int = 3
`,
    );
    const corrected = parseCheckReport(await spawnGspot(root, command, environment));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const accepted = corrected.report;
    expect(accepted.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['python/basedpyright', 'passed'],
    ]);
});
