import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { NO_UPSTREAM_MESSAGE } from '#tests/config/git.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { buildReportingCheck } from '#tests/setup/cli/settings.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { ALL_FILES_BASES } from '#tests/config/commands/check/arguments.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The tests of this file commit the changed repository through it, and jscpd reports the inlined copies as clones.
async function prepareChangedRepository(root: string, files: Record<string, string>): Promise<void> {
    const gspotToml = stringify({
        configurations: [],
        command_check: [buildReportingCheck({ id: 'sandbox/paths', paths: ['api/**', 'web/**'], stage: 'commit' })],
    });

    await createFileTree(root, { 'gspot.toml': gspotToml, ...files });
}

test('--changed compares with the merge base, names its base, and a folder argument stays a path', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, {
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'api/source.txt': 'before',
        'web/source.txt': 'before',
    });
    runGitStep(sandbox.path, ['init', '-b', 'main']);
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['branch', 'base']);
    runGitStep(sandbox.path, ['branch', '--set-upstream-to=base']);
    await writeFile(join(sandbox.path, 'api/source.txt'), 'committed change');
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'web/source.txt'), 'working change');
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json', '--', 'api']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.comparison).toStrictEqual({ content: 'working-tree', reference: 'refs/heads/base' });
    expect(checked.report.checks[0]?.reproduce).toBe('gspot check api --only sandbox/paths --changed refs/heads/base');
    expect(checked.report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
    const explicit = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', 'base', '--json']),
    );
    expect(explicit.code, explicit.stdout + explicit.stderr).toBe(1);
    expect(explicit.report.checks[0]?.reproduce).toBe('gspot check --only sandbox/paths --changed base');
    expect(
        explicit.report.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted(compareText),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
});

test('--changed without an upstream names the fix, and uses the remote default branch', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, { '.gitignore': `${GSPOT_FOLDER}/\n`, 'api/source.txt': 'before' });
    runGitStep(sandbox.path, ['init', '-b', 'topic']);
    commitAll(sandbox.path);
    const absent = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', '--json']);
    expect(absent.code).toBe(2);
    expect((JSON.parse(absent.stdout) as CommandFailureJson).message).toBe(NO_UPSTREAM_MESSAGE);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGitStep(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    await writeFile(join(sandbox.path, 'api/source.txt'), 'changed');
    const defaultRange = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed']);
    expect(defaultRange.code, defaultRange.stdout + defaultRange.stderr).toBe(1);
    expect(defaultRange.stdout.split('\n', 1)[0]).toBe('Checked the files changed since refs/remotes/origin/main.');
});

test.each([...ALL_FILES_BASES])(
    '--changed $reference, as CI gives for a new branch, checks every file and says why',
    async ({ reference, message }) => {
        await using sandbox = await testdir();
        await prepareChangedRepository(sandbox.path, {
            '.gitignore': `${GSPOT_FOLDER}/\n`,
            'api/source.txt': 'before',
            'web/source.txt': 'before',
        });
        runGitStep(sandbox.path, ['init', '-b', 'topic']);
        commitAll(sandbox.path);
        const result = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', reference, '--json']),
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.report.comparison).toBeUndefined();
        expect(
            result.report.checks
                .flatMap((check) => check.findings.map((finding) => finding.message))
                .toSorted(compareText),
        ).toStrictEqual(['api/source.txt', 'web/source.txt']);
        const text = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--changed', reference]);
        expect(text.stdout).toStartWith(`${message}\n`);
    },
);

test('a shallow clone explains how to fetch the missing history', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    await prepareChangedRepository(source, { 'api/source.txt': 'before' });
    runGitStep(source, ['init', '-b', 'main']);
    commitAll(source);
    const base = runGitStep(source, ['rev-parse', 'HEAD']);
    await writeFile(join(source, 'api/source.txt'), 'after');
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const result = await runGspot(join(sandbox.path, 'checkout'), [
        'check',
        '--only',
        'sandbox/paths',
        '--changed',
        base,
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toBe(
        `Git merge-base failed for ${base}: fatal: Not a valid commit name ${base}. History is cut; run git fetch --unshallow.`,
    );
});
