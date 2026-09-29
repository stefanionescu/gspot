import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/support/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';

test.each([
    ['nested/src/**'],
    ['**/src/**'],
    ['*.txt', '!**/keep.txt'],
    ['{nested/src,other/lib}/**'],
    ['nested/[st]rc/**'],
    ['/nested/src/'],
    ['nested'],
    ['**/nested/**/src/*'],
])('spelling exclusions %j preserve native results in scope configurations', async (...patterns) => {
    await using sandbox = await testdir();
    const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            kits: ['spelling'],
            tools: { typos: { exclude: [{ paths: patterns, reason: 'Generated input is checked by its owner.' }] } },
            scope: [{ path: 'nested' }, { path: 'nested/child' }],
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, `${TYPO.the}\n`])),
    });
    const session = await openSession(sandbox.path);
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('typos.toml'));
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    for (const path of paths) {
        const original = Bun.spawnSync(
            ['typos', '--isolated', '--config', '.gspot/config/typos.toml', '--force-exclude', `nested/${path}`],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
        const scope = Bun.spawnSync(
            ['typos', '--isolated', '--config', '.gspot/config/nested/typos.toml', '--force-exclude', `nested/${path}`],
            {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
            },
        );
        expect([0, 2]).toContain(original.exitCode);
        expect(scope.exitCode, `${path}: ${scope.stdout.toString()}${scope.stderr.toString()}`).toBe(original.exitCode);
    }
});
