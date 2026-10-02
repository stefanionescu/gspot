import * as fs from 'node:fs';
import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { test, spyOn, expect } from 'bun:test';
import { TYPO } from '#tests/harness/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { initOptions } from '#tests/harness/planted/init.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { PRETTIER_TOOLING } from '#tests/harness/cli/tooling.ts';
import { askInitQuestions } from '#cli/commands/init/questions.ts';
import { rejection, containingAll } from '#tests/harness/expectations.ts';
import { existsSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';

const { version: GSPOT_VERSION } = packageManifest;

test.each([
    [
        'tracked GitLab before GitHub',
        ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        '',
        'git@github.com:example/repo.git',
        'gitlab',
    ],
    ['untracked GitLab before remote', [], '.gitlab-ci.yml', 'git@github.com:example/repo.git', 'gitlab'],
    ['Bitbucket before GitHub remote', ['bitbucket-pipelines.yml'], '', 'git@github.com:example/repo.git', 'none'],
    ['GitHub SSH remote', [], '', 'git@github.com:example/repo.git', 'github'],
    ['unrecognized remote host', [], '', 'https://github.com.example.com/example/repo.git', 'none'],
] as const)('initialization CI preference uses %s', async (_label, ci, path, remote, expected) => {
    await using sandbox = await testdir();
    if (path !== '') await createFileTree(sandbox.path, { [path]: '{}\n' });
    expect(processes.runBlocking(['git', 'init'], { cwd: sandbox.path }).code).toBe(0);
    expect(processes.runBlocking(['git', 'config', 'remote.origin.url', remote], { cwd: sandbox.path }).code).toBe(0);
    const answers = await askInitQuestions(
        sandbox.path,
        initOptions(sandbox.path, { isDryRun: true, hooks: 'none', runner: 'none', rules: 'no' }),
        { ...PRETTIER_TOOLING, ci: [...ci] },
    );
    expect(answers).toStrictEqual({ hooks: 'none', runner: 'none', isRules: false, ci: expected });
});

test('init replaces a nested spelling configuration and deletes the original', async () => {
    await using directory = await testdir();
    const original = `[default]\nlocale = "en-gb"\n[default.extend-words]\n${TYPO.the} = "${TYPO.the}"\n`;
    await createFileTree(directory.path, {
        'nested/typos.toml': original,
        'nested/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
    });
    const options = initOptions(directory.path, {
        isDryRun: true,
        kits: ['spelling'],
        isListExact: true,
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
    });
    const preview = await initCommand(options);
    expect(preview.exitCode).toBe(0);
    expect(preview.json).toMatchObject({
        plan: {
            remove: containingAll([
                { path: 'nested/typos.toml', note: 'replaced by the generated typos configuration' },
            ]),
        },
    });
    expect(readFileSync(join(directory.path, 'nested/typos.toml'), 'utf8')).toBe(original);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
    const installed = await initCommand({ ...options, isDryRun: false });
    expect(installed.exitCode).toBe(0);
    expect(existsSync(join(directory.path, '.gitignore'))).toBe(false);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).not.toContain('en-gb');
    expect(existsSync(join(directory.path, 'nested/typos.toml'))).toBe(false);
});

test('init reports each submodule once without reading its contents', async () => {
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    const execute = (args: string[]) => {
        const result = processes.runBlocking(['git', ...args], { cwd: directory.path });
        expect(result.code, result.stderr).toBe(0);
        return result.stdout.trim();
    };
    execute(['init']);
    execute(['add', '.']);
    execute(['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-qm', 'Source']);
    const commitId = execute(['rev-parse', 'HEAD']);
    execute(['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    symlinkSync(outside.path, join(directory.path, 'external project'), 'dir');
    const result = await initCommand(
        initOptions(directory.path, {
            isDryRun: true,
            kits: ['none'],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
        }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; contents are not read' }] },
    });
    expect(readFileSync(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
});

test('failed initialization retains the previous pin until generated publication recovers', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/version': '0.0.1\n' });
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(directory.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });
    try {
        expect(
            await rejection(
                initCommand(
                    initOptions(directory.path, {
                        kits: ['none'],
                        hooks: 'none',
                        runner: 'none',
                        ci: 'none',
                        rules: 'no',
                    }),
                ),
            ),
        ).toContain('Generated write denied');
        expect(readFileSync(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(join(directory.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
});

test('init refuses a failed Git status before writing and succeeds after the failure is corrected', async () => {
    await using directory = await testdir();
    expect(processes.runBlocking(['git', 'init'], { cwd: directory.path }).code).toBe(0);
    const options = initOptions(directory.path, {
        kits: ['none'],
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
    });
    const execute = processes.runBlocking;
    const failed = spyOn(processes, 'runBlocking').mockImplementation((command, settings) =>
        command[1] === 'status'
            ? { code: 128, stdout: '', stderr: 'Cannot read the Git index.', missing: false, duration: 0 }
            : execute(command, settings),
    );
    try {
        await rejects(initCommand(options), {
            message: /Cannot read the Git index/u,
        });
        expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
    } finally {
        failed.mockRestore();
    }
    const corrected = await initCommand(options);
    expect(corrected.exitCode).toBe(0);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(true);
});

test.each(['../outside', 'linked', 'missing'])(
    'init refuses unsafe or absent scope %s before publication',
    async (scope) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/README.md': 'project\n',
            'outside/nested/keep.txt': 'original\n',
        });
        const root = join(directory.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const options = initOptions(root, {
            kits: ['none'],
            scopes: [`${scope}=`],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
        });
        await rejects(initCommand(options), {
            message: /Unsafe lifecycle|Scope directory does not exist/u,
        });
        expect(existsSync(join(root, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(root, '.gspot'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside/nested/keep.txt'), 'utf8')).toBe('original\n');
        unlinkSync(join(root, 'linked'));
        await createFileTree(root, { 'src/keep.txt': 'inside\n' });
        const corrected = await initCommand({ ...options, scopes: ['src='] });
        expect(corrected.exitCode).toBe(0);
        expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toContain('path = "src"');
    },
);
