import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { PYTHON_SANDBOX, ARITHMETIC_MODULE_PATH } from '#tests/config/integration/checks/language/python/sandboxes.ts';

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);

test('basedpyright reports a type error and passes after the fix', async () => {
    const { root } = installedSandbox();
    await using _change = await changeSandbox(installedSandbox(), {
        files: { [ARITHMETIC_MODULE_PATH]: `${ARITHMETIC_MODULE}\n\nTOTAL: int = "three"\n` },
    });
    const venv = await runCommand(['uv', 'venv', '.venv'], { cwd: root });
    expect(venv.code, venv.stdout + venv.stderr).toBe(0);
    const command = ['check', '--only', 'python/basedpyright', '--json'];
    const refused = parseCheckReport(await spawnGspot(root, command));
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    expect(listFindingRows(refused.report)).toStrictEqual([
        { file: ARITHMETIC_MODULE_PATH, line: 28, rule: 'reportAssignmentType' },
    ]);
    await writeFile(join(root, ARITHMETIC_MODULE_PATH), `${ARITHMETIC_MODULE}\n\nTOTAL: int = 3\n`);
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'python/basedpyright', status: 'passed', findings: [] }]);
});
