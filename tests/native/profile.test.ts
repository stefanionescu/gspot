import { join } from 'node:path';
import { chmodSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { exportCommand } from '#cli/profile/command.ts';
import { applyCommand } from '#cli/emit/apply-command.ts';
import { applyUninstall, planUninstall } from '#cli/lifecycle/uninstall-command.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { stringify } from 'smol-toml';
import { exportedProfile } from '#cli/profile/export.ts';
import { readProfile } from '#cli/profile/read.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';
import { runBlocking } from '#cli/platform/spawn.ts';

describe('profile file paths', () => {
    test('an absolute profile loads from a different working directory', async () => {
        const source = 'policies/café house.profile.toml';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [source]: 'version = 1\nprofile = "house"\nselection = "exact"\npresets = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await readProfile(source, sandbox.path);
        const absolute = await readProfile(join(sandbox.path, source), join(sandbox.path, 'project'));
        expect(absolute.tables).toEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});

test('profile tool settings survive adoption of another setting for the same tool', async () => {
    await using directory = await testdir();
    const original = '[default]\nlocale = "en-gb"\n';
    const profile = exportedProfile(
        stringify({
            version: 1,
            presets: ['spelling'],
            tools: { typos: { words: [{ word: 'teh', reason: 'A domain term used by the team.' }] } },
        }),
        'team.profile.toml',
    );
    await createFileTree(directory.path, {
        'team.profile.toml': profile.text,
        'typos.toml': original,
        'sample.txt': 'colour teh\n',
    });
    const options = {
        cwd: directory.path,
        from: 'team.profile.toml',
        yes: true,
        json: true,
        hooks: 'none',
        ci: 'none',
        runner: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    expect((await initCommand({ ...options, isDryRun: true })).exitCode).toBe(0);
    expect(readFileSync(join(directory.path, 'typos.toml'), 'utf8')).toBe(original);
    expect((await initCommand({ ...options, isDryRun: false })).exitCode).toBe(0);
    const check = () =>
        runBlocking(['typos', '--isolated', '--config', '.gspot/typos.toml', 'sample.txt'], {
            cwd: directory.path,
        });
    const accepted = check();
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    await Bun.write(join(directory.path, 'sample.txt'), 'colour teh wrod\n');
    const defect = check();
    expect(defect.code).toBe(2);
    expect(defect.stdout).toContain('wrod');
    await Bun.write(join(directory.path, 'sample.txt'), 'colour teh word\n');
    expect(check().code).toBe(0);
    applyUninstall(directory.path, planUninstall(directory.path));
    expect(readFileSync(join(directory.path, 'typos.toml'), 'utf8')).toBe(original);
});

test.each(['jest', 'vitest'])(
    'profiles retain %s coverage settings and omit repository support directories',
    async (preset) => {
        await using directory = await testdir();
        const reusable = { coverage_lines: 90, ...(preset === 'jest' ? { global_package: 'bun:test' } : {}) };
        const exported = exportedProfile(
            stringify({
                version: 1,
                presets: [preset],
                tools: { [preset]: { ...reusable, harness_directory: 'tests/fixtures' } },
            }),
            'shared.profile.toml',
        );
        await createFileTree(directory.path, { 'shared.profile.toml': exported.text });
        const restored = await readProfile('shared.profile.toml', directory.path);
        expect(restored.tables.tools?.[preset]).toEqual(reusable);
        expect(exported.leftOut).toEqual([`tools.${preset}.harness_directory: names a repository path`]);
        await createFileTree(directory.path, {
            'invalid.profile.toml': stringify({
                version: 1,
                profile: 'local',
                selection: 'exact',
                presets: [preset],
                tools: { [preset]: { harness_directory: 'tests/fixtures' } },
            }),
        });
        await expect(readProfile('invalid.profile.toml', directory.path)).rejects.toThrow('a profile carries no path');
    },
);

test('profile export omits local ESLint registrations and selector bases while preserving reusable processors', async () => {
    await using directory = await testdir();
    const reusable = {
        name: 'package processor',
        processor: { module: 'eslint-plugin-example', export: 'default', members: ['processors', 'source'] },
    };
    const source = stringify({
        version: 1,
        presets: ['javascript'],
        tools: {
            eslint: {
                adopted: [
                    { name: 'local selector', basePath: 'src', rules: { eqeqeq: 'error' } },
                    { name: 'local processor', processor: { module: './processing.mjs', export: 'default' } },
                    reusable,
                ],
            },
        },
    });
    const exported = exportedProfile(source, 'shared.profile.toml');
    expect(exported.leftOut).toHaveLength(2);
    await createFileTree(directory.path, { 'shared.profile.toml': exported.text });
    const restored = await readProfile('shared.profile.toml', directory.path);
    expect(restored.tables.tools?.eslint?.adopted).toEqual([reusable]);
    await createFileTree(directory.path, {
        'invalid.profile.toml': stringify({
            version: 1,
            profile: 'local',
            selection: 'exact',
            presets: ['javascript'],
            tools: { eslint: { adopted: [{ processor: { module: './processing.mjs', export: 'default' } }] } },
        }),
    });
    await expect(readProfile('invalid.profile.toml', directory.path)).rejects.toThrow('a profile carries no path');
});

test('profile export omits complete EditorConfig documents and preserves reusable formatting options', async () => {
    await using directory = await testdir();
    const adopted = {
        preamble: { root: 'true' },
        sections: [{ glob: '*.js', properties: { indent_size: '3' } }],
        directories: [
            { basePath: 'nested', preamble: {}, sections: [{ glob: '*', properties: { indent_size: '4' } }] },
        ],
    };
    const exported = exportedProfile(
        stringify({
            version: 1,
            presets: ['formatting'],
            format: { quotes: 'single' },
            tools: { editorconfig: { adopted } },
        }),
        'shared.profile.toml',
    );
    await createFileTree(directory.path, { 'shared.profile.toml': exported.text });
    const restored = await readProfile('shared.profile.toml', directory.path);
    expect(restored.tables.tools?.editorconfig?.adopted).toBeUndefined();
    expect(restored.tables.format?.quotes).toBe('single');
    expect(exported.leftOut.some((entry) => entry.includes('tools.editorconfig.adopted'))).toBe(true);
});

test('profile publication is idempotent, preserves edits, and survives apply and uninstall', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n' });
    expect((await exportCommand(directory.path, 'shared.profile.toml')).exitCode).toBe(0);
    const path = join(directory.path, 'shared.profile.toml');
    const first = readFileSync(path);
    expect((await exportCommand(directory.path, 'shared.profile.toml')).exitCode).toBe(0);
    expect(readFileSync(path)).toEqual(first);
    expect(readOwnership(directory.path).files.filter((entry) => entry.kind === 'export')).toHaveLength(1);
    expect((await applyCommand({ cwd: directory.path, isDryRun: false })).exitCode).toBe(0);
    applyUninstall(directory.path, planUninstall(directory.path));
    expect(readFileSync(path)).toEqual(first);
    await Bun.write(path, `${first.toString('utf8')}\n# Authored note.\n`);
    await expect(exportCommand(directory.path, 'shared.profile.toml')).rejects.toThrow('Preserved edited or unowned');
    expect(readFileSync(path, 'utf8')).toContain('# Authored note.');
});

test.each([
    '../outside.toml',
    '/outside.toml',
    'C:outside.toml',
    'C:\\outside.toml',
    'linked/profile.toml',
    'linked.toml',
])('profile export refuses unsafe destination %s without changing external bytes', async (file) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\npresets = []\n',
        'outside/profile.toml': 'original',
    });
    const root = join(directory.path, 'project');
    const outside = join(directory.path, 'outside/profile.toml');
    symlinkSync('../outside', join(root, 'linked'), 'dir');
    symlinkSync(outside, join(root, 'linked.toml'));
    await expect(exportCommand(root, file)).rejects.toThrow();
    expect(readFileSync(outside, 'utf8')).toBe('original');
});

test('profile export preserves an unowned destination and refuses the managed repository policy', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
        'occupied.toml': 'original bytes',
    });
    const occupied = join(directory.path, 'occupied.toml');
    chmodSync(occupied, 0o444);
    await expect(exportCommand(directory.path, 'occupied.toml')).rejects.toThrow('Preserved edited or unowned');
    expect(readFileSync(occupied, 'utf8')).toBe('original bytes');
    expect(statSync(occupied).mode & 0o200).toBe(0);
    const original = readFileSync(join(directory.path, 'gspot.toml'));
    await expect(exportCommand(directory.path, 'gspot.toml')).rejects.toThrow();
    expect(readFileSync(join(directory.path, 'gspot.toml'))).toEqual(original);
});

test('profile publication recovers an interrupted write through the lifecycle journal', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': 'version = 1\npresets = []\n' });
    const path = join(directory.path, 'shared.profile.toml');
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === path) throw new Error('Profile publication interrupted');
        rename(source, target);
    });
    try {
        await expect(exportCommand(directory.path, 'shared.profile.toml')).rejects.toThrow(
            'Profile publication interrupted',
        );
        expect(await Bun.file(path).exists()).toBe(false);
        expect(readOwnership(directory.path).pending?.map((entry) => entry.path)).toEqual(['shared.profile.toml']);
    } finally {
        failed.mockRestore();
    }
    expect((await exportCommand(directory.path, 'shared.profile.toml')).exitCode).toBe(0);
    expect(readOwnership(directory.path).pending).toBeUndefined();
    expect((await readProfile('shared.profile.toml', directory.path)).tables.presets).toEqual([]);
});

test('profile publication preserves permissions when adopting identical existing bytes', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\npresets = []\n';
    const profile = exportedProfile(policy, 'shared.profile.toml');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'shared.profile.toml': profile.text });
    const path = join(directory.path, 'shared.profile.toml');
    chmodSync(path, 0o444);
    expect((await exportCommand(directory.path, 'shared.profile.toml')).exitCode).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(profile.text);
    expect(statSync(path).mode & 0o200).toBe(0);
    expect(readOwnership(directory.path).files[0]?.original).toBeDefined();
});

test('profiles round-trip license allowances and exact-version exceptions', async () => {
    await using directory = await testdir();
    const licenses = {
        licenses_allowed: ['MPL-2.0'],
        packages_allowed: [{ package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed package metadata.' }],
    };
    const exported = exportedProfile(
        stringify({ version: 1, presets: ['licenses'], tools: { licenses } }),
        'licenses.profile.toml',
    );
    await createFileTree(directory.path, { 'licenses.profile.toml': exported.text });
    const restored = await readProfile('licenses.profile.toml', directory.path);
    expect(restored.tables.tools?.licenses).toEqual(licenses);
    expect(exported.leftOut).toEqual([]);
});
