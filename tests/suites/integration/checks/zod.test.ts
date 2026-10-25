import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { initSandbox, pinSandboxNpm } from '#tests/setup/sandboxes/create.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { LOOSE_ZOD_SCHEMA, ZOD_PROJECT_FILES } from '#tests/config/integration/checks/zod.ts';
import { spawnGspot, listFindingRows, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('adding the zod configuration adds its ESLint finding, and removing it drops its plugin', async () => {
    await using sandbox = await testdir(ZOD_PROJECT_FILES);
    await pinSandboxNpm(sandbox.path);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    commitAll(sandbox.path);
    await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['typescript'], level: 'all' });
    const before = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const added = await spawnGspot(sandbox.path, ['add', 'zod', '--json']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    await applyThenInstall(sandbox.path);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toContain('"eslint-plugin-zod"');
    const after = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json']));
    expect(after.code, after.stdout + after.stderr).toBe(1);
    expect(listFindingRows(after.report)).toStrictEqual([{ file: 'schema.ts', line: 8, rule: 'zod/no-any-schema' }]);
    await writeFile(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA.replace('z.any()', 'z.string()'));
    const correctedCheck = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json']),
    );
    expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
    expect(correctedCheck.report.checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', findings: [] },
    ]);
    await writeFile(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA);
    const removed = await spawnGspot(sandbox.path, [
        'remove',
        'zod',
        '--reason',
        'The project no longer uses Zod schemas.',
        '--json',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const project = JSON.parse(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')) as {
        devDependencies: Record<string, string>;
    };
    expect(Object.keys(project.devDependencies)).not.toContain('eslint-plugin-zod');
    const removedCheck = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json']);
    expect(removedCheck.code, removedCheck.stdout + removedCheck.stderr).toBe(0);
});
