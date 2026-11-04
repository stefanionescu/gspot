import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { runFixers } from '#cli/engine/fixes.ts';
import { stringify } from '@decimalturn/toml-patch';
import * as manifests from '#cli/manifests/read.ts';
import { openSession } from '#cli/engine/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { formatFixes } from '#cli/commands/check/report.ts';
import { FIXER_RESULTS } from '#tests/config/engine/run.ts';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { runChecks, buildCheckSession } from '#cli/engine/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { planFixer, buildRunOptions, CHECK_GENERATION, buildFixerSettings } from '#tests/setup/cli/run.ts';

test.each([0])('the fixer tool owns crash detection when exit is %p', async (code) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        buildProgramCommand('fakes/tool', '--stderr', 'Fatal: cannot write\n', '--exit', String(code)),
    );
    planned.check = { ...planned.check, exit_codes: [3] };
    const shipped = manifests.readConfigurations();
    const configuration = shipped.values().next().value!;
    using _configurations = spyOn(manifests, 'readConfigurations').mockReturnValue(
        new Map([
            ...shipped,
            [
                configuration.name,
                { ...configuration, tools: [{ ...planned.tool!, crash_pattern: '^Fatal:' }, ...configuration.tools] },
            ],
        ]),
    );
    planned.tool = { ...planned.tool!, name: 'different-checker', crash_pattern: '^Checker-only:' };
    const failedRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    const failed = failedRun.results[0];
    expect(failed).toMatchObject({
        status: 'failed',
        changed: [],
        note: 'Fatal: cannot write',
    });
    const corrected = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'));
    corrected.tool = planned.tool;
    const correctedResultRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [corrected]);
    const correctedResult = correctedResultRun.results[0];
    expect(correctedResult).toMatchObject({
        status: 'changed',
        changed: ['source.txt'],
    });
});

test.each([...FIXER_RESULTS])(
    '$name classifies $status from the exit code and the bytes it leaves',
    async ({ toolArguments, exit_codes: exitCodes, status, after, note }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

        const session = await openSession(sandbox.path);
        const planned = planFixer(session, buildProgramCommand('fakes/tool', ...toolArguments));
        if (exitCodes !== undefined) planned.check = { ...planned.check, exit_codes: [...exitCodes] };
        const resultRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
        const result = resultRun.results[0];
        expect({ status: result!.status, note: 'note' in result! ? result.note : undefined }).toStrictEqual({
            status,
            note,
        });
        expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(after);
        expect(result!.changed).toStrictEqual(after === 'original' ? [] : ['source.txt']);
    },
);

test('a fixer that swaps one invalid UTF-8 byte for another reports the file as changed', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write-hex', 'source.txt=fe'));
    await writeFile(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const resultRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    const result = resultRun.results[0];
    expect(result).toMatchObject({ status: 'changed', changed: ['source.txt'] });
    expect(await readFile(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('a fixer that deletes an empty file reports it as changed', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': '' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--delete', 'source.txt'));
    const resultRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    const result = resultRun.results[0];
    expect(result).toMatchObject({ status: 'changed', changed: ['source.txt'] });
    expect(existsSync(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('a skipped fixer reports skipped, and a fixer whose program is missing fails', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=wrong'));
    const skippedRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [
        { ...planned, skip: { cause: 'level', note: 'Not selected.' } },
    ]);
    const skipped = skippedRun.results[0]!;
    const failedRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [
        { ...planned, check: { ...planned.check, fix: [join(sandbox.path, 'absent-tool')] } },
    ]);
    const failed = failedRun.results[0]!;
    expect(skipped.status).toBe('skipped');
    expect(failed).toMatchObject({
        status: 'failed',
        note: expect.stringContaining(join(sandbox.path, 'absent-tool')) as string,
    });
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('a fixer runs its own program when the check program is missing', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'));
    const resultRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [
        { ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, kind: 'program' } },
    ]);
    const result = resultRun.results[0]!;
    expect(result.status).toBe('changed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a fix that exits nonzero fails the run even when its check passes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ fix: true, only: ['sandbox/fixer'] }));
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(result.report.exitCode).toBe(2);
    expect(result.report.failed).toStrictEqual(['sandbox/fixer']);
    expect(result.fixes?.results[0]?.status).toBe('failed');
});

test('a failed version check blocks a check and its fix without changing source bytes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=changed'));
    planned.tool = {
        ...buildProgramPin('version-teller', '3.8.1'),
        system: true,
        version_command: buildProgramCommand('fakes/tool', '--line', '3.8.1', '--exit', '7').slice(1),
    };
    planned.check.fix![0] = 'version-teller';
    using _which = fakeExecutableLookup(process.execPath);

    const checked = await runCommandCheck(buildCheckSession(session, CHECK_GENERATION), planned);
    expect(checked.status).toBe('error');
    expect(checked.note).toContain('version-teller');
    expect(checked.note).toContain('3.8.1');
    const fixedRun = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    const fixed = fixedRun.results[0]!;
    expect(fixed.status).toBe('failed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('a fixer that breaks a file with an unstaged edit puts the file back and exits 2', async () => {
    await using sandbox = await createGitSandbox({});
    const tables = stringify({
        command_check: [
            {
                id: 'project/merge-imports',
                stage: 'commit',
                paths: ['*.ts'],
                command: buildProgramCommand('fakes/tool'),
                fix: buildProgramCommand('fakes/tool', '--text', "import Hls, type { A } from 'hls.js';\n", '{files}'),
                output: { format: 'none' },
            },
        ],
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
        'client.ts': "import Hls from 'hls.js';\nexport { Hls };\n",
        'notes.ts': "export const note = 'kept';\n",
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'client.ts'), "export const localEdit = 'keep';\n");
    const before = await readFile(join(sandbox.path, 'client.ts'));
    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ only: ['project/merge-imports'], fix: true }));
    expect(result.fixes?.broken).toStrictEqual(['client.ts', 'notes.ts']);
    expect(await readFile(join(sandbox.path, 'client.ts'))).toStrictEqual(before);
    expect(result.fixes?.changed).toStrictEqual([]);
    const output = formatFixes(result.fixes!);
    expect(output.join('\n')).not.toContain('git checkout');
    expect(output.join('\n')).not.toContain('Fixed ');
    expect(output).toContain(
        'The fixers left a syntax error in client.ts; gspot put back the file as it was before the fixers.',
    );
    expect(result.report.exitCode).toBe(2);
    expect(result.report.failed).toStrictEqual([]);
});

test('a file with merge-conflict markers stays out of every fixer, and the fix report names it', async () => {
    const conflict = 'one\n<<<<<<< HEAD\ntwo\n=======\nthree\n>>>>>>> branch\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildFixerSettings(['*.txt']),
        'conflict.txt': conflict,
    });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'conflict.txt=lost\n'));
    const fixed = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    expect(await readFile(join(sandbox.path, 'conflict.txt'), 'utf8')).toBe(conflict);
    expect(formatFixes(fixed)).toStrictEqual([
        'The fixers skipped conflict.txt, because it holds merge-conflict markers.',
    ]);
});

test('a seven-letter title underline outside a conflict leaves the file to the fixers', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildFixerSettings(['*.txt']),
        'support.txt': 'Support\n=======\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'support.txt=Support\n'));
    const fixed = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    expect(await readFile(join(sandbox.path, 'support.txt'), 'utf8')).toBe('Support\n');
    expect(fixed.changed).toStrictEqual(['support.txt']);
});

test('a fixer that leaves a code file that fails to parse is named in the fix report', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildFixerSettings(['*.ts']),
        'client.ts': 'export const client = true;\n',
        'notes.ts': 'export const note = false;\n',
    });
    const before = await readFile(join(sandbox.path, 'client.ts'));
    const session = await openSession(sandbox.path);
    const planned = planFixer(
        session,
        buildProgramCommand(
            'fakes/tool',
            '--write',
            'client.ts=export const =;',
            '--write',
            'notes.ts=export const note = true;\n',
        ),
    );
    const fixed = await runFixers(buildCheckSession(session, CHECK_GENERATION), [planned]);
    expect(fixed.broken).toStrictEqual(['client.ts']);
    expect(fixed.changed).toStrictEqual(['notes.ts']);
    expect(await readFile(join(sandbox.path, 'client.ts'))).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'notes.ts'), 'utf8')).toBe('export const note = true;\n');
    expect(formatFixes(fixed)).toStrictEqual([
        'Fixed 1 file: notes.ts. The changes are not staged.',
        'The fixers left a syntax error in client.ts; gspot put back the file as it was before the fixers.',
    ]);
});
