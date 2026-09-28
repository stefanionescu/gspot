import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { useRevision } from '#cli/repository/revisions/contents.ts';
import { preparePythonSnapshot } from '#tests/support/cli/python/snapshot.ts';
import { unlinkSync, symlinkSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';

test.each([
    ['index', 'plain'],
    ['commit', "author's tools"],
] as const)(
    'Python snapshots relocate native launchers and isolate dependency writes from %s in %s',
    async (kind, directory) => {
        await using repository = await testdir();
        const root = join(repository.path, directory);
        const { source, python } = await preparePythonSnapshot(root, kind);
        const module = await run([python, '-I', '-c', 'import pre_commit.main; print(pre_commit.main.__file__)'], {
            cwd: root,
        });
        expect(module.code, module.stderr).toBe(0);
        const modulePath = relative(root, module.stdout.trim());
        expect(modulePath.startsWith('.venv/')).toBe(true);
        const original = readFileSync(join(root, modulePath));
        const launcher = readFileSync(join(root, '.venv/bin/pre-commit'));
        await useRevision(root, source, async (snapshot) => {
            const executable = join(snapshot, '.venv/bin/python');
            const prefix = await run([executable, '-I', '-c', 'import sys; print(sys.prefix)'], { cwd: snapshot });
            expect(prefix.code, prefix.stderr).toBe(0);
            expect(prefix.stdout.trim()).toBe(join(snapshot, '.venv'));
            await Bun.write(
                join(snapshot, modulePath),
                'def main():\n    print("snapshot dependency")\n    return 0\n',
            );
            for (const command of [
                [join(snapshot, '.venv/bin/pre-commit'), '--version'],
                [executable, '-I', '-c', 'from pre_commit.main import main; main()'],
            ]) {
                const result = await run(command, { cwd: snapshot });
                expect(result.code, result.stdout + result.stderr).toBe(0);
                expect(result.stdout.trim()).toBe('snapshot dependency');
            }
        });
        expect(readFileSync(join(root, modulePath))).toStrictEqual(original);
        expect(readFileSync(join(root, '.venv/bin/pre-commit'))).toStrictEqual(launcher);
    },
    90_000,
);

test.each([
    ['index', 'plain'],
    ['commit', "author's tools"],
] as const)(
    'Python snapshots refuse external package and interpreter links then accept restoration from %s in %s',
    async (kind, directory) => {
        await using repository = await testdir();
        const root = join(repository.path, directory);
        const { source, python } = await preparePythonSnapshot(root, kind);
        await using outside = await testdir();
        await createFileTree(outside.path, { 'private.txt': 'outside bytes' });
        const external = join(outside.path, 'private.txt');
        const link = join(root, '.venv/lib/escaped');
        symlinkSync(external, link);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain('external link');
        unlinkSync(link);
        const interpreter = readlinkSync(python);
        unlinkSync(python);
        symlinkSync(external, python);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain('external link');
        unlinkSync(python);
        symlinkSync(interpreter, python);
        await useRevision(root, source, async (snapshot) => {
            const checked = await run([join(snapshot, '.venv/bin/python'), '-m', 'pre_commit', '--version'], {
                cwd: snapshot,
            });
            expect(checked.code, checked.stderr).toBe(0);
            expect(checked.stdout.trim()).toBe('pre-commit 4.5.1');
        });
        expect(readFileSync(external, 'utf8')).toBe('outside bytes');
    },
    90_000,
);

test.each([
    ['index', 'plain'],
    ['commit', "author's tools"],
] as const)(
    'Python snapshots refuse shared-system settings and symlinked configuration then accept restoration from %s in %s',
    async (kind, directory) => {
        await using repository = await testdir();
        const root = join(repository.path, directory);
        const { source } = await preparePythonSnapshot(root, kind);
        await using outside = await testdir();
        await createFileTree(outside.path, { 'private.txt': 'outside bytes' });
        const external = join(outside.path, 'private.txt');
        const configuration = join(root, '.venv/pyvenv.cfg');
        const configured = readFileSync(configuration);
        writeFileSync(
            configuration,
            configured
                .toString('utf8')
                .replace('include-system-site-packages = false', 'include-system-site-packages = true'),
        );
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain(
            'system packages',
        );
        writeFileSync(configuration, configured);
        unlinkSync(configuration);
        symlinkSync(external, configuration);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain(
            'not a private regular file: .venv/pyvenv.cfg',
        );
        unlinkSync(configuration);
        writeFileSync(configuration, configured);
        await useRevision(root, source, async (snapshot) => {
            const checked = await run([join(snapshot, '.venv/bin/python'), '-m', 'pre_commit', '--version'], {
                cwd: snapshot,
            });
            expect(checked.code, checked.stderr).toBe(0);
            expect(checked.stdout.trim()).toBe('pre-commit 4.5.1');
        });
        expect(readFileSync(external, 'utf8')).toBe('outside bytes');
    },
    90_000,
);

test.each([
    ['index', 'plain'],
    ['commit', "author's tools"],
] as const)(
    'Python snapshots refuse an external interpreter directory then accept a private interpreter from %s in %s',
    async (kind, directory) => {
        await using repository = await testdir();
        const root = join(repository.path, directory);
        const { source, python } = await preparePythonSnapshot(root, kind);
        await using outside = await testdir();
        await createFileTree(outside.path, { 'private.txt': 'outside bytes' });
        const external = join(outside.path, 'private.txt');
        const configuration = join(root, '.venv/pyvenv.cfg');
        const configured = readFileSync(configuration);
        const interpreter = readlinkSync(python);
        await createFileTree(outside.path, { 'python/private.txt': 'outside directory' });
        writeFileSync(configuration, configured.toString('utf8').replace(/^home = .+$/mu, `home = ${outside.path}`));
        unlinkSync(python);
        symlinkSync(join(outside.path, 'python'), python);
        expect(await rejection(useRevision(root, source, () => Promise.resolve(undefined)))).toContain('external link');
        unlinkSync(python);
        symlinkSync(interpreter, python);
        writeFileSync(configuration, configured);
        await useRevision(root, source, async (snapshot) => {
            const checked = await run([join(snapshot, '.venv/bin/python'), '-m', 'pre_commit', '--version'], {
                cwd: snapshot,
            });
            expect(checked.code, checked.stderr).toBe(0);
            expect(checked.stdout.trim()).toBe('pre-commit 4.5.1');
        });
        expect(readFileSync(external, 'utf8')).toBe('outside bytes');
        const ran = await run([python, '-m', 'pre_commit', '--version'], { cwd: root });
        expect(ran.stdout.trim()).toBe('pre-commit 4.5.1');
    },
    90_000,
);
