import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { initSandbox, pinSandboxNpm } from '#tests/setup/sandboxes/create.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { LOOSE_ZOD_SCHEMA, ZOD_PROJECT_FILES } from '#tests/config/integration/checks/zod.ts';
import { spawnGspot, parseCheckReport, installGeneratedTools } from '#tests/setup/cli/commands.ts';

/** Create and commit a TypeScript project with a loose Zod schema that links the workspace modules. */
async function prepareLooseSchemaProject(root: string): Promise<Record<string, string>> {
    await createFileTree(root, {
        ...ZOD_PROJECT_FILES,
    });
    await pinSandboxNpm(root);
    await linkInstalledModules(join(root, 'node_modules'));
    commitAll(root);
    return {};
}

test('adding the zod configuration adds its ESLint finding, and removing it drops its plugin', async () => {
    await using sandbox = await testdir();
    const environment = await prepareLooseSchemaProject(sandbox.path);
    await initSandbox(
        { root: sandbox.path, environment, run: spawnGspot },
        { configurations: ['typescript'], level: 'all' },
    );
    const before = await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json'], environment);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const added = await spawnGspot(sandbox.path, ['add', 'zod', '--json'], environment);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    await installGeneratedTools(sandbox.path);
    const after = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json'], environment),
    );
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = after.report;
    expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
    expect(report.checks[0]?.findings).toContainEqual(
        matchFields({ check: 'javascript/eslint', file: 'schema.ts', line: 6, rule: 'zod/no-any-schema' }),
    );
    await writeFile(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA.replace('z.any()', 'z.string()'));
    const correctedCheck = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'javascript/eslint', '--json'], environment),
    );
    expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
    expect(correctedCheck.report.checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', findings: [] },
    ]);
    await writeFile(join(sandbox.path, 'schema.ts'), LOOSE_ZOD_SCHEMA);
    const removed = await spawnGspot(
        sandbox.path,
        ['remove', 'zod', '--reason', 'The project no longer uses Zod schemas.', '--json'],
        environment,
    );
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).not.toContain('eslint-plugin-zod');
    const removedCheck = await spawnGspot(
        sandbox.path,
        ['check', '--only', 'javascript/eslint', '--json'],
        environment,
    );
    expect(removedCheck.code, removedCheck.stdout + removedCheck.stderr).toBe(0);
});
