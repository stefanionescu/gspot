import { expect, test } from 'bun:test';
import { join, relative } from 'node:path';

import { createFileTree, testdir } from 'testdirs';
import { runBlocking, run } from '#cli/platform/spawn.ts';

import { withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { readdirSync, symlinkSync, unlinkSync, writeFileSync, readFileSync, readlinkSync } from 'node:fs';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

test.each([
    ['index', 'plain'],
    ['commit', "author's tools"],
] as const)(
    'a %s Python snapshot relocates native launchers from %s and confines package links',
    async (kind, directory) => {
        await using repository = await testdir();
        await using outside = await testdir();
        const root = join(repository.path, directory);
        await createFileTree(root, {
            '.gitignore': '.venv/\n',
            'pyproject.toml':
                '[project]\nname = "snapshot-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\ndependencies = ["pre-commit==4.5.1"]\n',
        });
        for (const command of [
            ['uv', 'lock'],
            ['uv', 'sync', '--frozen', '--no-install-project'],
        ]) {
            const result = await run(command, { cwd: root, timeoutMs: 60_000 });
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        git(root, ['init', '-q']);
        git(root, ['add', '.']);
        git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']);
        const source = kind === 'index' ? { kind } : { kind, object: git(root, ['rev-parse', 'HEAD']) };
        const python = join(root, '.venv/bin/python');
        const module = await run([python, '-I', '-c', 'import pre_commit.main; print(pre_commit.main.__file__)'], {
            cwd: root,
        });
        expect(module.code, module.stderr).toBe(0);
        const modulePath = relative(root, module.stdout.trim());
        expect(modulePath.startsWith('.venv/')).toBe(true);
        const original = readFileSync(join(root, modulePath));
        const launcher = readFileSync(join(root, '.venv/bin/pre-commit'));
        await withRevisionSnapshot(root, source, async (snapshot) => {
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
        await createFileTree(outside.path, { 'private.txt': 'outside bytes' });
        const external = join(outside.path, 'private.txt');
        const link = join(root, '.venv/lib/escaped');
        symlinkSync(external, link);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow('external link');
        unlinkSync(link);
        const interpreter = readlinkSync(python);
        unlinkSync(python);
        symlinkSync(external, python);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow('external link');
        unlinkSync(python);
        symlinkSync(interpreter, python);
        const configuration = join(root, '.venv/pyvenv.cfg');
        const configured = readFileSync(configuration);
        writeFileSync(
            configuration,
            configured
                .toString('utf8')
                .replace('include-system-site-packages = false', 'include-system-site-packages = true'),
        );
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow('system packages');
        writeFileSync(configuration, configured);
        unlinkSync(configuration);
        symlinkSync(external, configuration);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow(
            'not a private regular file: .venv/pyvenv.cfg',
        );
        unlinkSync(configuration);
        writeFileSync(configuration, configured);
        await createFileTree(outside.path, { 'python/private.txt': 'outside directory' });
        writeFileSync(configuration, configured.toString('utf8').replace(/^home = .+$/mu, `home = ${outside.path}`));
        unlinkSync(python);
        symlinkSync(join(outside.path, 'python'), python);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow('external link');
        unlinkSync(python);
        symlinkSync(interpreter, python);
        writeFileSync(configuration, configured);
        expect(readFileSync(external, 'utf8')).toBe('outside bytes');
        expect((await run([python, '-m', 'pre_commit', '--version'], { cwd: root })).stdout.trim()).toBe(
            'pre-commit 4.5.1',
        );
    },
    90_000,
);

test.each([
    ['index', 'hatchling'],
    ['commit', 'hatchling'],
    ['index', 'hatchling-exact'],
    ['commit', 'hatchling-exact'],
    ['index', 'setuptools'],
    ['commit', 'setuptools'],
] as const)(
    'an editable Python package reads %s source through %s instead of the working checkout',
    async (kind, backend) => {
        await using repository = await testdir();
        const root = join(repository.path, "editable's project");
        const packageDirectory = backend === 'setuptools' ? 'libsrc/differently_named' : 'src/editable_fixture';
        const build =
            backend === 'setuptools'
                ? '[build-system]\nrequires = ["setuptools==80.9.0"]\nbuild-backend = "setuptools.build_meta"\n[tool.setuptools]\npackages = ["editable_fixture", "namespace_fixture.child"]\n[tool.setuptools.package-dir]\neditable_fixture = "libsrc/differently_named"\n"namespace_fixture.child" = "libsrc/namespace_child"\n'
                : '[build-system]\nrequires = ["hatchling==1.27.0"]\nbuild-backend = "hatchling.build"\n[tool.hatch.build.targets.wheel]\npackages = ["src/editable_fixture"]\n' +
                  (backend === 'hatchling-exact' ? 'dev-mode-exact = true\n' : '');
        await createFileTree(root, {
            '.gitignore': '.venv/\n',
            'pyproject.toml':
                '[project]\nname = "editable-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\n[project.scripts]\nfixture-entry = "editable_fixture:main"\n' +
                build +
                (backend === 'hatchling-exact' ? '\n[dependency-groups]\ndev = ["editables==0.5"]\n' : ''),
            [`${packageDirectory}/__init__.py`]: 'def main():\n    print("selected source")\n',
            'libsrc/namespace_child/__init__.py': 'def main():\n    print("selected namespace")\n',
        });
        for (const command of [
            ['uv', 'lock'],
            ['uv', 'sync', '--frozen'],
        ]) {
            const result = await run(command, { cwd: root, timeoutMs: 60_000 });
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        git(root, ['init', '-q']);
        git(root, ['add', '.']);
        git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']);
        const source = kind === 'index' ? { kind } : { kind, object: git(root, ['rev-parse', 'HEAD']) };
        const working = 'def main():\n    print("working source")\n';
        writeFileSync(join(root, packageDirectory, '__init__.py'), working);
        writeFileSync(
            join(root, 'libsrc/namespace_child/__init__.py'),
            'def main():\n    print("working namespace")\n',
        );
        if (backend !== 'hatchling') {
            const compiled = await run(
                [
                    join(root, '.venv/bin/python'),
                    '-I',
                    '-S',
                    '-c',
                    'import glob, py_compile; [py_compile.compile(path, invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH) for path in glob.glob(".venv/lib/python*/site-packages/*_finder.py") + glob.glob(".venv/lib/python*/site-packages/_editable_impl_*.py")]',
                ],
                { cwd: root },
            );
            expect(compiled.code, compiled.stderr).toBe(0);
        }
        await withRevisionSnapshot(root, source, async (snapshot) => {
            for (const command of [
                [join(snapshot, '.venv/bin/python'), '-I', '-c', 'from editable_fixture import main; main()'],
                [join(snapshot, '.venv/bin/fixture-entry')],
            ]) {
                const result = await run(command, { cwd: snapshot });
                expect(result.code, result.stdout + result.stderr).toBe(0);
                expect(result.stdout.trim()).toBe('selected source');
            }
        });
        if (backend === 'setuptools') {
            await withRevisionSnapshot(root, source, async (snapshot) => {
                const result = await run(
                    [
                        join(snapshot, '.venv/bin/python'),
                        '-I',
                        '-c',
                        'from namespace_fixture.child import main; main()',
                    ],
                    { cwd: snapshot },
                );
                expect(result.code, result.stderr).toBe(0);
                expect(result.stdout.trim()).toBe('selected namespace');
            });
        }
        expect(readFileSync(join(root, packageDirectory, '__init__.py'), 'utf8')).toBe(working);
        const original = await run([join(root, '.venv/bin/fixture-entry')], { cwd: root });
        expect(original.code, original.stderr).toBe(0);
        expect(original.stdout.trim()).toBe('working source');
        const python = join(root, '.venv/bin/python');
        const sites = await run([python, '-I', '-c', 'import site; print(site.getsitepackages()[0])'], { cwd: root });
        expect(sites.code, sites.stderr).toBe(0);
        if (backend !== 'hatchling') {
            const finder = readdirSync(sites.stdout.trim()).find(
                (name) => name.endsWith('_finder.py') || (name.startsWith('_editable_impl_') && name.endsWith('.py')),
            )!;
            const loader = join(sites.stdout.trim(), finder);
            const originalLoader = readFileSync(loader);
            writeFileSync(
                loader,
                originalLoader.toString('utf8') +
                    (backend === 'setuptools' ? '\nMAPPING = dict()\n' : '\nF.map_module("bad", str())\n'),
            );
            await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow(
                'Cannot parse installed editable Python loader metadata',
            );
            writeFileSync(loader, originalLoader);
        }
        const metadata = join(sites.stdout.trim(), 'fixture-path.pth');
        await using external = await testdir();
        writeFileSync(metadata, `${external.path}\n`);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow(
            'path metadata references an external directory',
        );
        writeFileSync(metadata, `${join(root, 'unselected-source')}\n`);
        await expect(withRevisionSnapshot(root, source, async () => undefined)).rejects.toThrow(
            'source missing from the selected revision',
        );
        writeFileSync(metadata, `# Preserved comment\n\n${root}\n`);
        await withRevisionSnapshot(root, source, async (snapshot) => {
            const result = await run([join(snapshot, '.venv/bin/python'), '-I', '-c', 'import sys; print(sys.path)'], {
                cwd: snapshot,
            });
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout).toContain(snapshot);
            expect(readFileSync(metadata, 'utf8')).toBe(`# Preserved comment\n\n${root}\n`);
        });
    },
    90_000,
);
