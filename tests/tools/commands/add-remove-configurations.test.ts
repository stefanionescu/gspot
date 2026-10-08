// Adding or removing a configuration changes the next explicit check through its ESLint fragment and plugin.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { initRepository, buildSandboxPath } from '#tests/harness/install.ts';
import { ZOD_PACKAGE, STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';
import { LINT, LOOSE, BASH_IN_API } from '#tests/config/tools/commands/add-remove-configurations.ts';

// Creates and commits a TypeScript project with a loose Zod schema that links the workspace modules.
async function prepareProject(root: string): Promise<Record<string, string>> {
    await createFileTree(root, {
        '.gitignore': 'node_modules\n',
        'package.json': ZOD_PACKAGE,
        'tsconfig.json':
            JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['*.ts'] }, null, 4) + '\n',
        'schema.ts': LOOSE,
        node_modules: {},
    });
    await linkInstalledModules(join(root, 'node_modules'));
    commitAll(root);
    return { PATH: buildSandboxPath(['typos', 'ec', 'ast-grep']) };
}

test('adding an ESLint fragment exposes its finding on the next explicit check, and removing it drops its plugin', async () => {
    await using sandbox = await testdir();
    const environment = await prepareProject(sandbox.path);
    await initRepository(sandbox.path, buildInitArguments(['typescript']), environment, { level: 'all' });
    const before = await spawnGspot(sandbox.path, LINT, environment);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const added = await spawnGspot(sandbox.path, ['add', 'zod', '--json'], environment);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const after = await spawnGspot(sandbox.path, LINT, environment);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = JSON.parse(after.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'failed' }]);
    expect(report.checks[0]?.findings).toContainEqual(
        containing({ check: 'javascript/eslint', file: 'schema.ts', line: 6, rule: 'zod/no-any-schema' }),
    );
    await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE.replace('z.any()', 'z.string()'));
    const correctedCheck = await spawnGspot(sandbox.path, LINT, environment);
    expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
    expect((JSON.parse(correctedCheck.stdout) as RunReport).checks).toMatchObject([
        { check: 'javascript/eslint', status: 'passed', findings: [] },
    ]);
    await Bun.write(join(sandbox.path, 'schema.ts'), LOOSE);
    const removed = await spawnGspot(sandbox.path, ['remove', 'zod', '--json'], environment);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules/eslint-plugin-zod'))).toBe(false);
    const removedCheck = await spawnGspot(sandbox.path, LINT, environment);
    expect(removedCheck.code, removedCheck.stdout + removedCheck.stderr).toBe(0);
});

test('removing a configuration from a scope deletes the outputs only it needed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': BASH_IN_API, 'api/entry.sh': 'echo api\n' });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gspot/config/api/shellcheckrc'))).toBe(true);
    const removed = await spawnGspot(sandbox.path, ['remove', 'bash', '--scope', 'api']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('removed bash from scope api');
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))['scope']).toEqual({
        api: { configurations: [], removed_configurations: ['bash'] },
    });
    expect(await pathExists(join(sandbox.path, '.gspot/config/api/shellcheckrc'))).toBe(false);
});
