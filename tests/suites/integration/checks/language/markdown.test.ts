import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { GUIDE, README, LICENSE } from '#tests/config/documents.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    MDX_FILES,
    MARKDOWN_FILES,
    TITLED_DOCUMENT,
    REQUEST_FLOW_IMAGE,
    MARKDOWNLINT_TABLES,
} from '#tests/config/integration/checks/language/language.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['markdown'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
});

test.each([...LEVELS])(
    `markdownlint at level %s adds MD041 only at level all and applies each scope's lint rule options`,
    async (level) => {
        const { root } = installedSandbox();
        await using _change = await writeSandboxChanges(installedSandbox(), {
            files: {
                ...MARKDOWN_FILES,
                'gspot.toml': buildSandboxSettings(['markdown'], { level, tables: MARKDOWNLINT_TABLES }),
            },
        });
        const failed = parseCheckReport(await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']));
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(listFindingRows(failed.report)).toStrictEqual([
            { file: 'root.md', line: 7, rule: 'MD045' },
            ...(level === 'all' ? [{ file: 'title.md', line: 1, rule: 'MD041' }] : []),
        ]);
        await writeFile(join(root, 'root.md'), MARKDOWN_FILES['root.md'].replace('![]', REQUEST_FLOW_IMAGE));
        await writeFile(
            join(root, 'app/guide.md'),
            MARKDOWN_FILES['app/guide.md'].replace('Nested label.', 'nested label.'),
        );
        const changed = parseCheckReport(
            await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']),
        );
        expect(changed.code, changed.stdout + changed.stderr).toBe(1);
        expect(listFindingRows(changed.report)).toStrictEqual([
            ...(level === 'all' ? [{ file: 'title.md', line: 1, rule: 'MD041' }] : []),
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
        expect(await readFile(join(root, 'root.md'), 'utf8')).toBe(
            MARKDOWN_FILES['root.md'].replace('![]', REQUEST_FLOW_IMAGE),
        );
    },
);

test("markdownlint run by an editor reads the link files with each scope's options", async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            ...MARKDOWN_FILES,
            'gspot.toml': buildSandboxSettings(['markdown', 'javascript'], {
                level: 'all',
                tables: MARKDOWNLINT_TABLES,
            }),
            'root.md': MARKDOWN_FILES['root.md'].replace('![]', REQUEST_FLOW_IMAGE),
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

test('markdownlint honors a lint rule ignore in the root and scope config files', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            ...MARKDOWN_FILES,
            'app/guide.md': `${MARKDOWN_FILES['app/guide.md']}\n![](diagram.png)\n`,
            'title.md': TITLED_DOCUMENT,
            'gspot.toml': buildSandboxSettings(['markdown'], {
                level: 'all',
                tables:
                    MARKDOWNLINT_TABLES +
                    stringify({
                        ignore: [
                            {
                                check: 'markdown/markdownlint',
                                rule: 'MD045',
                                reason: 'The sample demonstrates an empty alternative.',
                            },
                        ],
                    }),
            }),
        },
    });
    const ignored = parseCheckReport(await spawnGspot(root, ['check', '--only', 'markdown/markdownlint', '--json']));
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    expect(ignored.report.checks).toMatchObject([
        { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
        { check: 'markdown/markdownlint', scope: 'app', status: 'passed', findings: [] },
    ]);
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
    const configuration = getManifestTarget('markdown', 'markdownlint-cli2.mjs');
    expect(await isOnDisk(join(root, configuration))).toBe(true);
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
