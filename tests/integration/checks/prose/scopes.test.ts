import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { PACKAGE_STYLE_CASES } from '#tests/data/checks/prose.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { shareProseSandbox, applySandboxChanges } from '#tests/setup/sandbox.ts';

const installedSandbox = shareProseSandbox();

test.each([...LEVELS])('prose/vale checks child files once at the root and reads the shared styles', async (level) => {
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
    const checks = checked.report.checks.filter((check) => check.status !== 'skipped');
    expect(checks.map((check) => check.scope)).toStrictEqual(['']);
    const result = checks[0]!;
    expect(result.status, result.note).toBe('failed');
    expect(
        result.findings
            .filter(({ rule }) => rule === 'gspot.banned-headings')
            .map(({ file, line }) => ({ file, line })),
    ).toStrictEqual(level === 'all' ? [{ file: path, line: 1 }] : []);
    expect(
        result.findings.filter(({ rule }) => rule === 'gspot.link-text').map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([{ file: path, line: 3 }]);
});
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
    const environment = {};

    const command = ['check', '--only', 'prose/vale', '--json'];
    const before = parseCheckReport(await spawnGspot(root, command, environment));
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(
        before.report.checks[0]?.findings.map(({ file, rule, line }) => ({
            file,
            rule,
            line,
        })),
    ).toStrictEqual([
        { file: 'archive.md', rule: 'gspot.dates', line: 3 },
        { file: 'guide.md', rule: 'gspot.dates', line: 3 },
    ]);
    const ignored = await spawnGspot(
        root,
        [
            'ignore',
            'prose/vale',
            '--rule',
            'gspot.dates',
            '--paths',
            'archive.md',
            '--reason',
            'Archived dates retain their original notation.',
        ],
        environment,
    );
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const after = parseCheckReport(await spawnGspot(root, command, environment));
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = after.report;
    expect(report.checks[0]?.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'guide.md', rule: 'gspot.dates' },
    ]);
    expect(report.ignores).toContainEqual(matchFields({ check: 'prose/vale', rule: 'gspot.dates' }));
    await writeFile(join(root, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...LEVELS])(
    'prose/vale at level %s runs the gspot package rules without the Microsoft and Red Hat packages',
    async (level) => {
        const { root } = installedSandbox();
        const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
        const path = 'sample.md';
        const scope = '';
        const settings = buildSandboxSettings(['prose'], { level });
        await using _sourceChange = await applySandboxChanges(installedSandbox(), {
            check: '',
            files: { 'gspot.toml': settings, [path]: sample },
        });

        const appliedSettings = await readFile(join(root, 'gspot.toml'), 'utf8');
        const checked = parseCheckReport(await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(level === 'all' ? 1 : 0);
        const result = checked.report.checks.find((check) => check.scope === scope)!;
        const rules = result.findings.map(({ rule }) => rule);
        for (const entry of PACKAGE_STYLE_CASES) {
            expect(rules.includes(entry.rule), entry.rule).toBe(level === 'all');
        }
        expect(
            rules.some((rule) => rule?.startsWith('Microsoft.') === true || rule?.startsWith('RedHat.') === true),
        ).toBe(false);
        expect(await readFile(join(root, path), 'utf8')).toBe(sample);
        expect(await readFile(join(root, 'gspot.toml'), 'utf8')).toBe(appliedSettings);
        await writeFile(
            join(root, path),
            `# Guide

Read the guide.
`,
        );
        const correctedCommand = parseCheckReport(
            await spawnGspot(root, ['check', path, '--only', 'prose/vale', '--json']),
        );
        expect(correctedCommand.code, correctedCommand.stdout + correctedCommand.stderr).toBe(0);
        const corrected = correctedCommand.report.checks.find((check) => check.scope === scope)!;
        expect(corrected.status, corrected.note).toBe('passed');
        expect(corrected.findings).toStrictEqual([]);
    },
);
