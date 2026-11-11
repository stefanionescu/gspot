import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

import { buildJsonSchema } from '#cli/settings/editor-schema.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['toml'],
    files: { 'settings/clean.toml': 'a = 1\n' },
});

test('toml/taplo reports a TOML file outside the taplo layout and passes after the fix', async () => {
    await assertCheckSample(installedSandbox(), {
        check: 'toml/taplo',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: { file: 'settings/layout.toml' },
        corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
    });
});

test('Taplo never downloads a schema named in a #:schema comment', async () => {
    const { root } = installedSandbox();
    let requests = 0;
    using server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,

        fetch: () => {
            requests++;
            return Response.json({ type: 'object', required: ['missing'] });
        },
    });
    const directive = `#:schema ${server.url.href}schema.json\n`;
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: { 'settings/schema.toml': directive + 'value =\n' },
    });
    const command = ['check', 'settings/schema.toml', '--only', 'toml/taplo', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'toml/taplo', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
    ]);
    await writeFile(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'toml/taplo', status: 'passed', findings: [] }]);
    expect(requests).toBe(0);
});

test('Taplo validates test file patterns and tool rule options against the local settings schema', async () => {
    const { root } = installedSandbox();
    const text =
        'configurations = ["javascript"]\ntest_files = ["**/*.spec.ts"]\n[tools.eslint.rules]\ncurly = ["all"]\n';
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: { 'editor.schema.json': JSON.stringify(buildJsonSchema()), 'editor-settings.toml': text },
    });
    const command = [
        'taplo',
        'lint',
        '--no-auto-config',
        '--schema',
        pathToFileURL(join(root, 'editor.schema.json')).href,
        'editor-settings.toml',
    ];
    const valid = await runCommand(command, { cwd: root });
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    await writeFile(join(root, 'editor-settings.toml'), text.replace('["**/*.spec.ts"]', '42'));
    const invalid = await runCommand(command, { cwd: root });
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.stderr).toContain('test_files');
});
