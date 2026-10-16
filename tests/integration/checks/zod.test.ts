import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { LOOSE_ZOD_SCHEMA, ZOD_PROJECT_FILES } from '#tests/data/checks/zod.ts';
import { installSandbox, buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';

// Creates and commits a TypeScript project with a loose Zod schema that links the workspace modules.
async function prepareLooseSchemaProject(root: string): Promise<Record<string, string>> {
    await createFileTree(root, {
        ...ZOD_PROJECT_FILES,
    });
    await linkInstalledModules(join(root, 'node_modules'));
    commitAll(root);
    return { PATH: buildSandboxPath() };
}

test('adding the zod configuration adds its ESLint finding, and removing it drops its plugin', async () => {
    await using sandbox = await testdir();
    const environment = await prepareLooseSchemaProject(sandbox.path);
    await installSandbox(sandbox.path, buildInitArguments(['typescript']), environment, { level: 'all' });
    const before = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json'], environment);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const added = await spawnGspot(sandbox.path, ['add', 'zod', '--json'], environment);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const after = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json'], environment);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = JSON.parse(after.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
    expect(report.checks[0]?.findings).toContainEqual(
        matchFields({ check: 'javascript/eslint', file: 'schema.ts', line: 6, rule: 'zod/no-any-schema' }),
    );
    await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA.replace('z.any()', 'z.string()'));
    const correctedCheck = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'javascript/eslint', '--json'],
        environment,
    );
    expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
    expect((JSON.parse(correctedCheck.stdout) as RunReport).checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', findings: [] },
    ]);
    await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA);
    const removed = await spawnGspot(sandbox.path, ['remove', 'zod', '--json'], environment);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, '.gspot/package.json')).text()).not.toContain('eslint-plugin-zod');
    const removedCheck = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'javascript/eslint', '--json'],
        environment,
    );
    expect(removedCheck.code, removedCheck.stdout + removedCheck.stderr).toBe(0);
});
