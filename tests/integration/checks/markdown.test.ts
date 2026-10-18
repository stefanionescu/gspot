import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    MARKDOWN_FILES,
    MARKDOWN_SANDBOX,
    MARKDOWNLINT_SETTINGS,
    MARKDOWNLINT_EXECUTABLE,
} from '#tests/data/checks/markdown.ts';

const installedSandbox = registerSharedSandbox(MARKDOWN_SANDBOX);

test.each([...LEVELS])(
    "markdownlint adds lint rules at level all and applies each scope's lint rule options",
    async (level) => {
        const { root } = installedSandbox();
        await using _change = await applySandboxChanges(installedSandbox(), {
            check: 'markdown/markdownlint',
            files: {
                ...MARKDOWN_FILES,
                'gspot.toml': buildSettingsText(['markdown'], { level, tables: MARKDOWNLINT_SETTINGS }),
            },
        });
        const failed = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings).toContainEqual(matchFields({ file: 'root.md', line: 7, rule: 'MD045' }));
        expect(findings.filter(({ rule }) => rule === 'MD041').map(({ file }) => file)).toStrictEqual(
            level === 'all' ? ['title.md'] : [],
        );
        expect(findings.filter(({ rule }) => rule === 'MD044')).toStrictEqual([]);
        expect(findings.filter(({ rule }) => ['MD013', 'MD033'].includes(rule ?? ''))).toStrictEqual([]);
        await Bun.write(join(root, 'root.md'), MARKDOWN_FILES['root.md'].replace('![]', '![Request flow]'));
        await Bun.write(
            join(root, 'app/guide.md'),
            MARKDOWN_FILES['app/guide.md'].replace('Nested label.', 'nested label.'),
        );
        const changed = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(changed.code, changed.stdout + changed.stderr).toBe(1);
        const changedReport = JSON.parse(changed.stdout) as RunReport;
        expect(changedReport.checks.flatMap(({ findings: entries }) => entries)).toContainEqual(
            matchFields({ file: 'app/guide.md', line: 5, rule: 'MD044' }),
        );
        const fixed = await spawnGspot(root, [
            'check',
            'app/guide.md',
            '--only',
            'markdown/markdownlint',
            '--fix',
            '--json',
        ]);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, 'app/guide.md')).text()).toBe(MARKDOWN_FILES['app/guide.md']);
        expect(await Bun.file(join(root, 'root.md')).text()).toBe(
            MARKDOWN_FILES['root.md'].replace('![]', '![Request flow]'),
        );
        await Bun.write(join(root, 'root.md'), MARKDOWN_FILES['root.md']);
    },
);

test("markdownlint run by an editor reads the pointer files with each scope's options", async () => {
    const { root } = installedSandbox();
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: 'markdown/markdownlint',
        files: {
            ...MARKDOWN_FILES,
            'gspot.toml': buildSettingsText(['markdown', 'javascript'], {
                level: 'all',
                tables: MARKDOWNLINT_SETTINGS,
            }),
            'root.md': MARKDOWN_FILES['root.md'].replace('![]', '![Request flow]'),
            'title.md': `# Title

A document with a title.
`,
        },
    });
    const environment = installedSandbox().environment;
    for (const folder of ['', 'app']) {
        const toolResult = await runCommand(
            [
                join(root, MARKDOWNLINT_EXECUTABLE),
                '--no-globs',
                ...(folder === '' ? [':root.md', ':title.md', ':long.md'] : [':guide.md']),
            ],
            { cwd: join(root, folder), env: environment },
        );
        expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(0);
    }
});

test('markdownlint honors a lint rule ignore in the root and scope tool files', async () => {
    const { root } = installedSandbox();
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: 'markdown/markdownlint',
        files: {
            ...MARKDOWN_FILES,
            'title.md': `# Title

A document with a title.
`,
            'gspot.toml': buildSettingsText(['markdown'], {
                level: 'all',
                tables: `${MARKDOWNLINT_SETTINGS}[[ignore]]
check = "markdown/markdownlint"
rule = "MD045"
reason = "The sample demonstrates an empty alternative."
`,
            }),
        },
    });
    const ignored = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const ignoredReport = JSON.parse(ignored.stdout) as RunReport;
    expect(ignoredReport.checks).toMatchObject([
        { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
        { check: 'markdown/markdownlint', scope: 'app', status: 'passed', findings: [] },
    ]);
});

test('markdownlint JSON keeps file name delimiters, positions, and fixability', async () => {
    const { root } = installedSandbox();
    const paths = ['space name.md', ...(isWindows ? [] : ['name:5.md', 'line\nbreak.md'])];
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: 'markdown/markdownlint',
        files: {
            'gspot.toml': buildSettingsText(['markdown'], {
                level: 'all',
            }),
            ...Object.fromEntries(paths.map((path) => [path, 'café <img src="example.png">   \n'])),
        },
    });
    const environment = installedSandbox().environment;
    const configuration = '.gspot/configurations/language/markdown/markdownlint-cli2.mjs';
    expect(await Bun.file(join(root, configuration)).exists()).toBe(true);
    const command = ['check', ...paths, '--only', 'markdown/markdownlint', '--json'];
    const failed = await spawnGspot(root, command, environment);
    expect(failed.code, failed.stderr).toBe(1);
    const findings = (JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings);
    for (const file of paths) {
        expect(findings).toContainEqual(matchFields({ file, line: 1, column: 6, rule: 'MD045', fixable: false }));
        expect(findings).toContainEqual(matchFields({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(matchFields({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    for (const path of paths) await Bun.write(join(root, path), '# Title\n');
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
});
