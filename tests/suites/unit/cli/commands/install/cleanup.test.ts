import { existsSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('install removes interrupted temporary writes and keeps active writes and unrelated files', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    const exited = 12_345;
    const suffix = '12345678-1234-1234-1234-123456789012.tmp';
    const stale = `.gspot-${String(exited)}-${suffix}`;
    const active = `.gspot-${String(process.pid)}-${suffix}`;
    const ownerless = `.gspot-${suffix}`;
    const recent = '.gspot-87654321-1234-1234-1234-123456789012.tmp';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        [stale]: 'interrupted',
        [active]: 'writing',
        [`.gspot/${active}`]: 'writing generated file',
        [ownerless]: 'previous interrupted write',
        [recent]: 'recent write',
        '.gspot-notes.tmp': 'authored',
    });
    utimesSync(join(sandbox.path, ownerless), new Date(0), new Date(0));
    const kill: typeof process.kill = process.kill.bind(process);
    using _processes = spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === exited) throw Object.assign(new Error('The process exited.'), { code: 'ESRCH' });
        return kill(pid, signal);
    });
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result).toMatchObject({ code: 0 });
    expect(existsSync(join(sandbox.path, stale))).toBe(false);
    expect(existsSync(join(sandbox.path, ownerless))).toBe(false);
    expect(existsSync(join(sandbox.path, active))).toBe(true);
    expect(existsSync(join(sandbox.path, '.gspot', active))).toBe(true);
    expect(existsSync(join(sandbox.path, recent))).toBe(true);
    expect(existsSync(join(sandbox.path, '.gspot-notes.tmp'))).toBe(true);
});
