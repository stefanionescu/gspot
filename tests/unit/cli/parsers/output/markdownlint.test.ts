import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/spelling.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { REPORT_ERRORS, MARKDOWN_REPORT } from '#tests/config/markdown.ts';
import { allChecks, configurationManifests } from '#cli/configurations/manifests.ts';

test('a markdownlint record becomes a finding', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n' });
    const check = allChecks(configurationManifests().values()).get('markdown/markdownlint')!.check;
    const valid = MARKDOWN_REPORT;
    expect(parseOutput(check, JSON.stringify([valid]), '', { root: sandbox.path, cwd: sandbox.path })).toMatchObject([
        { file: 'sample.md', rule: 'MD033', fixable: false },
    ]);
});

test.each([...REPORT_ERRORS])(
    '$configuration rejects $name: $message',
    async ({ configuration, output, message: diagnostic }) => {
        const stdout = typeof output === 'string' ? output : JSON.stringify(output);
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'sample.md': '<span>Content</span>\n', 'sample.txt': `${TYPO.the}\n` });
        const check = allChecks(configurationManifests().values()).get(
            configuration === 'markdown' ? 'markdown/markdownlint' : 'spelling/typos',
        )!.check;
        expect(() => parseOutput(check, stdout, '', { root: sandbox.path, cwd: sandbox.path })).toThrow(diagnostic);
    },
);
