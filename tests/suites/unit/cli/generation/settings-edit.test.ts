import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { setKey } from '#cli/settings/edit.ts';
import { test, spyOn, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { BUN_SCANNER_SETTINGS } from '#tests/config/toml.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation/write.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/generation/settings-edit.ts';

test('apply prints no managed-key warning while it still manages the Bun scanner', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: BUN_SCANNER_SETTINGS,
        }),
        'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}',
    });
    for (const pass of [1, 2]) {
        const result = await runGspot(sandbox.path, ['apply', '--json']);
        expect(result.code, `pass ${String(pass)}: ${result.stdout}${result.stderr}`).toBe(0);
        expect((JSON.parse(result.stdout) as ApplyReport).notes).not.toContain(MANAGED_KEYS_NOTE);
    }
});

test('an unchanged settings edit that writes generated files does not say No change', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': 'level = "basic"\n' + buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', 'level', 'basic']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toStartWith('gspot.toml already says this.\n');
    expect(result.stdout).toContain('wrote ');
    expect(result.stdout).not.toContain('No change:');
});

test('an edit after a lookup reuses the cached repository bytes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"name":"example","type":"module","private":true}',
        'main.js': 'export const port = 8080;\n',
    });
    const context = await prepareSettingsEdit(sandbox.path);
    readSetting(context, 'limits.file_lines');
    expect(context.reads.sources.has('package.json')).toBe(true);
    using read = spyOn(context.reads.sources, 'get');
    using save = spyOn(context.reads.sources, 'set');
    setKey(context.edit.table, 'limits.file_lines', 200);
    const result = await applySettingsEdit(context.root, {
        edit: context.edit,
        reads: context.reads,
        listing: context.listing,
        summary: 'Set limits.file_lines to 200.',
    });
    expect(result.exitCode).toBe(0);
    expect(read.mock.calls.some(([file]) => file === 'package.json')).toBe(true);
    expect(save.mock.calls.filter(([file]) => file === 'package.json')).toHaveLength(0);
    expect(readSettings(readFileSync(join(sandbox.path, SETTINGS_FILE), 'utf8'), sandbox.path).limits.file_lines).toBe(
        200,
    );
});
