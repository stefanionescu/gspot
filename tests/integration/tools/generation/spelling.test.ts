import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';

test('spelling locales and word allowances remain scoped in generated configurations and editor copies', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["spelling"]\n[[scope]]\npath = "british"\n[scope.tools.typos]\nlocale = "en-gb"\nwords = [{ word = "teh", reason = "An imported name requires this exact spelling." }]\n[[scope]]\npath = "british/child"\n',
        'sample.txt': 'colour teh\n',
        'british/child/sample.txt': 'colour teh\n',
    });
    const renderSession2 = await openSession(sandbox.path);
    const output = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    });
    const configs = output.files.filter(({ path }) => path.endsWith('typos.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/british/child/typos.toml',
        '.gspot/config/british/typos.toml',
        '.gspot/config/typos.toml',
        'british/child/typos.toml',
        'british/typos.toml',
        'typos.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (config: string, path: string) =>
        Bun.spawnSync(['typos', '--config', config, '--format', 'brief', '--color', 'never', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const root = run('.gspot/config/typos.toml', 'sample.txt');
    expect(root.exitCode, root.stderr.toString()).toBe(2);
    expect(root.stdout.toString()).toContain('colour');
    expect(root.stdout.toString()).toContain('teh');
    const child = run('.gspot/config/british/child/typos.toml', 'british/child/sample.txt');
    expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
    const editor = Bun.spawnSync(['typos', '--format', 'brief', 'sample.txt'], {
        cwd: join(sandbox.path, 'british/child'),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    expect(editor.exitCode, editor.stdout.toString() + editor.stderr.toString()).toBe(0);
    await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
    const corrected = run('.gspot/config/typos.toml', 'sample.txt');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
});
