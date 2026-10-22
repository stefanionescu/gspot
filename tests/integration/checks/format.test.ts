import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    STAGED_FORMAT_FILES,
    STAGED_FORMAT_PATHS,
    EDITORCONFIG_SAMPLES,
    STAGED_FORMAT_SOURCE,
    PRETTIER_OPTIONS_BY_FILE,
    FORMAT_OVERRIDES_SETTINGS,
    STAGED_FORMAT_CHECK_ARGUMENTS,
    STAGED_FORMAT_CHANGE_ARGUMENTS,
} from '#tests/data/checks/format.ts';

/** Check each generated formatter override against the bytes written by Prettier. */
async function assertFormatOverrides(root: string): Promise<void> {
    const commandArguments = ['check', '--only', 'format/prettier', '--json'];
    const files = PRETTIER_OPTIONS_BY_FILE.map(({ file }) => file);
    const before = parseCheckReport(await spawnGspot(root, [...commandArguments, '--', ...files]));
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const report = before.report;
    expect(
        report.checks
            .flatMap(({ findings }) => findings.map(({ file }) => file))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(files.toSorted((left, right) => left.localeCompare(right)));
    const corrected = await spawnGspot(root, [...commandArguments, '--fix', '--', ...files]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const { file, tabWidth, singleQuote, semi, endOfLine } of PRETTIER_OPTIONS_BY_FILE) {
        const quote = singleQuote ? "'" : '"';
        const terminator = semi ? ';' : '';
        const ending = endOfLine === 'crlf' ? '\r\n' : '\n';
        expect(await readFile(join(root, file), 'utf8')).toBe(
            [
                `const greeting = ${quote}hello${quote}${terminator}`,
                'if (greeting) {',
                `${' '.repeat(tabWidth)}console.log(greeting)${terminator}`,
                '}',
                '',
            ].join(ending),
        );
    }
    const editor = await spawnGspot(
        root,
        ['check', '--only', 'format/editorconfig-checker', '--json', '--', ...files],
        {},
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
}

const installedSandbox = shareInstalledSandbox({
    configurations: ['format'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
});

test('Prettier writes each file with the tab width, quotes, semicolons, and line ending of its format override', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': FORMAT_OVERRIDES_SETTINGS,
            ...Object.fromEntries(
                PRETTIER_OPTIONS_BY_FILE.map(({ file }) => [
                    file,
                    'const greeting="hello";if(greeting){console.log(greeting);}',
                ]),
            ),
        },
    });
    await assertFormatOverrides(root);
});

test('editorconfig-checker leaves indentation to the formatter and checks line endings, the final newline, and trailing spaces', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSandboxSettings(['format'], { level: 'all' }),
            'indented.txt': '\tcontent\n',
        },
    });

    const commandArguments = ['check', '--only', 'format/editorconfig-checker', '--json', '--'];
    const environment = {};
    const accepted = await spawnGspot(root, [...commandArguments, 'indented.txt'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await readFile(join(root, 'indented.txt'), 'utf8')).toBe('\tcontent\n');
    for (const { file, broken, corrected } of EDITORCONFIG_SAMPLES) {
        await createFileTree(root, { [file]: broken });
        const rejected = parseCheckReport(await spawnGspot(root, [...commandArguments, file], environment));
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = rejected.report;
        expect(report.checks).toMatchObject([{ check: 'format/editorconfig-checker', status: 'failed' }]);
        expect(new Set(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file)))).toStrictEqual(
            new Set([file]),
        );
        expect(await readFile(join(root, file), 'utf8')).toBe(broken);
        await createFileTree(root, { [file]: corrected });
        const fixed = parseCheckReport(await spawnGspot(root, [...commandArguments, file], environment));
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(fixed.report.checks).toMatchObject([
            { check: 'format/editorconfig-checker', status: 'passed', findings: [] },
        ]);
        expect(await readFile(join(root, file), 'utf8')).toBe(corrected);
    }
});

test('check --staged formats with the staged Prettier tool file after a later apply changes it, and leaves the working files and the index unchanged', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await applySandboxChanges(installedSandbox(), {
        check: '',
        files: STAGED_FORMAT_FILES,
    });

    expect(await isOnDisk(join(root, STAGED_FORMAT_PATHS.rootConfig))).toBe(true);
    expect(await isOnDisk(join(root, STAGED_FORMAT_PATHS.scopeConfig))).toBe(false);
    const originalConfig = await readFile(join(root, STAGED_FORMAT_PATHS.rootConfig), 'utf8');
    await writeFile(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.staged);
    runGitStep(root, ['add', '-A']);
    const index = runGitStep(root, ['write-tree']);
    const changed = await spawnGspot(root, [...STAGED_FORMAT_CHANGE_ARGUMENTS]);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await writeFile(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.working);
    expect(await isOnDisk(join(root, STAGED_FORMAT_PATHS.scopeConfig))).toBe(false);
    expect(await readFile(join(root, STAGED_FORMAT_PATHS.rootConfig), 'utf8')).not.toBe(originalConfig);
    const files = new Map<string, string>();
    for (const path of Object.values(STAGED_FORMAT_PATHS).filter((path) => path !== STAGED_FORMAT_PATHS.scopeConfig))
        files.set(path, await readFile(join(root, path), 'utf8'));
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
