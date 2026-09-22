import { join } from 'node:path';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { applyCommand } from '#cli/emit/apply-command.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';

test('apply previews changed pins, preserves policy, and writes the pin only after successful generation', async () => {
    await using sandbox = await testdir();
    const policy = 'version = 1\npresets = []\n[rules]\ninstall = true\n';
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
    await createFileTree(repository.path, { 'gspot.toml': 'version = 1\npresets = []\n', '.gspot/version': '0.0.1\n' });
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
