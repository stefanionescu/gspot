import { scriptIndex } from '#cli/structure/cross-file-index.ts';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { claimedInputs, planRun } from '#cli/run/plan.ts';
import { engineInput, runEngineCheck } from '#cli/run/engines.ts';
import { scratchCopy } from '#cli/run/fixers.ts';
import { openSession } from '#cli/run/session.ts';

test('engine inputs expose selected files and reserve the repository inventory for once-only checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["jest", "docs"]\n[[scope]]\npath = "apps/web"\n',
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'unrelated/private.txt': 'Sibling input\n',
    });
    const session = await openSession(sandbox.path);
    const planned = await planRun(session, {
        stage: 'all',
        skips: [],
        only: ['jest/coverage', 'integrity/stale-paths'],
    });
    const project = planned.find((entry) => entry.check === 'jest/coverage' && entry.scope.scope.path === 'apps/web')!;
    const scoped = engineInput(session, project);
    expect(claimedInputs(session, project).map((file) => file.path)).toEqual(['apps/web/value.test.js']);
    expect(scoped.scopeRoot).toBe(join(sandbox.path, 'apps/web'));
    expect(scoped.files.map((file) => file.path).toSorted()).toEqual([
        'apps/web/fixture.bin',
        'apps/web/jest.config.json',
        'apps/web/value.test.js',
    ]);
    const leaked = await runEngineCheck(
        session,
        async () => ({ findings: [], checkedFiles: ['unrelated/private.txt'] }),
        project,
    );
    expect(leaked.status).toBe('error');
    const owned = await runEngineCheck(
        session,
        async () => ({ findings: [], checkedFiles: ['apps/web/value.test.js'] }),
        project,
    );
    expect(owned).toMatchObject({ status: 'ok', checkedFiles: ['apps/web/value.test.js'] });
    const scratch = scratchCopy(
        scoped.root,
        scoped.files.map((file) => file.path),
        ['apps/web'],
    );
    try {
        expect(existsSync(join(scratch, 'apps/web/fixture.bin'))).toBe(true);
        expect(existsSync(join(scratch, 'apps/web/jest.config.json'))).toBe(true);
        expect(existsSync(join(scratch, 'unrelated/private.txt'))).toBe(false);
        expect(existsSync(join(scratch, 'README.md'))).toBe(false);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('shell observations distinguish filename lists containing newlines', async () => {
    await using sandbox = await testdir();
    const names = ['a.sh', 'b.sh\nc.sh', 'a.sh\nb.sh', 'c.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        ...Object.fromEntries(names.map((name, index) => [name, `function name${index}() { echo ${index}; }\n`])),
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const request = engineInput(session, {
        scope,
        spec: session.manifests.get('bash')!.checks[0]!,
        files: session.repository.files,
    });
    const files = names.map((path) => session.repository.files.find((file) => file.path === path)!);
    const first = await scriptIndex(request, files.slice(0, 2));
    const second = await scriptIndex(request, files.slice(2));
    expect(first.files.map((file) => file.path)).toEqual(names.slice(0, 2));
    expect(second.files.map((file) => file.path)).toEqual(names.slice(2));
    expect([...second.owners.keys()]).toEqual(['name2', 'name3']);
});
