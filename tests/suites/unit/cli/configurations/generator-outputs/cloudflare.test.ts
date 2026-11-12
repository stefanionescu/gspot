import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';

import { EXECUTABLE_FILE } from '#cli/config/system.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { buildProcessResult, runCommand } from '#tests/setup/system/processes.ts';

const CLOUDFLARE_ENV_SOURCE = 'interface CloudflareEnv {}\n';

async function fakeWrangler(root: string): Promise<DisposableStack> {
    const pin = getTool(readConfigurations().values(), 'wrangler');
    const path = join(root, 'node_modules', '.bin', pin.name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '');
    await chmod(path, EXECUTABLE_FILE);
    return fakeToolExecutables([pin]);
}

function fakeWranglerTypes(source: string) {
    return fakeCommands().mockImplementation(async (_commandArguments, options) => {
        await writeFile(join(options.cwd, 'cloudflare-env.d.ts'), source);
        return buildProcessResult();
    });
}

test('an OpenNext scope checks cloudflare-env.d.ts against CloudflareEnv, and reports the file until Git tracks it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            scopes: [{ path: 'workers/api', configurations: ['cloudflare'] }],
            tables: '[scope.cloudflare]\ntypes_file = "cloudflare-env.d.ts"\ntypes_interface = "CloudflareEnv"\n',
        }),
        'workers/api/wrangler.jsonc': '{ "name": "shop" }\n',
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'workers/api/cloudflare-env.d.ts'), CLOUDFLARE_ENV_SOURCE);
    using resources = new DisposableStack();
    const run = resources.use(fakeWranglerTypes(CLOUDFLARE_ENV_SOURCE));
    resources.use(await fakeWrangler(sandbox.path));
    const untracked = await runSandboxCheck(sandbox.path, 'cloudflare/stale-types', { scope: 'workers/api' });
    expect(untracked.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'workers/api/cloudflare-env.d.ts', rule: 'untracked' },
    ]);
    expect(run).not.toHaveBeenCalled();
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'cloudflare/stale-types', { scope: 'workers/api' })).toStrictEqual([]);
    expect(run.mock.calls.map(([command]) => command.slice(1))).toStrictEqual([
        ['types', 'cloudflare-env.d.ts', '--env-interface', 'CloudflareEnv'],
    ]);
});

test('the wrangler types of the test tools write a cloudflare-env.d.ts that passes, and a changed binding reports the file', async () => {
    using _environment = overrideEnvironment({ WRANGLER_SEND_METRICS: 'false' });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['cloudflare'], {
            tables: '[cloudflare]\ntypes_file = "cloudflare-env.d.ts"\n',
        }),
        'package.json': '{"private":true,"type":"module","devDependencies":{"wrangler":"0.0.0-test"}}',
        'wrangler.jsonc':
            '{"name":"offline-types","main":"worker.ts","compatibility_date":"2026-01-01","vars":{"GREETING":"hello"}}',
        'worker.ts': 'export default { fetch() { return new Response("Ready"); } };',
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const generated = await runCommand(
        [
            'node',
            join(sandbox.path, 'node_modules/wrangler/bin/wrangler.js'),
            'types',
            'cloudflare-env.d.ts',
            '--env-interface',
            'Env',
        ],
        { cwd: sandbox.path, env: { WRANGLER_SEND_METRICS: 'false' } },
    );
    expect(generated.code, generated.stdout + generated.stderr).toBe(0);
    commitAll(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'cloudflare/stale-types')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'wrangler.jsonc'),
        '{"name":"offline-types","main":"worker.ts","compatibility_date":"2026-01-01","vars":{"GREETING":"hello","NEW_BINDING":"changed"}}',
    );
    expect(await runSandboxCheck(sandbox.path, 'cloudflare/stale-types')).toStrictEqual([
        expect.objectContaining({
            file: 'cloudflare-env.d.ts',
            line: 1,
            rule: 'stale',
            message: expect.stringContaining('wrangler types --env-interface Env') as string,
        }),
    ]);
});
