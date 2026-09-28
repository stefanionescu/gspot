import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { prepareSpelling } from '#tests/support/cli/spelling.ts';

test.each([false, true])(
    'nested spelling adoption isolates scoped exclusions with an existing scope of %s',
    async (existing) => {
        await using sandbox = await testdir();
        const { original, kept, session } = await prepareSpelling(sandbox.path, existing);
        expect(kept.unread).toStrictEqual([]);
        expect(kept.tools.has('typos')).toBe(false);
        expect(kept.removed.map(({ path }) => path)).toStrictEqual(['nested/typos.toml']);
        expect(session.policyFiles.policy.scopes).toStrictEqual([
            { path: 'nested', kits: existing ? ['markdown', 'spelling'] : ['spelling'] },
        ]);
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
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
    },
);

test.each([false, true])(
    'nested spelling editor configuration preserves native exclusions with an existing scope of %s',
    async (existing) => {
        await using sandbox = await testdir();
        const { outputs } = await prepareSpelling(sandbox.path, existing);
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
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
        const editor = outputs.find(({ path }) => path === 'nested/typos.toml')!;
        await Bun.write(join(sandbox.path, editor.path), editor.content);
        for (const [path, status] of expected) {
            const checked = native(path);
            expect(checked.exitCode, checked.stdout.toString() + checked.stderr.toString()).toBe(status);
        }
        await Bun.write(join(sandbox.path, 'nested/keep.skip'), 'receive\n');
        expect(native('keep.skip').exitCode).toBe(0);
    },
);
