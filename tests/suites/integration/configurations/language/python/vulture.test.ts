import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

const USED_SOURCE = `"""Totals."""


def double(value: int) -> int:
    """Double a number."""
    return value * 2


print(double(2))
`;

const UNUSED_FUNCTION = `

def never_called(value: int) -> int:
    """Triple a number."""
    return value * 3
`;

test('python/vulture reports an unused function at its line and passes once it goes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = []\n',
        'totals.py': USED_SOURCE + UNUSED_FUNCTION,
    });
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const command = ['check', '--only', 'python/vulture', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([{ file: 'totals.py', line: 12, rule: 'unused-function' }]);
    await writeFile(join(sandbox.path, 'totals.py'), USED_SOURCE);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(listFindingRows(corrected.report)).toStrictEqual([]);
});
