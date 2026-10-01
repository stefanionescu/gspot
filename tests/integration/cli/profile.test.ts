import * as fs from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { exportCommand } from '#cli/commands/export.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { readProfile } from '#cli/policy/profiles/read.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { failure, rejection } from '#tests/support/expectations.ts';
import { statSync, chmodSync, symlinkSync, readFileSync } from 'node:fs';

describe('profile file paths', () => {
    test('an absolute profile loads from a different working directory', async () => {
        const source = 'policies/café house.profile.toml';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [source]: 'version = 1\nprofile = "house"\nselection = "exact"\nkits = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await readProfile(source, sandbox.path);
        const absolute = await readProfile(join(sandbox.path, source), join(sandbox.path, 'project'));
        expect(absolute.tables).toStrictEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});

test.each(['jest', 'vitest'])(
    'profiles retain %s coverage settings and omit repository support directories',
    async (configuration) => {
        await using directory = await testdir();
        const sharedSettings = {
            coverage_lines: 90,
            ...(configuration === 'jest' ? { global_package: 'bun:test' } : {}),
        };
        const exported = exportedProfile(
            stringify({
                version: 1,
                kits: [configuration],
                tools: { [configuration]: { ...sharedSettings, harness_directory: 'tests/fixtures' } },
            }),
            'shared.profile.toml',
        );
        await createFileTree(directory.path, { 'shared.profile.toml': exported.text });
        const restored = await readProfile('shared.profile.toml', directory.path);
        expect(restored.tables.tools?.[configuration]).toStrictEqual(sharedSettings);
        expect(exported.leftOut).toStrictEqual([`tools.${configuration}.harness_directory: names a repository path`]);
        await createFileTree(directory.path, {
            'invalid.profile.toml': stringify({
                version: 1,
                profile: 'local',
                selection: 'exact',
                kits: [configuration],
                tools: { [configuration]: { harness_directory: 'tests/fixtures' } },
            }),
        });
        expect(await rejection(readProfile('invalid.profile.toml', directory.path))).toContain(
            'a profile carries no path',
        );
    },
);

test('profile publication is idempotent, preserves edits, and survives apply', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
    });
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    const path = join(directory.path, 'shared.profile.toml');
    const first = readFileSync(path);
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    expect(readFileSync(path)).toStrictEqual(first);
    expect(readOwnership(directory.path).files.filter((entry) => entry.kind === 'export')).toHaveLength(1);
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(path)).toStrictEqual(first);
    await Bun.write(path, `${first.toString('utf8')}\n# Authored note.\n`);
    expect(failure(() => exportCommand(directory.path, 'shared.profile.toml'))?.message).toContain(
        'Preserved edited or unowned',
    );
    expect(readFileSync(path, 'utf8')).toContain('# Authored note.');
});

test.each([
    '../outside.toml',
    '/outside.toml',
    'C:outside.toml',
    String.raw`C:\outside.toml`,
    'linked/profile.toml',
    'linked.toml',
])('profile export refuses unsafe destination %s without changing external bytes', async (file) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': policyOf([]),
        'outside/profile.toml': 'original',
    });
    const root = join(directory.path, 'project');
    const outside = join(directory.path, 'outside/profile.toml');
    symlinkSync('../outside', join(root, 'linked'), 'dir');
    symlinkSync(outside, join(root, 'linked.toml'));
    expect(failure(() => exportCommand(root, file))).toBeInstanceOf(Error);
    expect(readFileSync(outside, 'utf8')).toBe('original');
});

test('profile export preserves an unowned destination and refuses the managed repository policy', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n'),
        'occupied.toml': 'original bytes',
    });
    const occupied = join(directory.path, 'occupied.toml');
    chmodSync(occupied, 0o444);
    expect(failure(() => exportCommand(directory.path, 'occupied.toml'))?.message).toContain(
        'Preserved edited or unowned',
    );
    expect(readFileSync(occupied, 'utf8')).toBe('original bytes');
    expect(statSync(occupied).mode & 0o200).toBe(0);
    const original = readFileSync(join(directory.path, 'gspot.toml'));
    expect(failure(() => exportCommand(directory.path, 'gspot.toml'))).toBeInstanceOf(Error);
    expect(readFileSync(join(directory.path, 'gspot.toml'))).toStrictEqual(original);
});

test('profile publication recovers an interrupted write through the lifecycle log', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': policyOf([]) });
    const path = join(directory.path, 'shared.profile.toml');
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === path) throw new Error('Profile publication interrupted');
        rename(source, target);
    });
    try {
        expect(failure(() => exportCommand(directory.path, 'shared.profile.toml'))?.message).toContain(
            'Profile publication interrupted',
        );
        expect(await Bun.file(path).exists()).toBe(false);
        expect(readOwnership(directory.path).pending?.map((entry) => entry.path)).toStrictEqual([
            'shared.profile.toml',
        ]);
    } finally {
        failed.mockRestore();
    }
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    expect(readOwnership(directory.path).pending).toBeUndefined();
    const reread = await readProfile('shared.profile.toml', directory.path);
    expect(reread.tables.kits).toStrictEqual([]);
});

test('profile publication preserves permissions when adopting identical existing bytes', async () => {
    await using directory = await testdir();
    const policy = policyOf([]);
    const profile = exportedProfile(policy, 'shared.profile.toml');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'shared.profile.toml': profile.text });
    const path = join(directory.path, 'shared.profile.toml');
    chmodSync(path, 0o444);
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(profile.text);
    expect(statSync(path).mode & 0o200).toBe(0);
});

test('profiles round-trip license allowances and exact-version exceptions', async () => {
    await using directory = await testdir();
    const licenses = {
        licenses_allowed: ['MPL-2.0'],
        packages_allowed: [{ package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed package metadata.' }],
    };
    const exported = exportedProfile(
        stringify({ version: 1, kits: ['licenses'], tools: { licenses } }),
        'licenses.profile.toml',
    );
    await createFileTree(directory.path, { 'licenses.profile.toml': exported.text });
    const restored = await readProfile('licenses.profile.toml', directory.path);
    expect(restored.tables.tools?.licenses).toStrictEqual(licenses);
    expect(exported.leftOut).toStrictEqual([]);
});
