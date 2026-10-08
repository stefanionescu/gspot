// What init refuses before it writes, and what a preview proposes without writing.
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { symlink, readFile } from 'node:fs/promises';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { QUIET, PREVIEW, GIT_PLAN_CASES, UNSAFE_SCOPE_CASES } from '#tests/config/cli/commands/init/refusals.ts';

test('a preview writes nothing and prints parseable JSON', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const json = await runGspot(sandbox.path, PREVIEW);
    expect(json.code, json.stdout + json.stderr).toBe(0);
    expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test.each([
    ['a choice outside its list', ['init', '--yes', '--ci', 'foo']],
    ['an unknown configuration', ['init', '--yes', '--configurations', 'bassh', ...QUIET]],
    ['an unknown hook', ['check', '--hook', 'later']],
])('%s exits 2 and writes nothing', async (_name, argv) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, argv);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('uncommitted changes stop init until they are committed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'notes.txt'), 'draft\n');
    const argv = ['init', '--yes', '--configurations', 'none', '--no-hooks', ...QUIET];
    const before = await readTree(sandbox.path);
    const diagnostic =
        'The working tree has 1 uncommitted change(s). Commit or stash them before gspot init: Git then keeps every file init replaces, and you review its changes separately.';
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${diagnostic}\n`);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'policy', message: diagnostic });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    commitAll(sandbox.path);
    const allowed = await runGspot(sandbox.path, argv);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(true);
});

test('failed Git status stops initialization with a selection error before writing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const run = processes.runBlocking;
    using boundary = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] !== 'git' || command[1] !== 'status' || command[2] !== '--porcelain')
            return run(command, options);
        return { code: 7, missing: false, duration: 0, stdout: '', stderr: 'status unavailable\n' };
    });
    const argv = ['init', '--yes', '--configurations', 'none', ...QUIET];
    const human = await runGspot(sandbox.path, argv);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Git status failed (exit 7): status unavailable\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'selection',
        message: 'Git status failed (exit 7): status unavailable',
    });
    expect(boundary).toHaveBeenCalledWith(
        ['git', 'status', '--porcelain'],
        expect.objectContaining({ cwd: sandbox.path }),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init refuses an invalid manifest before writing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{', 'source.ts': 'export {};\n' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--no-hooks', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init in a repository that already has gspot.toml exits 2 and changes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["bash"]\n',
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--yes', '--json', ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'already-initialized',
        message: textContaining('gspot doctor'),
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('init from a template address that answers 404 exits 2 and writes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    using fetched = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    const result = await runGspot(sandbox.path, ['init', '--yes', '--from', 'github:acme/missing', ...QUIET]);
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('answered 404');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('JSON initialization without --yes reports the argument before reading invalid project input', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{' });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'prompt', message: textContaining('--yes') });
    expect(result.stdout).not.toContain('package.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(GIT_PLAN_CASES)('initialization in $name previews only applicable Git changes', async ({ hasGit }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    if (hasGit) commitAll(sandbox.path);
    const argv = ['init', '--yes', '--configurations', 'none', ...QUIET, '--json'];
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, [...argv, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    const report = JSON.parse(preview.stdout) as Required<Pick<InitJson, 'plan' | 'policy'>>;
    const changes = report.plan.change.map((entry) => entry.path);
    expect(changes.includes('.gitignore')).toBe(hasGit);
    expect(changes.includes('.gspot/hooks')).toBe(hasGit);
    expect(changes).toContain('.gitattributes');
    expect(parseStrictPolicy(report.policy).hooks).toBeDefined();
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gitignore'))).toBe(hasGit);
    expect(await pathExists(join(sandbox.path, '.gitattributes'))).toBe(true);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});

test('initialization without a terminal names --yes once and writes only after explicit acceptance', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'control.txt': 'preserve this source\n' });
    const argv = ['init', '--configurations', 'none', '--no-hooks', ...QUIET];
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe('Continue? There is no terminal to ask in. Pass --yes to accept the plan.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const accepted = await runGspot(sandbox.path, [...argv, '--yes']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(true);
    expect(await Bun.file(join(sandbox.path, 'control.txt')).text()).toBe('preserve this source\n');
});

test.each(UNSAFE_SCOPE_CASES)(
    'init refuses unsafe or absent scope $scope before publication',
    async ({ scope, diagnostic }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/README.md': 'project\n',
            'outside/nested/keep.txt': 'original\n',
        });
        const root = join(directory.path, 'project');
        await symlink('../outside', join(root, 'linked'));
        const options = buildInitOptions(root, {
            configurations: ['none'],
            scopes: new Map([[scope, []]]),
        });
        expect(await rejection(initCommand(options))).toContain(diagnostic);
        expect(await pathExists(join(root, 'gspot.toml'))).toBe(false);
        expect(await pathExists(join(root, '.gspot'))).toBe(false);
        expect(await readFile(join(directory.path, 'outside/nested/keep.txt'), 'utf8')).toBe('original\n');
    },
);

test('init refuses an unsafe output ancestor before attempting installation', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'authored.toml': 'untouched = true\n' });
    await createFileTree(sandbox.path, { 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    await symlink(outside.path, join(sandbox.path, '.mise'));
    await rejection(
        initCommand(
            buildInitOptions(sandbox.path, {
                configurations: ['spelling'],
                runner: 'mise',
                install: true,
            }),
        ),
    );
    expect(await readFile(join(outside.path, 'authored.toml'), 'utf8')).toBe('untouched = true\n');
    expect(await pathExists(join(outside.path, 'conf.d/gspot-tools.toml'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(
        '[default.extend-words]\nAuthored = "Authored"\n',
    );
});

test('init retains old configuration when a conflicting replacement cannot be published', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    const conflict = '# Maintained independently.\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored, '.gspot/config/typos.toml': conflict });
    expect(
        await rejection(
            initCommand(
                buildInitOptions(sandbox.path, {
                    configurations: ['spelling'],
                }),
            ),
        ),
    ).toContain('These files were not overwritten by gspot: .gspot/config/typos.toml.');
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(await readFile(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
});
