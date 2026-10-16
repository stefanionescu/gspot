import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { listStaleFiles } from '#cli/apply/stale.ts';
import { generate } from '#cli/generation/generate.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { NPM_CHECK_IGNORES } from '#tests/data/test-setup.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import { type DryRunJson } from '#cli/types/commands/edit-settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { runGspot, runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { commitAll, readGitOutput, prepareAppliedBashRepository } from '#tests/setup/git.ts';

test('a hand edit of the ESLint config shows as a byte diff without running it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            level: 'all',
        }),
        'entry.js': 'export const value = 1;\n',
    });
    const applied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(applied.exitCode, applied.text).toBe(0);
    const path = '.gspot/config/eslint.config.mjs';
    const authored = 'throw new Error("The preview executed authored configuration.");\n';
    await chmod(join(sandbox.path, path), 0o644);
    await writeFile(join(sandbox.path, path), authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const preview = await runRegisteredCommand(sandbox.path, ['apply', '--dry-run']);
    expect(preview.exitCode, preview.text).toBe(0);
    const changed = (preview.json as DryRunJson).stale.find(({ path: output }) => output === path);
    expect(changed).toMatchObject({ kind: 'changed' });
    expect(changed?.diff).toContain(authored.trim());
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    const unrecorded = await runRegisteredCommand(sandbox.path, ['apply', '--dry-run']);
    expect(unrecorded.exitCode, unrecorded.text).toBe(0);
    expect((unrecorded.json as DryRunJson).stale.find((entry) => entry.path === path)).toStrictEqual(changed);
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test("turned-off rules have the same stray paths in a dry run and in apply's removal", async () => {
    await using sandbox = await testdir();
    const settings = buildSettingsText([], { rules: true, tables: '[rules]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': settings });
    expect(await runRegisteredCommand(sandbox.path, ['apply'])).toHaveProperty('exitCode', 0);
    const initial = await openSession(sandbox.path);
    const owned = initial.repository.files.filter((entry) => entry.path.startsWith('.gspot/rules/'));
    expect(owned.length).toBeGreaterThan(0);
    await Bun.write(join(sandbox.path, 'gspot.toml'), settings.replace('enabled = true', 'enabled = false'));
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
test('a clone with changed settings and matching generated files needs no ownership log', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await prepareAppliedBashRepository(source);
    await writeFile(join(source, 'gspot.toml'), buildSettingsText(['bash'], { level: 'all' }));
    expect(await runRegisteredCommand(source, ['apply'])).toHaveProperty('exitCode', 0);
    commitAll(source);
    readGitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await isOnDisk(join(checkout, '.gspot/state/ownership.json'))).toBe(false);
    const session = await openSession(checkout);
    const generated = generate(session);
    expect(listStaleFiles(session, generated).filter((entry) => entry.kind === 'changed')).toStrictEqual([]);
});
test('apply --dry-run lists missing generated files and writes nothing', async () => {
    await using folder = await testdir();
    const settings = buildSettingsText(['bash']);
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
    expect(result.stale).toContainEqual(matchFields({ path: '.gspot/config/shellcheckrc', kind: 'missing' }));
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await isOnDisk(join(folder.path, '.gspot'))).toBe(false);
    expect(await readTree(folder.path)).toStrictEqual(before);
});
test.each([false, true])(
    'apply --dry-run shows only a changed version pin (changed: %s) and writes nothing',
    async (isChanged) => {
        await using folder = await testdir();
        await createFileTree(folder.path, {
            'gspot.toml': buildSettingsText([], { tables: NPM_CHECK_IGNORES }),
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
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash', 'markdown'], { rules: true }),
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
    await edit('.gspot/config/shellcheckrc', (current) => `${current}# Edited.\n`);
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
    await writeFile(join(folder.path, 'gspot.toml'), buildSettingsText(['bash'], { rules: true }));
    const before = await readTree(folder.path);
    const preview = await runGspot(folder.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { stale } = JSON.parse(preview.stdout) as DryRunJson;
    expect(stale).toContainEqual(
        matchFields({
            path: '.gspot/config/shellcheckrc',
            kind: 'changed',
            diff: matchSubstring('-# Edited.'),
        }),
    );
    expect(stale).toContainEqual(matchFields({ path: '.gspot/package.json', kind: 'changed' }));
    expect(stale).toContainEqual(
        matchFields({ path: 'AGENTS.md', kind: 'changed', diff: matchSubstring('-Edited inside.') }),
    );
    expect(stale).toContainEqual(matchFields({ path: '.gspot/config/markdownlint.jsonc', kind: 'stray' }));
    expect(stale.some(({ path }) => path === 'README.md' || path === 'settings.json')).toBe(false);
    expect(await readTree(folder.path)).toStrictEqual(before);
});
