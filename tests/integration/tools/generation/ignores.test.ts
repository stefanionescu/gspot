import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
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
])('spelling exclusions %j preserve native results in scoped editor configurations', async (...patterns) => {
    await using sandbox = await testdir();
    const paths = ['src/bad.txt', 'src/keep.txt', 'trc/bad.txt', 'child/src/bad.txt', 'child/bad.txt', 'bad.txt'];
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['spelling'],
            tools: { typos: { exclude: [{ paths: patterns, reason: 'Generated input is checked by its owner.' }] } },
            scope: [{ path: 'nested' }, { path: 'nested/child' }],
        }),
        ...Object.fromEntries(paths.map((path) => [`nested/${path}`, 'teh\n'])),
    });
    const renderSession1 = await openSession(sandbox.path);
    const outputs = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    }).files.filter(({ path }) => path.endsWith('typos.toml'));
    for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
    for (const path of paths) {
        const original = Bun.spawnSync(
            ['typos', '--isolated', '--config', '.gspot/config/typos.toml', '--force-exclude', `nested/${path}`],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
        const editor = Bun.spawnSync(['typos', '--force-exclude', path], {
            cwd: join(sandbox.path, 'nested'),
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect([0, 2]).toContain(original.exitCode);
        expect(editor.exitCode, `${path}: ${editor.stdout.toString()}${editor.stderr.toString()}`).toBe(
            original.exitCode,
        );
    }
});
