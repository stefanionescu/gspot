import * as fs from 'node:fs';
import { join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import packageManifest from '../../../../../packages/cli/package.json' with { type: 'json' };

const { version: GSPOT_VERSION } = packageManifest;

test('apply previews changed pins, preserves policy, and writes the pin only after successful generation', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\nconfigurations = []\n[rules]\ninstall = true\n';
    await createFileTree(sandbox.path, { 'gspot.toml': policy, '.gspot/version': '0.0.1\n' });
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(preview.json).toMatchObject({ isDryRun: true, pin: { from: '0.0.1', to: GSPOT_VERSION } });
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const output = (applied.json as { written: string[] }).written.find((path) => path !== '.gspot/version')!;
    expect(output).toBeDefined();
    chmodSync(join(sandbox.path, output), 0o644);
    writeFileSync(join(sandbox.path, output), 'authored edit');
    writeFileSync(join(sandbox.path, '.gspot/version'), '0.0.1\n');
    await expect(applyCommand({ cwd: sandbox.path, isDryRun: false })).rejects.toThrow('version pin was not changed');
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    expect(readFileSync(join(sandbox.path, output), 'utf8')).toBe('authored edit');
});

test('a failed pin publication leaves the old version and succeeds after the write failure is repaired', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': 'version = 1\nconfigurations = []\n',
        '.gspot/version': '0.0.1\n',
    });
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(repository.path, '.gspot/version')) throw new Error('Pin write denied');
        rename(source, target);
    });
    try {
        await expect(applyCommand({ cwd: repository.path, isDryRun: false })).rejects.toThrow('Pin write denied');
        expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
    expect((await applyCommand({ cwd: repository.path, isDryRun: false })).exitCode).toBe(0);
    expect(readFileSync(join(repository.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
});

test('apply preview rejects a generated destination linked outside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': 'version = 1\nconfigurations = ["spelling"]\n',
        'project/.gspot/config/.keep': '',
        outside: 'authored external configuration\n',
    });
    const project = join(sandbox.path, 'project');
    fs.symlinkSync(join(sandbox.path, 'outside'), join(project, '.gspot/config/typos.toml'));
    await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
    expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe('authored external configuration\n');
    expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    expect(fs.existsSync(join(project, '.gspot/version'))).toBe(false);
});

test.each(['gspot.toml', '.gspot/version'])(
    'apply preview rejects an external %s before producing configuration',
    async (path) => {
        await using sandbox = await testdir();
        const policy = 'version = 1\nconfigurations = []\n';
        const original = path === 'gspot.toml' ? policy : '0.0.1\n';
        await createFileTree(sandbox.path, {
            'project/gspot.toml': policy,
            'project/.gspot/config/.keep': '',
            outside: original,
        });
        const project = join(sandbox.path, 'project');
        if (path === 'gspot.toml') fs.unlinkSync(join(project, path));
        fs.symlinkSync(join(sandbox.path, 'outside'), join(project, path));
        await expect(applyCommand({ cwd: project, isDryRun: true })).rejects.toThrow('private regular file');
        expect(readFileSync(join(sandbox.path, 'outside'), 'utf8')).toBe(original);
        expect(fs.existsSync(join(project, '.gspot/state/ownership.json'))).toBe(false);
    },
);

test('apply validates obsolete output parents before publishing new configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n',
        'outside/old.txt': 'outside bytes\n',
    });
    const root = join(directory.path, 'project');
    const owner = openLifecycleOwner(root);
    try {
        owner.replace('.gspot/obsolete/old.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config');
    } finally {
        owner.close();
    }
    fs.rmSync(join(root, '.gspot/obsolete'), { recursive: true });
    fs.symlinkSync('../../outside', join(root, '.gspot/obsolete'));
    await expect(applyCommand({ cwd: root, isDryRun: false })).rejects.toThrow('Unsafe lifecycle parent');
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(false);
    expect(fs.existsSync(join(root, '.gspot/version'))).toBe(false);
    expect(readFileSync(join(directory.path, 'outside/old.txt'), 'utf8')).toBe('outside bytes\n');
    fs.unlinkSync(join(root, '.gspot/obsolete'));
    await createFileTree(root, { '.gspot/obsolete/old.txt': 'installed\n' });
    expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
    expect(fs.existsSync(join(root, '.gspot/obsolete/old.txt'))).toBe(false);
    expect(fs.existsSync(join(root, '.gitattributes'))).toBe(true);
    expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
});
