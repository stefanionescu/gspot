import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { TYPO } from '#tests/data/checks/spelling.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { STYLE_CASES } from '#tests/data/checks/vale-styles.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { shareProseSandbox, applySandboxChanges } from '#tests/setup/sandbox.ts';
import { spawnGspot, spawnRootCheck, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { VALE_INI, VOCABULARY_SOURCE, VERSION_RANGE_SOURCE, VERSION_RANGE_FINDINGS } from '#tests/data/checks/prose.ts';

const installedSandbox = shareProseSandbox();

test("Vale's dashes rule checks the reason text of ESLint comments and skips the -- separator", async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'typescript']),
        '.gspot/configurations/general/prose/vale.ini': VALE_INI,
        '.gspot/configurations/general/prose/styles/Example/Dashes.yml': readFileSync(
            buildAssetPath('configurations/general/prose/tool-files/styles/gspot/dashes.yml'),
            'utf8',
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
    await writeFile(join(folder.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await spawnRootCheck(folder.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test("Vale's version-range rule accepts a minimum version and reports vague ranges", async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'markdown']),
        '.gspot/configurations/general/prose/vale.ini': VALE_INI,
        '.gspot/configurations/general/prose/styles/Example/Versions.yml': readFileSync(
            buildAssetPath('configurations/general/prose/tool-files/styles/gspot/version-range.yml'),
            'utf8',
        ),
        'versions.md': VERSION_RANGE_SOURCE,
    });

    const result = await spawnRootCheck(folder.path, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings).toStrictEqual(VERSION_RANGE_FINDINGS.map((finding) => matchFields(finding)));
});

test("Vale's heading-case rule accepts a reviewed product name and reports title case", async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['prose'], {
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
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
    const findings = result.report.checks.flatMap(({ findings }) => findings);
    expect(
        findings.filter(({ rule }) => rule === 'gspot.heading-case').map(({ line, rule }) => ({ line, rule })),
    ).toStrictEqual([{ line: 7, rule: 'gspot.heading-case' }]);
});

test('the generated vale.ini at level recommended reports link text such as here', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['prose']),
            'guide.md': `# Guide

Read [here](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
            'source.ts': 'const example = "[here](guide.md)";\n// Read [here](guide.md).\n',
        },
    });
    const failed = await spawnRootCheck(root, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        matchFields({ file: 'guide.md', line: 3, rule: 'gspot.link-text' }),
        matchFields({ file: 'source.ts', line: 2, rule: 'gspot.link-text' }),
    ]);
    await writeFile(
        join(root, 'guide.md'),
        `# Guide

Read [request guide](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`,
    );
    await writeFile(
        join(root, 'source.ts'),
        'const example = "[here](guide.md)";\n// Read [request guide](guide.md).\n',
    );
    const corrected = await spawnRootCheck(root, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...STYLE_CASES])('Vale $rule reports prose findings and accepts source notation in $path', async (entry) => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            [entry.path]: entry.source,
        },
    });
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
    const alerts = result.report.checks
        .flatMap(({ findings }) => findings)
        .filter(({ rule }) => rule === `gspot.${entry.rule}`);
    expect(alerts.map(({ line, rule }) => ({ line, rule }))).toStrictEqual(
        entry.lines.map((line) => ({ line, rule: `gspot.${entry.rule}` })),
    );
    if ('messages' in entry) expect(alerts.map(({ message }) => message)).toStrictEqual([...entry.messages]);
});

test.each([{ scope: '' }, { scope: 'app' }])(
    'Vale accepts the words listed in gspot.toml and reports a misspelling in scope "$scope"',
    async ({ scope }) => {
        const { root } = installedSandbox();
        const settings = buildSandboxSettings(scope === '' ? ['prose', 'sql', 'spelling'] : ['prose', 'spelling'], {
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
        const result = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'prose/vale', '--only', 'spelling/typos', '--json']),
        );
        const findings = result.report.checks.flatMap(({ findings }) => findings);
        expect(
            findings.filter(({ rule }) => rule === 'gspot.possessives').map(({ line, rule }) => ({ line, rule })),
        ).toStrictEqual([
            { rule: 'gspot.possessives', line: 7 },
            { rule: 'gspot.possessives', line: 7 },
        ]);
        expect(findings.filter(({ line }) => line === 5)).toHaveLength(1);
        expect(findings.some(({ line }) => line === 3)).toBe(false);
        await writeFile(
            join(root, scope, 'guide.md'),
            VOCABULARY_SOURCE.replace(TYPO.receive, 'receive').replace("Avoid vale's and ajv's.", 'Use Vale and ajv.'),
        );
        const corrected = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'prose/vale', '--only', 'spelling/typos', '--json']),
        );
        expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);
