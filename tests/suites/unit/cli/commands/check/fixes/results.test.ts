import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runFixers } from '#cli/commands/check/fixes.ts';
import { formatFixes } from '#cli/commands/check/report.ts';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { planFixer, buildRunOptions, buildFixerSettings } from '#tests/setup/cli/runs.ts';
import { buildProgramCommand, buildProgramArguments } from '#tests/setup/system/programs.ts';
import { FIXER_RESULTS, FIXER_CRASH_CASES } from '#tests/config/commands/check/fixes/results.ts';

test.each(FIXER_CRASH_CASES)(
    'the fixer tool owns crash detection when dryRun is %p and exit is %p',
    async (dryRun, code) => {
        await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

        const session = await openSession(sandbox.path);
        const planned = planFixer(
            session,
            buildProgramCommand('fakes/tool', '--stderr', 'Fatal: cannot write\n', '--exit', String(code)),
        );
        planned.check.exit_codes = [3];
        const configuration = session.configurationsByName.values().next().value!;
        session.configurationsByName.set(configuration.name, {
            ...configuration,
            tools: [{ ...planned.tool!, crash_pattern: '^Fatal:' }, ...configuration.tools],
        });
        planned.tool = { ...planned.tool!, name: 'different-checker', crash_pattern: '^Checker-only:' };
        const failedRun = await runFixers(buildCheckSession(session), [planned], { dryRun });
        const failed = failedRun.results[0];
        expect(failed).toMatchObject({
            status: 'failed',
            changed: [],
            note: 'Fatal: cannot write',
        });
        const corrected = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'));
        corrected.tool = planned.tool;
        const correctedResultRun = await runFixers(buildCheckSession(session), [corrected], { dryRun });
        const correctedResult = correctedResultRun.results[0];
        expect(correctedResult).toMatchObject({
            status: 'changed',
            changed: ['source.txt'],
        });
    },
);

test.each([...FIXER_RESULTS])(
    '$name classifies $status from the exit code and the bytes it leaves',
    async ({ toolArguments, exit_codes: exitCodes, status, after, note }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

        const session = await openSession(sandbox.path);
        const planned = planFixer(session, buildProgramCommand('fakes/tool', ...toolArguments));
        if (exitCodes !== undefined) planned.check.exit_codes = [...exitCodes];
        const resultRun = await runFixers(buildCheckSession(session), [planned], { dryRun: false });
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
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write-hex', 'source.txt=fe'));
    await writeFile(join(sandbox.path, 'source.txt'), Buffer.from([0xff]));
    const resultRun = await runFixers(buildCheckSession(session), [planned], { dryRun: false });
    const result = resultRun.results[0];
    expect(result).toMatchObject({ status: 'changed', changed: ['source.txt'] });
    expect(await readFile(join(sandbox.path, 'source.txt'))).toStrictEqual(Buffer.from([0xfe]));
});

test('a fixer that deletes an empty file reports it as changed', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': '' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--delete', 'source.txt'));
    const resultRun = await runFixers(buildCheckSession(session), [planned], { dryRun: false });
    const result = resultRun.results[0];
    expect(result).toMatchObject({ status: 'changed', changed: ['source.txt'] });
    expect(await isOnDisk(join(sandbox.path, 'source.txt'))).toBe(false);
});

test('a skipped fixer reports skipped, and a fixer whose program is missing fails', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=wrong'));
    const skippedRun = await runFixers(
        buildCheckSession(session),
        [{ ...planned, skip: { cause: 'level', note: 'Not selected.' } }],
        {
            dryRun: false,
        },
    );
    const skipped = skippedRun.results[0]!;
    const failedRun = await runFixers(
        buildCheckSession(session),
        [{ ...planned, check: { ...planned.check, fix: [join(sandbox.path, 'absent-tool')] } }],
        { dryRun: false },
    );
    const failed = failedRun.results[0]!;
    expect(skipped.status).toBe('skipped');
    expect(failed).toMatchObject({
        status: 'failed',
        note: `${join(sandbox.path, 'absent-tool')} is not installed. Install ${join(sandbox.path, 'absent-tool')}.`,
    });
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test('a fixer runs its own program when the check program is missing', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=corrected'));
    const resultRun = await runFixers(
        buildCheckSession(session),
        [{ ...planned, tool: { name: join(sandbox.path, 'absent-check-tool'), installers: {}, kind: 'program' } }],
        { dryRun: false },
    );
    const result = resultRun.results[0]!;
    expect(result.status).toBe('changed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected');
});

test('a fix that exits nonzero fails the run even when its check passes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ fix: true, only: ['sandbox/fixer'] }));
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(result.report.exitCode).toBe(2);
    expect(result.report.failed).toStrictEqual(['sandbox/fixer']);
    expect(result.fixes?.results[0]?.status).toBe('failed');
});

test('a failed version check blocks a check and its fix without changing source bytes', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildFixerSettings(), 'source.txt': 'original' });

    const session = await openSession(sandbox.path);
    const planned = planFixer(session, buildProgramCommand('fakes/tool', '--write', 'source.txt=changed'));
    planned.tool = {
        ...buildProgramPin('version-teller', '3.8.1'),
        version_command: buildProgramArguments('fakes/tool', '--line', '3.8.1', '--exit', '7'),
    };
    planned.check.fix![0] = 'version-teller';
    using _which = fakeExecutableLookup(process.execPath);

    const checked = await runCommandCheck(buildCheckSession(session), planned);
    expect(checked.status).toBe('error');
    expect(checked.note).toBe('The version command of version-teller exited 7: 3.8.1');
    const fixedRun = await runFixers(buildCheckSession(session), [planned], { dryRun: false });
    const fixed = fixedRun.results[0]!;
    expect(fixed.status).toBe('failed');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
});

test.each([false, true])(
    'a fixer that breaks a file with an unstaged edit puts the file back and exits 2 (dry run: %p)',
    async (isDryRun) => {
        await using sandbox = await createGitSandbox({});
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/merge-imports',
                            stage: 'commit',
                            paths: ['*.ts'],
                            command: buildProgramCommand('fakes/tool'),
                            fix: buildProgramCommand(
                                'fakes/tool',
                                '--text',
                                "import Hls, type { A } from 'hls.js';\n",
                                '{files}',
                            ),
                            output: { format: 'none' },
                        },
                    ],
                }),
            }),
            'client.ts': "import Hls from 'hls.js';\nexport { Hls };\n",
            'notes.ts': "export const note = 'kept';\n",
        });
        commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'client.ts'), "export const localEdit = 'keep';\n");
        const before = await readFile(join(sandbox.path, 'client.ts'));
        const session = await openSession(sandbox.path);
        const result = await runChecks(
            session,
            buildRunOptions({ only: ['project/merge-imports'], fix: true, dryRun: isDryRun }),
        );
        expect(result.fixes?.broken).toStrictEqual(['client.ts', 'notes.ts']);
        expect(await readFile(join(sandbox.path, 'client.ts'))).toStrictEqual(before);
        expect(result.fixes?.changed).toStrictEqual(isDryRun ? ['client.ts', 'notes.ts'] : []);
        const output = formatFixes(result.fixes!, { dryRun: isDryRun });
        expect(output.join('\n')).not.toContain('git checkout');
        expect(output.join('\n')).not.toContain('Fixed ');
        expect(output).toContain(
            isDryRun
                ? 'The fixers would leave a syntax error in client.ts.'
                : 'The fixers left a syntax error in client.ts; gspot put back the file as it was before the fixers.',
        );
        expect(result.report.exitCode).toBe(2);
        expect(result.report.failed).toStrictEqual([]);
    },
);

test('a fixer that leaves a code file that fails to parse is named in the fix report', async () => {
    await using sandbox = await testdir({
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
    const fixed = await runFixers(buildCheckSession(session), [planned], { dryRun: false });
    expect(fixed.broken).toStrictEqual(['client.ts']);
    expect(fixed.changed).toStrictEqual(['notes.ts']);
    expect(await readFile(join(sandbox.path, 'client.ts'))).toStrictEqual(before);
    expect(await readFile(join(sandbox.path, 'notes.ts'), 'utf8')).toBe('export const note = true;\n');
    expect(formatFixes(fixed, { dryRun: false })).toStrictEqual([
        'Fixed 1 file: notes.ts. The changes are not staged.',
        'The fixers left a syntax error in client.ts; gspot put back the file as it was before the fixers.',
    ]);
});
