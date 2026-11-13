import { appendFile, chmod, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import { openSession } from '#cli/engine/session.ts';
import { listFindingRows, parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

const GENERATED_FILES_CHECK = ['check', '--only', 'gspot/generated-files', '--json'] as const;

/**
Build a sandbox with one import rule, its generated files, and fresh tool lockfiles, so that `gspot/generated-files`
reports nothing. Pass a record to write a further import rule by hand, which leaves the generated ESLint config stale.
*/
async function createRuledSandbox(record?: string) {
    const sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[[import_rule]]\nname = "core"\npaths = ["src/core/**"]\n',
        }),
        'package.json': '{"private":true,"type":"module","packageManager":"bun@1.4.2"}\n',
        'src/core/value.js': 'export const value = 1;\n',
        'src/features/total.js': 'export const total = 2;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    await applyGeneratedFiles(sandbox.path);
    if (record !== undefined) await appendFile(join(sandbox.path, 'gspot.toml'), record);
    return sandbox;
}

test.skipIf(isWindows)(
    'generated-files shows a mode-only difference under verbose without changing the file',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['format']),
            'source.txt': 'authored text\n',
        });
        await applyGeneratedFiles(sandbox.path);
        const path = join(sandbox.path, '.editorconfig');
        await chmod(path, 0o600);
        const checked = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose', '--json']),
        );
        expect(checked.code).toBe(1);
        expect(
            checked.report.checks.flatMap(({ findings }) => findings).find(({ file }) => file === '.editorconfig'),
        ).toMatchObject({ rule: 'changed', diff: 'old mode 600\nnew mode 644\n' });
        const { mode } = await stat(path);
        expect(mode & 0o777).toBe(0o600);
    },
);

test('generated-files adds repeatable diffs only under verbose and never executes the edited config', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'entry.js': 'export const value = 1;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const path = getConfigPath(await openSession(sandbox.path), 'eslint');
    const authored = 'throw new Error("The check executed authored configuration.");\n';
    await chmod(join(sandbox.path, path), 0o644);
    await writeFile(join(sandbox.path, path), authored);
    const concise = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
    );
    expect(concise.code).toBe(1);
    const finding = concise.report.checks.flatMap(({ findings }) => findings).find(({ file }) => file === path);
    expect(finding).toMatchObject({ file: path, rule: 'changed' });
    expect(finding).not.toHaveProperty('diff');
    const first = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose', '--json']),
    );
    const changed = first.report.checks.flatMap(({ findings }) => findings).find(({ file }) => file === path);
    expect(changed?.diff).toContain(`-${authored.trimEnd()}`);
    const repeated = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose', '--json']),
    );
    expect(repeated.report.checks.flatMap(({ findings }) => findings).find(({ file }) => file === path)).toStrictEqual(
        changed,
    );
    const human = await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose']);
    expect(human.stdout).toContain(`    --- a/${path}\ton disk`);
    expect(human.stdout).toContain(`    -${authored.trimEnd()}`);
});

test('generated-files reports an edit inside a managed block with the diff of the block', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'entry.sh': 'echo example\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const path = join(sandbox.path, 'AGENTS.md');
    const text = await readFile(path, 'utf8');
    await writeFile(
        path,
        text.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    const before = await readTree(sandbox.path);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose', '--json']),
    );
    expect(checked.code).toBe(1);
    expect(
        checked.report.checks.flatMap(({ findings }) => findings).find(({ file }) => file === 'AGENTS.md'),
    ).toMatchObject({ rule: 'changed', diff: expect.stringContaining('-Edited inside.') as string });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('check --fix rewrites the generated files after a hand-edited import rule', async () => {
    await using sandbox = await createRuledSandbox(
        '\n[[import_rule]]\nname = "features"\npaths = ["src/features/**"]\n',
    );
    const eslint = getConfigPath(await openSession(sandbox.path), 'eslint');

    const fixed = parseCheckReport(await runGspot(sandbox.path, [...GENERATED_FILES_CHECK, '--fix']));

    expect({ code: fixed.code, fixes: fixed.report.fixes, findings: listFindingRows(fixed.report) }).toStrictEqual({
        code: 0,
        fixes: {
            results: [{ check: 'gspot/generated-files', status: 'changed', changed: [eslint] }],
            changed: [eslint],
            broken: [],
            conflicted: [],
        },
        findings: [],
    });
    expect(await readFile(join(sandbox.path, eslint), 'utf8')).toContain('src/features/**');
    const { written, updated, deleted } = await applyGeneratedFiles(sandbox.path);
    expect({ written, updated, deleted }).toStrictEqual({ written: [], updated: [], deleted: [] });
    const checked = parseCheckReport(await runGspot(sandbox.path, GENERATED_FILES_CHECK));
    expect({ code: checked.code, findings: listFindingRows(checked.report) }).toStrictEqual({ code: 0, findings: [] });
});

test('a plain check reports the stale generated file as fixable and leaves every file byte for byte', async () => {
    await using sandbox = await createRuledSandbox(
        '\n[[import_rule]]\nname = "features"\npaths = ["src/features/**"]\n',
    );
    const eslint = getConfigPath(await openSession(sandbox.path), 'eslint');
    const before = await readTree(sandbox.path);

    const checked = parseCheckReport(await runGspot(sandbox.path, GENERATED_FILES_CHECK));

    expect(checked.code).toBe(1);
    expect(
        checked.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file, rule, fixable }) => ({ file, rule, fixable })),
    ).toStrictEqual([{ file: eslint, rule: 'changed', fixable: true }]);
    expect(checked.report.fixes).toBeNull();
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('check --fix leaves a stale tool lockfile to gspot install', async () => {
    await using sandbox = await createRuledSandbox();
    const lockfile = `${GSPOT_FOLDER}/bun.lock`;
    await writeFile(join(sandbox.path, lockfile), '{}\n');
    const before = await readTree(sandbox.path);

    const fixed = parseCheckReport(await runGspot(sandbox.path, [...GENERATED_FILES_CHECK, '--fix']));

    expect(fixed.code).toBe(1);
    expect(
        fixed.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ file, rule, help, fixable }) => ({ file, rule, help, fixable })),
    ).toStrictEqual([{ file: lockfile, rule: 'changed', help: INSTALL_HELP, fixable: false }]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
