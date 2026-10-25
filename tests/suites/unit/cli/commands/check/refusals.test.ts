import * as os from 'node:os';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readTree } from '#tests/setup/system/files.ts';
import { PIN_MESSAGE } from '#tests/config/version-pin.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import { limitCommand } from '#tests/setup/system/processes.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runGit, commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { FIX_REFUSALS, ARGUMENT_REFUSALS, PUSH_INPUT_REFUSALS } from '#tests/config/commands/check/refusals.ts';

async function createFixableSandbox(): Promise<Awaited<ReturnType<typeof testdir>>> {
    const fix = buildProgramCommand('fakes/tool', '--text', 'fixed\n', 'source.txt');
    const check = {
        id: 'sandbox/fixable',
        command: buildProgramCommand('fakes/tool'),
        fix,
        paths: ['source.txt'],
        stage: 'commit',
    };
    const sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [check] }) }),
        'source.txt': 'original\n',
    });

    commitAll(sandbox.path);
    return sandbox;
}

test('check refuses the commitlint check outside the commit-msg hook and names the hook command', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['commits']) });
    commitAll(sandbox.path);
    const refused = await runGspot(sandbox.path, ['check', '--only', 'commits/commitlint']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr.trim()).toBe(
        'commits/commitlint checks commit messages. Run gspot check --hook commit-msg -- <file>.',
    );
});

test('--only refuses a check disabled by the selected level', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: 'docs/required-files is off at level recommended. Run gspot set level all to turn it on.',
    });
});

test('--only names the configuration that an unselected check needs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['check', '--only', 'python/ruff', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        error: 'arguments',
        message: 'python/ruff belongs to python, which no scope selects. Run gspot add python.',
    });
});

test.each(['--changed', '--staged', '--hook'])(
    'check %s outside Git exits 2 with a git error and changes nothing',
    async (flag) => {
        await using sandbox = await testdir();
        const settings = stringify({
            configurations: [],
            command_check: [
                { id: 'sandbox/paths', command: buildProgramCommand('fakes/tool'), paths: ['api/**'], stage: 'commit' },
            ],
        });
        await createFileTree(sandbox.path, { 'gspot.toml': settings, 'api/source.txt': 'before' });
        const result = await runGspot(sandbox.path, [
            'check',
            flag,
            ...(flag === '--hook' ? ['pre-push'] : []),
            '--json',
        ]);
        expect(result.code).toBe(2);
        expect(JSON.parse(result.stdout)).toStrictEqual({
            error: 'git',
            message: 'gspot needs a Git repository. Run git init, then gspot init.',
        });
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
        expect(await readFile(join(sandbox.path, 'api/source.txt'), 'utf8')).toBe('before');
    },
);

test.each([...FIX_REFUSALS])('check %p exits 2 and leaves the working tree as it was', async (flags, expected) => {
    await using sandbox = await createFixableSandbox();
    const refused = await runGspot(sandbox.path, ['check', ...flags, '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toBe(expected);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
    expect(runGitStep(sandbox.path, ['status', '--porcelain'])).toBe('');
});

test.each([...PUSH_INPUT_REFUSALS])(
    'a pre-push check given $name exits 2 and leaves the working tree as it was',
    async ({ stdin, message }) => {
        await using sandbox = await createFixableSandbox();
        const refused = await runGspot(
            sandbox.path,
            ['check', '--hook', 'pre-push', '--', 'origin', 'unused'],
            {},
            { stdin: typeof stdin === 'string' ? stdin : Buffer.from(stdin) },
        );
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original\n');
        expect(runGitStep(sandbox.path, ['status', '--porcelain'])).toBe('');
    },
);

test('a staged check during a merge conflict exits 2, names the conflict, and leaves no copy behind', async () => {
    await using sandbox = await createFixableSandbox();
    runGitStep(sandbox.path, ['checkout', '-qb', 'other']);
    await writeFile(join(sandbox.path, 'source.txt'), 'other\n');
    runGitStep(sandbox.path, ['commit', '-qam', 'Other']);
    runGitStep(sandbox.path, ['checkout', '-q', '-']);
    await writeFile(join(sandbox.path, 'source.txt'), 'main\n');
    runGitStep(sandbox.path, ['commit', '-qam', 'Main']);
    expect(runGit(sandbox.path, ['merge', '-q', 'other']).code).toBe(1);
    await using temporary = await testdir();
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toBe(
        'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.',
    );
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test('a staged check over a file name that is not UTF-8 exits 2 and leaves no copy behind', async () => {
    await using sandbox = await createFixableSandbox();
    const hash = runGitStep(sandbox.path, ['rev-parse', 'HEAD:source.txt']);
    const name = Buffer.concat([Buffer.from('bad-'), Buffer.from([0xff]), Buffer.from('.txt')]);
    const line = Buffer.concat([Buffer.from(`100644 ${hash}\t`), name, Buffer.from('\n')]);
    const command = ['git', 'update-index', '--index-info'];
    const limited = limitCommand(command, { cwd: sandbox.path });
    const indexed = Bun.spawn(command, {
        cwd: sandbox.path,
        stdin: line,
        stderr: 'pipe',
        timeout: Math.ceil(limited.options.timeoutSeconds * MILLISECONDS_PER_SECOND),
    });
    expect(await indexed.exited, await new Response(indexed.stderr).text()).toBe(0);
    await using temporary = await testdir();
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toBe(
        'Git listed a path that is not valid UTF-8.',
    );
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test.each([...ARGUMENT_REFUSALS])(
    'check with %s exits 2 and names the problem',
    async (_, commandArguments, expected) => {
        await using sandbox = await createFixableSandbox();
        const refused = await runGspot(sandbox.path, [...commandArguments]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout + refused.stderr).toBe(`${expected}\n`);
    },
);

test('check reports an unreadable message file as a filesystem error and writes nothing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['commits']) });
    const before = await readTree(sandbox.path);
    const message = `gspot cannot read the commit message file ${join(sandbox.path, 'missing-message.txt')}.`;
    const human = await runGspot(sandbox.path, ['check', '--hook', 'commit-msg', '--', 'missing-message.txt']);
    expect(human.code).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe(`${message}\n`);
    const structured = await runGspot(sandbox.path, [
        'check',
        '--json',
        '--hook',
        'commit-msg',
        '--',
        'missing-message.txt',
    ]);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'filesystem', message });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
test('a linked .gspot folder stops check, and nothing outside changes', async () => {
    await using sandbox = await testdir({
        'project/source.txt': 'input\n',
        'project/gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/storage',
                        paths: ['source.txt'],
                        stage: 'commit',
                        command: buildProgramCommand('fakes/tool', '--stdout', 'Exact finding\n', '--exit', '1'),
                        output: { format: 'lines' },
                    },
                ],
            }),
        }),
        'outside/sentinel': 'authored outside\n',
    });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, DOT_GSPOT));
    const refused = await runGspot(project, ['check', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toStrictEqual({
        error: 'filesystem',
        message: 'A parent of .gspot/version is a link or is not a folder. Choose a folder without links.',
    });
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
});

test('a different saved version blocks checks and fixes until apply updates the pin', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'script.sh': CLEAN_BASH_SCRIPT,
    });
    const firstApply = await runGspot(sandbox.path, ['apply', '--json']);
    expect(firstApply.code, firstApply.stdout + firstApply.stderr).toBe(0);
    await writeFile(join(sandbox.path, GSPOT_PATHS.versionPin), '9.9.9\n');
    const check = await runGspot(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
    expect(check.code, check.stdout + check.stderr).toBe(2);
    expect(check.stderr).toBe('');
    const failure = JSON.parse(check.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({ error: 'pin', message: PIN_MESSAGE });
    const fixed = await runGspot(sandbox.path, ['check', '--fix', '--only', 'bash/safety', '--json']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(2);
    expect(JSON.parse(fixed.stdout) as CommandFailureJson).toStrictEqual(failure);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(readVersionPin(sandbox.path)).toBe(cliPackage.version);
});

test('an empty version pin lets checks run', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'script.sh': CLEAN_BASH_SCRIPT,
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await writeFile(join(sandbox.path, GSPOT_PATHS.versionPin), '');
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'bash/safety', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/safety', status: 'passed' },
    ]);
});
