import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { GUIDE, README, LICENSE } from '#tests/config/samples/docs.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

// What each check accepts in place of its test document; the guide for the rest.
export const CORRECTIONS: Record<string, string> = {
    'docs/lychee': '# A page\n\nRead [the guide](guide.md) first.\n',
};

export const CASES: FindingCase[] = [
    {
        check: 'markdown/markdownlint',
        files: { 'docs/image.md': '# A page\n\n![](diagram.png)\n' },
        expected: { file: 'docs/image.md', line: 3, rule: 'MD045' },
        corrected: { files: { 'docs/image.md': '# A page\n\n![Request flow](diagram.png)\n' } },
    },
    {
        check: 'markdown/markdownlint',
        files: { 'docs/titles.md': '# First title\n\n# Second title\n' },
        expected: { file: 'docs/titles.md', line: 3, rule: 'MD025' },
        corrected: { files: { 'docs/titles.md': '# First title\n\n## Second heading\n' } },
    },
    {
        check: 'markdown/markdownlint',
        files: { 'docs/skipped.md': '# A page\n\n### A heading two levels down\n\nText under it.\n' },
        expected: { file: 'docs/skipped.md', rule: 'MD001', line: 3 },
    },
    {
        check: 'docs/lychee',
        files: { 'docs/linked.md': '# A page\n\nRead [the other page](missing-page.md) first.\n' },
        expected: { file: 'docs/linked.md', rule: 'ERROR', line: 3, column: 6 },
    },
    {
        check: 'prose/vale',
        files: { 'docs/selling.md': '# A page\n\nThis powerful cache easily makes the application much faster.\n' },
        expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
    },
];

export const REPOSITORY: InstalledScenario = {
    configurations: ['markdown', 'docs', 'prose'],

    tools: ['vale', 'lychee', 'markdownlint-cli2'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
};
