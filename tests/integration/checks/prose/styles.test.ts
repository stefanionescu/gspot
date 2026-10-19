import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readAsset } from '#cli/system/assets.ts';
import { testdir, createFileTree } from 'testdirs';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { spawnRootCheck, spawnCheckReport } from '#tests/setup/run-gspot.ts';
import { shareProseSandbox, applySandboxChanges } from '#tests/setup/sandbox.ts';
import { VALE_INI, STYLE_CASES, CURRENCY_CASES, VOCABULARY_SOURCE } from '#tests/data/checks/prose.ts';

const installedSandbox = shareProseSandbox();

test("Vale's dashes rule checks the reason text of ESLint comments and skips the -- separator", async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose', 'typescript']),
        '.gspot/configurations/general/prose/vale.ini': VALE_INI,
        '.gspot/configurations/general/prose/styles/Example/Dashes.yml': readAsset(
            'configurations/general/prose/tool-files/styles/gspot/dashes.yml',
        ),
        'source.ts': [
            '// eslint-disable -- reason: The external declaration requires this signature.',
            '// eslint-enable no-x, @scope/no-y -- reason: Checks resume here.',
            '// eslint-disable-line no-x -- reason: The external declaration requires this signature.',
            '// eslint-disable-next-line no-x -- reason: Punctuation -- stays checked.',
            '// Punctuation -- stays checked.',
            '',
        ].join('\n'),
    });
    const failed = await spawnRootCheck(folder.path, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        matchFields({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        matchFields({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await Bun.write(join(folder.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await spawnRootCheck(folder.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test("Vale's version-range rule accepts a minimum version and reports vague ranges", async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['prose', 'markdown']),
        '.gspot/configurations/general/prose/vale.ini': VALE_INI,
        '.gspot/configurations/general/prose/styles/Example/Versions.yml': readAsset(
            'configurations/general/prose/tool-files/styles/gspot/version-range.yml',
        ),
        'versions.md': [
            'Use Node.js 24.2.0 or later.',
            'Use Git 2.40 or newer.',
            'Use version 3 or higher.',
            'Use version 3.x.',
            'Use version 3+ or later.',
            'Use the current version or newer.',
            'Use version 1.2.0-beta.1 or later.',
            'Use version 3.2.0  or newer.',
            'Use version 3.2.0\nor later.',
            '',
        ].join('\n'),
    });
    const result = await spawnRootCheck(folder.path, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        matchFields({ file: 'versions.md', line: 4, rule: 'Example.Versions' }),
        matchFields({ file: 'versions.md', line: 5, rule: 'Example.Versions' }),
        matchFields({ file: 'versions.md', line: 6, rule: 'Example.Versions' }),
    ]);
});

test("Vale's heading-case rule accepts a reviewed product name and reports title case", async () => {
    const folder = { path: installedSandbox().root };
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText(['prose'], {
                level: 'all',
                tables: 'allowed_words = { Microsoft = "The guide names this browser.", Edge = "The guide names this browser." }\n',
            }),
            'guide.md': `# Guide

## HTTP request rules

## Microsoft Edge settings

## HTTP Request Rules
`,
        },
    });
    const result = await spawnCheckReport(folder.path, ['check', '--only', 'prose/vale', '--json']);
    const findings = result.report.checks.flatMap(({ findings }) => findings);
    expect(
        findings.filter(({ rule }) => rule === 'gspot.heading-case').map(({ line, rule }) => ({ line, rule })),
    ).toStrictEqual([{ line: 7, rule: 'gspot.heading-case' }]);
});

test('the generated vale.ini at level recommended reports link text such as here', async () => {
    const folder = { path: installedSandbox().root };
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText(['prose']),
            'guide.md': `# Guide

Read [here](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
            'source.ts': 'const example = "[here](guide.md)";\n// Read [here](guide.md).\n',
        },
    });
    const failed = await spawnRootCheck(folder.path, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        matchFields({ file: 'guide.md', line: 3, rule: 'gspot.link-text' }),
        matchFields({ file: 'source.ts', line: 2, rule: 'gspot.link-text' }),
    ]);
    await Bun.write(
        join(folder.path, 'guide.md'),
        `# Guide

Read [request guide](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
    );
    await Bun.write(
        join(folder.path, 'source.ts'),
        'const example = "[here](guide.md)";\n// Read [request guide](guide.md).\n',
    );
    const corrected = await spawnRootCheck(folder.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...CURRENCY_CASES.map((entry) => ({ ...entry, rule: 'currency' as const })), ...STYLE_CASES])(
    'Vale $rule reports prose findings and accepts source notation in $path',
    async (entry) => {
        const folder = { path: installedSandbox().root };
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSettingsText(['prose'], { level: 'all' }),
                [entry.path]: entry.source,
            },
        });
        const result = await spawnCheckReport(folder.path, ['check', '--only', 'prose/vale', '--json']);
        const alerts = result.report.checks
            .flatMap(({ findings }) => findings)
            .filter(({ rule }) => rule === `gspot.${entry.rule}`);
        expect(alerts.map(({ line, rule }) => ({ line, rule }))).toStrictEqual(
            entry.lines.map((line) => ({ line, rule: `gspot.${entry.rule}` })),
        );
        if (entry.rule === 'placeholders')
            expect(alerts.map(({ message }) => message)).toStrictEqual([
                "Placeholder style 'YOUR_TOKEN'. Use <kebab-case> in angle brackets.",
                "Placeholder style '{{token}}'. Use <kebab-case> in angle brackets.",
            ]);
    },
);

test.each([{ scope: '' }, { scope: 'app' }])(
    'Vale accepts the words listed in gspot.toml and reports a misspelling in scope "$scope"',
    async ({ scope }) => {
        const folder = { path: installedSandbox().root };
        const settings = buildSettingsText(scope === '' ? ['prose', 'sql', 'spelling'] : ['prose', 'spelling'], {
            level: 'all',
            tables:
                'allowed_words = { NebulaProduct = "The project product." }\n' +
                (scope === ''
                    ? ''
                    : `[[scope]]
path = "app"
configurations = ["sql"]
`),
        });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: { 'gspot.toml': settings, [join(scope, 'guide.md')]: VOCABULARY_SOURCE },
        });
        const result = await spawnCheckReport(folder.path, [
            'check',
            '--only',
            'prose/vale',
            '--only',
            'spelling/typos',
            '--json',
        ]);
        const findings = result.report.checks.flatMap(({ findings }) => findings);
        expect(
            findings.filter(({ rule }) => rule === 'gspot.possessives').map(({ line, rule }) => ({ line, rule })),
        ).toStrictEqual([
            { rule: 'gspot.possessives', line: 7 },
            { rule: 'gspot.possessives', line: 7 },
        ]);
        expect(findings.filter(({ line }) => line === 5)).toHaveLength(1);
        expect(findings.some(({ line }) => line === 3)).toBe(false);
        await Bun.write(
            join(folder.path, scope, 'guide.md'),
            VOCABULARY_SOURCE.replace(TYPO.receive, 'receive').replace("Avoid vale's and ajv's.", 'Use Vale and ajv.'),
        );
        const corrected = await spawnCheckReport(folder.path, [
            'check',
            '--only',
            'prose/vale',
            '--only',
            'spelling/typos',
            '--json',
        ]);
        expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);
