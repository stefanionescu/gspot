import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { isWindows } from '#tests/setup/system/platform.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/ignores.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { createFileTree, type TestdirResult } from 'testdirs';
import { type DryRunJson } from '#cli/types/commands/apply.ts';
import { TEST_VERSION } from '#tests/config/commands/samples.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { GSPOT_PATHS, TOOL_LOCKFILES } from '#cli/config/gspot-folder.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { stat, chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { MISSING_GENERATED_PATHS } from '#tests/config/commands/apply/dry-run.ts';

async function createAppliedSandbox(): Promise<TestdirResult> {
    const sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: NPM_CHECK_IGNORES }),
        'control.txt': 'preserve this source\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    return sandbox;
}

test.skipIf(isWindows)(
    'apply --dry-run lists a generated file whose mode changed, and gspot/generated-files reports it',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['format']),
            'source.txt': 'authored text\n',
        });
        const initial = await runGspot(sandbox.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        const path = join(sandbox.path, '.editorconfig');
        const bytes = await readFile(path);
        await chmod(path, 0o600);
        const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        const { outdated } = JSON.parse(preview.stdout) as DryRunJson;
        expect(outdated.find((file) => file.path === '.editorconfig')).toStrictEqual({
            path: '.editorconfig',
            kind: 'changed',
            diff: 'old mode 600\nnew mode 644\n',
        });
        const human = await runGspot(sandbox.path, ['apply', '--dry-run']);
        expect(human.code, human.stdout + human.stderr).toBe(0);
        expect(human.stdout).toContain('  .editorconfig  changed\n    old mode 600\n    new mode 644');
        expect(human.stdout).toContain('Run gspot apply to write these files.');
        expect(human.stdout).toContain('Run gspot install to write the tool lockfiles.');
        expect(human.stdout.indexOf('Run gspot apply')).toBeLessThan(human.stdout.indexOf('.gspot/package-lock.json'));
        const checked = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
        );
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(
            checked.report.checks
                .flatMap(({ findings }) => findings)
                .filter((finding) => finding.file === '.editorconfig')
                .map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([{ file: '.editorconfig', rule: 'changed' }]);
        expect(await readFile(path)).toStrictEqual(bytes);
        const unchanged = await stat(path);
        expect(unchanged.mode & 0o777).toBe(0o600);
        const applied = await runGspot(sandbox.path, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect((JSON.parse(applied.stdout) as ApplyReport).written).toStrictEqual(['.editorconfig']);
        expect(await readFile(path)).toStrictEqual(bytes);
        const written = await stat(path);
        expect(written.mode & 0o777).toBe(0o644);
    },
);

test('apply --dry-run shows a hand edit of the ESLint config file as a diff without running it, and a repeated dry run shows the same diff', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'entry.js': 'export const value = 1;\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = findConfigFilePath(await openSession(sandbox.path), 'eslint');
    const written = await readFile(join(sandbox.path, path), 'utf8');
    const generated = written.split('\n').slice(0, -1);
    const authored = 'throw new Error("The preview executed authored configuration.");\n';
    await chmod(join(sandbox.path, path), 0o644);
    await writeFile(join(sandbox.path, path), authored);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const changed = (JSON.parse(preview.stdout) as DryRunJson).outdated.find(({ path: output }) => output === path);
    expect(changed).toStrictEqual({
        path,
        kind: 'changed',
        diff: [
            '===================================================================',
            `--- a/${path}\ton disk`,
            `+++ b/${path}\tgenerated`,
            `@@ -1,1 +1,${String(generated.length)} @@`,
            `-${authored.trimEnd()}`,
            ...generated.map((line) => `+${line}`),
            '',
        ].join('\n'),
    });
    const repeated = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as DryRunJson).outdated.find((file) => file.path === path)).toStrictEqual(
        changed,
    );
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.nodeModules))).toBe(false);
});

test('turning rules off lists the same rule files as stray in apply --dry-run as apply then removes', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings([], { rules: true, tables: '[rules]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    expect(await runGspot(sandbox.path, ['apply'])).toHaveProperty('code', 0);
    const initial = await openSession(sandbox.path);
    const owned = initial.repository.files.filter((file) => file.path.includes('/rules/'));
    await writeFile(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { outdated } = JSON.parse(preview.stdout) as DryRunJson;
    const strays = outdated
        .filter(({ kind }) => kind === 'stray')
        .map(({ path }) => path)
        .toSorted((first, second) => first.localeCompare(second));
    const ownedPaths = owned.map(({ path }) => path).toSorted((first, second) => first.localeCompare(second));
    expect(strays).toStrictEqual([...ownedPaths, 'AGENTS.md'].toSorted((first, second) => first.localeCompare(second)));
    for (const path of ownedPaths) expect(await isOnDisk(join(sandbox.path, path))).toBe(true);
    const written = await runGspot(sandbox.path, ['apply', '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(
        (JSON.parse(written.stdout) as ApplyReport).removed.toSorted((first, second) => first.localeCompare(second)),
    ).toStrictEqual(strays);
    for (const path of ownedPaths) expect(await isOnDisk(join(sandbox.path, path))).toBe(false);
});
test('apply --dry-run lists missing generated files and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['bash']);
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { pin, outdated } = JSON.parse(preview.stdout) as DryRunJson;
    expect(outdated.filter(({ kind }) => kind !== 'missing')).toStrictEqual([]);
    expect(outdated.map(({ path }) => path)).toStrictEqual([...MISSING_GENERATED_PATHS]);
    const human = await runGspot(sandbox.path, ['apply', '--dry-run']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    const ordinary = MISSING_GENERATED_PATHS.filter((path) => !TOOL_LOCKFILES.has(path));
    const lockfiles = MISSING_GENERATED_PATHS.filter((path) => TOOL_LOCKFILES.has(path));
    expect(human.stdout).toBe(
        [
            `version unpinned -> ${pin.to}`,
            `${String(MISSING_GENERATED_PATHS.length)} generated files need updating:`,
            '',
            ...ordinary.map((path) => `  ${path}  missing`),
            '',
            'Run gspot apply to write these files.',
            '',
            ...lockfiles.map((path) => `  ${path}  missing`),
            '',
            'Run gspot install to write the tool lockfiles.',
            '',
            'Dry run: nothing was written.',
            '',
        ].join('\n'),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
test('apply --dry-run after apply leaves missing tool lockfiles for install', async () => {
    await using sandbox = await createAppliedSandbox();
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    expect(preview.stdout).toContain('Run gspot install to write the tool lockfiles.');
    expect(preview.stdout).not.toContain('Run gspot apply to write these files.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const result = JSON.parse(structured.stdout) as DryRunJson;
    expect(result.pin).toStrictEqual({ from: cliPackage.version, to: cliPackage.version });
    expect(result.outdated).toStrictEqual([
        { path: GSPOT_PATHS.miseLockfile, kind: 'missing' },
        { path: GSPOT_PATHS.uvLockfile, kind: 'missing' },
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('apply --dry-run shows a changed version pin as a diff and writes nothing', async () => {
    await using sandbox = await createAppliedSandbox();
    await writeFile(join(sandbox.path, GSPOT_PATHS.versionPin), `${TEST_VERSION}\n`);
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stderr).toBe('');
    expect(preview.stdout).toStartWith(`version ${TEST_VERSION} -> ${cliPackage.version}\n`);
    expect(preview.stdout).toContain(`  ${GSPOT_PATHS.versionPin}  changed`);
    expect(preview.stdout).toContain(`    -${TEST_VERSION}\n    +${cliPackage.version}`);
    expect(preview.stdout).toContain('Run gspot apply to write these files.');
    expect(preview.stdout).toContain('Run gspot install to write the tool lockfiles.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const result = JSON.parse(structured.stdout) as DryRunJson;
    expect(result.pin).toStrictEqual({ from: TEST_VERSION, to: cliPackage.version });
    expect(result.outdated.filter(({ path }) => !TOOL_LOCKFILES.has(path))).toMatchObject([
        { path: GSPOT_PATHS.versionPin, kind: 'changed' },
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'markdown'], { rules: true }),
        'entry.sh': 'echo example\n',
        'README.md': '# Example\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    const shellcheckrc = findConfigFilePath(session, 'shellcheckrc');
    const markdownlint = findConfigFilePath(session, 'markdownlint');
    const edit = async (path: string, text: (current: string) => string): Promise<void> => {
        const absolute = join(sandbox.path, path);
        await chmod(absolute, 0o644);
        await writeFile(absolute, text(await readFile(absolute, 'utf8')));
    };
    await edit(shellcheckrc, (text) => `${text}# Edited.\n`);
    await edit(
        GSPOT_PATHS.npmProject,
        (text) => `<<<<<<< ours
${text}=======
>>>>>>> theirs
`,
    );
    await edit('AGENTS.md', (text) =>
        text.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    await unlink(join(sandbox.path, 'README.md'));
    await writeFile(join(sandbox.path, 'settings.json'), '{}\n');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash'], { rules: true }));
    const before = await readTree(sandbox.path);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { outdated } = JSON.parse(preview.stdout) as DryRunJson;
    expect(outdated).toContainEqual(
        matchFields({ path: shellcheckrc, kind: 'changed', diff: expect.stringContaining('-# Edited.') as string }),
    );
    expect(outdated).toContainEqual(matchFields({ path: GSPOT_PATHS.npmProject, kind: 'changed' }));
    expect(outdated).toContainEqual(
        matchFields({ path: 'AGENTS.md', kind: 'changed', diff: expect.stringContaining('-Edited inside.') as string }),
    );
    expect(outdated).toContainEqual(matchFields({ path: markdownlint, kind: 'stray' }));
    expect(outdated.map(({ path }) => path)).not.toContain('README.md');
    expect(outdated.map(({ path }) => path)).not.toContain('settings.json');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
