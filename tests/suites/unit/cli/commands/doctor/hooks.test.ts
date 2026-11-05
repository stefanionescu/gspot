import { delimiter, dirname } from 'node:path';

import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { doctorOutputSchema } from '#cli/schemas/commands.ts';
import { HOOKS_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

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
        await applyGeneratedFiles(sandbox.path);
        runGitStep(sandbox.path, ['config', 'core.hooksPath', '.gspot/hooks']);
        const folders = [process.execPath, Bun.which('git') ?? ''].map((path) => dirname(path));
        using _environment = overrideEnvironment({ PATH: folders.join(delimiter) });
        const diagnosed = await runGspot(sandbox.path, ['doctor', '--json']);
        expect(diagnosed.stderr).toBe('');
        expect(doctorOutputSchema.parse(JSON.parse(diagnosed.stdout)).hooks).toStrictEqual(
            installed
                ? { ready: true, tool: 'gspot' }
                : {
                      ready: false,
                      tool: 'gspot',
                      lines: [
                          expect.stringContaining(
                              'Stopping because --no-install was passed. Install gspot with: bun add',
                          ) as string,
                      ],
                  },
        );
    },
);
