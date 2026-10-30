import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { UNCLOSED_SEQUENCE } from '#tests/config/yaml.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    FILES_CASES,
    FILES_SANDBOX,
    YAML_SCOPE_FILES,
    YAML_SCOPE_TABLES,
} from '#tests/config/integration/checks/general/data-files.ts';

async function assertYamlFiles(root: string, rule?: string): Promise<void> {
    const checked = parseCheckReport(await spawnGspot(root, ['check', '--only', 'data-files/yamllint', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(rule === undefined ? 0 : 1);
    expect(checked.report.checks).toMatchObject([
        { check: 'data-files/yamllint', scope: '', status: 'passed', findings: [] },
        {
            check: 'data-files/yamllint',
            scope: 'app',
            status: rule === undefined ? 'passed' : 'failed',
            findings: rule === undefined ? [] : [matchFields({ file: 'app/settings/project.yaml', rule, line: 2 })],
        },
    ]);
}

const installedSandbox = shareInstalledSandbox(FILES_SANDBOX);

test.each([...FILES_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});

test('v8r validates a staged JSON file with a non-ASCII path against its schema', async () => {
    const { root } = installedSandbox();
    using server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,

        fetch: async () => new Response(await readFile(join(root, 'schema.json'))),
    });
    await using _change = await applySandboxChanges(installedSandbox(), {
        files: { 'settings/café.json': JSON.stringify({ count: 'invalid' }), '.v8rrc.yml': UNCLOSED_SEQUENCE },
        settings: stringify({
            tools: {
                v8r: { schema: [{ paths: ['settings/café.json'], url: `${server.url.href}schema.json` }] },
            },
        }),
    });
    runGitStep(root, ['add', '-A']);
    const command = ['check', '--only', 'data-files/v8r', '--staged', '--json'];
    const invalid = parseCheckReport(await spawnGspot(root, command));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks).toMatchObject([
        {
            check: 'data-files/v8r',
            status: 'failed',
            findings: [matchFields({ file: 'settings/café.json' })],
        },
    ]);
    await writeFile(join(root, 'settings/café.json'), JSON.stringify({ count: 1 }));
    runGitStep(root, ['add', 'settings/café.json']);
    const valid = parseCheckReport(await spawnGspot(root, command));
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(valid.report.checks).toMatchObject([{ check: 'data-files/v8r', status: 'passed', findings: [] }]);
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
    await using _change = await applySandboxChanges(installedSandbox(), {
        files: { 'settings/schema.toml': directive + 'value =\n' },
    });
    const command = ['check', 'settings/schema.toml', '--only', 'data-files/taplo-format', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'data-files/taplo-format', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
    ]);
    await writeFile(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
    const corrected = parseCheckReport(await spawnGspot(root, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'data-files/taplo-format', status: 'passed', findings: [] },
    ]);
    expect(requests).toBe(0);
});

test("yamllint applies each scope's lint rule options, and Prettier keeps two-space YAML", async () => {
    const { root } = installedSandbox();
    await using _change = await applySandboxChanges(installedSandbox(), {
        removed: Object.keys(FILES_SANDBOX.files),
        files: {
            'gspot.toml': buildSandboxSettings([], { tables: YAML_SCOPE_TABLES }),
            ...YAML_SCOPE_FILES,
        },
    });
    await assertYamlFiles(root);
    const formatted = parseCheckReport(await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']));
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect(formatted.report.checks).toMatchObject([
        { check: 'format/prettier', scope: '', status: 'passed', findings: [] },
    ]);
    await writeFile(
        join(root, 'app/settings/project.yaml'),
        `parent:
  enabled: yes
on:
  enabled: no
`,
    );
    await assertYamlFiles(root, 'truthy');
    await writeFile(join(root, 'app/settings/project.yaml'), YAML_SCOPE_FILES['app/settings/project.yaml']);
    await assertYamlFiles(root);
});

test('Taplo validates test file patterns and tool rule options against the local settings schema', async () => {
    const { root } = installedSandbox();
    const text =
        'configurations = ["javascript"]\ntest_files = ["**/*.spec.ts"]\n[tools.eslint.rules]\ncurly = ["all"]\n';
    await using _change = await applySandboxChanges(installedSandbox(), {
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
