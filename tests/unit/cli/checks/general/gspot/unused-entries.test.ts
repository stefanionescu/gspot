import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { UNUSED_PATH_CASES, UNUSED_ENTRY_CASES, UNUSED_ENTRY_SETTINGS } from '#tests/config/unused-entries.ts';

test('an [[ignore]] or [[command_check]] path that matches no tracked file is reported, even when a document names it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md': 'The runner writes `.reports/output.json`.\n',
        'gspot.toml': stringify(UNUSED_ENTRY_SETTINGS),
    });
    const findings = await checkFindings(sandbox.path, 'gspot/unused-entries', { paths: ['docs/guide.md'] });
    expect(findings.map(({ message: description }) => description)).toStrictEqual([
        '.reports/output.json under [[ignore]] matches no tracked file or folder.',
        '.reports/unused.json under [[ignore]] matches no tracked file or folder.',
        '.reports/command.json under [[command_check]] matches no tracked file or folder.',
    ]);
});

test.each([...UNUSED_PATH_CASES])('$name', async ({ files, settings, unmatched }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': stringify({ level: 'all', ...settings }) });
    commitAll(sandbox.path);
    const findings = await checkFindings(sandbox.path, 'gspot/unused-entries');
    expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual([...unmatched]);
    expect(findings).toMatchObject(
        unmatched.map(() => ({
            check: 'gspot/unused-entries',
            file: 'gspot.toml',
            line: 1,
            rule: 'unused-entry',
        })),
    );
});

for (const entry of UNUSED_ENTRY_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(BASH_REPOSITORY);
        await runCheckSample(sandbox, entry, BASH_REPOSITORY);
    });
}
