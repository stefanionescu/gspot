import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import { planReplacement } from '#cli/lifecycle/ownership/contracts.ts';
import { EXTERNAL_INPUT_CASES } from '#tests/config/cli/lifecycle/apply.ts';
import { rm, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { applyPlan, applyPlans, openOwnership } from '#cli/lifecycle/ownership/public.ts';

test('generated outputs are writable: apply keeps their bytes, and a prune removes them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = true\n' }),
    });
    {
        using log = openOwnership(sandbox.path);

        applyPlans(log, [
            planReplacement(log, {
                path: '.gspot/obsolete/old.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'tool_file',
            }),
        ]);
    }
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gitattributes'))).toBe(true);
    const written = (applied.json as ApplyReport).written;

    const output = written.find((path) => path.endsWith('/agent/WORKING.md'))!;
    expect(output).toBeDefined();
    const bytes = await readFile(join(sandbox.path, output), 'utf8');
    const attributes = await stat(join(sandbox.path, output));
    expect(attributes.mode & 0o200).toBe(0o200);
    await chmod(join(sandbox.path, output), 0o444);
    const reapplied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(reapplied.exitCode).toBe(0);
    const refreshed = await stat(join(sandbox.path, output));
    expect(refreshed.mode & 0o200).toBe(0o200);
    expect(await readFile(join(sandbox.path, output), 'utf8')).toBe(bytes);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    const pruned = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(pruned.exitCode).toBe(0);
    expect(await pathExists(join(sandbox.path, output))).toBe(false);
});

test('a failed pin publication leaves the old version', async () => {
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
        expect(await readFile(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
});

test('apply preview rejects a generated destination linked outside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': buildPolicy(['spelling']),
        'project/.gspot/config/.keep': '',
        outside: 'authored external configuration\n',
    });
    const project = join(sandbox.path, 'project');
    await symlink(join(sandbox.path, 'outside'), join(project, '.gspot/config/typos.toml'));
    expect(await rejection(applyCommand({ cwd: project, isDryRun: true }))).toContain('private regular file');
    expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe('authored external configuration\n');
    expect(await pathExists(join(project, '.gspot/state/ownership.json'))).toBe(false);
    expect(await pathExists(join(project, '.gspot/version'))).toBe(false);
});

test.each(EXTERNAL_INPUT_CASES)(
    'apply preview rejects an external $path before producing configuration',
    async ({ path, outside, files, diagnostic }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...files,
            'project/.gspot/config/.keep': '',
            outside,
        });
        const project = join(sandbox.path, 'project');
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        expect(await rejection(applyCommand({ cwd: project, isDryRun: true }))).toContain(diagnostic);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
        expect(await pathExists(join(project, '.gspot/state/ownership.json'))).toBe(false);
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
            planReplacement(log, {
                path: '.gspot/obsolete/old.txt',
                next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                kind: 'tool_file',
            }),
        );
    }
    await rm(join(root, '.gspot/obsolete'), { recursive: true });
    await symlink('../../outside', join(root, '.gspot/obsolete'));
    expect(await rejection(applyCommand({ cwd: root, isDryRun: false }))).toContain('Unsafe lifecycle parent');
    expect(await pathExists(join(root, '.gitattributes'))).toBe(false);
    expect(await pathExists(join(root, '.gspot/version'))).toBe(false);
    expect(await readFile(join(directory.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
});
