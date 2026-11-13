import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GENERATED_FILE_FINDINGS } from '#cli/config/configurations/gspot.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/setup/configurations.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';

test('turning rules off reports exactly the stray rule files that install removes', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings([], { rules: true, tables: '[rule_files]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    await applyGeneratedFiles(sandbox.path);
    const initial = await openSession(sandbox.path);
    const ownedPaths = initial.repository.files.filter((file) => file.path.includes('/rules/')).map(({ path }) => path);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    const strays = findings
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
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    expect(findings).not.toHaveLength(0);
    expect(findings.every(({ rule }) => rule === 'absent')).toBe(true);
    const shellcheck = getConfigPath(await openSession(sandbox.path), 'shellcheckrc');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        expect.arrayContaining([
            { file: shellcheck, rule: 'absent' },
            { file: GSPOT_PATHS.miseLockfile, rule: 'absent' },
        ]) as Array<{ file: string; rule: string | undefined }>,
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('generated-files leaves an absent mise lockfile for install after a write of the generated files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: NPM_CHECK_IGNORES }),
    });
    await applyGeneratedFiles(sandbox.path);
    const before = await readTree(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: GSPOT_PATHS.miseLockfile, rule: 'absent' },
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('gspot/generated-files reports a removed configuration file with delete help, and a stray tool lockfile with the install help', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const path = getConfigPath(session, 'shellcheckrc');
    const lockfile = `${GSPOT_FOLDER}/pnpm-lock.yaml`;
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    await writeFile(join(sandbox.path, lockfile), "lockfileVersion: '9.0'\n");
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    expect(
        findings
            .filter(({ file }) => file === path || file === lockfile)
            .map(({ file, rule, help }) => ({ file, rule, help })),
    ).toStrictEqual([
        { file: path, rule: 'stray', help: GENERATED_FILE_FINDINGS.stray.help },
        { file: lockfile, rule: 'stray', help: INSTALL_HELP },
    ]);
});
