import * as promises from 'node:fs/promises';
import { expect, spyOn, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { pushedRevisions } from '#cli/repository/staged.ts';
import { submodulePaths } from '#cli/repository/tracked.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { doctorReport, doctorText } from '#cli/commands/doctor/report.ts';
import { orphanSources, projectSymlinks } from '#cli/checks/xcode/project.ts';
import { committedEntries, gitBlobs, gitEntries, withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

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
        expect.objectContaining({
            file: path,
            message: 'A symlink to target.swift; Xcode and the checks each follow it their own way.',
        }),
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
        ...Object.fromEntries(
            Array.from({ length: 24 }, (_, index) => [
                `node_modules/item-${index}/value.js`,
                'export const value = 2;\n',
            ]),
        ),
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
        await expect(
            withRevisionSnapshot(
                sandbox.path,
                { kind: 'index' },
                async () => {
                    entered = true;
                },
                controller.signal,
            ),
        ).rejects.toThrow('Canceled dependency copy');
        expect(pending).toBe(0);
        expect(entered).toBe(false);
        expect(destination).toBeDefined();
        expect(existsSync(destination!)).toBe(false);
        expect(readFileSync(join(sandbox.path, 'node_modules/item-0/value.js'), 'utf8')).toBe(
            'export const value = 2;\n',
        );
    } finally {
        copy.mockRestore();
    }
});
