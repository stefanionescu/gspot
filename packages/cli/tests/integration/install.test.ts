import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { createSandbox } from '@gspot/testing';
import { expect, spyOn, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { existsSync, readFileSync } from 'node:fs';
import * as processes from '#cli/platform/spawn.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { upgradeCommand } from '#cli/lifecycle/upgrade/command.ts';

test('an installer failure stops upgrade before changing its version pin', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n[runner]\ntool = "bun"\n',
        '.gspot/version': '0.0.1\n',
        'package.json': '{"private":true}',
    });
    const installer = spyOn(processes, 'run').mockResolvedValue({
        code: 1,
        missing: false,
        duration: 1,
        stdout: '',
        stderr: 'Planted installation failure.',
    });
    try {
        await rejects(
            upgradeCommand({ cwd: sandbox.path, yes: true, install: true, isDryRun: false }),
            /installation command bun install failed/,
        );
    } finally {
        installer.mockRestore();
    }
    expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});

test.each([undefined, 'custom-hooks'])(
    'apply preserves Git and package configuration without integrations (%s)',
    async (hooksPath) => {
        const packageText = '{"private":true,"scripts":{"prepare":"build-app","check":"check-app"}}';
        const hookText = '#!/bin/sh\nprintf app-hook\n';
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
            'package.json': packageText,
            'custom-hooks/pre-commit': hookText,
        });
        const initialized = await processes.run(['git', 'init', '--quiet'], { cwd: sandbox.path });
        expect(initialized.code, initialized.stderr).toBe(0);
        if (hooksPath !== undefined) {
            const configured = await processes.run(['git', 'config', 'core.hooksPath', hooksPath], {
                cwd: sandbox.path,
            });
            expect(configured.code, configured.stderr).toBe(0);
        }
        const configPath = join(sandbox.path, '.git/config');
        const originalConfig = readFileSync(configPath);
        await applyAll(await openSession(sandbox.path));
        expect(readFileSync(configPath)).toEqual(originalConfig);
        expect(readFileSync(join(sandbox.path, 'package.json'), 'utf8')).toBe(packageText);
        expect(readFileSync(join(sandbox.path, 'custom-hooks/pre-commit'), 'utf8')).toBe(hookText);
        expect(existsSync(join(sandbox.path, '.gspot/hooks'))).toBe(false);
        expect(existsSync(join(sandbox.path, '.github/workflows/gspot.yml'))).toBe(false);
    },
);

test('an explicit hooks integration writes check entry points', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
    });
    await applyAll(await openSession(sandbox.path));
    expect(readFileSync(join(sandbox.path, '.gspot/hooks/pre-commit'), 'utf8')).toContain('check --staged');
});

test('omitting hooks preserves existing managed hook files and their Git location', async () => {
    const hook = '#!/bin/sh\nprintf kept-hook\n';
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = []\n[rules]\ninstall = false\n',
        '.gspot/hooks/pre-commit': hook,
    });
    for (const args of [
        ['init', '--quiet'],
        ['add', '.gspot/hooks/pre-commit'],
        ['config', 'core.hooksPath', '.gspot/hooks'],
    ]) {
        const result = await processes.run(['git', ...args], { cwd: sandbox.path });
        expect(result.code, result.stderr).toBe(0);
    }
    const config = readFileSync(join(sandbox.path, '.git/config'));
    await applyAll(await openSession(sandbox.path));
    expect(readFileSync(join(sandbox.path, '.gspot/hooks/pre-commit'), 'utf8')).toBe(hook);
    expect(readFileSync(join(sandbox.path, '.git/config'))).toEqual(config);
});
