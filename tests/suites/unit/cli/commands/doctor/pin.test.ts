import { expect, spyOn, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { doctorOutputSchema } from '#cli/schemas/commands.ts';
import * as inspect from '#cli/tools/inspect.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { pin: '0.0.1', exitCode: 1, notes: [expect.stringContaining('npm:@gspothq/cli@0.0.1') as string] },
    { pin: cliPackage.version, exitCode: 0, notes: [] },
])('doctor reports the pin $pin with exit code $exitCode', async ({ pin, exitCode, notes }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
        'mise.toml': `[tools]\n"npm:@gspothq/cli" = "${pin}"\n`,
    });
    using _tools = spyOn(inspect, 'lookUpTool').mockResolvedValue({ name: 'tool', state: 'ok', path: 'tool' });
    const json = await runGspot(sandbox.path, ['doctor', '--json']);
    expect(json.code, json.stdout + json.stderr).toBe(exitCode);
    expect(doctorOutputSchema.parse(JSON.parse(json.stdout))).toMatchObject({ pin, notes });
    const text = await runGspot(sandbox.path, ['doctor']);
    expect(text.stdout.includes('This repository pins gspot')).toBe(exitCode === 1);
});
