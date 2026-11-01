import { test, expect } from 'bun:test';
import { dirname, delimiter } from 'node:path';
import { HOOKS_SETTINGS } from '#tests/config/hooks.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { DoctorReport } from '#cli/types/commands/reports.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([false, true])(
    'doctor starts the Bun hook executable instead of its package script (installed: %s)',
    async (installed) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
            'package.json': JSON.stringify({
                private: true,
                packageManager: 'bun@1.4.2',
                scripts: { gspot: 'exit 99' },
                devDependencies: { '@gspothq/cli': cliPackage.version },
            }),
        });
        if (installed)
            await writeProgramCommand(
                sandbox.path,
                'node_modules/.bin/gspot',
                'fakes/tool',
                '--line',
                cliPackage.version,
            );
        runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
        const folders = [process.execPath, Bun.which('git') ?? ''].map((path) => dirname(path));
        using _environment = overrideEnvironment({ PATH: folders.join(delimiter) });
        const diagnosed = await runGspot(sandbox.path, ['doctor', '--json']);
        expect(diagnosed.stderr).toBe('');
        expect((JSON.parse(diagnosed.stdout) as DoctorReport).hooks).toBe(
            installed
                ? 'installed'
                : `installed, but bunx --no-install gspot --version fails. Install gspot with: bun add --dev --exact @gspothq/cli@${cliPackage.version}`,
        );
    },
);
