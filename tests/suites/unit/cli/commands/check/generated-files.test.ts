import { existsSync } from 'node:fs';
import { chmod, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

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
        ).toMatchObject({
            file: '.editorconfig',
            rule: 'changed',
            diff: 'old mode 600\nnew mode 644\n',
        });
        const human = await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose']);
        expect(human.code).toBe(1);
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

test('turning rules off reports exactly the stray rule files that install removes', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings([], { rules: true, tables: '[rule_files]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    await applyGeneratedFiles(sandbox.path);
    const initial = await openSession(sandbox.path);
    const ownedPaths = initial.repository.files.filter((file) => file.path.includes('/rules/')).map(({ path }) => path);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
    );
    const strays = checked.report.checks
        .flatMap(({ findings }) => findings)
        .filter(({ rule }) => rule === 'stray')
        .map(({ file }) => file)
        .toSorted(compareText);
    expect(strays).toStrictEqual([...ownedPaths, 'AGENTS.md'].toSorted(compareText));
    const written = await applyGeneratedFiles(sandbox.path);
    expect(written.deleted.toSorted(compareText)).toStrictEqual(strays);
    for (const path of ownedPaths) expect(existsSync(join(sandbox.path, path))).toBe(false);
});

test('generated-files reports absent files and tool lockfiles without writing them', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(sandbox.path);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
    );
    expect(checked.code).toBe(1);
    const findings = checked.report.checks.flatMap(({ findings }) => findings);
    expect(findings.every(({ rule }) => rule === 'absent')).toBe(true);
    expect(findings.find(({ file }) => file === '.gspot/configurations/bash/shellcheckrc')).toMatchObject({
        rule: 'absent',
        help: 'Run gspot install.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([{ configurations: [], lockfiles: [GSPOT_PATHS.miseLockfile] }])(
    'generated-files leaves absent $lockfiles for install after a write of the generated files',
    async ({ configurations, lockfiles }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(configurations, { tables: NPM_CHECK_IGNORES }),
        });
        await applyGeneratedFiles(sandbox.path);
        const before = await readTree(sandbox.path);
        const checked = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
        );
        expect(
            checked.report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual(lockfiles.map((file) => ({ file, rule: 'absent' })));
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('generated-files compares edited files, a conflict and managed blocks while leaving unrelated files alone', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'markdown'], { rules: true }),
        'entry.sh': 'echo example\n',
        'README.md': '# Example\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const shellcheckrc = getConfigPath(session, 'shellcheckrc');
    for (const path of [shellcheckrc, GSPOT_PATHS.npmProject, 'AGENTS.md']) {
        const absolute = join(sandbox.path, path);
        const text = await readFile(absolute, 'utf8');
        await chmod(absolute, 0o644);
        const prefix = path === shellcheckrc ? '' : '<'.repeat(7) + ' ours\n';
        const edited =
            path === 'AGENTS.md'
                ? text.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->')
                : `${prefix}${text}# Edited.\n`;
        await writeFile(absolute, edited);
    }
    await unlink(join(sandbox.path, 'README.md'));
    await writeFile(join(sandbox.path, 'settings.json'), '{}\n');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash'], { rules: true }));
    const before = await readTree(sandbox.path);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--verbose', '--json']),
    );
    const findings = checked.report.checks.flatMap(({ findings }) => findings);
    expect(findings.find(({ file }) => file === 'AGENTS.md')?.diff).toContain('-Edited inside.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
