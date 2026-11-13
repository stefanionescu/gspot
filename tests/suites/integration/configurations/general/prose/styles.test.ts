import { writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import {
    COMMENT_SOURCE,
    HEADING_CASE_GUIDE,
    PACKAGE_STYLE_CASES,
    PROSE_SANDBOX,
    STYLE_CASES,
    SUPPRESSION_COMMENTS,
    VERSION_RANGE_SOURCE,
    VOCABULARY_SOURCE,
} from '#tests/config/integration/prose.ts';
import { TYPO } from '#tests/config/setup/configurations.ts';
import { listFindingRows, parseCheckReport, spawnGspot, spawnRootCheck } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import type { FindingRow } from '#tests/types/setup.ts';

const installedSandbox = shareInstalledSandbox(PROSE_SANDBOX);

test('at level all, Vale skips ESLint and Stylelint directives and checks ordinary comment punctuation', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            'source.ts': [...SUPPRESSION_COMMENTS].join('\n'),
            'style.css': '/* stylelint-disable color-no-invalid-hex -- The vendor sheet keeps its names. */\n',
        },
    });
    const failed = await spawnRootCheck(root, 'prose/vale');
    expect(failed.status, failed.note).toBe('failed');
    expect(failed.findings).toStrictEqual([matchFields({ file: 'source.ts', line: 5, rule: 'gspot.em-dashes' })]);
    await writeFile(join(root, 'source.ts'), '// Punctuation stays checked.\n');
    const corrected = await spawnRootCheck(root, 'prose/vale');
    expect(corrected.status, corrected.note).toBe('passed');
});

test("Vale's version-range rule accepts a minimum version and reports vague ranges", async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['prose', 'markdown'], { level: 'all' }),
            'versions.md': VERSION_RANGE_SOURCE,
        },
    });

    const result = await spawnRootCheck(root, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings.filter(({ rule }) => rule === 'gspot.version-range')).toStrictEqual(
        [
            { file: 'versions.md', line: 4 },
            { file: 'versions.md', line: 5 },
            { file: 'versions.md', line: 6 },
        ].map((finding) => matchFields(finding)),
    );
});

test("Vale's heading-case rule accepts a reviewed product name and reports title case in titles and headings", async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
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
    expect(listFindingRows(result.report)).toStrictEqual(
        [2, 5, 11].map((line) => ({ file: 'guide.md', line, rule: 'gspot.heading-case' })),
    );
});

describe('with every style sample in one Vale run', () => {
    const resources = new AsyncDisposableStack();
    let findings: FindingRow[];

    beforeAll(async () => {
        const sandbox = installedSandbox();
        const files = {
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            ...Object.fromEntries(STYLE_CASES.map(({ path, source }) => [path, source])),
        };
        resources.use(await writeSandboxChanges(sandbox, { files }));
        const { report } = parseCheckReport(
            await spawnGspot(sandbox.root, ['check', '--only', 'prose/vale', '--json']),
        );
        findings = listFindingRows(report);
    });

    afterAll(() => resources.disposeAsync());

    test.each([...STYLE_CASES])(
        'Vale $rule reports the expected lines of $path and leaves its code notation alone',
        (row) => {
            expect(
                findings.filter(({ file, rule }) => file === row.path && rule === `gspot.${row.rule}`),
            ).toStrictEqual(row.findings.map((finding) => ({ file: row.path, ...finding })));
        },
    );
});

test('prose/vale at level all runs the gspot package rules without the Microsoft and Red Hat packages', async () => {
    const { root } = installedSandbox();
    const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
    const path = 'sample.md';
    const settings = buildSandboxSettings(['prose'], { level: 'all' });
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: { 'gspot.toml': settings, [path]: sample },
    });

    const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const expected = PACKAGE_STYLE_CASES.flatMap(({ findings }) =>
        findings.map(([line, rule]) => ({ file: path, line, rule })),
    );
    expect(listFindingRows(checked.report)).toStrictEqual(expected);
    await writeFile(join(root, path), '# Guide\n\nRead the guide.\n');
    const corrected = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ scope: '', status: 'passed', findings: [] }]);
});

test('Vale accepts the words listed in gspot.toml, and typos reports the misspelling, in a child scope', async () => {
    const scope = 'app';
    const { root } = installedSandbox();
    const settings = buildSandboxSettings(['prose', 'spelling'], {
        level: 'all',
        scopes: [{ path: scope, configurations: ['sql'] }],
        tables: '[spelling]\nallowed_words = { NebulaProduct = "The project product." }\n',
    });
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: { 'gspot.toml': settings, [join(scope, 'guide.md')]: VOCABULARY_SOURCE },
    });
    const result = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'prose/vale', '--only', 'spelling/typos', '--json']),
    );
    expect(
        result.report.checks.flatMap(({ check, findings }) =>
            findings.map(({ file, line, rule }) => ({ check, file, line, rule })),
        ),
    ).toStrictEqual([{ check: 'spelling/typos', file: posix.join(scope, 'guide.md'), line: 5, rule: undefined }]);
    await writeFile(
        join(root, scope, 'guide.md'),
        VOCABULARY_SOURCE.replace(TYPO.receive, 'receive').replace("Avoid vale's and ajv's.", 'Use Vale and ajv.'),
    );
    const corrected = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'prose/vale', '--only', 'spelling/typos', '--json']),
    );
    expect(corrected.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('Vale accepts passive code comments and reports passive prose in Markdown', async () => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['prose'], { level: 'all' }),
            'source.ts': COMMENT_SOURCE,
            'guide.md': "# Guide\n\nThe file is generated by ESLint's parser.\n",
        },
    });
    const result = await spawnRootCheck(root, 'prose/vale');
    expect(result.status, result.note).toBe('failed');
    expect(result.findings.filter(({ file }) => file === 'source.ts')).toStrictEqual([]);
    expect(result.findings.filter(({ rule }) => rule === 'Google.Passive')).toStrictEqual([
        matchFields({ file: 'guide.md', line: 3, rule: 'Google.Passive' }),
    ]);
});

test('prose/commit-message reports the word rules in a new commit message, and skips the comment lines of Git', async () => {
    const { root } = installedSandbox();
    const message = join(root, 'message.txt');
    await writeFile(message, 'fix(cli): keep the file\n\nWe should simply retry.\n# You should not read this.\n');
    runGitStep(root, ['add', 'gspot.toml']);
    const { report } = parseCheckReport(
        await spawnGspot(root, ['check', '--hook', 'commit-msg', '--json', '--', message]),
    );
    const findings = report.checks.find(({ check }) => check === 'prose/commit-message')?.findings ?? [];
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['gspot.modals', 'gspot.marketing']);
    expect(findings.every(({ message: text }) => text.startsWith('Line 3:'))).toBe(true);
});
