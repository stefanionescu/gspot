import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildReportingCheck } from '#tests/setup/cli/settings.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

async function prepareChangedRepository(root: string, files: Record<string, string>): Promise<void> {
    const gspotToml = stringify({
        configurations: [],
        command_check: [buildReportingCheck({ id: 'sandbox/paths', paths: ['api/**', 'web/**'], stage: 'commit' })],
    });

    await createFileTree(root, { 'gspot.toml': gspotToml, ...files });
}

test.each([
    { reference: '', note: 'Checked every file: the base ref is empty.' },
    { reference: '0'.repeat(40), note: 'Checked every file: the base is a new branch.' },
])('--base $reference, as CI gives for a new branch, checks every file and says why', async ({ reference, note }) => {
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
        result.report.checks.flatMap((check) => check.findings.map((finding) => finding.message)).toSorted(compareText),
    ).toStrictEqual(['api/source.txt', 'web/source.txt']);
    expect(result.report.notes).toContain(note);
});

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
