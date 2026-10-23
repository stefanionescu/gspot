import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    FILES_CASES,
    FILES_SANDBOX,
    YAML_SCOPE_FILES,
    REJECTING_SCHEMA,
    YAML_SCOPE_SAMPLE,
    YAML_SCOPE_TABLES,
    UNQUOTED_UNTIL_CHANGE,
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
    const result = await runCheckSample(installedSandbox(), sample, FILES_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});

test('v8r validates a staged JSON file with a non-ASCII path against its schema', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: `Bun.serve` calls it for each request.
        async fetch() {
            return new Response(await readFile(join(root, 'schema.json')));
        },
    });
    state.defer(async () => {
        await server.stop(true);
    });
    state.use(
        await applySandboxChanges(installedSandbox(), {
            check: 'data-files/v8r',
            files: { 'settings/café.json': '', '.v8rrc.yml': '' },
            settings: stringify({
                tools: {
                    v8r: { schema: [{ paths: ['settings/café.json'], url: `${server.url.toString()}schema.json` }] },
                },
            }),
        }),
    );
    await writeFile(join(root, '.v8rrc.yml'), 'invalid: [\n');
    const path = join(root, 'settings/café.json');
    await writeFile(path, JSON.stringify({ count: 'invalid' }));
    runGitStep(root, ['add', '-A']);
    const command = ['check', '--only', 'data-files/v8r', '--staged', '--json'];
    const invalid = parseCheckReport(await spawnGspot(root, command, environment));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks).toMatchObject([
        {
            check: 'data-files/v8r',
            status: 'failed',
            findings: [matchFields({ file: 'settings/café.json', message: '/count must be integer' })],
        },
    ]);
    await writeFile(path, JSON.stringify({ count: 1 }));
    runGitStep(root, ['add', 'settings/café.json']);
    const valid = parseCheckReport(await spawnGspot(root, command, environment));
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(valid.report.checks).toMatchObject([{ check: 'data-files/v8r', status: 'passed', findings: [] }]);
});

test('Taplo never downloads a schema named in a #:schema comment', async () => {
    const { root, environment } = installedSandbox();
    await using resources = new AsyncDisposableStack();
    let requests = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: `Bun.serve` calls it for each request.
        fetch() {
            requests++;
            return Response.json({ type: 'object', required: ['missing'] });
        },
    });
    resources.defer(async () => {
        await server.stop(true);
    });
    const directive = `#:schema ${server.url.toString()}schema.json\n`;
    resources.use(
        await applySandboxChanges(installedSandbox(), {
            check: 'data-files/taplo-format',
            files: { 'settings/schema.toml': directive + 'value =\n' },
        }),
    );
    const command = ['check', 'settings/schema.toml', '--only', 'data-files/taplo-format', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command, environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'data-files/taplo-format', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
    ]);
    await writeFile(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
    const corrected = parseCheckReport(await spawnGspot(root, command, environment));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'data-files/taplo-format', status: 'passed', findings: [] },
    ]);
    expect(requests).toBe(0);
});

test("yamllint applies each scope's lint rule options, and Prettier keeps two-space YAML", async () => {
    const { root } = installedSandbox();
    await using _change = await applySandboxChanges(installedSandbox(), {
        check: 'data-files/yamllint',
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
    await writeFile(join(root, 'app/settings/project.yaml'), YAML_SCOPE_SAMPLE);
    await assertYamlFiles(root, 'truthy');
    await writeFile(join(root, 'app/settings/project.yaml'), YAML_SCOPE_FILES['app/settings/project.yaml']);
    await assertYamlFiles(root);
});

test('v8r checks gspot.toml against the schema in .gspot, which accepts an unquoted until date', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await applySandboxChanges(installedSandbox(), UNQUOTED_UNTIL_CHANGE);
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
    const checkSettings = async () =>
        parseCheckReport(
            await spawnGspot(root, ['check', SETTINGS_FILE, '--only', 'data-files/v8r', '--json'], environment),
        );
    const accepted = await checkSettings();
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.report.checks).toMatchObject([
        { check: 'data-files/v8r', status: 'passed', command: expect.arrayContaining([SETTINGS_FILE]) as string[] },
    ]);
    await writeFile(join(root, GSPOT_PATHS.settingsSchema), REJECTING_SCHEMA);
    const rejected = await checkSettings();
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.report.checks).toMatchObject([
        { check: 'data-files/v8r', status: 'failed', findings: [matchFields({ file: SETTINGS_FILE })] },
    ]);
});
