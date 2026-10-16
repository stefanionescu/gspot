import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type RunReport } from '#cli/types/checks/run/check.ts';
import { PACKAGE_STYLE_CASES } from '#tests/data/checks/prose.ts';
import { updateSandbox, shareProseSandbox } from '#tests/setup/sandbox.ts';

const installedSandbox = shareProseSandbox();

test.each([...LEVELS])('prose/vale checks child files once at the root and reads the shared styles', async (level) => {
    const sandbox = { path: installedSandbox().root };
    const path = 'child/only.md';
    await using _sourceChange = await updateSandbox(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText([], {
                level,
                tables: `[[scope]]
path = "child"

configurations = ["prose", "docs"]`,
            }),
            [path]: `# File map

Read [here](only.md).
`,
        },
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = await spawnGspot(sandbox.path, ['check', path, '--only', 'prose/vale', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = (JSON.parse(checked.stdout) as RunReport).checks.filter((check) => check.status !== 'skipped');
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
test('a Vale ignore with a lint rule and a path keeps findings in other files and counts its matches', async () => {
    const folder = { path: installedSandbox().root };
    const settings = buildSettingsText([]);
    await using _sourceChange = await updateSandbox(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': settings,
            'guide.md': '# Schedule\n\nRelease on 03/04/2026.\n',
            'archive.md': '# Schedule\n\nRelease on 03/04/2026.\n',
        },
    });
    const environment = { PATH: buildSandboxPath() };
    const applied = await spawnGspot(folder.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'prose/vale', '--json'];
    const before = await spawnGspot(folder.path, command, environment);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(
        (JSON.parse(before.stdout) as RunReport).checks[0]?.findings.map(({ file, rule, line }) => ({
            file,
            rule,
            line,
        })),
    ).toStrictEqual([
        { file: 'archive.md', rule: 'gspot.dates', line: 3 },
        { file: 'guide.md', rule: 'gspot.dates', line: 3 },
    ]);
    const ignored = await spawnGspot(
        folder.path,
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
    const after = await spawnGspot(folder.path, command, environment);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    const report = JSON.parse(after.stdout) as RunReport;
    expect(report.checks[0]?.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'guide.md', rule: 'gspot.dates' },
    ]);
    expect(report.ignores).toContainEqual(matchFields({ check: 'prose/vale', rule: 'gspot.dates', matched: 1 }));
    await writeFile(join(folder.path, 'guide.md'), '# Schedule\n\nRelease on March 4, 2026.\n');
    const corrected = await spawnGspot(folder.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([...LEVELS])(
    'prose/vale at level %s runs the gspot package rules without the Microsoft and Red Hat packages',
    async (level) => {
        const sandbox = { path: installedSandbox().root };
        const sample = PACKAGE_STYLE_CASES.map(({ sample }) => sample).join('\n\n') + '\n';
        {
            const path = 'sample.md';
            const scope = '';
            const settings = buildSettingsText(['prose'], { level });
            await using _sourceChange = await updateSandbox(installedSandbox(), {
                check: '',
                files: { 'gspot.toml': settings, [path]: sample },
            });
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const appliedSettings = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            const checked = await spawnGspot(sandbox.path, ['check', path, '--only', 'prose/vale', '--json']);
            expect(checked.code, checked.stdout + checked.stderr).toBe(level === 'all' ? 1 : 0);
            const result = (JSON.parse(checked.stdout) as RunReport).checks.find((check) => check.scope === scope)!;
            const rules = result.findings.map(({ rule }) => rule);
            for (const entry of PACKAGE_STYLE_CASES) {
                expect(rules.includes(entry.rule), entry.rule).toBe(level === 'all');
            }
            expect(
                rules.some((rule) => rule?.startsWith('Microsoft.') === true || rule?.startsWith('RedHat.') === true),
            ).toBe(false);
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(sample);
            expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(appliedSettings);
            await Bun.write(
                join(sandbox.path, path),
                `# Guide

Read the guide.
`,
            );
            const correctedCommand = await spawnGspot(sandbox.path, ['check', path, '--only', 'prose/vale', '--json']);
            expect(correctedCommand.code, correctedCommand.stdout + correctedCommand.stderr).toBe(0);
            const corrected = (JSON.parse(correctedCommand.stdout) as RunReport).checks.find(
                (check) => check.scope === scope,
            )!;
            expect(corrected.status, corrected.note).toBe('passed');
            expect(corrected.findings).toStrictEqual([]);
        }
    },
);
