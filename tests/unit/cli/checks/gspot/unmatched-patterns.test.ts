import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { checkFindings } from '#tests/setup/check-input.ts';
import { UNUSED_PATH_CASES, UNMATCHED_PATTERN_SETTINGS } from '#tests/data/checks/gspot/unmatched-patterns.ts';

test('an [[ignore]] or [[command_check]] path that matches no tracked file is reported, even when a document names it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md': 'The runner writes `.reports/output.json`.\n',
        'gspot.toml': stringify(UNMATCHED_PATTERN_SETTINGS),
    });
    const findings = await checkFindings(sandbox.path, 'gspot/unmatched-patterns', { paths: ['docs/guide.md'] });
    expect(findings.map(({ message: description }) => description)).toStrictEqual([
        '.reports/output.json under [[ignore]] matches no tracked file or folder.',
        '.reports/unused.json under [[ignore]] matches no tracked file or folder.',
        '.reports/command.json under [[command_check]] matches no tracked file or folder.',
    ]);
});

test.each([...UNUSED_PATH_CASES])(
    'gspot/unmatched-patterns reports only paths without tracked matches: $name',
    async ({ files, settings, unmatched }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': stringify({ level: 'all', ...settings }) });
        commitAll(sandbox.path);
        const findings = await checkFindings(sandbox.path, 'gspot/unmatched-patterns');
        expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual([...unmatched]);
        expect(findings).toMatchObject(
            unmatched.map(() => ({
                check: 'gspot/unmatched-patterns',
                file: 'gspot.toml',
                line: 1,
                rule: 'unused-record',
            })),
        );
    },
);
