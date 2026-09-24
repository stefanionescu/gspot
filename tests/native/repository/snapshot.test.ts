import * as promises from 'node:fs/promises';
import { expect, spyOn, test } from 'bun:test';
import { dirname, join, relative } from 'node:path';
import { rejects } from 'node:assert/strict';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { runBlocking, run } from '#cli/platform/spawn.ts';
import { pushedRevisions } from '#cli/repository/staged.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { doctorReport, doctorText } from '#cli/commands/doctor/report.ts';
import { orphanSources, projectSymlinks } from '#cli/checks/xcode/project.ts';
import { committedEntries, gitBlobs, gitEntries, withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, writeFileSync, readFileSync, readlinkSync } from 'node:fs';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

test.each(['index', 'commit'] as const)(
    'a %s snapshot retains gitlinks without reading submodule contents',
    async (kind) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
            'source.txt': 'selected source',
        });
        await createFileTree(outside.path, { 'package.json': '{', 'source.txt': 'outside source' });
        git(sandbox.path, ['init']);
        git(sandbox.path, ['add', '.']);
        git(sandbox.path, [
            '-c',
            'user.name=Example',
            '-c',
            'user.email=example@example.com',
            'commit',
            '-qm',
            'Source',
        ]);
        const object = git(sandbox.path, ['rev-parse', 'HEAD']);
        const path = 'vendor/external project';
        git(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${object},${path}`]);
        git(sandbox.path, [
            '-c',
            'user.name=Example',
            '-c',
            'user.email=example@example.com',
            'commit',
            '-qm',
            'Gitlink',
        ]);
        mkdirSync(join(sandbox.path, 'vendor'));
        symlinkSync(outside.path, join(sandbox.path, path), 'dir');
        expect(submodulePaths(sandbox.path)).toStrictEqual([path]);
        const session = await openSession(sandbox.path);
        expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
        const report = doctorReport(session, undefined);
        expect(report.submodules).toStrictEqual([path]);
        expect(doctorText(report).split(`submodule  ${path} (contents are not read)`)).toHaveLength(2);
        const expected = git(sandbox.path, ['write-tree']);
        const source = kind === 'index' ? { kind } : { kind, object: git(sandbox.path, ['rev-parse', 'HEAD']) };
        await withRevisionSnapshot(sandbox.path, source, async (snapshot, tree) => {
            expect(tree).toBe(expected);
            expect(git(snapshot, ['write-tree'])).toBe(expected);
            expect(readdirSync(join(snapshot, path))).toStrictEqual([]);
            expect(await Bun.file(join(snapshot, 'source.txt')).text()).toBe('selected source');
            expect(submodulePaths(snapshot)).toStrictEqual([path]);
        });
        expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{');
        expect(await Bun.file(join(outside.path, 'source.txt')).text()).toBe('outside source');
    },
);

test('nested policies retain repository context with policy-relative index and committed paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'outside.txt': 'repository context',
        'nested policy/source.txt': 'committed',
    });
    const project = join(sandbox.path, 'nested policy');
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Fixture']);
    const base = git(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'pushed');
    await Bun.write(join(sandbox.path, 'outside.txt'), 'changed context');
    git(sandbox.path, ['add', '.']);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Change']);
    const object = git(sandbox.path, ['rev-parse', 'HEAD']);
    await Bun.write(join(project, 'source.txt'), 'indexed');
    git(sandbox.path, ['add', '.']);
    await Bun.write(join(project, 'source.txt'), 'working');
    expect((await committedEntries(project)).map((entry) => entry.path)).toStrictEqual(['source.txt']);
    expect((await gitEntries(project, { kind: 'index' })).map((entry) => entry.path)).toStrictEqual(['source.txt']);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', object } as const]) {
        await withRevisionSnapshot(project, source, async (snapshot, tree) => {
            expect(await Bun.file(join(snapshot, 'source.txt')).text()).toBe(
                source.kind === 'index' ? 'indexed' : 'pushed',
            );
            expect(await Bun.file(join(snapshot, '..', 'outside.txt')).text()).toBe('changed context');
            expect(git(snapshot, ['write-tree'])).toBe(tree);
        });
    }
    const protocol = `refs/heads/main ${object} refs/heads/main ${base}\n`;
    expect((await pushedRevisions(project, protocol)).revisions[0]?.paths).toStrictEqual(['source.txt']);
    git(sandbox.path, ['config', 'remote.example.fetch', '+refs/heads/*:refs/remotes/example/*']);
    git(sandbox.path, ['update-ref', 'refs/remotes/example/main', base]);
    const newRef = `refs/heads/new ${object} refs/heads/new ${'0'.repeat(object.length)}\n`;
    expect((await pushedRevisions(project, newRef, 'example')).revisions[0]?.paths).toStrictEqual(['source.txt']);
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('working');
});

test('unborn history is empty and committed blobs retain unusual filenames and bytes', async () => {
    await using sandbox = await testdir();
    git(sandbox.path, ['init']);
    expect(await committedEntries(sandbox.path)).toStrictEqual([]);
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    git(sandbox.path, ['add', '.']);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Fixture']);
    const entries = await committedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toStrictEqual([path]);
    const blobs = await gitBlobs(
        sandbox.path,
        entries.map((entry) => entry.object),
    );
    expect(blobs.get(entries[0]!.object)?.toString()).toBe('select 1;\n');
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, path)).text()).toBe('select 1;\n');
    });
    writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
    await rejects(gitEntries(sandbox.path, { kind: 'index' }), { message: /Cannot read the Git index/u });
    writeFileSync(join(sandbox.path, '.git', 'HEAD'), 'broken');
    await rejects(committedEntries(sandbox.path));
});

test('Xcode reports exact staged symlink targets before the first commit and clears corrected files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["xcode"]\n',
        'App.xcodeproj/project.pbxproj': '{}\n',
        'target.swift': 'let value = 1\n',
    });
    const path = 'link\n"é.swift';
    symlinkSync('target.swift', join(sandbox.path, path));
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    unlinkSync(join(sandbox.path, path));
    symlinkSync('working-tree.swift', join(sandbox.path, path));
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'xcode/symlinks')!;
    const input = engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
    expect(await projectSymlinks(input)).toStrictEqual([
        {
            check: 'xcode/symlinks',
            file: path,
            line: 1,
            rule: 'symlink',
            fixable: false,
            message: 'A symlink to target.swift; Xcode and the checks each follow it their own way.',
        },
    ]);
    unlinkSync(join(sandbox.path, path));
    writeFileSync(join(sandbox.path, path), 'let value = 1\n');
    git(sandbox.path, ['add', '.']);
    expect(await projectSymlinks(input)).toStrictEqual([
        expect.objectContaining({ file: path, message: 'A symlink to target.swift; Xcode and the checks each follow it their own way.' }),
    ]);
    input.observations = { root: sandbox.path, sources: new Map() };
    expect(await projectSymlinks(input)).toStrictEqual([]);
    const index = readFileSync(join(sandbox.path, '.git', 'index'));
    writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
    input.observations = { root: sandbox.path, sources: new Map() };
    await rejects(projectSymlinks(input), { message: /Cannot read the Git index/u });
    writeFileSync(join(sandbox.path, '.git', 'index'), index);
    input.observations = { root: sandbox.path, sources: new Map() };
    expect(await projectSymlinks(input)).toStrictEqual([]);
    expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('let value = 1\n');
});

const sourceProject = (path: string): string => `{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = G; targets = (T,); };
        G = {isa = PBXGroup; children = (F,); sourceTree = "<group>"; };
        F = {isa = PBXFileReference; path = "${path}"; sourceTree = "<group>"; };
        B = {isa = PBXBuildFile; fileRef = F; };
        S = {isa = PBXSourcesBuildPhase; files = (B,); };
        T = {isa = PBXNativeTarget; buildPhases = (S,); };
    };
}`;

test('Xcode source membership does not mix independent nested projects', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["xcode"]\n[[scope]]\npath = "nested"\nconfigurations = ["xcode"]\n',
        'Root.xcodeproj/project.pbxproj': sourceProject('Root.swift'),
        'Root.swift': 'let root = 1\n',
        'nested/Nested.xcodeproj/project.pbxproj': sourceProject('Nested.swift'),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let extra = 1\n',
    });
    const session = await openSession(sandbox.path);
    for (const selected of session.scopes) {
        const spec = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/orphan-sources')!;
        const findings = await orphanSources(
            engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === selected.scope.path)!,
                spec: spec,
                files: session.repository.files,
            }),
        );
        expect(findings).toStrictEqual(
            selected.scope.path === ''
                ? []
                : [
                      {
                          check: 'xcode/orphan-sources',
                          file: 'nested/Extra.swift',
                          line: 1,
                          rule: 'no-target',
                          fixable: false,
                          message: 'This Swift file is in no target of the project.',
                      },
                  ],
        );
    }
});

test('staged snapshots copy all workspace dependency trees before validating cross-tree links', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        'bun.lock': '{}',
        'packages/one/package.json': '{"name":"one"}',
        'packages/two/package.json': '{"name":"two"}',
        'node_modules/root/value.js': 'export const value = 1;',
        'packages/two/node_modules/owned/value.js': 'export const value = 2;',
        '.gitignore': 'node_modules/\n',
    });
    symlinkSync('../packages/two/node_modules/owned', join(sandbox.path, 'node_modules/owned'));
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/owned/value.js')).text()).toContain('value = 2');
        await Bun.write(join(snapshot, 'node_modules/owned/value.js'), 'snapshot change');
    });
    expect(await Bun.file(join(sandbox.path, 'packages/two/node_modules/owned/value.js')).text()).toContain(
        'value = 2',
    );
    unlinkSync(join(sandbox.path, 'node_modules/owned'));
    symlinkSync(sandbox.path, join(sandbox.path, 'node_modules/owned'));
    await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'external link',
    );
});

test('revision dependencies reject external manifest and installation links before copying', async () => {
    await using sandbox = await testdir();
    await using external = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{}',
        'bun.lock': '{}',
        '.gitignore': 'node_modules/\n',
        'node_modules/example/index.js': 'export const value = 1;',
    });
    await createFileTree(external.path, { 'package.json': '{}', 'private.txt': 'outside bytes' });
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    unlinkSync(join(sandbox.path, 'package.json'));
    symlinkSync(join(external.path, 'package.json'), join(sandbox.path, 'package.json'));
    await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'Source link leaves',
    );
    unlinkSync(join(sandbox.path, 'package.json'));
    await Bun.write(join(sandbox.path, 'package.json'), '{}');
    symlinkSync(external.path, join(sandbox.path, 'node_modules/external'));
    await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'external link',
    );
    unlinkSync(join(sandbox.path, 'node_modules/external'));
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, 'node_modules/example/index.js')).text()).toContain('value = 1');
    });
    expect(await Bun.file(join(external.path, 'private.txt')).text()).toBe('outside bytes');
});

test('a nested revision refuses its incomplete managed dependency installation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/.gspot/package.json': '{}',
        'project/.gspot/bun.lock': '{}',
        'project/.gspot/node_modules/example/index.js': 'export const value = 1;',
        '.gitignore': 'node_modules/\n.gspot/state/ownership.json\n.gspot/state/recovery/\n',
    });
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, 'project');
    withLifecycleOwner(project, (owner) => {
        owner.beginInstallation('npm');
    });
    await expect(withRevisionSnapshot(project, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'Tool installation is incomplete',
    );
    withLifecycleOwner(project, (owner) => {
        owner.finishInstallation('npm');
    });
    await withRevisionSnapshot(project, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, '.gspot/node_modules/example/index.js')).text()).toContain('value = 1');
    });
});

test.each(['', 'nested/'])('revision prose checks reuse verified installed packages under %s', async (prefix) => {
    await using sandbox = await testdir();
    const config = `${prefix}.gspot/config/vale.ini`;
    await createFileTree(sandbox.path, {
        [config]: 'StylesPath = vale/styles\nPackages = Example\n',
        '.gitignore': '.gspot/state/ownership.json\n.gspot/state/recovery/\n.gspot/config/vale/styles/Example/\n',
    });
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    const project = join(sandbox.path, prefix);
    const packagePath = '.gspot/config/vale/styles/Example/rule.yml';
    withLifecycleOwner(project, (owner) => {
        owner.replace(packagePath, { bytes: Buffer.from('extends: existence\n'), mode: 0o644 }, 'config');
    });
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        const copied = join(snapshot, prefix, packagePath);
        expect(await Bun.file(copied).text()).toBe('extends: existence\n');
        await Bun.write(copied, 'snapshot-only edit');
    });
    expect(await Bun.file(join(project, packagePath)).text()).toBe('extends: existence\n');
    await Bun.write(join(sandbox.path, config), 'Packages = Different\n');
    await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'do not match the revision configuration',
    );
    await Bun.write(join(sandbox.path, config), 'StylesPath = vale/styles\nPackages = Example\n');
    await Bun.write(join(project, packagePath), 'edited package');
    await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => undefined)).rejects.toThrow(
        'missing or edited',
    );
});

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

test.each([false, true])(
    'a Windows snapshot relocates a Distlib launcher with quoted path %s without changing its payload',
    async (quoted) => {
        await using repository = await testdir();
        const root = join(repository.path, "Windows author's project");
        const prefix = Buffer.from('MZ\u0000native executable bytes\u0000');
        const payload = Buffer.from('PK\u0003\u0004binary script payload\u0000\u00FF', 'latin1');
        const interpreter = join(root, '.venv/Scripts/python.exe');
        const header = `#!${quoted ? `"${interpreter}"` : interpreter}\n`;
        const launcher = Buffer.concat([prefix, Buffer.from(header), payload]);
        await createFileTree(root, {
            '.gitignore': '.venv/\n',
            'pyproject.toml': '[project]\nname = "fixture"\nversion = "0.0.0"\n',
            'source.py': 'selected = True\n',
            'uv.lock': 'version = 1\n',
            '.venv/pyvenv.cfg': `home = ${repository.path}\nversion_info = 3.12.2\ninclude-system-site-packages = false\n`,
            '.venv/Scripts/python.exe': 'MZinterpreter',
            '.venv/Scripts/check.exe': launcher,
            '.venv/Lib/site-packages/source.pth': `${root}\n`,
        });
        git(root, ['init', '-q']);
        git(root, ['add', '.']);
        await withRevisionSnapshot(root, { kind: 'index' }, async (snapshot) => {
            const relocated = readFileSync(join(snapshot, '.venv/Scripts/check.exe'));
            expect(relocated).toStrictEqual(
                Buffer.concat([prefix, Buffer.from(`#!"${join(snapshot, '.venv/Scripts/python.exe')}"\n`), payload]),
            );
            expect(readFileSync(join(snapshot, '.venv/Lib/site-packages/source.pth'), 'utf8')).toBe(`${snapshot}\n`);
            expect(readFileSync(join(snapshot, '.venv/Scripts/python.exe'), 'utf8')).toBe('MZinterpreter');
        });
        expect(readFileSync(join(root, '.venv/Scripts/check.exe'))).toStrictEqual(launcher);
        expect(readFileSync(join(root, '.venv/Lib/site-packages/source.pth'), 'utf8')).toBe(`${root}\n`);
    },
);

test('cancellation drains dependency copies before removing the snapshot and preserves installed files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.gitignore': 'node_modules/\n',
        'package.json': '{"name":"fixture","version":"1.0.0"}\n',
        'package-lock.json': '{"name":"fixture","lockfileVersion":3,"packages":{}}\n',
        'source.js': 'export const value = 1;\n',
        ...Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`node_modules/item-${index}/value.js`, 'export const value = 2;\n'])),
    });
    git(sandbox.path, ['init', '-q']);
    git(sandbox.path, ['add', '-A']);
    const controller = new AbortController();
    const original = promises.cp;
    let pending = 0;
    let destination: string | undefined;
    let entered = false;
    const copy = spyOn(promises, 'cp').mockImplementation(async (...args) => {
        pending += 1;
        if (typeof args[1] === 'string') destination = dirname(dirname(args[1]));
        try {
            await original(...args);
            controller.abort(new Error('Canceled dependency copy'));
        } finally {
            pending -= 1;
        }
    });
    try {
        await expect(withRevisionSnapshot(sandbox.path, { kind: 'index' }, async () => {
            entered = true;
        }, controller.signal)).rejects.toThrow('Canceled dependency copy');
        expect(pending).toBe(0);
        expect(entered).toBe(false);
        expect(destination).toBeDefined();
        expect(existsSync(destination!)).toBe(false);
        expect(readFileSync(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe('export const value = 2;\n');
    } finally {
        copy.mockRestore();
    }
});
