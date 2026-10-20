import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGit } from '#tests/setup/git.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    FILES_CASES,
    FILES_SANDBOX,
    YAML_SCOPE_FILES,
    YAML_SCOPE_SAMPLE,
    YAML_SCOPE_SETTINGS,
} from '#tests/data/checks/files.ts';

const installedSandbox = registerSharedSandbox(FILES_SANDBOX);

test.each([...FILES_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, FILES_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});

test('Taplo follows an extra tool option for compact inline tables and returns to its default without it', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    state.use(
        await updateSandbox(installedSandbox(), {
            check: 'files/taplo-format',
            files: { 'settings/inline.toml': 'entry = { key = true }\n' },
        }),
    );
    const path = join(root, 'settings/inline.toml');
    const command = ['check', 'settings/inline.toml', '--only', 'files/taplo-format', '--json'];
    const settingsPath = join(root, 'gspot.toml');
    const settings = await Bun.file(settingsPath).text();
    await Bun.write(
        settingsPath,
        settings +
            `
[tools.taplo.extra]
reason = "The project uses compact inline tables in TOML."
value = { compact_inline_tables = true }
`,
    );
    const setting = await spawnGspot(root, ['apply'], environment);
    expect(setting.code, setting.stdout + setting.stderr).toBe(0);
    const rejected = await spawnGspot(root, command, environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((JSON.parse(rejected.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/taplo-format', status: 'failed', findings: [{ file: 'settings/inline.toml' }] },
    ]);
    const fixed = await spawnGspot(root, [...command, '--fix'], environment);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(await Bun.file(path).text()).toBe('entry = {key = true}\n');
    await Bun.write(settingsPath, settings);
    const reset = await spawnGspot(root, ['apply'], environment);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const selected = await spawnGspot(root, ['set', 'level', 'all'], environment);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
});

test('v8r validates a staged JSON file with a non-ASCII path against its schema', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    state.use(
        await updateSandbox(installedSandbox(), {
            check: 'files/v8r',
            files: { 'settings/café.json': '', '.v8rrc.yml': '' },
        }),
    );
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch() {
            return new Response(Bun.file(join(root, 'schema.json')));
        },
    });
    state.defer(async () => {
        await server.stop(true);
    });
    const settingsPath = join(root, 'gspot.toml');
    const settings = await Bun.file(settingsPath).text();
    await Bun.write(
        settingsPath,
        settings +
            `
[[tools.v8r.schema]]
paths = ["settings/café.json"]
url = "${server.url.toString()}schema.json"
`,
    );
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    // An authored .v8rrc.yml must not replace the generated tool file.
    await Bun.write(join(root, '.v8rrc.yml'), 'invalid: [\n');
    const path = join(root, 'settings/café.json');
    await Bun.write(path, JSON.stringify({ count: 'invalid' }));
    expect(runGit(root, ['add', '-A']).code).toBe(0);
    const command = ['check', '--only', 'files/v8r', '--staged', '--json'];
    const invalid = await spawnGspot(root, command, environment);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'files/v8r',
            status: 'failed',
            findings: [
                matchFields({
                    file: 'settings/café.json',
                    message: matchSubstring('must be integer'),
                }),
            ],
        },
    ]);
    await Bun.write(path, JSON.stringify({ count: 1 }));
    expect(runGit(root, ['add', 'settings/café.json']).code).toBe(0);
    const valid = await spawnGspot(root, command, environment);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect((JSON.parse(valid.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/v8r', status: 'passed', findings: [] },
    ]);
});

test('Taplo never downloads a schema named in a #:schema comment', async () => {
    const { root, environment } = installedSandbox();
    await using resources = new AsyncDisposableStack();

    let requests = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
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
        await updateSandbox(installedSandbox(), {
            check: 'files/taplo-format',
            files: { 'settings/schema.toml': directive + 'value =\n' },
        }),
    );
    const command = ['check', 'settings/schema.toml', '--only', 'files/taplo-format', '--json'];
    const selected = await spawnGspot(root, ['set', 'level', 'all'], environment);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    await Bun.write(join(root, 'settings/schema.toml'), directive + 'value =\n');
    const failed = await spawnGspot(root, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/taplo-format', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
    ]);
    await Bun.write(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
    const corrected = await spawnGspot(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/taplo-format', status: 'passed', findings: [] },
    ]);
    expect(requests).toBe(0);
});

// Checks the root and child scopes separately with yamllint.
async function assertYamlFiles(root: string, rule?: string): Promise<void> {
    const checked = await spawnGspot(root, ['check', '--only', 'files/yamllint', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(rule === undefined ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/yamllint', scope: '', status: 'passed', findings: [] },
        {
            check: 'files/yamllint',
            scope: 'app',
            status: rule === undefined ? 'passed' : 'failed',
            findings: rule === undefined ? [] : [matchFields({ file: 'app/settings/project.yaml', rule, line: 2 })],
        },
    ]);
}

test("yamllint applies each scope's lint rule options, and Prettier keeps two-space YAML", async () => {
    const { root } = installedSandbox();
    await using _change = await updateSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            check: 'files/yamllint',
            removed: Object.keys(FILES_SANDBOX.files),
            files: {
                'gspot.toml': buildSettingsText([], { tables: YAML_SCOPE_SETTINGS }),
                ...YAML_SCOPE_FILES,
            },
        },
    );
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const selected = await spawnGspot(root, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    await assertYamlFiles(root);
    const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect((JSON.parse(formatted.stdout) as RunReport).checks).toMatchObject([
        { check: 'format/prettier', scope: '', status: 'passed', findings: [] },
    ]);
    await Bun.write(join(root, 'app/settings/project.yaml'), YAML_SCOPE_SAMPLE);
    await assertYamlFiles(root, 'truthy');
    await Bun.write(join(root, 'app/settings/project.yaml'), YAML_SCOPE_FILES['app/settings/project.yaml']);
    await assertYamlFiles(root);
});

test('v8r leaves gspot.toml and its TOML dates to gspot', async () => {
    const { root, environment } = installedSandbox();
    await using _change = await updateSandbox(installedSandbox(), { check: 'files/v8r', files: {} });
    const settingsPath = join(root, 'gspot.toml');
    const settings = await Bun.file(settingsPath).text();
    await Bun.write(
        settingsPath,
        `${settings}\n[[ignore]]\ncheck = "files/yamllint"\nreason = "The sample holds no YAML."\nuntil = 2099-01-01\n`,
    );
    const applied = await spawnGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = await spawnGspot(root, ['check', 'gspot.toml', '--only', 'files/v8r', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});
