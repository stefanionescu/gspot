import * as fs from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { exportCommand } from '#cli/commands/export.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { getProfile } from '#cli/policy/profiles/parse.ts';
import { exportProfile } from '#cli/policy/profiles/export.ts';
import { getOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { failure, rejection } from '#tests/harness/expectations.ts';
import { statSync, chmodSync, symlinkSync, readFileSync } from 'node:fs';

describe('profile file paths', () => {
    test('an absolute profile loads from a different working directory', async () => {
        const source = 'policies/café house.profile.toml';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [source]: 'profile = "house"\nselection = "exact"\nkits = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await getProfile(source, sandbox.path);
        const absolute = await getProfile(join(sandbox.path, source), join(sandbox.path, 'project'));
        expect(absolute.tables).toStrictEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});

test('profiles retain runner coverage settings and omit the architecture roles, which name repository paths', async () => {
    await using directory = await testdir();
    const tools = { jest: { coverage: { lines: 90 }, test_module: 'bun:test' } };
    const roles = { harness: 'tests/fixtures' };
    const exported = exportProfile(
        stringify({ kits: ['jest'], tools, architecture: { roles } }),
        'shared.profile.toml',
    );
    await createFileTree(directory.path, { 'shared.profile.toml': exported.text });
    const restored = await getProfile('shared.profile.toml', directory.path);
    expect(restored.tables.tools?.['jest']).toStrictEqual(tools.jest);
    expect(exported.leftOut).toStrictEqual(['architecture.roles: names a repository path']);
    await createFileTree(directory.path, {
        'invalid.profile.toml': stringify({
            profile: 'local',
            selection: 'exact',
            kits: ['jest'],
            architecture: { roles },
        }),
    });
    expect(await rejection(getProfile('invalid.profile.toml', directory.path))).toContain('a profile carries no path');
});

test('profile publication is idempotent, preserves edits, and survives apply', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf([], '[rules]\ninstall = false\n'),
    });
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    const path = join(directory.path, 'shared.profile.toml');
    const first = readFileSync(path);
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    expect(readFileSync(path)).toStrictEqual(first);
    expect(getOwnership(directory.path).files.filter((entry) => entry.kind === 'export')).toHaveLength(1);
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
        'gspot.toml': policyOf([], '[rules]\ninstall = false\n'),
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
        expect(getOwnership(directory.path).pending?.map((entry) => entry.path)).toStrictEqual(['shared.profile.toml']);
    } finally {
        failed.mockRestore();
    }
    expect(exportCommand(directory.path, 'shared.profile.toml').exitCode).toBe(0);
    expect(getOwnership(directory.path).pending).toBeUndefined();
    const reread = await getProfile('shared.profile.toml', directory.path);
    expect(reread.tables.kits).toStrictEqual([]);
});

test('profile publication preserves permissions when adopting identical existing bytes', async () => {
    await using directory = await testdir();
    const policy = policyOf([]);
    const profile = exportProfile(policy, 'shared.profile.toml');
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
        allowed: ['MPL-2.0'],
        exceptions: [{ package: 'example@1.2.3', license: 'BSD', reason: 'Reviewed package metadata.' }],
    };
    const exported = exportProfile(stringify({ kits: ['licenses'], tools: { licenses } }), 'licenses.profile.toml');
    await createFileTree(directory.path, { 'licenses.profile.toml': exported.text });
    const restored = await getProfile('licenses.profile.toml', directory.path);
    expect(restored.tables.tools?.licenses).toStrictEqual(licenses);
    expect(exported.leftOut).toStrictEqual([]);
});
