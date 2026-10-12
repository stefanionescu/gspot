import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/checks.ts';
import { emitAll } from '#cli/generation/files.ts';
import { applyChanges } from '#tests/setup/files.ts';
import { sandboxPath } from '#tests/setup/install.ts';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';

import {
    MARKDOWN_CASES,
    MARKDOWN_FILES,
    MARKDOWN_SANDBOX,
    TABLE_COLUMN_SAMPLE,
    MARKDOWNLINT_SETTINGS,
    MARKDOWNLINT_EXECUTABLE,
} from '#tests/config/markdown.ts';

const installedSandbox = shareInstalledSandbox(MARKDOWN_SANDBOX);

test.each([...LEVELS])(
    "markdownlint adds lint rules at level all and applies each scope's lint rule options",
    async (level) => {
        const { root } = installedSandbox();
        await using state = new AsyncDisposableStack();
        const restore = await applyChanges(root, {
            check: 'markdown/markdownlint',
            files: {
                ...MARKDOWN_FILES,
                'gspot.toml': settingsText(['markdown'], { level, tables: MARKDOWNLINT_SETTINGS }),
            },
        });
        state.defer(async () => {
            await restore();
            const restored = await spawnGspot(root, ['apply']);
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        });
        const applied = await spawnGspot(root, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const failed = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings).toContainEqual(containing({ file: 'root.md', line: 7, rule: 'MD045' }));
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
            containing({ file: 'app/guide.md', line: 5, rule: 'MD044' }),
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
    await using state = new AsyncDisposableStack();
    const restore = await applyChanges(root, {
        check: 'markdown/markdownlint',
        files: {
            ...MARKDOWN_FILES,
            'gspot.toml': settingsText(['markdown', 'javascript'], { level: 'all', tables: MARKDOWNLINT_SETTINGS }),
            'root.md': MARKDOWN_FILES['root.md'].replace('![]', '![Request flow]'),
            'title.md': `# Title

A document with a title.
`,
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const environment = { PATH: sandboxPath() };
    for (const folder of ['', 'app']) {
        const native = await runCommand(
            [
                join(root, MARKDOWNLINT_EXECUTABLE),
                '--no-globs',
                ...(folder === '' ? [':root.md', ':title.md', ':long.md'] : [':guide.md']),
            ],
            { cwd: join(root, folder), env: environment },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
    }
});

test('markdownlint honors a lint rule ignore in the root and scope tool files', async () => {
    const { root } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const restore = await applyChanges(root, {
        check: 'markdown/markdownlint',
        files: {
            ...MARKDOWN_FILES,
            'title.md': `# Title

A document with a title.
`,
            'gspot.toml': settingsText(['markdown'], {
                level: 'all',
                tables: `${MARKDOWNLINT_SETTINGS}[[ignore]]
check = "markdown/markdownlint"
rule = "MD045"
reason = "The sample demonstrates an empty alternative."
`,
            }),
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const ignored = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const ignoredReport = JSON.parse(ignored.stdout) as RunReport;
    expect(ignoredReport.checks).toMatchObject([
        { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
        { check: 'markdown/markdownlint', scope: 'app', status: 'passed', findings: [] },
    ]);
});

test('markdownlint checks table alignment by default and the chosen table style', async () => {
    const { root } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const settings = settingsText(['markdown'], {
        level: 'all',
        tables: MARKDOWNLINT_SETTINGS.replace('MD060 = { style = "aligned" }\n', ''),
    });
    const restore = await applyChanges(root, {
        check: 'markdown/markdownlint',
        files: { 'gspot.toml': settings, 'table.md': TABLE_COLUMN_SAMPLE },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failed = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        {
            check: 'markdown/markdownlint',
            scope: '',
            status: 'failed',
            findings: [{ file: 'table.md', rule: 'MD060' }],
        },
    ]);
    await Bun.write(join(root, 'table.md'), MARKDOWN_FILES['long.md']);
    const corrected = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
    ]);
    await Bun.write(
        join(root, 'gspot.toml'),
        settingsText(['markdown'], {
            level: 'all',
            tables: MARKDOWNLINT_SETTINGS.replace('style = "aligned"', 'style = "tight"'),
        }),
    );
    const changed = await spawnGspot(root, ['apply']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const selected = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(1);
    expect((JSON.parse(selected.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: 'table.md', rule: 'MD060' }),
    );
    const tight = tightTable(MARKDOWN_FILES['long.md']);
    const passed = await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--fix', '--json']);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect((JSON.parse(passed.stdout) as RunReport).checks).toMatchObject([
        { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
    ]);
    expect(await Bun.file(join(root, 'table.md')).text()).toBe(tight);
});

test('markdownlint JSON keeps file name delimiters, positions, and fixability', async () => {
    const { root } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const paths = ['space name.md', ...(isWindows ? [] : ['name:5.md', 'line\nbreak.md'])];
    const restore = await applyChanges(root, {
        check: 'markdown/markdownlint',
        files: {
            'gspot.toml': settingsText(['markdown'], {
                level: 'all',
            }),
            ...Object.fromEntries(paths.map((path) => [path, 'café <img src="example.png">   \n'])),
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(root);
    const generated = emitAll(session);
    {
        using log = openOwnershipLog(root);
        writeGeneratedFiles(session, generated, log);
    }
    const environment = { PATH: sandboxPath() };
    const configuration = generated.files.find(({ path }) => path === '.gspot/config/markdownlint-cli2.mjs')!;
    const planned = planRun(session, { stage: 'all', only: ['markdown/markdownlint'] })[0]!;
    const command = [
        join(root, MARKDOWNLINT_EXECUTABLE),
        '--no-globs',
        '--config',
        configuration.path,
        ...paths.map((path) => `:${path}`),
    ];
    const failed = await runCommand(command, { cwd: root, env: environment });
    expect(failed.code, failed.stderr).toBe(1);
    const findings = parseOutput(planned.check, failed.stdout, failed.stderr, {
        root,
        cwd: root,
    });
    for (const file of paths) {
        expect(findings).toContainEqual(containing({ file, line: 1, column: 6, rule: 'MD045', fixable: false }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD009', fixable: true }));
        expect(findings).toContainEqual(containing({ file, line: 1, rule: 'MD041', fixable: false }));
    }
    for (const path of paths) await Bun.write(join(root, path), '# Title\n');
    const corrected = await runCommand(command, {
        cwd: root,
        env: environment,
    });
    expect(corrected.code, corrected.stderr).toBe(0);
    expect(parseOutput(planned.check, corrected.stdout, '', { root, cwd: root })).toStrictEqual([]);
});

test.each([...MARKDOWN_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await runCheckSample(installedSandbox(), entry, MARKDOWN_SANDBOX);
});

/** Remove padding from Markdown table cells while preserving surrounding prose. */
function tightTable(source: string): string {
    return source
        .split('\n')
        .map((line) =>
            line.startsWith('|')
                ? line
                      .split('|')
                      .map((cell) => cell.trim())
                      .join('|')
                : line,
        )
        .join('\n');
}
