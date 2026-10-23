import { testdir } from 'testdirs';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { buildAssetPath } from '#cli/system/assets.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { TYPO } from '#tests/config/checks/general/spelling.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareProseSandbox } from '#tests/setup/sandboxes/create.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { VALE_INI, EXAMPLE_STYLE_FOLDER } from '#tests/config/integration/checks/general/prose/samples.ts';
import { spawnGspot, spawnRootCheck, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    STYLE_CASES,
    LINK_TEXT_GUIDE,
    VOCABULARY_SOURCE,
    HEADING_CASE_GUIDE,
    VERSION_RANGE_SOURCE,
    SCOPE_SPELLING_CASES,
    SUPPRESSION_COMMENTS,
    VERSION_RANGE_FINDINGS,
    CORRECTED_LINK_TEXT_GUIDE,
} from '#tests/config/integration/checks/general/prose/styles.ts';

const installedSandbox = shareProseSandbox();

test(`Vale's em-dashes rule checks the reason text of ESLint comments and skips the -- separator`, async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'typescript']),
        [GSPOT_PATHS.valeConfigFile]: VALE_INI,
        [`${EXAMPLE_STYLE_FOLDER}/Dashes.yml`]: readFileSync(
            buildAssetPath('configurations/general/prose/config-files/styles/gspot/em-dashes.yml'),
            'utf8',
        ),
        'source.ts': [...SUPPRESSION_COMMENTS].join('\n'),
    });

    const failed = await spawnRootCheck(sandbox.path, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        matchFields({ file: 'source.ts', line: 4, column: 56, rule: 'Example.Dashes' }),
        matchFields({ file: 'source.ts', line: 5, column: 15, rule: 'Example.Dashes' }),
    ]);
    await writeFile(join(sandbox.path, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await spawnRootCheck(sandbox.path, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test("Vale's version-range rule accepts a minimum version and reports vague ranges", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['prose', 'markdown']),
        [GSPOT_PATHS.valeConfigFile]: VALE_INI,
        [`${EXAMPLE_STYLE_FOLDER}/Versions.yml`]: readFileSync(
            buildAssetPath('configurations/general/prose/config-files/styles/gspot/version-range.yml'),
            'utf8',
        ),
        'versions.md': VERSION_RANGE_SOURCE,
    });

    const result = await spawnRootCheck(sandbox.path, 'prose/vale');
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
                tables: '[spelling]\nallowed_words = { Microsoft = "The guide names this browser.", Edge = "The guide names this browser." }\n',
            }),
            'guide.md': HEADING_CASE_GUIDE,
        },
    });
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(listFindingRows(result.report)).toStrictEqual([{ file: 'guide.md', line: 7, rule: 'gspot.heading-case' }]);
});

test('the generated vale.ini at level recommended reports link text such as here', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['prose']),
            'guide.md': LINK_TEXT_GUIDE,
            'source.ts': 'const example = "[here](guide.md)";\n// Read [here](guide.md).\n',
        },
    });
    const failed = await spawnRootCheck(root, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([
        matchFields({ file: 'guide.md', line: 3, rule: 'gspot.link-text' }),
        matchFields({ file: 'source.ts', line: 2, rule: 'gspot.link-text' }),
    ]);
    await writeFile(join(root, 'guide.md'), CORRECTED_LINK_TEXT_GUIDE);
    await writeFile(
        join(root, 'source.ts'),
        'const example = "[here](guide.md)";\n// Read [request guide](guide.md).\n',
    );
    const corrected = await spawnRootCheck(root, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
    expect(corrected.findings).toStrictEqual([]);
});

test.each([...STYLE_CASES])(
    'Vale $rule reports the expected lines of $path and leaves its code notation alone',
    async (entry) => {
        const { root } = installedSandbox();
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
                [entry.path]: entry.source,
            },
        });
        const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json']));
        expect(
            result.report.checks[0]!.findings.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
        ).toStrictEqual(entry.findings.map((finding) => ({ file: entry.path, ...finding })));
    },
);

test.each([...SCOPE_SPELLING_CASES])(
    'Vale accepts the words listed in gspot.toml and reports a misspelling in scope "$scope"',
    async ({ scope }) => {
        const { root } = installedSandbox();
        const settings = buildSandboxSettings(scope === '' ? ['prose', 'sql', 'spelling'] : ['prose', 'spelling'], {
            level: 'all',
            scopes: scope === '' ? [] : [{ path: scope, configurations: ['sql'] }],
            tables: '[spelling]\nallowed_words = { NebulaProduct = "The project product." }\n',
        });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: { 'gspot.toml': settings, [join(scope, 'guide.md')]: VOCABULARY_SOURCE },
        });
        const result = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'prose/vale', '--only', 'spelling/typos', '--json']),
        );
        expect(
            result.report.checks.flatMap(({ check, findings }) =>
                findings.map(({ file, line, rule }) => ({ check, file, line, rule })),
            ),
        ).toStrictEqual([
            { check: 'prose/vale', file: posix.join(scope, 'guide.md'), line: 7, rule: 'gspot.possessives' },
            { check: 'prose/vale', file: posix.join(scope, 'guide.md'), line: 7, rule: 'gspot.possessives' },
            { check: 'spelling/typos', file: posix.join(scope, 'guide.md'), line: 5, rule: undefined },
        ]);
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
