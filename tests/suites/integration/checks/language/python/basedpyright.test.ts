import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { JSON_INDENT } from '#cli/config/text.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/checks/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { GENERATED_EDIT_LINE, GENERATED_HEADER_TEXT } from '#cli/config/generation/header.ts';
import { PYTHON_SANDBOX, ARITHMETIC_MODULE_PATH } from '#tests/config/integration/checks/language/python/samples.ts';

const installedSandbox = shareInstalledSandbox(PYTHON_SANDBOX);

test('init replaces your pyrightconfig.json with a pointer, and basedpyright reports the type error', async () => {
    const typed = `${ARITHMETIC_MODULE}\n\nTOTAL: int = "three"\n`;
    const { root } = installedSandbox();
    const settings = await readFile(join(root, 'gspot.toml'), 'utf8');
    await using _change = await changeAppliedSandbox(installedSandbox(), {
        files: { [ARITHMETIC_MODULE_PATH]: typed },
    });
    const target = findManifestTarget('python', 'basedpyright.json');
    const pointer = { extends: `./${target}` };
    const header = `// ${GENERATED_HEADER_TEXT}\n// ${GENERATED_EDIT_LINE}\n//\n// The config file is ${target}.\n`;
    expect(await readFile(join(root, 'pyrightconfig.json'), 'utf8')).toBe(
        `${header}${JSON.stringify(pointer, null, JSON_INDENT)}\n`,
    );
    expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(settings);
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
