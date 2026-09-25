import { proposeText } from '#cli/commands/init/propose.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { collectCarried } from '#cli/policy/adoption/collect.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test.each([false, true])(
    'nested spelling adoption writes a local policy table with an existing scope of %s',
    async (existing) => {
        await using sandbox = await testdir();
        const original =
            '[default]\nlocale = "en-gb"\n[default.extend-words]\n# An imported name requires its exact spelling.\nteh = "teh"\n[files]\nextend-exclude = ["src/**", "*.skip", "!keep.skip"]\n';
        await createFileTree(sandbox.path, {
            'nested/typos.toml': original,
            'nested/sample.txt': 'colour teh\n',
            'nested/src/ignored.txt': 'recieve\n',
            'nested/ignored.skip': 'recieve\n',
            'nested/keep.skip': 'recieve\n',
            'sample.txt': 'colour teh\n',
        });
        const native = (path: string) =>
            Bun.spawnSync(['typos', '--force-exclude', path], {
                cwd: join(sandbox.path, 'nested'),
                stdout: 'pipe',
                stderr: 'pipe',
            });
        const expected = [
            ['src/ignored.txt', 0],
            ['ignored.skip', 0],
            ['keep.skip', 2],
        ] as const;
        for (const [path, status] of expected) expect(native(path).exitCode).toBe(status);
        const repository = await readRepository(sandbox.path, [], [], []);
        const discovered = existingTooling(sandbox.path, repository.files, []);
        const carried = await collectCarried(sandbox.path, discovered, new Set(['spelling']), []);
        expect(carried.unread).toStrictEqual([]);
        expect(carried.tools.has('typos')).toBe(false);
        expect(carried.removed.map(({ path }) => path)).toStrictEqual(['nested/typos.toml']);
        const policy = proposeText({
            configurations: ['spelling'],
            scopes: existing ? [{ path: 'nested', configurations: ['markdown'] }] : [],
            carried,
            hooks: 'none',
            ci: 'none',
            rules: false,
            runner: 'none',
        });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.scopes).toStrictEqual([
            { path: 'nested', configurations: existing ? ['markdown', 'spelling'] : ['spelling'] },
        ]);
        const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('typos.toml'));
        for (const config of outputs) await Bun.write(join(sandbox.path, config.path), config.content);
        const run = (config: string, path: string) =>
            Bun.spawnSync(
                [
                    'typos',
                    '--isolated',
                    '--config',
                    config,
                    '--force-exclude',
                    '--format',
                    'brief',
                    '--color',
                    'never',
                    path,
                ],
                { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
            );
        const child = run('.gspot/config/nested/typos.toml', 'nested/sample.txt');
        expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/src/ignored.txt').exitCode).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/ignored.skip').exitCode).toBe(0);
        expect(run('.gspot/config/nested/typos.toml', 'nested/keep.skip').exitCode).toBe(2);
        const root = run('.gspot/config/typos.toml', 'sample.txt');
        expect(root.exitCode, root.stdout.toString() + root.stderr.toString()).toBe(2);
        expect(root.stdout.toString()).toContain('teh');
        await Bun.write(join(sandbox.path, 'sample.txt'), 'color the\n');
        expect(run('.gspot/config/typos.toml', 'sample.txt').exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'nested/typos.toml')).text()).toBe(original);
        const editor = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }).files.find(({ path }) => path === 'nested/typos.toml')!;
        await Bun.write(join(sandbox.path, editor.path), editor.content);
        for (const [path, status] of expected) {
            const checked = native(path);
            expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(status);
        }
        await Bun.write(join(sandbox.path, 'nested/keep.skip'), 'receive\n');
        expect(native('keep.skip').exitCode).toBe(0);
    },
);
