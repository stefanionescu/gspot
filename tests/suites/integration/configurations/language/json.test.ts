import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGitStep } from '#tests/setup/system/git.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const UNCLOSED_SEQUENCE = 'invalid: [\n';

const installedSandbox = shareInstalledSandbox({
    configurations: ['json'],
    files: {
        'schema.json': '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}\n',
    },
});

test('v8r validates a staged JSON file with a non-ASCII path against its schema', async () => {
    const { root } = installedSandbox();
    using server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,

        fetch: async () => new Response(await readFile(join(root, 'schema.json'))),
    });
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: { 'settings/café.json': JSON.stringify({ count: 'invalid' }), '.v8rrc.yml': UNCLOSED_SEQUENCE },
        settings: stringify({
            json: { schemas: [{ paths: ['settings/café.json'], url: `${server.url.href}schema.json` }] },
        }),
    });
    runGitStep(root, ['add', '-A']);
    const command = ['check', '--only', 'json/v8r', '--staged', '--json'];
    const invalid = parseCheckReport(await spawnGspot(root, command));
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks).toMatchObject([
        {
            check: 'json/v8r',
            status: 'failed',
            findings: [matchFields({ file: 'settings/café.json' })],
        },
    ]);
    await writeFile(join(root, 'settings/café.json'), JSON.stringify({ count: 1 }));
    runGitStep(root, ['add', 'settings/café.json']);
    const valid = parseCheckReport(await spawnGspot(root, command));
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(valid.report.checks).toMatchObject([{ check: 'json/v8r', status: 'passed', findings: [] }]);
});
