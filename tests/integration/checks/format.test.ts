import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { readGitOutput } from '#tests/setup/git.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

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

const installedSandbox = registerSharedSandbox({
    configurations: ['format'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
});

test('Prettier uses the format overrides, and an ignore on one path stops its findings until unignore', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await updateSandbox(installedSandbox(), {
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
    await verifyFormatOverrides(root);
    const reason = 'Generated outputs retain their upstream layout except the reviewed file.';
    await createFileTree(root, {
        'generated/kept.json': '{"value":1}',
        'generated/review.json': '{"value":1}',
    });
    const excluded = await spawnGspot(root, [
        'ignore',
        'format/prettier',
        '--paths',
        'generated/kept.json',
        '--reason',
        reason,
    ]);
    expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
    const commandArguments = [
        'check',
        '--only',
        'format/prettier',
        '--json',
        '--',
        'generated/kept.json',
        'generated/review.json',
    ];
    const failed = await spawnGspot(root, commandArguments);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'generated/review.json' },
    ]);
    const fixed = await spawnGspot(root, [...commandArguments.slice(0, 4), '--fix', ...commandArguments.slice(4)]);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await readFile(join(root, 'generated/kept.json'), 'utf8')).toBe('{"value":1}');
    expect(JSON.parse(await readFile(join(root, 'generated/review.json'), 'utf8'))).toStrictEqual({ value: 1 });
    const removed = await spawnGspot(root, ['unignore', 'format/prettier', '--paths', 'generated/kept.json']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const exposed = await spawnGspot(root, commandArguments);
    expect(exposed.code, exposed.stdout + exposed.stderr).toBe(1);
    expect((JSON.parse(exposed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'generated/kept.json' },
    ]);
    const corrected = await spawnGspot(root, [...commandArguments.slice(0, 4), '--fix', ...commandArguments.slice(4)]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.every(({ findings }) => findings.length === 0)).toBe(
        true,
    );
});

test('editorconfig-checker leaves indentation to the formatter and checks line endings, the final newline, and trailing spaces', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await updateSandbox(installedSandbox(), {
        check: '',
        files: {
            'gspot.toml': buildSettingsText(['format'], { level: 'all' }),
            'indented.txt': '\tcontent\n',
        },
    });
    const configured = await spawnGspot(root, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const commandArguments = ['check', '--only', 'format/editorconfig-checker', '--json', '--'];
    const environment = { PATH: buildSandboxPath() };
    const accepted = await spawnGspot(root, [...commandArguments, 'indented.txt'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await readFile(join(root, 'indented.txt'), 'utf8')).toBe('\tcontent\n');
    for (const { file, broken, corrected } of EDITORCONFIG_SAMPLES) {
        await createFileTree(root, { [file]: broken });
        const rejected = await spawnGspot(root, [...commandArguments, file], environment);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const report = JSON.parse(rejected.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: 'format/editorconfig-checker', status: 'failed' }]);
        expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toContain(file);
        expect(await readFile(join(root, file), 'utf8')).toBe(broken);
        await createFileTree(root, { [file]: corrected });
        const fixed = await spawnGspot(root, [...commandArguments, file], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect((JSON.parse(fixed.stdout) as RunReport).checks).toMatchObject([
            { check: 'format/editorconfig-checker', status: 'passed', findings: [] },
        ]);
        expect(await readFile(join(root, file), 'utf8')).toBe(corrected);
    }
});

test('staged Prettier uses the indexed format before a later scoped apply and preserves working files', async () => {
    const root = installedSandbox().root;
    await using _sourceChange = await updateSandbox(installedSandbox(), { check: '', files: STAGED_FORMAT_FILES });
    const configured = await spawnGspot(root, ['apply']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    expect(await Bun.file(join(root, STAGED_FORMAT_PATHS.rootConfig)).exists()).toBe(true);
    expect(await Bun.file(join(root, STAGED_FORMAT_PATHS.scopeConfig)).exists()).toBe(false);
    const originalConfig = await readFile(join(root, STAGED_FORMAT_PATHS.rootConfig), 'utf8');
    await Bun.write(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.staged);
    readGitOutput(root, ['add', '-A']);
    const index = readGitOutput(root, ['write-tree']);
    const changed = await spawnGspot(root, [...STAGED_FORMAT_CHANGE_ARGUMENTS]);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await Bun.write(join(root, STAGED_FORMAT_PATHS.source), STAGED_FORMAT_SOURCE.working);
    expect(await Bun.file(join(root, STAGED_FORMAT_PATHS.scopeConfig)).exists()).toBe(false);
    expect(await readFile(join(root, STAGED_FORMAT_PATHS.rootConfig), 'utf8')).not.toBe(originalConfig);
    const files = new Map<string, string>();
    for (const path of Object.values(STAGED_FORMAT_PATHS).filter((path) => path !== STAGED_FORMAT_PATHS.scopeConfig))
        files.set(path, await readFile(join(root, path), 'utf8'));
    const working = await spawnGspot(
        root,
        STAGED_FORMAT_CHECK_ARGUMENTS.filter((argument) => argument !== '--staged'),
    );
    expect(working.code, working.stdout + working.stderr).toBe(0);
    const staged = await spawnGspot(root, [...STAGED_FORMAT_CHECK_ARGUMENTS]);
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    expect((JSON.parse(staged.stdout) as RunReport).checks).toMatchObject([
        { check: 'format/prettier', scope: '', status: 'passed', fileCount: 1, findings: [] },
    ]);
    for (const [path, content] of files) expect(await readFile(join(root, path), 'utf8')).toBe(content);
    expect(readGitOutput(root, ['write-tree'])).toBe(index);
});

/** Check each generated formatter override against the bytes written by Prettier. */
async function verifyFormatOverrides(root: string): Promise<void> {
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const commandArguments = ['check', '--only', 'format/prettier', '--json'];
    const files = PRETTIER_OPTIONS_BY_FILE.map(({ file }) => file);
    const before = await spawnGspot(root, [...commandArguments, '--', ...files]);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    const report = JSON.parse(before.stdout) as RunReport;
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
        {
            PATH: buildSandboxPath(),
        },
    );
    expect(editor.code, editor.stdout + editor.stderr).toBe(0);
}
