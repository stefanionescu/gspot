import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applyGeneratedFiles, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

const EDITORCONFIG_SAMPLES = [
    {
        file: 'line-endings.txt',
        broken: 'content\r\n',
        corrected: 'content\n',
        lines: [undefined, undefined],
    },
    {
        file: 'trailing-whitespace.txt',
        broken: 'content \n',
        corrected: 'content\n',
        lines: [1],
    },
] as const;

const STAGED_FORMAT_SOURCE = {
    staged: 'export const value = {\n  value: {\n    active: false,\n  },\n};\n',
    working: 'export const value = {\n    value: {\n        active: false,\n    },\n};\n',
} as const;

const STAGED_FORMAT_PATHS = {
    source: 'app/value.js',
    scopeConfig: `${GSPOT_PATHS.configurations}/format/scopes/app/prettier.json`,
} as const;

const STAGED_FORMAT_CHECK_ARGUMENTS = [
    'check',
    '--staged',
    '--only',
    'format/prettier',
    '--json',
    '--',
    'app/value.js',
] as const;

const YAML_SCOPE_TABLES = `[format]
indent_width = 4
[[format.override]]
paths = ["**/*.yml"]
indent_width = 2
[[scope]]
path = "app"
configurations = []
`;

const YAML_SCOPE_FILES = {
    'settings/project.yml': `parent:
  enabled: true
on:
  enabled: true
`,
    'app/settings/project.yml': `parent:
  enabled: false
on:
  enabled: false
`,
} as const;

const installedSandbox = shareInstalledSandbox({
    configurations: ['format'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
});

test('editorconfig-checker leaves indentation to the formatter and checks line endings, the final newline, and trailing spaces', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['format'], { level: 'all' }),
            'indented.txt': '\tcontent\n',
        },
    });

    const commandArguments = ['check', '--only', 'format/editorconfig-checker', '--json', '--'];
    const accepted = await spawnGspot(root, [...commandArguments, 'indented.txt']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    for (const { file, broken, corrected, lines } of EDITORCONFIG_SAMPLES) {
        await createFileTree(root, { [file]: broken });
        const rejected = parseCheckReport(await spawnGspot(root, [...commandArguments, file]));
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(rejected.report.checks).toMatchObject([{ check: 'format/editorconfig-checker', status: 'failed' }]);
        expect(rejected.report.checks[0]!.findings.map(({ file: path, line }) => ({ file: path, line }))).toStrictEqual(
            lines.map((line) => ({ file, line })),
        );
        await createFileTree(root, { [file]: corrected });
        const fixed = parseCheckReport(await spawnGspot(root, [...commandArguments, file]));
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(fixed.report.checks).toMatchObject([
            { check: 'format/editorconfig-checker', status: 'passed', findings: [] },
        ]);
    }
});

test('check --staged formats with the staged Prettier config file after a later write changes it, and leaves the working files and the index unchanged', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await writeSandboxChanges(installedSandbox(), {
        files: {
            'gspot.toml': buildSandboxSettings(['format'], {
                tables: '[format]\nindent_width = 2\n',
                scopes: [{ path: 'app' }],
            }),
            [STAGED_FORMAT_PATHS.source]: 'export const value = {\n  value: {\n    active: true,\n  },\n};\n',
        },
    });
    const rootConfig = getManifestTarget('format', 'prettier.json');

    expect(existsSync(join(root, rootConfig))).toBe(true);
    expect(existsSync(join(root, STAGED_FORMAT_PATHS.scopeConfig))).toBe(false);
    await writeFile(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.staged);
    runGitStep(root, ['add', '-A']);
    const index = runGitStep(root, ['write-tree']);
    const changed = await spawnGspot(root, ['set', 'format.indent_width', '4', '--scope', 'app']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    await applyGeneratedFiles(root);
    await writeFile(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.working);
    expect(existsSync(join(root, STAGED_FORMAT_PATHS.scopeConfig))).toBe(false);
    const files = new Map<string, string>();
    for (const path of [STAGED_FORMAT_PATHS.source, rootConfig, 'gspot.toml']) {
        files.set(path, await readFile(join(root, path), 'utf8'));
    }
    const working = await spawnGspot(
        root,
        STAGED_FORMAT_CHECK_ARGUMENTS.filter((argument) => argument !== '--staged'),
    );
    expect(working.code, working.stdout + working.stderr).toBe(0);
    const staged = parseCheckReport(await spawnGspot(root, [...STAGED_FORMAT_CHECK_ARGUMENTS]));
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    expect(staged.report.checks).toMatchObject([
        { check: 'format/prettier', scope: '', status: 'passed', fileCount: 1, findings: [] },
    ]);
    for (const [path, content] of files) expect(await readFile(join(root, path), 'utf8')).toBe(content);
    expect(runGitStep(root, ['write-tree'])).toBe(index);
});

test('Prettier keeps two-space YAML under a format override', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        removed: ['package.json'],
        files: {
            'gspot.toml': buildSandboxSettings([], { tables: YAML_SCOPE_TABLES }),
            ...YAML_SCOPE_FILES,
        },
    });
    const formatted = parseCheckReport(await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']));
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect(formatted.report.checks).toMatchObject([
        { check: 'format/prettier', scope: '', status: 'passed', findings: [] },
    ]);
});
