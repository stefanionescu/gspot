import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { compareText } from '#cli/system/text.ts';
import { ALL_FILES_BASES } from '#tests/config/commands/check.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck } from '#tests/setup/cli/settings.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

async function prepareChangedRepository(root: string, files: Record<string, string>): Promise<void> {
    const gspotToml = stringify({
        configurations: [],
        command_check: [buildReportingCheck({ id: 'sandbox/paths', paths: ['api/**', 'web/**'], stage: 'commit' })],
    });

    await createFileTree(root, { 'gspot.toml': gspotToml, ...files });
}

test('--base compares with the merge base, names its base, and a folder argument stays a path', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, {
        '.gitignore': `${GSPOT_FOLDER}/\n`,
        'api/source.txt': 'before',
        'web/source.txt': 'before',
    });
    runGitStep(sandbox.path, ['init', '-b', 'main']);
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['branch', 'base']);
    await writeFile(join(sandbox.path, 'api/source.txt'), 'committed change');
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'web/source.txt'), 'working change');
    const narrowed = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--base', 'base', 'api', '--json']),
    );
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(1);
    expect(narrowed.report.comparison).toStrictEqual({ content: 'working-tree', reference: 'base' });
    expect(narrowed.report.checks[0]?.rerun).toBe('gspot check api --only sandbox/paths --base base');
    expect(narrowed.report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--base', 'base', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks[0]?.rerun).toBe('gspot check --only sandbox/paths --base base');
    expect(
        checked.report.checks
            .flatMap((check) => check.findings.map((finding) => finding.message))
            .toSorted(compareText),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
});

test.each([...ALL_FILES_BASES])(
    '--base $reference, as CI gives for a new branch, checks every file and says why',
    async ({ reference }) => {
        await using sandbox = await testdir();
        await prepareChangedRepository(sandbox.path, {
            '.gitignore': `${GSPOT_FOLDER}/\n`,
            'api/source.txt': 'before',
            'web/source.txt': 'before',
        });
        runGitStep(sandbox.path, ['init', '-b', 'topic']);
        commitAll(sandbox.path);
        const result = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--base', reference, '--json']),
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.report.comparison).toBeNull();
        expect(
            result.report.checks
                .flatMap((check) => check.findings.map((finding) => finding.message))
                .toSorted(compareText),
        ).toStrictEqual(['api/source.txt', 'web/source.txt']);
        const compared = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--base', 'HEAD', '--json']),
        );
        const added = result.report.notes.filter((note) => !compared.report.notes.includes(note));
        expect(added).toHaveLength(1);
        const text = await runGspot(sandbox.path, ['check', '--only', 'sandbox/paths', '--base', reference]);
        expect(text.stdout).toContain(`note     ${added[0]!}\n`);
    },
);

test('an absent full base hash in a shallow clone checks every file and identifies the base', async () => {
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
        '--base',
        base,
        '--json',
    ]);
    const checked = parseCheckReport(result);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(checked.report.notes).toContainEqual(expect.stringContaining(base) as string);
    expect(checked.report.checks.flatMap((check) => check.findings.map((finding) => finding.message))).toStrictEqual([
        'api/source.txt',
    ]);
});

test('--base origin/HEAD in a repository that never set it names the fix', async () => {
    await using sandbox = await testdir();
    await prepareChangedRepository(sandbox.path, { 'api/source.txt': 'before' });
    runGitStep(sandbox.path, ['init', '-b', 'main']);
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['check', '--base', 'origin/HEAD']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('git remote set-head origin --auto');
});
