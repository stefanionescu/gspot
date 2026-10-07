import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const { version: RUNNING_VERSION } = packageManifest;

test('apply previews policy reconciliation and changed pins and publishes the pin only after successful generation', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy([], { tables: '[agent_rules]\nenabled = true\n' });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, '.gspot/version': '0.0.1\n' });
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.json).toMatchObject({ dryRun: true, pin: { from: '0.0.1', to: RUNNING_VERSION } });
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(RUNNING_VERSION);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(
        (preview.json as Required<Pick<InitJson, 'policy'>>).policy,
    );
    const output = (applied.json as ApplyReport).written.find((path) => path !== '.gspot/version')!;
    expect(output).toBeDefined();
    chmodSync(join(sandbox.path, output), 0o644);
    writeFileSync(join(sandbox.path, output), 'authored edit');
    writeFileSync(join(sandbox.path, '.gspot/version'), '0.0.1\n');
    expect(await rejection(applyCommand({ cwd: sandbox.path, isDryRun: false }))).toContain('version pin is unchanged');
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    expect(readFileSync(join(sandbox.path, output), 'utf8')).toBe('authored edit');
});

test('a writable checkout of a read-only output is no edit: apply keeps it, and a prune removes it', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = true\n' }),
    });
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const written = (applied.json as ApplyReport).written;

    const output = written.find((path) => path.endsWith('/agent/WORKING.md'))!;
    expect(output).toBeDefined();
    const bytes = readFileSync(join(sandbox.path, output), 'utf8');
    chmodSync(join(sandbox.path, output), 0o644);
    const reapplied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(reapplied.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, output), 'utf8')).toBe(bytes);
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    const pruned = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(pruned.exitCode).toBe(0);
    expect(existsSync(join(sandbox.path, output))).toBe(false);
});

test('a failed pin publication leaves the old version and succeeds after the write failure is repaired', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy([]),
        '.gspot/version': '0.0.1\n',
    });
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(repository.path, '.gspot/version')) throw new Error('Pin write denied');
        rename(source, target);
    });
    try {
        expect(await rejection(applyCommand({ cwd: repository.path, isDryRun: false }))).toContain('Pin write denied');
        expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
    const applied = await applyCommand({ cwd: repository.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe(RUNNING_VERSION);
});

test('apply preview rejects a generated destination linked outside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': buildPolicy(['spelling']),
        'project/.gspot/config/.keep': '',
        outside: 'authored external configuration\n',
    });
    const project = join(sandbox.path, 'project');
    fs.symlinkSync(join(sandbox.path, 'outside'), join(project, '.gspot/config/typos.toml'));
    expect(await rejection(applyCommand({ cwd: project, isDryRun: true }))).toContain('private regular file');
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe('authored external configuration\n');
    expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    expect(fs.existsSync(join(project, '.gspot/version'))).toBe(false);
});

test.each(['gspot.toml', '.gspot/version'])(
    'apply preview rejects an external %s before producing configuration',
    async (path) => {
        await using sandbox = await testdir();
        const policy = buildPolicy([]);
        const original = path === 'gspot.toml' ? policy : '0.0.1\n';
        await createFileTree(sandbox.path, {
            'project/gspot.toml': policy,
            'project/.gspot/config/.keep': '',
            outside: original,
        });
        const project = join(sandbox.path, 'project');
        if (path === 'gspot.toml') fs.unlinkSync(join(project, path));
        fs.symlinkSync(join(sandbox.path, 'outside'), join(project, path));
        expect(await rejection(applyCommand({ cwd: project, isDryRun: true }))).toContain(
            path === 'gspot.toml' ? 'Source link leaves the repository' : 'private regular file',
        );
        expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
        expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    },
);

test('apply validates obsolete output parents before publishing new configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        'outside/old.txt': 'outside bytes\n',
    });
    const root = join(directory.path, 'project');
    {
        using log = openOwnership(root);

        applyPlan(
            log,
            proposeReplacement(log, {
                path: '.gspot/obsolete/old.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'config',
            }),
        );
    }
    fs.rmSync(join(root, '.gspot/obsolete'), { recursive: true });
    fs.symlinkSync('../../outside', join(root, '.gspot/obsolete'));
    expect(await rejection(applyCommand({ cwd: root, isDryRun: false }))).toContain('Unsafe lifecycle parent');
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(false);
    expect(fs.existsSync(join(root, '.gspot/version'))).toBe(false);
    expect(readFileSync(join(directory.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
    fs.unlinkSync(join(root, '.gspot/obsolete'));
    await createFileTree(root, { '.gspot/obsolete/old.txt': 'installed\n' });
    const applied = await applyCommand({ cwd: root, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(fs.existsSync(join(root, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(true);
    const reapplied = await applyCommand({ cwd: root, isDryRun: false });
    expect(reapplied.exitCode).toBe(0);
});
