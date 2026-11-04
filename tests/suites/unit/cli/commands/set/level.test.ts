import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('with a baseline, set level all names the checks it turns on and the baseline command for them', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const unbaselined = await runGspot(sandbox.path, ['set', 'level', 'all', '--json']);
    expect((JSON.parse(unbaselined.stdout) as { notes: string[] }).notes.join('\n')).not.toContain('gspot baseline');
    await runGspot(sandbox.path, ['unset', 'level']);
    await writeFile(join(sandbox.path, 'gspot.baseline.json'), '{}\n');
    const all = await runGspot(sandbox.path, ['set', 'level', 'all', '--json']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    const note = (JSON.parse(all.stdout) as { notes: string[] }).notes.find((line) => line.includes('gspot baseline'));
    const named = /gspot baseline --only (?<checks>[\w/,-]+)/u.exec(note ?? '')?.groups?.['checks']?.split(',') ?? [];
    expect(named).toContain('prose/vale');
    expect(named).not.toContain('markdown/markdownlint');
});

test('setting level all and unsetting it restores every generated file and its bytes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'python']),
        'main.ts': 'export const port = 8080;\n',
        'main.py': 'PORT = 8080\n',
        'README.md': '# Example\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const before = await readTree(sandbox.path);
    const all = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, '.gspot/configurations/general/prose/vale.ini'))).toBe(true);
    expect(await readTree(sandbox.path)).not.toStrictEqual(before);
    const restored = await runGspot(sandbox.path, ['unset', 'level']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
