import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareProseSandbox } from '#tests/setup/sandboxes/create.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { PACKAGE_STYLE_CASES } from '#tests/config/integration/checks/general/prose/scopes.ts';

const installedSandbox = shareProseSandbox();

test.each([...LEVELS])(
    'prose/vale at level %s checks child files once at the root and reads the shared styles',
    async (level) => {
        const { root } = installedSandbox();
        const path = 'child/only.md';
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: {
                'gspot.toml': buildSandboxSettings([], {
                    level,
                    scopes: [{ path: 'child', configurations: ['prose', 'docs'] }],
                }),
                [path]: `# File map

Read [here](only.md).
`,
            },
        });

        const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(checked.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'failed' },
        ]);
        expect(listFindingRows(checked.report)).toStrictEqual([
            ...(level === 'all'
                ? [
                      { file: path, line: 1, rule: 'gspot.banned-headings' },
                      { file: path, line: 1, rule: 'gspot.title-case' },
                  ]
                : []),
            { file: path, line: 3, rule: 'gspot.link-text' },
        ]);
    },
);

test('a Vale ignore with a lint rule and a path keeps findings in other files', async () => {
    const { root } = installedSandbox();
    const settings = buildSandboxSettings([]);
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': settings,
            'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
            'archive.md': '# Schedule\n\nRelease on 03/04/2026.\n',
        },
    });

    const command = ['check', '--only', 'prose/vale', '--json'];
    const before = parseCheckReport(await spawnGspot(root, command));
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(listFindingRows(before.report)).toStrictEqual([
        { file: 'archive.md', line: 3, rule: 'gspot.dates' },
        { file: 'guide.md', line: 3, rule: 'gspot.dates' },
    ]);
    const ignored = await spawnGspot(root, [
        'ignore',
        'prose/vale',
        '--rule',
        'gspot.dates',
        '--paths',
        'archive.md',
        '--reason',
        'Archived dates retain their original notation.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const after = parseCheckReport(await spawnGspot(root, command));
    expect(after.code, after.stdout + after.stderr).toBe(1);
    expect(listFindingRows(after.report)).toStrictEqual([{ file: 'guide.md', line: 3, rule: 'gspot.dates' }]);
    expect(after.report.ignores).toStrictEqual([
        {
            check: 'prose/vale',
            rule: 'gspot.dates',
            paths: ['archive.md'],
            reason: 'Archived dates retain their original notation.',
        },
    ]);
    await writeFile(join(root, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await spawnGspot(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...LEVELS])(
    'prose/vale at level %s runs the gspot package rules without the Microsoft and Red Hat packages',
    async (level) => {
        const { root } = installedSandbox();
        const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
        const path = 'sample.md';
        const settings = buildSandboxSettings(['prose'], { level });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: { 'gspot.toml': settings, [path]: sample },
        });

        const appliedSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(level === 'all' ? 1 : 0);
        let line = 1;
        const expected = PACKAGE_STYLE_CASES.flatMap((row) => {
            const findings = 'findings' in row ? row.findings : [[0, row.rule] as const];
            const rows = findings.map(([offset, rule]) => ({ file: path, line: line + offset, rule }));
            line += row.sample.split('\n').length + 1;
            return rows;
        });
        expect(listFindingRows(checked.report)).toStrictEqual(level === 'all' ? expected : []);
        expect(await readFile(join(root, path), 'utf8')).toBe(sample);
        expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(appliedSettings);
        await writeFile(
            join(root, path),
            `# Guide

Read the guide.
`,
        );
        const corrected = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ scope: '', status: 'passed', findings: [] }]);
    },
);
