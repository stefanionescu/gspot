import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { TYPO } from '#tests/config/spelling.ts';
import { readAsset } from '#cli/system/assets.ts';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { VALE_INI, STYLE_CASES, CURRENCY_CASES, VOCABULARY_SOURCE } from '#tests/config/prose.ts';

test("Vale's dashes rule checks the reason text of ESLint comments and skips the -- separator", async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose', 'typescript']),
        '.gspot/config/vale.ini': VALE_INI,
        '.gspot/config/styles/Example/Dashes.yml': readAsset(
            'configurations/general/prose/vale/styles/gspot/dashes.yml',
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
    const failedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const failed = (JSON.parse(failedCommand.stdout) as RunReport).checks[0]!;
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        containing({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        containing({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await Bun.write(join(directory.path, 'source.ts'), '// Punctuation stays checked.\n');
    const correctedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const corrected = (JSON.parse(correctedCommand.stdout) as RunReport).checks[0]!;
    expect(corrected.status, corrected.note).toBe('passed');
});

test("Vale's version-range rule accepts a minimum version and reports vague ranges", async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose', 'markdown']),
        '.gspot/config/vale.ini': VALE_INI,
        '.gspot/config/styles/Example/Versions.yml': readAsset(
            'configurations/general/prose/vale/styles/gspot/version-range.yml',
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
    const resultCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const result = (JSON.parse(resultCommand.stdout) as RunReport).checks[0]!;
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual([
        containing({ file: 'versions.md', line: 4, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 5, rule: 'Example.Versions' }),
        containing({ file: 'versions.md', line: 6, rule: 'Example.Versions' }),
    ]);
});

test("Vale's heading-case rule accepts a reviewed product name and reports title case", async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose'], {
            level: 'all',
            tables: 'allowed_words = { value = ["Microsoft Edge"], reason = "The guide names this browser." }\n',
        }),
        'guide.md': `# Guide

## HTTP edge rules

## Microsoft Edge settings

## HTTP Edge Rules
`,
    });
    await installToolProjects(directory.path);
    const result = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
    expect(
        findings.filter(({ rule }) => rule === 'gspot.heading-case').map(({ line, rule }) => ({ line, rule })),
    ).toStrictEqual([{ line: 7, rule: 'gspot.heading-case' }]);
});

test.each([...CURRENCY_CASES])(
    'Vale currency checks distinguish amounts from parameter text in $path',
    async (entry) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': settingsText(['prose'], { level: 'all' }),
            [entry.path]: entry.source,
        });
        await installToolProjects(directory.path);
        const result = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
        const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
        expect(
            findings.filter(({ rule }) => rule === 'gspot.currency').map(({ line, rule }) => ({ line, rule })),
        ).toStrictEqual(entry.lines.map((line) => ({ line, rule: 'gspot.currency' })));
    },
);

test('the generated vale.ini at level recommended reports link text such as here', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose']),
        'guide.md': `# Guide

Read [here](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
        'source.ts': 'const example = "[here](guide.md)";\n// Read [here](guide.md).\n',
    });
    await installToolProjects(directory.path);
    const failedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const failed = (JSON.parse(failedCommand.stdout) as RunReport).checks[0]!;
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        containing({ file: 'guide.md', line: 3, rule: 'gspot.link-text' }),
        containing({ file: 'source.ts', line: 2, rule: 'gspot.link-text' }),
    ]);
    await Bun.write(
        join(directory.path, 'guide.md'),
        `# Guide

Read [request guide](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
    );
    await Bun.write(
        join(directory.path, 'source.ts'),
        'const example = "[here](guide.md)";\n// Read [request guide](guide.md).\n',
    );
    const correctedCommand = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const corrected = (JSON.parse(correctedCommand.stdout) as RunReport).checks[0]!;
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...STYLE_CASES])('Vale $rule checks report prose findings and accept source notation', async (entry) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['prose'], { level: 'all' }),
        [entry.path]: entry.source,
    });
    await installToolProjects(directory.path);
    const result = await spawnGspot(directory.path, ['check', '--only', 'prose/vale', '--json']);
    const alerts = (JSON.parse(result.stdout) as RunReport).checks
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
});

test.each([{ scope: '' }, { scope: 'app' }])(
    'Vale accepts the words listed in gspot.toml and reports a misspelling in scope "$scope"',
    async ({ scope }) => {
        await using directory = await testdir();
        const settings = settingsText(scope === '' ? ['prose', 'sql', 'spelling'] : ['prose', 'spelling'], {
            level: 'all',
            tables:
                'allowed_words = { value = ["NebulaProduct"], reason = "The project product." }\n' +
                (scope === ''
                    ? ''
                    : `[[scope]]
path = "app"
configurations = ["sql"]
`),
        });
        await createFileTree(directory.path, { 'gspot.toml': settings, [join(scope, 'guide.md')]: VOCABULARY_SOURCE });
        await installToolProjects(directory.path);
        const result = await spawnGspot(directory.path, [
            'check',
            '--only',
            'prose/vale',
            '--only',
            'spelling/typos',
            '--json',
        ]);
        const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
        expect(
            findings.filter(({ rule }) => rule === 'gspot.possessives').map(({ line, rule }) => ({ line, rule })),
        ).toStrictEqual([
            { rule: 'gspot.possessives', line: 7 },
            { rule: 'gspot.possessives', line: 7 },
        ]);
        expect(findings.filter(({ line }) => line === 5)).toHaveLength(1);
        expect(findings.some(({ line }) => line === 3)).toBe(false);
        await Bun.write(
            join(directory.path, scope, 'guide.md'),
            VOCABULARY_SOURCE.replace(TYPO.receive, 'receive').replace("Avoid vale's and ajv's.", 'Use Vale and ajv.'),
        );
        const corrected = await spawnGspot(directory.path, [
            'check',
            '--only',
            'prose/vale',
            '--only',
            'spelling/typos',
            '--json',
        ]);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
    },
);
