import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { applyChanges } from '#tests/setup/files.ts';
import { git, gitOutput } from '#tests/setup/git.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { SampleChanges } from '#tests/types/checks.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';

import {
    FILES_CASES,
    FILES_SANDBOX,
    YAML_SCOPE_FILES,
    YAML_SCOPE_SAMPLE,
    YAML_SCOPE_SETTINGS,
} from '#tests/config/files.ts';

const installedSandbox = shareInstalledSandbox(FILES_SANDBOX);

for (const entry of FILES_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        await runCheckSample(installedSandbox(), entry, FILES_SANDBOX);
    });
}

test('Taplo fixes inline table spacing', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    state.use(
        await preserveSandboxChanges(installedSandbox(), {
            check: 'files/taplo-format',
            files: { 'settings/inline.toml': '' },
        }),
    );
    const path = join(root, 'settings/inline.toml');
    const command = ['check', 'settings/inline.toml', '--only', 'files/taplo-format', '--json'];
    {
        const level = 'all';
        const selected = await spawnGspot(root, ['set', 'level', level], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(path, 'entry={key=true}\n');
        const fixed = await spawnGspot(root, [...command, '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(path).text()).toBe('entry = { key = true }\n');
        const checked = await spawnGspot(root, command, environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo-format', status: 'passed', findings: [] },
        ]);
    }
});

test('Taplo follows an extra tool option for compact inline tables and returns to its default without it', async () => {
    const { root, environment } = installedSandbox();
    await using state = new AsyncDisposableStack();
    state.use(
        await preserveSandboxChanges(installedSandbox(), {
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
        await preserveSandboxChanges(installedSandbox(), {
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
    // A conflicting authored config must not replace the generated configuration.
    await Bun.write(join(root, '.v8rrc.yml'), 'invalid: [\n');
    const path = join(root, 'settings/café.json');
    await Bun.write(path, JSON.stringify({ count: 'invalid' }));
    expect(git(root, ['add', '-A']).code).toBe(0);
    const command = ['check', '--only', 'files/v8r', '--staged', '--json'];
    const invalid = await spawnGspot(root, command, environment);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'files/v8r',
            status: 'failed',
            findings: [
                containing({
                    file: 'settings/café.json',
                    message: textContaining('must be integer'),
                }),
            ],
        },
    ]);
    await Bun.write(path, JSON.stringify({ count: 1 }));
    expect(git(root, ['add', 'settings/café.json']).code).toBe(0);
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
        await preserveSandboxChanges(installedSandbox(), {
            check: 'files/taplo',
            files: { 'settings/schema.toml': directive + 'value =\n' },
        }),
    );
    const command = ['check', 'settings/schema.toml', '--only', 'files/taplo', '--json'];
    {
        const level = 'all';
        const selected = await spawnGspot(root, ['set', 'level', level], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(join(root, 'settings/schema.toml'), directive + 'value =\n');
        const failed = await spawnGspot(root, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo', status: 'failed', findings: [{ file: 'settings/schema.toml', line: 2 }] },
        ]);
        await Bun.write(join(root, 'settings/schema.toml'), directive + 'value = 1\n');
        const corrected = await spawnGspot(root, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/taplo', status: 'passed', findings: [] },
        ]);
    }
    expect(requests).toBe(0);
});

// Every phase checks the root and child independently through the same native contract.
async function expectYamlFiles(root: string, rule?: string): Promise<void> {
    const checked = await spawnGspot(root, ['check', '--only', 'files/yamllint', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(rule === undefined ? 0 : 1);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/yamllint', scope: '', status: 'passed', findings: [] },
        {
            check: 'files/yamllint',
            scope: 'app',
            status: rule === undefined ? 'passed' : 'failed',
            findings: rule === undefined ? [] : [containing({ file: 'app/settings/project.yaml', rule, line: 2 })],
        },
    ]);
}

test("yamllint applies each scope's lint rule options, and Prettier keeps two-space YAML", async () => {
    const { root } = installedSandbox();
    await using state = new AsyncDisposableStack();
    const restore = await applyChanges(root, {
        check: 'files/yamllint',
        removed: Object.keys(FILES_SANDBOX.files),
        files: {
            'gspot.toml': settingsText([], { tables: YAML_SCOPE_SETTINGS }),
            ...YAML_SCOPE_FILES,
        },
    });
    state.defer(async () => {
        await restore();
        const restored = await spawnGspot(root, ['apply']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    {
        const level = 'all';
        const selected = await spawnGspot(root, ['set', 'level', level]);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await expectYamlFiles(root);
        const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--json']);
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
        expect((JSON.parse(formatted.stdout) as RunReport).checks).toMatchObject([
            { check: 'format/prettier', scope: '', status: 'passed', findings: [] },
        ]);
        await Bun.write(join(root, 'app/settings/project.yaml'), YAML_SCOPE_SAMPLE);
        await expectYamlFiles(root, 'truthy');
        await Bun.write(join(root, 'app/settings/project.yaml'), YAML_SCOPE_FILES['app/settings/project.yaml']);
        await expectYamlFiles(root);
    }
});

/**
 * Restore source, settings, index and generated outputs after commands mutate a shared sandbox.
 * @param repository the prepared repository and public command runner.
 * @param changes the authored files and settings changed by the test.
 * @returns cleanup of the test's source and generated state.
 */
async function preserveSandboxChanges(repository: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    const { root, environment, run } = repository;
    const tree = gitOutput(root, ['write-tree']).trim();
    const restore = await applyChanges(root, changes);
    return {
        async [Symbol.asyncDispose]() {
            await restore();
            gitOutput(root, ['read-tree', tree]);
            const applied = await run(root, ['apply'], environment);
            if (applied.code !== 0) throw new Error(`Sandbox restoration failed: ${applied.stdout}${applied.stderr}`);
        },
    };
}
