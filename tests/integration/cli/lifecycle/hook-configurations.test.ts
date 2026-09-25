import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { readFileSync, writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';

const PRE_COMMIT_POLICY = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "pre-commit"\n';

test.each([
    '',
    '# Authored repository comment\nrepos:\n  - repo: local\n    hooks:\n      - id: authored\n        name: authored\n        entry: echo retained\n        language: system\n        stages: [pre-commit]\n        always_run: true\n',
])('pre-commit adds a sequence entry without replacing authored repositories', async (original) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': PRE_COMMIT_POLICY,
        ...(original === '' ? {} : { '.pre-commit-config.yaml': original }),
    });
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const path = join(sandbox.path, '.pre-commit-config.yaml');
    const initial = readFileSync(path, 'utf8');
    const config = parseYaml(initial);
    expect(Array.isArray(config.repos)).toBe(true);
    expect(config.repos.at(-1).hooks[0].id).toBe('gspot');
    if (original !== '') expect(initial).toContain('# Authored repository comment');
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    expect(readFileSync(path, 'utf8')).toBe(initial);
    writeFileSync(path, initial + '\nfail_fast: true\n');
    expect((await uninstallCommand({ cwd: sandbox.path, yes: true, isDryRun: false })).exitCode).toBe(0);
    const restored = parseYaml(readFileSync(path, 'utf8'));
    expect(restored.fail_fast).toBe(true);
    if (original === '') expect(restored.repos).toBeUndefined();
    else {
        expect(restored.repos).toHaveLength(1);
        expect(restored.repos[0].hooks[0].id).toBe('authored');
    }
});

const SIMPLE_HOOKS_POLICY =
    'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "simple-git-hooks"\n';

test('simple-git-hooks configuration coexists with generated npm scripts', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SIMPLE_HOOKS_POLICY + '[runner]\ntool = "npm"\n',
        'package.json': '{"private":true,"scripts":{"authored":"echo keep"}}\n',
    });
    expect((await applyCommand({ cwd: sandbox.path, isDryRun: false })).exitCode).toBe(0);
    const manifest = JSON.parse(readFileSync(join(sandbox.path, 'package.json'), 'utf8'));
    expect(manifest.scripts.authored).toBe('echo keep');
    expect(manifest.scripts['gspot:check']).toBe('gspot check');
    expect(manifest['simple-git-hooks']['pre-commit']).toContain('.gspot/integrations/simple-git-hooks/pre-commit');
});

test('an overriding simple-git-hooks file remains intact and refuses package integration', async () => {
    await using sandbox = await testdir();
    const original = 'module.exports = { "pre-commit": "echo keep" };\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': SIMPLE_HOOKS_POLICY,
        'package.json': '{"private":true}\n',
        '.simple-git-hooks.cjs': original,
    });
    await expect(applyCommand({ cwd: sandbox.path, isDryRun: false })).rejects.toThrow(
        'Retained .simple-git-hooks.cjs',
    );
    expect(readFileSync(join(sandbox.path, '.simple-git-hooks.cjs'), 'utf8')).toBe(original);
    expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe('{"private":true}\n');
});
