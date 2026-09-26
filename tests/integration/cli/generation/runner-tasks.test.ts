import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { pinnedTwice } from '#cli/tools/mise.ts';
import { createFileTree, testdir } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { parseProfile } from '#cli/policy/profiles/read.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { PackageScripts } from '#tests/types/integration/cli/generation.ts';

const CLI = fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url));

test('task mappings validate before mutation, round-trip profiles, and explain the effective names', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = []\n[runner]\ntool = "npm"\n';
    await createFileTree(directory.path, { 'gspot.toml': policy, 'package.json': '{"private":true}\n' });
    for (const tasks of [{ check: 'prepare' }, { check: 'gspot:fix' }, { check: 'lint', fix: 'lint' }]) {
        const rejected = await run([process.execPath, CLI, 'set', 'runner.tasks', JSON.stringify(tasks), '--json'], {
            cwd: directory.path,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(2);
        expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    }
    const tasks = { check: 'lint', fix: 'format' };
    const selected = await run([process.execPath, CLI, 'set', 'runner.tasks', JSON.stringify(tasks), '--json'], {
        cwd: directory.path,
    });
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const written = readFileSync(join(directory.path, 'gspot.toml'), 'utf8');
    expect(
        parseProfile(exportedProfile(written, 'team.profile.toml').text, 'team.profile.toml').tables.runner?.tasks,
    ).toStrictEqual(tasks);
    const explained = await run([process.execPath, CLI, 'explain', 'runner.tasks', '--json'], { cwd: directory.path });
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain('lint');
    await applyAll(await openSession(directory.path));
    expect(
        (JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')) as PackageScripts).scripts,
    ).toStrictEqual({
        lint: 'gspot check',
        format: 'gspot check --fix',
        'gspot:apply': 'gspot apply',
        'gspot:doctor': 'gspot doctor',
    });
    const changed = await run([process.execPath, CLI, 'set', 'runner.tasks', '{"check":"verify"}', '--json'], {
        cwd: directory.path,
    });
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    await applyAll(await openSession(directory.path));
    const { scripts } = JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')) as PackageScripts;
    expect(scripts['lint']).toBeUndefined();
    expect(scripts['format']).toBeUndefined();
    expect(scripts['verify']).toBe('gspot check');
});

test('duplicate pins include only parsed tool keys', async () => {
    await using directory = await testdir();
    const manifests = [...configurationManifests().values()];
    await createFileTree(directory.path, {
        'mise.toml': `[tools]\n'shellcheck' = { version = "0.11.0" }\n"ty\\u0070os" = "1.43.5"\n[env]\nruff = "not a pin"\n[tasks]\nactionlint = "echo not a pin"\n[tasks.check]\nrun = "echo vale = something"\n`,
    });
    expect(
        pinnedTwice(directory.path, manifests)
            .map(({ tool }) => tool)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['shellcheck', 'typos']);
    writeFileSync(
        join(directory.path, 'mise.toml'),
        '[env]\ntypos = "example"\n[tasks]\nshellcheck = "echo example"\n',
    );
    expect(pinnedTwice(directory.path, manifests)).toStrictEqual([]);
    writeFileSync(join(directory.path, 'mise.toml'), '[tools\n');
    expect(() => pinnedTwice(directory.path, manifests)).toThrow();
});
