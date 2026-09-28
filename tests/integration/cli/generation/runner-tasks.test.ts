import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { pinnedTwice } from '#cli/tools/mise.ts';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { parseProfile } from '#cli/policy/profiles/read.ts';
import { configurationManifests } from '#cli/kits/manifests.ts';
import { runnerTaskPlan } from '#cli/generation/runner/plan.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import type { PackageScripts } from '#tests/types/integration/cli/generation.ts';

const CLI = fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url));

test('task mappings validate before mutation, round-trip profiles, and explain the effective names', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nkits = []\n[runner]\ntool = "npm"\n';
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

test('mise task objects without run remain authored until their names are accepted', async () => {
    await using directory = await testdir();
    const original = '[tasks."gspot:check"]\ndescription = "Authored task"\n';
    await createFileTree(directory.path, { 'mise.toml': original });
    const retained = runnerTaskPlan(directory.path, 'mise');
    expect(retained.notes).toStrictEqual([
        'Retained mise.toml task gspot:check: this name was not accepted in runner.tasks.',
    ]);
    expect(retained.configuration).toBeUndefined();
    expect(retained.tasks.map(({ name }) => name)).not.toContain('gspot:check');
    const accepted = runnerTaskPlan(directory.path, 'mise', { check: 'gspot:check' });
    expect(accepted.notes).toStrictEqual([]);
    expect(accepted.configuration).toStrictEqual({
        path: 'mise.toml',
        format: 'toml',
        changes: [{ path: ['tasks', 'gspot:check', 'run'], value: 'gspot check' }],
    });
    expect(readFileSync(join(directory.path, 'mise.toml'), 'utf8')).toBe(original);
});

test.each(['npm', 'pnpm', 'yarn', 'bun'])('the %s plan protects hooks attached to authored scripts', async (runner) => {
    await using directory = await testdir();
    const original = '{"scripts":{"lint":"authored lint"}}\n';
    await createFileTree(directory.path, { 'package.json': original });
    expect(() => runnerTaskPlan(directory.path, runner, { check: 'prelint' })).toThrow(
        'Runner task prelint is a package lifecycle script and cannot be replaced.',
    );
    expect(() => runnerTaskPlan(directory.path, runner, { check: 'postlint' })).toThrow(
        'Runner task postlint is a package lifecycle script and cannot be replaced.',
    );
    expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(original);
});
