import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import type { ApplyReport } from '#cli/types/apply.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { NPM_CHECK_IGNORES } from '#tests/data/test-setup.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type DryRunJson } from '#cli/types/commands/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { stat, chmod, unlink, readFile, writeFile } from 'node:fs/promises';

// Windows reports the same mode for files writable by the owner or by everyone.
test.skipIf(isWindows)(
    'apply --dry-run lists a generated file whose mode changed, and gspot/generated-files reports it',
    async () => {
        await using sandbox = await testdir({
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
        const { stale } = JSON.parse(preview.stdout) as DryRunJson;
        expect(stale.find((entry) => entry.path === '.editorconfig')).toStrictEqual({
            path: '.editorconfig',
            kind: 'changed',
            diff: 'old mode 600\nnew mode 644\n',
        });
        const human = await runGspot(sandbox.path, ['apply', '--dry-run']);
        expect(human.code, human.stdout + human.stderr).toBe(0);
        expect(human.stdout).toContain('.editorconfig  changed');
        expect(human.stdout).toContain('old mode 600');
        expect(human.stdout).toContain('new mode 644');
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
        expect((JSON.parse(applied.stdout) as ApplyReport).written).toContain('.editorconfig');
        expect(await readFile(path)).toStrictEqual(bytes);
        const written = await stat(path);
        expect(written.mode & 0o777).toBe(0o644);
    },
);

test('a hand edit of the ESLint config shows as a byte diff without running it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
        }),
        'entry.js': 'export const value = 1;\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const path = '.gspot/configurations/language/javascript/eslint.mjs';
    const authored = 'throw new Error("The preview executed authored configuration.");\n';
    await chmod(join(sandbox.path, path), 0o644);
    await writeFile(join(sandbox.path, path), authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const changed = (JSON.parse(preview.stdout) as DryRunJson).stale.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const unrecorded = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(unrecorded.code, unrecorded.stdout + unrecorded.stderr).toBe(0);
    expect((JSON.parse(unrecorded.stdout) as DryRunJson).stale.find((entry) => entry.path === path)).toStrictEqual(
        changed,
    );
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
});

test("turned-off rules have the same stray paths in a dry run and in apply's removal", async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings([], { rules: true, tables: '[rules]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    expect(await runGspot(sandbox.path, ['apply'])).toHaveProperty('code', 0);
    const initial = await openSession(sandbox.path);
    const owned = initial.repository.files.filter((entry) => entry.path.includes('/rules/'));
    expect(owned.length).toBeGreaterThan(0);
    await writeFile(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { stale } = JSON.parse(preview.stdout) as DryRunJson;
    const strays = stale
        .filter(({ kind }) => kind === 'stray')
        .map(({ path }) => path)
        .toSorted((first, second) => first.localeCompare(second));
    const ownedPaths = owned.map(({ path }) => path).toSorted((first, second) => first.localeCompare(second));
    for (const path of ownedPaths) expect(strays).toContain(path);
    for (const path of ownedPaths) expect(await isOnDisk(join(sandbox.path, path))).toBe(true);
    const written = await runGspot(sandbox.path, ['apply', '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(
        (JSON.parse(written.stdout) as ApplyReport).removed.toSorted((first, second) => first.localeCompare(second)),
    ).toStrictEqual(strays);
    for (const path of ownedPaths) expect(await isOnDisk(join(sandbox.path, path))).toBe(false);
});
test('apply --dry-run lists missing generated files and writes nothing', async () => {
    await using folder = await testdir();
    const settings = buildSandboxSettings(['bash']);
    await createFileTree(folder.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const before = await readTree(folder.path);
    const human = await runGspot(folder.path, ['apply', '--dry-run']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toContain('Run gspot apply to write these files.\n');
    expect(await readTree(folder.path)).toStrictEqual(before);
    const preview = await runGspot(folder.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as DryRunJson;
    expect(result.dryRun).toBe(true);
    expect(result.stale).toContainEqual(
        matchFields({ path: '.gspot/configurations/language/bash/shellcheckrc', kind: 'missing' }),
    );
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await isOnDisk(join(folder.path, '.gspot'))).toBe(false);
    expect(await readTree(folder.path)).toStrictEqual(before);
});
test.each([false, true])(
    'apply --dry-run shows only a changed version pin (changed: %s) and writes nothing',
    async (isChanged) => {
        await using folder = await testdir({
            'gspot.toml': buildSandboxSettings([], { tables: NPM_CHECK_IGNORES }),
            'control.txt': 'preserve this source\n',
        });

        const applied = await runGspot(folder.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const versionContents = await readFile(join(folder.path, '.gspot/version'), 'utf8');
        const version = versionContents.trim();
        if (isChanged) await writeFile(join(folder.path, '.gspot/version'), '0.0.0\n');
        const before = await readTree(folder.path);
        const preview = await runGspot(folder.path, ['apply', '--dry-run']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(preview.stderr).toBe('');
        const banner = isChanged ? `version 0.0.0 -> ${version}\n` : '';
        if (isChanged) {
            expect(preview.stdout).toStartWith(banner);
            expect(preview.stdout).toContain('.gspot/version  changed');
            expect(preview.stdout).toContain('-0.0.0');
            expect(preview.stdout).toContain('+' + version);
            expect(preview.stdout).toEndWith('Dry run: nothing was written.\n');
        } else
            expect(preview.stdout).toBe(
                'No change: the 4 generated files are up to date.\nDry run: nothing was written.\n',
            );
        expect(await readTree(folder.path)).toStrictEqual(before);
        const structured = await runGspot(folder.path, ['apply', '--dry-run', '--json']);
        expect(structured.code, structured.stdout + structured.stderr).toBe(0);
        expect(structured.stderr).toBe('');
        const result = JSON.parse(structured.stdout) as DryRunJson;
        expect(result.pin).toStrictEqual({ from: isChanged ? '0.0.0' : version, to: version });
        if (isChanged) expect(result.stale).toMatchObject([{ path: '.gspot/version', kind: 'changed' }]);
        else expect(result.stale).toStrictEqual([]);
        expect(await readTree(folder.path)).toStrictEqual(before);
    },
);
test('apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'markdown'], { rules: true }),
        'entry.sh': 'echo example\n',
        'README.md': '# Example\n',
    });

    const applied = await runGspot(folder.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const edit = async (path: string, text: (current: string) => string): Promise<void> => {
        const full = join(folder.path, path);
        await chmod(full, 0o644);
        await writeFile(full, text(await readFile(full, 'utf8')));
    };
    await edit('.gspot/configurations/language/bash/shellcheckrc', (current) => `${current}# Edited.\n`);
    await edit(
        '.gspot/package.json',
        (current) => `<<<<<<< ours
${current}=======
>>>>>>> theirs
`,
    );
    await edit('AGENTS.md', (current) =>
        current.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    await unlink(join(folder.path, 'README.md'));
    await writeFile(join(folder.path, 'settings.json'), '{}\n');
    await writeFile(join(folder.path, 'gspot.toml'), buildSandboxSettings(['bash'], { rules: true }));
    const before = await readTree(folder.path);
    const preview = await runGspot(folder.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { stale } = JSON.parse(preview.stdout) as DryRunJson;
    expect(stale).toContainEqual(
        matchFields({
            path: '.gspot/configurations/language/bash/shellcheckrc',
            kind: 'changed',
            diff: matchSubstring('-# Edited.'),
        }),
    );
    expect(stale).toContainEqual(matchFields({ path: '.gspot/package.json', kind: 'changed' }));
    expect(stale).toContainEqual(
        matchFields({ path: 'AGENTS.md', kind: 'changed', diff: matchSubstring('-Edited inside.') }),
    );
    expect(stale).toContainEqual(
        matchFields({ path: '.gspot/configurations/language/markdown/markdownlint.jsonc', kind: 'stray' }),
    );
    expect(stale.some(({ path }) => path === 'README.md' || path === 'settings.json')).toBe(false);
    expect(await readTree(folder.path)).toStrictEqual(before);
});
