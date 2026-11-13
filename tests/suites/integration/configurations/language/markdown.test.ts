import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { compareText } from '#cli/system/text/order.ts';
import { GUIDE } from '#tests/config/integration/language.ts';
import { LICENSE, README } from '#tests/config/setup/configurations.ts';
import { listFindingRows, parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

const MARKDOWN_FILES = {
    'root.md': `# Root

## Notes

Root label.

![](diagram.png)
`,
    'app/guide.md': `# Guide

## Notes

Nested label.
`,
    'title.md': 'A document without a title.\n',
    'long.md': `# Long

Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter.

<span>Inline HTML stays permitted.</span>

| Name | Value |
| ---- | ----- |
| A    | B     |
`,
} as const;

const MDX_FILES = {
    'policy.mdx': `import { Notice } from './notice';
import Updated from './updated';

export const metadata = {
    description: 'How the shop keeps your data.',
};

# Privacy

The shop keeps your order history.
`,
    'untitled.mdx': `import { Notice } from './notice';

The page has no heading.
`,
} as const;

const MARKDOWNLINT_TABLES = `[format]
indent_width = 6
[tools.markdownlint.rules]
MD044 = { names = ["Root label"], code_blocks = false }
MD060 = { style = "aligned" }
[[scope]]
path = "app"

configurations = []
[scope.tools.markdownlint.rules]
MD044 = { names = ["Nested label"] }
`;

const TITLED_DOCUMENT = '# Title\n\nA document with a title.\n';

const REQUEST_FLOW_IMAGE = '![Request flow]';

const installedSandbox = shareInstalledSandbox({
    configurations: ['markdown'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
});

test("markdownlint at level all reports MD041 and a link text that gspot prohibits, and applies each scope's lint rule options", async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            ...MARKDOWN_FILES,
            'links.md': '# Links\n\nRead [docs](root.md).\n',
            'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all', tables: MARKDOWNLINT_TABLES }),
        },
    });
    const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([
        { file: 'links.md', line: 3, rule: 'MD059' },
        { file: 'root.md', line: 7, rule: 'MD045' },
        { file: 'title.md', line: 1, rule: 'MD041' },
    ]);
    const described = MARKDOWN_FILES['root.md'].replace('![]', () => REQUEST_FLOW_IMAGE);
    await writeFile(join(root, 'root.md'), described);
    await writeFile(join(root, 'links.md'), '# Links\n\nRead [the root page](root.md).\n');
    await writeFile(
        join(root, 'app/guide.md'),
        MARKDOWN_FILES['app/guide.md'].replace('Nested label.', 'nested label.'),
    );
    const changed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']));
    expect(changed.code, changed.stdout + changed.stderr).toBe(1);
    expect(listFindingRows(changed.report)).toStrictEqual([
        { file: 'title.md', line: 1, rule: 'MD041' },
        { file: 'app/guide.md', line: 5, rule: 'MD044' },
    ]);
    const fixed = await spawnGspot(root, [
        'check',
        'app/guide.md',
        '--only',
        'markdown/markdownlint',
        '--fix',
        '--json',
    ]);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, 'app/guide.md'), 'utf8')).toBe(MARKDOWN_FILES['app/guide.md']);
});

test("markdownlint run by an editor reads the pointer files with each scope's options", async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            ...MARKDOWN_FILES,
            'gspot.toml': buildSandboxSettings(['markdown', 'javascript'], {
                level: 'all',
                tables: MARKDOWNLINT_TABLES,
            }),
            'root.md': MARKDOWN_FILES['root.md'].replace('![]', () => REQUEST_FLOW_IMAGE),
            'title.md': TITLED_DOCUMENT,
        },
    });
    for (const folder of ['', 'app']) {
        const toolResult = await runCommand(
            [
                join(root, `${GSPOT_PATHS.nodeModules}/.bin/markdownlint-cli2`),
                '--no-globs',
                ...(folder === '' ? [':root.md', ':title.md', ':long.md'] : [':guide.md']),
            ],
            { cwd: join(root, folder) },
        );
        expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(0);
        const path = folder === '' ? 'root.md' : 'guide.md';
        const label = folder === '' ? 'root label' : 'nested label';
        await writeFile(join(root, folder, path), `# Title\n\n${label}.\n`);
        const invalid = await runCommand(
            [join(root, `${GSPOT_PATHS.nodeModules}/.bin/markdownlint-cli2`), '--no-globs', `:${path}`],
            { cwd: join(root, folder) },
        );
        expect(invalid.code).toBe(1);
        const output = invalid.stdout + invalid.stderr;
        expect(output).toContain(`${path}:3`);
        expect(output).toContain('MD044/proper-names');
    }
});

test('markdownlint reports line, column, and fixable for findings in files whose names hold a space, a colon, or a line break', async () => {
    const { root } = installedSandbox();
    const paths = ['space name.md', ...(isWindows ? [] : ['name:5.md', 'line\nbreak.md'])];
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all' }),
            ...Object.fromEntries(paths.map((path) => [path, 'café <img src="example.png"> https://example.com\n'])),
        },
    });
    const command = ['check', ...paths, '--only', 'markdown/markdownlint', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) =>
            findings.map(({ file, line, column, rule, fixable }) => ({ file, line, column, rule, fixable })),
        ),
    ).toStrictEqual(
        paths.toSorted(compareText).flatMap((file) => [
            { file, line: 1, column: 30, rule: 'MD034', fixable: true },
            { file, line: 1, column: undefined, rule: 'MD041', fixable: false },
            { file, line: 1, column: 6, rule: 'MD045', fixable: false },
        ]),
    );
    for (const path of paths) await writeFile(join(root, path), '# Title\n');
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stderr).toBe(0);
    expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
});

test('markdownlint reads an MDX page from after its import and export blocks', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: { 'gspot.toml': buildSandboxSettings(['markdown'], { level: 'all' }), ...MDX_FILES },
    });
    const command = ['check', ...Object.keys(MDX_FILES), '--only', 'markdown/markdownlint', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ file: 'untitled.mdx', line: 3, rule: 'MD041' }),
    ]);
    await writeFile(join(root, 'untitled.mdx'), MDX_FILES['untitled.mdx'].replace('The page', '# Notice\n\nThe page'));
    const corrected = await spawnGspot(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
