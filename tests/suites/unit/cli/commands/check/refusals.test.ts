import * as os from 'node:os';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import type { CommandFailureJson } from '#cli/types/system.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { limitCommand, runBlockingCommand } from '#tests/setup/system/processes.ts';
import { FIX_REFUSALS, ARGUMENT_REFUSALS, PUSH_INPUT_REFUSALS } from '#tests/config/commands/check.ts';

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

test('--only names the configuration that an unselected check needs', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['check', '--only', 'python/ruff', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: 'python/ruff belongs to python, which no scope selects. Run gspot add python.',
    });
});

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

test('a staged check after apply names the setup files that are not staged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '--', 'source.sh', 'gspot.toml']);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'git',
        message: '.gspot/ is not staged. Stage gspot.toml and .gspot/.',
    });
});

test('a staged check during a merge conflict exits 2, names the conflict, and leaves no copy behind', async () => {
    await using sandbox = await createFixableSandbox();
    runGitStep(sandbox.path, ['checkout', '-qb', 'other']);
    await writeFile(join(sandbox.path, 'source.txt'), 'other\n');
    runGitStep(sandbox.path, ['commit', '-qam', 'Other']);
    runGitStep(sandbox.path, ['checkout', '-q', '-']);
    await writeFile(join(sandbox.path, 'source.txt'), 'main\n');
    runGitStep(sandbox.path, ['commit', '-qam', 'Main']);
    expect(runBlockingCommand(['git', 'merge', '-q', 'other'], { cwd: sandbox.path, env: {} }).code).toBe(1);
    await using temporary = await testdir();
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporary.path);
    const refused = await runGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toBe(
        'source.txt has unresolved merge conflicts. Resolve them with git add or git rm, then check again.',
    );
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test('a staged check reports a file name that is not UTF-8 and leaves no copy behind', async () => {
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
    expect(refused.code, refused.stdout + refused.stderr).toBe(1);
    const { report } = parseCheckReport(refused);
    const encoding = report.checks.find(({ check }) => check === 'repository/encoding');
    expect(encoding?.help).toBe('Save the reported file as UTF-8, then run the check again.');
    expect(encoding?.findings).toStrictEqual([
        {
            check: 'repository/encoding',
            file: String.raw`"bad-\377.txt"`,
            line: 1,
            rule: 'path-encoding',
            explain: 'gspot explain repository/encoding',
            message: String.raw`"bad-\377.txt" is not a UTF-8 path. Rename the file using UTF-8.`,
            fixable: false,
        },
    ]);
    expect(await readdir(temporary.path)).toStrictEqual([]);
});

test.each([...ARGUMENT_REFUSALS])(
    'check with %s exits 2 and names the refused argument',
    async (_, commandArguments, expected) => {
        await using sandbox = await createFixableSandbox();
        const refused = await runGspot(sandbox.path, [...commandArguments]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout + refused.stderr).toBe(`${expected}\n`);
    },
);

test('a linked .gspot folder fails check, and nothing outside changes', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'project/storage',
                paths: ['source.txt'],
                stage: 'commit',
                command: buildProgramCommand('fakes/tool', '--stdout', 'Exact finding\n', '--exit', '1'),
                output: { format: 'regex', pattern: '(?<message>.+)' },
            },
        ],
    });
    await using sandbox = await testdir({
        'project/source.txt': 'input\n',
        'project/gspot.toml': buildSandboxSettings([], { tables }),
        'outside/sentinel': 'authored outside\n',
    });
    const project = join(sandbox.path, 'project');
    runGitStep(project, ['init', '--quiet']);
    const outside = join(sandbox.path, 'outside');
    await symlink(outside, join(project, GSPOT_FOLDER));
    const refused = await runGspot(project, ['check', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(await readdir(outside)).toStrictEqual(['sentinel']);
});
